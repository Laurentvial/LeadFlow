import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Plus, Search, Trash2, UserCheck, X, Upload, Settings2, GripVertical, ChevronLeft, ChevronRight, Filter, Check, Maximize2, Minimize2, RefreshCw, AlertTriangle, Calendar, Clock, Send } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { DateInput } from './ui/date-input';
import { apiCall } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useUsers } from '../hooks/useUsers';
import { useSources } from '../hooks/useSources';
import { usePlatforms } from '../hooks/usePlatforms';
import { useHasPermission, useAccessibleNoteCategoryIds } from '../hooks/usePermissions';
import { useUser } from '../contexts/UserContext';
import { toast } from 'sonner';
import { formatPhoneNumber } from '../utils/phoneNumber';
import { ACCESS_TOKEN } from '../utils/constants';
import '../styles/Contacts.css';
import '../styles/PageHeader.css';
import '../styles/Modal.css';

export interface ContactListProps {
  onSelectContact: (contactId: string) => void;
  apiEndpoint: string; // e.g., '/api/contacts/' or '/api/contacts/fosse/'
  pageTitle?: string;
  pageSubtitle?: string;
  showCreateButton?: boolean;
  showImportButton?: boolean;
  createButtonPath?: string;
  importButtonPath?: string;
  // Permission functions
  canViewContact?: (contact: any) => boolean;
  canEditContact?: (contact: any, statusIdOverride?: string | null) => boolean;
  getStatusDisplayText?: (contact: any) => string;
  isTeleoperatorForContact?: (contact: any) => boolean;
  statusViewPermissions?: Set<string>;
  statusEditPermissions?: Set<string>;
  canCreate?: boolean;
  canDelete?: boolean;
  canEditGeneral?: boolean;
  canViewGeneral?: boolean;
}

