import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DateInput } from './ui/date-input';
import { Calendar as CalendarIcon, Plus, Clock, User, Pencil, Trash2, X, Send, Search, BarChart3, Filter } from 'lucide-react';
import { apiCall } from '../utils/api';
import { useUser } from '../contexts/UserContext';
import { useUsers } from '../hooks/useUsers';
import { useHasPermission } from '../hooks/usePermissions';
import { AppointmentCard } from './AppointmentCard';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
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
  const [contacts, setContacts] = useState<any[]>([]); // Cache of searched/selected contacts
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
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [editClientSearchQuery, setEditClientSearchQuery] = useState('');
  const [editClientSearchFocused, setEditClientSearchFocused] = useState(false);
  const [editClientSearchLoading, setEditClientSearchLoading] = useState(false);
  const [editClientSearchResults, setEditClientSearchResults] = useState<any[]>([]);
  const [hoveredEvent, setHoveredEvent] = useState<any>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  
  // Filter sidebar state
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(true);
  const [filterUserId, setFilterUserId] = useState<string>('');
  const [filterContactId, setFilterContactId] = useState<string>('');
  const [filterContactSearchQuery, setFilterContactSearchQuery] = useState('');
  const [filterContactSearchFocused, setFilterContactSearchFocused] = useState(false);
  const [filterContactSearchResults, setFilterContactSearchResults] = useState<any[]>([]);

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

  // Reload events when selectedDate or view changes to load events for the current period
  useEffect(() => {
    loadData();
  }, [selectedDate, view]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
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
      // Always load all events for the current month (regardless of view)
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59);
      
      // Load all events for the current period without pagination limits
      // Use all_events=true to bypass permission filtering (admin-only page)
      // Load events in the date range for the current view
      const allEvents: any[] = [];
      let page = 1;
      let hasMore = true;
      
      // Load all events for the period by paginating through all pages
      while (hasMore) {
        const response = await apiCall(`/api/events/?all_events=true&page=${page}&page_size=2000`);
        const events = response?.events || response || [];
        
        // Filter events to the current period
        const filteredEvents = events.filter((event: any) => {
          if (!event.datetime) return false;
          const eventDate = new Date(event.datetime);
          return eventDate >= startDate && eventDate <= endDate;
        });
        
        allEvents.push(...filteredEvents);
        
        hasMore = response?.has_next || false;
        if (events.length < 2000) hasMore = false;
        page++;
        
        // Safety limit to prevent infinite loops
        if (page > 100) break;
      }
      
      // Separate into upcoming and past events
      const now = new Date();
      const upcomingArray = allEvents.filter((event: any) => {
        if (!event.datetime) return false;
        return new Date(event.datetime) > now;
      });
      const pastArray = allEvents.filter((event: any) => {
        if (!event.datetime) return false;
        return new Date(event.datetime) <= now;
      });
      
      console.log('Filtered upcoming events:', upcomingArray.length);
      console.log('Filtered past events:', pastArray.length);
      
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
      
      // Update pagination state - we're loading all events, so no more pages
      setUpcomingEventsHasMore(false);
      setUpcomingEventsPage(1);
      setPastEventsHasMore(false);
      setPastEventsPage(1);
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
  async function searchContacts(query: string, isEdit: boolean = false, isFilter: boolean = false) {
    if (!query || query.trim().length < 2) {
      if (isEdit) {
        setEditClientSearchResults([]);
      } else if (isFilter) {
        setFilterContactSearchResults([]);
      } else {
        setClientSearchResults([]);
      }
      return;
    }

    if (isEdit) {
      setEditClientSearchLoading(true);
    } else if (isFilter) {
      // No loading state for filter, but we can add one if needed
    } else {
      setClientSearchLoading(true);
    }

    try {
      const response = await apiCall(`/api/contacts/?all_contacts=true&search=${encodeURIComponent(query.trim())}&page_size=50`);
      const searchResults = response?.contacts || response || [];
      
      if (isEdit) {
        setEditClientSearchResults(searchResults);
        // Add to contacts cache
        setContacts(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newContacts = searchResults.filter((c: any) => !existingIds.has(c.id));
          return [...prev, ...newContacts];
        });
      } else if (isFilter) {
        setFilterContactSearchResults(searchResults);
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
      } else if (isFilter) {
        setFilterContactSearchResults([]);
      } else {
        setClientSearchResults([]);
      }
    } finally {
      if (isEdit) {
        setEditClientSearchLoading(false);
      } else if (!isFilter) {
        setClientSearchLoading(false);
      }
    }
  }

  // Debounced search function
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterContactSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Filter contact search debounce
  useEffect(() => {
    if (filterContactSearchTimeoutRef.current) {
      clearTimeout(filterContactSearchTimeoutRef.current);
    }
    
    if (filterContactSearchQuery && filterContactSearchFocused) {
      filterContactSearchTimeoutRef.current = setTimeout(() => {
        searchContacts(filterContactSearchQuery, false, true);
      }, 300);
    } else {
      setFilterContactSearchResults([]);
    }

    return () => {
      if (filterContactSearchTimeoutRef.current) {
        clearTimeout(filterContactSearchTimeoutRef.current);
      }
    };
  }, [filterContactSearchQuery, filterContactSearchFocused]);

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

  async function handleEditEvent(event: any) {
    if (!canEdit) return;
    
    // Clear hover modal when clicking to edit
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredEvent(null);
    
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

  // Handle event hover
  const handleEventMouseEnter = (event: any, e: React.MouseEvent) => {
    // Don't show hover if a click just happened (within 200ms)
    if (clickTimeoutRef.current) {
      return;
    }
    
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

  // Apply filters to events
  function applyFilters(events: any[]): any[] {
    return events.filter(event => {
      // Filter by user
      if (filterUserId) {
        const eventUserId = getEventUserId(event);
        if (String(eventUserId) !== String(filterUserId)) {
          return false;
        }
      }
      
      // Filter by contact
      if (filterContactId) {
        const eventContactId = event.clientId_read || event.contactId;
        if (String(eventContactId) !== String(filterContactId)) {
          return false;
        }
      }
      
      return true;
    });
  }

  function getEventsForDay(day: number) {
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const allEvents = [...upcomingEvents, ...pastEvents];
    let filtered = allEvents.filter(event => {
      if (!event.datetime) return false;
      const eventDate = new Date(event.datetime).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
    return applyFilters(filtered);
  }

  // Get events for a specific date
  function getEventsForDate(date: Date) {
    const dateStr = date.toISOString().split('T')[0];
    const allEvents = [...upcomingEvents, ...pastEvents];
    let filtered = allEvents.filter(event => {
      if (!event.datetime) return false;
      const eventDate = new Date(event.datetime).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
    return applyFilters(filtered);
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
      return `${['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][selectedDate.getDay()]} ${selectedDate.getDate()} ${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
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
        const eventUserId = getEventUserId(event);
        if (eventUserId) {
          userIds.add(eventUserId);
        } else {
          eventsWithoutUserId.push(event);
        }
      });
      
      console.log('Unique user IDs found:', Array.from(userIds));
      console.log('Users array length:', users.length);
      console.log('User names mapping:', Array.from(userIds).map(id => ({ id, name: getUserName(id) })));
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
          const userName = getUserName(userId);
          dayData[userName] = 0;
        });
        
        // Count events for this day
        const dayEvents = allEvents.filter(event => {
          if (!event.datetime) return false;
          const eventDate = new Date(event.datetime);
          return eventDate.getDate() === day && eventDate.getMonth() === currentMonth;
        });
        
        dayEvents.forEach(event => {
          const eventUserId = getEventUserId(event);
          if (eventUserId) {
            const userName = getUserName(eventUserId);
            if (dayData[userName] !== undefined) {
              dayData[userName] = (dayData[userName] || 0) + 1;
            } else {
              console.warn('User name not found in dayData:', userName, 'Available keys:', Object.keys(dayData));
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
      <div className="planning-with-sidebar">
        {/* Filter Sidebar */}
        <div className={`planning-filter-sidebar ${isFilterSidebarOpen ? 'open' : 'collapsed'}`}>
          <div className="planning-filter-sidebar-header">
            <div className="planning-filter-sidebar-title">
              {isFilterSidebarOpen && <span>Filtres</span>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFilterSidebarOpen(!isFilterSidebarOpen)}
              className="planning-filter-toggle"
            >
              <Filter className="planning-icon-sm" />
            </Button>
          </div>
          
          {isFilterSidebarOpen && (
            <div className="planning-filter-content">
              <div className="planning-filter-section">
                <Label>Utilisateur</Label>
                <Select
                  value={filterUserId || 'all'}
                  onValueChange={(value) => setFilterUserId(value === 'all' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les utilisateurs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les utilisateurs</SelectItem>
                    {users.map((user) => {
                      const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                      return (
                        <SelectItem key={user.id} value={String(user.id)}>
                          {displayName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="planning-filter-section">
                <Label>Contact</Label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      value={filterContactSearchQuery}
                      onChange={(e) => {
                        setFilterContactSearchQuery(e.target.value);
                        setFilterContactSearchFocused(true);
                      }}
                      onFocus={() => setFilterContactSearchFocused(true)}
                      onBlur={() => setTimeout(() => setFilterContactSearchFocused(false), 200)}
                      className="pl-10"
                      placeholder="Rechercher un contact"
                      autoComplete="off"
                    />
                  </div>
                  {filterContactSearchFocused && filterContactSearchQuery && (
                    <div className="absolute z-[99999] w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filterContactSearchResults.length > 0 ? (
                        <div className="p-1">
                          {filterContactSearchResults.map((client) => (
                            <div
                              key={client.id}
                              className="px-3 py-2 cursor-pointer hover:bg-accent rounded-sm text-sm"
                              onClick={() => {
                                setFilterContactId(client.id);
                                setFilterContactSearchQuery(`${client.fname} ${client.lname}`);
                                setFilterContactSearchFocused(false);
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
                      ) : filterContactSearchQuery.length >= 2 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          Aucun contact trouvé
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
                {filterContactId && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {contacts.find(c => c.id === filterContactId) 
                        ? `${contacts.find(c => c.id === filterContactId)!.fname} ${contacts.find(c => c.id === filterContactId)!.lname}`
                        : 'Contact sélectionné'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFilterContactId('');
                        setFilterContactSearchQuery('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="planning-filter-section">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilterUserId('');
                    setFilterContactId('');
                    setFilterContactSearchQuery('');
                  }}
                  className="w-full"
                >
                  Réinitialiser les filtres
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="planning-main-content">
          <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Planning Administrateur</h1>
          <p className="page-subtitle">Gestion des rendez-vous administrateur</p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {canCreate && (
            <>
              <Button type="button" variant="outline" onClick={() => setIsGraphModalOpen(true)}>
                <BarChart3 className="planning-icon planning-icon-with-margin" />
                Statistiques
              </Button>
              <Button type="button" onClick={() => setIsModalOpen(true)}>
                <Plus className="planning-icon planning-icon-with-margin" />
                Ajouter un rendez-vous
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
                        ) : clientSearchQuery.length >= 2 ? (
                          <div className="p-3 text-sm text-muted-foreground text-center">
                            Aucun contact trouvé
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
              <div style={{ padding: '0px', minHeight: '400px' }}>
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
                  
                  // Map user names to their colors from database
                  const userNameToColorMap = new Map<string, string>();
                  Array.from(userNames).forEach((userName) => {
                    // Find the userId for this userName by looking up in users array
                    const user = users.find(u => {
                      const userDisplayName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || u.email || `Utilisateur ${u.id}`;
                      return userDisplayName === userName;
                    });
                    
                    if (user) {
                      const userColor = getUserColor(user.id);
                      userNameToColorMap.set(userName, userColor);
                      config[userName] = {
                        label: userName,
                        color: userColor
                      };
                    } else {
                      // Fallback color if user not found
                      const fallbackColor = '#3b82f6';
                      userNameToColorMap.set(userName, fallbackColor);
                      config[userName] = {
                        label: userName,
                        color: fallbackColor
                      };
                    }
                  });
                  
                  console.log('Rendering chart with data:', graphData.slice(0, 3), '...');
                  console.log('User names:', Array.from(userNames));
                  console.log('User colors mapping:', Array.from(userNameToColorMap.entries()));
                  
                  return (
                    <div style={{ width: '100%', height: '500px', minHeight: '500px' }}>
                      <ChartContainer
                        config={config}
                        className="w-full"
                        style={{ height: '550px', minHeight: '500px', aspectRatio: 'auto' }}
                      >
                      <LineChart data={graphData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
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
                        {Array.from(userNames).map((userName) => {
                          const userColor = userNameToColorMap.get(userName) || '#3b82f6';
                          return (
                            <Line 
                              key={userName}
                              type="monotone"
                              dataKey={userName} 
                              stroke={userColor}
                              strokeWidth={2}
                              name={userName}
                              dot={{ r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          );
                        })}
                      </LineChart>
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
                        value={editClientSearchQuery}
                        onChange={(e) => {
                          setEditClientSearchQuery(e.target.value);
                          setEditClientSearchFocused(true);
                        }}
                        onFocus={() => setEditClientSearchFocused(true)}
                        onBlur={() => setTimeout(() => setEditClientSearchFocused(false), 200)}
                        className="pl-10"
                        autoComplete="off"
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

                <div className="modal-form-field">
                  <Label>Utilisateur</Label>
                  <Select
                    value={editFormData.userId ? String(editFormData.userId) : ''}
                    onValueChange={(value) => setEditFormData({ ...editFormData, userId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un utilisateur" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => {
                        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                        return (
                          <SelectItem key={user.id} value={String(user.id)}>
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
              <CardTitle className={view === 'day' ? 'planning-day-weekday-number' : ''}>
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
                          
                          // Debug: log event data
                          if (dayEvents.length > 0 && dayEvents.indexOf(event) === 0) {
                            console.log('Event data in month view:', {
                              id: event.id,
                              assignedTo: event.assignedTo,
                              createdBy: event.createdBy,
                              userId: event.userId,
                              contactName: event.contactName
                            });
                          }
                          
                          return (
                            <div 
                              key={event.id} 
                              className="planning-event-badge"
                              onMouseEnter={(e) => handleEventMouseEnter(event, e)}
                              onMouseLeave={handleEventMouseLeave}
                              style={{ 
                                cursor: 'pointer',
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
                                <div className="planning-event-client">{event.contactName || event.clientName}</div>
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
                                onMouseEnter={(e) => handleEventMouseEnter(event, e)}
                                onMouseLeave={handleEventMouseLeave}
                                style={{ 
                                  cursor: 'pointer',
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
                                  <div className="planning-event-client">{event.contactName || event.clientName}</div>
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
                            
                            // Debug: log first event in day view
                            if (hourEvents.length > 0 && hourEvents.indexOf(event) === 0) {
                              console.log('Day view event:', {
                                id: event.id,
                                userId: event.userId,
                                userId_read: event.userId_read,
                                eventUserId: eventUserId,
                                userName: getUserName(eventUserId),
                                contactName: getEventClientName(event),
                                usersArrayLength: users.length,
                                sampleUserIds: users.slice(0, 3).map(u => u.id)
                              });
                            }
                            
                            const isHovered = hoveredEventId === event.id;
                            const hoverColor = isHovered ? getDarkerColor(userColor) : lightColor;
                            
                            return (
                              <div
                                key={event.id}
                                className={`planning-day-event ${!canEdit ? 'planning-day-event-disabled' : ''}`}
                                onClick={canEdit ? (e) => {
                                  // Prevent hover from showing when clicking
                                  if (hoverTimeoutRef.current) {
                                    clearTimeout(hoverTimeoutRef.current);
                                    hoverTimeoutRef.current = null;
                                  }
                                  setHoveredEvent(null);
                                  // Set a flag to prevent hover for a short time after click
                                  if (clickTimeoutRef.current) {
                                    clearTimeout(clickTimeoutRef.current);
                                  }
                                  clickTimeoutRef.current = setTimeout(() => {
                                    clickTimeoutRef.current = null;
                                  }, 200);
                                  handleEditEvent(event);
                                } : undefined}
                                onMouseEnter={(e) => {
                                  setHoveredEventId(event.id);
                                  handleEventMouseEnter(event, e);
                                }}
                                onMouseLeave={() => {
                                  setHoveredEventId(null);
                                  handleEventMouseLeave();
                                }}
                                style={{ 
                                  cursor: canEdit ? 'pointer' : 'default',
                                  backgroundColor: hoverColor,
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
                                        <div className="planning-day-event-client">{contactName}</div>
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
                    {getUserName(getEventUserId(hoveredEvent))}
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
      </div>
    </div>
  );
}
export default PlanningAdministrateur;

