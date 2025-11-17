import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DateInput } from './ui/date-input';
import { Calendar as CalendarIcon, Plus, Clock, User, Pencil, Trash2, X } from 'lucide-react';
import { apiCall } from '../utils/api';
import { useUser } from '../contexts/UserContext';
import '../styles/PlanningCalendar.css';
import '../styles/Modal.css';
import '../styles/PageHeader.css';
import { toast } from 'sonner';
import LoadingIndicator from './LoadingIndicator';

export function PlanningCalendar() {
  const { currentUser } = useUser();
  const [events, setEvents] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    date: '',
    hour: '09',
    minute: '00',
    clientId: '',
    comment: ''
  });
  const [editFormData, setEditFormData] = useState({
    date: '',
    hour: '09',
    minute: '00',
    clientId: '',
    comment: ''
  });

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
          clientId: formData.clientId || null,
          comment: formData.comment || ''
        }),
      });
      
      setIsModalOpen(false);
      setFormData({ date: '', hour: '09', minute: '00', clientId: '', comment: '' });
      loadData();
      toast.success('Événement créé avec succès');
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Erreur lors de la création de l\'événement');
    }
  }

  function handleEditEvent(event: any) {
    const eventDate = new Date(event.datetime);
    const dateStr = eventDate.toISOString().split('T')[0];
    const hour = eventDate.getHours().toString().padStart(2, '0');
    const minute = eventDate.getMinutes().toString().padStart(2, '0');
    
    setEditingEvent(event);
    setEditFormData({
      date: dateStr,
      hour: hour,
      minute: minute,
      clientId: event.clientId_read || '',
      comment: event.comment || ''
    });
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
          clientId: editFormData.clientId || null,
          comment: editFormData.comment || ''
        }),
      });
      
      setIsEditModalOpen(false);
      setEditingEvent(null);
      setEditFormData({ date: '', hour: '09', minute: '00', clientId: '', comment: '' });
      loadData();
      toast.success('Événement modifié avec succès');
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Erreur lors de la modification de l\'événement');
    }
  }

  async function handleDeleteEvent(id: string) {
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

  function getEventsForDay(day: number) {
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(event => {
      if (!event.datetime) return false;
      const eventDate = new Date(event.datetime).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  }

  if (loading) {
    return (
      <div className="planning-container">
        <div className="page-header-section">
          <div className="page-title-section">
            <h1 className="page-title">Planning</h1>
            <p className="page-subtitle">Gestion des rendez-vous</p>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <LoadingIndicator />
        </div>
      </div>
    );
  }

  return (
    <div className="planning-container">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Planning</h1>
          <p className="page-subtitle">Gestion des rendez-vous</p>
        </div>
        
        <Button type="button" onClick={() => setIsModalOpen(true)}>
          <Plus className="planning-icon planning-icon-with-margin" />
          Ajouter un rendez-vous
        </Button>
        
        {isModalOpen && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Nouveau rendez-vous</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="modal-close"
                  onClick={() => setIsModalOpen(false)}
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
                  <Select value={formData.clientId || "none"} onValueChange={(value) => setFormData({ ...formData, clientId: value === "none" ? "" : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun client</SelectItem>
                      {contacts.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.fname} {client.lname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit">
                    Créer
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isEditModalOpen && editingEvent && (
          <div className="modal-overlay" onClick={() => {
            setIsEditModalOpen(false);
            setEditingEvent(null);
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
                  }}
                >
                  <X className="planning-icon-md" />
                </Button>
              </div>
              <form onSubmit={handleUpdateEvent} className="modal-form">
                <div className="modal-form-field">
                  <Label>Date</Label>
                  <DateInput
                    value={editFormData.date}
                    onChange={(value) => setEditFormData({ ...editFormData, date: value })}
                    required
                  />
                </div>
                
                <div className="modal-form-field">
                  <Label>Heure</Label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Select
                      value={editFormData.hour}
                      onValueChange={(value) => setEditFormData({ ...editFormData, hour: value })}
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
                      value={editFormData.minute}
                      onValueChange={(value) => setEditFormData({ ...editFormData, minute: value })}
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
                  <Select value={editFormData.clientId || "none"} onValueChange={(value) => setEditFormData({ ...editFormData, clientId: value === "none" ? "" : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun client</SelectItem>
                      {contacts.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.fname} {client.lname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="modal-form-field">
                  <Label>Commentaire (optionnel)</Label>
                  <Textarea
                    value={editFormData.comment}
                    onChange={(e) => setEditFormData({ ...editFormData, comment: e.target.value })}
                    placeholder="Notes sur le rendez-vous..."
                  />
                </div>
                
                <div className="modal-form-actions">
                  <Button type="button" variant="outline" onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingEvent(null);
                  }}>
                    Annuler
                  </Button>
                  <Button type="submit">
                    Enregistrer
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

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
                onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
              >
                ←
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
              >
                Aujourd'hui
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
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
              
              return (
                <div
                  key={day}
                  className={`planning-calendar-day ${isToday ? 'planning-calendar-day-today' : ''}`}
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
          <CardTitle>Liste des rendez-vous</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <div className="planning-events-list">
              {events.map((event) => {
                const datetime = new Date(event.datetime);
                
                return (
                  <div key={event.id} className="planning-event-item">
                    <div className="planning-event-content">
                      <div className="planning-event-meta">
                        <div className="planning-event-date-time">
                          <div className="planning-event-date-row">
                            <CalendarIcon className="planning-icon-md planning-icon-slate" />
                            <span>{datetime.toLocaleDateString('fr-FR')}</span>
                          </div>
                          <div className="planning-event-time-row">
                            <Clock className="planning-icon-md planning-icon-slate" />
                            <span>{datetime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                          </div>
                                                  
                          {event.clientName && (
                            <div className="planning-event-client-row">
                              <User className="planning-icon-md planning-icon-slate" />
                              <span>{event.clientName}</span>
                            </div>
                          )}
                        </div>

                      </div>
                      
                      {event.comment && (
                        <p className="planning-event-comment">{event.comment}</p>
                      )}
                      
                      {event.created_at && event.createdBy && (
                        <p className="planning-event-created-info">
                          Créé le {new Date(event.created_at).toLocaleDateString('fr-FR', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric'
                          })} à {new Date(event.created_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })} par {event.createdBy}
                        </p>
                      )}
                    </div>
                    
                    <div className="planning-event-actions">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditEvent(event)}
                      >
                        <Pencil className="planning-icon-md" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteEvent(event.id)}
                        className="planning-delete-button"
                      >
                        <Trash2 className="planning-icon-md" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="planning-empty-message">Aucun rendez-vous</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
export default PlanningCalendar;