import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { DateInput } from './ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Calendar, Clock, Send, X, Edit2, Check, Trash2 } from 'lucide-react';
// Permissions are now computed directly from currentUser.permissions for better performance
import { useUser } from '../contexts/UserContext';
import { useUsers } from '../hooks/useUsers';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { formatPhoneNumber, removePhoneSpaces, formatPhoneNumberAsYouType } from '../utils/phoneNumber';
import '../styles/Contacts.css';
import '../styles/Modal.css';
import '../styles/ContactTab.css';

interface Source {
  id: string;
  name: string;
}

interface NoteCategory {
  id: string;
  name: string;
  orderIndex: number;
}


interface NoteItemCompactProps {
  note: any;
  onDelete: (noteId: string) => void;
  onEdit: (noteId: string, newText: string) => Promise<void>;
  canEdit?: boolean;
  canDelete?: boolean;
}

const NoteItemCompact: React.FC<NoteItemCompactProps> = ({ note, onDelete, onEdit, canEdit = false, canDelete = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);
  const [isSaving, setIsSaving] = useState(false);
  
  const handleStartEdit = () => {
    setEditText(note.text);
    setIsEditing(true);
  };
  
  const handleCancelEdit = () => {
    setEditText(note.text);
    setIsEditing(false);
  };
  
  const handleSaveEdit = async () => {
    if (!editText.trim()) {
      toast.error('La note ne peut pas être vide');
      return;
    }
    
    if (editText.trim() === note.text) {
      setIsEditing(false);
      return;
    }
    
    setIsSaving(true);
    try {
      await onEdit(note.id, editText.trim());
      setIsEditing(false);
    } catch (error) {
      // Error handling is done in parent
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="resize-none text-sm"
                rows={3}
                disabled={isSaving}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="text-green-600 h-7 text-xs"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Enregistrer
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="text-slate-600 h-7 text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-shrink-0">
                {note.categoryName && (
                  <>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                      {note.categoryName}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                  </>
                )}
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
          )}
        </div>
        {!isEditing && (
          <div className="flex gap-1 flex-shrink-0">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartEdit}
                className="text-slate-600 cursor-pointer h-7 text-xs"
              >
                Modifier
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(note.id)}
                className="contact-tab-button-delete text-red-600 cursor-pointer h-7 text-xs"
              >
                Supprimer
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

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
  const { currentUser, loading: loadingUser } = useUser();
  
  // Memoize permission checks to avoid recalculating on every render
  const canEditGeneral = React.useMemo(() => {
    if (!currentUser?.permissions) return false;
    return currentUser.permissions.some((p: any) => 
      p.component === 'contacts' && p.action === 'edit' && !p.fieldName && !p.statusId
    );
  }, [currentUser?.permissions]);
  
  const canCreatePlanning = React.useMemo(() => {
    if (!currentUser?.permissions) return false;
    return currentUser.permissions.some((p: any) => 
      p.component === 'planning' && p.action === 'create' && !p.fieldName && !p.statusId
    );
  }, [currentUser?.permissions]);
  
  const canEditPlanning = React.useMemo(() => {
    if (!currentUser?.permissions) return false;
    return currentUser.permissions.some((p: any) => 
      p.component === 'planning' && p.action === 'edit' && !p.fieldName && !p.statusId
    );
  }, [currentUser?.permissions]);
  
  const canDeletePlanning = React.useMemo(() => {
    if (!currentUser?.permissions) return false;
    return currentUser.permissions.some((p: any) => 
      p.component === 'planning' && p.action === 'delete' && !p.fieldName && !p.statusId
    );
  }, [currentUser?.permissions]);
  
  // Load users for teleoperator and confirmateur selects
  const [users, setUsers] = React.useState<any[]>([]);
  const [usersLoaded, setUsersLoaded] = React.useState(false);
  
  const loadUsersIfNeeded = React.useCallback(async () => {
    if (usersLoaded) return;
    try {
      const response = await apiCall('/api/users/');
      const usersList = response?.users || response || [];
      setUsers(usersList);
      setUsersLoaded(true);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, [usersLoaded]);

  // Load users when component mounts (needed for teleoperator/confirmateur selects)
  React.useEffect(() => {
    loadUsersIfNeeded();
  }, [loadUsersIfNeeded]);
  
  // Get status permissions
  const statusEditPermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const editPerms = currentUser.permissions
      .filter((p: any) => {
        // Check for status-specific edit permissions
        // These have component='statuses', action='edit', and a statusId
        return p.component === 'statuses' && 
               p.action === 'edit' && 
               p.statusId !== null && 
               p.statusId !== undefined && 
               p.statusId !== '';
      })
      .map((p: any) => {
        const statusId = p.statusId;
        if (!statusId) return null;
        // Normalize statusId to string and trim whitespace
        const normalizedId = String(statusId).trim();
        return normalizedId !== '' ? normalizedId : null;
      })
      .filter((id): id is string => id !== null && id !== '');
    return new Set(editPerms);
  }, [currentUser?.permissions]);
  
  const statusViewPermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const viewPerms = currentUser.permissions
      .filter((p: any) => {
        // Check for status-specific view permissions
        // These have component='statuses', action='view', and a statusId
        return p.component === 'statuses' && 
               p.action === 'view' && 
               p.statusId !== null && 
               p.statusId !== undefined && 
               p.statusId !== '';
      })
      .map((p: any) => {
        const statusId = p.statusId;
        if (!statusId) return null;
        // Normalize statusId to string and trim whitespace
        const normalizedId = String(statusId).trim();
        return normalizedId !== '' ? normalizedId : null;
      })
      .filter((id): id is string => id !== null && id !== '');
    return new Set(viewPerms);
  }, [currentUser?.permissions]);

  // Helper function to check if user is confirmateur for a contact
  const isConfirmateurForContact = React.useCallback((contactData: any): boolean => {
    if (!currentUser?.id || !contactData?.confirmateurId) {
      return false;
    }
    const userId = String(currentUser.id).trim();
    const confirmateurId = String(contactData.confirmateurId).trim();
    return userId === confirmateurId;
  }, [currentUser?.id]);

  // Helper function to check if current user is the teleoperator for a contact
  const isTeleoperatorForContact = React.useCallback((contactData: any): boolean => {
    if (!currentUser?.id || !contactData?.teleoperatorId) {
      return false;
    }
    // Normalize both IDs to strings for comparison
    const userId = String(currentUser.id).trim();
    const teleoperatorId = String(contactData.teleoperatorId).trim();
    return userId === teleoperatorId;
  }, [currentUser?.id]);
  
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

  // Helper function to get status display text for a contact
  // The ONLY condition to see the status name is to have "view" permission for that status
  // If user doesn't have status view permission, show "Indisponible - [TYPE]"
  const getStatusDisplayText = React.useCallback((contactData: any): string => {
    const contactStatusId = contactData?.statusId;
    
    // Normalize statusId
    let normalizedStatusId: string | null = null;
    if (contactStatusId !== null && contactStatusId !== undefined && contactStatusId !== '') {
      const str = String(contactStatusId).trim();
      if (str !== '') {
        normalizedStatusId = str;
      }
    }
    
    // If contact has a status, check if user has permission to view it
    if (normalizedStatusId) {
      const hasStatusPermission = statusViewPermissions.has(normalizedStatusId);
      
      if (hasStatusPermission) {
        // User has permission, show actual status name
        return contactData.statusName || '-';
      } else {
        // User doesn't have permission, show masked message
        const status = statuses.find(s => s.id === normalizedStatusId);
        const statusType = status?.type;
        if (statusType === 'client') {
          return 'CLIENT EN COURS';
        } else if (statusType === 'lead') {
          return 'Indisponible - LEAD';
        } else {
          // Fallback if status type is unknown
          return 'Indisponible';
        }
      }
    }
    
    // Contact has no status, show status name (which should be empty/null)
    return contactData.statusName || '-';
  }, [statusViewPermissions, statuses]);
  
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
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false); // Start as false - don't block display
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [localNotes, setLocalNotes] = useState<any[]>(notes);
  
  // Sync local notes with props when they change
  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);
  
  // Get accessible category IDs based on view permissions (already available from currentUser.permissions)
  // Memoize to avoid recalculating on every render
  const accessibleCategoryIds = React.useMemo(() => {
    if (!currentUser?.permissions) return [];
    const categoryIds = currentUser.permissions
      .filter((p: any) => 
        p.component === 'note_categories' && 
        p.action === 'view' && 
        p.fieldName !== null &&
        !p.statusId
      )
      .map((p: any) => p.fieldName)
      .filter((id): id is string => id !== null);
    return Array.from(new Set(categoryIds));
  }, [currentUser?.permissions]);
  
  // Check if user has general view permission (can see all notes regardless of category)
  // This is available immediately from currentUser.permissions, no need to wait
  const hasGeneralViewPermission = React.useMemo(() => {
    return currentUser?.permissions?.some((p: any) => 
      p.component === 'note_categories' && 
      p.action === 'view' && 
      !p.fieldName && 
      !p.statusId
    ) || false;
  }, [currentUser?.permissions]);
  
  // Check if user has any view permissions (critical - needed to show notes)
  // This is available immediately from currentUser.permissions, no need to wait
  const hasAnyViewPermission = React.useMemo(() => {
    // If user has general permission, they can see all notes
    if (hasGeneralViewPermission) {
      return true;
    }
    // Otherwise check if they have any specific category view permissions
    return accessibleCategoryIds.length > 0;
  }, [hasGeneralViewPermission, accessibleCategoryIds]);
  
  // Filter categories to only show those user has view permission for
  const accessibleCategories = React.useMemo(() => {
    return categories.filter(cat => accessibleCategoryIds.includes(cat.id))
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [categories, accessibleCategoryIds]);
  
  // Pre-compute note permissions map for all notes to avoid calling hooks in NoteItemCompact
  const notePermissionsMap = React.useMemo(() => {
    if (!currentUser?.permissions) return new Map<string, { canEdit: boolean; canDelete: boolean }>();
    
    const map = new Map<string, { canEdit: boolean; canDelete: boolean }>();
    
    // Process all notes at once
    localNotes.forEach(note => {
      const noteCategoryId = note.categId || null;
      if (!noteCategoryId) {
        map.set(note.id, { canEdit: false, canDelete: false });
        return;
      }
      
      const canEdit = currentUser.permissions.some((p: any) => 
        p.component === 'note_categories' && 
        p.action === 'edit' && 
        p.fieldName === noteCategoryId &&
        !p.statusId
      );
      
      const canDelete = currentUser.permissions.some((p: any) => 
        p.component === 'note_categories' && 
        p.action === 'delete' && 
        p.fieldName === noteCategoryId &&
        !p.statusId
      );
      
      map.set(note.id, { canEdit, canDelete });
    });
    
    return map;
  }, [currentUser?.permissions, localNotes]);
  
  // Check create permission for selected category (lazy - only when needed)
  const canCreateInSelectedCategory = React.useMemo(() => {
    if (!currentUser?.permissions || !selectedCategoryId || selectedCategoryId === 'all') {
      return false;
    }
    return currentUser.permissions.some((p: any) => 
      p.component === 'note_categories' && 
      p.action === 'create' && 
      p.fieldName === selectedCategoryId &&
      !p.statusId
    );
  }, [currentUser?.permissions, selectedCategoryId]);
  
  // Load statuses, sources, and categories lazily (only when needed)
  // Categories are loaded separately and don't block notes display
  useEffect(() => {
    // Load categories separately - non-blocking for notes display
    loadCategories().catch(err => console.error('Error loading categories:', err));
    
    // Load statuses and sources (also non-blocking)
    Promise.all([
      loadStatuses(),
      loadSources()
    ]).catch(err => console.error('Error loading dropdown data:', err));
  }, []);

  useEffect(() => {
    // Update selected category if current selection is not accessible
    if (selectedCategoryId !== 'all' && !accessibleCategoryIds.includes(selectedCategoryId)) {
      if (accessibleCategories.length > 0) {
        setSelectedCategoryId(accessibleCategories[0].id);
      } else {
        setSelectedCategoryId('all');
      }
    } else if (selectedCategoryId === 'all' && accessibleCategories.length > 0) {
      setSelectedCategoryId(accessibleCategories[0].id);
    }
  }, [accessibleCategories, accessibleCategoryIds, selectedCategoryId]);

  async function loadCategories() {
    try {
      setLoadingCategories(true);
      const data = await apiCall('/api/note-categories/');
      const sortedCategories = (data.categories || []).sort((a: NoteCategory, b: NoteCategory) => 
        a.orderIndex - b.orderIndex
      );
      setCategories(sortedCategories);
    } catch (error: any) {
      console.error('Error loading categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  }

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

  // Load users when modals open (lazy loading)
  useEffect(() => {
    if (isAppointmentModalOpen || isEditAppointmentModalOpen) {
      loadUsersIfNeeded();
    }
  }, [isAppointmentModalOpen, isEditAppointmentModalOpen, loadUsersIfNeeded]);
  
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
    
    // If updating status, check permissions differently
    if (fieldName === 'statusId') {
      const newStatusId = value === '' || value === 'none' ? null : value;
      
      // If status is being changed, check permissions
      if (newStatusId !== contact.statusId) {
        // Check if user has EDIT permission for CURRENT status (to allow changing it)
        if (contact.statusId && !canEditContact(contact)) {
          toast.error('Vous n\'avez pas la permission de modifier le statut de ce contact');
          return;
        }
        
        // Check if user has VIEW permission for NEW status (to allow assigning it)
        if (newStatusId) {
          const normalizedNewStatusId = String(newStatusId).trim();
          if (!statusViewPermissions.has(normalizedNewStatusId)) {
            toast.error('Vous n\'avez pas la permission d\'assigner ce statut');
            return;
          }
        }
      } else {
        // Status not changing, just check if user can edit this contact
        if (!canEditContact(contact)) {
          toast.error('Vous n\'avez pas la permission d\'éditer ce contact');
          return;
        }
      }
    } else {
      // For other fields, check if user has permission to edit this contact with CURRENT status
      if (!canEditContact(contact)) {
        toast.error('Vous n\'avez pas la permission d\'éditer ce contact');
        return;
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
        // Remove spaces from phone numbers before sending to backend
        if (fieldName === 'phone' || fieldName === 'mobile') {
          // Ensure we remove all spaces - convert to string first, then remove spaces
          const cleanedValue = value === '' || value === 'none' ? '' : removePhoneSpaces(String(value));
          payload[apiFieldName] = cleanedValue === '' ? null : cleanedValue;
        } else {
          payload[apiFieldName] = value === '' || value === 'none' ? null : value;
        }
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
        
        // Notify parent window (contact list) about the update
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage({
              type: 'CONTACT_UPDATED',
              contactId: contactId,
              contact: response.contact
            }, window.location.origin);
          } catch (error) {
            console.warn('Could not send message to parent window:', error);
          }
        }
        
        setEditingField(null);
        toast.success('Champ mis à jour avec succès');
      }
    } catch (error: any) {
      console.error('Error updating field:', error);
      // Extract error message from API response
      const errorMessage = error?.response?.error || error?.response?.detail || error?.message || 'Erreur lors de la mise à jour';
      console.error('Error details:', error?.response);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(fieldName: string, currentValue: any) {
    if (!canEdit) return;
    setEditingField(fieldName);
    // For phone numbers, show the raw value without spaces when editing
    // (spaces are only for display, not for editing)
    if (fieldName === 'phone' || fieldName === 'mobile') {
      setFieldValue(removePhoneSpaces(currentValue) || '');
    } else {
      setFieldValue(currentValue || '');
    }
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
    const noteTextValue = noteText.trim();
    setNoteText(''); // Clear input immediately for better UX
    
    try {
      const payload: any = {
        text: noteTextValue,
        contactId: contactId,
      };
      
      // Add category if selected (not 'all')
      if (selectedCategoryId && selectedCategoryId !== 'all') {
        payload.categId = selectedCategoryId;
      }
      
      const response = await apiCall('/api/notes/create/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      // Get the created note from response
      const createdNote = response.note || response;
      
      // Add category name if we have the category info
      if (createdNote.categId && !createdNote.categoryName) {
        const category = accessibleCategories.find(cat => cat.id === createdNote.categId);
        if (category) {
          createdNote.categoryName = category.name;
        }
      }
      
      // Add current user info if not present
      if (!createdNote.createdBy && !createdNote.userId) {
        // We'll get this from the refresh, but add a placeholder for immediate display
        createdNote.createdBy = 'Vous';
      }
      
      // Add the note immediately to local state
      setLocalNotes(prev => [createdNote, ...prev]);
      
      toast.success('Note créée avec succès');
      
      // Refresh in background to get full data
      onRefresh();
    } catch (error: any) {
      // Restore note text on error
      setNoteText(noteTextValue);
      console.error('Error creating note:', error);
      const errorMessage = error?.response?.detail || error?.message || 'Erreur lors de la création de la note';
      toast.error(errorMessage);
    } finally {
      setIsSubmittingNote(false);
    }
  }

  async function handleEditNote(noteId: string, newText: string) {
    try {
      const response = await apiCall(`/api/notes/${noteId}/update/`, {
        method: 'PATCH',
        body: JSON.stringify({ text: newText }),
      });
      
      // Update local state immediately
      setLocalNotes(prev => prev.map(note => 
        note.id === noteId ? { ...note, text: newText, ...response } : note
      ));
      
      toast.success('Note modifiée avec succès');
      // Refresh in background to sync
      onRefresh();
    } catch (error: any) {
      console.error('Error editing note:', error);
      const errorMessage = error?.response?.detail || error?.message || 'Erreur lors de la modification de la note';
      toast.error(errorMessage);
      throw error;
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm('Supprimer cette note ?')) return;
    
    // Optimistically remove from local state
    setLocalNotes(prev => prev.filter(note => note.id !== noteId));
    
    try {
      await apiCall(`/api/notes/delete/${noteId}/`, { method: 'DELETE' });
      toast.success('Note supprimée avec succès');
      // Refresh in background to sync
      onRefresh();
    } catch (error) {
      // Restore note on error
      onRefresh();
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
          {/* Show loading indicator only while user is loading AND we don't have permissions yet */}
          {loadingUser && !currentUser?.permissions ? (
            <p className="text-sm text-slate-500 text-center py-4">Chargement...</p>
          ) : (
            <>
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Notes - Compact */}
      {/* Always show Notes component */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Notes</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* Show notes immediately if user has view permissions - don't wait for categories */}
          {/* Only show loading if user is actually loading AND we don't have permissions yet */}
          {loadingUser && !currentUser?.permissions ? (
            <p className="text-sm text-slate-500 text-center py-4">Chargement...</p>
          ) : !hasAnyViewPermission ? (
            <p className="text-sm text-slate-500 text-center py-4">Aucune permission pour voir les notes</p>
          ) : (
            <>
              {/* Show category tabs only if categories are loaded and user has access */}
              {loadingCategories ? (
                <p className="text-xs text-slate-400 text-center py-2">Chargement des catégories...</p>
              ) : accessibleCategories.length > 0 ? (
                <Tabs value={selectedCategoryId} onValueChange={setSelectedCategoryId} className="mb-2">
                  <TabsList className="h-8">
                    {accessibleCategories.map((category) => (
                      <TabsTrigger key={category.id} value={category.id} className="text-xs px-2 py-1">
                        {category.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              ) : null}
          
          {/* Show form only if user has create permission (checked lazily, already available) */}
          {canCreateInSelectedCategory && (
            <form onSubmit={handleCreateNote} className="space-y-2">
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
          )}
          
          {/* Show notes list */}
          {(() => {
                // Filter notes by selected category and view permissions
                let filteredNotes = localNotes;
                
                // Filter by selected category
                if (selectedCategoryId !== 'all') {
                  filteredNotes = filteredNotes.filter(note => note.categId === selectedCategoryId);
                }
                
                // Filter to only show notes from categories user has view permission for
                filteredNotes = filteredNotes.filter(note => {
                  // If user has general view permission, show all notes
                  if (hasGeneralViewPermission) {
                    return true;
                  }
                  // If note has no category, show it (null category notes are accessible)
                  if (!note.categId) {
                    return true;
                  }
                  // Only show if user has view permission for this category
                  return accessibleCategoryIds.includes(note.categId);
                });
                
                return filteredNotes.length > 0 ? (
                  <div className="space-y-2 pt-2">
                    {[...filteredNotes]
                      .sort((a, b) => {
                        const dateA = new Date(a.createdAt || a.created_at).getTime();
                        const dateB = new Date(b.createdAt || b.created_at).getTime();
                        return dateB - dateA; // Descending order (most recent first)
                      })
                      .slice(0, showAllNotes ? filteredNotes.length : 3)
                      .map((note) => {
                        const permissions = notePermissionsMap.get(note.id) || { canEdit: false, canDelete: false };
                        return (
                          <NoteItemCompact 
                            key={note.id}
                            note={note}
                            onDelete={handleDeleteNote}
                            onEdit={handleEditNote}
                            canEdit={permissions.canEdit}
                            canDelete={permissions.canDelete}
                          />
                        );
                      })}
                    {filteredNotes.length > 3 && !showAllNotes && (
                      <p 
                        className="text-xs text-slate-500 text-center pt-1 cursor-pointer hover:text-slate-700 hover:underline"
                        onClick={() => setShowAllNotes(true)}
                      >
                        + {filteredNotes.length - 3} autre(s) note(s)
                      </p>
                    )}
                    {showAllNotes && filteredNotes.length > 3 && (
                      <p 
                        className="text-xs text-slate-500 text-center pt-1 cursor-pointer hover:text-slate-700 hover:underline"
                        onClick={() => setShowAllNotes(false)}
                      >
                        Afficher moins
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Aucune note dans cette catégorie
                  </p>
                );
              })()}
            </>
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
                      <SelectItem value="none">
                        <span className="inline-block px-2 py-1 rounded text-sm">Aucun</span>
                      </SelectItem>
                      {statuses
                        .filter((status) => {
                          if (!status.id || status.id.trim() === '') return false;
                          // Filter by view permissions
                          const normalizedStatusId = String(status.id).trim();
                          return statusViewPermissions.has(normalizedStatusId);
                        })
                        .map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            <span 
                              className="inline-block px-2 py-1 rounded text-sm"
                              style={{
                                backgroundColor: status.color || '#e5e7eb',
                                color: status.color ? '#000000' : '#374151'
                              }}
                            >
                              {status.name}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    size="sm" 
                    onClick={() => saveField('statusId')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => {
                    // Only allow editing if user has permission or is teleoperator with status permission
                    const isTeleoperator = isTeleoperatorForContact(contact);
                    const contactStatusId = contact?.statusId;
                    let normalizedStatusId: string | null = null;
                    if (contactStatusId !== null && contactStatusId !== undefined && contactStatusId !== '') {
                      const str = String(contactStatusId).trim();
                      if (str !== '') {
                        normalizedStatusId = str;
                      }
                    }
                    // User can change status if they have EDIT permission for the CURRENT status
                    // (They can assign any status they can VIEW, but need EDIT permission for current to change it)
                    if (canEdit && canEditContact(contact)) {
                      startEditing('statusId', contact.statusId);
                    }
                  }}
                >
                  {(() => {
                    const statusText = getStatusDisplayText(contact);
                    const isMaskedStatus = statusText === 'CLIENT EN COURS' || statusText.startsWith('Indisponible');
                    const statusBgColor = statusText === 'CLIENT EN COURS' ? '#22c55e' : (isMaskedStatus ? '#e5e7eb' : (contact.statusColor || '#e5e7eb'));
                    const statusTextColor = statusText === 'CLIENT EN COURS' ? '#ffffff' : (isMaskedStatus ? '#374151' : (contact.statusColor ? '#000000' : '#374151'));
                    
                    return (
                      <span 
                        className="contact-status-badge"
                        style={{
                          backgroundColor: statusBgColor,
                          color: statusTextColor
                        }}
                      >
                        {statusText}
                      </span>
                    );
                  })()}
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
                  <Button 
                    size="sm" 
                    onClick={() => saveField('civility')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
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
                  <Button 
                    size="sm" 
                    onClick={() => saveField('firstName')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
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
                  <Button 
                    size="sm" 
                    onClick={() => saveField('lastName')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
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
                  <Button 
                    size="sm" 
                    onClick={() => saveField('email')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
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
                    onChange={(e) => {
                      // Remove spaces as user types - keep it without spaces for editing
                      setFieldValue(removePhoneSpaces(e.target.value));
                    }}
                    disabled={isSaving}
                    className="flex-1 h-10"
                    type="number"
                  />
                  <Button 
                    size="sm" 
                    onClick={() => saveField('mobile')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('mobile', contact.mobile)}
                >
                  {formatPhoneNumber(contact.mobile) || '-'}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Téléphone</Label>
              {editingField === 'phone' ? (
                <div className="contact-field-input-wrapper">
                  <Input
                    value={fieldValue}
                    onChange={(e) => {
                      // Remove spaces as user types - keep it without spaces for editing
                      setFieldValue(removePhoneSpaces(e.target.value));
                    }}
                    disabled={isSaving}
                    className="flex-1 h-10"
                    type="number"
                  />
                  <Button 
                    size="sm" 
                    onClick={() => saveField('phone')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => startEditing('phone', contact.phone)}
                >
                  {formatPhoneNumber(contact.phone) || '-'}
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
                  <Button 
                    size="sm" 
                    onClick={() => saveField('birthDate')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
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
                  <Button 
                    size="sm" 
                    onClick={() => saveField('nationality')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
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
                  <Button 
                    size="sm" 
                    onClick={() => saveField('address')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
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
                  <Button 
                    size="sm" 
                    onClick={() => saveField('addressComplement')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
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
                  <Button 
                    size="sm" 
                    onClick={() => saveField('postalCode')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
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
                  <Button 
                    size="sm" 
                    onClick={() => saveField('city')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
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
                  <Button 
                    size="sm" 
                    onClick={() => saveField('sourceId')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
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
                  <Button 
                    size="sm" 
                    onClick={() => saveField('campaign')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
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
                      <SelectItem value="none">Aucun téléopérateur</SelectItem>
                      {users
                        ?.filter((user) => user.id && user.id.trim() !== '' && user.isTeleoperateur === true)
                        .map((user) => {
                          const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                          return (
                            <SelectItem key={user.id} value={user.id}>
                              {displayName}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  <Button 
                    size="sm" 
                    onClick={() => saveField('teleoperatorId')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => {
                    if (canEdit && canEditContact(contact)) {
                      startEditing('teleoperatorId', contact.teleoperatorId || contact.managerId);
                    }
                  }}
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
                      <SelectItem value="none">Aucun confirmateur</SelectItem>
                      {users
                        ?.filter((user) => user.id && user.id.trim() !== '' && user.isConfirmateur === true)
                        .map((user) => {
                          const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                          return (
                            <SelectItem key={user.id} value={user.id}>
                              {displayName}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  <Button 
                    size="sm" 
                    onClick={() => saveField('confirmateurId')} 
                    disabled={isSaving}
                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                    onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                    onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                  >
                    Enregistrer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>✕</Button>
                </div>
              ) : (
                <div 
                  className={`contact-field-display ${canEdit ? 'editable' : ''}`}
                  onClick={() => {
                    if (canEdit && canEditContact(contact)) {
                      startEditing('confirmateurId', contact.confirmateurId);
                    }
                  }}
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


