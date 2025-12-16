import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { DateInput } from './ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Checkbox } from './ui/checkbox';
import { Plus, Calendar, Clock, Send, X, Edit2, Check, Trash2, Star, Upload, CheckCircle2 } from 'lucide-react';
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

interface Platform {
  id: string;
  name: string;
}

interface Document {
  id: string;
  contactId: string;
  documentType: string;
  hasDocument: boolean;
  fileUrl: string;
  fileName: string;
  uploadedAt: string;
  updatedAt: string;
  uploadedById?: number;
  uploadedByName?: string;
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
    <div className="text-sm" style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
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
        <div style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
          {/* Note Content */}
          <div className="mb-2">
            <span className="contact-note-text" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', display: 'block', minWidth: 0 }}>{note.text}</span>
          </div>
          {/* Date, Creator and Edit/Delete Buttons */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Date and Creator on the left */}
            <div className="flex items-center gap-2 flex-wrap">
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
                <>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-500">
                    {note.createdBy || note.userId?.username || note.user?.username}
                  </span>
                </>
              )}
            </div>
            {/* Edit/Delete Buttons on the right */}
            {(canEdit || canDelete) && (
              <div className="flex gap-1 flex-shrink-0 p-0 m-0">
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleStartEdit}
                    className="text-slate-600 cursor-pointer h-7 text-xs p-0"
                  >
                    Modifier
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(note.id)}
                    className="contact-tab-button-delete text-red-600 cursor-pointer h-7 text-xs p-0"
                  >
                    Supprimer
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
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
  loadingEvents?: boolean;
  loadingMoreEvents?: boolean;
  hasMoreEvents?: boolean;
  onLoadMoreEvents?: () => void;
}

