import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { DateInput } from './ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, X, Send } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { useUsers } from '../hooks/useUsers';
import { useUser } from '../contexts/UserContext';
import { useHasPermission } from '../hooks/usePermissions';
import { AppointmentCard } from './AppointmentCard';
import '../styles/Modal.css';

interface ContactAppointmentsTabProps {
  appointments: any[];
  contactId: string;
  onRefresh: () => void;
}

export function ContactAppointmentsTab({ appointments, contactId, onRefresh }: ContactAppointmentsTabProps) {
  const { currentUser } = useUser();
  const { users } = useUsers();
  
  // Permission checks
  const canCreate = useHasPermission('planning', 'create');
  const canEdit = useHasPermission('planning', 'edit');
  const canDelete = useHasPermission('planning', 'delete');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    hour: '09',
    minute: '00',
    comment: '',
    userId: ''
  });
  const [editFormData, setEditFormData] = useState({
    date: '',
    hour: '09',
    minute: '00',
    comment: '',
    userId: ''
  });

  // Initialize userId with current user when modal opens
  useEffect(() => {
    if (isModalOpen && currentUser?.id) {
      setFormData(prev => ({ 
        ...prev, 
        userId: prev.userId || currentUser.id 
      }));
    }
  }, [isModalOpen, currentUser]);

  async function handleCreateEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!formData.date) {
      toast.error('Veuillez sélectionner une date');
      return;
    }

    setIsSubmitting(true);
    try {
      const timeString = `${formData.hour.padStart(2, '0')}:${formData.minute.padStart(2, '0')}`;
      await apiCall('/api/events/create/', {
        method: 'POST',
        body: JSON.stringify({
          datetime: `${formData.date}T${timeString}`,
          contactId: contactId,
          userId: formData.userId || currentUser?.id || null,
          comment: formData.comment || ''
        }),
      });
      
      toast.success('Rendez-vous créé avec succès');
      setIsModalOpen(false);
      setFormData({ 
        date: '', 
        hour: '09', 
        minute: '00', 
        comment: '',
        userId: currentUser?.id || ''
      });
      onRefresh();
    } catch (error: any) {
      console.error('Error creating event:', error);
      const errorMessage = error?.response?.detail || error?.message || 'Erreur lors de la création du rendez-vous';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEditEvent(event: any) {
    if (!canEdit) return;
    const eventDate = new Date(event.datetime);
    const dateStr = eventDate.toISOString().split('T')[0];
    const hour = eventDate.getHours().toString().padStart(2, '0');
    const minute = eventDate.getMinutes().toString().padStart(2, '0');
    
    setEditingEvent(event);
    setEditFormData({
      date: dateStr,
      hour: hour,
      minute: minute,
      comment: event.comment || '',
      userId: event.userId || currentUser?.id || ''
    });
    setIsEditModalOpen(true);
  }

  async function handleUpdateEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!editingEvent || !editFormData.date) {
      toast.error('Veuillez sélectionner une date');
      return;
    }

    setIsSubmitting(true);
    try {
      const timeString = `${editFormData.hour.padStart(2, '0')}:${editFormData.minute.padStart(2, '0')}`;
      await apiCall(`/api/events/${editingEvent.id}/update/`, {
        method: 'PUT',
        body: JSON.stringify({
          datetime: `${editFormData.date}T${timeString}`,
          contactId: contactId,
          userId: editFormData.userId || currentUser?.id || null,
          comment: editFormData.comment || ''
        }),
      });
      
      toast.success('Rendez-vous modifié avec succès');
      setIsEditModalOpen(false);
      setEditingEvent(null);
      setEditFormData({ 
        date: '', 
        hour: '09', 
        minute: '00', 
        comment: '',
        userId: currentUser?.id || ''
      });
      onRefresh();
    } catch (error: any) {
      console.error('Error updating event:', error);
      const errorMessage = error?.response?.detail || error?.message || 'Erreur lors de la modification du rendez-vous';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    if (!canDelete) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rendez-vous ?')) return;
    
    try {
      await apiCall(`/api/events/${eventId}/`, { method: 'DELETE' });
      toast.success('Rendez-vous supprimé avec succès');
      onRefresh();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      const errorMessage = error?.response?.detail || error?.message || 'Erreur lors de la suppression du rendez-vous';
      toast.error(errorMessage);
    }
  }

  // Generate hour options (00-23)
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  // Generate minute options (00, 15, 30, 45)
  const minutes = ['00', '15', '30', '45'];

  return (
    <div className="space-y-6">
      {/* Create Event Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Rendez-vous</CardTitle>
            {canCreate && (
              <Button type="button" onClick={() => setIsModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un rendez-vous
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {appointments.length > 0 ? (
            <div className="space-y-3">
              {appointments.map((apt) => {
                const cardProps: any = {
                  appointment: apt,
                  variant: 'default' as const,
                  showActions: canEdit || canDelete,
                };
                if (canEdit) cardProps.onEdit = handleEditEvent;
                if (canDelete) cardProps.onDelete = handleDeleteEvent;
                return (
                  <AppointmentCard
                    key={apt.id}
                    {...cardProps}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Aucun rendez-vous</p>
          )}
        </CardContent>
      </Card>

      {/* Create Event Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => {
          setIsModalOpen(false);
          setFormData({ 
            date: '', 
            hour: '09', 
            minute: '00', 
            comment: '',
            userId: currentUser?.id || ''
          });
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
                  setFormData({ 
                    date: '', 
                    hour: '09', 
                    minute: '00', 
                    comment: '',
                    userId: currentUser?.id || ''
                  });
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleCreateEvent} className="modal-form">
              <div className="modal-form-field">
                <Label htmlFor="event-date">Date</Label>
                <DateInput
                  id="event-date"
                  value={formData.date}
                  onChange={(value) => setFormData({ ...formData, date: value })}
                  required
                />
              </div>
              
              <div className="modal-form-field">
                <Label>Heure</Label>
                <div className="flex gap-2 items-center">
                  <Select
                    value={formData.hour}
                    onValueChange={(value) => setFormData({ ...formData, hour: value })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hours.map((hour) => (
                        <SelectItem key={hour} value={hour}>
                          {hour}h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select
                    value={formData.minute}
                    onValueChange={(value) => setFormData({ ...formData, minute: value })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {minutes.map((minute) => (
                        <SelectItem key={minute} value={minute}>
                          {minute}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="modal-form-field">
                <Label htmlFor="event-user">Utilisateur</Label>
                <Select
                  value={formData.userId || currentUser?.id || ''}
                  onValueChange={(value) => setFormData({ ...formData, userId: value })}
                >
                  <SelectTrigger id="event-user">
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
                <Label htmlFor="event-comment">Commentaire (optionnel)</Label>
                <Textarea
                  id="event-comment"
                  value={formData.comment}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
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
                    setIsModalOpen(false);
                    setFormData({ 
                      date: '', 
                      hour: '09', 
                      minute: '00', 
                      comment: '',
                      userId: currentUser?.id || ''
                    });
                  }}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                {canCreate && (
                  <Button type="submit" disabled={isSubmitting || !formData.date}>
                    <Send className="w-4 h-4 mr-2" />
                    {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {isEditModalOpen && editingEvent && (
        <div className="modal-overlay" onClick={() => {
          setIsEditModalOpen(false);
          setEditingEvent(null);
          setEditFormData({ 
            date: '', 
            hour: '09', 
            minute: '00', 
            comment: '',
            userId: currentUser?.id || ''
          });
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
                  setEditFormData({ 
                    date: '', 
                    hour: '09', 
                    minute: '00', 
                    comment: '',
                    userId: currentUser?.id || ''
                  });
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
                      {hours.map((hour) => (
                        <SelectItem key={hour} value={hour}>
                          {hour}h
                        </SelectItem>
                      ))}
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
                      {minutes.map((minute) => (
                        <SelectItem key={minute} value={minute}>
                          {minute}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                    setEditFormData({ 
                      date: '', 
                      hour: '09', 
                      minute: '00', 
                      comment: '',
                      userId: currentUser?.id || ''
                    });
                  }}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                {canEdit && (
                  <Button type="submit" disabled={isSubmitting || !editFormData.date}>
                    <Send className="w-4 h-4 mr-2" />
                    {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


