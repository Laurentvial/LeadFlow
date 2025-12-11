import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DateInput } from './ui/date-input';
import { Calendar as CalendarIcon, Plus, Clock, User, Pencil, Trash2, X, Send, Search, BarChart3 } from 'lucide-react';
import { apiCall } from '../utils/api';
import { useUser } from '../contexts/UserContext';
import { useUsers } from '../hooks/useUsers';
import { useHasPermission } from '../hooks/usePermissions';
import { AppointmentCard } from './AppointmentCard';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts@2.15.2';
import '../styles/PlanningCalendar.css';
import '../styles/Modal.css';
import '../styles/PageHeader.css';
import { toast } from 'sonner';

export function PlanningAdministrateur() {
  const { currentUser } = useUser();
  const { users } = useUsers();
  
  // Permission checks
  const canCreate = useHasPermission('planning_administrateur', 'create');
  const canEdit = useHasPermission('planning_administrateur', 'edit');
  const canDelete = useHasPermission('planning_administrateur', 'delete');
  
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [pastEvents, setPastEvents] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactNotes, setContactNotes] = useState<Record<string, any[]>>({});
  const [notesLoading, setNotesLoading] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null); // Selected day for filtering
  const [view, setView] = useState<'month' | 'week' | 'day'>('day'); // Calendar view mode
  const dayHoursRef = useRef<HTMLDivElement>(null); // Ref for day hours container
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);
  const [graphData, setGraphData] = useState<any[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upcomingEventsPage, setUpcomingEventsPage] = useState(1);
  const [upcomingEventsHasMore, setUpcomingEventsHasMore] = useState(false);
  const [loadingMoreUpcomingEvents, setLoadingMoreUpcomingEvents] = useState(false);
  const [pastEventsPage, setPastEventsPage] = useState(1);
  const [pastEventsHasMore, setPastEventsHasMore] = useState(false);
  const [loadingMorePastEvents, setLoadingMorePastEvents] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchFocused, setClientSearchFocused] = useState(false);
  const [editClientSearchQuery, setEditClientSearchQuery] = useState('');
  const [editClientSearchFocused, setEditClientSearchFocused] = useState(false);
  const [hoveredEvent, setHoveredEvent] = useState<any>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    hour: '09',
    minute: '00',
    clientId: '',
    userId: ''
  });
  const [editFormData, setEditFormData] = useState({
    date: '',
    hour: '09',
    minute: '00',
    clientId: '',
    userId: ''
  });

  // Initialize userId with current user and today's date when modal opens
  useEffect(() => {
    if (isModalOpen) {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      setFormData(prev => ({ 
        ...prev, 
        userId: currentUser?.id || prev.userId,
        date: todayStr // Always set to today when modal opens
      }));
    }
  }, [isModalOpen, currentUser]);

  useEffect(() => {
    loadData();
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Auto-scroll to current hour in day view
  useEffect(() => {
    if (view === 'day' && dayHoursRef.current && !loading) {
      const today = new Date();
      const isToday = selectedDate.getDate() === today.getDate() &&
                     selectedDate.getMonth() === today.getMonth() &&
                     selectedDate.getFullYear() === today.getFullYear();
      
      if (isToday) {
        const currentHour = today.getHours();
        // Find the hour element by data-hour attribute
        const currentHourElement = dayHoursRef.current.querySelector(`[data-hour="${currentHour}"]`) as HTMLElement;
        
        if (currentHourElement && dayHoursRef.current) {
          // Calculate scroll position: element position relative to container minus half container height for centering
          const container = dayHoursRef.current;
          const elementTop = currentHourElement.offsetTop;
          const containerHeight = container.clientHeight;
          const scrollPosition = elementTop - (containerHeight / 2) + (currentHourElement.offsetHeight / 2);
          
          // Scroll the container smoothly
          container.scrollTo({
            top: Math.max(0, scrollPosition),
            behavior: 'smooth'
          });
        }
      }
    }
  }, [view, selectedDate, loading]);

  // Load notes for a contact
  const loadContactNotes = async (contactId: string) => {
    if (!contactId || contactNotes[contactId] || notesLoading[contactId]) {
      return;
    }

    setNotesLoading(prev => ({ ...prev, [contactId]: true }));
    try {
      const data = await apiCall(`/api/notes/?contactId=${contactId}`);
      const notesArray = Array.isArray(data) ? data : (data?.notes || []);
      // Sort by date descending and take last 3
      const sortedNotes = notesArray
        .sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
          const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
          return dateB - dateA; // Most recent first
        })
        .slice(0, 3); // Get last 3 notes
      setContactNotes(prev => ({ ...prev, [contactId]: sortedNotes }));
    } catch (error) {
      console.error('Error loading notes:', error);
      setContactNotes(prev => ({ ...prev, [contactId]: [] }));
    } finally {
      setNotesLoading(prev => ({ ...prev, [contactId]: false }));
    }
  };

  // Load notes for all contacts in events when events change
  useEffect(() => {
    const allEvents = [...upcomingEvents, ...pastEvents];
    const contactIds = new Set<string>();
    
    allEvents.forEach(event => {
      const contactId = event.clientId_read || event.contactId;
      if (contactId && !contactNotes[contactId] && !notesLoading[contactId]) {
        contactIds.add(contactId);
      }
    });

    // Load notes for all unique contacts
    contactIds.forEach(contactId => {
      loadContactNotes(contactId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingEvents, pastEvents]);

  async function loadData(upcomingPage: number = 1, pastPage: number = 1, appendUpcoming: boolean = false, appendPast: boolean = false) {
    if (upcomingPage === 1 && pastPage === 1) {
      setLoading(true);
    } else if (appendUpcoming) {
      setLoadingMoreUpcomingEvents(true);
    } else if (appendPast) {
      setLoadingMorePastEvents(true);
    }
    
    try {
      // Load upcoming events and past events with pagination in parallel
      // Use all_events=true to bypass permission filtering (admin-only page)
      const [upcomingEventsData, pastEventsData, contactsData] = await Promise.all([
        apiCall(`/api/events/?future_only=true&all_events=true&page=${upcomingPage}&page_size=100`), // Load upcoming events with pagination (large page size)
        apiCall(`/api/events/?past_only=true&all_events=true&page=${pastPage}&page_size=10`), // Load past events with pagination
        (upcomingPage === 1 && pastPage === 1) ? apiCall('/api/contacts/?all_contacts=true&page_size=2000') : Promise.resolve(null) // Load contacts on first page (max 2000 for performance), bypass permission filtering
      ]);
      
      const now = new Date();
      const upcomingArray = (upcomingEventsData?.events || upcomingEventsData || []).filter((event: any) => {
        if (!event.datetime) return false;
        return new Date(event.datetime) > now;
      });
      const pastArray = (pastEventsData?.events || pastEventsData || []).filter((event: any) => {
        if (!event.datetime) return false;
        return new Date(event.datetime) <= now;
      });
      
      if (upcomingPage === 1 && pastPage === 1) {
        setUpcomingEvents(upcomingArray);
        setPastEvents(pastArray);
        setContacts(contactsData?.contacts || contactsData || []);
      } else {
        // Append events when loading more
        if (appendUpcoming) {
          setUpcomingEvents(prev => [...prev, ...upcomingArray]);
        } else if (upcomingPage === 1) {
          setUpcomingEvents(upcomingArray);
        }
        
        if (appendPast) {
          setPastEvents(prev => [...prev, ...pastArray]);
        } else if (pastPage === 1) {
          setPastEvents(pastArray);
        }
      }
      
      // Update pagination state for both upcoming and past events
      setUpcomingEventsHasMore(upcomingEventsData?.has_next || false);
      setUpcomingEventsPage(upcomingPage);
      setPastEventsHasMore(pastEventsData?.has_next || false);
      setPastEventsPage(pastPage);
    } catch (error) {
      console.error('Error loading planning data:', error);
    } finally {
      setLoading(false);
      setLoadingMoreUpcomingEvents(false);
      setLoadingMorePastEvents(false);
    }
  }

  async function handleLoadMoreUpcoming() {
    const nextPage = upcomingEventsPage + 1;
    await loadData(nextPage, pastEventsPage, true, false);
  }

  async function handleLoadMorePast() {
    const nextPage = pastEventsPage + 1;
    await loadData(upcomingEventsPage, nextPage, false, true);
  }

  async function handleCreateEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!formData.clientId) {
      toast.error('Veuillez sélectionner un contact');
      return;
    }
    
    try {
      const timeString = `${formData.hour.padStart(2, '0')}:${formData.minute.padStart(2, '0')}`;
      await apiCall('/api/events/create/', {
        method: 'POST',
        body: JSON.stringify({
          datetime: `${formData.date}T${timeString}`,
          contactId: formData.clientId,
          userId: formData.userId || currentUser?.id || null,
        }),
      });
      
      setIsModalOpen(false);
      setFormData({ date: '', hour: '09', minute: '00', clientId: '', userId: currentUser?.id || '' });
      setClientSearchQuery('');
      setClientSearchFocused(false);
      loadData();
      toast.success('Événement créé avec succès');
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Erreur lors de la création de l\'événement');
    }
  }

  function handleEditEvent(event: any) {
    if (!canEdit) return;
    const eventDate = new Date(event.datetime);
    const dateStr = eventDate.toISOString().split('T')[0];
    const hour = eventDate.getHours().toString().padStart(2, '0');
    const minute = eventDate.getMinutes().toString().padStart(2, '0');
    
    setEditingEvent(event);
    const selectedClientId = event.clientId_read || event.contactId || '';
    const selectedClient = contacts.find(c => c.id === selectedClientId);
    
    // Get contact name: prefer from contacts array, then from event's contactName/clientName, then empty
    let contactName = '';
    if (selectedClient) {
      contactName = `${selectedClient.fname} ${selectedClient.lname}`.trim();
    } else if (event.contactName) {
      contactName = event.contactName;
    } else if (event.clientName) {
      contactName = event.clientName;
    } else if (selectedClientId) {
      // Try to get name using getEventClientName helper
      contactName = getEventClientName(event);
    }
    
    setEditFormData({
      date: dateStr,
      hour: hour,
      minute: minute,
      clientId: selectedClientId,
      userId: event.userId || currentUser?.id || ''
    });
    setEditClientSearchQuery(contactName);
    setIsEditModalOpen(true);
  }

  async function handleUpdateEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!editingEvent) return;
    
    if (!editFormData.clientId) {
      toast.error('Veuillez sélectionner un contact');
      return;
    }
    
    try {
      const timeString = `${editFormData.hour.padStart(2, '0')}:${editFormData.minute.padStart(2, '0')}`;
      await apiCall(`/api/events/${editingEvent.id}/update/`, {
        method: 'PUT',
        body: JSON.stringify({
          datetime: `${editFormData.date}T${timeString}`,
          contactId: editFormData.clientId,
          userId: editFormData.userId || currentUser?.id || null
        }),
      });
      
      setIsEditModalOpen(false);
      setEditingEvent(null);
      setEditFormData({ date: '', hour: '09', minute: '00', clientId: '', userId: currentUser?.id || '' });
      setEditClientSearchQuery('');
      setEditClientSearchFocused(false);
      loadData();
      toast.success('Événement modifié avec succès');
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Erreur lors de la modification de l\'événement');
    }
  }

  async function handleDeleteEvent(id: string) {
    if (!canDelete) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rendez-vous ?')) return;
    
    try {
      await apiCall(`/api/events/${id}/`, { method: 'DELETE' });
      loadData();
      toast.success('Événement supprimé avec succès');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Erreur lors de la suppression de l\'événement');
    }
  }

  const daysInMonth = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfMonth = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    1
  ).getDay();

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  // Filter contacts based on search query for create modal
  const filteredContacts = contacts.filter((client) => {
    if (!clientSearchQuery) return false; // Only show results when typing
    const query = clientSearchQuery.toLowerCase();
    const fname = (client.fname || client.firstName || '').toLowerCase();
    const lname = (client.lname || client.lastName || '').toLowerCase();
    const fullName = `${fname} ${lname}`.trim();
    const email = (client.email || '').toLowerCase();
    // Search in first name, last name, full name, and email
    return fullName.includes(query) || 
           fname.includes(query) || 
           lname.includes(query) || 
           email.includes(query);
  });

  // Filter contacts based on search query for edit modal
  const filteredEditContacts = contacts.filter((client) => {
    if (!editClientSearchQuery) return false; // Only show results when typing
    const query = editClientSearchQuery.toLowerCase();
    const fname = (client.fname || client.firstName || '').toLowerCase();
    const lname = (client.lname || client.lastName || '').toLowerCase();
    const fullName = `${fname} ${lname}`.trim();
    const email = (client.email || '').toLowerCase();
    // Search in first name, last name, full name, and email
    return fullName.includes(query) || 
           fname.includes(query) || 
           lname.includes(query) || 
           email.includes(query);
  });

  // Get selected client name
  const getSelectedClientName = (clientId: string) => {
    if (!clientId || clientId === 'none') return 'Sélectionner un contact';
    const client = contacts.find(c => c.id === clientId);
    return client ? `${client.fname} ${client.lname}` : 'Sélectionner un contact';
  };

  // Get client name from event (from contactName/clientName field or lookup from contacts)
  const getEventClientName = (event: any) => {
    // First try to use contactName (from backend) or clientName (for backward compatibility)
    if (event.contactName) {
      return event.contactName;
    }
    if (event.clientName) {
      return event.clientName;
    }
    // Otherwise, look up from contacts array
    const contactId = event.clientId_read || event.contactId;
    if (contactId) {
      const client = contacts.find(c => c.id === contactId);
      if (client) {
        return `${client.fname || ''} ${client.lname || ''}`.trim() || 'Sans nom';
      }
    }
    return 'Sans nom';
  };

  // Get user name from userId
  const getUserName = (userId: string | null | undefined) => {
    if (!userId) return 'Non assigné';
    const user = users.find(u => u.id === userId);
    if (user) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
    }
    return 'Utilisateur inconnu';
  };

  // Handle event hover
  const handleEventMouseEnter = (event: any, e: React.MouseEvent) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredEvent(event);
      // Adjust position to prevent going off-screen
      const modalWidth = 400;
      const modalHeight = 300;
      let x = e.clientX + 10;
      let y = e.clientY + 10;
      
      // Adjust if would go off right edge
      if (x + modalWidth > window.innerWidth) {
        x = e.clientX - modalWidth - 10;
      }
      
      // Adjust if would go off bottom edge
      if (y + modalHeight > window.innerHeight) {
        y = e.clientY - modalHeight - 10;
      }
      
      // Ensure it doesn't go off left or top edges
      x = Math.max(10, x);
      y = Math.max(10, y);
      
      setHoverPosition({ x, y });
    }, 300); // Small delay before showing
  };

  const handleEventMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredEvent(null);
    }, 100); // Small delay before hiding
  };

  function getEventsForDay(day: number) {
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const allEvents = [...upcomingEvents, ...pastEvents];
    return allEvents.filter(event => {
      if (!event.datetime) return false;
      const eventDate = new Date(event.datetime).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  }

  // Get events for a specific date
  function getEventsForDate(date: Date) {
    const dateStr = date.toISOString().split('T')[0];
    const allEvents = [...upcomingEvents, ...pastEvents];
    return allEvents.filter(event => {
      if (!event.datetime) return false;
      const eventDate = new Date(event.datetime).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  }

  // Get events for a specific hour in a day
  function getEventsForHour(date: Date, hour: number) {
    const events = getEventsForDate(date);
    return events.filter(event => {
      if (!event.datetime) return false;
      const eventDate = new Date(event.datetime);
      return eventDate.getHours() === hour;
    });
  }

  // Get week days (Sunday to Saturday)
  function getWeekDays(): Date[] {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day; // Get Sunday of the week
    const sunday = new Date(startOfWeek.setDate(diff));
    
    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      weekDays.push(date);
    }
    return weekDays;
  }

  // Get hours for day view (0-23)
  function getHours() {
    return Array.from({ length: 24 }, (_, i) => i);
  }

  // Navigation functions
  function goToPreviousPeriod() {
    if (view === 'month') {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
    } else if (view === 'week') {
      const newDate = new Date(selectedDate);
      newDate.setDate(selectedDate.getDate() - 7);
      setSelectedDate(newDate);
    } else if (view === 'day') {
      const newDate = new Date(selectedDate);
      newDate.setDate(selectedDate.getDate() - 1);
      setSelectedDate(newDate);
    }
    setSelectedDay(null);
  }

  function goToNextPeriod() {
    if (view === 'month') {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
    } else if (view === 'week') {
      const newDate = new Date(selectedDate);
      newDate.setDate(selectedDate.getDate() + 7);
      setSelectedDate(newDate);
    } else if (view === 'day') {
      const newDate = new Date(selectedDate);
      newDate.setDate(selectedDate.getDate() + 1);
      setSelectedDate(newDate);
    }
    setSelectedDay(null);
  }

  function goToToday() {
    setSelectedDate(new Date());
    setSelectedDay(null);
  }

  // Get display title based on view
  function getViewTitle() {
    if (view === 'month') {
      return `${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
    } else if (view === 'week') {
      const weekDays = getWeekDays();
      const start = weekDays[0];
      const end = weekDays[6];
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()}-${end.getDate()} ${monthNames[start.getMonth()]} ${start.getFullYear()}`;
      } else {
        return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${start.getFullYear()}`;
      }
    } else {
      return `${selectedDate.getDate()} ${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
    }
  }

  // Load graph data for current month
  const loadGraphData = useCallback(async () => {
    setGraphLoading(true);
    try {
      const currentMonth = selectedDate.getMonth();
      const currentYear = selectedDate.getFullYear();
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
      
      // Fetch all events for the month
      const allEvents: any[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await apiCall(`/api/events/?all_events=true&page=${page}&page_size=100`);
        const events = response?.events || response || [];
        const filteredEvents = events.filter((event: any) => {
          if (!event.datetime) return false;
          const eventDate = new Date(event.datetime);
          return eventDate >= startDate && eventDate <= endDate;
        });
        allEvents.push(...filteredEvents);
        
        hasMore = response?.has_next || false;
        if (events.length < 100) hasMore = false;
        page++;
      }
      
      console.log('All events for month:', allEvents.length);
      if (allEvents.length > 0) {
        console.log('Sample event (full):', JSON.stringify(allEvents[0], null, 2));
        console.log('Sample event userId:', allEvents[0].userId);
        console.log('Sample event assignedTo:', allEvents[0].assignedTo);
        console.log('Sample event createdBy:', allEvents[0].createdBy);
      }
      
      // Aggregate events by day and user
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const aggregatedData: any[] = [];
      
      // Get all unique user IDs
      const userIds = new Set<string>();
      const eventsWithoutUserId: any[] = [];
      allEvents.forEach(event => {
        if (event.userId) {
          userIds.add(event.userId);
        } else {
          eventsWithoutUserId.push(event);
        }
      });
      
      console.log('Unique user IDs found:', Array.from(userIds));
      console.log('Events without userId:', eventsWithoutUserId.length);
      if (eventsWithoutUserId.length > 0 && eventsWithoutUserId.length < 5) {
        console.log('Sample events without userId:', eventsWithoutUserId.slice(0, 3));
      }
      
      // Create data structure for each day
      for (let day = 1; day <= daysInMonth; day++) {
        const dayData: any = {
          day: day,
          date: `${day}/${currentMonth + 1}`
        };
        
        // Initialize count for each user
        userIds.forEach(userId => {
          const user = users.find(u => u.id === userId);
          const userName = user 
            ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `User ${userId}`
            : `User ${userId}`;
          dayData[userName] = 0;
        });
        
        // Count events for this day
        const dayEvents = allEvents.filter(event => {
          if (!event.datetime) return false;
          const eventDate = new Date(event.datetime);
          return eventDate.getDate() === day && eventDate.getMonth() === currentMonth;
        });
        
        dayEvents.forEach(event => {
          if (event.userId) {
            const user = users.find(u => u.id === event.userId);
            const userName = user 
              ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `User ${event.userId}`
              : `User ${event.userId}`;
            if (dayData[userName] !== undefined) {
              dayData[userName] = (dayData[userName] || 0) + 1;
            }
          }
        });
        
        aggregatedData.push(dayData);
      }
      
      console.log('Graph data loaded:', aggregatedData);
      console.log('Total events:', allEvents.length);
      setGraphData(aggregatedData);
    } catch (error) {
      console.error('Error loading graph data:', error);
      toast.error('Erreur lors du chargement des données du graphique');
    } finally {
      setGraphLoading(false);
    }
  }, [selectedDate, users]);

  // Load graph data when modal opens
  useEffect(() => {
    if (isGraphModalOpen) {
      loadGraphData();
    }
  }, [isGraphModalOpen, loadGraphData]);

  return (
    <div className="planning-container">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Planning Administrateur</h1>
          <p className="page-subtitle">Gestion des rendez-vous administrateur</p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {canCreate && (
            <>
              <Button type="button" onClick={() => setIsModalOpen(true)}>
                <Plus className="planning-icon planning-icon-with-margin" />
                Ajouter un rendez-vous
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsGraphModalOpen(true)}>
                <BarChart3 className="planning-icon planning-icon-with-margin" />
                Statistiques
              </Button>
            </>
          )}
        </div>
        
        {isModalOpen && (
          <div className="modal-overlay" onClick={() => {
            setIsModalOpen(false);
            setClientSearchQuery('');
            setClientSearchFocused(false);
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Nouveau rendez-vous</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="modal-close"
                  onClick={() => {
                    setIsModalOpen(false);
                    setClientSearchQuery('');
                    setClientSearchFocused(false);
                  }}
                >
                  <X className="planning-icon-md" />
                </Button>
              </div>
              <form onSubmit={handleCreateEvent} className="modal-form">
                <div className="modal-form-field">
                  <Label>Date</Label>
                  <DateInput
                    value={formData.date}
                    onChange={(value) => setFormData({ ...formData, date: value })}
                    required
                  />
                </div>
                
                <div className="modal-form-field">
                  <Label>Heure</Label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Select
                      value={formData.hour}
                      onValueChange={(value) => setFormData({ ...formData, hour: value })}
                    >
                      <SelectTrigger style={{ flex: 1 }}>
                        <SelectValue placeholder="Heure" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = i.toString().padStart(2, '0');
                          return (
                            <SelectItem key={hour} value={hour}>
                              {hour}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>:</span>
                    <Select
                      value={formData.minute}
                      onValueChange={(value) => setFormData({ ...formData, minute: value })}
                    >
                      <SelectTrigger style={{ flex: 1 }}>
                        <SelectValue placeholder="Minute" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 60 }, (_, i) => {
                          const minute = i.toString().padStart(2, '0');
                          return (
                            <SelectItem key={minute} value={minute}>
                              {minute}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="modal-form-field">
                  <Label>Contact <span style={{ color: 'red' }}>*</span></Label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        type="text"
                        placeholder="Rechercher un contact..."
                        value={clientSearchQuery}
                        onChange={(e) => {
                          setClientSearchQuery(e.target.value);
                          setClientSearchFocused(true);
                        }}
                        onFocus={() => setClientSearchFocused(true)}
                        onBlur={() => setTimeout(() => setClientSearchFocused(false), 200)}
                        className="pl-10"
                        required
                      />
                    </div>
                    {clientSearchFocused && clientSearchQuery && (
                      <div className="absolute z-[99999] w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredContacts.length > 0 ? (
                          <div className="p-1">
                            {filteredContacts.map((client) => (
                              <div
                                key={client.id}
                                className="px-3 py-2 cursor-pointer hover:bg-accent rounded-sm text-sm"
                                onClick={() => {
                                  setFormData({ ...formData, clientId: client.id });
                                  setClientSearchQuery(`${client.fname} ${client.lname}`);
                                  setClientSearchFocused(false);
                                }}
                              >
                                {client.fname} {client.lname}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 text-sm text-muted-foreground text-center">
                            Aucun contact trouvé
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {formData.clientId && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Contact sélectionné : {getSelectedClientName(formData.clientId)}
                    </div>
                  )}
                  {!formData.clientId && (
                    <div className="mt-1 text-sm text-red-500">
                      Veuillez sélectionner un contact
                    </div>
                  )}
                </div>
                
                <div className="modal-form-field">
                  <Label>Utilisateur</Label>
                  <Select
                    value={formData.userId || ''}
                    onValueChange={(value) => setFormData({ ...formData, userId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un utilisateur" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => {
                        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                        return (
                          <SelectItem key={user.id} value={user.id}>
                            {displayName}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="modal-form-actions">
                  <Button type="button" variant="outline" onClick={() => {
                    setIsModalOpen(false);
                    setClientSearchQuery('');
                    setClientSearchFocused(false);
                  }}>
                    Annuler
                  </Button>
                  {canCreate && (
                    <Button type="submit">
                      Créer
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {isGraphModalOpen && (
          <div className="modal-overlay" onClick={() => setIsGraphModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', width: '1000px' }}>
              <div className="modal-header">
                <h2 className="modal-title">
                  Statistiques des événements - {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="modal-close"
                  onClick={() => setIsGraphModalOpen(false)}
                >
                  <X className="planning-icon-md" />
                </Button>
              </div>
              <div style={{ padding: '20px', minHeight: '400px' }}>
                {graphLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                    <div>Chargement des données...</div>
                  </div>
                ) : graphData.length === 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                    <div>Aucune donnée disponible pour ce mois</div>
                  </div>
                ) : (() => {
                  // Get all user names from the data
                  const userNames = new Set<string>();
                  graphData.forEach(day => {
                    Object.keys(day).forEach(key => {
                      if (key !== 'day' && key !== 'date') {
                        userNames.add(key);
                      }
                    });
                  });
                  
                  if (userNames.size === 0) {
                    return (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                        <div>Aucun utilisateur avec des événements ce mois</div>
                      </div>
                    );
                  }
                  
                  const config: any = {};
                  const colors = [
                    '#8884d8',
                    '#82ca9d',
                    '#ffc658',
                    '#ff7300',
                    '#00ff00',
                    '#0088fe',
                    '#00c49f',
                    '#ffbb28',
                    '#ff8042',
                    '#8884d8'
                  ];
                  
                  Array.from(userNames).forEach((userName, index) => {
                    config[userName] = {
                      label: userName,
                      color: colors[index % colors.length]
                    };
                  });
                  
                  console.log('Rendering chart with data:', graphData.slice(0, 3), '...');
                  console.log('User names:', Array.from(userNames));
                  
                  return (
                    <div style={{ width: '100%', height: '500px', minHeight: '500px' }}>
                      <ChartContainer
                        config={config}
                        className="w-full"
                        style={{ height: '500px', minHeight: '500px', aspectRatio: 'auto' }}
                      >
                        <BarChart data={graphData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            angle={-45}
                            textAnchor="end"
                            height={100}
                            interval={Math.max(0, Math.floor(graphData.length / 15))}
                          />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend />
                          {Array.from(userNames).map((userName, index) => (
                            <Bar 
                              key={userName}
                              dataKey={userName} 
                              fill={colors[index % colors.length]}
                              name={userName}
                            />
                          ))}
                        </BarChart>
                      </ChartContainer>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {isEditModalOpen && editingEvent && (
          <div className="modal-overlay" onClick={() => {
            setIsEditModalOpen(false);
            setEditingEvent(null);
            setEditFormData({ date: '', hour: '09', minute: '00', clientId: '', userId: currentUser?.id || '' });
            setEditClientSearchQuery('');
            setEditClientSearchFocused(false);
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Modifier le rendez-vous</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="modal-close"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingEvent(null);
                    setEditFormData({ date: '', hour: '09', minute: '00', clientId: '', userId: currentUser?.id || '' });
                    setEditClientSearchQuery('');
                    setEditClientSearchFocused(false);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <form onSubmit={handleUpdateEvent} className="modal-form">
                <div className="modal-form-field">
                  <Label htmlFor="edit-event-date">Date</Label>
                  <DateInput
                    id="edit-event-date"
                    value={editFormData.date}
                    onChange={(value) => setEditFormData({ ...editFormData, date: value })}
                    required
                  />
                </div>
                
                <div className="modal-form-field">
                  <Label>Heure</Label>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={editFormData.hour}
                      onValueChange={(value) => setEditFormData({ ...editFormData, hour: value })}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = i.toString().padStart(2, '0');
                          return (
                            <SelectItem key={hour} value={hour}>
                              {hour}h
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    
                    <Select
                      value={editFormData.minute}
                      onValueChange={(value) => setEditFormData({ ...editFormData, minute: value })}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 60 }, (_, i) => {
                          const minute = i.toString().padStart(2, '0');
                          return (
                            <SelectItem key={minute} value={minute}>
                              {minute}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="modal-form-field">
                  <Label htmlFor="edit-event-client">Contact <span style={{ color: 'red' }}>*</span></Label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="edit-event-client"
                        type="text"
                        placeholder="Rechercher un contact..."
                        value={editClientSearchQuery}
                        onChange={(e) => {
                          setEditClientSearchQuery(e.target.value);
                          setEditClientSearchFocused(true);
                        }}
                        onFocus={() => setEditClientSearchFocused(true)}
                        onBlur={() => setTimeout(() => setEditClientSearchFocused(false), 200)}
                        className="pl-10"
                        required
                      />
                    </div>
                    {editClientSearchFocused && editClientSearchQuery && (
                      <div className="absolute z-[99999] w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredEditContacts.length > 0 ? (
                          <div className="p-1">
                            {filteredEditContacts.map((client) => (
                              <div
                                key={client.id}
                                className="px-3 py-2 cursor-pointer hover:bg-accent rounded-sm text-sm"
                                onClick={() => {
                                  setEditFormData({ ...editFormData, clientId: client.id });
                                  setEditClientSearchQuery(`${client.fname} ${client.lname}`);
                                  setEditClientSearchFocused(false);
                                }}
                              >
                                {client.fname} {client.lname}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 text-sm text-muted-foreground text-center">
                            Aucun contact trouvé
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {editFormData.clientId && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Contact sélectionné : {getSelectedClientName(editFormData.clientId)}
                    </div>
                  )}
                  {!editFormData.clientId && (
                    <div className="mt-1 text-sm text-red-500">
                      Veuillez sélectionner un contact
                    </div>
                  )}
                </div>

                <div className="modal-form-field">
                  <Label>Utilisateur</Label>
                  <Select
                    value={editFormData.userId || ''}
                    onValueChange={(value) => setEditFormData({ ...editFormData, userId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un utilisateur" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => {
                        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                        return (
                          <SelectItem key={user.id} value={user.id}>
                            {displayName}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="modal-form-actions">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingEvent(null);
                      setEditFormData({ date: '', hour: '09', minute: '00', clientId: '', userId: currentUser?.id || '' });
                      setEditClientSearchQuery('');
                      setEditClientSearchFocused(false);
                    }}
                  >
                    Annuler
                  </Button>
                  {canEdit && (
                    <Button type="submit">
                      <Send className="w-4 h-4 mr-2" />
                      Enregistrer
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Calendar Only */}
      <div>
        <Card>
          <CardHeader>
            <div className="planning-calendar-header">
              <CardTitle>
                {getViewTitle()}
              </CardTitle>
              <div className="planning-calendar-nav">
                {/* View Toggle Buttons */}
                <div className="planning-view-toggle">
                  <Button
                    variant={view === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setView('month');
                      setSelectedDay(null);
                    }}
                  >
                    Mois
                  </Button>
                  <Button
                    variant={view === 'week' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setView('week');
                      setSelectedDay(null);
                    }}
                  >
                    Semaine
                  </Button>
                  <Button
                    variant={view === 'day' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setView('day');
                      setSelectedDay(null);
                    }}
                  >
                    Jour
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPeriod}
                >
                  ←
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                >
                  Aujourd'hui
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPeriod}
                >
                  →
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {view === 'month' && (
              <div className="planning-calendar-grid">
                {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((day) => (
                  <div key={day} className="planning-weekday">
                    {day}
                  </div>
                ))}
                
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="planning-calendar-empty"></div>
                ))}
                
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayEvents = getEventsForDay(day);
                  const isToday = new Date().getDate() === day && 
                                 new Date().getMonth() === selectedDate.getMonth() &&
                                 new Date().getFullYear() === selectedDate.getFullYear();
                  const isSelected = selectedDay === day;
                  
                  return (
                    <div
                      key={day}
                      className={`planning-calendar-day ${isToday ? 'planning-calendar-day-today' : ''} ${isSelected ? 'planning-calendar-day-selected' : ''}`}
                      onClick={() => {
                        // Toggle selection: if same day clicked, deselect; otherwise select new day
                        setSelectedDay(isSelected ? null : day);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="planning-day-number">{day}</div>
                      <div className="planning-day-events">
                        {dayEvents.slice(0, 3).map((event) => {
                          const eventDate = new Date(event.datetime);
                          const time = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
                          
                          return (
                            <div 
                              key={event.id} 
                              className="planning-event-badge"
                              onMouseEnter={(e) => handleEventMouseEnter(event, e)}
                              onMouseLeave={handleEventMouseLeave}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="planning-event-time">
                                <Clock className="planning-icon-sm" />
                                {time}
                              </div>
                              {(event.contactName || event.clientName) && (
                                <div className="planning-event-client">{event.contactName || event.clientName}</div>
                              )}
                              {event.userId && (
                                <div className="planning-event-user" style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                                  <User className="planning-icon-sm" style={{ width: '10px', height: '10px', marginRight: '2px' }} />
                                  {getUserName(event.userId)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="planning-event-badge" style={{ 
                            backgroundColor: '#e2e8f0', 
                            color: '#475569',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            +{dayEvents.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {view === 'week' && (
              <div className="planning-week-view">
                <div className="planning-week-grid">
                  {getWeekDays().map((date, index) => {
                    const dayEvents = getEventsForDate(date);
                    const isToday = date.toDateString() === new Date().toDateString();
                    const isSelected = selectedDay === date.getDate() && 
                                     selectedDate.getMonth() === date.getMonth() &&
                                     selectedDate.getFullYear() === date.getFullYear();
                    
                    return (
                      <div
                        key={index}
                        className={`planning-week-day ${isToday ? 'planning-calendar-day-today' : ''} ${isSelected ? 'planning-calendar-day-selected' : ''}`}
                        onClick={() => {
                          setSelectedDate(date);
                          setSelectedDay(date.getDate());
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="planning-week-day-header">
                          <div className="planning-week-day-name">
                            {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()]}
                          </div>
                          <div className="planning-week-day-number">{date.getDate()}</div>
                        </div>
                        <div className="planning-week-day-events">
                          {dayEvents.map((event) => {
                            const eventDate = new Date(event.datetime);
                            const time = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
                            
                            return (
                              <div 
                                key={event.id} 
                                className="planning-event-badge"
                                onMouseEnter={(e) => handleEventMouseEnter(event, e)}
                                onMouseLeave={handleEventMouseLeave}
                                style={{ cursor: 'pointer' }}
                              >
                                <div className="planning-event-time">
                                  <Clock className="planning-icon-sm" />
                                  {time}
                                </div>
                                {(event.contactName || event.clientName) && (
                                  <div className="planning-event-client">{event.contactName || event.clientName}</div>
                                )}
                                {event.userId && (
                                  <div className="planning-event-user" style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                                    <User className="planning-icon-sm" style={{ width: '10px', height: '10px', marginRight: '2px' }} />
                                    {getUserName(event.userId)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {view === 'day' && (
              <div className="planning-day-view">
                <div className="planning-day-header">
                  <div className="planning-day-date">
                    {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                  </div>
                  <div className="planning-day-weekday">
                    {['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][selectedDate.getDay()]}
                  </div>
                </div>
                <div className="planning-day-hours" ref={dayHoursRef}>
                  {getHours().map((hour) => {
                    const hourEvents = getEventsForHour(selectedDate, hour);
                    const isCurrentHour = new Date().getDate() === selectedDate.getDate() &&
                                        new Date().getMonth() === selectedDate.getMonth() &&
                                        new Date().getFullYear() === selectedDate.getFullYear() &&
                                        new Date().getHours() === hour;
                    
                    return (
                      <div
                        key={hour}
                        data-hour={hour}
                        className={`planning-day-hour ${isCurrentHour ? 'planning-day-hour-current' : ''}`}
                      >
                        <div className="planning-day-hour-label">
                          {hour.toString().padStart(2, '0')}:00
                        </div>
                        <div className="planning-day-hour-content">
                          {hourEvents.map((event) => {
                            const eventDate = new Date(event.datetime);
                            const time = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
                            
                            return (
                              <div
                                key={event.id}
                                className={`planning-day-event ${!canEdit ? 'planning-day-event-disabled' : ''}`}
                                onClick={canEdit ? () => handleEditEvent(event) : undefined}
                                onMouseEnter={(e) => handleEventMouseEnter(event, e)}
                                onMouseLeave={handleEventMouseLeave}
                                style={{ cursor: canEdit ? 'pointer' : 'default' }}
                              >
                                <div className="planning-day-event-time">{time}</div>
                                <div className="planning-day-event-client">{getEventClientName(event)}</div>
                                {event.userId && (
                                  <div className="planning-day-event-user" style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <User className="w-3 h-3" />
                                    {getUserName(event.userId)}
                                  </div>
                                )}
                                {event.comment && (
                                  <div className="planning-day-event-comment">{event.comment}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Hover Modal */}
      {hoveredEvent && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          onMouseEnter={() => setHoveredEvent(hoveredEvent)}
          onMouseLeave={handleEventMouseLeave}
        >
          <div
            className="modal-content"
            style={{
              position: 'fixed',
              left: `${hoverPosition.x + 10}px`,
              top: `${hoverPosition.y + 10}px`,
              maxWidth: '400px',
              pointerEvents: 'auto',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              padding: '12px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ paddingBottom: '8px', padding: 0 }}>
              <h3 className="modal-title" style={{ fontSize: '16px', margin: 0 }}>Détails du rendez-vous</h3>
            </div>
            <div style={{ padding: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Date et heure</div>
                  <div style={{ fontSize: '14px', color: '#1e293b' }}>
                    {new Date(hoveredEvent.datetime).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                    {' à '}
                    {new Date(hoveredEvent.datetime).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Contact</div>
                  <div style={{ fontSize: '14px', color: '#1e293b' }}>
                    {getEventClientName(hoveredEvent)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Utilisateur</div>
                  <div style={{ fontSize: '14px', color: '#1e293b' }}>
                    {getUserName(hoveredEvent.userId)}
                  </div>
                </div>

                {hoveredEvent.comment && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Commentaire</div>
                    <div style={{ fontSize: '14px', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                      {hoveredEvent.comment}
                    </div>
                  </div>
                )}

                {hoveredEvent.created_at && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Créé le</div>
                    <div style={{ fontSize: '14px', color: '#1e293b' }}>
                      {new Date(hoveredEvent.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default PlanningAdministrateur;

