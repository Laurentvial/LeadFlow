import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { DateInput } from './ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Pencil, Plus, Calendar, Clock, Send, X } from 'lucide-react';
import { useHasPermission } from '../hooks/usePermissions';
import { useUser } from '../contexts/UserContext';
import { useUsers } from '../hooks/useUsers';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import '../styles/Contacts.css';
import '../styles/Modal.css';

interface ContactInfoTabProps {
  contact: any;
  onOpenEditPersonalInfo: () => void;
  onContactUpdated?: () => void;
  appointments?: any[];
  notes?: any[];
  contactId?: string;
  onRefresh?: () => void;
}

export function ContactInfoTab({ 
  contact, 
  onOpenEditPersonalInfo, 
  onContactUpdated,
  appointments = [],
  notes = [],
  contactId = '',
  onRefresh = () => {}
}: ContactInfoTabProps) {
  const canEdit = useHasPermission('contacts', 'edit');
  const canCreatePlanning = useHasPermission('planning', 'create');
  const canEditPlanning = useHasPermission('planning', 'edit');
  const canDeletePlanning = useHasPermission('planning', 'delete');
  const { currentUser } = useUser();
  const { users } = useUsers();
  
  // Appointments state
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isEditAppointmentModalOpen, setIsEditAppointmentModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);
  const [appointmentFormData, setAppointmentFormData] = useState({
    date: '',
    hour: '09',
    minute: '00',
    comment: '',
    userId: ''
  });
  const [editAppointmentFormData, setEditAppointmentFormData] = useState({
    date: '',
    hour: '09',
    minute: '00',
    comment: '',
    userId: ''
  });
  
  // Notes state
  const [noteText, setNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  
  // Initialize userId with current user when modal opens
  useEffect(() => {
    if (isAppointmentModalOpen && currentUser?.id && !appointmentFormData.userId) {
      setAppointmentFormData(prev => ({ 
        ...prev, 
        userId: prev.userId || currentUser.id 
      }));
    }
  }, [isAppointmentModalOpen, currentUser]);
  
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];
  
  async function handleCreateAppointment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canCreatePlanning) return;
    
    if (!appointmentFormData.date) {
      toast.error('Veuillez sélectionner une date');
      return;
    }

    setIsSubmittingAppointment(true);
    try {
      const timeString = `${appointmentFormData.hour.padStart(2, '0')}:${appointmentFormData.minute.padStart(2, '0')}`;
      await apiCall('/api/events/create/', {
        method: 'POST',
        body: JSON.stringify({
          datetime: `${appointmentFormData.date}T${timeString}`,
          contactId: contactId,
          userId: appointmentFormData.userId || currentUser?.id || null,
          comment: appointmentFormData.comment || ''
        }),
      });
      
      toast.success('Rendez-vous créé avec succès');
      setIsAppointmentModalOpen(false);
      setAppointmentFormData({ date: '', hour: '09', minute: '00', comment: '', userId: currentUser?.id || '' });
      onRefresh();
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      const errorMessage = error?.response?.detail || error?.message || 'Erreur lors de la création du rendez-vous';
      toast.error(errorMessage);
    } finally {
      setIsSubmittingAppointment(false);
    }
  }
  
  function handleEditAppointment(appointment: any) {
    if (!canEditPlanning) return;
    const eventDate = new Date(appointment.datetime);
    const dateStr = eventDate.toISOString().split('T')[0];
    const hour = eventDate.getHours().toString().padStart(2, '0');
    const minute = eventDate.getMinutes().toString().padStart(2, '0');
    
    setEditingAppointment(appointment);
    setEditAppointmentFormData({
      date: dateStr,
      hour: hour,
      minute: minute,
      comment: appointment.comment || '',
      userId: appointment.userId || currentUser?.id || ''
    });
    setIsEditAppointmentModalOpen(true);
  }
  
  async function handleUpdateAppointment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEditPlanning || !editingAppointment) return;
    
    if (!editAppointmentFormData.date) {
      toast.error('Veuillez sélectionner une date');
      return;
    }

    setIsSubmittingAppointment(true);
    try {
      const timeString = `${editAppointmentFormData.hour.padStart(2, '0')}:${editAppointmentFormData.minute.padStart(2, '0')}`;
      await apiCall(`/api/events/${editingAppointment.id}/update/`, {
        method: 'PUT',
        body: JSON.stringify({
          datetime: `${editAppointmentFormData.date}T${timeString}`,
          contactId: contactId,
          userId: editAppointmentFormData.userId || currentUser?.id || null,
          comment: editAppointmentFormData.comment || ''
        }),
      });
      
      toast.success('Rendez-vous modifié avec succès');
      setIsEditAppointmentModalOpen(false);
      setEditingAppointment(null);
      setEditAppointmentFormData({ date: '', hour: '09', minute: '00', comment: '', userId: currentUser?.id || '' });
      onRefresh();
    } catch (error: any) {
      console.error('Error updating appointment:', error);
      const errorMessage = error?.response?.detail || error?.message || 'Erreur lors de la modification du rendez-vous';
      toast.error(errorMessage);
    } finally {
      setIsSubmittingAppointment(false);
    }
  }
  
  async function handleDeleteAppointment(appointmentId: string) {
    if (!canDeletePlanning) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rendez-vous ?')) return;
    
    try {
      await apiCall(`/api/events/${appointmentId}/`, { method: 'DELETE' });
      toast.success('Rendez-vous supprimé avec succès');
      onRefresh();
    } catch (error: any) {
      console.error('Error deleting appointment:', error);
      const errorMessage = error?.response?.detail || error?.message || 'Erreur lors de la suppression du rendez-vous';
      toast.error(errorMessage);
    }
  }
  
  async function handleCreateNote(e: React.FormEvent) {
    e.preventDefault();
    
    if (!noteText.trim()) {
      toast.error('Veuillez saisir une note');
      return;
    }

    setIsSubmittingNote(true);
    try {
      await apiCall('/api/notes/create/', {
        method: 'POST',
        body: JSON.stringify({
          text: noteText.trim(),
          contactId: contactId,
        }),
      });
      toast.success('Note créée avec succès');
      setNoteText('');
      onRefresh();
    } catch (error: any) {
      console.error('Error creating note:', error);
      const errorMessage = error?.response?.detail || error?.message || 'Erreur lors de la création de la note';
      toast.error(errorMessage);
    } finally {
      setIsSubmittingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm('Supprimer cette note ?')) return;
    
    try {
      await apiCall(`/api/notes/delete/${noteId}/`, { method: 'DELETE' });
      toast.success('Note supprimée avec succès');
      onRefresh();
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Erreur lors de la suppression de la note');
    }
  }

  return (
    <div className="space-y-6">
      {/* Rendez-vous - Compact */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Rendez-vous</CardTitle>
            {canCreatePlanning && (
              <Button type="button" onClick={() => setIsAppointmentModalOpen(true)}>
                <Plus className="planning-icon planning-icon-with-margin" />
                Ajouter un rendez-vous
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {appointments.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {[...appointments]
                .sort((a, b) => {
                  const dateA = new Date(a.datetime).getTime();
                  const dateB = new Date(b.datetime).getTime();
                  return dateB - dateA; // Descending order (most recent first)
                })
                .slice(0, 6)
                .map((apt) => {
                const datetime = new Date(apt.datetime);
                const isPast = datetime < new Date();
                return (
                  <div 
                    key={apt.id} 
                    className={`p-2 border rounded text-sm ${
                      isPast 
                        ? 'border-slate-300 bg-slate-50 opacity-60' 
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className={`w-4 h-4 ${isPast ? 'text-slate-400' : 'text-slate-500'}`} />
                          <span className={`font-medium ${isPast ? 'text-slate-500' : ''}`}>
                            {datetime.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                          <Clock className={`w-4 h-4 ${isPast ? 'text-slate-400' : 'text-slate-500'} ml-1`} />
                          <span className={isPast ? 'text-slate-400' : ''}>
                            {datetime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                        </div>
                        {apt.comment && (
                          <p className={`text-sm mb-1 whitespace-pre-wrap line-clamp-2 ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
                            {apt.comment}
                          </p>
                        )}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${isPast ? 'text-slate-400' : 'text-slate-500'}`}>
                              {apt.created_at ? new Date(apt.created_at).toLocaleString('fr-FR', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : '-'}
                            </span>
                            {(apt.createdBy || apt.userId?.username || apt.user?.username) && (
                              <span className={`text-xs ${isPast ? 'text-slate-400' : 'text-slate-500'}`}>
                                • {apt.createdBy || apt.userId?.username || apt.user?.username}
                              </span>
                            )}
                          </div>
                          {apt.assignedTo && (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${isPast ? 'text-slate-400' : 'text-slate-500'}`}>
                                Assigné à: <span className="font-medium">{apt.assignedTo}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {(canEditPlanning || canDeletePlanning) && (
                        <div className="flex gap-1 flex-shrink-0">
                          {canEditPlanning && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditAppointment(apt)}
                              className={`h-7 w-7 p-0 ${isPast ? 'opacity-50' : ''}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          )}
                          {canDeletePlanning && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAppointment(apt.id)}
                              className={`h-auto p-0 text-red-600 hover:text-red-700 ${isPast ? 'opacity-50' : ''}`}
                              style={{ fontSize: '7px' }}
                            >
                              Supprimer
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {appointments.length > 3 && (
                <p className="text-xs text-slate-500 text-center pt-1">
                  + {appointments.length - 3} autre(s) rendez-vous
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Aucun rendez-vous</p>
          )}
        </CardContent>
      </Card>

      {/* Notes - Compact */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Notes</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <form onSubmit={handleCreateNote}>
            <div className="flex gap-2 items-stretch">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Ajouter une note..."
                rows={2}
                className="resize-none text-sm flex-1"
                disabled={isSubmittingNote}
              />
              <Button 
                type="submit" 
                size="sm" 
                disabled={isSubmittingNote || !noteText.trim()}
                className="self-stretch"
              >
                <Send className="w-3 h-3 mr-1" />
                {isSubmittingNote ? 'Envoi...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
          {notes.length > 0 && (
            <div className="space-y-2 pt-2">
              {[...notes]
                .sort((a, b) => {
                  const dateA = new Date(a.createdAt || a.created_at).getTime();
                  const dateB = new Date(b.createdAt || b.created_at).getTime();
                  return dateB - dateA; // Descending order (most recent first)
                })
                .slice(0, 3)
                .map((note) => (
                <div key={note.id} className="text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-start gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-slate-500">
                            {new Date(note.createdAt || note.created_at).toLocaleString('fr-FR', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {(note.createdBy || note.userId?.username || note.user?.username) && (
                            <span className="text-xs text-slate-500">
                              • {note.createdBy || note.userId?.username || note.user?.username}
                            </span>
                          )}
                        </div>
                         <span className="text-sm text-slate-700 whitespace-pre-wrap break-words text-wrap">{note.text}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-red-600 hover:text-red-700 flex-shrink-0 h-auto p-0"
                      style={{ fontSize: '7px' }}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              ))}
              {notes.length > 3 && (
                <p className="text-xs text-slate-500 text-center pt-1">
                  + {notes.length - 3} autre(s) note(s)
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 1. Informations générales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>1. Informations générales</CardTitle>
          {canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenEditPersonalInfo}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Éditer
          </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-600">Statut</Label>
              <p>
                <span 
                  style={{
                    backgroundColor: contact.statusColor || '#e5e7eb',
                    color: contact.statusColor ? '#000000' : '#374151',
                    padding: '4px 12px',
                    marginTop: '5px',
                    borderRadius: '5px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    display: 'inline-block'
                  }}
                >
                  {contact.statusName || '-'}
                </span>
              </p>
            </div>
            <div>
              <Label className="text-slate-600">Civilité</Label>
              <p>{contact.civility || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Prénom</Label>
              <p>{contact.firstName || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Nom</Label>
              <p>{contact.lastName || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Email</Label>
              <p>{contact.email || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Portable</Label>
              <p>{contact.mobile || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Téléphone</Label>
              <p>{contact.phone || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Date de naissance</Label>
              <p>{(() => {
                if (!contact.birthDate) return '-';
                const date = new Date(contact.birthDate);
                if (isNaN(date.getTime())) return '-';
                return date.toLocaleDateString('fr-FR', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric'
                });
              })()}</p>
            </div>
            <div>
              <Label className="text-slate-600">Nationalité</Label>
              <p>{contact.nationality || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Adresse */}
      <Card>
        <CardHeader>
          <CardTitle>2. Adresse</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-600">Adresse</Label>
              <p>{contact.address || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Complément d'adresse</Label>
              <p>{contact.addressComplement || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Code postal</Label>
              <p>{contact.postalCode || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Ville</Label>
              <p>{contact.city || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Gestion */}
      <Card>
        <CardHeader>
          <CardTitle>3. Gestion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-600">Source</Label>
              <p>{contact.source || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Campagne</Label>
              <p>{contact.campaign || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Téléopérateur</Label>
              <p>{contact.teleoperatorName || contact.managerName || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Confirmateur</Label>
              <p>{contact.confirmateurName || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Appointment Modal */}
      {isAppointmentModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAppointmentModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nouveau rendez-vous</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => setIsAppointmentModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleCreateAppointment} className="modal-form">
              <div className="modal-form-field">
                <Label htmlFor="appointment-date">Date</Label>
                <DateInput
                  id="appointment-date"
                  value={appointmentFormData.date}
                  onChange={(value) => setAppointmentFormData({ ...appointmentFormData, date: value })}
                  required
                />
              </div>
              
              <div className="modal-form-field">
                <Label>Heure</Label>
                <div className="flex gap-2 items-center">
                  <Select
                    value={appointmentFormData.hour}
                    onValueChange={(value) => setAppointmentFormData({ ...appointmentFormData, hour: value })}
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
                    value={appointmentFormData.minute}
                    onValueChange={(value) => setAppointmentFormData({ ...appointmentFormData, minute: value })}
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
                <Label htmlFor="appointment-user">Utilisateur</Label>
                <Select
                  value={appointmentFormData.userId || currentUser?.id || ''}
                  onValueChange={(value) => setAppointmentFormData({ ...appointmentFormData, userId: value })}
                >
                  <SelectTrigger id="appointment-user">
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
                <Label htmlFor="appointment-comment">Commentaire (optionnel)</Label>
                <Textarea
                  id="appointment-comment"
                  value={appointmentFormData.comment}
                  onChange={(e) => setAppointmentFormData({ ...appointmentFormData, comment: e.target.value })}
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
                    setIsAppointmentModalOpen(false);
                    setAppointmentFormData({ date: '', hour: '09', minute: '00', comment: '', userId: currentUser?.id || '' });
                  }}
                  disabled={isSubmittingAppointment}
                >
                  Annuler
                </Button>
                {canCreatePlanning && (
                  <Button type="submit" disabled={isSubmittingAppointment || !appointmentFormData.date}>
                    <Send className="w-4 h-4 mr-2" />
                    {isSubmittingAppointment ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Appointment Modal */}
      {isEditAppointmentModalOpen && editingAppointment && (
        <div className="modal-overlay" onClick={() => {
          setIsEditAppointmentModalOpen(false);
          setEditingAppointment(null);
          setEditAppointmentFormData({ date: '', hour: '09', minute: '00', comment: '', userId: currentUser?.id || '' });
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
                  setIsEditAppointmentModalOpen(false);
                  setEditingAppointment(null);
                  setEditAppointmentFormData({ date: '', hour: '09', minute: '00', comment: '', userId: currentUser?.id || '' });
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleUpdateAppointment} className="modal-form">
              <div className="modal-form-field">
                <Label htmlFor="edit-appointment-date">Date</Label>
                <DateInput
                  id="edit-appointment-date"
                  value={editAppointmentFormData.date}
                  onChange={(value) => setEditAppointmentFormData({ ...editAppointmentFormData, date: value })}
                  required
                />
              </div>
              
              <div className="modal-form-field">
                <Label>Heure</Label>
                <div className="flex gap-2 items-center">
                  <Select
                    value={editAppointmentFormData.hour}
                    onValueChange={(value) => setEditAppointmentFormData({ ...editAppointmentFormData, hour: value })}
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
                    value={editAppointmentFormData.minute}
                    onValueChange={(value) => setEditAppointmentFormData({ ...editAppointmentFormData, minute: value })}
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
                <Label htmlFor="edit-appointment-user">Utilisateur</Label>
                <Select
                  value={editAppointmentFormData.userId || currentUser?.id || ''}
                  onValueChange={(value) => setEditAppointmentFormData({ ...editAppointmentFormData, userId: value })}
                >
                  <SelectTrigger id="edit-appointment-user">
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
                <Label htmlFor="edit-appointment-comment">Commentaire (optionnel)</Label>
                <Textarea
                  id="edit-appointment-comment"
                  value={editAppointmentFormData.comment}
                  onChange={(e) => setEditAppointmentFormData({ ...editAppointmentFormData, comment: e.target.value })}
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
                    setIsEditAppointmentModalOpen(false);
                    setEditingAppointment(null);
                    setEditAppointmentFormData({ date: '', hour: '09', minute: '00', comment: '', userId: currentUser?.id || '' });
                  }}
                  disabled={isSubmittingAppointment}
                >
                  Annuler
                </Button>
                {canEditPlanning && (
                  <Button type="submit" disabled={isSubmittingAppointment || !editAppointmentFormData.date}>
                    <Send className="w-4 h-4 mr-2" />
                    {isSubmittingAppointment ? 'Enregistrement...' : 'Enregistrer'}
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