export function ContactInfoTab({ 
  contact, 
  onContactUpdated,
  appointments = [],
  notes = [],
  contactId = '',
  onRefresh = () => {},
  loadingEvents = false,
  loadingMoreEvents = false,
  hasMoreEvents = false,
  onLoadMoreEvents = () => {}
}: ContactInfoTabProps) {
  const { currentUser, loading: loadingUser } = useUser();
  
  // State for limiting displayed events per column
  const [pastEventsLimit, setPastEventsLimit] = useState(3);
  const [futureEventsLimit, setFutureEventsLimit] = useState(3);
  
  // Reset limits when appointments change (e.g., when contact changes)
  useEffect(() => {
    setPastEventsLimit(3);
    setFutureEventsLimit(3);
  }, [contactId]);
  
  // Permission checks for informations tab - use contact_tabs permissions
  const canCreateInformationsTab = React.useMemo(() => {
    if (!currentUser?.permissions) return false;
    const hasTabPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs' && 
      p.action === 'create' && 
      p.fieldName === 'informations' &&
      !p.statusId
    );
    // If no contact_tabs permissions exist at all, default to true (backward compatibility)
    const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs'
    );
    if (!hasAnyContactTabsPermission) return true;
    return hasTabPermission;
  }, [currentUser?.permissions]);

  // Check if user has permission to edit informations tab (replaces old contacts edit permission)
  const canEditInformationsTab = React.useMemo(() => {
    if (!currentUser?.permissions) return false;
    // Check if user has permission to edit informations tab
    const hasTabPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs' && 
      p.action === 'edit' && 
      p.fieldName === 'informations' &&
      !p.statusId
    );
    // If no contact_tabs permissions exist at all, default to true (backward compatibility)
    const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs'
    );
    if (!hasAnyContactTabsPermission) return true;
    return hasTabPermission;
  }, [currentUser?.permissions]);

  const canDeleteInformationsTab = React.useMemo(() => {
    if (!currentUser?.permissions) return false;
    const hasTabPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs' && 
      p.action === 'delete' && 
      p.fieldName === 'informations' &&
      !p.statusId
    );
    // If no contact_tabs permissions exist at all, default to true (backward compatibility)
    const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs'
    );
    if (!hasAnyContactTabsPermission) return true;
    return hasTabPermission;
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

  // Fosse-specific status view permissions - use fosse_statuses component
  const fosseStatusViewPermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const viewPerms = currentUser.permissions
      .filter((p: any) => {
        // Check for fosse-specific status view permissions
        // These have component='fosse_statuses', action='view', and a statusId
        return p.component === 'fosse_statuses' && 
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

  // Helper function to check if contact is in fosse (teleoperator and confirmateur are null/empty)
  const isContactInFosse = React.useCallback((contactData: any): boolean => {
    if (!contactData) return false;
    const teleoperatorId = contactData.teleoperatorId || contactData.teleoperator || '';
    const confirmateurId = contactData.confirmateurId || contactData.confirmateur || '';
    return (!teleoperatorId || String(teleoperatorId).trim() === '') && 
           (!confirmateurId || String(confirmateurId).trim() === '');
  }, []);

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
  
  // Helper function to check if user can edit this contact
  // User needs:
  // 1. Permission to edit informations tab (contact_tabs edit for informations)
  // 2. Status-specific edit permission for the contact's status (if status exists)
  const canEditContact = React.useCallback((contactData: any): boolean => {
    // First check: user must have permission to edit informations tab
    if (!canEditInformationsTab) {
      return false;
    }
    
    const contactStatusId = contactData?.statusId;
    
    // Normalize statusId to string for comparison
    const normalizedStatusId = contactStatusId ? String(contactStatusId).trim() : null;
    
    // If contact has no status, only need tab permission (already checked above)
    if (!normalizedStatusId) {
      return true;
    }
    
    // If contact has a status, user MUST have status-specific edit permission
    const canEditStatus = statusEditPermissions.has(normalizedStatusId);
    
    return canEditStatus;
  }, [canEditInformationsTab, statusEditPermissions]);
  
  // Use canEditContact for the current contact
  // Recalculate when contact changes
  const canEdit = React.useMemo(() => {
    return canEditContact(contact);
  }, [contact, canEditContact]);

  // Map frontend field names to backend field names for fiche_contact permissions
  const fieldNameMap: { [key: string]: string } = {
    'civility': 'civility',
    'firstName': 'fname',
    'lastName': 'lname',
    'phone': 'phone',
    'mobile': 'mobile',
    'email': 'email',
    'birthDate': 'birth_date',
    'birthPlace': 'birth_place',
    'address': 'address',
    'addressComplement': 'address_complement',
    'postalCode': 'postal_code',
    'city': 'city',
    'nationality': 'nationality',
    'campaign': 'campaign',
    'statusId': 'status',
    'sourceId': 'source',
    'teleoperatorId': 'teleoperator',
    'confirmateurId': 'confirmateur',
    'platformId': 'platform',
    'montantEncaisse': 'montant_encaisse',
    'bonus': 'bonus',
    'paiement': 'paiement',
    'contrat': 'contrat',
    'nomDeScene': 'nom_de_scene',
    'dateProTr': 'date_pro_tr',
    'potentiel': 'potentiel',
    'produit': 'produit',
    'confirmateurEmail': 'confirmateur_email',
    'confirmateurTelephone': 'confirmateur_telephone',
  };

  // Helper function to check if user has view permission for a specific field
  const canViewField = React.useCallback((fieldName: string): boolean => {
    if (!currentUser?.permissions) return true; // Default to visible if no permissions loaded
    
    const backendFieldName = fieldNameMap[fieldName];
    if (!backendFieldName) return true; // Unknown field, default to visible
    
    // Get all fiche_contact view permissions for this user
    const ficheContactViewPermissions = currentUser.permissions.filter((p: any) => 
      p.component === 'fiche_contact' && 
      p.action === 'view' &&
      !p.statusId
    );
    
    // If no fiche_contact view permissions exist at all, check if user can view informations tab
    if (ficheContactViewPermissions.length === 0) {
      const canViewInformationsTab = currentUser.permissions.some((p: any) => 
        p.component === 'contact_tabs' && 
        p.action === 'view' && 
        p.fieldName === 'informations' &&
        !p.statusId
      );
      // If no contact_tabs permissions exist at all, default to true (backward compatibility)
      const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
        p.component === 'contact_tabs'
      );
      if (!hasAnyContactTabsPermission) return true;
      return canViewInformationsTab;
    }
    
    // Check for field-level view permission for this specific field
    const hasFieldPermission = ficheContactViewPermissions.some((p: any) => 
      p.fieldName === backendFieldName
    );
    
    // If user has field-level permission, use it
    if (hasFieldPermission) return true;
    
    // Check if there's a general fiche_contact view permission (no fieldName)
    const hasGeneralFicheContactPermission = ficheContactViewPermissions.some((p: any) => 
      !p.fieldName
    );
    
    // If general fiche_contact permission exists, allow viewing all fields
    if (hasGeneralFicheContactPermission) return true;
    
    // If field-specific view permissions exist (with fieldName set) but NOT for this field,
    // this means the field is explicitly restricted - hide it
    const hasFieldSpecificPermissions = ficheContactViewPermissions.some((p: any) => 
      p.fieldName !== null && p.fieldName !== undefined && p.fieldName !== ''
    );
    
    if (hasFieldSpecificPermissions && !hasFieldPermission) {
      // Field-specific view permissions are configured, but this field doesn't have permission
      return false;
    }
    
    // Fallback: if we have fiche_contact permissions but unclear state, check informations tab view permission
    const canViewInformationsTab = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs' && 
      p.action === 'view' && 
      p.fieldName === 'informations' &&
      !p.statusId
    );
    // If no contact_tabs permissions exist at all, default to true (backward compatibility)
    const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs'
    );
    if (!hasAnyContactTabsPermission) return true;
    return canViewInformationsTab;
  }, [currentUser?.permissions]);

  // Helper function to check if user has edit permission for a specific field
  const canEditField = React.useCallback((fieldName: string): boolean => {
    console.log(`[canEditField ${fieldName}] Starting check`);
    
    if (!currentUser?.permissions) {
      console.log(`[canEditField ${fieldName}] No permissions, returning false`);
      return false;
    }
    
    // FIRST: User MUST have permission to edit the informations tab
    // If they don't have edit permission on the tab, they cannot edit any fields
    if (!canEditInformationsTab) {
      console.log(`[canEditField ${fieldName}] User cannot edit informations tab, blocking all field edits`);
      return false;
    }
    
    // SECOND: User MUST have permission to edit the contact's current status
    // If they don't have edit permission on the status, they cannot edit any fields
    const canEditCurrentStatus = canEditContact(contact);
    if (!canEditCurrentStatus) {
      console.log(`[canEditField ${fieldName}] User cannot edit contact's current status, blocking all field edits`);
      return false;
    }
    
    const backendFieldName = fieldNameMap[fieldName];
    console.log(`[canEditField ${fieldName}] Field mapping: ${fieldName} -> ${backendFieldName}`);
    if (!backendFieldName) {
      console.log(`[canEditField ${fieldName}] Unknown field, returning false`);
      return false; // Unknown field, default to no edit
    }
    
    // Get all fiche_contact edit permissions for this user
    const ficheContactEditPermissions = currentUser.permissions.filter((p: any) => 
      p.component === 'fiche_contact' && 
      p.action === 'edit' &&
      !p.statusId
    );
    
    console.log(`[canEditField ${fieldName}] Found ${ficheContactEditPermissions.length} fiche_contact edit permissions:`, 
      ficheContactEditPermissions.map((p: any) => ({ 
        id: p.id, 
        component: p.component, 
        fieldName: p.fieldName, 
        action: p.action,
        fieldNameType: typeof p.fieldName
      }))
    );
    
    // THIRD: Check if user has field-specific edit permission for this field
    const hasFieldPermission = ficheContactEditPermissions.some((p: any) => {
      const pFieldName = p.fieldName ? String(p.fieldName).trim() : null;
      const expectedFieldName = String(backendFieldName).trim();
      const matches = pFieldName === expectedFieldName;
      console.log(`[canEditField ${fieldName}] Comparing: "${pFieldName}" === "${expectedFieldName}" = ${matches}`);
      return matches;
    });
    
    if (hasFieldPermission) {
      console.log(`[canEditField ${fieldName}] Has field-specific permission AND can edit informations tab and status, allowing edit`);
      return true;
    }
    
    // FOURTH: If no field-specific permission exists, check if general fiche_contact edit permission exists
    // If no fiche_contact edit permissions exist at all, allow edit (user has tab permission and status permission)
    if (ficheContactEditPermissions.length === 0) {
      console.log(`[canEditField ${fieldName}] No fiche_contact permissions, user can edit tab and status, allowing edit`);
      return true;
    }
    
    // If fiche_contact permissions exist but this field doesn't have permission, block it
    console.log(`[canEditField ${fieldName}] Field-specific permissions exist but not for this field, blocking`);
    return false;
  }, [currentUser?.permissions, contact, canEditContact, canEditInformationsTab]);

  // Helper function to check if user has edit permission for a specific field in modal context
  // In modal, we check if user can edit the informations tab AND (can edit current status OR has view permission on new status)
  const canEditFieldInModal = React.useCallback((fieldName: string, newStatusId?: string | null): boolean => {
    if (!currentUser?.permissions) {
      return false;
    }
    
    // FIRST: User MUST have permission to edit the informations tab
    if (!canEditInformationsTab) {
      return false;
    }
    
    // SECOND: Check if user can edit the contact (current status) OR has view permission on new status
    const canEditCurrentStatus = canEditContact(contact);
    const hasViewOnNewStatus = newStatusId ? statusViewPermissions.has(String(newStatusId).trim()) : false;
    
    if (!canEditCurrentStatus && !hasViewOnNewStatus) {
      return false;
    }
    
    const backendFieldName = fieldNameMap[fieldName];
    if (!backendFieldName) {
      return false; // Unknown field, default to no edit
    }
    
    // Get all fiche_contact edit permissions for this user
    const ficheContactEditPermissions = currentUser.permissions.filter((p: any) => 
      p.component === 'fiche_contact' && 
      p.action === 'edit' &&
      !p.statusId
    );
    
    // Check if user has field-specific edit permission for this field
    const hasFieldPermission = ficheContactEditPermissions.some((p: any) => {
      const pFieldName = p.fieldName ? String(p.fieldName).trim() : null;
      const expectedFieldName = String(backendFieldName).trim();
      return pFieldName === expectedFieldName;
    });
    
    if (hasFieldPermission) {
      return true;
    }
    
    // If no field-specific permission exists, check general contact edit permission
    // If no fiche_contact edit permissions exist at all, fallback to general contact edit permission
    if (ficheContactEditPermissions.length === 0) {
      return true;
    }
    
    // If fiche_contact permissions exist but this field doesn't have permission, block it
    return false;
  }, [currentUser?.permissions, contact, canEditContact, statusViewPermissions, canEditInformationsTab]);
  
  // Statuses, sources, platforms, and documents
  const [statuses, setStatuses] = useState<any[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploadingDocument, setUploadingDocument] = useState<string | null>(null);
  const cniUploadRef = useRef<HTMLInputElement>(null);
  const justifUploadRef = useRef<HTMLInputElement>(null);
  const selfieUploadRef = useRef<HTMLInputElement>(null);
  const ribUploadRef = useRef<HTMLInputElement>(null);

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
  const editingFieldRef = useRef<HTMLDivElement>(null);
  const cancelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [statusChangeNote, setStatusChangeNote] = useState('');
  const [statusChangeNoteCategoryId, setStatusChangeNoteCategoryId] = useState<string>('');
  const [statusModalFilterType, setStatusModalFilterType] = useState<'lead' | 'client'>('lead');
  // Event fields for status with is_event=true
  const [eventDate, setEventDate] = useState('');
  const [eventHour, setEventHour] = useState('');
  const [eventMinute, setEventMinute] = useState('');
  const [eventTeleoperatorId, setEventTeleoperatorId] = useState('');
  
  // Check if selected status is client default
  const selectedStatusIsClientDefault = React.useMemo(() => {
    if (!selectedStatusId || selectedStatusId === '') return false;
    const status = statuses.find(s => s.id === selectedStatusId);
    return status?.clientDefault === true;
  }, [selectedStatusId, statuses]);
  
  const [clientFormData, setClientFormData] = useState({
    platformId: '',
    teleoperatorId: '',
    nomDeScene: '',
    firstName: '',
    lastName: '',
    emailClient: '',
    telephoneClient: '',
    portableClient: '',
    contrat: '',
    sourceId: '',
    montantEncaisse: '',
    bonus: '',
    paiement: '',
    noteGestionnaire: '',
    noteCategoryId: ''
  });
  const [selectedNoteCategoryId, setSelectedNoteCategoryId] = useState<string>('');
  const [isSavingClientForm, setIsSavingClientForm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  
  // Check if note is required for status change
  const requiresNoteForStatusChange = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return false;
    }
    return currentUser.permissions.some((perm: any) => {
      return perm.component === 'other' && 
             perm.action === 'edit' && 
             perm.fieldName === 'status_change_note_required' &&
             !perm.statusId;
    });
  }, [currentUser?.permissions]);
  
  // Initialize event fields when event status is selected
  React.useEffect(() => {
    if (isStatusModalOpen && selectedStatusId) {
      // Use String() to ensure consistent type comparison
      const selectedStatus = statuses.find(s => String(s.id) === String(selectedStatusId));
      // Check both isEvent (camelCase) and is_event (snake_case) for compatibility
      const isEventStatus = selectedStatus && (selectedStatus.isEvent === true || selectedStatus.is_event === true);
      if (isEventStatus && canCreatePlanning && canCreateInformationsTab && !eventDate) {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        setEventDate(dateStr);
        // Don't pre-fill hour and minute - leave them empty
        setEventHour('');
        setEventMinute('');
        // Prefill teleoperatorId with current user if they are a teleoperateur, otherwise use contact's teleoperator
        if (contact) {
          const defaultTeleoperatorId = currentUser?.isTeleoperateur === true 
            ? currentUser.id 
            : (contact.teleoperatorId || contact.managerId || '');
          setEventTeleoperatorId(defaultTeleoperatorId);
        }
      } else if (!isEventStatus) {
        // Reset event fields if status is not an event status
        setEventDate('');
        setEventHour('');
        setEventMinute('');
        setEventTeleoperatorId('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatusId, isStatusModalOpen]);
  
  // Auto-set filter based on contact's current status
  React.useEffect(() => {
    if (isStatusModalOpen && statuses.length > 0 && contact) {
      // First, check the contact's current status type
      const currentStatus = contact.statusId ? statuses.find((s: any) => s.id === contact.statusId) : null;
      
      if (currentStatus && (currentStatus.type === 'client' || currentStatus.type === 'lead')) {
        // Set filter to match contact's current status type
        if (statusModalFilterType !== currentStatus.type) {
          setStatusModalFilterType(currentStatus.type);
        }
        return; // Don't override if contact has a status
      }
      
      // If contact has no status or status type is unknown, check user permissions
      const clientStatuses = statuses.filter((s: any) => s.type === 'client');
      const clientDefaultStatus = clientStatuses.find((s: any) => s.clientDefault === true);
      const clientStatusesWithPermission = clientStatuses.filter((status: any) => {
        if (!status.id || status.id.trim() === '') return false;
        const normalizedStatusId = String(status.id).trim();
        return statusViewPermissions.has(normalizedStatusId);
      });
      
      // If user has no permission on any client status, set filter to lead
      if (clientStatusesWithPermission.length === 0 && statusModalFilterType !== 'lead') {
        setStatusModalFilterType('lead');
      }
      // If user only has permission on client_default status, set filter to client
      else if (clientDefaultStatus && 
          clientStatusesWithPermission.length === 1 && 
          clientStatusesWithPermission[0].id === clientDefaultStatus.id &&
          statusModalFilterType !== 'client') {
        setStatusModalFilterType('client');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStatusModalOpen, statuses, statusViewPermissions, contact]);
  
  // Prefill client form when modal opens if selected status is client default
  React.useEffect(() => {
    if (isStatusModalOpen && contact && selectedStatusId) {
      const selectedStatus = statuses.find(s => s.id === selectedStatusId);
      if (selectedStatus?.clientDefault === true) {
        prefillClientForm(contact);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStatusModalOpen, contact, selectedStatusId, statuses]);

  function cancelEditing() {
    setEditingField(null);
    setFieldValue('');
  }

  // Click outside to cancel editing
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!editingField || !editingFieldRef.current) return;
      
      const target = event.target as HTMLElement;
      
      // FIRST: Check if clicking on Select trigger or any Select-related element
      // This must be checked first to prevent canceling when opening Select dropdowns
      const isSelectTrigger = target.closest('[data-slot="select-trigger"]');
      const isSelectContent = target.closest('[data-slot="select-content"]');
      const isSelectItem = target.closest('[data-slot="select-item"]');
      
      // Check if click is inside a Select dropdown (rendered in portal)
      let element: HTMLElement | null = target;
      let isSelectElement = false;
      while (element && element !== document.body) {
        const dataSlot = element.getAttribute('data-slot');
        if (dataSlot && dataSlot.includes('select')) {
          isSelectElement = true;
          break;
        }
        element = element.parentElement;
      }
      
      // Don't cancel if clicking on Select elements
      if (isSelectTrigger || isSelectContent || isSelectItem || isSelectElement) {
        // Clear any pending cancel timeout when interacting with Select
        if (cancelTimeoutRef.current) {
          clearTimeout(cancelTimeoutRef.current);
          cancelTimeoutRef.current = null;
        }
        return; // Click is on Select element, don't cancel
      }
      
      // Check if a Select dropdown is currently open (by checking for SelectContent in DOM)
      const selectContent = document.querySelector('[data-slot="select-content"]');
      if (selectContent) {
        // Select dropdown exists (might be opening or closing), don't cancel yet
        if (cancelTimeoutRef.current) {
          clearTimeout(cancelTimeoutRef.current);
        }
        return;
      }
      
      // SECOND: Check if click is inside the editing field wrapper
      if (editingFieldRef.current.contains(target)) {
        // Clear any pending cancel timeout
        if (cancelTimeoutRef.current) {
          clearTimeout(cancelTimeoutRef.current);
          cancelTimeoutRef.current = null;
        }
        return;
      }
      
      // Clear any existing timeout
      if (cancelTimeoutRef.current) {
        clearTimeout(cancelTimeoutRef.current);
      }
      
      // Add a small delay before canceling to allow Select's onValueChange to complete
      // This gives the user time to see their selection and click the save button
      cancelTimeoutRef.current = setTimeout(() => {
        // Double-check that Select dropdown is not open before canceling
        const stillOpen = document.querySelector('[data-slot="select-content"]');
        if (!stillOpen && editingField) {
          setEditingField(null);
          setFieldValue('');
        }
        cancelTimeoutRef.current = null;
      }, 200);
    }

    if (editingField) {
      // Use bubble phase (false) instead of capture phase so Select can handle clicks first
      document.addEventListener('mousedown', handleClickOutside, false);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside, false);
        if (cancelTimeoutRef.current) {
          clearTimeout(cancelTimeoutRef.current);
          cancelTimeoutRef.current = null;
        }
      };
    }
  }, [editingField]);

  // Auto-fill teleoperateur field when entering edit mode if field is empty and user is teleoperateur
  React.useEffect(() => {
    if (editingField === 'teleoperatorId' && (!fieldValue || fieldValue === '' || fieldValue === 'none') && currentUser?.isTeleoperateur && currentUser?.id) {
      setFieldValue(currentUser.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingField, currentUser?.isTeleoperateur, currentUser?.id]);
  
  // Appointments state
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isEditAppointmentModalOpen, setIsEditAppointmentModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);
  const [isEventModalFromStatus, setIsEventModalFromStatus] = useState(false);
  const [appointmentFormData, setAppointmentFormData] = useState({
    date: '',
    hour: '09',
    minute: '00',
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
  
  // Ensure first category is selected when modal opens and categories are available
  React.useEffect(() => {
    if (isStatusModalOpen && accessibleCategories.length > 0 && !statusChangeNoteCategoryId) {
      setStatusChangeNoteCategoryId(accessibleCategories[0].id);
    }
  }, [isStatusModalOpen, accessibleCategories, statusChangeNoteCategoryId]);
  
  // Helper function to prefill client form with contact data
  const prefillClientForm = React.useCallback((contactData: any) => {
    // Prefill teleoperatorId with current user if they are a teleoperateur
    const defaultTeleoperatorId = currentUser?.isTeleoperateur === true 
      ? currentUser.id 
      : (contactData.teleoperatorId || contactData.managerId || '');
    
    setClientFormData({
      platformId: contactData.platformId || '',
      teleoperatorId: defaultTeleoperatorId,
      nomDeScene: contactData.nomDeScene || '',
      firstName: contactData.firstName || '',
      lastName: contactData.lastName || '',
      emailClient: contactData.email || '',
      telephoneClient: contactData.phone || '',
      portableClient: contactData.mobile || '',
      contrat: contactData.contrat || '',
      sourceId: contactData.sourceId || '',
      montantEncaisse: contactData.montantEncaisse || '',
      bonus: contactData.bonus || '',
      paiement: contactData.paiement || '',
      noteGestionnaire: '',
      noteCategoryId: accessibleCategories.length > 0 ? accessibleCategories[0].id : ''
    });
    setSelectedNoteCategoryId(accessibleCategories.length > 0 ? accessibleCategories[0].id : '');
  }, [currentUser, accessibleCategories]);
  
  // Pre-compute note permissions map for all notes to avoid calling hooks in NoteItemCompact
  // Note permissions require BOTH note_categories permission AND contact_tabs permission for informations tab
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
      
      // Check note_categories permission
      const hasCategoryEdit = currentUser.permissions.some((p: any) => 
        p.component === 'note_categories' && 
        p.action === 'edit' && 
        p.fieldName === noteCategoryId &&
        !p.statusId
      );
      
      const hasCategoryDelete = currentUser.permissions.some((p: any) => 
        p.component === 'note_categories' && 
        p.action === 'delete' && 
        p.fieldName === noteCategoryId &&
        !p.statusId
      );
      
      // Also require contact_tabs permissions for informations tab
      const canEdit = hasCategoryEdit && canEditInformationsTab;
      const canDelete = hasCategoryDelete && canDeleteInformationsTab;
      
      map.set(note.id, { canEdit, canDelete });
    });
    
    return map;
  }, [currentUser?.permissions, localNotes, canEditInformationsTab, canDeleteInformationsTab]);
  
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
    
    // Load statuses, sources, platforms, and documents (also non-blocking)
    Promise.all([
      loadStatuses(),
      loadSources(),
      loadPlatforms(),
      loadDocuments()
    ]).catch(err => console.error('Error loading dropdown data:', err));
  }, []);

  // Reload documents when contactId changes
  useEffect(() => {
    if (contactId) {
      loadDocuments();
    }
  }, [contactId]);

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

  async function loadPlatforms() {
    try {
      const data = await apiCall('/api/platforms/');
      setPlatforms(data.platforms || []);
    } catch (error) {
      console.error('Error loading platforms:', error);
    }
  }

  async function loadDocuments() {
    if (!contactId) return;
    try {
      const data = await apiCall(`/api/contacts/${contactId}/documents/`);
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  }

  async function handleDocumentUpload(documentType: string, file: File) {
    if (!contactId) {
      toast.error('Contact ID manquant');
      return;
    }

    try {
      setUploadingDocument(documentType);
      
      // Upload file to Impossible Cloud via backend
      const formData = new FormData();
      formData.append('file', file);
      formData.append('contactId', contactId);
      formData.append('documentType', documentType);
      
      const uploadResponse = await apiCall('/api/documents/upload/', {
        method: 'POST',
        body: formData,
      });
      
      const { fileUrl, fileName } = uploadResponse;
      
      // Create or update document with the uploaded file URL
      await apiCall('/api/documents/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId,
          documentType,
          fileUrl,
          fileName: fileName || file.name,
        }),
      });
      
      toast.success('Document uploadé avec succès');
      await loadDocuments();
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error(error.message || 'Erreur lors de l\'upload du document');
    } finally {
      setUploadingDocument(null);
    }
  }

  function getDocumentByType(type: string): Document | undefined {
    return documents.find(doc => doc.documentType === type);
  }

  function hasDocument(type: string): boolean {
    const doc = getDocumentByType(type);
    return doc?.hasDocument === true && !!doc?.fileUrl;
  }

  // Load users when modals open (lazy loading)
  useEffect(() => {
    if (isAppointmentModalOpen || isEditAppointmentModalOpen) {
      loadUsersIfNeeded();
    }
  }, [isAppointmentModalOpen, isEditAppointmentModalOpen, loadUsersIfNeeded]);
  
  // Initialize userId with current user when modal opens
  useEffect(() => {
    if (isAppointmentModalOpen && currentUser?.id) {
      setAppointmentFormData(prev => ({ 
        ...prev, 
        userId: currentUser.id 
      }));
    }
  }, [isAppointmentModalOpen, currentUser]);

  // Prefill user when edit appointment modal opens
  useEffect(() => {
    if (isEditAppointmentModalOpen && editingAppointment && currentUser?.id) {
      setEditAppointmentFormData(prev => ({ 
        ...prev, 
        userId: editingAppointment.userId || currentUser.id 
      }));
    }
  }, [isEditAppointmentModalOpen, editingAppointment, currentUser]);

  async function handleFieldUpdate(fieldName: string, value: any) {
    console.log('[handleFieldUpdate] Called with fieldName:', fieldName, 'value:', value, 'canEdit:', canEdit, 'contactId:', contactId);
    if (!contactId) {
      console.log('[handleFieldUpdate] Early return - contactId missing');
      return;
    }
    
    // Check if user has field-level edit permission (this takes precedence)
    const hasFieldPermission = canEditField(fieldName);
    console.log('[handleFieldUpdate] hasFieldPermission:', hasFieldPermission);
    
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
      // For other fields, check field-level permission first (takes precedence)
      if (!hasFieldPermission) {
        console.log('[handleFieldUpdate] Permission denied: no field-level permission');
        toast.error(`Vous n'avez pas la permission de modifier ce champ`);
        return;
      }
      
      // If field-level permission exists, allow save even if general canEdit is false
      // (field-level permissions override general permissions)
      console.log('[handleFieldUpdate] Field-level permission granted, proceeding with save');
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
        'confirmateurId': 'confirmateurId',
        'platformId': 'platformId',
        'montantEncaisse': 'montantEncaisse',
        'bonus': 'bonus',
        'paiement': 'paiement',
        'contrat': 'contrat',
        'nomDeScene': 'nomDeScene',
        'dateProTr': 'dateProTr',
        'potentiel': 'potentiel',
        'produit': 'produit',
        'confirmateurEmail': 'confirmateurEmail',
        'confirmateurTelephone': 'confirmateurTelephone'
      };
      
      const apiFieldName = fieldMap[fieldName];
      console.log('[handleFieldUpdate] apiFieldName:', apiFieldName, 'value:', value);
      if (apiFieldName) {
        // Remove spaces from phone numbers before sending to backend
        if (fieldName === 'phone' || fieldName === 'mobile') {
          // Ensure we remove all spaces - convert to string first, then remove spaces
          const cleanedValue = value === '' || value === 'none' ? '' : removePhoneSpaces(String(value));
          payload[apiFieldName] = cleanedValue === '' ? null : cleanedValue;
        } else if (fieldName === 'montantEncaisse' || fieldName === 'bonus') {
          // Handle numeric fields - convert to number or null
          const numValue = value === '' || value === 'none' ? null : (isNaN(Number(value)) ? null : Number(value));
          payload[apiFieldName] = numValue;
        } else {
          payload[apiFieldName] = value === '' || value === 'none' ? null : value;
        }
      }
      
      console.log('[handleFieldUpdate] Payload to send:', payload);
      console.log('[handleFieldUpdate] Making API call to:', `/api/contacts/${contactId}/`);
      const response = await apiCall(`/api/contacts/${contactId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('[handleFieldUpdate] API response:', response);
      
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
        
        // Refresh page if status was updated
        if (fieldName === 'statusId') {
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
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
  
  // Helper function to update form field and clear error
  const updateFormField = (fieldName: string, value: any) => {
    setClientFormData({ ...clientFormData, [fieldName]: value });
    if (fieldErrors[fieldName]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  async function handleUpdateStatus() {
    if (!contact) return;
    
    // Validate note is always required
    if (!statusChangeNote.trim()) {
      setFieldErrors(prev => ({ ...prev, note: true }));
      toast.error('Veuillez saisir une note pour changer le statut');
      setIsSavingClientForm(false);
      return;
    }
    
    // Clear note error if validation passes
    if (fieldErrors.note) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.note;
        return newErrors;
      });
    }
    
    // Validate that a category is selected if note is provided and categories are available
    if (statusChangeNote.trim() && accessibleCategories.length > 0 && !statusChangeNoteCategoryId) {
      toast.error('Veuillez sélectionner une catégorie pour la note');
      return;
    }
    
    // Check if selected status has isEvent=true
    // Use String() to ensure consistent type comparison
    const selectedStatus = statuses.find(s => String(s.id) === String(selectedStatusId));
    // Check both isEvent (camelCase) and is_event (snake_case) for compatibility
    const isEventStatus = selectedStatus && (selectedStatus.isEvent === true || selectedStatus.is_event === true);
    
    // If status is an event status, validate event fields
    if (isEventStatus && canCreatePlanning) {
      if (!eventDate) {
        toast.error('Veuillez sélectionner une date pour l\'événement');
        return;
      }
      if (!eventHour || !eventMinute) {
        toast.error('Veuillez sélectionner une heure pour l\'événement');
        return;
      }
    }
    
    // If status is being changed, check permissions
    if (selectedStatusId !== contact.statusId) {
      // Check if user has EDIT permission for CURRENT status (to allow changing it)
      if (contact.statusId && !canEditContact(contact)) {
        toast.error('Vous n\'avez pas la permission de modifier le statut de ce contact');
        return;
      }
      
      // Check if user has VIEW permission for NEW status (to allow assigning it)
      if (selectedStatusId) {
        const normalizedNewStatusId = String(selectedStatusId).trim();
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
    
    setIsSavingClientForm(true);
    try {
      // If status is client default, validate and include client form data
      if (selectedStatusIsClientDefault) {
        // Validate required client form fields and set errors
        const errors: Record<string, boolean> = {};
        if (!clientFormData.platformId) errors.platformId = true;
        if (!clientFormData.teleoperatorId) errors.teleoperatorId = true;
        if (!clientFormData.nomDeScene) errors.nomDeScene = true;
        if (!clientFormData.firstName) errors.firstName = true;
        if (!clientFormData.emailClient) errors.emailClient = true;
        if (!clientFormData.telephoneClient) errors.telephoneClient = true;
        if (!clientFormData.contrat) errors.contrat = true;
        if (!clientFormData.sourceId) errors.sourceId = true;
        if (clientFormData.montantEncaisse === '') errors.montantEncaisse = true;
        if (clientFormData.bonus === '') errors.bonus = true;
        if (!clientFormData.paiement) errors.paiement = true;
        
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          toast.error('Veuillez remplir tous les champs obligatoires de la fiche client');
          setIsSavingClientForm(false);
          return;
        }
        
        // Clear errors if validation passes
        setFieldErrors({});
        
        // Prepare update payload with client form data
        const payload: any = {
          statusId: selectedStatusId || '',
          platformId: clientFormData.platformId || null,
          teleoperatorId: clientFormData.teleoperatorId || null,
          nomDeScene: clientFormData.nomDeScene,
          firstName: clientFormData.firstName,
          lastName: clientFormData.lastName,
          email: clientFormData.emailClient,
          phone: clientFormData.telephoneClient ? clientFormData.telephoneClient.replace(/\s/g, '') : null,
          mobile: clientFormData.portableClient ? clientFormData.portableClient.replace(/\s/g, '') : null,
          contrat: clientFormData.contrat,
          sourceId: clientFormData.sourceId || null,
          montantEncaisse: clientFormData.montantEncaisse ? parseFloat(clientFormData.montantEncaisse) : null,
          bonus: clientFormData.bonus ? parseFloat(clientFormData.bonus) : null,
          paiement: clientFormData.paiement
        };
        
        // Update contact with client form data
        await apiCall(`/api/contacts/${contactId}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Update status (non-client default status)
        // If status is an event status, also update teleoperator
        const updatePayload: any = {
          statusId: selectedStatusId || ''
        };
        
        if (isEventStatus && eventTeleoperatorId) {
          updatePayload.teleoperatorId = eventTeleoperatorId || null;
        }
        
        await apiCall(`/api/contacts/${contactId}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });
      }
      
      // Create event if status has isEvent=true
      if (isEventStatus && canCreatePlanning && canCreateInformationsTab && eventDate && eventHour && eventMinute) {
        const timeString = `${eventHour.padStart(2, '0')}:${eventMinute.padStart(2, '0')}`;
        await apiCall('/api/events/create/', {
          method: 'POST',
          body: JSON.stringify({
            datetime: `${eventDate}T${timeString}`,
            contactId: contactId,
            userId: currentUser?.id || null,
            comment: ''
          }),
        });
      }
      
      // Create note with selected category if note was provided
      if (statusChangeNote.trim()) {
        // Validate that a category is selected if categories are available
        if (accessibleCategories.length > 0 && !statusChangeNoteCategoryId) {
          toast.error('Veuillez sélectionner une catégorie pour la note');
          return;
        }
        
        const notePayload: any = {
          text: statusChangeNote.trim(),
          contactId: contactId
        };
        
        if (statusChangeNoteCategoryId) {
          notePayload.categId = statusChangeNoteCategoryId;
        }
        
        await apiCall('/api/notes/create/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notePayload)
        });
      }
      
      toast.success(isEventStatus ? 'Statut mis à jour et événement créé avec succès' : (selectedStatusIsClientDefault ? 'Contact mis à jour avec succès' : 'Statut mis à jour avec succès'));
      setIsStatusModalOpen(false);
      setSelectedStatusId('');
      setStatusChangeNote('');
      setStatusChangeNoteCategoryId('');
      setStatusModalFilterType('lead');
      setFieldErrors({});
      // Reset event fields
      setEventDate('');
      setEventHour('');
      setEventMinute('');
      setEventTeleoperatorId('');
      // Reset client form
      setClientFormData({
        platformId: '',
        teleoperatorId: '',
        nomDeScene: '',
        firstName: '',
        lastName: '',
        emailClient: '',
        telephoneClient: '',
        portableClient: '',
        contrat: '',
        sourceId: '',
        montantEncaisse: '',
        bonus: '',
        paiement: '',
        noteGestionnaire: '',
        noteCategoryId: ''
      });
      setSelectedNoteCategoryId('');
      setFieldErrors({});
      
      // Refresh contact data
      if (onContactUpdated) {
        onContactUpdated();
      }
      if (onRefresh) {
        onRefresh();
      }
      
      // Refresh page after update
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error('Error updating status:', error);
      const errorMessage = error?.response?.error || error?.response?.detail || error?.message || 'Erreur lors de la mise à jour';
      toast.error(errorMessage);
    } finally {
      setIsSavingClientForm(false);
    }
  }

  function startEditing(fieldName: string, currentValue: any) {
    // Check field-level edit permission
    if (!canEditField(fieldName)) {
      if (!canEditContact(contact)) {
        toast.error('Vous n\'avez pas la permission d\'éditer ce contact');
      } else {
        toast.error(`Vous n'avez pas la permission de modifier ce champ`);
      }
      return;
    }
    setEditingField(fieldName);
    // For phone numbers, show the raw value without spaces when editing
    // (spaces are only for display, not for editing)
    if (fieldName === 'phone' || fieldName === 'mobile') {
      setFieldValue(removePhoneSpaces(currentValue) || '');
    } else {
      setFieldValue(currentValue || '');
    }
  }

  async function saveField(fieldName: string) {
    console.log('[saveField] Saving field:', fieldName, 'value:', fieldValue);
    console.log('[saveField] canEdit:', canEdit, 'contactId:', contactId);
    
    // Check if saving statusId and if the status has isEvent=true or clientDefault=true
    let selectedStatusIsEvent = false;
    let selectedStatusIsClientDefault = false;
    if (fieldName === 'statusId' && fieldValue && fieldValue !== 'none' && fieldValue !== '') {
      // Use String() to ensure consistent type comparison
      const selectedStatus = statuses.find(s => String(s.id) === String(fieldValue));
      console.log('[saveField] Selected status:', selectedStatus);
      if (selectedStatus) {
        // Check both isEvent (camelCase) and is_event (snake_case) for compatibility
        if (selectedStatus.isEvent === true || selectedStatus.is_event === true) {
        selectedStatusIsEvent = true;
      }
        console.log('[saveField] Checking clientDefault:', selectedStatus.clientDefault, 'type:', selectedStatus.type);
        if (selectedStatus.clientDefault === true && selectedStatus.type === 'client') {
          selectedStatusIsClientDefault = true;
          console.log('[saveField] Status is client default, opening modal');
        }
      }
    }
    
    // If status is a client default status, show client form modal
    if (fieldName === 'statusId' && selectedStatusIsClientDefault) {
      console.log('[saveField] Opening client form modal');
      // Don't save the status yet - store it as pending and open client form modal
      setPendingStatusChange(fieldValue);
      // Pre-fill form with existing contact data
      // Prefill teleoperatorId with current user if they are a teleoperateur
      const defaultTeleoperatorId = currentUser?.isTeleoperateur === true 
        ? currentUser.id 
        : (contact.teleoperatorId || contact.managerId || '');
      
      setClientFormData({
        platformId: contact.platformId || '',
        teleoperatorId: defaultTeleoperatorId,
        nomDeScene: contact.nomDeScene || '',
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        emailClient: contact.email || '',
        telephoneClient: contact.phone || '',
        portableClient: contact.mobile || '',
        contrat: contact.contrat || '',
        sourceId: contact.sourceId || '',
        montantEncaisse: contact.montantEncaisse || '',
        bonus: contact.bonus || '',
        paiement: contact.paiement || '',
        noteGestionnaire: '',
        noteCategoryId: accessibleCategories.length > 0 ? accessibleCategories[0].id : ''
      });
      setSelectedNoteCategoryId(accessibleCategories.length > 0 ? accessibleCategories[0].id : '');
      // Keep the modal open and show client form in right column
      return;
    }
    
    // If status is an event status, require event creation before saving status
    if (fieldName === 'statusId' && selectedStatusIsEvent && canCreatePlanning) {
      // Don't save the status yet - store it as pending and open event modal
      setPendingStatusChange(fieldValue);
      // Set today's date as default
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      setAppointmentFormData({
        date: dateStr,
        hour: today.getHours().toString().padStart(2, '0'),
        minute: '00',
        userId: currentUser?.id || ''
      });
      setIsEventModalFromStatus(true);
      setIsAppointmentModalOpen(true);
      // Keep the field in edit mode until event is created
      return;
    }
    
    // Ensure we have a valid value for teleoperatorId
    if (fieldName === 'teleoperatorId') {
      const valueToSave = fieldValue && fieldValue !== 'none' && fieldValue !== '' ? fieldValue : null;
      console.log('[saveField] teleoperatorId valueToSave:', valueToSave);
      console.log('[saveField] Calling handleFieldUpdate...');
      try {
        await handleFieldUpdate(fieldName, valueToSave);
        console.log('[saveField] handleFieldUpdate completed successfully');
      } catch (error) {
        console.error('[saveField] Error in handleFieldUpdate:', error);
      }
    } else {
      console.log('[saveField] Calling handleFieldUpdate...');
      try {
        await handleFieldUpdate(fieldName, fieldValue);
        console.log('[saveField] handleFieldUpdate completed successfully');
      } catch (error) {
        console.error('[saveField] Error in handleFieldUpdate:', error);
      }
    }
  }
  
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  
  async function handleCreateAppointment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canCreatePlanning || !canCreateInformationsTab) return;
    
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
          userId: currentUser?.id || null,
          comment: ''
        }),
      });
      
      // If this was triggered from a status change, save the status now
      if (isEventModalFromStatus && pendingStatusChange) {
        try {
          await handleFieldUpdate('statusId', pendingStatusChange);
          toast.success('Statut mis à jour et événement créé avec succès');
          setPendingStatusChange(null);
          // Refresh page after status update and event creation
          setTimeout(() => {
            window.location.reload();
          }, 500);
          return; // Exit early to prevent double refresh
        } catch (statusError: any) {
          console.error('Error updating status after event creation:', statusError);
          toast.error('Événement créé mais erreur lors de la mise à jour du statut');
        }
        setPendingStatusChange(null);
      } else {
        toast.success(isEventModalFromStatus ? 'Événement créé avec succès' : 'Rendez-vous créé avec succès');
      }
      
      setIsAppointmentModalOpen(false);
      setIsEventModalFromStatus(false);
      setAppointmentFormData({ date: '', hour: '09', minute: '00', comment: '', userId: currentUser?.id || '' });
      
      // Refresh page after event creation
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      const errorMessage = error?.response?.detail || error?.message || 'Erreur lors de la création du rendez-vous';
      toast.error(errorMessage);
    } finally {
      setIsSubmittingAppointment(false);
    }
  }
  
  function handleEditAppointment(appointment: any) {
    if (!canEditPlanning || !canEditInformationsTab) return;
    const eventDate = new Date(appointment.datetime);
    const dateStr = eventDate.toISOString().split('T')[0];
    const hour = eventDate.getHours().toString().padStart(2, '0');
    const minute = eventDate.getMinutes().toString().padStart(2, '0');
    
    // Ensure userId is set properly - use appointment.userId if it exists, otherwise currentUser
    const userIdToSet = appointment.userId && appointment.userId.trim() !== '' 
      ? appointment.userId 
      : (currentUser?.id || '');
    
    setEditingAppointment(appointment);
    setEditAppointmentFormData({
      date: dateStr,
      hour: hour,
      minute: minute,
      comment: appointment.comment || '',
      userId: userIdToSet
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
    if (!canDeletePlanning || !canDeleteInformationsTab) return;
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
    
    if (!canCreateInformationsTab) {
      toast.error('Vous n\'avez pas la permission de créer des notes');
      return;
    }
    
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
    if (!canEditInformationsTab) {
      toast.error('Vous n\'avez pas la permission de modifier des notes');
      return;
    }
    
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
    if (!canDeleteInformationsTab) {
      toast.error('Vous n\'avez pas la permission de supprimer des notes');
      return;
    }
    
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
    <div className="space-y-3">
      {/* Rendez-vous - Compact */}
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Rendez-vous</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-6 w-full">
          {/* Show loading indicator only while user is loading AND we don't have permissions yet */}
          {loadingUser && !currentUser?.permissions ? (
            <p className="text-sm text-slate-500 text-center py-4">Chargement...</p>
          ) : (
            <>
              {/* Past and Future Events - Two Columns */}
              {appointments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                  {/* Past Events Column */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold mb-2">Événements passés</h3>
                    {[...appointments]
                      .filter((apt) => new Date(apt.datetime) < new Date())
                      .sort((a, b) => {
                        const dateA = new Date(a.datetime).getTime();
                        const dateB = new Date(b.datetime).getTime();
                        return dateB - dateA; // Most recent first
                      })
                      .slice(0, pastEventsLimit)
                      .map((apt) => {
                        const datetime = new Date(apt.datetime);
                        return (
                          <div 
                            key={apt.id} 
                            className="contact-appointment-card past"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Calendar className="contact-icon-calendar past" />
                                  <span className="font-medium contact-text-past">
                                    {datetime.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </span>
                                  <Clock className="contact-icon-clock ml-1 past" />
                                  <span className="contact-text-past">
                                    {datetime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                  </span>
                                </div>
                                {apt.comment && (
                                  <p className="contact-text-comment past">
                                    {apt.comment}
                                  </p>
                                )}
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="contact-text-meta past">
                                      {apt.created_at ? new Date(apt.created_at).toLocaleString('fr-FR', { 
                                        day: '2-digit', 
                                        month: '2-digit', 
                                        year: 'numeric',
                                        hour: '2-digit', 
                                        minute: '2-digit'
                                      }) : '-'}
                                    </span>
                                    {(apt.createdBy || apt.userId?.username || apt.user?.username) && (
                                      <span className="contact-text-meta past">
                                        • {apt.createdBy || apt.userId?.username || apt.user?.username}
                                      </span>
                                    )}
                                  </div>
                                  {apt.assignedTo && (
                                    <div className="flex items-center gap-2">
                                      <span className="contact-text-meta past">
                                        Assigné à: <span className="font-medium">{apt.assignedTo}</span>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    {appointments.filter((apt) => new Date(apt.datetime) < new Date()).length === 0 && (
                      <p className="text-sm text-slate-500">Aucun événement passé</p>
                    )}
                    {appointments.filter((apt) => new Date(apt.datetime) < new Date()).length > pastEventsLimit && (
                      <div className="flex justify-end mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPastEventsLimit(prev => prev + 3);
                            // If we need more events from API, load them
                            if (appointments.filter((apt) => new Date(apt.datetime) < new Date()).length <= pastEventsLimit + 3 && hasMoreEvents) {
                              onLoadMoreEvents();
                            }
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Voir plus...
                        </Button>
                      </div>
                    )}
                    {hasMoreEvents && appointments.filter((apt) => new Date(apt.datetime) < new Date()).length <= pastEventsLimit && (
                      <div className="flex justify-end mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onLoadMoreEvents}
                          disabled={loadingMoreEvents}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {loadingMoreEvents ? 'Chargement...' : 'Voir plus...'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Future Events Column */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold mb-2">Événements à venir</h3>
                    {[...appointments]
                      .filter((apt) => new Date(apt.datetime) >= new Date())
                      .sort((a, b) => {
                        const dateA = new Date(a.datetime).getTime();
                        const dateB = new Date(b.datetime).getTime();
                        return dateA - dateB; // Soonest first
                      })
                      .slice(0, futureEventsLimit)
                      .map((apt) => {
                        const datetime = new Date(apt.datetime);
                        return (
                          <div 
                            key={apt.id} 
                            className="contact-appointment-card"
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Calendar className="contact-icon-calendar" />
                                  <span className="font-medium">
                                    {datetime.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </span>
                                  <Clock className="contact-icon-clock ml-1" />
                                  <span>
                                    {datetime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                  </span>
                                </div>
                                {apt.comment && (
                                  <p className="contact-text-comment">
                                    {apt.comment}
                                  </p>
                                )}
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="contact-text-meta">
                                        {apt.created_at ? new Date(apt.created_at).toLocaleString('fr-FR', { 
                                          day: '2-digit', 
                                          month: '2-digit', 
                                          year: 'numeric',
                                          hour: '2-digit', 
                                          minute: '2-digit'
                                        }) : '-'}
                                      </span>
                                      {(apt.createdBy || apt.userId?.username || apt.user?.username) && (
                                        <span className="contact-text-meta">
                                          • {apt.createdBy || apt.userId?.username || apt.user?.username}
                                        </span>
                                      )}
                                    </div>
                                    {(canEditPlanning && canEditInformationsTab) || (canDeletePlanning && canDeleteInformationsTab) ? (
                                      <div className="flex gap-2 flex-shrink-0">
                                        {canEditPlanning && canEditInformationsTab && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditAppointment(apt)}
                                            className="contact-tab-button-modify cursor-pointer text-slate-600"
                                          >
                                            Modifier
                                          </Button>
                                        )}
                                        {canDeletePlanning && canDeleteInformationsTab && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteAppointment(apt.id)}
                                            className="contact-tab-button-delete text-red-600 cursor-pointer"
                                          >
                                            Supprimer
                                          </Button>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                  {apt.assignedTo && (
                                    <div className="flex items-center gap-2">
                                      <span className="contact-text-meta">
                                        Assigné à: <span className="font-medium">{apt.assignedTo}</span>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    {appointments.filter((apt) => new Date(apt.datetime) >= new Date()).length === 0 && (
                      <p className="text-sm text-slate-500">Aucun événement à venir</p>
                    )}
                    {appointments.filter((apt) => new Date(apt.datetime) >= new Date()).length > futureEventsLimit && (
                      <div className="flex justify-end mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFutureEventsLimit(prev => prev + 3);
                            // If we need more events from API, load them
                            if (appointments.filter((apt) => new Date(apt.datetime) >= new Date()).length <= futureEventsLimit + 3 && hasMoreEvents) {
                              onLoadMoreEvents();
                            }
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Voir plus...
                        </Button>
                      </div>
                    )}
                    {hasMoreEvents && appointments.filter((apt) => new Date(apt.datetime) >= new Date()).length <= futureEventsLimit && (
                      <div className="flex justify-end mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onLoadMoreEvents}
                          disabled={loadingMoreEvents}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {loadingMoreEvents ? 'Chargement...' : 'Voir plus...'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Aucun rendez-vous</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Two-column layout: Left column (Information générales, Informations du contact, Adresse) | Right column (Notes) */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '70% 30%', minWidth: 0, maxWidth: '100%' }}>
        {/* Left Column */}
        <div className="space-y-3" style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      {/* 1. Information générales */}
      <Card>
        <CardHeader>
          <CardTitle>1. Information générales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {canViewField('sourceId') && (
              <div>
                <Label className="text-slate-600">Source</Label>
                {editingField === 'sourceId' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('sourceId') ? 'editable' : ''}`}
                    onClick={canEditField('sourceId') ? () => startEditing('sourceId', contact.sourceId) : undefined}
                  >
                    {contact.source || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('campaign') && (
              <div>
                <Label className="text-slate-600">Campagne</Label>
                {editingField === 'campaign' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('campaign') ? 'editable' : ''}`}
                    onClick={canEditField('campaign') ? () => startEditing('campaign', contact.campaign) : undefined}
                  >
                    {contact.campaign || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('teleoperatorId') && (
              <div>
                <Label className="text-slate-600">Téléopérateur</Label>
                {editingField === 'teleoperatorId' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
                    <Select
                      value={fieldValue || 'none'}
                      onValueChange={(value) => setFieldValue(value === 'none' ? '' : value)}
                      disabled={isSaving}
                      onOpenChange={(open) => {
                        // Auto-fill with current user if they are a teleoperateur and field is empty
                        if (open && (!fieldValue || fieldValue === 'none' || fieldValue === '') && currentUser?.isTeleoperateur && currentUser?.id) {
                          setFieldValue(currentUser.id);
                        }
                      }}
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
                      type="button"
                      size="sm" 
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('[Button] Enregistrer clicked, fieldValue:', fieldValue, 'isSaving:', isSaving);
                        if (!isSaving) {
                          try {
                            await saveField('teleoperatorId');
                          } catch (error) {
                            console.error('[Button] Error in saveField:', error);
                          }
                        } else {
                          console.log('[Button] Button is disabled, not saving');
                        }
                      }} 
                      disabled={isSaving}
                      style={{ backgroundColor: '#22c55e', color: 'white' }}
                      onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                      onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                    >
                      Enregistrer
                    </Button>
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('teleoperatorId') ? 'editable' : ''}`}
                    onClick={canEditField('teleoperatorId') ? () => startEditing('teleoperatorId', contact.teleoperatorId || contact.managerId) : undefined}
                  >
                    {contact.teleoperatorName || contact.managerName || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('confirmateurId') && (
              <div>
                <Label className="text-slate-600">Confirmateur</Label>
                {editingField === 'confirmateurId' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('confirmateurId') ? 'editable' : ''}`}
                    onClick={canEditField('confirmateurId') ? () => startEditing('confirmateurId', contact.confirmateurId) : undefined}
                  >
                    {contact.confirmateurName || '-'}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

          {/* 2. Informations du contact */}
      <Card>
        <CardHeader>
          <CardTitle>2. Informations du contact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {canViewField('statusId') && (
              <div className="contact-status-field-container">
                <Label className="text-slate-600">Statut</Label>
                <div className="flex items-center gap-2">
                {(() => {
                  // Check if user can edit the status field AND can edit this contact's current status
                  const canEditStatusField = canEditField('statusId');
                  const canEditCurrentStatus = canEditContact(contact);
                  const canClickStatus = canEditStatusField && canEditCurrentStatus;
                  
                  return (
                    <div 
                      className={`contact-field-display flex-1 ${canClickStatus ? 'editable' : ''}`}
                      onClick={canClickStatus ? async () => {
                        // Fetch fresh contact data
                        try {
                          const contactData = await apiCall(`/api/contacts/${contactId}/`);
                          const freshContact = contactData.contact || contact;
                          setSelectedStatusId(freshContact.statusId || '');
                          setStatusChangeNote('');
                          setStatusChangeNoteCategoryId(accessibleCategories.length > 0 ? accessibleCategories[0].id : '');
                          // Set filter type based on current status
                          const currentStatus = statuses.find(s => s.id === freshContact.statusId);
                          if (currentStatus?.type === 'client' || currentStatus?.type === 'lead') {
                            setStatusModalFilterType(currentStatus.type);
                          } else {
                            setStatusModalFilterType('lead');
                          }
                          // Prefill client form if status is client default
                          if (currentStatus?.clientDefault === true) {
                            const defaultTeleoperatorId = currentUser?.isTeleoperateur === true 
                              ? currentUser.id 
                              : (freshContact.teleoperatorId || freshContact.managerId || '');
                            
                            setClientFormData({
                              platformId: freshContact.platformId || '',
                              teleoperatorId: defaultTeleoperatorId,
                              nomDeScene: freshContact.nomDeScene || '',
                              firstName: freshContact.firstName || '',
                              lastName: freshContact.lastName || '',
                              emailClient: freshContact.email || '',
                              telephoneClient: freshContact.phone || '',
                              portableClient: freshContact.mobile || '',
                              contrat: freshContact.contrat || '',
                              sourceId: freshContact.sourceId || '',
                              montantEncaisse: freshContact.montantEncaisse || '',
                              bonus: freshContact.bonus || '',
                              paiement: freshContact.paiement || '',
                              noteGestionnaire: '',
                              noteCategoryId: accessibleCategories.length > 0 ? accessibleCategories[0].id : ''
                            });
                            setSelectedNoteCategoryId(accessibleCategories.length > 0 ? accessibleCategories[0].id : '');
                          }
                          setIsStatusModalOpen(true);
                        } catch (error) {
                          console.error('Error fetching fresh contact:', error);
                          // Fallback to current contact
                          setSelectedStatusId(contact.statusId || '');
                          setStatusChangeNote('');
                          setStatusChangeNoteCategoryId(accessibleCategories.length > 0 ? accessibleCategories[0].id : '');
                          const currentStatus = statuses.find(s => s.id === contact.statusId);
                          if (currentStatus?.type === 'client' || currentStatus?.type === 'lead') {
                            setStatusModalFilterType(currentStatus.type);
                          } else {
                            setStatusModalFilterType('lead');
                          }
                          setIsStatusModalOpen(true);
                        }
                      } : (e) => {
                        // Prevent any action if user doesn't have permission
                        e.stopPropagation();
                      }}
                      style={canClickStatus ? {} : {
                        cursor: 'not-allowed',
                        opacity: 0.7
                      }}
                      title={canClickStatus ? undefined : "Vous n'avez pas la permission de modifier le statut de ce contact"}
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
                  );
                })()}
                </div>
              </div>
            )}
            {canViewField('civility') && (
              <div>
                <Label className="text-slate-600">Civilité</Label>
                {editingField === 'civility' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('civility') ? 'editable' : ''}`}
                    onClick={canEditField('civility') ? () => startEditing('civility', contact.civility) : undefined}
                  >
                    {contact.civility || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('firstName') && (
              <div>
                <Label className="text-slate-600">Prénom</Label>
                {editingField === 'firstName' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('firstName') ? 'editable' : ''}`}
                    onClick={canEditField('firstName') ? () => startEditing('firstName', contact.firstName) : undefined}
                  >
                    {contact.firstName || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('lastName') && (
              <div>
                <Label className="text-slate-600">Nom</Label>
                {editingField === 'lastName' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('lastName') ? 'editable' : ''}`}
                    onClick={canEditField('lastName') ? () => startEditing('lastName', contact.lastName) : undefined}
                  >
                    {contact.lastName || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('email') && (
              <div>
                <Label className="text-slate-600">Email</Label>
                {editingField === 'email' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('email') ? 'editable' : ''}`}
                    onClick={canEditField('email') ? () => startEditing('email', contact.email) : undefined}
                  >
                    {contact.email || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('mobile') && (
              <div>
                <Label className="text-slate-600">Téléphone 2</Label>
                {editingField === 'mobile' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('mobile') ? 'editable' : ''}`}
                    onClick={canEditField('mobile') ? () => startEditing('mobile', contact.mobile) : undefined}
                  >
                    {formatPhoneNumber(contact.mobile) || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('phone') && (
              <div>
                <Label className="text-slate-600">Téléphone 1</Label>
                {editingField === 'phone' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('phone') ? 'editable' : ''}`}
                    onClick={canEditField('phone') ? () => startEditing('phone', contact.phone) : undefined}
                  >
                    {formatPhoneNumber(contact.phone) || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('birthDate') && (
              <div>
                <Label className="text-slate-600">Date de naissance</Label>
                {editingField === 'birthDate' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('birthDate') ? 'editable' : ''}`}
                    onClick={canEditField('birthDate') ? () => startEditing('birthDate', contact.birthDate) : undefined}
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
            )}
            {canViewField('nationality') && (
              <div>
                <Label className="text-slate-600">Nationalité</Label>
                {editingField === 'nationality' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('nationality') ? 'editable' : ''}`}
                    onClick={canEditField('nationality') ? () => startEditing('nationality', contact.nationality) : undefined}
                  >
                    {contact.nationality || '-'}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Adresse */}
      <Card>
        <CardHeader>
          <CardTitle>3. Adresse</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {canViewField('address') && (
              <div>
                <Label className="text-slate-600">Adresse</Label>
                {editingField === 'address' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('address') ? 'editable' : ''}`}
                    onClick={canEditField('address') ? () => startEditing('address', contact.address) : undefined}
                  >
                    {contact.address || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('addressComplement') && (
              <div>
                <Label className="text-slate-600">Complément d'adresse</Label>
                {editingField === 'addressComplement' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('addressComplement') ? 'editable' : ''}`}
                    onClick={canEditField('addressComplement') ? () => startEditing('addressComplement', contact.addressComplement) : undefined}
                  >
                    {contact.addressComplement || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('postalCode') && (
              <div>
                <Label className="text-slate-600">Code postal</Label>
                {editingField === 'postalCode' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('postalCode') ? 'editable' : ''}`}
                    onClick={canEditField('postalCode') ? () => startEditing('postalCode', contact.postalCode) : undefined}
                  >
                    {contact.postalCode || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('city') && (
              <div>
                <Label className="text-slate-600">Ville</Label>
                {editingField === 'city' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('city') ? 'editable' : ''}`}
                    onClick={canEditField('city') ? () => startEditing('city', contact.city) : undefined}
                  >
                    {contact.city || '-'}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. Confirmateur */}
      <Card>
        <CardHeader>
          <CardTitle>4. Confirmateur</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {canViewField('platformId') && (
              <div>
                <Label className="text-slate-600">PLATEFORME</Label>
                {editingField === 'platformId' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
                    <Select
                      value={fieldValue || 'none'}
                      onValueChange={(value) => setFieldValue(value === 'none' ? '' : value)}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="flex-1 h-10">
                        <SelectValue placeholder="Sélectionner une plateforme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {platforms
                          .filter((platform) => platform.id && platform.id.trim() !== '')
                          .map((platform) => (
                            <SelectItem key={platform.id} value={platform.id}>
                              {platform.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      size="sm" 
                      onClick={() => saveField('platformId')} 
                      disabled={isSaving}
                      style={{ backgroundColor: '#22c55e', color: 'white' }}
                      onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                      onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                    >
                      Enregistrer
                    </Button>
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('platformId') ? 'editable' : ''}`}
                    onClick={canEditField('platformId') ? () => startEditing('platformId', contact.platformId) : undefined}
                  >
                    {contact.platform || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('montantEncaisse') && (
              <div>
                <Label className="text-slate-600">Montant ENCAISSÉ</Label>
                {editingField === 'montantEncaisse' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
                    <Input
                      type="number"
                      step="0.01"
                      value={fieldValue}
                      onChange={(e) => setFieldValue(e.target.value)}
                      disabled={isSaving}
                      className="flex-1 h-10"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => saveField('montantEncaisse')} 
                      disabled={isSaving}
                      style={{ backgroundColor: '#22c55e', color: 'white' }}
                      onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                      onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                    >
                      Enregistrer
                    </Button>
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('montantEncaisse') ? 'editable' : ''}`}
                    onClick={canEditField('montantEncaisse') ? () => startEditing('montantEncaisse', contact.montantEncaisse) : undefined}
                  >
                    {contact.montantEncaisse || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('bonus') && (
              <div>
                <Label className="text-slate-600">Bonus</Label>
                {editingField === 'bonus' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
                    <Input
                      type="number"
                      step="0.01"
                      value={fieldValue}
                      onChange={(e) => setFieldValue(e.target.value)}
                      disabled={isSaving}
                      className="flex-1 h-10"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => saveField('bonus')} 
                      disabled={isSaving}
                      style={{ backgroundColor: '#22c55e', color: 'white' }}
                      onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                      onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                    >
                      Enregistrer
                    </Button>
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('bonus') ? 'editable' : ''}`}
                    onClick={canEditField('bonus') ? () => startEditing('bonus', contact.bonus) : undefined}
                  >
                    {contact.bonus || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('paiement') && (
              <div>
                <Label className="text-slate-600">PAIEMENT</Label>
                {editingField === 'paiement' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
                    <Select
                      value={fieldValue || 'none'}
                      onValueChange={(value) => setFieldValue(value === 'none' ? '' : value)}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="flex-1 h-10">
                        <SelectValue placeholder="Sélectionner un mode de paiement" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        <SelectItem value="carte">Carte</SelectItem>
                        <SelectItem value="virement">Virement</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      size="sm" 
                      onClick={() => saveField('paiement')} 
                      disabled={isSaving}
                      style={{ backgroundColor: '#22c55e', color: 'white' }}
                      onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                      onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                    >
                      Enregistrer
                    </Button>
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('paiement') ? 'editable' : ''}`}
                    onClick={canEditField('paiement') ? () => startEditing('paiement', contact.paiement) : undefined}
                  >
                    {contact.paiement === 'carte' ? 'Carte' : contact.paiement === 'virement' ? 'Virement' : '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('contrat') && (
              <div>
                <Label className="text-slate-600">Contrat</Label>
                {editingField === 'contrat' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
                    <Select
                      value={fieldValue || 'none'}
                      onValueChange={(value) => setFieldValue(value === 'none' ? '' : value)}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="flex-1 h-10">
                        <SelectValue placeholder="Sélectionner un statut de contrat" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        <SelectItem value="CONTRAT SIGNÉ">CONTRAT SIGNÉ</SelectItem>
                        <SelectItem value="CONTRAT ENVOYÉ MAIS PAS SIGNÉ">CONTRAT ENVOYÉ MAIS PAS SIGNÉ</SelectItem>
                        <SelectItem value="PAS DE CONTRAT ENVOYÉ">PAS DE CONTRAT ENVOYÉ</SelectItem>
                        <SelectItem value="J'AI SIGNÉ LE CONTRAT POUR LE CLIENT">J'AI SIGNÉ LE CONTRAT POUR LE CLIENT</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      size="sm" 
                      onClick={() => saveField('contrat')} 
                      disabled={isSaving}
                      style={{ backgroundColor: '#22c55e', color: 'white' }}
                      onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                      onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                    >
                      Enregistrer
                    </Button>
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('contrat') ? 'editable' : ''}`}
                    onClick={canEditField('contrat') ? () => startEditing('contrat', contact.contrat) : undefined}
                  >
                    {contact.contrat || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('nomDeScene') && (
              <div>
                <Label className="text-slate-600">Nom de scène</Label>
                {editingField === 'nomDeScene' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
                    <Input
                      value={fieldValue}
                      onChange={(e) => setFieldValue(e.target.value)}
                      disabled={isSaving}
                      className="flex-1 h-10"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => saveField('nomDeScene')} 
                      disabled={isSaving}
                      style={{ backgroundColor: '#22c55e', color: 'white' }}
                      onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                      onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                    >
                      Enregistrer
                    </Button>
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('nomDeScene') ? 'editable' : ''}`}
                    onClick={canEditField('nomDeScene') ? () => startEditing('nomDeScene', contact.nomDeScene) : undefined}
                  >
                    {contact.nomDeScene || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('dateProTr') && (
              <div>
                <Label className="text-slate-600">Date pro TR</Label>
                {editingField === 'dateProTr' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
                    <Input
                      value={fieldValue}
                      onChange={(e) => setFieldValue(e.target.value)}
                      disabled={isSaving}
                      className="flex-1 h-10"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => saveField('dateProTr')} 
                      disabled={isSaving}
                      style={{ backgroundColor: '#22c55e', color: 'white' }}
                      onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                      onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                    >
                      Enregistrer
                    </Button>
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('dateProTr') ? 'editable' : ''}`}
                    onClick={canEditField('dateProTr') ? () => startEditing('dateProTr', contact.dateProTr) : undefined}
                  >
                    {contact.dateProTr || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('potentiel') && (
              <div>
                <Label className="text-slate-600">Potentiel</Label>
                {editingField === 'potentiel' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
                    <Input
                      value={fieldValue}
                      onChange={(e) => setFieldValue(e.target.value)}
                      disabled={isSaving}
                      className="flex-1 h-10"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => saveField('potentiel')} 
                      disabled={isSaving}
                      style={{ backgroundColor: '#22c55e', color: 'white' }}
                      onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                      onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                    >
                      Enregistrer
                    </Button>
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('potentiel') ? 'editable' : ''}`}
                    onClick={canEditField('potentiel') ? () => startEditing('potentiel', contact.potentiel) : undefined}
                  >
                    {contact.potentiel || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('produit') && (
              <div>
                <Label className="text-slate-600">Produit</Label>
                {editingField === 'produit' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
                    <Input
                      value={fieldValue}
                      onChange={(e) => setFieldValue(e.target.value)}
                      disabled={isSaving}
                      className="flex-1 h-10"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => saveField('produit')} 
                      disabled={isSaving}
                      style={{ backgroundColor: '#22c55e', color: 'white' }}
                      onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                      onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                    >
                      Enregistrer
                    </Button>
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('produit') ? 'editable' : ''}`}
                    onClick={canEditField('produit') ? () => startEditing('produit', contact.produit) : undefined}
                  >
                    {contact.produit || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('confirmateurEmail') && (
              <div>
                <Label className="text-slate-600">Mail Confirmateur</Label>
                {editingField === 'confirmateurEmail' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
                    <Input
                      type="email"
                      value={fieldValue}
                      onChange={(e) => setFieldValue(e.target.value)}
                      disabled={isSaving}
                      className="flex-1 h-10"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => saveField('confirmateurEmail')} 
                      disabled={isSaving}
                      style={{ backgroundColor: '#22c55e', color: 'white' }}
                      onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                      onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                    >
                      Enregistrer
                    </Button>
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('confirmateurEmail') ? 'editable' : ''}`}
                    onClick={canEditField('confirmateurEmail') ? () => startEditing('confirmateurEmail', contact.confirmateurEmail) : undefined}
                  >
                    {contact.confirmateurEmail || '-'}
                  </div>
                )}
              </div>
            )}
            {canViewField('confirmateurTelephone') && (
              <div>
                <Label className="text-slate-600">Téléphone Confirmateur</Label>
                {editingField === 'confirmateurTelephone' ? (
                  <div className="contact-field-input-wrapper" ref={editingFieldRef}>
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
                      onClick={() => saveField('confirmateurTelephone')} 
                      disabled={isSaving}
                      style={{ backgroundColor: '#22c55e', color: 'white' }}
                      onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#16a34a')}
                      onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#22c55e')}
                    >
                      Enregistrer
                    </Button>
                  </div>
                ) : (
                  <div 
                    className={`contact-field-display ${canEditField('confirmateurTelephone') ? 'editable' : ''}`}
                    onClick={canEditField('confirmateurTelephone') ? () => startEditing('confirmateurTelephone', contact.confirmateurTelephone) : undefined}
                  >
                    {formatPhoneNumber(contact.confirmateurTelephone) || '-'}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Document checkboxes section */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <Label className="text-slate-600 mb-4 block">Documents</Label>
            <div className="space-y-3">
              {/* CNI */}
              <div className="flex items-center justify-between p-3 border border-slate-200">
                <Label className="text-sm font-normal">
                  CNI
                </Label>
                {hasDocument('CNI') ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <div className="flex-shrink-0">
                    <input
                      type="file"
                      id={`cni-upload-${contactId}`}
                      ref={cniUploadRef}
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleDocumentUpload('CNI', file);
                          // Reset input
                          if (e.target) {
                            e.target.value = '';
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        cniUploadRef.current?.click();
                      }}
                      disabled={uploadingDocument === 'CNI'}
                      className="h-8 text-xs"
                    >
                      {uploadingDocument === 'CNI' ? (
                        'Upload...'
                      ) : (
                        <>
                          <Upload className="w-3 h-3 mr-1" />
                          Importer
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Justificatif de domicile */}
              <div className="flex items-center justify-between p-3 border border-slate-200">
                <Label className="text-sm font-normal">
                  Justif. domicile
                </Label>
                {hasDocument('JUSTIFICATIF_DOMICILE') ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <div className="flex-shrink-0">
                    <input
                      type="file"
                      id={`justif-upload-${contactId}`}
                      ref={justifUploadRef}
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleDocumentUpload('JUSTIFICATIF_DOMICILE', file);
                          if (e.target) {
                            e.target.value = '';
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        justifUploadRef.current?.click();
                      }}
                      disabled={uploadingDocument === 'JUSTIFICATIF_DOMICILE'}
                      className="h-8 text-xs"
                    >
                      {uploadingDocument === 'JUSTIFICATIF_DOMICILE' ? (
                        'Upload...'
                      ) : (
                        <>
                          <Upload className="w-3 h-3 mr-1" />
                          Importer
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Selfie */}
              <div className="flex items-center justify-between p-3 border border-slate-200">
                <Label className="text-sm font-normal">
                  Selfie
                </Label>
                {hasDocument('SELFIE') ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <div className="flex-shrink-0">
                    <input
                      type="file"
                      id={`selfie-upload-${contactId}`}
                      ref={selfieUploadRef}
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleDocumentUpload('SELFIE', file);
                          if (e.target) {
                            e.target.value = '';
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        selfieUploadRef.current?.click();
                      }}
                      disabled={uploadingDocument === 'SELFIE'}
                      className="h-8 text-xs"
                    >
                      {uploadingDocument === 'SELFIE' ? (
                        'Upload...'
                      ) : (
                        <>
                          <Upload className="w-3 h-3 mr-1" />
                          Importer
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* RIB */}
              <div className="flex items-center justify-between p-3 border border-slate-200">
                <Label className="text-sm font-normal">
                  RIB
                </Label>
                {hasDocument('RIB') ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <div className="flex-shrink-0">
                    <input
                      type="file"
                      id={`rib-upload-${contactId}`}
                      ref={ribUploadRef}
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleDocumentUpload('RIB', file);
                          if (e.target) {
                            e.target.value = '';
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        ribUploadRef.current?.click();
                      }}
                      disabled={uploadingDocument === 'RIB'}
                      className="h-8 text-xs"
                    >
                      {uploadingDocument === 'RIB' ? (
                        'Upload...'
                      ) : (
                        <>
                          <Upload className="w-3 h-3 mr-1" />
                          Importer
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-3 contact-notes-column">
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
                    <Tabs value={selectedCategoryId} onValueChange={setSelectedCategoryId} className="mb-2 w-full">
                      <TabsList className="h-8 w-full">
                        {accessibleCategories.map((category) => (
                          <TabsTrigger key={category.id} value={category.id} className="text-xs px-2 py-1 flex-1">
                            {category.name}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  ) : null}
              
                  {/* Show form only if user has create permission for informations tab AND category permission */}
                  {canCreateInSelectedCategory && canCreateInformationsTab && (
                    <form onSubmit={handleCreateNote} className="space-y-2">
                      <Textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Ajouter une note..."
                        rows={2}
                        className="resize-none text-sm w-full"
                        disabled={isSubmittingNote}
                      />
                      <Button 
                        type="submit" 
                        size="sm" 
                        className="w-full"
                        disabled={isSubmittingNote || !noteText.trim()}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        {isSubmittingNote ? 'Envoi...' : 'Enregistrer'}
                      </Button>
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
                          .map((note, index, array) => {
                            const permissions = notePermissionsMap.get(note.id) || { canEdit: false, canDelete: false };
                            const isLast = index === array.length - 1;
                            return (
                              <div key={note.id} className={!isLast ? "pb-3 mb-3 border-b border-slate-200" : ""}>
                                <NoteItemCompact 
                                  note={note}
                                  onDelete={handleDeleteNote}
                                  onEdit={handleEditNote}
                                  canEdit={permissions.canEdit}
                                  canDelete={permissions.canDelete}
                                />
                              </div>
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
        </div>
      </div>

      {/* Create Appointment Modal */}
      {isAppointmentModalOpen && (
        <div className="modal-overlay" onClick={() => {
          // If modal was opened from status change, cancel the status change
          if (isEventModalFromStatus && pendingStatusChange) {
            setPendingStatusChange(null);
            cancelEditing(); // Cancel the status edit
          }
          setIsAppointmentModalOpen(false);
          setIsEventModalFromStatus(false);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{isEventModalFromStatus ? 'Créer un événement (requis)' : 'Nouveau rendez-vous'}</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  // If modal was opened from status change, cancel the status change
                  if (isEventModalFromStatus && pendingStatusChange) {
                    setPendingStatusChange(null);
                    cancelEditing(); // Cancel the status edit
                  }
                  setIsAppointmentModalOpen(false);
                  setIsEventModalFromStatus(false);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleCreateAppointment} className="modal-form">
              {isEventModalFromStatus && pendingStatusChange && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  <p className="font-medium">Événement requis</p>
                  <p className="text-xs mt-1">Vous devez créer un événement pour valider le changement de statut.</p>
                </div>
              )}
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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Select
                    value={appointmentFormData.hour}
                    onValueChange={(value) => setAppointmentFormData({ ...appointmentFormData, hour: value })}
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
                    value={appointmentFormData.minute}
                    onValueChange={(value) => setAppointmentFormData({ ...appointmentFormData, minute: value })}
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

              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // If modal was opened from status change, cancel the status change
                    if (isEventModalFromStatus && pendingStatusChange) {
                      setPendingStatusChange(null);
                      cancelEditing(); // Cancel the status edit
                    }
                    setIsAppointmentModalOpen(false);
                    setIsEventModalFromStatus(false);
                    setAppointmentFormData({ date: '', hour: '09', minute: '00', userId: currentUser?.id || '' });
                  }}
                  disabled={isSubmittingAppointment}
                >
                  Annuler
                </Button>
                {canCreatePlanning && canCreateInformationsTab && (
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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Select
                    value={editAppointmentFormData.hour}
                    onValueChange={(value) => setEditAppointmentFormData({ ...editAppointmentFormData, hour: value })}
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
                    value={editAppointmentFormData.minute}
                    onValueChange={(value) => setEditAppointmentFormData({ ...editAppointmentFormData, minute: value })}
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
                <Label htmlFor="edit-appointment-user">Utilisateur</Label>
                <Select
                  value={editAppointmentFormData.userId ? String(editAppointmentFormData.userId) : (currentUser?.id ? String(currentUser.id) : '')}
                  onValueChange={(value) => setEditAppointmentFormData({ ...editAppointmentFormData, userId: value })}
                >
                  <SelectTrigger id="edit-appointment-user">
                    <SelectValue placeholder="Sélectionner un utilisateur" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
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
                {canEditPlanning && canEditInformationsTab && (
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

      {/* Status Change Modal */}
      {isStatusModalOpen && contact && (
        <div className="modal-overlay" onClick={() => {
          setIsStatusModalOpen(false);
          setSelectedStatusId('');
          setStatusChangeNote('');
          setStatusChangeNoteCategoryId('');
          setStatusModalFilterType('lead');
          setFieldErrors({});
          // Reset client form
          setClientFormData({
            platformId: '',
            teleoperatorId: '',
            nomDeScene: '',
            firstName: '',
            lastName: '',
            emailClient: '',
            telephoneClient: '',
            portableClient: '',
            contrat: '',
            sourceId: '',
            montantEncaisse: '',
            bonus: '',
            paiement: '',
            noteGestionnaire: '',
            noteCategoryId: ''
          });
          setSelectedNoteCategoryId('');
          // Reset event fields
          setEventDate('');
          setEventHour('09');
          setEventMinute('00');
          setEventTeleoperatorId('');
        }}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: selectedStatusIsClientDefault ? '1200px' : '600px', 
              maxHeight: '90vh', 
              overflow: 'visible',
              display: 'flex',
              flexDirection: 'row',
              gap: '20px'
            }}
          >
            {/* Left Column - Status Selection */}
            <div style={{ flex: selectedStatusIsClientDefault ? '0 0 400px' : '1', minWidth: 0, display: 'flex', flexDirection: 'column', maxHeight: '80vh', overflow: 'visible' }}>
              <div className="modal-header" style={{ flexShrink: 0 }}>
                <h2 className="modal-title">Modifier le statut</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="modal-close"
                  onClick={() => {
                    setIsStatusModalOpen(false);
                    setSelectedStatusId('');
                    setStatusChangeNote('');
                    setStatusChangeNoteCategoryId('');
                    setStatusModalFilterType('lead');
                    setFieldErrors({});
                    // Reset client form
                    setClientFormData({
                      platformId: '',
                      teleoperatorId: '',
                      nomDeScene: '',
                      firstName: '',
                      lastName: '',
                      emailClient: '',
                      telephoneClient: '',
                      portableClient: '',
                      contrat: '',
                      sourceId: '',
                      montantEncaisse: '',
                      bonus: '',
                      paiement: '',
                      noteGestionnaire: '',
                      noteCategoryId: ''
                    });
                    setSelectedNoteCategoryId('');
                    // Reset event fields
                    setEventDate('');
                    setEventHour('09');
                    setEventMinute('00');
                    setEventTeleoperatorId('');
                  }}
                >
                  <X className="planning-icon-md" />
                </Button>
              </div>
              <div className="modal-form" style={{ overflowY: 'auto', overflowX: 'hidden', flex: 1, minHeight: 0 }}>
              <div className="modal-form-field">
                <Label htmlFor="statusSelect">Statut</Label>
                {(() => {
                  // Check if user has any view permission on client statuses
                  const clientStatuses = statuses.filter((s: any) => s.type === 'client');
                  const clientStatusesWithPermission = clientStatuses.filter((status: any) => {
                    if (!status.id || status.id.trim() === '') return false;
                    const normalizedStatusId = String(status.id).trim();
                    return statusViewPermissions.has(normalizedStatusId);
                  });
                  
                  // Hide tabs if:
                  // 1. User has no permission on any client status, OR
                  // 2. User only has permission on client_default status
                  const clientDefaultStatus = clientStatuses.find((s: any) => s.clientDefault === true);
                  const shouldHideTabs = clientStatusesWithPermission.length === 0 || 
                                         (clientDefaultStatus && 
                                          clientStatusesWithPermission.length === 1 && 
                                          clientStatusesWithPermission[0].id === clientDefaultStatus.id);
                  
                  if (shouldHideTabs) {
                    return null;
                  }
                  
                  return (
                    <div className="mb-2 flex gap-2">
                      <Button
                        type="button"
                        variant={statusModalFilterType === 'lead' ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusModalFilterType('lead');
                        }}
                      >
                        Lead
                      </Button>
                      <Button
                        type="button"
                        variant={statusModalFilterType === 'client' ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusModalFilterType('client');
                        }}
                      >
                        Client
                      </Button>
    </div>
  );
                })()}
                <Select
                  value={selectedStatusId ? selectedStatusId.toString() : undefined}
                  onValueChange={(value) => {
                    setSelectedStatusId(value);
                    // Check if selected status is client default
                    const selectedStatus = statuses.find(s => s.id === value);
                    if (selectedStatus?.clientDefault === true) {
                      // Pre-fill form with existing contact data
                      // Prefill teleoperatorId with current user if they are a teleoperateur
                      const defaultTeleoperatorId = currentUser?.isTeleoperateur === true 
                        ? currentUser.id 
                        : (contact.teleoperatorId || contact.managerId || '');
                      
                      setClientFormData({
                        platformId: contact.platformId || '',
                        teleoperatorId: defaultTeleoperatorId,
                        nomDeScene: contact.nomDeScene || '',
                        firstName: contact.firstName || '',
                        lastName: contact.lastName || '',
                        emailClient: contact.email || '',
                        telephoneClient: contact.phone || '',
                        portableClient: contact.mobile || '',
                        contrat: contact.contrat || '',
                        sourceId: contact.sourceId || '',
                        montantEncaisse: contact.montantEncaisse || '',
                        bonus: contact.bonus || '',
                        paiement: contact.paiement || '',
                        noteGestionnaire: '',
                        noteCategoryId: accessibleCategories.length > 0 ? accessibleCategories[0].id : ''
                      });
                      setSelectedNoteCategoryId(accessibleCategories.length > 0 ? accessibleCategories[0].id : '');
                    } else {
                      // Reset client form if not client default
                      setClientFormData({
                        platformId: '',
                        teleoperatorId: '',
                        nomDeScene: '',
                        firstName: '',
                        lastName: '',
                        emailClient: '',
                        telephoneClient: '',
                        portableClient: '',
                        contrat: '',
                        sourceId: '',
                        montantEncaisse: '',
                        bonus: '',
                        paiement: '',
                        noteGestionnaire: '',
                        noteCategoryId: ''
                      });
                      setSelectedNoteCategoryId('');
                    }
                  }}
                >
                  <SelectTrigger id="statusSelect">
                    {selectedStatusId ? (() => {
                      // Find the selected status (can be from any type for display purposes)
                      const selectedStatus = statuses.find((s: any) => s.id === selectedStatusId);
                      if (selectedStatus) {
                        const normalizedStatusId = String(selectedStatus.id).trim();
                        // Check if contact is in fosse (teleoperator and confirmateur are null/empty)
                        const contactInFosse = isContactInFosse(contact);
                        // Check if user has view permission on this status - use fosse_statuses if contact is in fosse
                        const hasPermission = contactInFosse 
                          ? fosseStatusViewPermissions.has(normalizedStatusId)
                          : statusViewPermissions.has(normalizedStatusId);
                        if (hasPermission) {
                          return (
                            <SelectValue asChild>
                              <span 
                                className="inline-block px-2 py-1 rounded text-sm"
                                style={{
                                  backgroundColor: selectedStatus.color || '#e5e7eb',
                                  color: selectedStatus.color ? '#000000' : '#374151'
                                }}
                              >
                                {selectedStatus.name}
                              </span>
                            </SelectValue>
                          );
                        }
                      }
                      return <SelectValue placeholder="Sélectionner un statut" />;
                    })() : (
                      <SelectValue placeholder="Sélectionner un statut" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {statuses
                      .filter((status) => {
                        if (!status.id || status.id.trim() === '') return false;
                        const normalizedStatusId = String(status.id).trim();
                        
                        // Check if contact is in fosse (teleoperator and confirmateur are null/empty)
                        const contactInFosse = isContactInFosse(contact);
                        
                        // Filter by view permissions - use fosse_statuses if contact is in fosse, otherwise use regular statuses
                        if (contactInFosse) {
                          if (!fosseStatusViewPermissions.has(normalizedStatusId)) return false;
                        } else {
                          if (!statusViewPermissions.has(normalizedStatusId)) return false;
                        }
                        
                        // Filter by status type - only show statuses matching the current filter type
                        // Strict check: must match exactly and be either 'lead' or 'client'
                        if (!status.type || status.type !== statusModalFilterType) {
                          return false;
                        }
                        // Additional safety check: ensure type is valid
                        if (status.type !== 'lead' && status.type !== 'client') {
                          return false;
                        }
                        return true;
                      })
                      .map((status) => (
                        <SelectItem key={status.id} value={status.id.toString()}>
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
                {(() => {
                  // Check if current contact status is already type='client'
                  const currentStatus = contact?.statusId ? statuses.find((s: any) => s.id === contact.statusId) : null;
                  if (currentStatus && currentStatus.type === 'client') {
                    return null; // Don't show button if already a client status
                  }
                  
                  // Find the client_default status
                  const clientDefaultStatus = statuses.find((s: any) => s.clientDefault === true && s.type === 'client');
                  if (clientDefaultStatus && clientDefaultStatus.id) {
                    const normalizedStatusId = String(clientDefaultStatus.id).trim();
                    // Check if user has view permission on this status
                    if (statusViewPermissions.has(normalizedStatusId)) {
                      return (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setSelectedStatusId(clientDefaultStatus.id.toString());
                            // Switch to client filter if not already
                            if (statusModalFilterType !== 'client') {
                              setStatusModalFilterType('client');
                            }
                            // Pre-fill form with existing contact data
                            // Prefill teleoperatorId with current user if they are a teleoperateur
                            const defaultTeleoperatorId = currentUser?.isTeleoperateur === true 
                              ? currentUser.id 
                              : (contact.teleoperatorId || contact.managerId || '');
                            
                            setClientFormData({
                              platformId: contact.platformId || '',
                              teleoperatorId: defaultTeleoperatorId,
                              nomDeScene: contact.nomDeScene || '',
                              firstName: contact.firstName || '',
                              lastName: contact.lastName || '',
                              emailClient: contact.email || '',
                              telephoneClient: contact.phone || '',
                              portableClient: contact.mobile || '',
                              contrat: contact.contrat || '',
                              sourceId: contact.sourceId || '',
                              montantEncaisse: contact.montantEncaisse || '',
                              bonus: contact.bonus || '',
                              paiement: contact.paiement || '',
                              noteGestionnaire: '',
                              noteCategoryId: accessibleCategories.length > 0 ? accessibleCategories[0].id : ''
                            });
                            setSelectedNoteCategoryId(accessibleCategories.length > 0 ? accessibleCategories[0].id : '');
                          }}
                          className="mt-2"
                          title={`Définir comme statut par défaut client: ${clientDefaultStatus.name}`}
                          style={{ backgroundColor: '#22c55e', color: 'white' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#16a34a')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#22c55e')}
                        >
                          Nouveau client
                        </Button>
                      );
                    }
                  }
                  return null;
                })()}
              </div>
              <div className="modal-form-field">
                <Label htmlFor="statusNote" style={fieldErrors.note ? { color: '#ef4444' } : {}}>
                  Note <span style={{ color: '#ef4444' }}>*</span>
                </Label>
                {/* Show category tabs if user has permission and categories are available */}
                {accessibleCategories.length > 0 && (
                  <div className="mb-2 flex gap-2">
                    {accessibleCategories.map((category) => (
                      <Button
                        key={category.id}
                        type="button"
                        variant={statusChangeNoteCategoryId === category.id ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setStatusChangeNoteCategoryId(category.id);
                        }}
                      >
                        {category.name}
                      </Button>
                    ))}
                  </div>
                )}
                <Textarea
                  id="statusNote"
                  placeholder="Saisissez une note expliquant le changement de statut..."
                  value={statusChangeNote}
                  onChange={(e) => {
                    setStatusChangeNote(e.target.value);
                    if (fieldErrors.note) {
                      setFieldErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.note;
                        return newErrors;
                      });
                    }
                  }}
                  rows={4}
                  className={`resize-none ${fieldErrors.note ? 'border-red-500' : ''}`}
                  required
                />
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  Une note est obligatoire pour changer le statut.
                </p>
              </div>
              {/* Event fields - show when selected status has isEvent=true */}
              {(() => {
                // Use String() to ensure consistent type comparison
                const selectedStatus = statuses.find(s => String(s.id) === String(selectedStatusId));
                // Check both isEvent (camelCase) and is_event (snake_case) for compatibility
                const isEventStatus = selectedStatus && (selectedStatus.isEvent === true || selectedStatus.is_event === true);
                if (!isEventStatus || !canCreatePlanning) return null;
                
                const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
                const minutes = ['00', '15', '30', '45'];
                
                return (
                  <>
                    <div className="modal-form-field">
                      <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                        <p className="font-medium">Événement requis</p>
                        <p className="text-xs mt-1">Vous devez créer un événement pour valider le changement de statut.</p>
                      </div>
                    </div>
                    <div className="modal-form-field">
                      <Label htmlFor="eventDate">Date de l'événement <span style={{ color: '#ef4444' }}>*</span></Label>
                      <DateInput
                        id="eventDate"
                        value={eventDate}
                        onChange={(value) => setEventDate(value)}
                        required
                      />
                    </div>
                    <div className="modal-form-field">
                      <Label>Heure <span style={{ color: '#ef4444' }}>*</span></Label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Select
                          value={eventHour}
                          onValueChange={(value) => setEventHour(value)}
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
                          value={eventMinute}
                          onValueChange={(value) => setEventMinute(value)}
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
                      <Label htmlFor="eventTeleoperator">Téléopérateur</Label>
                      <Select
                        value={eventTeleoperatorId || 'none'}
                        onValueChange={(value) => setEventTeleoperatorId(value === 'none' ? '' : value)}
                        disabled={isSavingClientForm || !canEditFieldInModal('teleoperatorId', selectedStatusId)}
                      >
                        <SelectTrigger id="eventTeleoperator">
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
                    </div>
                  </>
                );
              })()}
              <div className="modal-form-actions">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsStatusModalOpen(false);
                    setSelectedStatusId('');
                    setStatusChangeNote('');
                    setStatusChangeNoteCategoryId('');
                    setStatusModalFilterType('lead');
                    setFieldErrors({});
                    // Reset event fields
                    setEventDate('');
                    setEventHour('09');
                    setEventMinute('00');
                    setEventTeleoperatorId('');
                    // Reset client form
                    setClientFormData({
                      platformId: '',
                      teleoperatorId: '',
                      nomDeScene: '',
                      firstName: '',
                      lastName: '',
                      emailClient: '',
                      telephoneClient: '',
                      portableClient: '',
                      contrat: '',
                      sourceId: '',
                      montantEncaisse: '',
                      bonus: '',
                      paiement: '',
                      noteGestionnaire: '',
                      noteCategoryId: ''
                    });
                    setSelectedNoteCategoryId('');
                  }}
                >
                  Annuler
                </Button>
                {canEditContact(contact) && (
                  <Button 
                    type="button" 
                    onClick={handleUpdateStatus}
                    disabled={
                      isSavingClientForm ||
                      !statusChangeNote.trim() ||
                      ((() => {
                        // Use String() to ensure consistent type comparison
                        const selectedStatus = statuses.find(s => String(s.id) === String(selectedStatusId));
                        // Check both isEvent (camelCase) and is_event (snake_case) for compatibility
                        const isEventStatus = selectedStatus && (selectedStatus.isEvent === true || selectedStatus.is_event === true);
                        return isEventStatus && canCreatePlanning && canCreateInformationsTab && (!eventDate || !eventHour || !eventMinute);
                      })())
                    }
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isSavingClientForm ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                )}
              </div>
              </div>
            </div>

            {/* Right Column - Client Form (shown when client default status is selected) */}
            {selectedStatusIsClientDefault && (
              <div style={{ flex: '1', minWidth: 0, borderLeft: '1px solid #e5e7eb', paddingLeft: '20px', display: 'flex', flexDirection: 'column', maxHeight: '80vh', overflow: 'visible' }}>
                <div className="modal-header" style={{ flexShrink: 0 }}>
                  <h2 className="modal-title">Fiche client</h2>
                </div>
                <div className="modal-form" style={{ overflowY: 'auto', overflowX: 'hidden', flex: 1, minHeight: 0 }}>
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-sm text-blue-800">
                    <p className="font-semibold mb-2">Pour que le gestionnaire de compte reçoive toutes les informations nécessaires, merci de remplir la fiche de manière exacte, complète et en vous assurant qu'elle correspond exactement.</p>
                    <p className="mb-2">L'objectif : une fiche claire et fidèle aux échanges avec le client afin que le profil client sur la plateforme soit également en correspondance avec son identité.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="modal-form-field">
                        <Label htmlFor="client-platform" style={fieldErrors.platformId ? { color: '#ef4444' } : {}}>Plateforme <span style={{ color: '#ef4444' }}>*</span></Label>
                        <Select
                          value={clientFormData.platformId || 'none'}
                          onValueChange={(value) => updateFormField('platformId', value === 'none' ? '' : value)}
                          disabled={isSavingClientForm || !canEditFieldInModal('platformId', selectedStatusId)}
                        >
                          <SelectTrigger id="client-platform" className={fieldErrors.platformId ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Sélectionner une plateforme" />
                          </SelectTrigger>
                          <SelectContent style={{ zIndex: 10010 }}>
                            <SelectItem value="none">Aucune</SelectItem>
                            {platforms
                              .filter((platform) => platform.id && platform.id.trim() !== '')
                              .map((platform) => (
                                <SelectItem key={platform.id} value={platform.id}>
                                  {platform.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="modal-form-field">
                        <Label htmlFor="client-teleoperator" style={fieldErrors.teleoperatorId ? { color: '#ef4444' } : {}}>Nom du teleoperateur <span style={{ color: '#ef4444' }}>*</span></Label>
                        <Select
                          value={clientFormData.teleoperatorId || 'none'}
                          onValueChange={(value) => updateFormField('teleoperatorId', value === 'none' ? '' : value)}
                          disabled={isSavingClientForm || !canEditFieldInModal('teleoperatorId', selectedStatusId)}
                        >
                          <SelectTrigger id="client-teleoperator" className={fieldErrors.teleoperatorId ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Sélectionner un téléopérateur" />
                          </SelectTrigger>
                          <SelectContent style={{ zIndex: 10010 }}>
                            <SelectItem value="none">Aucun</SelectItem>
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
                      </div>
                    </div>

                    <div className="modal-form-field">
                      <Label htmlFor="client-nom-scene" style={fieldErrors.nomDeScene ? { color: '#ef4444' } : {}}>Nom de scène <span style={{ color: '#ef4444' }}>*</span></Label>
                      <Input
                        id="client-nom-scene"
                        value={clientFormData.nomDeScene}
                        onChange={(e) => updateFormField('nomDeScene', e.target.value)}
                        disabled={isSavingClientForm || !canEditFieldInModal('nomDeScene', selectedStatusId)}
                        required
                        className={fieldErrors.nomDeScene ? 'border-red-500' : ''}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="modal-form-field">
                        <Label htmlFor="client-prenom" style={fieldErrors.firstName ? { color: '#ef4444' } : {}}>Prenom du client <span style={{ color: '#ef4444' }}>*</span></Label>
                        <Input
                          id="client-prenom"
                          value={clientFormData.firstName}
                          onChange={(e) => updateFormField('firstName', e.target.value)}
                          disabled={isSavingClientForm || !canEditFieldInModal('firstName', selectedStatusId)}
                          required
                          className={fieldErrors.firstName ? 'border-red-500' : ''}
                        />
                      </div>
                      <div className="modal-form-field">
                        <Label htmlFor="client-nom">Nom du client</Label>
                        <Input
                          id="client-nom"
                          value={clientFormData.lastName}
                          onChange={(e) => setClientFormData({ ...clientFormData, lastName: e.target.value })}
                          disabled={isSavingClientForm || !canEditFieldInModal('lastName', selectedStatusId)}
                        />
                      </div>
                    </div>

                    <div className="modal-form-field">
                      <Label htmlFor="client-email" style={fieldErrors.emailClient ? { color: '#ef4444' } : {}}>E-mail du client <span style={{ color: '#ef4444' }}>*</span></Label>
                      <Input
                        id="client-email"
                        type="email"
                        value={clientFormData.emailClient}
                        onChange={(e) => updateFormField('emailClient', e.target.value)}
                        disabled={isSavingClientForm || !canEditFieldInModal('email', selectedStatusId)}
                        required
                        className={fieldErrors.emailClient ? 'border-red-500' : ''}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="modal-form-field">
                        <Label htmlFor="client-telephone" style={fieldErrors.telephoneClient ? { color: '#ef4444' } : {}}>Téléphone 1 <span style={{ color: '#ef4444' }}>*</span></Label>
                        <Input
                          id="client-telephone"
                          type="number"
                          value={clientFormData.telephoneClient}
                          onChange={(e) => updateFormField('telephoneClient', e.target.value)}
                          disabled={isSavingClientForm || !canEditFieldInModal('phone', selectedStatusId)}
                          required
                          className={fieldErrors.telephoneClient ? 'border-red-500' : ''}
                        />
                      </div>

                      <div className="modal-form-field">
                        <Label htmlFor="client-portable">Téléphone 2</Label>
                        <Input
                          id="client-portable"
                          type="number"
                          value={clientFormData.portableClient}
                          onChange={(e) => setClientFormData({ ...clientFormData, portableClient: e.target.value })}
                          disabled={isSavingClientForm || !canEditFieldInModal('mobile', selectedStatusId)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="modal-form-field">
                        <Label htmlFor="client-contrat" style={fieldErrors.contrat ? { color: '#ef4444' } : {}}>Contrat <span style={{ color: '#ef4444' }}>*</span></Label>
                        <Select
                          value={clientFormData.contrat || 'none'}
                          onValueChange={(value) => updateFormField('contrat', value === 'none' ? '' : value)}
                          disabled={isSavingClientForm || !canEditFieldInModal('contrat', selectedStatusId)}
                        >
                          <SelectTrigger id="client-contrat" className={fieldErrors.contrat ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Sélectionner un statut de contrat" />
                          </SelectTrigger>
                          <SelectContent style={{ zIndex: 10010 }}>
                            <SelectItem value="none">Aucun</SelectItem>
                            <SelectItem value="CONTRAT SIGNÉ">CONTRAT SIGNÉ</SelectItem>
                            <SelectItem value="CONTRAT ENVOYÉ MAIS PAS SIGNÉ">CONTRAT ENVOYÉ MAIS PAS SIGNÉ</SelectItem>
                            <SelectItem value="PAS DE CONTRAT ENVOYÉ">PAS DE CONTRAT ENVOYÉ</SelectItem>
                            <SelectItem value="J'AI SIGNÉ LE CONTRAT POUR LE CLIENT">J'AI SIGNÉ LE CONTRAT POUR LE CLIENT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="modal-form-field">
                        <Label htmlFor="client-source" style={fieldErrors.sourceId ? { color: '#ef4444' } : {}}>Source <span style={{ color: '#ef4444' }}>*</span></Label>
                        <Select
                          value={clientFormData.sourceId || 'none'}
                          onValueChange={(value) => updateFormField('sourceId', value === 'none' ? '' : value)}
                          disabled={isSavingClientForm || !canEditFieldInModal('sourceId', selectedStatusId)}
                        >
                          <SelectTrigger id="client-source" className={fieldErrors.sourceId ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Sélectionner une source" />
                          </SelectTrigger>
                          <SelectContent style={{ zIndex: 10010 }}>
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
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="modal-form-field">
                        <Label htmlFor="client-montant" style={fieldErrors.montantEncaisse ? { color: '#ef4444' } : {}}>Montant encaissé <span style={{ color: '#ef4444' }}>*</span></Label>
                        <Input
                          id="client-montant"
                          type="number"
                          step="0.01"
                          value={clientFormData.montantEncaisse}
                          onChange={(e) => updateFormField('montantEncaisse', e.target.value)}
                          disabled={isSavingClientForm || !canEditFieldInModal('montantEncaisse', selectedStatusId)}
                          required
                          className={fieldErrors.montantEncaisse ? 'border-red-500' : ''}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Merci d'indiquer dans la description le montant réellement prélevé par notre TPE, c'est-à-dire le montant déjà enregistré dans nos comptes, et non le montant inscrit sur le contrat. Si virement, merci d'y inscrire 0 (si virement mollie, directement envoyé a Cléo donc y mettre 0)
                        </p>
                      </div>

                      <div className="modal-form-field">
                        <Label htmlFor="client-bonus" style={fieldErrors.bonus ? { color: '#ef4444' } : {}}>Bonus <span style={{ color: '#ef4444' }}>*</span></Label>
                        <Input
                          id="client-bonus"
                          type="number"
                          step="0.01"
                          value={clientFormData.bonus}
                          onChange={(e) => updateFormField('bonus', e.target.value)}
                          disabled={isSavingClientForm || !canEditFieldInModal('bonus', selectedStatusId)}
                          required
                          className={fieldErrors.bonus ? 'border-red-500' : ''}
                        />
                      </div>
                    </div>

                    <div className="modal-form-field">
                      <Label htmlFor="client-paiement" style={fieldErrors.paiement ? { color: '#ef4444' } : {}}>Paiement <span style={{ color: '#ef4444' }}>*</span></Label>
                      <Select
                        value={clientFormData.paiement || 'none'}
                        onValueChange={(value) => updateFormField('paiement', value === 'none' ? '' : value)}
                        disabled={isSavingClientForm || !canEditFieldInModal('paiement', selectedStatusId)}
                      >
                        <SelectTrigger id="client-paiement" className={fieldErrors.paiement ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Sélectionner un mode de paiement" />
                        </SelectTrigger>
                        <SelectContent style={{ zIndex: 10010 }}>
                          <SelectItem value="none">Aucun</SelectItem>
                          <SelectItem value="carte">Carte</SelectItem>
                          <SelectItem value="virement">Virement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div style={{ paddingBottom: '1rem' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


