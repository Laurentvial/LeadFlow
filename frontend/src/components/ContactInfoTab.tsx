import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { DateInput } from './ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Calendar, Clock, Send, X } from 'lucide-react';
import { useHasPermission } from '../hooks/usePermissions';
import { useUser } from '../contexts/UserContext';
import { useUsers } from '../hooks/useUsers';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import '../styles/Contacts.css';
import '../styles/Modal.css';
import '../styles/ContactTab.css';

interface Source {
  id: string;
  name: string;
}

interface ContactInfoTabProps {
  contact: any;
  onContactUpdated?: () => void;
  appointments?: any[];
  notes?: any[];
  contactId?: string;
  onRefresh?: () => void;
}

export function ContactInfoTab({ 
  contact, 
  onContactUpdated,
  appointments = [],
  notes = [],
  contactId = '',
  onRefresh = () => {}
}: ContactInfoTabProps) {
  const canEditGeneral = useHasPermission('contacts', 'edit');
  const canCreatePlanning = useHasPermission('planning', 'create');
  const canEditPlanning = useHasPermission('planning', 'edit');
  const canDeletePlanning = useHasPermission('planning', 'delete');
  const { currentUser } = useUser();
  const { users } = useUsers();
  
  // Get status permissions
  const statusEditPermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const editPerms = currentUser.permissions
      .filter((p: any) => p.component === 'statuses' && p.action === 'edit' && p.statusId)
      .map((p: any) => String(p.statusId).trim());
    return new Set(editPerms);
  }, [currentUser?.permissions]);
  
  const statusViewPermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const viewPerms = currentUser.permissions
      .filter((p: any) => p.component === 'statuses' && p.action === 'view' && p.statusId)
      .map((p: any) => String(p.statusId).trim());
    return new Set(viewPerms);
  }, [currentUser?.permissions]);
  
  // Helper function to check if user can edit this contact based on its status
  // Logic:
  // 1. If contact has no status -> use general permission
  // 2. If contact has a status -> user MUST have BOTH:
  //    - General 'contacts' edit permission (required by PermissionsTab validation)
  //    - Status-specific edit permission for this status
  const canEditContact = React.useCallback((contactData: any): boolean => {
    const contactStatusId = contactData?.statusId;
    
    // Normalize statusId to string for comparison
    const normalizedStatusId = contactStatusId ? String(contactStatusId).trim() : null;
    
    // If contact has no status, use general permission
    if (!normalizedStatusId) {
      return canEditGeneral;
    }
    
    // If contact has a status, user MUST have:
    // 1. General 'contacts' edit permission (required by PermissionsTab validation)
    // 2. Status-specific edit permission for this status
    if (!canEditGeneral) {
      // User doesn't have general permission, so they cannot edit
      return false;
    }
    
    // Check if user has permission to edit this specific status
    const canEditStatus = statusEditPermissions.has(normalizedStatusId);
    
    // User must have BOTH general permission AND status-specific permission
    return canEditStatus;
  }, [canEditGeneral, statusEditPermissions]);
  
  // Use canEditContact for the current contact
  // Recalculate when contact changes
  const canEdit = React.useMemo(() => {
    return canEditContact(contact);
  }, [contact, canEditContact]);
  
  // Statuses and sources
  const [statuses, setStatuses] = useState<any[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  
  // Editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldValue, setFieldValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  
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
  const [showAllNotes, setShowAllNotes] = useState(false);
  
  // Load statuses and sources
  useEffect(() => {
    loadStatuses();
    loadSources();
  }, []);

  async function loadStatuses() {
    try {
      const data = await apiCall('/api/statuses/');
      setStatuses(data.statuses || []);
    } catch (error) {
      console.error('Error loading statuses:', error);
    }
  }

  async function loadSources() {
    try {
      const data = await apiCall('/api/sources/');
      setSources(data.sources || []);
    } catch (error) {
      console.error('Error loading sources:', error);
    }
  }

  // Initialize userId with current user when modal opens
  useEffect(() => {
    if (isAppointmentModalOpen && currentUser?.id && !appointmentFormData.userId) {
      setAppointmentFormData(prev => ({ 
        ...prev, 
        userId: prev.userId || currentUser.id 
      }));
    }
  }, [isAppointmentModalOpen, currentUser]);

  async function handleFieldUpdate(fieldName: string, value: any) {
    if (!canEdit || !contactId) return;
    
    // Check if user has permission to edit this contact with the CURRENT status
    if (!canEditContact(contact)) {
      toast.error('Vous n\'avez pas la permission d\'éditer ce contact');
      return;
    }
    
    // If updating status, also check permission for the NEW status
    if (fieldName === 'statusId') {
      const newStatusId = value === '' || value === 'none' ? null : value;
      if (newStatusId && newStatusId !== contact.statusId) {
        // Create a temporary contact object with the new status to check permissions
        const tempContact = { ...contact, statusId: newStatusId };
        if (!canEditContact(tempContact)) {
          toast.error('Vous n\'avez pas la permission d\'éditer les contacts avec ce statut');
          return;
        }
      }
    }
    
    setIsSaving(true);
    try {
      const payload: any = {};
      
      // Map field names to API field names
      const fieldMap: { [key: string]: string } = {
        'statusId': 'statusId',
        'civility': 'civility',
        'firstName': 'firstName',
        'lastName': 'lastName',
        'email': 'email',
        'mobile': 'mobile',
        'phone': 'phone',
        'birthDate': 'birthDate',
        'nationality': 'nationality',
        'address': 'address',
        'addressComplement': 'addressComplement',
        'postalCode': 'postalCode',
        'city': 'city',
        'sourceId': 'sourceId',
        'campaign': 'campaign',
        'teleoperatorId': 'teleoperatorId',
        'confirmateurId': 'confirmateurId'
      };
      
      const apiFieldName = fieldMap[fieldName];
      if (apiFieldName) {
        payload[apiFieldName] = value === '' || value === 'none' ? null : value;
      }
      
      const response = await apiCall(`/api/contacts/${contactId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response?.contact) {
        // Update local contact state if onContactUpdated is provided
        if (onContactUpdated) {
          onContactUpdated();
        }
        if (onRefresh) {
          onRefresh();
        }
        setEditingField(null);
        toast.success('Champ mis à jour avec succès');
      }
    } catch (error: any) {
      console.error('Error updating field:', error);
      toast.error(error?.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(fieldName: string, currentValue: any) {
    if (!canEdit) return;
    setEditingField(fieldName);
    setFieldValue(currentValue || '');
  }

  function cancelEditing() {
    setEditingField(null);
    setFieldValue('');
  }

  function saveField(fieldName: string) {
    handleFieldUpdate(fieldName, fieldValue);
  }
  
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
                    className={`contact-appointment-card ${isPast ? 'past' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className={`contact-icon-calendar ${isPast ? 'past' : ''}`} />
                          <span className={`font-medium ${isPast ? 'contact-text-past' : ''}`}>
                            {datetime.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                          <Clock className={`contact-icon-clock ml-1 ${isPast ? 'past' : ''}`} />
                          <span className={isPast ? 'contact-text-past' : ''}>
                            {datetime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                        </div>
                        {apt.comment && (
                          <p className={`contact-text-comment ${isPast ? 'past' : ''}`}>
                            {apt.comment}
                          </p>
                        )}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={`contact-text-meta ${isPast ? 'past' : ''}`}>
                              {apt.created_at ? new Date(apt.created_at).toLocaleString('fr-FR', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : '-'}
                            </span>
                            {(apt.createdBy || apt.userId?.username || apt.user?.username) && (
                              <span className={`contact-text-meta ${isPast ? 'past' : ''}`}>
                                • {apt.createdBy || apt.userId?.username || apt.user?.username}
                              </span>
                            )}
                          </div>
                          {apt.assignedTo && (
                            <div className="flex items-center gap-2">
                              <span className={`contact-text-meta ${isPast ? 'past' : ''}`}>
                                Assigné à: <span className="font-medium">{apt.assignedTo}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {(canEditPlanning || canDeletePlanning) && (
                        <div className="flex gap-2 flex-shrink-0">
                          {canEditPlanning && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditAppointment(apt)}
                              className={`contact-tab-button-modify cursor-pointer text-slate-600 ${isPast ? 'past' : ''}`}
                            >
                              Modifier
                            </Button>
                          )}
                          {canDeletePlanning && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAppointment(apt.id)}
                              className={`contact-tab-button-delete text-red-600 cursor-pointer ${isPast ? 'past' : ''}`}
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
                className="contact-tab-button-save-note"
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
                .slice(0, showAllNotes ? notes.length : 3)
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
                         <span className="contact-note-text">{note.text}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNote(note.id)}
                      className="contact-tab-button-delete text-red-600 cursor-pointer flex-shrink-0"
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              ))}
              {notes.length > 3 && !showAllNotes && (
                <p 
                  className="text-xs text-slate-500 text-center pt-1 cursor-pointer hover:text-slate-700 hover:underline"
                  onClick={() => setShowAllNotes(true)}
                >
                  + {notes.length - 3} autre(s) note(s)
                </p>
              )}
              {showAllNotes && notes.length > 3 && (
                <p 
                  className="text-xs text-slate-500 text-center pt-1 cursor-pointer hover:text-slate-700 hover:underline"
                  onClick={() => setShowAllNotes(false)}
                >
                  Afficher moins
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 1. Informations générales */}
      <Card>
        <CardHeader>
          <CardTitle>1. Informations générales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-600">Statut</Label>
              {editingField === 'statusId' ? (
                <div className="contact-field-input-wrapper">
                  <Select
                    value={fieldValue || 'none'}
                    onValueChange={(value) => setFieldValue(value === 'none' ? '' : value)}
                    disabled={isSaving}
                  >
                    <SelectTrigger className="flex-1 h-10">
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {statuses
                        .filter((status) => {
                          if (!status.id || status.id.trim() === '') return false;
                          // Filter by view permissions
                          const normalizedStatusId = String(status.id).trim();
                          return statusViewPermissions.has(normalizedStatusId);
                        })
                        .map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            {status.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => saveField('statusId')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('statusId', contact.statusId)}
                >
                  <span 
                    className="contact-status-badge"
                    style={{
                      backgroundColor: contact.statusColor || '#e5e7eb',
                      color: contact.statusColor ? '#000000' : '#374151'
                    }}
                  >
                    {contact.statusName || '-'}
                  </span>
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Civilité</Label>
              {editingField === 'civility' ? (
                <div className="contact-field-input-wrapper">
                  <Select
                    value={fieldValue || 'none'}
                    onValueChange={(value) => setFieldValue(value === 'none' ? '' : value)}
                    disabled={isSaving}
                  >
                    <SelectTrigger className="flex-1 h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      <SelectItem value="Monsieur">Monsieur</SelectItem>
                      <SelectItem value="Madame">Madame</SelectItem>
                      <SelectItem value="Mademoiselle">Mademoiselle</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => saveField('civility')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('civility', contact.civility)}
                >
                  {contact.civility || '-'}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Prénom</Label>
              {editingField === 'firstName' ? (
                <div className="contact-field-input-wrapper">
                  <Input
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    disabled={isSaving}
                    className="flex-1 h-10"
                  />
                  <Button size="sm" onClick={() => saveField('firstName')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('firstName', contact.firstName)}
                >
                  {contact.firstName || '-'}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Nom</Label>
              {editingField === 'lastName' ? (
                <div className="contact-field-input-wrapper">
                  <Input
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    disabled={isSaving}
                    className="flex-1 h-10"
                  />
                  <Button size="sm" onClick={() => saveField('lastName')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('lastName', contact.lastName)}
                >
                  {contact.lastName || '-'}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Email</Label>
              {editingField === 'email' ? (
                <div className="contact-field-input-wrapper">
                  <Input
                    type="email"
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    disabled={isSaving}
                    className="flex-1 h-10"
                  />
                  <Button size="sm" onClick={() => saveField('email')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('email', contact.email)}
                >
                  {contact.email || '-'}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Portable</Label>
              {editingField === 'mobile' ? (
                <div className="contact-field-input-wrapper">
                  <Input
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    disabled={isSaving}
                    className="flex-1 h-10"
                  />
                  <Button size="sm" onClick={() => saveField('mobile')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('mobile', contact.mobile)}
                >
                  {contact.mobile || '-'}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Téléphone</Label>
              {editingField === 'phone' ? (
                <div className="contact-field-input-wrapper">
                  <Input
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    disabled={isSaving}
                    className="flex-1 h-10"
                  />
                  <Button size="sm" onClick={() => saveField('phone')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('phone', contact.phone)}
                >
                  {contact.phone || '-'}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Date de naissance</Label>
              {editingField === 'birthDate' ? (
                <div className="contact-field-input-wrapper">
                  <DateInput
                    value={fieldValue}
                    onChange={(value) => setFieldValue(value)}
                    disabled={isSaving}
                    className="flex-1 h-10"
                  />
                  <Button size="sm" onClick={() => saveField('birthDate')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('birthDate', contact.birthDate)}
                >
                  {(() => {
                    if (!contact.birthDate) return '-';
                    const date = new Date(contact.birthDate);
                    if (isNaN(date.getTime())) return '-';
                    return date.toLocaleDateString('fr-FR', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric'
                    });
                  })()}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Nationalité</Label>
              {editingField === 'nationality' ? (
                <div className="contact-field-input-wrapper">
                  <Input
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    disabled={isSaving}
                    className="flex-1 h-10"
                  />
                  <Button size="sm" onClick={() => saveField('nationality')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('nationality', contact.nationality)}
                >
                  {contact.nationality || '-'}
                </div>
              )}
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
              {editingField === 'address' ? (
                <div className="contact-field-input-wrapper">
                  <Input
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    disabled={isSaving}
                    className="flex-1 h-10"
                  />
                  <Button size="sm" onClick={() => saveField('address')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('address', contact.address)}
                >
                  {contact.address || '-'}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Complément d'adresse</Label>
              {editingField === 'addressComplement' ? (
                <div className="contact-field-input-wrapper">
                  <Input
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    disabled={isSaving}
                    className="flex-1 h-10"
                  />
                  <Button size="sm" onClick={() => saveField('addressComplement')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('addressComplement', contact.addressComplement)}
                >
                  {contact.addressComplement || '-'}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Code postal</Label>
              {editingField === 'postalCode' ? (
                <div className="contact-field-input-wrapper">
                  <Input
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    disabled={isSaving}
                    className="flex-1 h-10"
                  />
                  <Button size="sm" onClick={() => saveField('postalCode')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('postalCode', contact.postalCode)}
                >
                  {contact.postalCode || '-'}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Ville</Label>
              {editingField === 'city' ? (
                <div className="contact-field-input-wrapper">
                  <Input
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    disabled={isSaving}
                    className="flex-1 h-10"
                  />
                  <Button size="sm" onClick={() => saveField('city')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('city', contact.city)}
                >
                  {contact.city || '-'}
                </div>
              )}
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
              {editingField === 'sourceId' ? (
                <div className="contact-field-input-wrapper">
                  <Select
                    value={fieldValue || 'none'}
                    onValueChange={(value) => setFieldValue(value === 'none' ? '' : value)}
                    disabled={isSaving}
                  >
                    <SelectTrigger className="flex-1 h-10">
                      <SelectValue placeholder="Sélectionner une source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {sources
                        .filter((source) => source.id && source.id.trim() !== '')
                        .map((source) => (
                          <SelectItem key={source.id} value={source.id}>
                            {source.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => saveField('sourceId')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('sourceId', contact.sourceId)}
                >
                  {contact.source || '-'}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Campagne</Label>
              {editingField === 'campaign' ? (
                <div className="contact-field-input-wrapper">
                  <Input
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    disabled={isSaving}
                    className="flex-1 h-10"
                  />
                  <Button size="sm" onClick={() => saveField('campaign')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('campaign', contact.campaign)}
                >
                  {contact.campaign || '-'}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Téléopérateur</Label>
              {editingField === 'teleoperatorId' ? (
                <div className="contact-field-input-wrapper">
                  <Select
                    value={fieldValue || 'none'}
                    onValueChange={(value) => setFieldValue(value === 'none' ? '' : value)}
                    disabled={isSaving}
                  >
                    <SelectTrigger className="flex-1 h-10">
                      <SelectValue placeholder="Sélectionner un téléopérateur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {users
                        ?.filter((user) => user.id && user.id.trim() !== '' && user.isTeleoperateur === true)
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => saveField('teleoperatorId')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('teleoperatorId', contact.teleoperatorId)}
                >
                  {contact.teleoperatorName || contact.managerName || '-'}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Confirmateur</Label>
              {editingField === 'confirmateurId' ? (
                <div className="contact-field-input-wrapper">
                  <Select
                    value={fieldValue || 'none'}
                    onValueChange={(value) => setFieldValue(value === 'none' ? '' : value)}
                    disabled={isSaving}
                  >
                    <SelectTrigger className="flex-1 h-10">
                      <SelectValue placeholder="Sélectionner un confirmateur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {users
                        ?.filter((user) => user.id && user.id.trim() !== '' && user.isConfirmateur === true)
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => saveField('confirmateurId')} disabled={isSaving}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('confirmateurId', contact.confirmateurId)}
                >
                  {contact.confirmateurName || '-'}
                </div>
              )}
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


