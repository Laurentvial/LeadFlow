import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DateInput } from './ui/date-input';
import { Calendar as CalendarIcon, Plus, Clock, User, Pencil, Trash2, X, Send, Search } from 'lucide-react';
import { apiCall } from '../utils/api';
import { handleModalOverlayClick } from '../utils/modal';
import { useUser } from '../contexts/UserContext';
import { useUsers } from '../hooks/useUsers';
import { useHasPermission } from '../hooks/usePermissions';
import { AppointmentCard } from './AppointmentCard';
import '../styles/PlanningCalendar.css';
import '../styles/Modal.css';
import '../styles/PageHeader.css';
import { toast } from 'sonner';

export function PlanningCalendar() {
  const { currentUser } = useUser();
  const { users } = useUsers();
  
  // Permission checks
  const canCreate = useHasPermission('planning', 'create');
  const canEdit = useHasPermission('planning', 'edit');
  const canDelete = useHasPermission('planning', 'delete');
  
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [pastEvents, setPastEvents] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]); // Cache of searched/selected contacts
  const [contactNotes, setContactNotes] = useState<Record<string, any[]>>({});
  const [notesLoading, setNotesLoading] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null); // Selected day for filtering
  const [view, setView] = useState<'month' | 'week' | 'day'>('day'); // Calendar view mode
  const dayHoursRef = useRef<HTMLDivElement>(null); // Ref for day hours container
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [editClientSearchQuery, setEditClientSearchQuery] = useState('');
  const [editClientSearchFocused, setEditClientSearchFocused] = useState(false);
  const [editClientSearchLoading, setEditClientSearchLoading] = useState(false);
  const [editClientSearchResults, setEditClientSearchResults] = useState<any[]>([]);
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

  // Load notes and fetch missing contacts for all contacts in events when events change
  useEffect(() => {
    const allEvents = [...upcomingEvents, ...pastEvents];
    const contactIds = new Set<string>();
    const missingContactIds = new Set<string>();
    
    allEvents.forEach(event => {
      const contactId = event.clientId_read || event.contactId;
      if (contactId) {
        contactIds.add(contactId);
        // Check if contact is missing from cache
        const contactInCache = contacts.find(c => c.id === contactId);
        if (!contactInCache && !notesLoading[contactId]) {
          missingContactIds.add(contactId);
        }
        // Load notes if not already loaded
        if (!contactNotes[contactId] && !notesLoading[contactId]) {
          loadContactNotes(contactId);
        }
      }
    });

    // Fetch missing contacts from API
    const fetchMissingContacts = async () => {
      for (const contactId of missingContactIds) {
        try {
          const contactData = await apiCall(`/api/contacts/${contactId}/`);
          if (contactData) {
            setContacts(prev => {
              const exists = prev.find(c => c.id === contactId);
              if (!exists) {
                return [...prev, contactData];
              }
              return prev;
            });
          }
        } catch (error) {
          console.error(`Error fetching contact ${contactId}:`, error);
          // Continue with other contacts
        }
      }
    };

    if (missingContactIds.size > 0) {
      fetchMissingContacts();
    }
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
      // NOTE: Contacts are no longer loaded here - they are loaded on-demand when searching
      const [upcomingEventsData, pastEventsData] = await Promise.all([
        apiCall(`/api/events/?future_only=true&page=${upcomingPage}&page_size=100`), // Load upcoming events with pagination (large page size)
        apiCall(`/api/events/?past_only=true&page=${pastPage}&page_size=10`), // Load past events with pagination
      ]);
      
      // Extract events from response - handle both paginated and non-paginated formats
      const upcomingEvents = Array.isArray(upcomingEventsData) 
        ? upcomingEventsData 
        : (upcomingEventsData?.events || []);
      const pastEvents = Array.isArray(pastEventsData) 
        ? pastEventsData 
        : (pastEventsData?.events || []);
      
      const now = new Date();
      const upcomingArray = upcomingEvents.filter((event: any) => {
        if (!event.datetime) return false;
        return new Date(event.datetime) > now;
      });
      const pastArray = pastEvents.filter((event: any) => {
        if (!event.datetime) return false;
        return new Date(event.datetime) <= now;
      });
      
      if (upcomingPage === 1 && pastPage === 1) {
        setUpcomingEvents(upcomingArray);
        setPastEvents(pastArray);
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
    } catch (error: any) {
      console.error('Error loading planning data:', error);
      console.error('Error details:', error.message, error.status, error.response);
      toast.error(`Erreur lors du chargement des événements: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
      setLoadingMoreUpcomingEvents(false);
      setLoadingMorePastEvents(false);
    }
  }

  // Search contacts on-demand when user types
  async function searchContacts(query: string, isEdit: boolean = false) {
    if (!query || query.trim().length < 2) {
      if (isEdit) {
        setEditClientSearchResults([]);
      } else {
        setClientSearchResults([]);
      }
      return;
    }

    if (isEdit) {
      setEditClientSearchLoading(true);
    } else {
      setClientSearchLoading(true);
    }

    try {
      const response = await apiCall(`/api/contacts/?search=${encodeURIComponent(query.trim())}&page_size=50`);
      const searchResults = response?.contacts || response || [];
      
      if (isEdit) {
        setEditClientSearchResults(searchResults);
        // Add to contacts cache
        setContacts(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newContacts = searchResults.filter((c: any) => !existingIds.has(c.id));
          return [...prev, ...newContacts];
        });
      } else {
        setClientSearchResults(searchResults);
        // Add to contacts cache
        setContacts(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newContacts = searchResults.filter((c: any) => !existingIds.has(c.id));
          return [...prev, ...newContacts];
        });
      }
    } catch (error: any) {
      console.error('Error searching contacts:', error);
      toast.error(`Erreur lors de la recherche de contacts: ${error.message || 'Erreur inconnue'}`);
      if (isEdit) {
        setEditClientSearchResults([]);
      } else {
        setClientSearchResults([]);
      }
    } finally {
      if (isEdit) {
        setEditClientSearchLoading(false);
      } else {
        setClientSearchLoading(false);
      }
    }
  }

  // Debounced search function
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (clientSearchQuery && clientSearchFocused) {
      searchTimeoutRef.current = setTimeout(() => {
        searchContacts(clientSearchQuery, false);
      }, 300); // Debounce by 300ms
    } else {
      setClientSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [clientSearchQuery, clientSearchFocused]);

  useEffect(() => {
    if (editSearchTimeoutRef.current) {
      clearTimeout(editSearchTimeoutRef.current);
    }
    
    if (editClientSearchQuery && editClientSearchFocused) {
      editSearchTimeoutRef.current = setTimeout(() => {
        searchContacts(editClientSearchQuery, true);
      }, 300); // Debounce by 300ms
    } else {
      setEditClientSearchResults([]);
    }

    return () => {
      if (editSearchTimeoutRef.current) {
        clearTimeout(editSearchTimeoutRef.current);
      }
    };
  }, [editClientSearchQuery, editClientSearchFocused]);

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
          userId: currentUser?.id || null,
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

  async function handleEditEvent(event: any) {
    if (!canEdit) return;
    const eventDate = new Date(event.datetime);
    const dateStr = eventDate.toISOString().split('T')[0];
    const hour = eventDate.getHours().toString().padStart(2, '0');
    const minute = eventDate.getMinutes().toString().padStart(2, '0');
    
    setEditingEvent(event);
    const selectedClientId = event.clientId_read || event.contactId || '';
    let selectedClient = contacts.find(c => c.id === selectedClientId);
    
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
      
      // If contact is not in cache, try to fetch it by ID
      if (!selectedClient && selectedClientId) {
        try {
          const contactData = await apiCall(`/api/contacts/${selectedClientId}/`);
          if (contactData) {
            setContacts(prev => {
              const exists = prev.find(c => c.id === selectedClientId);
              if (!exists) {
                return [...prev, contactData];
              }
              return prev;
            });
            selectedClient = contactData;
            contactName = `${contactData.fname} ${contactData.lname}`.trim();
          }
        } catch (error) {
          console.error('Error fetching contact for edit:', error);
          // Continue with existing contactName from event
        }
      }
    }
    
    // Get the assigned user ID from the event (prioritize userId_read, then userId, then fallback)
    // Convert to string to ensure it matches Select component value type
    const assignedUserId = event.userId_read || event.userId;
    const userIdString = assignedUserId ? String(assignedUserId) : '';
    
    setEditFormData({
      date: dateStr,
      hour: hour,
      minute: minute,
      clientId: selectedClientId,
      userId: userIdString
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

  // Use search results for create modal (contacts are loaded on-demand via search)
  const filteredContacts = clientSearchResults;

  // Use search results for edit modal (contacts are loaded on-demand via search)
  const filteredEditContacts = editClientSearchResults;

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
        const name = `${client.fname || ''} ${client.lname || ''}`.trim();
        if (name) {
          return name;
        }
      }
      // If contact not in cache yet, return empty string (will be fetched by useEffect)
      // This prevents showing "Sans nom" while contact is being loaded
      return '';
    }
    return '';
  };

  // Get user name from userId
  const getUserName = (userId: string | number | null | undefined) => {
    if (!userId) return 'Non assigné';
    // Convert to string for comparison (user IDs might be strings or numbers)
    const userIdStr = String(userId);
    const user = users.find(u => String(u.id) === userIdStr);
    if (user) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
    }
    console.warn('User not found for userId:', userId, 'Available users:', users.map(u => u.id));
    return 'Utilisateur inconnu';
  };

  // Get user color from userId
  const getUserColor = (userId: string | number | null | undefined): string => {
    if (!userId) return '#3b82f6'; // Default blue if no user
    // Convert to string for comparison (user IDs might be strings or numbers)
    const userIdStr = String(userId);
    const user = users.find(u => String(u.id) === userIdStr);
    if (user && user.hrex) {
      return user.hrex;
    }
    return '#3b82f6'; // Default blue if user has no color
  };

  // Get light version of color for background (with opacity)
  const getLightColor = (color: string): string => {
    // Convert hex to rgba with opacity
    let hex = color.replace('#', '');
    // Handle short hex colors (e.g., #FFF -> #FFFFFF)
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.2)`;
  };

  // Get darker version of color for hover
  const getDarkerColor = (color: string): string => {
    // Convert hex to rgba with higher opacity for hover
    let hex = color.replace('#', '');
    // Handle short hex colors (e.g., #FFF -> #FFFFFF)
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.3)`;
  };

  // Get user role style based on isTeleoperateur and isConfirmateur
  const getUserRoleStyle = (userId: string | number | null | undefined): { borderStyle: string; borderWidth: string } => {
    if (!userId) {
      return { borderStyle: 'solid', borderWidth: '3px' }; // Default style
    }
    // Convert to string for comparison (user IDs might be strings or numbers)
    const userIdStr = String(userId);
    const user = users.find(u => String(u.id) === userIdStr);
    if (user) {
      const isTeleoperateur = user.isTeleoperateur === true;
      const isConfirmateur = user.isConfirmateur === true;
      
      // If teleoperateur only (true, false)
      if (isTeleoperateur && !isConfirmateur) {
        return { borderStyle: 'dashed', borderWidth: '3px' };
      }
      // If confirmateur only (false, true)
      if (!isTeleoperateur && isConfirmateur) {
        return { borderStyle: 'double', borderWidth: '4px' };
      }
    }
    // Default style for other cases
    return { borderStyle: 'solid', borderWidth: '3px' };
  };
  
  // Get userId from event (handles both userId and userId_read fields)
  const getEventUserId = (event: any): string | null => {
    if (!event) return null;
    // Try userId_read first (from serializer), then userId
    const userId = event.userId_read || event.userId;
    return userId ? String(userId) : null;
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

  return (
    <div className="planning-container">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Planning</h1>
          <p className="page-subtitle">Gestion des rendez-vous</p>
        </div>
        
        {canCreate && (
          <Button type="button" onClick={() => setIsModalOpen(true)}>
            <Plus className="planning-icon planning-icon-with-margin" />
            Ajouter un rendez-vous
          </Button>
        )}
        
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
                        value={clientSearchQuery}
                        onChange={(e) => {
                          setClientSearchQuery(e.target.value);
                          setClientSearchFocused(true);
                        }}
                        onFocus={() => setClientSearchFocused(true)}
                        onBlur={() => setTimeout(() => setClientSearchFocused(false), 200)}
                        className="pl-10"
                        autoComplete="off"
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
                                  // Ensure contact is in cache
                                  setContacts(prev => {
                                    const exists = prev.find(c => c.id === client.id);
                                    if (!exists) {
                                      return [...prev, client];
                                    }
                                    return prev;
                                  });
                                }}
                              >
                                {client.fname} {client.lname}
                                {client.email && <span className="text-muted-foreground ml-2">({client.email})</span>}
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

        {isEditModalOpen && editingEvent && (
          <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => {
            setIsEditModalOpen(false);
            setEditingEvent(null);
            setEditFormData({ date: '', hour: '09', minute: '00', clientId: '', userId: currentUser?.id || '' });
            setEditClientSearchQuery('');
            setEditClientSearchFocused(false);
          })}>
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
                                  // Ensure contact is in cache
                                  setContacts(prev => {
                                    const exists = prev.find(c => c.id === client.id);
                                    if (!exists) {
                                      return [...prev, client];
                                    }
                                    return prev;
                                  });
                                }}
                              >
                                {client.fname} {client.lname}
                                {client.email && <span className="text-muted-foreground ml-2">({client.email})</span>}
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

      {/* Calendar and Events List Side by Side */}
      <div className="planning-content-grid">
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
                          const eventUserId = getEventUserId(event);
                          const userColor = getUserColor(eventUserId);
                          const lightColor = getLightColor(userColor);
                          const roleStyle = getUserRoleStyle(eventUserId);
                          
                          return (
                            <div 
                              key={event.id} 
                              className="planning-event-badge"
                              style={{ 
                                backgroundColor: lightColor,
                                color: userColor,
                                borderLeft: `${roleStyle.borderWidth} ${roleStyle.borderStyle} ${userColor}`,
                                paddingLeft: '0.5rem'
                              }}
                            >
                              <div className="planning-event-time">
                                <Clock className="planning-icon-sm" />
                                {time}
                              </div>
                              {(event.contactName || event.clientName) && (
                                <div 
                                  className="planning-event-client"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const contactId = event.clientId_read || event.contactId;
                                    if (contactId) {
                                      window.open(`/contacts/${contactId}`, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
                                    }
                                  }}
                                  style={{ cursor: (event.clientId_read || event.contactId) ? 'pointer' : 'default' }}
                                  title={(event.clientId_read || event.contactId) ? 'Cliquer pour ouvrir les détails du contact' : undefined}
                                >
                                  {event.contactName || event.clientName}
                                </div>
                              )}
                              {eventUserId && (
                                <div className="planning-event-user" style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <User className="planning-icon-sm" style={{ width: '10px', height: '10px', flexShrink: 0 }} />
                                  <span>{getUserName(eventUserId)}</span>
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
                            const eventUserId = getEventUserId(event);
                            const userColor = getUserColor(eventUserId);
                            const lightColor = getLightColor(userColor);
                            const roleStyle = getUserRoleStyle(eventUserId);
                            
                            return (
                              <div 
                                key={event.id} 
                                className="planning-event-badge"
                                style={{ 
                                  backgroundColor: lightColor,
                                  color: userColor,
                                  borderLeft: `${roleStyle.borderWidth} ${roleStyle.borderStyle} ${userColor}`,
                                  paddingLeft: '0.5rem'
                                }}
                              >
                                <div className="planning-event-time">
                                  <Clock className="planning-icon-sm" />
                                  {time}
                                </div>
                                {(event.contactName || event.clientName) && (
                                  <div 
                                    className="planning-event-client"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const contactId = event.clientId_read || event.contactId;
                                      if (contactId) {
                                        window.open(`/contacts/${contactId}`, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
                                      }
                                    }}
                                    style={{ cursor: (event.clientId_read || event.contactId) ? 'pointer' : 'default' }}
                                    title={(event.clientId_read || event.contactId) ? 'Cliquer pour ouvrir les détails du contact' : undefined}
                                  >
                                    {event.contactName || event.clientName}
                                  </div>
                                )}
                                {eventUserId && (
                                  <div className="planning-event-user" style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    <User className="planning-icon-sm" style={{ width: '10px', height: '10px', flexShrink: 0 }} />
                                    <span>{getUserName(eventUserId)}</span>
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
                            const eventUserId = getEventUserId(event);
                            const userColor = getUserColor(eventUserId);
                            const lightColor = getLightColor(userColor);
                            const roleStyle = getUserRoleStyle(eventUserId);
                            
                            return (
                              <div
                                key={event.id}
                                className={`planning-day-event ${!canEdit ? 'planning-day-event-disabled' : ''}`}
                                onClick={canEdit ? () => handleEditEvent(event) : undefined}
                                style={{ 
                                  cursor: canEdit ? 'pointer' : 'default',
                                  backgroundColor: lightColor,
                                  borderLeft: `${roleStyle.borderWidth} ${roleStyle.borderStyle} ${userColor}`
                                }}
                              >
                                <div className="planning-day-event-time" style={{ color: userColor }}>{time}</div>
                                {(() => {
                                  const contactName = getEventClientName(event);
                                  const hasContactName = contactName && contactName.trim() !== '';
                                  
                                  return (
                                    <>
                                      {hasContactName && (
                                        <div 
                                          className="planning-day-event-client"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const contactId = event.clientId_read || event.contactId;
                                            if (contactId) {
                                              window.open(`/contacts/${contactId}`, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
                                            }
                                          }}
                                          style={{ cursor: (event.clientId_read || event.contactId) ? 'pointer' : 'default' }}
                                          title={(event.clientId_read || event.contactId) ? 'Cliquer pour ouvrir les détails du contact' : undefined}
                                        >
                                          {contactName}
                                        </div>
                                      )}
                                      {eventUserId ? (
                                        <div className="planning-day-event-user" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: hasContactName ? '6px' : '0', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 400 }}>
                                          <User className="w-3 h-3" style={{ flexShrink: 0 }} />
                                          <span>{getUserName(eventUserId)}</span>
                                        </div>
                                      ) : (
                                        <div className="planning-day-event-user" style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: hasContactName ? '6px' : '0', fontStyle: 'italic' }}>
                                          Non assigné
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
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

        {/* Events List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Liste des rendez-vous
                {(selectedDay !== null || view === 'day') && (
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    ({view === 'day' ? selectedDate.getDate() : selectedDay}/{selectedDate.getMonth() + 1}/{selectedDate.getFullYear()})
                  </span>
                )}
                {view === 'week' && selectedDay === null && (
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    (Semaine)
                  </span>
                )}
              </CardTitle>
              {(selectedDay !== null || view === 'day') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDay(null);
                    if (view === 'day') {
                      setView('month');
                    }
                  }}
                >
                  Afficher tout
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
                <p style={{ color: '#64748b', fontSize: '14px' }}>
                  Chargement...
                </p>
              </div>
            ) : (() => {
              // Filter events by selected day if a day is selected or in day view
              // Also ensure upcoming events are truly in the future and past events are truly in the past
              const now = new Date();
              let filteredUpcomingEvents = upcomingEvents.filter(event => {
                if (!event.datetime) return false;
                return new Date(event.datetime) > now;
              });
              let filteredPastEvents = pastEvents.filter(event => {
                if (!event.datetime) return false;
                return new Date(event.datetime) <= now;
              });
              
              // Filter by day if selected or in day view
              if (selectedDay !== null || view === 'day') {
                const dayToFilter = view === 'day' ? selectedDate.getDate() : selectedDay;
                const dateToFilter = view === 'day' ? selectedDate : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDay!);
                const selectedDateStr = `${dateToFilter.getFullYear()}-${String(dateToFilter.getMonth() + 1).padStart(2, '0')}-${String(dayToFilter).padStart(2, '0')}`;
                filteredUpcomingEvents = filteredUpcomingEvents.filter(event => {
                  if (!event.datetime) return false;
                  const eventDate = new Date(event.datetime).toISOString().split('T')[0];
                  return eventDate === selectedDateStr;
                });
                filteredPastEvents = filteredPastEvents.filter(event => {
                  if (!event.datetime) return false;
                  const eventDate = new Date(event.datetime).toISOString().split('T')[0];
                  return eventDate === selectedDateStr;
                });
              } else if (view === 'week') {
                // Filter events for the current week
                const weekDays = getWeekDays();
                const weekStartStr = weekDays[0].toISOString().split('T')[0];
                const weekEndStr = weekDays[6].toISOString().split('T')[0];
                filteredUpcomingEvents = filteredUpcomingEvents.filter(event => {
                  if (!event.datetime) return false;
                  const eventDate = new Date(event.datetime).toISOString().split('T')[0];
                  return eventDate >= weekStartStr && eventDate <= weekEndStr;
                });
                filteredPastEvents = filteredPastEvents.filter(event => {
                  if (!event.datetime) return false;
                  const eventDate = new Date(event.datetime).toISOString().split('T')[0];
                  return eventDate >= weekStartStr && eventDate <= weekEndStr;
                });
              }

              const hasUpcomingEvents = filteredUpcomingEvents.length > 0;
              const hasPastEvents = filteredPastEvents.length > 0;
              const hasAnyEvents = hasUpcomingEvents || hasPastEvents;

              return hasAnyEvents ? (
                <div className="space-y-6">
                  {/* Upcoming Events Section */}
                  {hasUpcomingEvents && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-slate-700">Prochains evenements</h3>
                      <div className="space-y-3">
                        {filteredUpcomingEvents
                          .sort((a, b) => {
                            const dateA = new Date(a.datetime).getTime();
                            const dateB = new Date(b.datetime).getTime();
                            return dateA - dateB; // Sort ascending (earliest first)
                          })
                          .map((event) => {
                            const contactId = event.clientId_read || event.contactId;
                            const notes = contactId ? (contactNotes[contactId] || []) : [];
                            const cardProps: any = {
                              appointment: event,
                              variant: 'planning' as const,
                              showActions: canEdit || canDelete,
                              notes: notes,
                            };
                            if (canEdit) cardProps.onEdit = handleEditEvent;
                            if (canDelete) cardProps.onDelete = handleDeleteEvent;
                            return (
                              <AppointmentCard
                                key={event.id}
                                {...cardProps}
                              />
                            );
                          })}
                      </div>
                      {(selectedDay === null && view !== 'day') && upcomingEventsHasMore && (
                        <div className="flex justify-center pt-4">
                          <Button
                            onClick={handleLoadMoreUpcoming}
                            disabled={loadingMoreUpcomingEvents}
                            variant="outline"
                            className="w-full"
                          >
                            {loadingMoreUpcomingEvents ? 'Chargement...' : 'Charger plus d\'événements'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Past Events Section */}
                  {hasPastEvents && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-slate-700">Anciens evenements</h3>
                      <div className="space-y-3">
                        {filteredPastEvents
                          .sort((a, b) => {
                            const dateA = new Date(a.datetime).getTime();
                            const dateB = new Date(b.datetime).getTime();
                            return dateB - dateA; // Sort descending (most recent first)
                          })
                          .map((event) => {
                            const contactId = event.clientId_read || event.contactId;
                            const notes = contactId ? (contactNotes[contactId] || []) : [];
                            const cardProps: any = {
                              appointment: event,
                              variant: 'planning' as const,
                              showActions: false, // No edit/delete for past events
                              notes: notes,
                            };
                            return (
                              <AppointmentCard
                                key={event.id}
                                {...cardProps}
                              />
                            );
                          })}
                      </div>
                      {(selectedDay === null && view !== 'day') && pastEventsHasMore && (
                        <div className="flex justify-center pt-4">
                          <Button
                            onClick={handleLoadMorePast}
                            disabled={loadingMorePastEvents}
                            variant="outline"
                            className="w-full"
                          >
                            {loadingMorePastEvents ? 'Chargement...' : 'Charger plus d\'anciens événements'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="planning-empty-message">
                  {selectedDay !== null ? 'Aucun rendez-vous pour cette date' : 'Aucun rendez-vous'}
                </p>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
export default PlanningCalendar;