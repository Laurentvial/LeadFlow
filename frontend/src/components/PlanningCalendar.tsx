import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DateInput } from './ui/date-input';
import { Calendar as CalendarIcon, Plus, Clock, User, Pencil, Trash2, X, Send, Search } from 'lucide-react';
import { apiCall } from '../utils/api';
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
  
  const [events, setEvents] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null); // Selected day for filtering
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchFocused, setClientSearchFocused] = useState(false);
  const [editClientSearchQuery, setEditClientSearchQuery] = useState('');
  const [editClientSearchFocused, setEditClientSearchFocused] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    hour: '09',
    minute: '00',
    clientId: '',
    comment: '',
    userId: ''
  });
  const [editFormData, setEditFormData] = useState({
    date: '',
    hour: '09',
    minute: '00',
    clientId: '',
    comment: '',
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

  async function loadData() {
    setLoading(true);
    try {
      const [eventsData, contactsData] = await Promise.all([
        apiCall('/api/events/'),
        apiCall('/api/contacts/')
      ]);
      
      setEvents(eventsData?.events || eventsData || []);
      setContacts(contactsData?.contacts || contactsData || []);
    } catch (error) {
      console.error('Error loading planning data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    try {
      const timeString = `${formData.hour.padStart(2, '0')}:${formData.minute.padStart(2, '0')}`;
      await apiCall('/api/events/create/', {
        method: 'POST',
        body: JSON.stringify({
          datetime: `${formData.date}T${timeString}`,
          contactId: formData.clientId || null,
          userId: currentUser?.id || null,
          comment: formData.comment || ''
        }),
      });
      
      setIsModalOpen(false);
      setFormData({ date: '', hour: '09', minute: '00', clientId: '', comment: '', userId: currentUser?.id || '' });
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
    setEditFormData({
      date: dateStr,
      hour: hour,
      minute: minute,
      clientId: selectedClientId,
      comment: event.comment || '',
      userId: event.userId || currentUser?.id || ''
    });
    setEditClientSearchQuery(selectedClient ? `${selectedClient.fname} ${selectedClient.lname}` : '');
    setIsEditModalOpen(true);
  }

  async function handleUpdateEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!editingEvent) return;
    
    try {
      const timeString = `${editFormData.hour.padStart(2, '0')}:${editFormData.minute.padStart(2, '0')}`;
      await apiCall(`/api/events/${editingEvent.id}/update/`, {
        method: 'PUT',
        body: JSON.stringify({
          datetime: `${editFormData.date}T${timeString}`,
          contactId: editFormData.clientId || null,
          userId: editFormData.userId || currentUser?.id || null,
          comment: editFormData.comment || ''
        }),
      });
      
      setIsEditModalOpen(false);
      setEditingEvent(null);
      setEditFormData({ date: '', hour: '09', minute: '00', clientId: '', comment: '', userId: currentUser?.id || '' });
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
    const fullName = `${client.fname || ''} ${client.lname || ''}`.toLowerCase();
    return fullName.includes(clientSearchQuery.toLowerCase());
  });

  // Filter contacts based on search query for edit modal
  const filteredEditContacts = contacts.filter((client) => {
    if (!editClientSearchQuery) return false; // Only show results when typing
    const fullName = `${client.fname || ''} ${client.lname || ''}`.toLowerCase();
    return fullName.includes(editClientSearchQuery.toLowerCase());
  });

  // Get selected client name
  const getSelectedClientName = (clientId: string) => {
    if (!clientId || clientId === 'none') return 'Sélectionner un client';
    const client = contacts.find(c => c.id === clientId);
    return client ? `${client.fname} ${client.lname}` : 'Sélectionner un client';
  };

  function getEventsForDay(day: number) {
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(event => {
      if (!event.datetime) return false;
      const eventDate = new Date(event.datetime).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
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
                  <Label>Client (optionnel)</Label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        type="text"
                        placeholder="Rechercher un client..."
                        value={clientSearchQuery}
                        onChange={(e) => {
                          setClientSearchQuery(e.target.value);
                          setClientSearchFocused(true);
                        }}
                        onFocus={() => setClientSearchFocused(true)}
                        onBlur={() => setTimeout(() => setClientSearchFocused(false), 200)}
                        className="pl-10"
                      />
                    </div>
                    {clientSearchFocused && clientSearchQuery && (
                      <div className="absolute z-[99999] w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredContacts.length > 0 ? (
                          <div className="p-1">
                            <div
                              className="px-3 py-2 cursor-pointer hover:bg-accent rounded-sm text-sm"
                              onClick={() => {
                                setFormData({ ...formData, clientId: '' });
                                setClientSearchQuery('');
                                setClientSearchFocused(false);
                              }}
                            >
                              Aucun client
                            </div>
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
                            Aucun client trouvé
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {formData.clientId && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Client sélectionné : {getSelectedClientName(formData.clientId)}
                    </div>
                  )}
                </div>
                
                <div className="modal-form-field">
                  <Label>Commentaire (optionnel)</Label>
                  <Textarea
                    value={formData.comment}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                    placeholder="Notes sur le rendez-vous..."
                  />
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
          <div className="modal-overlay" onClick={() => {
            setIsEditModalOpen(false);
            setEditingEvent(null);
            setEditFormData({ date: '', hour: '09', minute: '00', clientId: '', comment: '', userId: currentUser?.id || '' });
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
                    setEditFormData({ date: '', hour: '09', minute: '00', clientId: '', comment: '', userId: currentUser?.id || '' });
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
                  <Label htmlFor="edit-event-client">Client (optionnel)</Label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="edit-event-client"
                        type="text"
                        placeholder="Rechercher un client..."
                        value={editClientSearchQuery}
                        onChange={(e) => {
                          setEditClientSearchQuery(e.target.value);
                          setEditClientSearchFocused(true);
                        }}
                        onFocus={() => setEditClientSearchFocused(true)}
                        onBlur={() => setTimeout(() => setEditClientSearchFocused(false), 200)}
                        className="pl-10"
                      />
                    </div>
                    {editClientSearchFocused && editClientSearchQuery && (
                      <div className="absolute z-[99999] w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredEditContacts.length > 0 ? (
                          <div className="p-1">
                            <div
                              className="px-3 py-2 cursor-pointer hover:bg-accent rounded-sm text-sm"
                              onClick={() => {
                                setEditFormData({ ...editFormData, clientId: '' });
                                setEditClientSearchQuery('');
                                setEditClientSearchFocused(false);
                              }}
                            >
                              Aucun client
                            </div>
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
                            Aucun client trouvé
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {editFormData.clientId && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Client sélectionné : {getSelectedClientName(editFormData.clientId)}
                    </div>
                  )}
                </div>

                <div className="modal-form-field">
                  <Label htmlFor="edit-event-user">Utilisateur</Label>
                  <Select
                    value={editFormData.userId || currentUser?.id || ''}
                    onValueChange={(value) => setEditFormData({ ...editFormData, userId: value })}
                  >
                    <SelectTrigger id="edit-event-user">
                      <SelectValue placeholder="Sélectionner un utilisateur" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}` 
                            : user.email || user.username || `User ${user.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="modal-form-field">
                  <Label htmlFor="edit-event-comment">Commentaire (optionnel)</Label>
                  <Textarea
                    id="edit-event-comment"
                    value={editFormData.comment}
                    onChange={(e) => setEditFormData({ ...editFormData, comment: e.target.value })}
                    placeholder="Ajoutez un commentaire..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
                
                <div className="modal-form-actions">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingEvent(null);
                      setEditFormData({ date: '', hour: '09', minute: '00', clientId: '', comment: '', userId: currentUser?.id || '' });
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
                {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
              </CardTitle>
              <div className="planning-calendar-nav">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
                    setSelectedDay(null); // Reset selection when changing month
                  }}
                >
                  ←
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDate(new Date());
                    setSelectedDay(null); // Reset selection when going to today
                  }}
                >
                  Aujourd'hui
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
                    setSelectedDay(null); // Reset selection when changing month
                  }}
                >
                  →
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
                      {dayEvents.map((event) => {
                        const eventDate = new Date(event.datetime);
                        const time = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
                        
                        return (
                          <div key={event.id} className="planning-event-badge">
                            <div className="planning-event-time">
                              <Clock className="planning-icon-sm" />
                              {time}
                            </div>
                            {event.clientName && (
                              <div className="planning-event-client">{event.clientName}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Events List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Liste des rendez-vous
                {selectedDay !== null && (
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    ({selectedDay}/{selectedDate.getMonth() + 1}/{selectedDate.getFullYear()})
                  </span>
                )}
              </CardTitle>
              {selectedDay !== null && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDay(null)}
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
              // Filter events by selected day if a day is selected
              let filteredEvents = events;
              if (selectedDay !== null) {
                const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
                filteredEvents = events.filter(event => {
                  if (!event.datetime) return false;
                  const eventDate = new Date(event.datetime).toISOString().split('T')[0];
                  return eventDate === selectedDateStr;
                });
              }

              return filteredEvents.length > 0 ? (
                <div className="space-y-3">
                  {[...filteredEvents]
                    .sort((a, b) => {
                      const dateA = new Date(a.datetime).getTime();
                      const dateB = new Date(b.datetime).getTime();
                      return dateB - dateA; // Descending order (most recent first)
                    })
                    .map((event) => {
                      const cardProps: any = {
                        appointment: event,
                        variant: 'planning' as const,
                        showActions: canEdit || canDelete,
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