export function ContactList({
  onSelectContact,
  apiEndpoint,
  pageTitle = 'Contacts',
  pageSubtitle = 'Gestion de vos contacts',
  showCreateButton = true,
  showImportButton = true,
  createButtonPath = '/contacts/add',
  importButtonPath = '/contacts/import',
  canViewContact: canViewContactProp,
  canEditContact: canEditContactProp,
  getStatusDisplayText: getStatusDisplayTextProp,
  isTeleoperatorForContact: isTeleoperatorForContactProp,
  statusViewPermissions: statusViewPermissionsProp,
  statusEditPermissions: statusEditPermissionsProp,
  canCreate: canCreateProp,
  canDelete: canDeleteProp,
  canEditGeneral: canEditGeneralProp,
  canViewGeneral: canViewGeneralProp,
}: ContactListProps) {
  const navigate = useNavigate();
  const { users, loading: usersLoading, error: usersError } = useUsers();
  const { sources, loading: sourcesLoading } = useSources();
  const { platforms, loading: platformsLoading, reload: reloadPlatforms } = usePlatforms();
  
  // Get current user for default permission functions
  const { currentUser, loading: userLoading } = useUser();
  
  // Get accessible category IDs based on view permissions (same logic as ContactInfoTab)
  const accessibleCategoryIds = useAccessibleNoteCategoryIds();
  
  // Check if user has general view permission (can see all notes regardless of category)
  const hasGeneralViewPermission = React.useMemo(() => {
    return currentUser?.permissions?.some((p: any) => 
      p.component === 'note_categories' && 
      p.action === 'view' && 
      !p.fieldName && 
      !p.statusId
    ) || false;
  }, [currentUser?.permissions]);
  
  // Helper function to filter notes by permissions (exact same logic as ContactInfoTab)
  const filterNotesByPermissions = useCallback((notes: any[]) => {
    if (!notes || notes.length === 0) {
      return [];
    }
    
    const filtered = notes.filter((note: any) => {
      // If user has general view permission, show all notes
      if (hasGeneralViewPermission) {
        return true;
      }
      // If note has no category, show it (null category notes are accessible)
      if (!note.categId) {
        return true;
      }
      // Only show if user has view permission for this category
      // Normalize both sides for comparison (handle string/number mismatches)
      const noteCategoryId = String(note.categId).trim();
      const normalizedAccessibleIds = accessibleCategoryIds.map(id => String(id).trim());
      const hasPermission = normalizedAccessibleIds.includes(noteCategoryId);
      
      if (!hasPermission) {
        console.debug(`[Notes Filter] Filtered out note ${note.id} with category "${noteCategoryId}" (type: ${typeof note.categId}). Accessible categories:`, normalizedAccessibleIds);
      }
      return hasPermission;
    });
    
    if (notes.length !== filtered.length) {
      console.debug(`[Notes Filter] Filtered ${notes.length} notes down to ${filtered.length}. Has general permission: ${hasGeneralViewPermission}, Accessible categories:`, accessibleCategoryIds);
    }
    
    return filtered;
  }, [hasGeneralViewPermission, accessibleCategoryIds]);
  
  // Check if user has permission requiring note for status change
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
  
  // Check if user has permission to edit informations tab (replaces old contacts edit permission)
  const canEditInformationsTab = React.useMemo(() => {
    if (!currentUser?.permissions) return false;
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

  // Check if user has permission to view any contact tab (replaces old contacts view permission)
  const canViewAnyContactTab = React.useMemo(() => {
    if (!currentUser?.permissions) return true; // Default to true if no permissions loaded
    const hasAnyTabPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs' && 
      p.action === 'view'
    );
    // If no contact_tabs permissions exist at all, default to true (backward compatibility)
    const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs'
    );
    if (!hasAnyContactTabsPermission) return true;
    return hasAnyTabPermission;
  }, [currentUser?.permissions]);

  // Use provided permission functions or create defaults
  // Note: canCreate and canDelete are kept for backward compatibility but may be removed later
  const canCreate = canCreateProp ?? false; // Contacts create permission is obsolete
  const canDelete = canDeleteProp ?? false; // Contacts delete permission is obsolete
  
  const statusEditPermissions = statusEditPermissionsProp ?? React.useMemo(() => {
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
  
  const statusViewPermissions = statusViewPermissionsProp ?? React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    
    const viewPerms = currentUser.permissions
      .filter((p: any) => {
        // Check for status-specific view permissions
        // These have component='statuses', action='view', and a statusId
        const matches = p.component === 'statuses' && 
               p.action === 'view' && 
               p.statusId !== null && 
               p.statusId !== undefined && 
               p.statusId !== '';
        
        return matches;
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
  const isContactInFosse = React.useCallback((contact: any): boolean => {
    if (!contact) return false;
    const teleoperatorId = contact.teleoperatorId || contact.teleoperator || '';
    const confirmateurId = contact.confirmateurId || contact.confirmateur || '';
    return (!teleoperatorId || String(teleoperatorId).trim() === '') && 
           (!confirmateurId || String(confirmateurId).trim() === '');
  }, []);
  
  const isTeleoperatorForContact = isTeleoperatorForContactProp ?? React.useCallback((contact: any): boolean => {
    if (!currentUser?.id || !contact?.teleoperatorId) {
      return false;
    }
    const userId = String(currentUser.id).trim();
    const teleoperatorId = String(contact.teleoperatorId).trim();
    return userId === teleoperatorId;
  }, [currentUser?.id]);
  
  const isConfirmateurForContact = React.useCallback((contact: any): boolean => {
    if (!currentUser?.id || !contact?.confirmateurId) {
      return false;
    }
    const userId = String(currentUser.id).trim();
    const confirmateurId = String(contact.confirmateurId).trim();
    return userId === confirmateurId;
  }, [currentUser?.id]);
  
  const canViewContact = canViewContactProp ?? React.useCallback((contact: any): boolean => {
    if (isTeleoperatorForContact(contact)) {
      return true;
    }
    if (isConfirmateurForContact(contact)) {
      return true;
    }
    const contactStatusId = contact?.statusId;
    let normalizedStatusId: string | null = null;
    if (contactStatusId !== null && contactStatusId !== undefined && contactStatusId !== '') {
      const str = String(contactStatusId).trim();
      if (str !== '') {
        normalizedStatusId = str;
      }
    }
    // Check if user has view permission on the contact's status
    if (normalizedStatusId) {
      const canViewStatus = statusViewPermissions.has(normalizedStatusId);
      return canViewStatus;
    }
    // If contact has no status, check if user can view any contact tab
    return canViewAnyContactTab;
  }, [canViewAnyContactTab, statusViewPermissions, isTeleoperatorForContact, isConfirmateurForContact]);
  
  const canEditContact = canEditContactProp ?? React.useCallback((contact: any, statusIdOverride?: string | null): boolean => {
    // First check: user must have permission to edit informations tab
    if (!canEditInformationsTab) {
      return false;
    }
    
    const contactStatusId = statusIdOverride !== undefined ? statusIdOverride : contact?.statusId;
    const normalizedStatusId = contactStatusId ? String(contactStatusId).trim() : null;
    
    // If contact has no status, only need tab permission (already checked above)
    if (!normalizedStatusId) {
      return true;
    }
    
    // If contact has a status, user MUST have status-specific edit permission
    const canEditStatus = statusEditPermissions.has(normalizedStatusId);
    return canEditStatus;
  }, [canEditInformationsTab, statusEditPermissions]);

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
  };

  // Helper function to check if user has edit permission for a specific field in modal context
  // In modal, we check if user can edit the informations tab AND (can edit current status OR has view permission on new status)
  const canEditFieldInModal = React.useCallback((fieldName: string, contact: any, newStatusId?: string | null): boolean => {
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
  }, [currentUser?.permissions, canEditContact, statusViewPermissions, canEditInformationsTab]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [totalContacts, setTotalContacts] = useState<number>(0);
  const [teams, setTeams] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Pending filters (what user is typing/selecting)
  const [pendingSearchTerm, setPendingSearchTerm] = useState('');
  const [pendingStatusType, setPendingStatusType] = useState<'all' | 'lead' | 'client'>('all');
  const [pendingItemsPerPage, setPendingItemsPerPage] = useState(50);
  const [pendingColumnFilters, setPendingColumnFilters] = useState<Record<string, string | string[] | { from?: string; to?: string }>>({});
  
  // Applied filters (what's actually being used for API calls)
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedStatusType, setAppliedStatusType] = useState<'all' | 'lead' | 'client'>('all');
  const [appliedColumnFilters, setAppliedColumnFilters] = useState<Record<string, string | string[] | { from?: string; to?: string }>>({});
  
  // Check if this is the Fosse page (needed for localStorage keys)
  const isFossePage = apiEndpoint.includes('/fosse/');
  
  // Helper function to get storage key (needed for order initialization)
  const getStorageKey = (suffix: string) => {
    return isFossePage ? `fosse-table-${suffix}` : `contacts-table-${suffix}`;
  };
  
  // Load selected order from localStorage or use default
  const getInitialSelectedOrder = (): 'created_at_asc' | 'created_at_desc' | 'updated_at_asc' | 'updated_at_desc' | 'assigned_at_asc' | 'assigned_at_desc' | 'email_asc' | 'random' => {
    const storageKey = getStorageKey('order');
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const validOrders: Array<'created_at_asc' | 'created_at_desc' | 'updated_at_asc' | 'updated_at_desc' | 'assigned_at_asc' | 'assigned_at_desc' | 'email_asc' | 'random'> = [
          'created_at_asc', 'created_at_desc', 'updated_at_asc', 'updated_at_desc', 'assigned_at_asc', 'assigned_at_desc', 'email_asc', 'random'
        ];
        if (validOrders.includes(saved as any)) {
          return saved as 'created_at_asc' | 'created_at_desc' | 'updated_at_asc' | 'updated_at_desc' | 'assigned_at_asc' | 'assigned_at_desc' | 'email_asc' | 'random';
        }
      } catch {
        // Invalid value, use default
      }
    }
    return 'created_at_desc';
  };
  
  // Order selection state - used by select dropdown
  // For Fosse page: used when settings.defaultOrder is 'none' or not set
  // For Contacts page: always used
  const [selectedOrder, setSelectedOrder] = useState<'created_at_asc' | 'created_at_desc' | 'updated_at_asc' | 'updated_at_desc' | 'assigned_at_asc' | 'assigned_at_desc' | 'email_asc' | 'random'>(getInitialSelectedOrder());
  
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Record<string, string | string[] | { from?: string; to?: string }>>({});
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [columnFilterSearchTerms, setColumnFilterSearchTerms] = useState<Record<string, string>>({});
  const [statusColumnFilterType, setStatusColumnFilterType] = useState<'lead' | 'client'>('lead');
  const [statusModalFilterType, setStatusModalFilterType] = useState<'lead' | 'client'>('lead');
  const [previousStatusColumnFilterType, setPreviousStatusColumnFilterType] = useState<'lead' | 'client'>('lead');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkTeleoperatorId, setBulkTeleoperatorId] = useState('');
  const [bulkConfirmateurId, setBulkConfirmateurId] = useState('');
  const [lastOpenedContactId, setLastOpenedContactId] = useState<string | null>(null);
  
  // Modals state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [statusChangeNote, setStatusChangeNote] = useState('');
  const [statusChangeNoteCategoryId, setStatusChangeNoteCategoryId] = useState<string>('');
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  // Event fields for status with is_event=true
  const [eventDate, setEventDate] = useState('');
  const [eventHour, setEventHour] = useState('');
  const [eventMinute, setEventMinute] = useState('');
  const [eventTeleoperatorId, setEventTeleoperatorId] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Client form state
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
  const [isSavingClientForm, setIsSavingClientForm] = useState(false);
  const [selectedNoteCategoryId, setSelectedNoteCategoryId] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [noteCategories, setNoteCategories] = useState<Array<{ id: string; name: string; orderIndex: number }>>([]);
  
  // Check if selected status is client default
  const selectedStatusIsClientDefault = React.useMemo(() => {
    if (!selectedStatusId || selectedStatusId === '') return false;
    const status = statuses.find(s => s.id === selectedStatusId);
    return status?.clientDefault === true;
  }, [selectedStatusId, statuses]);

  // Check if selected status is event
  const selectedStatusIsEvent = React.useMemo(() => {
    if (!selectedStatusId || selectedStatusId === '') return false;
    const status = statuses.find(s => s.id === selectedStatusId);
    return status?.isEvent === true || status?.is_event === true;
  }, [selectedStatusId, statuses]);
  
  // Filter categories to only show those user has view permission for
  const accessibleCategories = React.useMemo(() => {
    return noteCategories.filter(cat => accessibleCategoryIds.includes(cat.id))
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [noteCategories, accessibleCategoryIds]);
  
  // Helper function to prefill client form with contact data
  const prefillClientForm = React.useCallback((contact: any) => {
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
  }, [currentUser, accessibleCategories]);
  
  // Confirmation modal state for status change warning
  const [isStatusChangeConfirmOpen, setIsStatusChangeConfirmOpen] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<{
    type: 'teleoperator' | 'confirmateur';
    value: string;
    affectedCount: number;
  } | null>(null);
  const [notesPopoverOpen, setNotesPopoverOpen] = useState<string | null>(null);
  const [notesData, setNotesData] = useState<Record<string, any[]>>({});
  const [notesLoading, setNotesLoading] = useState<Record<string, boolean>>({});
  const hoverTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  
  // Define all available columns
  const allColumns = [
    { id: 'createdAt', label: 'Créé le', defaultVisible: true },
    { id: 'fullName', label: 'Nom entier', defaultVisible: true },
    { id: 'source', label: 'Source', defaultVisible: true },
    { id: 'phone', label: 'Téléphone 1', defaultVisible: true },
    { id: 'mobile', label: 'Telephone 2', defaultVisible: false },
    { id: 'email', label: 'E-Mail', defaultVisible: true },
    { id: 'status', label: 'Statut', defaultVisible: true },
    { id: 'updatedAt', label: 'Modifié le', defaultVisible: true },
    { id: 'notes', label: 'Notes', defaultVisible: true },
    { id: 'id', label: 'Id', defaultVisible: true },
    { id: 'firstName', label: 'Prénom', defaultVisible: false },
    { id: 'lastName', label: 'Nom', defaultVisible: false },
    { id: 'civility', label: 'Civilité', defaultVisible: false },
    { id: 'birthDate', label: 'Date de naissance', defaultVisible: false },
    { id: 'birthPlace', label: 'Lieu de naissance', defaultVisible: false },
    { id: 'address', label: 'Adresse', defaultVisible: false },
    { id: 'addressComplement', label: 'Complément d\'adresse', defaultVisible: false },
    { id: 'postalCode', label: 'Code postal', defaultVisible: false },
    { id: 'city', label: 'Ville', defaultVisible: false },
    { id: 'nationality', label: 'Nationalité', defaultVisible: false },
    { id: 'campaign', label: 'Campagne', defaultVisible: false },
    { id: 'teleoperator', label: 'Téléopérateur', defaultVisible: true },
    { id: 'assignedAt', label: 'Attribué le', defaultVisible: true },
    { id: 'confirmateur', label: 'Confirmateur', defaultVisible: true },
    { id: 'creator', label: 'Créateur', defaultVisible: false },
    { id: 'managerTeam', label: 'Équipe', defaultVisible: false },
    { id: 'previousStatus', label: 'Statut précédent', defaultVisible: false },
    { id: 'previousTeleoperator', label: 'Téléopérateur précédent', defaultVisible: false },
  ];
  
  // Load column visibility and order from localStorage or use defaults
  // Use separate localStorage keys for Contacts vs Fosse to avoid conflicts
  // Note: getStorageKey is already defined above for order initialization
  
  const getInitialColumnOrder = () => {
    const storageKey = getStorageKey('column-order');
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const savedOrder = JSON.parse(saved);
        // Ensure all columns are present (in case new columns were added)
        const allColumnIds = allColumns.map(col => col.id);
        const missingColumns = allColumnIds.filter(id => !savedOrder.includes(id));
        return [...savedOrder, ...missingColumns];
      } catch {
        return allColumns.map(col => col.id);
      }
    }
    return allColumns.map(col => col.id);
  };
  
  const getInitialVisibleColumns = () => {
    const storageKey = getStorageKey('columns');
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return allColumns.filter(col => col.defaultVisible).map(col => col.id);
      }
    }
    return allColumns.filter(col => col.defaultVisible).map(col => col.id);
  };
  
  const [columnOrder, setColumnOrder] = useState<string[]>(getInitialColumnOrder());
  const [visibleColumns, setVisibleColumns] = useState<string[]>(getInitialVisibleColumns());
  
  // Fosse settings state
  const [fosseSettings, setFosseSettings] = useState<{
    forcedColumns: string[];
    forcedFilters: Record<string, { type: 'open' | 'defined'; values?: string[]; value?: string; dateRange?: { from?: string; to?: string } }>;
    defaultOrder?: 'none' | 'created_at_asc' | 'created_at_desc' | 'updated_at_asc' | 'updated_at_desc' | 'assigned_at_asc' | 'assigned_at_desc' | 'email_asc' | 'random';
  } | null>(null);
  const [fosseSettingsLoading, setFosseSettingsLoading] = useState(false);
  
  // Ref to track last applied forced filters to prevent infinite loops
  const lastAppliedForcedFiltersRef = React.useRef<string>('');
  
  // Ref to track forced filters that should always be applied (persists across re-renders)
  const forcedFiltersAppliedRef = React.useRef<Record<string, string | string[] | { from?: string; to?: string }>>({});
  
  // Ref to track if loadData is currently running to prevent concurrent calls
  const isLoadingDataRef = React.useRef<boolean>(false);
  
  // Add/remove body class when fullscreen mode changes
  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add('contacts-fullscreen-active');
    } else {
      document.body.classList.remove('contacts-fullscreen-active');
    }
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('contacts-fullscreen-active');
    };
  }, [isFullscreen]);
  
  // Load Fosse settings for current user's role
  useEffect(() => {
    if (isFossePage && currentUser?.role) {
      const loadFosseSettings = async () => {
        try {
          setFosseSettingsLoading(true);
          const data = await apiCall(`/api/fosse-settings/${currentUser.role}/`);
          setFosseSettings({
            forcedColumns: data.forcedColumns || [],
            forcedFilters: data.forcedFilters || {},
            defaultOrder: data.defaultOrder || 'none',
          });
        } catch (error: any) {
          console.error('[FOSSE DEBUG] Error loading Fosse settings:', error);
          // If settings don't exist, use defaults
          setFosseSettings({
            forcedColumns: [],
            forcedFilters: {},
            defaultOrder: 'none',
          });
        } finally {
          setFosseSettingsLoading(false);
        }
      };
      loadFosseSettings();
    }
  }, [isFossePage, currentUser?.role]);
  
  // Apply forced columns when Fosse settings are loaded
  useEffect(() => {
    if (isFossePage && fosseSettings && !fosseSettingsLoading) {
      const forcedColumns = fosseSettings.forcedColumns || [];
      if (forcedColumns.length > 0) {
        // If forced columns are set, ONLY show the forced columns (restrict visibility)
        // Filter visible columns to only include those in forcedColumns
        const restrictedColumns = visibleColumns.filter(col => forcedColumns.includes(col));
        // Ensure all forced columns are visible (add any missing ones)
        const finalVisibleColumns = Array.from(new Set([...forcedColumns, ...restrictedColumns]));
        
        // Only update if there's a change to avoid infinite loops
        if (JSON.stringify(finalVisibleColumns.sort()) !== JSON.stringify(visibleColumns.sort())) {
          setVisibleColumns(finalVisibleColumns);
          // Also save to localStorage to persist the restriction
          const storageKey = getStorageKey('columns');
          localStorage.setItem(storageKey, JSON.stringify(finalVisibleColumns));
        }
      }
    }
  }, [isFossePage, fosseSettings, fosseSettingsLoading]);
  
  // Apply forced filters when Fosse settings are loaded (initial load or refresh)
  useEffect(() => {
    // Only apply filters if settings are loaded and not loading
    // Don't clear filters if settings are loading (preserve existing filters during loading)
    if (isFossePage && !fosseSettingsLoading) {
      // If settings are null/undefined, don't do anything (preserve existing filters)
      if (!fosseSettings) {
        return;
      }
      const forcedFilters = fosseSettings.forcedFilters || {};
      const forcedDefinedFilters: Record<string, string | string[] | { from?: string; to?: string }> = {};
      const forcedOpenFilters: Record<string, string | string[] | { from?: string; to?: string }> = {};
      
      Object.entries(forcedFilters).forEach(([columnId, filterConfig]) => {
        const config = filterConfig as { type: 'open' | 'defined'; values?: string[]; value?: string; dateRange?: { from?: string; to?: string } };
        if (config.type === 'defined' && config.values && config.values.length > 0) {
          // 'defined' type: enforce specific values
          forcedDefinedFilters[columnId] = config.values;
        } else if (config.type === 'open') {
          // 'open' type: apply default values if they exist (user can still modify)
          if (config.values && config.values.length > 0) {
            // Multi-select filter with 'open' type
            forcedOpenFilters[columnId] = config.values;
          } else if (config.dateRange && (config.dateRange.from || config.dateRange.to)) {
            // Date range filter with 'open' type
            forcedOpenFilters[columnId] = config.dateRange;
          } else if (config.value !== undefined && config.value !== '') {
            // Text filter with 'open' type
            forcedOpenFilters[columnId] = config.value;
          }
        }
      });
      
      // Apply both 'defined' and 'open' type filters
      const allForcedFilters = { ...forcedDefinedFilters, ...forcedOpenFilters };
      
      if (Object.keys(allForcedFilters).length > 0) {
        // Store ALL forced filters (both 'defined' and 'open') in ref to preserve them during re-renders
        forcedFiltersAppliedRef.current = allForcedFilters;
        // Apply forced filters - forced filters take precedence, remove conflicting existing filters first
        setAppliedColumnFilters(prev => {
          // Check if forced filters are already correctly applied
          const needsUpdate = Object.keys(allForcedFilters).some(key => {
            const forcedValue = allForcedFilters[key];
            const currentValue = prev[key];
            
            // If filter is missing, needs update
            if (!currentValue) {
              return true;
            }
            
            // Compare arrays (for multi-select filters)
            if (Array.isArray(forcedValue) && Array.isArray(currentValue)) {
              const forcedSorted = [...forcedValue].sort().join(',');
              const currentSorted = [...currentValue].sort().join(',');
              return forcedSorted !== currentSorted;
            }
            
            // Compare other types
            return JSON.stringify(forcedValue) !== JSON.stringify(currentValue);
          });
          
          if (!needsUpdate) {
            return prev;
          }
          
          // Remove any existing filters for columns that have forced filters, then apply forced ones
          const cleaned = { ...prev };
          Object.keys(allForcedFilters).forEach(key => {
            delete cleaned[key];
          });
          const merged = { ...cleaned, ...allForcedFilters };
          return merged;
        });
        setColumnFilters(prev => {
          // Check if forced filters are already correctly applied
          const needsUpdate = Object.keys(allForcedFilters).some(key => {
            const forcedValue = allForcedFilters[key];
            const currentValue = prev[key];
            
            if (!currentValue) return true;
            
            if (Array.isArray(forcedValue) && Array.isArray(currentValue)) {
              const forcedSorted = [...forcedValue].sort().join(',');
              const currentSorted = [...currentValue].sort().join(',');
              return forcedSorted !== currentSorted;
            }
            
            return JSON.stringify(forcedValue) !== JSON.stringify(currentValue);
          });
          
          if (!needsUpdate) {
            return prev;
          }
          
          const cleaned = { ...prev };
          Object.keys(allForcedFilters).forEach(key => {
            delete cleaned[key];
          });
          return { ...cleaned, ...allForcedFilters };
        });
        // Reset to first page when forced filters are applied
        setCurrentPage(1);
      }
    }
  }, [isFossePage, fosseSettings, fosseSettingsLoading]);
  
  // Reapply forced filters if they're changed (to ensure they're always enforced)
  // This effect only runs when forced filters change, not when user filters change, to avoid interference.
  useEffect(() => {
    // Only process if settings are loaded and not loading
    // Don't clear filters if settings are loading (preserve existing filters during loading)
    if (isFossePage && !fosseSettingsLoading) {
      // If settings are null/undefined, don't do anything (preserve existing filters)
      if (!fosseSettings) {
        return;
      }
      
      const forcedFilters = fosseSettings.forcedFilters || {};
      const forcedDefinedFilters: Record<string, string | string[] | { from?: string; to?: string }> = {};
      const forcedOpenFilters: Record<string, string | string[] | { from?: string; to?: string }> = {};
      
      // Process both 'defined' and 'open' type filters
      Object.entries(forcedFilters).forEach(([columnId, filterConfig]) => {
        const config = filterConfig as { type: 'open' | 'defined'; values?: string[]; value?: string; dateRange?: { from?: string; to?: string } };
        if (config.type === 'defined' && config.values && config.values.length > 0) {
          forcedDefinedFilters[columnId] = config.values;
        } else if (config.type === 'open') {
          // 'open' type: apply default values if they exist
          if (config.values && config.values.length > 0) {
            forcedOpenFilters[columnId] = config.values;
          } else if (config.dateRange && (config.dateRange.from || config.dateRange.to)) {
            forcedOpenFilters[columnId] = config.dateRange;
          } else if (config.value !== undefined && config.value !== '') {
            forcedOpenFilters[columnId] = config.value;
          }
        }
      });
      
      // Combine both types
      const allForcedFilters = { ...forcedDefinedFilters, ...forcedOpenFilters };
      const forcedFiltersKey = JSON.stringify(allForcedFilters);
      
      if (Object.keys(allForcedFilters).length > 0) {
        // Only reapply if forced filters have changed (not when user filters change)
        if (forcedFiltersKey !== lastAppliedForcedFiltersRef.current) {
          lastAppliedForcedFiltersRef.current = forcedFiltersKey;
          // Store ALL forced filters in ref to preserve them during re-renders
          forcedFiltersAppliedRef.current = allForcedFilters;
          // Reapply forced filters - 'defined' filters override user filters, 'open' filters are pre-filled
          setAppliedColumnFilters(prev => {
            const cleaned = { ...prev };
            // Remove filters for columns that have forced filters
            Object.keys(allForcedFilters).forEach(key => {
              delete cleaned[key];
            });
            const merged = { ...cleaned, ...allForcedFilters };
            return merged;
          });
          setColumnFilters(prev => {
            const cleaned = { ...prev };
            Object.keys(allForcedFilters).forEach(key => {
              delete cleaned[key];
            });
            return { ...cleaned, ...allForcedFilters };
          });
        }
      } else {
        // No forced filters - clear the refs only if we're sure there are no forced filters
        // Don't clear if settings are temporarily unavailable
        lastAppliedForcedFiltersRef.current = '';
        forcedFiltersAppliedRef.current = {};
      }
    }
  }, [isFossePage, fosseSettings, fosseSettingsLoading]);
  
  // Separate effect to enforce 'defined' filters when user tries to change them
  // This runs when appliedColumnFilters changes, but only checks/enforces 'defined' filters
  useEffect(() => {
    if (isFossePage && fosseSettings && !fosseSettingsLoading) {
      const forcedFilters = fosseSettings.forcedFilters || {};
      const forcedDefinedFilters: Record<string, string | string[] | { from?: string; to?: string }> = {};
      
      // Extract only 'defined' type forced filters
      Object.entries(forcedFilters).forEach(([columnId, filterConfig]) => {
        const config = filterConfig as { type: 'open' | 'defined'; values?: string[] };
        if (config.type === 'defined' && config.values && config.values.length > 0) {
          forcedDefinedFilters[columnId] = config.values;
        }
      });
      
      // Only enforce if there are forced 'defined' filters
      if (Object.keys(forcedDefinedFilters).length > 0) {
        // Check if any forced 'defined' filters were changed by the user
        const needsReapply = Object.keys(forcedDefinedFilters).some(key => {
          const forcedValue = forcedDefinedFilters[key];
          const currentValue = appliedColumnFilters[key];
          
          // If filter is missing, it needs to be reapplied
          if (!currentValue) {
            return true;
          }
          
          // Compare arrays (for multi-select filters)
          if (Array.isArray(forcedValue) && Array.isArray(currentValue)) {
            const forcedSorted = [...forcedValue].sort().join(',');
            const currentSorted = [...currentValue].sort().join(',');
            if (forcedSorted !== currentSorted) {
              return true;
            }
          } 
          // Compare other types (strings, objects)
          else if (JSON.stringify(forcedValue) !== JSON.stringify(currentValue)) {
            return true;
          }
          
          return false;
        });
        
        if (needsReapply) {
          // Reapply only 'defined' filters - preserve all other filters including 'open' type filters
          setAppliedColumnFilters(prev => {
            const cleaned = { ...prev };
            // Only remove filters for columns that have forced 'defined' filters
            Object.keys(forcedDefinedFilters).forEach(key => {
              delete cleaned[key];
            });
            return { ...cleaned, ...forcedDefinedFilters };
          });
          setColumnFilters(prev => {
            const cleaned = { ...prev };
            Object.keys(forcedDefinedFilters).forEach(key => {
              delete cleaned[key];
            });
            return { ...cleaned, ...forcedDefinedFilters };
          });
        }
      }
    }
  }, [isFossePage, fosseSettings, fosseSettingsLoading, appliedColumnFilters]);
  
  // Close any open popovers for forced filters
  useEffect(() => {
    if (isFossePage && fosseSettings && openFilterColumn) {
      if (isFilterForced(openFilterColumn)) {
        setOpenFilterColumn(null);
      }
    }
  }, [isFossePage, fosseSettings, openFilterColumn]);
  
  // Save selected order to localStorage whenever it changes
  useEffect(() => {
    const storageKey = getStorageKey('order');
    localStorage.setItem(storageKey, selectedOrder);
  }, [selectedOrder, isFossePage]);
  
  // Save column order to localStorage
  const saveColumnOrder = (order: string[]) => {
    const storageKey = getStorageKey('column-order');
    localStorage.setItem(storageKey, JSON.stringify(order));
    setColumnOrder(order);
  };
  
  // Save column visibility to localStorage
  const saveVisibleColumns = (columns: string[]) => {
    const storageKey = getStorageKey('columns');
    localStorage.setItem(storageKey, JSON.stringify(columns));
    setVisibleColumns(columns);
  };
  
  const handleToggleColumn = (columnId: string) => {
    // If on Fosse page, check forced columns restrictions
    if (isFossePage && fosseSettings) {
      const forcedColumns = fosseSettings.forcedColumns || [];
      
      // If forced columns are set, enforce restrictions
      if (forcedColumns.length > 0) {
        // If trying to hide a forced column, prevent it
        if (forcedColumns.includes(columnId) && visibleColumns.includes(columnId)) {
          toast.error('Cette colonne est forcée et ne peut pas être masquée');
          return;
        }
        // If trying to show a column that's not in forced columns, prevent it
        if (!forcedColumns.includes(columnId) && !visibleColumns.includes(columnId)) {
          toast.error('Cette colonne n\'est pas autorisée pour votre rôle');
          return;
        }
      }
    }
    
    const newVisible = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    saveVisibleColumns(newVisible);
  };
  
  const handleResetColumns = () => {
    // Reset to the specified default columns only
    const defaultOrderColumns = ['createdAt', 'fullName', 'source', 'phone', 'mobile', 'email', 'status', 'updatedAt', 'notes'];
    // Set visibility to only the default columns
    saveVisibleColumns(defaultOrderColumns);
    // Reset order: default columns first, then all other columns
    const allColumnIds = allColumns.map(col => col.id);
    const otherColumns = allColumnIds.filter(id => !defaultOrderColumns.includes(id));
    const defaultOrder = [...defaultOrderColumns, ...otherColumns];
    saveColumnOrder(defaultOrder);
  };

  // Drag and drop handlers for column reordering
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);

  const handleDragStart = (columnId: string) => {
    setDraggedColumnId(columnId);
  };

  const handleDragOver = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedColumnId && draggedColumnId !== targetColumnId) {
      e.currentTarget.classList.add('drag-over');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    
    if (!draggedColumnId || draggedColumnId === targetColumnId) {
      setDraggedColumnId(null);
      return;
    }

    const newOrder = [...columnOrder];
    const draggedIndex = newOrder.indexOf(draggedColumnId);
    const targetIndex = newOrder.indexOf(targetColumnId);

    // Remove dragged item from its current position
    newOrder.splice(draggedIndex, 1);
    // Insert at target position
    newOrder.splice(targetIndex, 0, draggedColumnId);

    saveColumnOrder(newOrder);
    setDraggedColumnId(null);
  };

  const handleDragEnd = () => {
    // Remove drag-over class from all items
    document.querySelectorAll('.column-drag-item').forEach(item => {
      item.classList.remove('drag-over');
    });
    setDraggedColumnId(null);
  };

  // Get ordered visible columns
  const getOrderedVisibleColumns = () => {
    return columnOrder.filter(id => visibleColumns.includes(id));
  };

  useEffect(() => {
    if (usersError) {
      console.error('Error loading users:', usersError);
    }
  }, [users, usersLoading, usersError]);

  // Create a stable string representation of appliedColumnFilters for dependency comparison
  const appliedColumnFiltersKey = useMemo(() => {
    return JSON.stringify(appliedColumnFilters);
  }, [appliedColumnFilters]);

  // Memoize loadData to prevent unnecessary re-renders
  const loadData = useCallback(async () => {
    // Prevent concurrent calls
    if (isLoadingDataRef.current) {
      return;
    }
    
    // Check if user is authenticated before making API calls
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (!token) {
      setIsLoading(false);
      isLoadingDataRef.current = false;
      return;
    }
    
    isLoadingDataRef.current = true;
    setIsLoading(true);
    try {
      // Use server-side pagination for better performance
      // Build query parameters for filters
      const queryParams = new URLSearchParams();
      queryParams.append('page', currentPage.toString());
      queryParams.append('page_size', itemsPerPage.toString());
      
      if (appliedSearchTerm) {
        queryParams.append('search', appliedSearchTerm);
      }
      
      // On Fosse page, always merge forced filters from ref with state filters
      // This ensures forced filters are always applied even if state is temporarily cleared
      let filtersToUse = appliedColumnFilters;
      if (isFossePage) {
        const refFilters = forcedFiltersAppliedRef.current;
        const hasRefFilters = Object.keys(refFilters).length > 0;
        
        if (hasRefFilters) {
          // Merge ref filters (forced filters) with state filters
          // Ref filters take precedence - they override any conflicting state filters
          filtersToUse = { ...appliedColumnFilters, ...refFilters };
          
          // If state doesn't include all ref filters, update state to match
          const stateHasAllRefFilters = Object.keys(refFilters).every(key => {
            const refValue = refFilters[key];
            const stateValue = appliedColumnFilters[key];
            
            if (!stateValue) return false;
            
            if (Array.isArray(refValue) && Array.isArray(stateValue)) {
              const refSorted = [...refValue].sort().join(',');
              const stateSorted = [...stateValue].sort().join(',');
              return refSorted === stateSorted;
            }
            return JSON.stringify(refValue) === JSON.stringify(stateValue);
          });
          
          // Update state if it doesn't match ref filters
          // The isLoadingDataRef flag prevents this from triggering another concurrent loadData call
          if (!stateHasAllRefFilters) {
            setAppliedColumnFilters(filtersToUse);
            setColumnFilters(filtersToUse);
          }
        }
      }
      
      // Only apply status_type filter if no specific status filter is active
      // This prevents conflicts between status_type and specific status filters
      const hasStatusFilter = filtersToUse.status && (
        (Array.isArray(filtersToUse.status) && filtersToUse.status.length > 0) ||
        (typeof filtersToUse.status === 'string' && filtersToUse.status !== '')
      );
      if (appliedStatusType !== 'all' && !hasStatusFilter) {
        queryParams.append('status_type', appliedStatusType);
      }
      
      // Add column filters
      Object.entries(filtersToUse).forEach(([key, value]) => {
        if (value) {
          if (Array.isArray(value)) {
            // Multi-select filter - send multiple query params
            value.forEach((val) => {
              queryParams.append(`filter_${key}`, val);
            });
          } else if (typeof value === 'string') {
            queryParams.append(`filter_${key}`, value);
          } else if (typeof value === 'object' && value !== null) {
            // Date range filter
            const dateRange = value as { from?: string; to?: string };
            if (dateRange.from) {
              queryParams.append(`filter_${key}_from`, dateRange.from);
            }
            if (dateRange.to) {
              queryParams.append(`filter_${key}_to`, dateRange.to);
            }
          }
        }
      });
      
      // Add ordering parameter - always send order based on select dropdown or forced settings
      // Priority: Fosse settings (if forced) > select dropdown value
      // The backend will respect this order parameter to sort contacts
      let orderToUse: string;
      if (isFossePage && fosseSettings && !fosseSettingsLoading && fosseSettings.defaultOrder && fosseSettings.defaultOrder !== 'none') {
        // Fosse page: use forced order from settings (dropdown is disabled)
        orderToUse = fosseSettings.defaultOrder;
      } else {
        // Contacts page OR Fosse page without forced order: use select dropdown value
        orderToUse = selectedOrder;
      }
      queryParams.append('order', orderToUse);
      
      // Load data in parallel for better performance
      // Add cache-busting timestamp to ensure fresh data
      const cacheBuster = `&_t=${Date.now()}`;
      const [contactsData, teamsData, statusesData] = await Promise.all([
        apiCall(`${apiEndpoint}?${queryParams.toString()}${cacheBuster}`),
        apiCall('/api/teams/'),
        apiCall('/api/statuses/')
      ]);
      
      // Contacts are already sorted and filtered by the backend
      const contactsList = contactsData.contacts || [];
      const totalFromAPI = contactsData.total || contactsData.count || contactsList.length;
      
      setContacts(contactsList);
      // Use total from paginated response
      setTotalContacts(totalFromAPI);
      setTeams(teamsData.teams || []);
      setStatuses(statusesData.statuses || []);
    } catch (error: any) {
      // Don't log 401 errors if we're redirecting to login (expected behavior)
      if (error?.status === 401 && error?.isRedirecting) {
        setIsLoading(false);
        isLoadingDataRef.current = false;
        return;
      }
      console.error('Error loading contacts:', error);
      toast.error(error?.message || 'Erreur lors du chargement des contacts');
    } finally {
      setIsLoading(false);
      isLoadingDataRef.current = false;
    }
  }, [currentPage, itemsPerPage, appliedSearchTerm, appliedStatusType, appliedColumnFilters, apiEndpoint, selectedOrder, isFossePage, fosseSettings, fosseSettingsLoading]);

  useEffect(() => {
    // Wait for user context to finish loading before making API calls
    if (userLoading) {
      return;
    }
    
    // On Fosse page, wait for settings to load before calling loadData
    // This ensures forced filters are applied before the first data load
    if (isFossePage && currentUser?.role) {
      // Wait until settings are loaded (not null) or loading is complete
      // fosseSettings will be set to an object (even if empty) when loading completes
      // Only wait if we have a role (meaning we should be loading settings)
      if (fosseSettings === null || fosseSettingsLoading) {
        return;
      }
    }
    loadData();
  }, [loadData, isFossePage, fosseSettings, fosseSettingsLoading, currentUser?.role, userLoading]); // Reload when loadData changes (which depends on filters and itemsPerPage)

  // Load note categories
  useEffect(() => {
    async function loadNoteCategories() {
      try {
        const data = await apiCall('/api/note-categories/');
        const sortedCategories = (data.categories || []).sort((a: any, b: any) => 
          a.orderIndex - b.orderIndex
        );
        setNoteCategories(sortedCategories);
      } catch (error: any) {
        console.error('Error loading note categories:', error);
      }
    }
    loadNoteCategories();
  }, []);

  // Listen for contact updates from opened contact detail windows
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify message origin for security
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data && event.data.type === 'CONTACT_UPDATED') {
        const { contactId, contact } = event.data;
        console.log('Contact updated in detail window, refreshing list:', contactId);
        
        // Refresh the contact list to show updated data
        loadData();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [loadData]);
  
  // Apply filters - called when user clicks "Filtrer" button
  function handleApplyFilters() {
    setAppliedSearchTerm(pendingSearchTerm);
    setAppliedStatusType(pendingStatusType);
    setAppliedColumnFilters({...pendingColumnFilters});
    setColumnFilters({...pendingColumnFilters}); // Keep for display
    setCurrentPage(1); // Reset to first page
    // loadData will be called by useEffect when applied filters change
  }


  // Apply a single column filter
  function handleApplyColumnFilter(columnId: string) {
    // If on Fosse page, check if this filter is forced (has any value configured)
    // Forced filters cannot be modified regardless of type ('open' or 'defined')
    if (isFilterForced(columnId)) {
      toast.error('Ce filtre est forcé et ne peut pas être modifié');
      return;
    }
    
    const newFilters = { ...appliedColumnFilters };
    const pendingValue = pendingColumnFilters[columnId];
    
    if (isDateColumn(columnId)) {
      // Date range filter
      if (pendingValue && typeof pendingValue === 'object' && pendingValue !== null && !Array.isArray(pendingValue)) {
        const dateRange = pendingValue as { from?: string; to?: string };
        if (dateRange.from || dateRange.to) {
          newFilters[columnId] = dateRange;
        } else {
          delete newFilters[columnId];
        }
      } else {
        delete newFilters[columnId];
      }
    } else if (shouldUseMultiSelectFilter(columnId)) {
      // Multi-select filter
      if (Array.isArray(pendingValue) && pendingValue.length > 0) {
        newFilters[columnId] = pendingValue;
      } else {
        delete newFilters[columnId];
      }
    } else {
      // Regular text filter
      if (pendingValue && typeof pendingValue === 'string' && pendingValue !== 'all' && pendingValue !== '') {
        newFilters[columnId] = pendingValue;
      } else {
        delete newFilters[columnId];
      }
    }
    
    setAppliedColumnFilters(newFilters);
    setColumnFilters(newFilters); // Keep for display
    setCurrentPage(1); // Reset to first page
    setOpenFilterColumn(null); // Close the popover
    // Clear the search bar in the filter modal
    setColumnFilterSearchTerms(prev => {
      const newTerms = { ...prev };
      delete newTerms[columnId];
      return newTerms;
    });
    // Reset status type filter if this is the status column
    if (columnId === 'status') {
      setStatusColumnFilterType('lead');
    }
    // loadData will be called by useEffect when applied filters change
  }
  
  // Reset a specific column filter
  function handleResetColumnFilter(columnId: string) {
    // If on Fosse page, check if this filter is forced (has any value configured)
    // Forced filters cannot be reset regardless of type ('open' or 'defined')
    if (isFilterForced(columnId)) {
      toast.error('Ce filtre est forcé et ne peut pas être réinitialisé');
      return;
    }
    
    // Remove from pending filters
    setPendingColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[columnId];
      return newFilters;
    });
    
    // Remove from applied filters (this will trigger reload via useEffect)
    setAppliedColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[columnId];
      return newFilters;
    });
    
    // Remove from display filters
    setColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[columnId];
      return newFilters;
    });
    
    setCurrentPage(1); // Reset to first page
    // Clear the search bar in the filter modal
    setColumnFilterSearchTerms(prev => {
      const newTerms = { ...prev };
      delete newTerms[columnId];
      return newTerms;
    });
    // Reset status type filter if this is the status column
    if (columnId === 'status') {
      setStatusColumnFilterType('lead');
    }
  }

  // Reset filters
  function handleResetFilters() {
    setPendingSearchTerm('');
    setPendingStatusType('all');
    setPendingColumnFilters({});
    setAppliedSearchTerm('');
    setAppliedStatusType('all');
    
    // If on Fosse page, preserve forced 'defined' filters when resetting
    if (isFossePage && fosseSettings) {
      const forcedFilters = fosseSettings.forcedFilters || {};
      const forcedDefinedFilters: Record<string, string | string[] | { from?: string; to?: string }> = {};
      
      // Extract only 'defined' type forced filters
      Object.entries(forcedFilters).forEach(([columnId, filterConfig]) => {
        const config = filterConfig as { type: 'open' | 'defined'; values?: string[] };
        if (config.type === 'defined' && config.values && config.values.length > 0) {
          forcedDefinedFilters[columnId] = config.values;
        }
      });
      
      // Set filters to only forced 'defined' filters (preserve them)
      setAppliedColumnFilters(forcedDefinedFilters);
      setColumnFilters(forcedDefinedFilters);
    } else {
      // Not on Fosse page or no settings - clear all filters
      setAppliedColumnFilters({});
      setColumnFilters({});
    }
    
    setCurrentPage(1);
    // loadData will be called by useEffect when applied filters change
  }
  
  // Helper to check if filters have changed
  const hasFilterChanges = 
    pendingSearchTerm !== appliedSearchTerm ||
    pendingStatusType !== appliedStatusType ||
    JSON.stringify(pendingColumnFilters) !== JSON.stringify(appliedColumnFilters);


  // Helper function to determine if a column should use multi-select filter
  const shouldUseMultiSelectFilter = (columnId: string): boolean => {
    return ['status', 'creator', 'teleoperator', 'confirmateur', 'source', 'postalCode', 'nationality', 'campaign', 'civility', 'managerTeam', 'previousStatus', 'previousTeleoperator'].includes(columnId);
  };

  const isDateColumn = (columnId: string): boolean => {
    return ['createdAt', 'updatedAt', 'birthDate', 'assignedAt'].includes(columnId);
  };
  
  // Helper function to check if a filter is forced (has any value configured, regardless of type)
  const isFilterForced = (columnId: string): boolean => {
    if (isFossePage && fosseSettings) {
      const forcedFilters = fosseSettings.forcedFilters || {};
      const filterConfig = forcedFilters[columnId];
      if (filterConfig) {
        // Check if filter has any value (multi-select, text, or date range)
        // Works for both 'defined' and 'open' types - if a filter is forced, user cannot open it
        const hasValues = filterConfig.values && Array.isArray(filterConfig.values) && filterConfig.values.length > 0;
        const hasValue = filterConfig.value !== undefined && filterConfig.value !== null && String(filterConfig.value).trim() !== '';
        const hasDateRange = filterConfig.dateRange && 
          (filterConfig.dateRange.from || filterConfig.dateRange.to);
        return hasValues || hasValue || hasDateRange;
      }
    }
    return false;
  };
  
  // Helper function to get filter options for Select columns
  const getFilterOptions = (columnId: string, statusTypeFilter: 'lead' | 'client' = 'lead') => {
    const options: Array<{ id: string; label: string }> = [];
    
    // Add empty option first
    options.push({ id: '__empty__', label: '(Vides)' });
    
    switch (columnId) {
      case 'status':
        // For Fosse page (apiEndpoint includes '/fosse/'), show all statuses in filter
        // For regular contacts page, filter by view permissions
        const isFossePage = apiEndpoint.includes('/fosse/');
        const statusOptions = statuses
          .filter((status) => {
            if (!status.id || status.id.trim() === '') return false;
            
            // Filter by status type
            if (status.type !== statusTypeFilter) {
              return false;
            }
            
            if (isFossePage) {
              // Fosse page: show all statuses in filter
              return true;
            }
            // Regular contacts page: filter by view permissions
            const normalizedStatusId = String(status.id).trim();
            return statusViewPermissions.has(normalizedStatusId);
          })
          .map(status => ({
          id: status.id,
          label: status.name
        }));
        options.push(...statusOptions);
        break;
      case 'creator':
        const creatorOptions = users.map(user => ({
          id: user.id,
          label: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`
        }));
        options.push(...creatorOptions);
        break;
      case 'teleoperator':
        const teleoperatorOptions = teleoperateurs.map(user => ({
          id: user.id,
          label: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`
        }));
        options.push(...teleoperatorOptions);
        break;
      case 'confirmateur':
        const confirmateurOptions = confirmateurs.map(user => ({
          id: user.id,
          label: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`
        }));
        options.push(...confirmateurOptions);
        break;
      case 'source':
        const sourceOptions = sources.map(source => ({
          id: source.id,
          label: source.name
        }));
        options.push(...sourceOptions);
        break;
      case 'postalCode':
        // Extract unique postal codes from contacts
        const postalCodes = new Set<string>();
        contacts.forEach(contact => {
          if (contact.postalCode && contact.postalCode.trim() !== '') {
            postalCodes.add(contact.postalCode.trim());
          }
        });
        const postalCodeOptions = Array.from(postalCodes).sort().map(code => ({
          id: code,
          label: code
        }));
        options.push(...postalCodeOptions);
        break;
      case 'nationality':
        // Extract unique nationalities from contacts
        const nationalities = new Set<string>();
        contacts.forEach(contact => {
          if (contact.nationality && contact.nationality.trim() !== '') {
            nationalities.add(contact.nationality.trim());
          }
        });
        const nationalityOptions = Array.from(nationalities).sort().map(nat => ({
          id: nat,
          label: nat
        }));
        options.push(...nationalityOptions);
        break;
      case 'campaign':
        // Extract unique campaigns from contacts
        const campaigns = new Set<string>();
        contacts.forEach(contact => {
          if (contact.campaign && contact.campaign.trim() !== '') {
            campaigns.add(contact.campaign.trim());
          }
        });
        const campaignOptions = Array.from(campaigns).sort().map(camp => ({
          id: camp,
          label: camp
        }));
        options.push(...campaignOptions);
        break;
      case 'civility':
        // Extract unique civilities from contacts
        const civilities = new Set<string>();
        contacts.forEach(contact => {
          if (contact.civility && contact.civility.trim() !== '') {
            civilities.add(contact.civility.trim());
          }
        });
        const civilityOptions = Array.from(civilities).sort().map(civ => ({
          id: civ,
          label: civ
        }));
        options.push(...civilityOptions);
        break;
      case 'managerTeam':
        // Use teams from API
        const teamOptions = teams.map(team => ({
          id: team.id,
          label: team.name
        }));
        options.push(...teamOptions);
        break;
      case 'previousStatus':
        // For previousStatus, use status names (since it stores names, not IDs)
        // Use the exact same logic as status filter
        const isFossePageForPreviousStatus = apiEndpoint.includes('/fosse/');
        const previousStatusOptions = statuses
          .filter((status) => {
            if (!status.id || status.id.trim() === '') return false;
            
            // Filter by status type
            if (status.type !== statusTypeFilter) {
              return false;
            }
            
            if (isFossePageForPreviousStatus) {
              // Fosse page: show all statuses in filter
              return true;
            }
            // Regular contacts page: filter by view permissions
            const normalizedStatusId = String(status.id).trim();
            return statusViewPermissions.has(normalizedStatusId);
          })
          .map(status => ({
            id: status.name, // Use name for filtering since previousStatus stores names
            label: status.name
          }));
        options.push(...previousStatusOptions);
        break;
      case 'previousTeleoperator':
        // For previousTeleoperator, use user names (since it stores names, not IDs)
        // Deduplicate by user name
        const userNameMap = new Map<string, { id: string; label: string }>();
        users.forEach(u => {
          const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || u.email || `Utilisateur ${u.id}`;
          if (!userNameMap.has(name)) {
            userNameMap.set(name, { id: name, label: name });
          } else {
            // If duplicate name exists, use name with user ID to make it unique
            userNameMap.set(`${name}_${u.id}`, {
              id: name, // Still use name for filtering
              label: `${name} (${u.id})`
            });
          }
        });
        const previousTeleoperatorOptions = Array.from(userNameMap.values());
        options.push(...previousTeleoperatorOptions);
        break;
      default:
        return [{ id: '__empty__', label: '(Vides)' }];
    }
    
    return options;
  };
  
  // Helper function to get status type for a contact
  const getContactStatusType = (contact: any): string | null => {
    if (!contact.statusId) return null;
    const status = statuses.find(s => s.id === contact.statusId);
    return status?.type || null;
  };

  // Helper function to get status display text for a contact
  // The ONLY condition to see the status name is to have "view" permission for that status
  // If user doesn't have status view permission, show "Indisponible - [TYPE]"
  const getStatusDisplayText = getStatusDisplayTextProp ?? React.useCallback((contact: any): string => {
    const contactStatusId = contact?.statusId;
    
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
      // Check permission (case-sensitive first, then case-insensitive fallback)
      let hasStatusPermission = statusViewPermissions.has(normalizedStatusId);
      if (!hasStatusPermission) {
        // Try case-insensitive match as fallback
        hasStatusPermission = Array.from(statusViewPermissions).some(permId => 
          String(permId).toLowerCase() === normalizedStatusId.toLowerCase()
        );
      }
      
      if (hasStatusPermission) {
        // User has permission, show actual status name
        return contact.statusName || '-';
      } else {
        // User doesn't have permission, show masked message
        const statusType = getContactStatusType(contact);
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
    return contact.statusName || '-';
  }, [statusViewPermissions, getContactStatusType]);

  // Filter contacts based on status view permissions
  // Backend handles filtering and sorting, but we also filter by status view permissions on client side
  // With server-side pagination, contacts already represent the current page and are already sorted by the backend
  const displayedContacts = React.useMemo(() => {
    // Backend handles all sorting, so we just use contacts as-is
    // Only filter by permissions on client side
    const filtered = contacts.filter(contact => canViewContact(contact));
    
    return filtered;
  }, [contacts, canViewContact]);

  // Calculate pagination based on server-side total
  const totalPages = Math.ceil(totalContacts / itemsPerPage);
  
  // Reset to page 1 if current page is out of bounds or when filters change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);
  
  // Reset to page 1 when applied filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [appliedSearchTerm, appliedStatusType, appliedColumnFilters]);

  // Gestion de la sélection
  function handleSelectContact(contactId: string) {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
    setShowBulkActions(newSelected.size > 0);
  }

  function handleSelectAll() {
    if (selectedContacts.size === displayedContacts.length) {
      setSelectedContacts(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedContacts(new Set(displayedContacts.map(c => c.id)));
      setShowBulkActions(true);
    }
  }

  function handleClearSelection() {
    setSelectedContacts(new Set());
    setShowBulkActions(false);
    setBulkTeleoperatorId('');
    setBulkConfirmateurId('');
  }

  const allSelected = displayedContacts.length > 0 && selectedContacts.size === displayedContacts.length;
  const someSelected = selectedContacts.size > 0 && selectedContacts.size < displayedContacts.length;
  
  // Get column label by id
  const getColumnLabel = (columnId: string) => {
    const column = allColumns.find(col => col.id === columnId);
    return column?.label || columnId;
  };
  
  // Helper function to format active filters for display
  const formatActiveFilters = (): string => {
    const activeFilters: string[] = [];
    
    // Add search term filter if present
    if (appliedSearchTerm && appliedSearchTerm.trim() !== '') {
      activeFilters.push(`Recherche égale à ${appliedSearchTerm}`);
    }
    
    // Add status type filter if not 'all'
    if (appliedStatusType !== 'all') {
      const statusTypeLabel = appliedStatusType === 'lead' ? 'Lead' : 'Client';
      activeFilters.push(`Type de contact égale à ${statusTypeLabel}`);
    }
    
    Object.entries(appliedColumnFilters).forEach(([columnId, filterValue]) => {
      // Only show filters for visible columns
      if (!visibleColumns.includes(columnId)) {
        return;
      }
      
      // Skip empty filters
      if (!filterValue || 
          (Array.isArray(filterValue) && filterValue.length === 0) ||
          (typeof filterValue === 'string' && filterValue.trim() === '') ||
          (typeof filterValue === 'object' && !Array.isArray(filterValue) && 
           (!('from' in filterValue) || !filterValue.from) && 
           (!('to' in filterValue) || !filterValue.to))) {
        return;
      }
      
      const columnLabel = getColumnLabel(columnId);
      let filterText = '';
      
      // Helper function to get label for a filter value
      const getFilterValueLabel = (value: string, colId: string): string => {
        if (value === '__empty__') {
          return '(Vides)';
        }
        
        switch (colId) {
          case 'status':
            const status = statuses.find(s => s.id === value);
            return status ? status.name : value;
          case 'previousStatus':
            const prevStatus = statuses.find(s => s.name === value);
            return prevStatus ? prevStatus.name : value;
          case 'creator':
            const creator = users.find(u => u.id === value);
            return creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.username || creator.email || value : value;
          case 'teleoperator':
            const teleoperator = teleoperateurs.find(u => u.id === value);
            return teleoperator ? `${teleoperator.firstName || ''} ${teleoperator.lastName || ''}`.trim() || teleoperator.username || teleoperator.email || value : value;
          case 'confirmateur':
            const confirmateur = confirmateurs.find(u => u.id === value);
            return confirmateur ? `${confirmateur.firstName || ''} ${confirmateur.lastName || ''}`.trim() || confirmateur.username || confirmateur.email || value : value;
          case 'source':
            const source = sources.find(s => s.id === value);
            return source ? source.name : value;
          case 'managerTeam':
            const team = teams.find(t => t.id === value);
            return team ? team.name : value;
          default:
            return value;
        }
      };
      
      if (Array.isArray(filterValue)) {
        // Multi-select filter
        const filterLabels: string[] = [];
        filterValue.forEach(value => {
          filterLabels.push(getFilterValueLabel(value, columnId));
        });
        filterText = filterLabels.join(',');
      } else if (typeof filterValue === 'object' && filterValue !== null && 'from' in filterValue) {
        // Date range filter
        const from = filterValue.from || '';
        const to = filterValue.to || '';
        if (from && to) {
          filterText = `du ${from} au ${to}`;
        } else if (from) {
          filterText = `à partir du ${from}`;
        } else if (to) {
          filterText = `jusqu'au ${to}`;
        }
      } else if (typeof filterValue === 'string') {
        // Text filter
        filterText = filterValue;
      }
      
      if (filterText) {
        activeFilters.push(`${columnLabel} égale à ${filterText}`);
      }
    });
    
    if (activeFilters.length === 0) {
      return '';
    }
    
    return activeFilters.join(' ET ');
  };
  
  // Helper function to truncate text with ellipsis
  const truncateText = (text: string, maxLength: number = 15): string => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Helper function to open contact detail
  const openContactDetail = useCallback((contactId: string) => {
    setLastOpenedContactId(contactId);
    window.open(`/contacts/${contactId}`, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
  }, []);

  // Load notes for a contact
  const loadNotes = useCallback(async (contactId: string) => {
    if (notesData[contactId] || notesLoading[contactId]) {
      return; // Already loaded or loading
    }

    setNotesLoading(prev => ({ ...prev, [contactId]: true }));
    try {
      const data = await apiCall(`/api/notes/?contactId=${contactId}`);
      // Handle both paginated response (data.results) and direct array response
      const notesArray = Array.isArray(data) ? data : (data.results || data.notes || []);
      // Store raw notes - filtering will happen at display time with current permissions
      setNotesData(prev => ({ ...prev, [contactId]: notesArray }));
    } catch (error) {
      console.error('Error loading notes:', error);
      setNotesData(prev => ({ ...prev, [contactId]: [] }));
    } finally {
      setNotesLoading(prev => ({ ...prev, [contactId]: false }));
    }
  }, [notesData, notesLoading]);

  // Handle hover on notes cell
  const handleNotesHover = useCallback((contactId: string, isEntering: boolean) => {
    if (isEntering) {
      // Clear any existing timeout
      if (hoverTimeoutRef.current[contactId]) {
        clearTimeout(hoverTimeoutRef.current[contactId]);
        delete hoverTimeoutRef.current[contactId];
      }
      // Set timeout to open popover after a short delay
      hoverTimeoutRef.current[contactId] = setTimeout(() => {
        setNotesPopoverOpen(contactId);
        loadNotes(contactId);
      }, 300); // 300ms delay
    } else {
      // Clear timeout if mouse leaves before delay
      if (hoverTimeoutRef.current[contactId]) {
        clearTimeout(hoverTimeoutRef.current[contactId]);
        delete hoverTimeoutRef.current[contactId];
      }
    }
  }, [loadNotes]);

  // Handle mouse leave from popover content
  const handlePopoverLeave = useCallback((contactId: string) => {
    // Close popover after a short delay (to allow moving back to trigger)
    setTimeout(() => {
      setNotesPopoverOpen(prev => prev === contactId ? null : prev);
    }, 200);
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(hoverTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout as ReturnType<typeof setTimeout>);
      });
    };
  }, []);
  
  // Helper function to render cell content based on column id
  const renderCell = (contact: any, columnId: string) => {
    // Helper to stop propagation for interactive elements
    const stopPropagation = (e: React.MouseEvent) => {
      e.stopPropagation();
    };

    switch (columnId) {
      case 'id':
        return (
          <td key={columnId} className="contacts-table-id" onClick={stopPropagation}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openContactDetail(contact.id);
              }}
              className="contacts-name-link"
              title={contact.id}
            >
              {contact.id.substring(0, 8)}
            </button>
          </td>
        );
      case 'fullName':
        return (
          <td key={columnId} onClick={stopPropagation}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openContactDetail(contact.id);
                }}
                className="contacts-name-link"
                title={contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '-'}
              >
                {contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '-'}
              </button>
              {lastOpenedContactId === contact.id && (
                <span 
                  style={{
                    fontSize: '0.75rem',
                    color: '#3b82f6',
                    fontWeight: '600',
                    backgroundColor: '#dbeafe',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Dernier ouvert
                </span>
              )}
            </div>
          </td>
        );
      case 'firstName':
        return <td key={columnId} title={contact.firstName || ''}>{truncateText(contact.firstName || '-')}</td>;
      case 'lastName':
        return <td key={columnId} title={contact.lastName || ''}>{truncateText(contact.lastName || '-')}</td>;
      case 'civility':
        return <td key={columnId} title={contact.civility || ''}>{truncateText(contact.civility || '-')}</td>;
      case 'phone':
        return <td key={columnId} title={formatPhoneNumber(contact.phone) || ''}>{formatPhoneNumber(contact.phone) || '-'}</td>;
      case 'mobile':
        return <td key={columnId} title={formatPhoneNumber(contact.mobile) || ''}>{truncateText(formatPhoneNumber(contact.mobile) || '-')}</td>;
      case 'email':
        return (
          <td key={columnId} className="contacts-table-email" onClick={stopPropagation}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openContactDetail(contact.id);
              }}
              className="contacts-name-link"
              title={contact.email || ''}
            >
              {contact.email || '-'}
            </button>
          </td>
        );
      case 'birthDate':
        return (
          <td key={columnId}>
            {contact.birthDate 
              ? new Date(contact.birthDate).toLocaleDateString('fr-FR')
              : '-'
            }
          </td>
        );
      case 'birthPlace':
        return <td key={columnId} title={contact.birthPlace || ''}>{truncateText(contact.birthPlace || '-')}</td>;
      case 'address':
        return <td key={columnId} title={contact.address || ''}>{truncateText(contact.address || '-')}</td>;
      case 'addressComplement':
        return <td key={columnId} title={contact.addressComplement || ''}>{truncateText(contact.addressComplement || '-')}</td>;
      case 'postalCode':
        return <td key={columnId} title={contact.postalCode || ''}>{truncateText(contact.postalCode || '-')}</td>;
      case 'city':
        return <td key={columnId} title={contact.city || ''}>{truncateText(contact.city || '-')}</td>;
      case 'nationality':
        return <td key={columnId} title={contact.nationality || ''}>{truncateText(contact.nationality || '-')}</td>;
      case 'campaign':
        return <td key={columnId} title={contact.campaign || ''}>{truncateText(contact.campaign || '-')}</td>;
      case 'createdAt':
        return (
          <td key={columnId} onClick={stopPropagation}>
            {contact.createdAt ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openContactDetail(contact.id);
                }}
                className="contacts-name-link"
                title={new Date(contact.createdAt).toLocaleString('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'short'
                })}
              >
                {new Date(contact.createdAt).toLocaleString('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'short'
                })}
              </button>
            ) : (
              '-'
            )}
          </td>
        );
      case 'updatedAt':
        return (
          <td key={columnId}>
            {contact.updatedAt 
              ? new Date(contact.updatedAt).toLocaleString('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'short'
                })
              : contact.lastLogDate
              ? new Date(contact.lastLogDate).toLocaleString('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'short'
                })
              : '-'
            }
          </td>
        );
      case 'teleoperator':
        return (
          <td key={columnId} onClick={stopPropagation}>
            <span title={contact.managerName || contact.teleoperatorName || ''}>
              {truncateText(contact.managerName || contact.teleoperatorName || '-')}
            </span>
          </td>
        );
      case 'assignedAt':
        return (
          <td key={columnId}>
            {contact.assignedAt 
              ? new Date(contact.assignedAt).toLocaleString('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'short'
                })
              : '-'
            }
          </td>
        );
      case 'source':
        return <td key={columnId} title={contact.source || ''}>{truncateText(contact.source || '-')}</td>;
      case 'status':
        const statusDisplayText = getStatusDisplayText(contact);
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
        const canEditStatus = canEditContact(contact);
        // If status is masked (CLIENT EN COURS or Indisponible), use special styling
        const isMaskedStatus = statusDisplayText === 'CLIENT EN COURS' || statusDisplayText.startsWith('Indisponible');
        const statusBgColor = statusDisplayText === 'CLIENT EN COURS' ? '#22c55e' : (isMaskedStatus ? '#e5e7eb' : (contact.statusColor || '#e5e7eb'));
        const statusTextColor = statusDisplayText === 'CLIENT EN COURS' ? '#ffffff' : (isMaskedStatus ? '#374151' : (contact.statusColor ? '#000000' : '#374151'));
        
        return (
          <td key={columnId} onClick={stopPropagation}>
            {canEditStatus ? (
              <span 
                className="contacts-status-badge cursor-pointer"
                onClick={async (e) => {
                  e.stopPropagation(); // Prevent row click from opening contact detail
                  // Fetch fresh contact data from API to ensure we have the latest status
                  try {
                    const contactData = await apiCall(`/api/contacts/${contact.id}/`);
                    const freshContact = contactData.contact || contact;
                    setSelectedContact(freshContact);
                    setSelectedStatusId(freshContact.statusId || '');
                    setStatusChangeNote('');
                    setStatusChangeNoteCategoryId(accessibleCategories.length > 0 ? accessibleCategories[0].id : '');
                    // Set filter type based on current status
                    const currentStatus = statuses.find(s => s.id === freshContact.statusId);
                    if (currentStatus?.type === 'client' || currentStatus?.type === 'lead') {
                      setStatusModalFilterType(currentStatus.type);
                    } else {
                      setStatusModalFilterType('lead'); // Default to lead if status not found
                    }
                    // Prefill client form if status is client default
                    if (currentStatus?.clientDefault === true) {
                      prefillClientForm(freshContact);
                    }
                    setIsStatusModalOpen(true);
                  } catch (error) {
                    // Fallback to contact from list if API call fails
                    console.error('Error fetching fresh contact:', error);
                    setSelectedContact(contact);
                    setSelectedStatusId(contact.statusId || '');
                    setStatusChangeNote('');
                    setStatusChangeNoteCategoryId(accessibleCategories.length > 0 ? accessibleCategories[0].id : '');
                    // Set filter type based on current status
                    const currentStatus = statuses.find(s => s.id === contact.statusId);
                    if (currentStatus?.type === 'client' || currentStatus?.type === 'lead') {
                      setStatusModalFilterType(currentStatus.type);
                    } else {
                      setStatusModalFilterType('lead'); // Default to lead if status not found
                    }
                    // Prefill client form if status is client default
                    if (currentStatus?.clientDefault === true) {
                      prefillClientForm(contact);
                    }
                    setIsStatusModalOpen(true);
                  }
                }}
                style={{
                  backgroundColor: statusBgColor,
                  color: statusTextColor,
                  padding: '4px 12px',
                  borderRadius: '5px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  display: 'inline-block'
                }}
              >
                {truncateText(statusDisplayText)}
              </span>
            ) : (
              <span 
                className="contacts-status-badge"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent row click
                  // Prevent opening modal - user doesn't have edit permission for this status
                }}
                style={{
                  backgroundColor: statusBgColor,
                  color: statusTextColor,
                  padding: '4px 12px',
                  borderRadius: '5px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  display: 'inline-block',
                  cursor: 'not-allowed',
                  opacity: 0.7
                }}
                title="Vous n'avez pas la permission de modifier le statut de ce contact"
              >
                {statusDisplayText}
              </span>
            )}
          </td>
        );
      case 'confirmateur':
        return (
          <td key={columnId} onClick={stopPropagation}>
            <span title={contact.confirmateurName || ''}>
              {truncateText(contact.confirmateurName || '-')}
            </span>
          </td>
        );
      case 'creator':
        return <td key={columnId} title={contact.creatorName || ''}>{truncateText(contact.creatorName || '-')}</td>;
      case 'managerTeam':
        return <td key={columnId} title={contact.managerTeamName || ''}>{truncateText(contact.managerTeamName || '-')}</td>;
      case 'previousStatus':
        const previousStatus = contact.previousStatus;
        if (!previousStatus) return <td key={columnId}>-</td>;
        const prevStatus = statuses.find(s => s.name === previousStatus);
        return (
          <td key={columnId} onClick={stopPropagation}>
            {prevStatus ? (
              <span 
                className="contacts-status-badge"
                style={{
                  backgroundColor: prevStatus.color || '#e5e7eb',
                  color: prevStatus.color ? '#000000' : '#374151'
                }}
              >
                {previousStatus}
              </span>
            ) : (
              previousStatus
            )}
          </td>
        );
      case 'previousTeleoperator':
        return <td key={columnId} title={contact.previousTeleoperator || ''}>{truncateText(contact.previousTeleoperator || '-')}</td>;
      case 'notes':
        const notesCount = contact.notesCount || 0;
        const notesText = contact.notesLatestText || '';
        const rawContactNotes = notesData[contact.id] || [];
        const isLoadingNotes = notesLoading[contact.id];
        const isPopoverOpen = notesPopoverOpen === contact.id;
        
        // Filter notes by permissions (same logic as ContactInfoTab)
        const filteredContactNotes = filterNotesByPermissions(rawContactNotes);
        
        // Use actual filtered notes count if notes have been loaded, otherwise use the pre-calculated count
        const hasLoadedNotes = contact.id in notesData;
        const displayedNotesCount = hasLoadedNotes ? filteredContactNotes.length : notesCount;
        
        return (
          <td 
            key={columnId} 
            title={notesText || (notesCount > 0 ? `${notesCount} note(s)` : 'Aucune note')}
            onMouseEnter={(e) => {
              e.stopPropagation();
              notesCount > 0 && handleNotesHover(contact.id, true);
            }}
            onMouseLeave={(e) => {
              e.stopPropagation();
              handleNotesHover(contact.id, false);
            }}
            onClick={stopPropagation}
            style={{ position: 'relative' }}
          >
            <Popover open={isPopoverOpen} onOpenChange={(open) => {
              if (!open) {
                setNotesPopoverOpen(null);
              } else {
                setNotesPopoverOpen(contact.id);
                loadNotes(contact.id);
              }
            }}>
              <PopoverTrigger asChild>
                <div style={{ cursor: notesCount > 0 ? 'pointer' : 'default' }}>
                  {notesCount > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: '500' }}>{notesCount} note{notesCount > 1 ? 's' : ''}</span>
                      {notesText && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                          {truncateText(notesText, 50)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>-</span>
                  )}
                </div>
              </PopoverTrigger>
              <PopoverContent 
                className="w-96 h-96 p-4 flex flex-col" 
                align="start"
                onMouseEnter={() => {
                  // Keep popover open when hovering over content
                  if (hoverTimeoutRef.current[contact.id]) {
                    clearTimeout(hoverTimeoutRef.current[contact.id]);
                    delete hoverTimeoutRef.current[contact.id];
                  }
                  setNotesPopoverOpen(contact.id);
                }}
                onMouseLeave={() => handlePopoverLeave(contact.id)}
                style={{ zIndex: 10002 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Notes ({displayedNotesCount})</h3>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {isLoadingNotes ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                      Chargement...
                    </div>
                  ) : filteredContactNotes.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', minWidth: 0 }}>
                      {filteredContactNotes
                        .sort((a: any, b: any) => {
                          // Sort by date descending (most recent first)
                          const dateA = new Date(a.createdAt || a.created_at).getTime();
                          const dateB = new Date(b.createdAt || b.created_at).getTime();
                          return dateB - dateA;
                        })
                        .map((note: any) => (
                        <div key={note.id} style={{ fontSize: '0.875rem', color: '#374151', lineHeight: '1.6', width: '100%', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                            {note.categoryName && (
                              <span style={{ 
                                fontSize: '0.75rem', 
                                fontWeight: '600', 
                                color: '#3b82f6',
                                backgroundColor: '#dbeafe',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                whiteSpace: 'nowrap'
                              }}>
                                {note.categoryName}
                              </span>
                            )}
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                              {note.createdBy && `Par ${note.createdBy}`}
                              {note.createdAt && (
                                <span style={{ marginLeft: '4px' }}>
                                  {new Date(note.createdAt).toLocaleString('fr-FR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short'
                                  })}
                                </span>
                              )}
                            </span>
                          </div>
                          <div style={{ marginTop: '4px' }}>
                            {note.text && note.text.length > 30 ? `${note.text.substring(0, 30)}...` : note.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
                      Aucune note
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </td>
        );
      default:
        return <td key={columnId}>-</td>;
    }
  };

  // Helper function to count contacts that will have both teleoperator and confirmateur as None after the operation
  function countContactsThatWillBecomeUnassigned(
    actionType: 'teleoperator' | 'confirmateur',
    newValue: string
  ): number {
    if (newValue !== 'none' && newValue !== '') {
      // If we're assigning a value (not clearing), no contacts will become unassigned
      return 0;
    }
    
    // We're clearing the field, so check which contacts will have both fields as None
    let count = 0;
    const selectedContactIds = Array.from(selectedContacts);
    
    selectedContactIds.forEach(contactId => {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;
      
      const teleoperatorId = contact.teleoperatorId || '';
      const confirmateurId = contact.confirmateurId || '';
      
      let willBeUnassigned = false;
      if (actionType === 'teleoperator') {
        // Clearing teleoperator - check if confirmateur is already empty
        willBeUnassigned = !confirmateurId || confirmateurId === '';
      } else {
        // Clearing confirmateur - check if teleoperator is already empty
        willBeUnassigned = !teleoperatorId || teleoperatorId === '';
      }
      
      if (willBeUnassigned) {
        count++;
      }
    });
    
    return count;
  }

  // Actions multiples
  async function handleBulkAssignTeleoperator(teleoperatorId: string) {
    if (!teleoperatorId) return;
    
    const teleoperatorIdValue = teleoperatorId !== 'none' ? teleoperatorId : '';
    
    // Check if we're clearing teleoperator and if any contacts will become unassigned
    if (teleoperatorId === 'none' || teleoperatorId === '') {
      const affectedCount = countContactsThatWillBecomeUnassigned('teleoperator', teleoperatorId);
      if (affectedCount > 0) {
        // Show confirmation modal
        setPendingBulkAction({
          type: 'teleoperator',
          value: teleoperatorIdValue,
          affectedCount
        });
        setIsStatusChangeConfirmOpen(true);
        return;
      }
    }
    
    // Proceed with the action
    await executeBulkAssignTeleoperator(teleoperatorIdValue);
  }

  async function executeBulkAssignTeleoperator(teleoperatorIdValue: string) {
    try {
      const promises = Array.from(selectedContacts).map(contactId =>
        apiCall(`/api/contacts/${contactId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ teleoperatorId: teleoperatorIdValue })
        })
      );
      await Promise.all(promises);
      toast.success(`${selectedContacts.size} contact(s) mis à jour avec succès`);
      handleClearSelection();
      setBulkTeleoperatorId('');
      // Small delay to ensure backend transaction is committed, then reload data
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadData();
    } catch (error: any) {
      console.error('Error assigning teleoperator:', error);
      const errorMessage = error?.response?.error || error?.message || 'Erreur lors de l\'attribution du téléopérateur';
      toast.error(errorMessage);
    }
  }

  async function handleBulkAssignConfirmateur(confirmateurId: string) {
    if (!confirmateurId) return;
    
    const confirmateurIdValue = confirmateurId !== 'none' ? confirmateurId : '';
    
    // Check if we're clearing confirmateur and if any contacts will become unassigned
    if (confirmateurId === 'none' || confirmateurId === '') {
      const affectedCount = countContactsThatWillBecomeUnassigned('confirmateur', confirmateurId);
      if (affectedCount > 0) {
        // Show confirmation modal
        setPendingBulkAction({
          type: 'confirmateur',
          value: confirmateurIdValue,
          affectedCount
        });
        setIsStatusChangeConfirmOpen(true);
        return;
      }
    }
    
    // Proceed with the action
    await executeBulkAssignConfirmateur(confirmateurIdValue);
  }

  async function executeBulkAssignConfirmateur(confirmateurIdValue: string) {
    try {
      const promises = Array.from(selectedContacts).map(async (contactId) => {
        const response = await apiCall(`/api/contacts/${contactId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ confirmateurId: confirmateurIdValue })
        });
        return response;
      });
      await Promise.all(promises);
      toast.success(`${selectedContacts.size} contact(s) mis à jour avec succès`);
      handleClearSelection();
      setBulkConfirmateurId('');
      // Small delay to ensure backend transaction is committed, then reload data
      await new Promise(resolve => setTimeout(resolve, 200));
      await loadData();
    } catch (error: any) {
      console.error('Error assigning confirmateur:', error);
      const errorMessage = error?.response?.error || error?.message || 'Erreur lors de l\'attribution du confirmateur';
      toast.error(errorMessage);
    }
  }


  async function handleBulkDelete() {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedContacts.size} contact(s) ? Cette action est irréversible.`)) return;
    
    setIsDeleting(true);
    try {
      const promises = Array.from(selectedContacts).map(contactId =>
        apiCall(`/api/contacts/${contactId}/delete/`, { method: 'DELETE' })
      );
      await Promise.all(promises);
      loadData();
      handleClearSelection();
      toast.success(`${selectedContacts.size} contact(s) supprimé(s) avec succès`);
    } catch (error) {
      console.error('Error deleting contacts:', error);
      toast.error('Erreur lors de la suppression des contacts');
    } finally {
      setIsDeleting(false);
    }
  }


  // Check if user can create planning events
  const canCreatePlanning = useHasPermission('planning', 'create');
  
  // Initialize event fields when event status is selected
  React.useEffect(() => {
    if (isStatusModalOpen && selectedStatusId && statuses.length > 0) {
      if (selectedStatusIsEvent && canCreatePlanning && !eventDate) {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        setEventDate(dateStr);
        // Don't pre-fill hour and minute - leave them empty
        setEventHour('');
        setEventMinute('');
        if (selectedContact) {
          const defaultTeleoperatorId = currentUser?.isTeleoperateur === true 
            ? currentUser.id 
            : (selectedContact.teleoperatorId || selectedContact.managerId || '');
          setEventTeleoperatorId(defaultTeleoperatorId);
        }
      } else if (!selectedStatusIsEvent) {
        setEventDate('');
        setEventHour('');
        setEventMinute('');
        setEventTeleoperatorId('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatusId, isStatusModalOpen, selectedStatusIsEvent]);
  
  // Auto-set filter based on contact's current status or user permissions
  React.useEffect(() => {
    if (isStatusModalOpen && statuses.length > 0 && selectedContact) {
      // First, check the contact's current status type
      const currentStatus = selectedContact.statusId ? statuses.find((s: any) => s.id === selectedContact.statusId) : null;
      
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
  }, [isStatusModalOpen, statuses, statusViewPermissions, selectedContact]);
  
  // Prefill client form when modal opens if selected status is client default
  React.useEffect(() => {
    if (isStatusModalOpen && selectedContact && selectedStatusId) {
      const selectedStatus = statuses.find(s => s.id === selectedStatusId);
      if (selectedStatus?.clientDefault === true) {
        prefillClientForm(selectedContact);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStatusModalOpen, selectedContact, selectedStatusId, statuses]);

  // Ensure first category is selected when modal opens and categories are available
  React.useEffect(() => {
    if (isStatusModalOpen && accessibleCategories.length > 0 && !statusChangeNoteCategoryId) {
      setStatusChangeNoteCategoryId(accessibleCategories[0].id);
    }
  }, [isStatusModalOpen, accessibleCategories, statusChangeNoteCategoryId]);
  
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
    if (!selectedContact) return;
    
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
    
    // If status is an event status, validate event fields
    if (selectedStatusIsEvent && canCreatePlanning) {
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
    if (selectedStatusId !== selectedContact.statusId) {
      // Check if user has EDIT permission for CURRENT status (to allow changing it)
      if (selectedContact.statusId && !canEditContact(selectedContact)) {
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
      if (!canEditContact(selectedContact)) {
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
        await apiCall(`/api/contacts/${selectedContact.id}/`, {
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
        
        if (selectedStatusIsEvent && eventTeleoperatorId) {
          updatePayload.teleoperatorId = eventTeleoperatorId || null;
        }
        
        await apiCall(`/api/contacts/${selectedContact.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });
      }
      
      // Create event if status has isEvent=true
      if (selectedStatusIsEvent && canCreatePlanning && eventDate) {
        const timeString = `${eventHour.padStart(2, '0')}:${eventMinute.padStart(2, '0')}`;
        await apiCall('/api/events/create/', {
          method: 'POST',
          body: JSON.stringify({
            datetime: `${eventDate}T${timeString}`,
            contactId: selectedContact.id,
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
          contactId: selectedContact.id
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
      
      toast.success(selectedStatusIsEvent ? 'Statut mis à jour et événement créé avec succès' : (selectedStatusIsClientDefault ? 'Contact mis à jour avec succès' : 'Statut mis à jour avec succès'));
      setIsStatusModalOpen(false);
      setSelectedContact(null);
      setSelectedStatusId('');
      setStatusChangeNote('');
      setStatusChangeNoteCategoryId('');
      setStatusModalFilterType('lead');
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
      // Wait for loadData to complete to ensure fresh data for next modal open
      await loadData();
    } catch (error: any) {
      console.error('Error updating status:', error);
      const errorMessage = error?.response?.error || error?.response?.detail || error?.message || 'Erreur lors de la mise à jour';
      toast.error(errorMessage);
    } finally {
      setIsSavingClientForm(false);
    }
  }


  // Filter users for teleoperator and confirmateur
  const teleoperateurs = users.filter(user => user.isTeleoperateur === true);
  
  const confirmateurs = users.filter(user => {
    // Check both boolean true and string 'true' for safety
    const isConfirmateur = user.isConfirmateur === true || user.isConfirmateur === 'true';
    return isConfirmateur;
  });

  // Helper function to render table content (reused in normal and fullscreen views)
  const renderTableContent = (fullscreen: boolean = false) => (
    <>
          {isLoading ? (
            <div className="contacts-loading" style={{ padding: '40px', textAlign: 'center' }}>
              <p className="contacts-loading-text" style={{ color: '#64748b' }}>
                Chargement...
              </p>
            </div>
          ) : (
        <div className={`contacts-table-wrapper ${fullscreen ? 'contacts-table-wrapper-fullscreen' : ''}`}>
              <table className="contacts-table">
                <thead>
                  <tr>
                    {canCreate && (
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(input) => {
                            if (input) input.indeterminate = someSelected;
                          }}
                          onChange={handleSelectAll}
                          className="contacts-checkbox"
                          disabled={displayedContacts.length === 0}
                        />
                      </th>
                    )}
                    {getOrderedVisibleColumns().map((columnId) => (
                      <th key={columnId} style={{ position: 'relative' }}>
                        {isFilterForced(columnId) ? (
                          // If filter is forced, just show a button without popover
                          <button
                            className="contacts-column-header-button"
                            disabled
                            title="Ce filtre est forcé et ne peut pas être modifié"
                          >
                            <span>{getColumnLabel(columnId)}</span>
                            {(pendingColumnFilters[columnId] || columnFilters[columnId]) && (
                              <Filter className="w-3 h-3" style={{ color: '#3b82f6' }} />
                            )}
                          </button>
                        ) : (
                          <Popover 
                            open={openFilterColumn === columnId}
                            onOpenChange={(open) => {
                              setOpenFilterColumn(open ? columnId : null);
                              // Clear search term and status type filter when closing
                              if (!open) {
                                setColumnFilterSearchTerms(prev => {
                                  const newTerms = { ...prev };
                                  delete newTerms[columnId];
                                  return newTerms;
                                });
                                if (columnId === 'status') {
                                  setStatusColumnFilterType('lead');
                                }
                                if (columnId === 'previousStatus') {
                                  setPreviousStatusColumnFilterType('lead');
                                }
                              }
                              // Initialize pending filter with current applied filter when opening
                              if (open && isDateColumn(columnId)) {
                                const currentFilter = columnFilters[columnId];
                                if (currentFilter && typeof currentFilter === 'object' && currentFilter !== null) {
                                  setPendingColumnFilters(prev => ({
                                    ...prev,
                                    [columnId]: { ...(currentFilter as { from?: string; to?: string }) }
                                  }));
                                } else {
                                  setPendingColumnFilters(prev => ({
                                    ...prev,
                                    [columnId]: { from: '', to: '' }
                                  }));
                                }
                              } else if (open) {
                                if (shouldUseMultiSelectFilter(columnId)) {
                                  // Initialize multi-select filter
                                  const currentFilter = columnFilters[columnId];
                                  const filterArray = Array.isArray(currentFilter) ? currentFilter : 
                                                    (typeof currentFilter === 'string' && currentFilter ? [currentFilter] : []);
                                  setPendingColumnFilters(prev => ({
                                    ...prev,
                                    [columnId]: filterArray.length > 0 ? filterArray : ''
                                  }));
                                } else if (!pendingColumnFilters[columnId]) {
                                  // Initialize with current applied filter for non-date columns
                                  setPendingColumnFilters(prev => ({
                                    ...prev,
                                    [columnId]: columnFilters[columnId] || ''
                                  }));
                                }
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                className="contacts-column-header-button"
                              >
                                <span>{getColumnLabel(columnId)}</span>
                                {(pendingColumnFilters[columnId] || columnFilters[columnId]) && (
                                  <Filter className="w-3 h-3" style={{ color: '#3b82f6' }} />
                                )}
                              </button>
                            </PopoverTrigger>
                          <PopoverContent 
                            className="w-80 p-4" 
                            align="start"
                            onClick={(e) => e.stopPropagation()}
                            style={{ zIndex: 10001 }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Label className="text-sm font-semibold">
                                  Filtrer par {getColumnLabel(columnId)}
                                </Label>
                              </div>
                              {shouldUseMultiSelectFilter(columnId) ? (
                                <>
                                  {(columnId === 'status' || columnId === 'previousStatus') && (
                                    <div className="mb-2 flex gap-2">
                                      <Button
                                        type="button"
                                        variant={(columnId === 'status' ? statusColumnFilterType : previousStatusColumnFilterType) === 'lead' ? 'default' : 'outline'}
                                        size="sm"
                                        className="flex-1 h-8 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (columnId === 'status') {
                                            setStatusColumnFilterType('lead');
                                          } else {
                                            setPreviousStatusColumnFilterType('lead');
                                          }
                                        }}
                                      >
                                        Lead
                                      </Button>
                                      <Button
                                        type="button"
                                        variant={(columnId === 'status' ? statusColumnFilterType : previousStatusColumnFilterType) === 'client' ? 'default' : 'outline'}
                                        size="sm"
                                        className="flex-1 h-8 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (columnId === 'status') {
                                            setStatusColumnFilterType('client');
                                          } else {
                                            setPreviousStatusColumnFilterType('client');
                                          }
                                        }}
                                      >
                                        Client
                                      </Button>
                                    </div>
                                  )}
                                  <div className="mb-2 border-b border-border pb-2 space-y-2">
                                    <div className="relative">
                                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                      <Input
                                        className="pl-8 h-8 text-sm"
                                        placeholder="Rechercher..."
                                        value={columnFilterSearchTerms[columnId] || ''}
                                        onChange={(e) => {
                                          setColumnFilterSearchTerms(prev => ({
                                            ...prev,
                                            [columnId]: e.target.value
                                          }));
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        autoFocus
                                      />
                                    </div>
                                    {(() => {
                                      const searchTerm = (columnFilterSearchTerms[columnId] || '').toLowerCase();
                                      const statusTypeFilter = columnId === 'status' 
                                        ? statusColumnFilterType 
                                        : columnId === 'previousStatus'
                                        ? previousStatusColumnFilterType
                                        : 'lead';
                                      const allOptions = getFilterOptions(columnId, statusTypeFilter);
                                      const emptyOption = allOptions.find(opt => opt.id === '__empty__');
                                      const otherOptions = allOptions.filter(opt => opt.id !== '__empty__');
                                      const filteredOtherOptions = searchTerm
                                        ? otherOptions.filter(option =>
                                            option.label.toLowerCase().includes(searchTerm)
                                          )
                                        : otherOptions;
                                      const filteredOptions = emptyOption 
                                        ? [emptyOption, ...filteredOtherOptions]
                                        : filteredOtherOptions;
                                      
                                      const currentValue = pendingColumnFilters[columnId];
                                      const selectedValues = Array.isArray(currentValue) ? currentValue : 
                                                           (typeof currentValue === 'string' && currentValue ? [currentValue] : []);
                                      
                                      // For status and previousStatus columns with tabs, show separate buttons for each tab
                                      if ((columnId === 'status' || columnId === 'previousStatus')) {
                                        // Get all status IDs for Lead and Client tabs
                                        const leadOptions = getFilterOptions(columnId, 'lead');
                                        const clientOptions = getFilterOptions(columnId, 'client');
                                        
                                        // Get all Lead status IDs (excluding empty)
                                        const allLeadStatusIds = leadOptions
                                          .filter(opt => opt.id !== '__empty__')
                                          .map(opt => opt.id)
                                          .filter(statusId => {
                                            if (columnId === 'status') {
                                              const status = statuses.find(s => s.id === statusId);
                                              return status && status.type === 'lead';
                                            } else {
                                              const status = statuses.find(s => s.name === statusId);
                                              return status && status.type === 'lead';
                                            }
                                          });
                                        
                                        // Get all Client status IDs (excluding empty)
                                        const allClientStatusIds = clientOptions
                                          .filter(opt => opt.id !== '__empty__')
                                          .map(opt => opt.id)
                                          .filter(statusId => {
                                            if (columnId === 'status') {
                                              const status = statuses.find(s => s.id === statusId);
                                              return status && status.type === 'client';
                                            } else {
                                              const status = statuses.find(s => s.name === statusId);
                                              return status && status.type === 'client';
                                            }
                                          });
                                        
                                        // Check if all Lead statuses are selected
                                        const allLeadSelected = allLeadStatusIds.length > 0 && 
                                          allLeadStatusIds.every(id => selectedValues.includes(id));
                                        
                                        // Check if all Client statuses are selected
                                        const allClientSelected = allClientStatusIds.length > 0 && 
                                          allClientStatusIds.every(id => selectedValues.includes(id));
                                        
                                        return (
                                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                            <span>{filteredOptions.length} option{filteredOptions.length > 1 ? 's' : ''} affichée{filteredOptions.length > 1 ? 's' : ''}</span>
                                            <div className="flex gap-1">
                                              {/* Lead tab select all button - only show in Lead tab */}
                                              {statusTypeFilter === 'lead' && (
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPendingColumnFilters(prev => {
                                                      const current = prev[columnId];
                                                      const currentArray = Array.isArray(current) ? current : 
                                                                         (typeof current === 'string' && current ? [current] : []);
                                                      
                                                      if (allLeadSelected) {
                                                        // Deselect all Lead statuses
                                                        const newArray = currentArray.filter(id => {
                                                          if (id === '__empty__') return true;
                                                          if (columnId === 'status') {
                                                            const status = statuses.find(s => s.id === id);
                                                            return !status || status.type !== 'lead';
                                                          } else {
                                                            const status = statuses.find(s => s.name === id);
                                                            return !status || status.type !== 'lead';
                                                          }
                                                        });
                                                        return {
                                                          ...prev,
                                                          [columnId]: newArray.length > 0 ? newArray : ''
                                                        };
                                                      } else {
                                                        // Select all Lead statuses (keep Client statuses and empty)
                                                        const newArraySet = new Set(currentArray);
                                                        allLeadStatusIds.forEach(id => newArraySet.add(id));
                                                        const newArray = Array.from(newArraySet);
                                                        return {
                                                          ...prev,
                                                          [columnId]: newArray.length > 0 ? newArray : ''
                                                        };
                                                      }
                                                    });
                                                  }}
                                                >
                                                  {allLeadSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                                                </Button>
                                              )}
                                              
                                              {/* Client tab select all button - only show in Client tab */}
                                              {statusTypeFilter === 'client' && (
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPendingColumnFilters(prev => {
                                                      const current = prev[columnId];
                                                      const currentArray = Array.isArray(current) ? current : 
                                                                         (typeof current === 'string' && current ? [current] : []);
                                                      
                                                      if (allClientSelected) {
                                                        // Deselect all Client statuses
                                                        const newArray = currentArray.filter(id => {
                                                          if (id === '__empty__') return true;
                                                          if (columnId === 'status') {
                                                            const status = statuses.find(s => s.id === id);
                                                            return !status || status.type !== 'client';
                                                          } else {
                                                            const status = statuses.find(s => s.name === id);
                                                            return !status || status.type !== 'client';
                                                          }
                                                        });
                                                        return {
                                                          ...prev,
                                                          [columnId]: newArray.length > 0 ? newArray : ''
                                                        };
                                                      } else {
                                                        // Select all Client statuses (keep Lead statuses and empty)
                                                        const newArraySet = new Set(currentArray);
                                                        allClientStatusIds.forEach(id => newArraySet.add(id));
                                                        const newArray = Array.from(newArraySet);
                                                        return {
                                                          ...prev,
                                                          [columnId]: newArray.length > 0 ? newArray : ''
                                                        };
                                                      }
                                                    });
                                                  }}
                                                >
                                                  {allClientSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      } else {
                                        // For other columns, use the original single button logic
                                        const allFilteredSelected = filteredOptions.length > 0 && filteredOptions.every(opt => selectedValues.includes(opt.id));
                                        
                                        return (
                                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>{filteredOptions.length} option{filteredOptions.length > 1 ? 's' : ''} affichée{filteredOptions.length > 1 ? 's' : ''}</span>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setPendingColumnFilters(prev => {
                                                  const current = prev[columnId];
                                                  const currentArray = Array.isArray(current) ? current : 
                                                                     (typeof current === 'string' && current ? [current] : []);
                                                  
                                                  if (allFilteredSelected) {
                                                    // Deselect all filtered options
                                                    const filteredIds = filteredOptions.map(opt => opt.id);
                                                    const newArray = currentArray.filter(id => !filteredIds.includes(id));
                                                    return {
                                                      ...prev,
                                                      [columnId]: newArray.length > 0 ? newArray : ''
                                                    };
                                                  } else {
                                                    // Select all filtered options
                                                    const filteredIds = filteredOptions.map(opt => opt.id);
                                                    const newArray = [...new Set([...currentArray, ...filteredIds])];
                                                    return {
                                                      ...prev,
                                                      [columnId]: newArray.length > 0 ? newArray : ''
                                                    };
                                                  }
                                                });
                                              }}
                                            >
                                              {allFilteredSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                                            </Button>
                                          </div>
                                        );
                                      }
                                    })()}
                                  </div>
                                  <div 
                                    className="contacts-column-filter-scroll overflow-y-auto overflow-x-hidden" 
                                    style={{ height: '150px' }}
                                  >
                                    {(() => {
                                      const searchTerm = (columnFilterSearchTerms[columnId] || '').toLowerCase();
                                      const statusTypeFilter = columnId === 'status' 
                                        ? statusColumnFilterType 
                                        : columnId === 'previousStatus'
                                        ? previousStatusColumnFilterType
                                        : 'lead';
                                      const allOptions = getFilterOptions(columnId, statusTypeFilter);
                                      
                                      // Always show empty option first, then filter other options
                                      const emptyOption = allOptions.find(opt => opt.id === '__empty__');
                                      const otherOptions = allOptions.filter(opt => opt.id !== '__empty__');
                                      
                                      const filteredOtherOptions = searchTerm
                                        ? otherOptions.filter(option =>
                                            option.label.toLowerCase().includes(searchTerm)
                                          )
                                        : otherOptions;
                                      
                                      // Combine empty option (always first) with filtered options
                                      const filteredOptions = emptyOption 
                                        ? [emptyOption, ...filteredOtherOptions]
                                        : filteredOtherOptions;
                                      
                                      if (filteredOptions.length === 0) {
                                        return (
                                          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                            Aucun résultat
                                          </div>
                                        );
                                      }
                                      
                                      return filteredOptions.map(option => {
                                      const currentValue = pendingColumnFilters[columnId];
                                      const selectedValues = Array.isArray(currentValue) ? currentValue : 
                                                           (typeof currentValue === 'string' && currentValue ? [currentValue] : []);
                                      const isChecked = selectedValues.includes(option.id);
                                      
                                      return (
                                        <div
                                          key={option.id}
                                          className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                          onClick={() => {
                                            setPendingColumnFilters(prev => {
                                              const current = prev[columnId];
                                              const currentArray = Array.isArray(current) ? current : 
                                                                 (typeof current === 'string' && current ? [current] : []);
                                              
                                              let newArray: string[];
                                              if (isChecked) {
                                                newArray = currentArray.filter(id => id !== option.id);
                                              } else {
                                                newArray = [...currentArray, option.id];
                                              }
                                              
                                              return {
                                                ...prev,
                                                [columnId]: newArray.length > 0 ? newArray : ''
                                              };
                                            });
                                          }}
                                        >
                                          <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                                            {isChecked && (
                                              <Check className="h-4 w-4" />
                                            )}
                                          </span>
                                            {option.id === '__empty__' ? (
                                              <span className="text-muted-foreground italic">{option.label}</span>
                                            ) : columnId === 'status' ? (
                                            <span 
                                              className="inline-block px-2 py-1 rounded text-sm"
                                              style={{
                                                backgroundColor: statuses.find(s => s.id === option.id)?.color || '#e5e7eb',
                                                color: statuses.find(s => s.id === option.id)?.color ? '#000000' : '#374151'
                                              }}
                                            >
                                              {option.label}
                                            </span>
                                          ) : columnId === 'previousStatus' ? (
                                            <span 
                                              className="inline-block px-2 py-1 rounded text-sm"
                                              style={{
                                                backgroundColor: statuses.find(s => s.name === option.id && s.type === previousStatusColumnFilterType)?.color || '#e5e7eb',
                                                color: statuses.find(s => s.name === option.id && s.type === previousStatusColumnFilterType)?.color ? '#000000' : '#374151'
                                              }}
                                            >
                                              {option.label}
                                            </span>
                                          ) : (
                                            <span>{option.label}</span>
                                          )}
                                        </div>
                                      );
                                      });
                                    })()}
                                  </div>
                                  {columnFilters[columnId] && (
                                    <p className="text-xs text-slate-500 mt-2">
                                      {totalContacts.toLocaleString('fr-FR')} contact(s) correspondant
                                    </p>
                                  )}
                                </>
                              ) : isDateColumn(columnId) ? (
                                <>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div>
                                      <Label className="text-xs text-slate-600 mb-1 block">Du</Label>
                                      <DateInput
                                        value={(() => {
                                          const pendingValue = pendingColumnFilters[columnId];
                                          const appliedValue = columnFilters[columnId];
                                          if (typeof pendingValue === 'object' && pendingValue !== null) {
                                            return (pendingValue as { from?: string }).from || '';
                                          }
                                          if (typeof appliedValue === 'object' && appliedValue !== null) {
                                            return (appliedValue as { from?: string }).from || '';
                                          }
                                          return '';
                                        })()}
                                        onChange={(value) => {
                                          const currentValue = pendingColumnFilters[columnId];
                                          const currentRange = typeof currentValue === 'object' && currentValue !== null 
                                            ? currentValue as { from?: string; to?: string }
                                            : typeof columnFilters[columnId] === 'object' && columnFilters[columnId] !== null
                                              ? columnFilters[columnId] as { from?: string; to?: string }
                                              : { from: '', to: '' };
                                          
                                          setPendingColumnFilters(prev => ({
                                            ...prev,
                                            [columnId]: {
                                              ...currentRange,
                                              from: value
                                            }
                                          }));
                                        }}
                                        className="w-full"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-slate-600 mb-1 block">Au</Label>
                                      <DateInput
                                        value={(() => {
                                          const pendingValue = pendingColumnFilters[columnId];
                                          const appliedValue = columnFilters[columnId];
                                          if (typeof pendingValue === 'object' && pendingValue !== null) {
                                            return (pendingValue as { to?: string }).to || '';
                                          }
                                          if (typeof appliedValue === 'object' && appliedValue !== null) {
                                            return (appliedValue as { to?: string }).to || '';
                                          }
                                          return '';
                                        })()}
                                        onChange={(value) => {
                                          const currentValue = pendingColumnFilters[columnId];
                                          const currentRange = typeof currentValue === 'object' && currentValue !== null 
                                            ? currentValue as { from?: string; to?: string }
                                            : typeof columnFilters[columnId] === 'object' && columnFilters[columnId] !== null
                                              ? columnFilters[columnId] as { from?: string; to?: string }
                                              : { from: '', to: '' };
                                          
                                          setPendingColumnFilters(prev => ({
                                            ...prev,
                                            [columnId]: {
                                              ...currentRange,
                                              to: value
                                            }
                                          }));
                                        }}
                                        className="w-full"
                                      />
                                    </div>
                                  </div>
                                  {columnFilters[columnId] && (
                                    <p className="text-xs text-slate-500">
                                      {totalContacts.toLocaleString('fr-FR')} contact(s) correspondant
                                    </p>
                                  )}
                                </>
                              ) : (
                                <>
                                  <Input
                                    type="text"
                                    placeholder={`Rechercher dans ${getColumnLabel(columnId).toLowerCase()}...`}
                                    value={typeof pendingColumnFilters[columnId] === 'string' ? pendingColumnFilters[columnId] as string : ''}
                                    onChange={(e) => {
                                      setPendingColumnFilters(prev => ({
                                        ...prev,
                                        [columnId]: e.target.value
                                      }));
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleApplyColumnFilter(columnId);
                                      }
                                    }}
                                    autoFocus
                                  />
                                  {columnFilters[columnId] && (
                                    <p className="text-xs text-slate-500">
                                      {totalContacts.toLocaleString('fr-FR')} contact(s) correspondant
                                    </p>
                                  )}
                                </>
                              )}
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    handleResetColumnFilter(columnId);
                                  }}
                                  disabled={(() => {
                                    const pending = pendingColumnFilters[columnId];
                                    const applied = columnFilters[columnId];
                                    if (isDateColumn(columnId)) {
                                      const pendingRange = typeof pending === 'object' && pending !== null && !Array.isArray(pending) ? pending as { from?: string; to?: string } : null;
                                      const appliedRange = typeof applied === 'object' && applied !== null && !Array.isArray(applied) ? applied as { from?: string; to?: string } : null;
                                      return !pendingRange?.from && !pendingRange?.to && !appliedRange?.from && !appliedRange?.to;
                                    }
                                    if (shouldUseMultiSelectFilter(columnId)) {
                                      const pendingArray = Array.isArray(pending) ? pending : [];
                                      const appliedArray = Array.isArray(applied) ? applied : [];
                                      return pendingArray.length === 0 && appliedArray.length === 0;
                                    }
                                    return !pending && !applied;
                                  })()}
                                >
                                  Réinitialiser
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleApplyColumnFilter(columnId)}
                                  disabled={(() => {
                                    const pending = pendingColumnFilters[columnId];
                                    const applied = columnFilters[columnId];
                                    if (isDateColumn(columnId)) {
                                      const pendingRange = typeof pending === 'object' && pending !== null && !Array.isArray(pending) ? pending as { from?: string; to?: string } : null;
                                      const appliedRange = typeof applied === 'object' && applied !== null && !Array.isArray(applied) ? applied as { from?: string; to?: string } : null;
                                      return JSON.stringify(pendingRange) === JSON.stringify(appliedRange);
                                    }
                                    if (shouldUseMultiSelectFilter(columnId)) {
                                      const pendingArray = Array.isArray(pending) ? pending.sort() : [];
                                      const appliedArray = Array.isArray(applied) ? applied.sort() : [];
                                      return JSON.stringify(pendingArray) === JSON.stringify(appliedArray);
                                    }
                                    return pending === applied;
                                  })()}
                                >
                                  <Filter className="w-4 h-4 mr-2" />
                                  Appliquer
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedContacts.length > 0 ? (
                    displayedContacts.map((contact) => (
                      <tr 
                        key={contact.id}
                        onClick={(e) => {
                          // Only open if clicking on the row itself, not on interactive elements
                          const target = e.target as HTMLElement;
                          // Check if click is on an interactive element
                          if (
                            target.tagName === 'INPUT' ||
                            target.tagName === 'BUTTON' ||
                            target.tagName === 'SELECT' ||
                            target.closest('button') ||
                            target.closest('select') ||
                            target.closest('input') ||
                            target.closest('[role="button"]') ||
                            target.closest('[data-radix-popper-content-wrapper]') ||
                            target.closest('.contacts-checkbox') ||
                            target.closest('.contacts-status-badge')
                          ) {
                            return; // Don't open contact detail
                          }
                          openContactDetail(contact.id);
                        }}
                        style={{
                          backgroundColor: lastOpenedContactId === contact.id ? '#eff6ff' : 'transparent',
                          borderLeft: lastOpenedContactId === contact.id ? '3px solid #3b82f6' : 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {canCreate && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedContacts.has(contact.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectContact(contact.id);
                              }}
                              className="contacts-checkbox"
                            />
                          </td>
                        )}
                        {getOrderedVisibleColumns().map((columnId) => renderCell(contact, columnId))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={getOrderedVisibleColumns().length + (canCreate ? 1 : 0)} style={{ textAlign: 'center', padding: '40px' }}>
                        <p className="contacts-empty">Aucun contact trouvé</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination Controls */}
          {totalPages > 1 && displayedContacts.length > 0 && (
            <div className="contacts-pagination">
              <div className="contacts-pagination-info">
                <span>
                  Affichage de {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, totalContacts)} sur {totalContacts} contact(s)
                </span>
              </div>
              <div className="contacts-pagination-controls">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Précédent
                </Button>
                
                <div className="contacts-pagination-pages">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="contacts-pagination-page-btn"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Suivant
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
    </>
  );

  return (
    <div className={`contacts-container ${isFullscreen ? 'contacts-container-fullscreen' : ''}`}>
      <div className="contacts-header page-header">
        <div className="page-title-section">
          <h1 className="page-title">{pageTitle}</h1>
          <p className="page-subtitle">{pageSubtitle}</p>
        </div>
        
        <div className="flex gap-2">
          {canCreate && (
            <>
              {showImportButton && (
                <Button variant="outline" onClick={() => navigate(importButtonPath)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Importer CSV
                </Button>
              )}
              {showCreateButton && (
                <Button onClick={() => navigate(createButtonPath)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un contact
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="contacts-filters-card">
        <CardContent className="pt-6">
          <div className="contacts-filters">
            <div className="contacts-filter-section contacts-filter-search">
              <Label>Recherche</Label>
              <div className="contacts-search-wrapper">
                <Search className="contacts-search-icon" />
                <Input
                  className="contacts-search-input"
                  placeholder="Nom, email..."
                  value={pendingSearchTerm}
                  onChange={(e) => setPendingSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleApplyFilters();
                    }
                  }}
                />
              </div>
            </div>

            <div className="contacts-filter-section">
              <Label>Type de contact</Label>
              <Select 
                value={appliedStatusType} 
                onValueChange={(value) => {
                  const statusType = value as 'all' | 'lead' | 'client';
                  setAppliedStatusType(statusType);
                  setPendingStatusType(statusType);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ zIndex: 10001 }}>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="contacts-filter-section">
              <Label>Ordre</Label>
              <Select 
                value={isFossePage && fosseSettings?.defaultOrder && fosseSettings.defaultOrder !== 'none' ? fosseSettings.defaultOrder : selectedOrder}
                disabled={isFossePage && fosseSettings?.defaultOrder !== undefined && fosseSettings.defaultOrder !== 'none'}
                onValueChange={(value) => {
                  const orderValue = value as 'created_at_asc' | 'created_at_desc' | 'updated_at_asc' | 'updated_at_desc' | 'assigned_at_asc' | 'assigned_at_desc' | 'email_asc' | 'random';
                  setSelectedOrder(orderValue);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ zIndex: 10001 }}>
                  <SelectItem value="created_at_asc">Date de création (ancien à nouveau)</SelectItem>
                  <SelectItem value="created_at_desc">Date de création (nouveau à ancien)</SelectItem>
                  <SelectItem value="updated_at_asc">Date de modification (ancien à nouveau)</SelectItem>
                  <SelectItem value="updated_at_desc">Date de modification (nouveau à ancien)</SelectItem>
                  <SelectItem value="assigned_at_asc">Date d'attribution (ancien à nouveau)</SelectItem>
                  <SelectItem value="assigned_at_desc">Date d'attribution (nouveau à ancien)</SelectItem>
                  <SelectItem value="email_asc">Email (ordre alphabétique)</SelectItem>
                  <SelectItem value="random">Aléatoire</SelectItem>
                </SelectContent>
              </Select>
              {isFossePage && fosseSettings?.defaultOrder && fosseSettings.defaultOrder !== 'none' && (
                <p className="text-xs text-slate-500 mt-1">
                  Ordre défini dans les paramètres de la fosse
                </p>
              )}
            </div>

            <div className="contacts-filter-section">
              <Label>Affichage par</Label>
              <Select 
                value={itemsPerPage.toString()} 
                onValueChange={(value) => {
                  const numValue = Number(value);
                  setItemsPerPage(numValue);
                  setPendingItemsPerPage(numValue);
                  setCurrentPage(1); // Reset to first page when changing items per page
                }}
              >
                <SelectTrigger>
                  <SelectValue>
                    {itemsPerPage}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent style={{ zIndex: 10001 }}>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Affichage des filtres actifs */}
      {(() => {
        const activeFiltersText = formatActiveFilters();
        if (!activeFiltersText) return null;
        
        return (
          <Card className="contacts-active-filters-card" style={{ marginTop: '8px', marginBottom: '8px' }}>
            <CardContent style={{ padding: '8px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <Filter className="w-4 h-4" style={{ color: '#3b82f6', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                    <strong>Filtre en cours :</strong> ({activeFiltersText})
                  </span>
                </div>
                {(Object.keys(appliedColumnFilters).length > 0 || appliedSearchTerm || appliedStatusType !== 'all') && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleResetFilters}
                    title="Réinitialiser les filtres"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Réinitialiser filtres ({Object.keys(appliedColumnFilters).length + (appliedSearchTerm ? 1 : 0) + (appliedStatusType !== 'all' ? 1 : 0)})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Barre d'actions multiples */}
      {showBulkActions && (
        <Card className="contacts-bulk-actions">
          <CardContent className="contacts-bulk-actions-content-wrapper">
            <div className="contacts-bulk-actions-content">
              <div className="contacts-bulk-actions-info">
                <span>{selectedContacts.size} contact(s) sélectionné(s)</span>
                <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
              </div>
              <div className="contacts-bulk-actions-buttons">
                {canEditInformationsTab && (
                  <>
                    <div className="contacts-bulk-action-select">
                      <Label className="sr-only">Attribuer un téléopérateur</Label>
                      <Select value={bulkTeleoperatorId ? String(bulkTeleoperatorId) : 'none'} onValueChange={handleBulkAssignTeleoperator}>
                        <SelectTrigger className="w-[200px]">
                          <UserCheck className="w-4 h-4 mr-2" />
                          <SelectValue placeholder="Attribuer un téléopérateur" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun téléopérateur</SelectItem>
                          {usersLoading ? (
                            <SelectItem value="loading" disabled>Chargement...</SelectItem>
                          ) : usersError && teleoperateurs.length === 0 ? (
                            <SelectItem value="error" disabled>
                              <span className="text-red-600">Erreur de chargement</span>
                            </SelectItem>
                          ) : teleoperateurs.length === 0 ? (
                            <SelectItem value="empty" disabled>Aucun téléopérateur disponible</SelectItem>
                          ) : (
                            teleoperateurs.map((user) => {
                              const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                              return (
                                <SelectItem key={user.id} value={String(user.id)}>
                                  {displayName}
                                </SelectItem>
                              );
                            })
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="contacts-bulk-action-select">
                      <Label className="sr-only">Attribuer un confirmateur</Label>
                      <Select value={bulkConfirmateurId ? String(bulkConfirmateurId) : 'none'} onValueChange={handleBulkAssignConfirmateur}>
                        <SelectTrigger className="w-[200px]">
                          <UserCheck className="w-4 h-4 mr-2" />
                          <SelectValue placeholder="Attribuer un confirmateur" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun confirmateur</SelectItem>
                          {usersLoading ? (
                            <SelectItem value="loading" disabled>Chargement...</SelectItem>
                          ) : usersError && confirmateurs.length === 0 ? (
                            <SelectItem value="error" disabled>
                              <span className="text-red-600">Erreur de chargement</span>
                            </SelectItem>
                          ) : confirmateurs.length === 0 ? (
                            <SelectItem value="empty" disabled>Aucun confirmateur disponible</SelectItem>
                          ) : (
                            confirmateurs.map((user) => {
                              const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                              return (
                                <SelectItem key={user.id} value={String(user.id)}>
                                  {displayName}
                                </SelectItem>
                              );
                            })
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {canDelete && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <span style={{ marginLeft: '8px' }}>Suppression...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <CardTitle>
              Liste des contacts ({displayedContacts.length} / {totalContacts})
              {totalPages > 1 && ` - Page ${currentPage} sur ${totalPages}`}
            </CardTitle>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => loadData()}
                disabled={isLoading}
                title="Rafraîchir la liste"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Rafraîchir
              </Button>
              {totalPages > 1 && displayedContacts.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    title="Page précédente"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          style={{ minWidth: '32px', padding: '0 8px' }}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    title="Page suivante"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Fermer le plein écran" : "Ouvrir en plein écran"}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-4 h-4 mr-2" />
                    Fermer
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4 mr-2" />
                    Plein écran
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsColumnSettingsOpen(true)}
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Colonnes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {renderTableContent(isFullscreen)}
        </CardContent>
      </Card>

      {/* Status Change Modal */}
      {isStatusModalOpen && selectedContact && (
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => {
          setIsStatusModalOpen(false);
          setSelectedContact(null);
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
        })}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: selectedStatusIsClientDefault ? '1200px' : '600px', 
              maxHeight: '90vh', 
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'row',
              gap: '20px'
            }}
          >
            {/* Left Column - Status Selection */}
            <div style={{ flex: selectedStatusIsClientDefault ? '0 0 400px' : '1', minWidth: 0 }}>
              <div className="modal-header">
                <h2 className="modal-title">Modifier le statut</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="modal-close"
                  onClick={() => {
                    setIsStatusModalOpen(false);
                    setSelectedContact(null);
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
                  }}
                >
                  <X className="planning-icon-md" />
                </Button>
              </div>
              <div className="modal-form">
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
                    // Use String() to ensure consistent type comparison
                    const selectedStatus = statuses.find(s => String(s.id) === String(value));
                    if (selectedStatus?.clientDefault === true) {
                      // Pre-fill form with existing contact data
                      // Prefill teleoperatorId with current user if they are a teleoperateur
                      const defaultTeleoperatorId = currentUser?.isTeleoperateur === true 
                        ? currentUser.id 
                        : (selectedContact.teleoperatorId || selectedContact.managerId || '');
                      
                      setClientFormData({
                        platformId: selectedContact.platformId || '',
                        teleoperatorId: defaultTeleoperatorId,
                        nomDeScene: selectedContact.nomDeScene || '',
                        firstName: selectedContact.firstName || '',
                        lastName: selectedContact.lastName || '',
                        emailClient: selectedContact.email || '',
                        telephoneClient: selectedContact.phone || '',
                        portableClient: selectedContact.mobile || '',
                        contrat: selectedContact.contrat || '',
                        sourceId: selectedContact.sourceId || '',
                        montantEncaisse: selectedContact.montantEncaisse || '',
                        bonus: selectedContact.bonus || '',
                        paiement: selectedContact.paiement || '',
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
                      // Use String() to ensure consistent type comparison
                      const selectedStatus = statuses.find((s: any) => String(s.id) === String(selectedStatusId));
                      if (selectedStatus) {
                        const normalizedStatusId = String(selectedStatus.id).trim();
                        // Check if contact is in fosse (teleoperator and confirmateur are null/empty)
                        const contactInFosse = isContactInFosse(selectedContact);
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
                        const contactInFosse = isContactInFosse(selectedContact);
                        
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
                  const currentStatus = selectedContact?.statusId ? statuses.find((s: any) => s.id === selectedContact.statusId) : null;
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
                              : (selectedContact.teleoperatorId || selectedContact.managerId || '');
                            
                            setClientFormData({
                              platformId: selectedContact.platformId || '',
                              teleoperatorId: defaultTeleoperatorId,
                              nomDeScene: selectedContact.nomDeScene || '',
                              firstName: selectedContact.firstName || '',
                              lastName: selectedContact.lastName || '',
                              emailClient: selectedContact.email || '',
                              telephoneClient: selectedContact.phone || '',
                              portableClient: selectedContact.mobile || '',
                              contrat: selectedContact.contrat || '',
                              sourceId: selectedContact.sourceId || '',
                              montantEncaisse: selectedContact.montantEncaisse || '',
                              bonus: selectedContact.bonus || '',
                              paiement: selectedContact.paiement || '',
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
              {selectedStatusIsEvent && (
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
                      disabled={!canCreatePlanning}
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
                      value={eventTeleoperatorId ? String(eventTeleoperatorId) : 'none'}
                      onValueChange={(value) => setEventTeleoperatorId(value === 'none' ? '' : value)}
                      disabled={isSavingClientForm || !canEditFieldInModal('teleoperatorId', selectedContact, selectedStatusId) || !canCreatePlanning}
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
                              <SelectItem key={user.id} value={String(user.id)}>
                                {displayName}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="modal-form-actions">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsStatusModalOpen(false);
                    setSelectedContact(null);
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
                  }}
                >
                  Annuler
                </Button>
                {canEditContact(selectedContact) && (
                  <Button 
                    type="button" 
                    onClick={handleUpdateStatus}
                    disabled={
                      isSavingClientForm ||
                      !statusChangeNote.trim() ||
                      (selectedStatusIsEvent && canCreatePlanning && (!eventDate || !eventHour || !eventMinute))
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
              <div style={{ flex: '1', minWidth: 0, borderLeft: '1px solid #e5e7eb', paddingLeft: '20px' }}>
                <div className="modal-header">
                  <h2 className="modal-title">Fiche client</h2>
                </div>
                <div className="modal-form">
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-sm text-blue-800">
                    <p className="font-semibold mb-2">Pour que le gestionnaire de compte reçoive toutes les informations nécessaires, merci de remplir la fiche de manière exacte, complète et en vous assurant qu'elle correspond exactement.</p>
                    <p className="mb-2">L'objectif : une fiche claire et fidèle aux échanges avec le client afin que le profil client sur la plateforme soit également en correspondance avec son identité.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="modal-form-field">
                        <Label htmlFor="client-platform" style={fieldErrors.platformId ? { color: '#ef4444' } : {}}>Plateforme <span style={{ color: '#ef4444' }}>*</span></Label>
                        <div className="flex gap-2">
                          <Select
                            value={clientFormData.platformId || 'none'}
                            onValueChange={(value) => updateFormField('platformId', value === 'none' ? '' : value)}
                            disabled={isSavingClientForm || !canEditFieldInModal('platformId', selectedContact, selectedStatusId)}
                            style={{ flex: 1 }}
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
                      </div>

                      <div className="modal-form-field">
                        <Label htmlFor="client-teleoperator" style={fieldErrors.teleoperatorId ? { color: '#ef4444' } : {}}>Nom du teleoperateur <span style={{ color: '#ef4444' }}>*</span></Label>
                        <Select
                          value={clientFormData.teleoperatorId ? String(clientFormData.teleoperatorId) : 'none'}
                          onValueChange={(value) => updateFormField('teleoperatorId', value === 'none' ? '' : value)}
                          disabled={isSavingClientForm || !canEditFieldInModal('teleoperatorId', selectedContact, selectedStatusId)}
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
                                  <SelectItem key={user.id} value={String(user.id)}>
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
                        disabled={isSavingClientForm || !canEditFieldInModal('nomDeScene', selectedContact, selectedStatusId)}
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
                          disabled={isSavingClientForm || !canEditFieldInModal('firstName', selectedContact, selectedStatusId)}
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
                          disabled={isSavingClientForm || !canEditFieldInModal('lastName', selectedContact, selectedStatusId)}
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
                        disabled={isSavingClientForm || !canEditFieldInModal('email', selectedContact, selectedStatusId)}
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
                          disabled={isSavingClientForm || !canEditFieldInModal('phone', selectedContact, selectedStatusId)}
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
                          disabled={isSavingClientForm || !canEditFieldInModal('mobile', selectedContact, selectedStatusId)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="modal-form-field">
                        <Label htmlFor="client-contrat" style={fieldErrors.contrat ? { color: '#ef4444' } : {}}>Contrat <span style={{ color: '#ef4444' }}>*</span></Label>
                        <Select
                          value={clientFormData.contrat || 'none'}
                          onValueChange={(value) => updateFormField('contrat', value === 'none' ? '' : value)}
                          disabled={isSavingClientForm || !canEditFieldInModal('contrat', selectedContact, selectedStatusId)}
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
                          disabled={isSavingClientForm || !canEditFieldInModal('sourceId', selectedContact, selectedStatusId)}
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
                          disabled={isSavingClientForm || !canEditFieldInModal('montantEncaisse', selectedContact, selectedStatusId)}
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
                          disabled={isSavingClientForm || !canEditFieldInModal('bonus', selectedContact, selectedStatusId)}
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
                        disabled={isSavingClientForm || !canEditFieldInModal('paiement', selectedContact, selectedStatusId)}
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


      {/* Column Settings Modal */}
      {isColumnSettingsOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsColumnSettingsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'stretch'
          }}
        >
          <div 
            className="column-settings-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '400px',
              maxWidth: '90vw',
              height: '100vh',
              backgroundColor: 'white',
              boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'slideInFromRight 0.3s ease-out',
              zIndex: 10002
            }}
          >
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, marginBottom: '4px' }}>
                  Configurer les colonnes
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                  Sélectionnez les colonnes à afficher dans le tableau des contacts
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsColumnSettingsOpen(false)}
                style={{ flexShrink: 0 }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px'
            }}>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Label className="text-sm font-medium">Colonnes disponibles</Label>
                <Button variant="outline" size="sm" onClick={handleResetColumns}>
                  Réinitialiser
                </Button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {columnOrder.map((columnId) => {
                  const column = allColumns.find(col => col.id === columnId);
                  if (!column) return null;
                  
                  return (
                    <div
                      key={column.id}
                      draggable
                      onDragStart={() => handleDragStart(column.id)}
                      onDragOver={(e) => handleDragOver(e, column.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, column.id)}
                      onDragEnd={handleDragEnd}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        borderRadius: '4px',
                        cursor: 'move',
                        backgroundColor: draggedColumnId === column.id ? '#f3f4f6' : 'transparent',
                        transition: 'background-color 0.2s',
                        border: draggedColumnId === column.id ? '1px dashed #3b82f6' : '1px solid transparent'
                      }}
                      className="column-drag-item"
                    >
                      <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <Checkbox
                        id={column.id}
                        checked={visibleColumns.includes(column.id)}
                        onCheckedChange={() => handleToggleColumn(column.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Label
                        htmlFor={column.id}
                        className="text-sm font-normal cursor-pointer flex-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {column.label}
                      </Label>
                    </div>
                  );
                }                )}
              </div>
            </div>

            {/* Right Column - Client Form (shown when client default status is selected) */}
            {selectedStatusIsClientDefault && (
              <div style={{ flex: '1', minWidth: 0, borderLeft: '1px solid #e5e7eb', paddingLeft: '20px' }}>
                <div className="modal-header">
                  <h2 className="modal-title">Fiche client</h2>
                </div>
                <div className="modal-form">
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-sm text-blue-800">
                    <p className="font-semibold mb-2">Pour que le gestionnaire de compte reçoive toutes les informations nécessaires, merci de remplir la fiche de manière exacte, complète et en vous assurant qu'elle correspond exactement.</p>
                    <p className="mb-2">L'objectif : une fiche claire et fidèle aux échanges avec le client afin que le profil client sur la plateforme soit également en correspondance avec son identité.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="modal-form-field">
                        <Label htmlFor="client-platform" style={fieldErrors.platformId ? { color: '#ef4444' } : {}}>Plateforme <span style={{ color: '#ef4444' }}>*</span></Label>
                        <div className="flex gap-2">
                          <Select
                            value={clientFormData.platformId || 'none'}
                            onValueChange={(value) => updateFormField('platformId', value === 'none' ? '' : value)}
                            disabled={isSavingClientForm || !canEditFieldInModal('platformId', selectedContact, selectedStatusId)}
                            style={{ flex: 1 }}
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
                      </div>

                      <div className="modal-form-field">
                        <Label htmlFor="client-teleoperator" style={fieldErrors.teleoperatorId ? { color: '#ef4444' } : {}}>Nom du teleoperateur <span style={{ color: '#ef4444' }}>*</span></Label>
                        <Select
                          value={clientFormData.teleoperatorId ? String(clientFormData.teleoperatorId) : 'none'}
                          onValueChange={(value) => updateFormField('teleoperatorId', value === 'none' ? '' : value)}
                          disabled={isSavingClientForm || !canEditFieldInModal('teleoperatorId', selectedContact, selectedStatusId)}
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
                                  <SelectItem key={user.id} value={String(user.id)}>
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
                        disabled={isSavingClientForm || !canEditFieldInModal('nomDeScene', selectedContact, selectedStatusId)}
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
                          disabled={isSavingClientForm || !canEditFieldInModal('firstName', selectedContact, selectedStatusId)}
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
                          disabled={isSavingClientForm || !canEditFieldInModal('lastName', selectedContact, selectedStatusId)}
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
                        disabled={isSavingClientForm || !canEditFieldInModal('email', selectedContact, selectedStatusId)}
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
                          disabled={isSavingClientForm || !canEditFieldInModal('phone', selectedContact, selectedStatusId)}
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
                          disabled={isSavingClientForm || !canEditFieldInModal('mobile', selectedContact, selectedStatusId)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="modal-form-field">
                        <Label htmlFor="client-contrat" style={fieldErrors.contrat ? { color: '#ef4444' } : {}}>Contrat <span style={{ color: '#ef4444' }}>*</span></Label>
                        <Select
                          value={clientFormData.contrat || 'none'}
                          onValueChange={(value) => updateFormField('contrat', value === 'none' ? '' : value)}
                          disabled={isSavingClientForm || !canEditFieldInModal('contrat', selectedContact, selectedStatusId)}
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
                          disabled={isSavingClientForm || !canEditFieldInModal('sourceId', selectedContact, selectedStatusId)}
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
                          disabled={isSavingClientForm || !canEditFieldInModal('montantEncaisse', selectedContact, selectedStatusId)}
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
                          disabled={isSavingClientForm || !canEditFieldInModal('bonus', selectedContact, selectedStatusId)}
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
                        disabled={isSavingClientForm || !canEditFieldInModal('paiement', selectedContact, selectedStatusId)}
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

      {/* Status Change Confirmation Modal */}
      {isStatusChangeConfirmOpen && (
        <div 
          className="modal-overlay" 
          onClick={(e) => {
            // Only close if clicking directly on the overlay, not on child elements
            if (e.target === e.currentTarget) {
              // Check if there's selected text - if so, don't close the modal
              const selection = window.getSelection();
              if (selection && selection.toString().length > 0) {
                return;
              }
              setIsStatusChangeConfirmOpen(false);
              const actionType = pendingBulkAction?.type;
              setPendingBulkAction(null);
              // Reset the select values
              if (actionType === 'teleoperator') {
                setBulkTeleoperatorId('');
              } else if (actionType === 'confirmateur') {
                setBulkConfirmateurId('');
              }
            }
          }}
          style={{
            zIndex: 10006,
            position: 'fixed',
            inset: 0,
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h2 className="modal-title">Attention</h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsStatusChangeConfirmOpen(false);
                  const actionType = pendingBulkAction?.type;
                  setPendingBulkAction(null);
                  // Reset the select values
                  if (actionType === 'teleoperator') {
                    setBulkTeleoperatorId('');
                  } else if (actionType === 'confirmateur') {
                    setBulkConfirmateurId('');
                  }
                }}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="modal-form-field">
                <p style={{ fontSize: '1rem', color: '#374151', lineHeight: '1.5' }}>
                  Cette manipulation risque de modifier le statut de <strong>{pendingBulkAction?.affectedCount || 0} contact(s)</strong>.
                  <br />
                  <br />
                  En retirant {pendingBulkAction?.type === 'teleoperator' ? 'le téléopérateur' : 'le confirmateur'}, ces contacts deviendront non assignés et leur statut sera automatiquement modifié selon les paramètres Fosse configurés.
                </p>
              </div>
              <div className="modal-form-actions">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsStatusChangeConfirmOpen(false);
                    const actionType = pendingBulkAction?.type;
                    setPendingBulkAction(null);
                    // Reset the select values
                    if (actionType === 'teleoperator') {
                      setBulkTeleoperatorId('');
                    } else if (actionType === 'confirmateur') {
                      setBulkConfirmateurId('');
                    }
                  }}
                >
                  Annuler
                </Button>
                <Button 
                  type="button"
                  onClick={async () => {
                    setIsStatusChangeConfirmOpen(false);
                    if (pendingBulkAction) {
                      if (pendingBulkAction.type === 'teleoperator') {
                        await executeBulkAssignTeleoperator(pendingBulkAction.value);
                      } else {
                        await executeBulkAssignConfirmateur(pendingBulkAction.value);
                      }
                      setPendingBulkAction(null);
                    }
                  }}
                  style={{ backgroundColor: '#d97706', color: 'white' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#b45309';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#d97706';
                  }}
                >
                  Confirmer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ContactList;