import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Search, Trash2, UserCheck, X, Upload, Settings2, GripVertical, ChevronLeft, ChevronRight, Filter, Check, Maximize2, Minimize2 } from 'lucide-react';
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
import { useHasPermission } from '../hooks/usePermissions';
import { useUser } from '../contexts/UserContext';
import { toast } from 'sonner';
import { formatPhoneNumber } from '../utils/phoneNumber';
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
  
  // Get current user for default permission functions
  const { currentUser } = useUser();
  
  // Use provided permission functions or create defaults
  const canCreate = canCreateProp ?? useHasPermission('contacts', 'create');
  const canEditGeneral = canEditGeneralProp ?? useHasPermission('contacts', 'edit');
  const canViewGeneral = canViewGeneralProp ?? useHasPermission('contacts', 'view');
  const canDelete = canDeleteProp ?? useHasPermission('contacts', 'delete');
  
  const statusEditPermissions = statusEditPermissionsProp ?? React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const editPerms = currentUser.permissions
      .filter((p: any) => p.component === 'statuses' && p.action === 'edit' && p.statusId)
      .map((p: any) => String(p.statusId).trim());
    return new Set(editPerms);
  }, [currentUser?.permissions]);
  
  const statusViewPermissions = statusViewPermissionsProp ?? React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const viewPerms = currentUser.permissions
      .filter((p: any) => p.component === 'statuses' && p.action === 'view' && p.statusId)
      .map((p: any) => {
        const statusId = p.statusId;
        if (!statusId) return null;
        return String(statusId).trim();
      })
      .filter((id): id is string => id !== null && id !== '');
    return new Set(viewPerms);
  }, [currentUser?.permissions]);
  
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
    if (!normalizedStatusId) {
      return canViewGeneral;
    }
    if (!canViewGeneral) {
      return false;
    }
    const canViewStatus = statusViewPermissions.has(normalizedStatusId);
    return canViewStatus;
  }, [canViewGeneral, statusViewPermissions, isTeleoperatorForContact, isConfirmateurForContact]);
  
  const canEditContact = canEditContactProp ?? React.useCallback((contact: any, statusIdOverride?: string | null): boolean => {
    const contactStatusId = statusIdOverride !== undefined ? statusIdOverride : contact?.statusId;
    const normalizedStatusId = contactStatusId ? String(contactStatusId).trim() : null;
    if (!normalizedStatusId) {
      return canEditGeneral;
    }
    if (!canEditGeneral) {
      return false;
    }
    const canEditStatus = statusEditPermissions.has(normalizedStatusId);
    return canEditStatus;
  }, [canEditGeneral, statusEditPermissions]);
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
  
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Record<string, string | string[] | { from?: string; to?: string }>>({});
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [columnFilterSearchTerms, setColumnFilterSearchTerms] = useState<Record<string, string>>({});
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkTeleoperatorId, setBulkTeleoperatorId] = useState('');
  const [bulkConfirmateurId, setBulkConfirmateurId] = useState('');
  const [lastOpenedContactId, setLastOpenedContactId] = useState<string | null>(null);
  
  // Modals state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isTeleoperatorModalOpen, setIsTeleoperatorModalOpen] = useState(false);
  const [isConfirmateurModalOpen, setIsConfirmateurModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [selectedTeleoperatorId, setSelectedTeleoperatorId] = useState('');
  const [selectedConfirmateurId, setSelectedConfirmateurId] = useState('');
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Define all available columns
  const allColumns = [
    { id: 'id', label: 'Id', defaultVisible: true },
    { id: 'fullName', label: 'Nom entier', defaultVisible: true },
    { id: 'firstName', label: 'Prénom', defaultVisible: false },
    { id: 'lastName', label: 'Nom', defaultVisible: false },
    { id: 'civility', label: 'Civilité', defaultVisible: false },
    { id: 'phone', label: 'Téléphone', defaultVisible: true },
    { id: 'mobile', label: 'Portable', defaultVisible: false },
    { id: 'email', label: 'E-Mail', defaultVisible: true },
    { id: 'birthDate', label: 'Date de naissance', defaultVisible: false },
    { id: 'birthPlace', label: 'Lieu de naissance', defaultVisible: false },
    { id: 'address', label: 'Adresse', defaultVisible: false },
    { id: 'addressComplement', label: 'Complément d\'adresse', defaultVisible: false },
    { id: 'postalCode', label: 'Code postal', defaultVisible: false },
    { id: 'city', label: 'Ville', defaultVisible: false },
    { id: 'nationality', label: 'Nationalité', defaultVisible: false },
    { id: 'campaign', label: 'Campagne', defaultVisible: false },
    { id: 'createdAt', label: 'Créé le', defaultVisible: true },
    { id: 'updatedAt', label: 'Modifié le', defaultVisible: false },
    { id: 'teleoperator', label: 'Téléopérateur', defaultVisible: true },
    { id: 'source', label: 'Source', defaultVisible: true },
    { id: 'status', label: 'Statut', defaultVisible: true },
    { id: 'confirmateur', label: 'Confirmateur', defaultVisible: true },
    { id: 'creator', label: 'Créateur', defaultVisible: false },
    { id: 'managerTeam', label: 'Équipe', defaultVisible: false },
  ];
  
  // Load column visibility and order from localStorage or use defaults
  const getInitialColumnOrder = () => {
    const saved = localStorage.getItem('contacts-table-column-order');
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
    const saved = localStorage.getItem('contacts-table-columns');
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
  
  // Save column order to localStorage
  const saveColumnOrder = (order: string[]) => {
    localStorage.setItem('contacts-table-column-order', JSON.stringify(order));
    setColumnOrder(order);
  };
  
  // Save column visibility to localStorage
  const saveVisibleColumns = (columns: string[]) => {
    localStorage.setItem('contacts-table-columns', JSON.stringify(columns));
    setVisibleColumns(columns);
  };
  
  const handleToggleColumn = (columnId: string) => {
    const newVisible = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    saveVisibleColumns(newVisible);
  };
  
  const handleResetColumns = () => {
    const defaultColumns = allColumns.filter(col => col.defaultVisible).map(col => col.id);
    saveVisibleColumns(defaultColumns);
    // Reset order to default
    const defaultOrder = allColumns.map(col => col.id);
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
    if (users.length > 0) {
      console.log('Users loaded:', users);
    } else if (!usersLoading) {
      console.warn('No users found. Users array is empty.');
    }
  }, [users, usersLoading, usersError]);

  // Create a stable string representation of appliedColumnFilters for dependency comparison
  const appliedColumnFiltersKey = useMemo(() => {
    return JSON.stringify(appliedColumnFilters);
  }, [appliedColumnFilters]);

  // Memoize loadData to prevent unnecessary re-renders
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculate limit: request enough contacts to cover multiple pages
      const limit = Math.max(itemsPerPage * 10, 500);
      
      // Build query parameters for filters
      const queryParams = new URLSearchParams();
      queryParams.append('limit', limit.toString());
      
      if (appliedSearchTerm) {
        queryParams.append('search', appliedSearchTerm);
      }
      if (appliedStatusType !== 'all') {
        queryParams.append('status_type', appliedStatusType);
      }
      
      // Add column filters
      Object.entries(appliedColumnFilters).forEach(([key, value]) => {
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
      
      // Load data in parallel for better performance
      const [contactsData, teamsData, statusesData] = await Promise.all([
        apiCall(`${apiEndpoint}?${queryParams.toString()}`),
        apiCall('/api/teams/'),
        apiCall('/api/statuses/')
      ]);
      
      // Contacts are already sorted and filtered by the backend
      const contactsList = contactsData.contacts || [];
      setContacts(contactsList);
      setTotalContacts(contactsData.total || contactsList.length);
      setTeams(teamsData.teams || []);
      setStatuses(statusesData.statuses || []);
    } catch (error: any) {
      console.error('Error loading contacts:', error);
      toast.error(error?.message || 'Erreur lors du chargement des contacts');
    } finally {
      setIsLoading(false);
    }
  }, [itemsPerPage, appliedSearchTerm, appliedStatusType, appliedColumnFilters, apiEndpoint]);

  useEffect(() => {
    loadData();
  }, [loadData]); // Reload when loadData changes (which depends on filters and itemsPerPage)
  
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
    // loadData will be called by useEffect when applied filters change
  }
  
  // Reset a specific column filter
  function handleResetColumnFilter(columnId: string) {
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
  }

  // Reset filters
  function handleResetFilters() {
    setPendingSearchTerm('');
    setPendingStatusType('all');
    setPendingColumnFilters({});
    setAppliedSearchTerm('');
    setAppliedStatusType('all');
    setAppliedColumnFilters({});
    setColumnFilters({});
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
    return ['status', 'creator', 'teleoperator', 'confirmateur', 'source', 'postalCode', 'nationality', 'campaign', 'civility', 'managerTeam'].includes(columnId);
  };

  const isDateColumn = (columnId: string): boolean => {
    return ['createdAt', 'updatedAt', 'birthDate'].includes(columnId);
  };
  
  // Helper function to get filter options for Select columns
  const getFilterOptions = (columnId: string) => {
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
  // If user is teleoperator or confirmateur but doesn't have status permission, show "Indisponible - [TYPE]"
  // Otherwise show the actual status name
  const getStatusDisplayText = getStatusDisplayTextProp ?? React.useCallback((contact: any): string => {
    const isTeleoperator = isTeleoperatorForContact(contact);
    const isConfirmateur = isConfirmateurForContact(contact);
    const contactStatusId = contact?.statusId;
    
    // Normalize statusId
    let normalizedStatusId: string | null = null;
    if (contactStatusId !== null && contactStatusId !== undefined && contactStatusId !== '') {
      const str = String(contactStatusId).trim();
      if (str !== '') {
        normalizedStatusId = str;
      }
    }
    
    // If user is teleoperator or confirmateur and contact has a status
    if ((isTeleoperator || isConfirmateur) && normalizedStatusId) {
      // Check if user has permission to view this status
      const hasStatusPermission = statusViewPermissions.has(normalizedStatusId);
      
      if (!hasStatusPermission) {
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
    
    // Show actual status name
    return contact.statusName || '-';
  }, [isTeleoperatorForContact, isConfirmateurForContact, statusViewPermissions, getContactStatusType]);

  // Filter contacts based on status view permissions
  // Backend handles filtering, but we also filter by status view permissions on client side
  const filteredContacts = React.useMemo(() => {
    const filtered = contacts.filter(contact => canViewContact(contact));
    
    // Debug: Log if there's a discrepancy between total and filtered
    if (contacts.length !== filtered.length) {
      const hiddenContacts = contacts.filter(contact => !canViewContact(contact));
      console.log(`[Contacts] Filtered out ${contacts.length - filtered.length} contact(s) due to permissions:`, 
        hiddenContacts.map(c => ({ id: c.id, statusId: c.statusId, fullName: c.fullName || `${c.firstName} ${c.lastName}`.trim() }))
      );
    }
    
    return filtered;
  }, [contacts, canViewContact]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  
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
  
  // Calculate displayed contacts based on pagination
  const displayedContacts = filteredContacts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
  
  // Helper function to truncate text with ellipsis
  const truncateText = (text: string, maxLength: number = 15): string => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
  
  // Helper function to render cell content based on column id
  const renderCell = (contact: any, columnId: string) => {
    switch (columnId) {
      case 'id':
        return (
          <td key={columnId} className="contacts-table-id">
            <button
              onClick={() => {
                setLastOpenedContactId(contact.id);
                window.open(`/contacts/${contact.id}`, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
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
          <td key={columnId}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setLastOpenedContactId(contact.id);
                  window.open(`/contacts/${contact.id}`, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
                }}
                className="contacts-name-link"
                title={contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '-'}
              >
                {truncateText(contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '-')}
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
        return <td key={columnId} title={formatPhoneNumber(contact.phone) || ''}>{truncateText(formatPhoneNumber(contact.phone) || '-')}</td>;
      case 'mobile':
        return <td key={columnId} title={formatPhoneNumber(contact.mobile) || ''}>{truncateText(formatPhoneNumber(contact.mobile) || '-')}</td>;
      case 'email':
        return (
          <td key={columnId} className="contacts-table-email">
            <button
              onClick={() => {
                setLastOpenedContactId(contact.id);
                window.open(`/contacts/${contact.id}`, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
              }}
              className="contacts-name-link"
              title={contact.email || ''}
            >
              {truncateText(contact.email || '-')}
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
          <td key={columnId}>
            {contact.createdAt ? (
              <button
                onClick={() => {
                  setLastOpenedContactId(contact.id);
                  window.open(`/contacts/${contact.id}`, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
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
              : '-'
            }
          </td>
        );
      case 'teleoperator':
        return (
          <td key={columnId}>
            {canEditContact(contact) ? (
              <Select
                value={contact.teleoperatorId || contact.managerId || 'none'}
                onValueChange={async (value) => {
                  const newTeleoperatorId = value === 'none' ? '' : value;
                  // Check if user has permission to edit this contact
                  if (!canEditContact(contact)) {
                    toast.error('Vous n\'avez pas la permission d\'éditer ce contact');
                    return;
                  }
                  
                  try {
                    await apiCall(`/api/contacts/${contact.id}/`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ teleoperatorId: newTeleoperatorId })
                    });
                    toast.success('Téléopérateur mis à jour avec succès');
                    loadData();
                  } catch (error: any) {
                    toast.error(error.message || 'Erreur lors de la mise à jour du téléopérateur');
                  }
                }}
              >
                <SelectTrigger className="border-none bg-transparent p-0 h-auto w-full text-left shadow-none hover:bg-transparent focus:ring-0 cursor-pointer">
                  <SelectValue className="cursor-pointer">
                {truncateText(contact.managerName || contact.teleoperatorName || '-')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun téléopérateur</SelectItem>
                  {teleoperateurs.map((user) => {
                    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                    return (
                      <SelectItem key={user.id} value={user.id}>
                        {displayName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <span title={contact.managerName || contact.teleoperatorName || ''}>{truncateText(contact.managerName || contact.teleoperatorName || '-')}</span>
            )}
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
          <td key={columnId}>
            {canEditStatus ? (
              <Select
                value={contact.statusId || 'none'}
                onValueChange={async (value) => {
                  const newStatusId = value === 'none' ? '' : value;
                  
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
                  
                  try {
                    await apiCall(`/api/contacts/${contact.id}/`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ statusId: newStatusId })
                    });
                    toast.success('Statut mis à jour avec succès');
                    loadData();
                  } catch (error: any) {
                    toast.error(error.message || 'Erreur lors de la mise à jour du statut');
                  }
                }}
              >
                <SelectTrigger className="border-none bg-transparent p-0 h-auto w-auto min-w-0 shadow-none hover:bg-transparent focus:ring-0">
                  <SelectValue asChild>
                <span 
                      className="contacts-status-badge cursor-pointer"
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
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="inline-block px-2 py-1 rounded text-sm">Aucun statut</span>
                  </SelectItem>
                  {statuses
                    .filter((status) => {
                      if (!status.id || status.id.trim() === '') return false;
                      // Filter by view permissions
                      const normalizedStatusId = String(status.id).trim();
                      return statusViewPermissions.has(normalizedStatusId);
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
            ) : (
              <span 
                className="contacts-status-badge"
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
                {statusDisplayText}
              </span>
            )}
          </td>
        );
      case 'confirmateur':
        return (
          <td key={columnId}>
            {canEditContact(contact) ? (
              <Select
                value={contact.confirmateurId || 'none'}
                onValueChange={async (value) => {
                  const newConfirmateurId = value === 'none' ? '' : value;
                  // Check if user has permission to edit this contact
                  if (!canEditContact(contact)) {
                    toast.error('Vous n\'avez pas la permission d\'éditer ce contact');
                    return;
                  }
                  
                  try {
                    await apiCall(`/api/contacts/${contact.id}/`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ confirmateurId: newConfirmateurId })
                    });
                    toast.success('Confirmateur mis à jour avec succès');
                    loadData();
                  } catch (error: any) {
                    toast.error(error.message || 'Erreur lors de la mise à jour du confirmateur');
                  }
                }}
              >
                <SelectTrigger className="border-none bg-transparent p-0 h-auto w-full text-left shadow-none hover:bg-transparent focus:ring-0 cursor-pointer">
                  <SelectValue className="cursor-pointer">
                {truncateText(contact.confirmateurName || '-')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun confirmateur</SelectItem>
                  {confirmateurs.map((user) => {
                    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                    return (
                      <SelectItem key={user.id} value={user.id}>
                        {displayName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <span title={contact.confirmateurName || ''}>{truncateText(contact.confirmateurName || '-')}</span>
            )}
          </td>
        );
      case 'creator':
        return <td key={columnId} title={contact.creatorName || ''}>{truncateText(contact.creatorName || '-')}</td>;
      case 'managerTeam':
        return <td key={columnId} title={contact.managerTeamName || ''}>{truncateText(contact.managerTeamName || '-')}</td>;
      default:
        return <td key={columnId}>-</td>;
    }
  };

  // Actions multiples
  async function handleBulkAssignTeleoperator(teleoperatorId: string) {
    if (!teleoperatorId) return;
    
    try {
      const teleoperatorIdValue = teleoperatorId !== 'none' ? teleoperatorId : '';
      
      const promises = Array.from(selectedContacts).map(contactId =>
        apiCall(`/api/contacts/${contactId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ teleoperatorId: teleoperatorIdValue })
        })
      );
      await Promise.all(promises);
      toast.success(`${selectedContacts.size} contact(s) mis à jour avec succès`);
      loadData();
      handleClearSelection();
      setBulkTeleoperatorId('');
    } catch (error) {
      console.error('Error assigning teleoperator:', error);
      toast.error('Erreur lors de l\'attribution du téléopérateur');
    }
  }

  async function handleBulkAssignConfirmateur(confirmateurId: string) {
    if (!confirmateurId) return;
    
    try {
      const confirmateurIdValue = confirmateurId !== 'none' ? confirmateurId : '';
      
      const promises = Array.from(selectedContacts).map(contactId =>
        apiCall(`/api/contacts/${contactId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ confirmateurId: confirmateurIdValue })
        })
      );
      await Promise.all(promises);
      toast.success(`${selectedContacts.size} contact(s) mis à jour avec succès`);
      loadData();
      handleClearSelection();
      setBulkConfirmateurId('');
    } catch (error) {
      console.error('Error assigning confirmateur:', error);
      toast.error('Erreur lors de l\'attribution du confirmateur');
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


  async function handleUpdateStatus() {
    if (!selectedContact) return;
    
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
    
    try {
      await apiCall(`/api/contacts/${selectedContact.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusId: selectedStatusId || '' })
      });
      toast.success('Statut mis à jour avec succès');
      setIsStatusModalOpen(false);
      setSelectedContact(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du statut');
    }
  }

  async function handleUpdateTeleoperator() {
    if (!selectedContact) return;
    
    // Check if user has permission to edit this contact
    if (!canEditContact(selectedContact)) {
      toast.error('Vous n\'avez pas la permission d\'éditer ce contact');
      return;
    }
    
    try {
      await apiCall(`/api/contacts/${selectedContact.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teleoperatorId: selectedTeleoperatorId || '' })
      });
      toast.success('Téléopérateur mis à jour avec succès');
      setIsTeleoperatorModalOpen(false);
      setSelectedContact(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du téléopérateur');
    }
  }

  async function handleUpdateConfirmateur() {
    if (!selectedContact) return;
    
    // Check if user has permission to edit this contact
    if (!canEditContact(selectedContact)) {
      toast.error('Vous n\'avez pas la permission d\'éditer ce contact');
      return;
    }
    
    try {
      await apiCall(`/api/contacts/${selectedContact.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmateurId: selectedConfirmateurId || '' })
      });
      toast.success('Confirmateur mis à jour avec succès');
      setIsConfirmateurModalOpen(false);
      setSelectedContact(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du confirmateur');
    }
  }

  // Filter users for teleoperator and confirmateur
  const teleoperateurs = users.filter(user => user.isTeleoperateur === true);
  const confirmateurs = users.filter(user => user.isConfirmateur === true);

  // Helper function to render table content (reused in normal and fullscreen views)
  const renderTableContent = (fullscreen: boolean = false) => (
    <>
          {isLoading ? (
            <div className="contacts-loading" style={{ padding: '40px', textAlign: 'center' }}>
              <p className="contacts-loading-text" style={{ color: '#64748b' }}>
                Chargement...
              </p>
            </div>
          ) : filteredContacts.length > 0 ? (
        <div className={`contacts-table-wrapper ${fullscreen ? 'contacts-table-wrapper-fullscreen' : ''}`}>
              <table className="contacts-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = someSelected;
                        }}
                        onChange={handleSelectAll}
                        className="contacts-checkbox"
                      />
                    </th>
                    {getOrderedVisibleColumns().map((columnId) => (
                      <th key={columnId} style={{ position: 'relative' }}>
                        <Popover 
                          open={openFilterColumn === columnId}
                          onOpenChange={(open) => {
                            setOpenFilterColumn(open ? columnId : null);
                            // Clear search term when closing
                            if (!open) {
                              setColumnFilterSearchTerms(prev => {
                                const newTerms = { ...prev };
                                delete newTerms[columnId];
                                return newTerms;
                              });
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
                                      const allOptions = getFilterOptions(columnId);
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
                                    })()}
                                  </div>
                                  <div 
                                    className="contacts-column-filter-scroll overflow-y-auto overflow-x-hidden" 
                                    style={{ height: '150px' }}
                                  >
                                    {(() => {
                                      const searchTerm = (columnFilterSearchTerms[columnId] || '').toLowerCase();
                                      const allOptions = getFilterOptions(columnId);
                                      
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
                                      {Array.isArray(columnFilters[columnId]) 
                                        ? `${(columnFilters[columnId] as string[]).length} sélectionné(s)`
                                        : filteredContacts.length} contact(s) correspondant
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
                                      {filteredContacts.length} contact(s) correspondant
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
                                      {filteredContacts.length} contact(s) correspondant
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
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedContacts.map((contact) => (
                    <tr 
                      key={contact.id}
                      style={{
                        backgroundColor: lastOpenedContactId === contact.id ? '#eff6ff' : 'transparent',
                        borderLeft: lastOpenedContactId === contact.id ? '3px solid #3b82f6' : 'none'
                      }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(contact.id)}
                          onChange={() => handleSelectContact(contact.id)}
                          className="contacts-checkbox"
                        />
                      </td>
                      {getOrderedVisibleColumns().map((columnId) => renderCell(contact, columnId))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="contacts-empty">Aucun contact trouvé</p>
          )}
          
          {/* Pagination Controls */}
          {totalPages > 1 && filteredContacts.length > 0 && (
            <div className="contacts-pagination">
              <div className="contacts-pagination-info">
                <span>
                  Affichage de {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, filteredContacts.length)} sur {filteredContacts.length} contact(s)
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
                  <SelectItem value="1000">1000</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barre d'actions multiples */}
      {showBulkActions && (
        <Card className="contacts-bulk-actions">
          <CardContent className="pt-4">
            <div className="contacts-bulk-actions-content">
              <div className="contacts-bulk-actions-info">
                <span>{selectedContacts.size} contact(s) sélectionné(s)</span>
                <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
              </div>
              <div className="contacts-bulk-actions-buttons">
                {canEditGeneral && (
                  <>
                    <div className="contacts-bulk-action-select">
                      <Label className="sr-only">Attribuer un téléopérateur</Label>
                      <Select value={bulkTeleoperatorId} onValueChange={handleBulkAssignTeleoperator}>
                        <SelectTrigger className="w-[200px]">
                          <UserCheck className="w-4 h-4 mr-2" />
                          <SelectValue placeholder="Attribuer un téléopérateur" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun téléopérateur</SelectItem>
                          {usersLoading ? (
                            <SelectItem value="loading" disabled>Chargement...</SelectItem>
                          ) : usersError ? (
                            <SelectItem value="error" disabled>Erreur de chargement</SelectItem>
                          ) : teleoperateurs.length === 0 ? (
                            <SelectItem value="empty" disabled>Aucun téléopérateur disponible</SelectItem>
                          ) : (
                            teleoperateurs.map((user) => {
                              const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                              return (
                                <SelectItem key={user.id} value={user.id}>
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
                      <Select value={bulkConfirmateurId} onValueChange={handleBulkAssignConfirmateur}>
                        <SelectTrigger className="w-[200px]">
                          <UserCheck className="w-4 h-4 mr-2" />
                          <SelectValue placeholder="Attribuer un confirmateur" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun confirmateur</SelectItem>
                          {usersLoading ? (
                            <SelectItem value="loading" disabled>Chargement...</SelectItem>
                          ) : usersError ? (
                            <SelectItem value="error" disabled>Erreur de chargement</SelectItem>
                          ) : confirmateurs.length === 0 ? (
                            <SelectItem value="empty" disabled>Aucun confirmateur disponible</SelectItem>
                          ) : (
                            confirmateurs.map((user) => {
                              const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                              return (
                                <SelectItem key={user.id} value={user.id}>
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
              {totalPages > 1 && filteredContacts.length > 0 && (
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

      {/* Status Modal */}
      {isStatusModalOpen && selectedContact && (
        <div className="modal-overlay" onClick={() => setIsStatusModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Modifier le statut</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => setIsStatusModalOpen(false)}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="modal-form-field">
                <Label htmlFor="statusSelect">Statut</Label>
                <Select
                  value={selectedStatusId ? selectedStatusId.toString() : undefined}
                  onValueChange={(value) => setSelectedStatusId(value === 'none' ? '' : value)}
                >
                  <SelectTrigger id="statusSelect">
                    <SelectValue placeholder="Sélectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun statut</SelectItem>
                    {statuses
                      .filter((status) => {
                        if (!status.id || status.id.trim() === '') return false;
                        // Filter by view permissions
                        const normalizedStatusId = String(status.id).trim();
                        return statusViewPermissions.has(normalizedStatusId);
                      })
                      .map((status) => (
                        <SelectItem key={status.id} value={status.id.toString()}>
                          {status.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-actions">
                <Button type="button" variant="outline" onClick={() => setIsStatusModalOpen(false)}>
                  Annuler
                </Button>
                {selectedContact && canEditContact(selectedContact) && (
                  <Button type="button" onClick={handleUpdateStatus}>
                    Enregistrer
                  </Button>
                )}
              </div>
            </div>
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
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teleoperator Modal */}
      {isTeleoperatorModalOpen && selectedContact && (
        <div className="modal-overlay" onClick={() => setIsTeleoperatorModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Modifier le téléopérateur</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => setIsTeleoperatorModalOpen(false)}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="modal-form-field">
                <Label htmlFor="teleoperatorSelect">Téléopérateur</Label>
                <Select
                  value={selectedTeleoperatorId ? selectedTeleoperatorId.toString() : undefined}
                  onValueChange={(value) => setSelectedTeleoperatorId(value === 'none' ? '' : value)}
                >
                  <SelectTrigger id="teleoperatorSelect">
                    <SelectValue placeholder="Sélectionner un téléopérateur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun téléopérateur</SelectItem>
                    {teleoperateurs
                      .filter((user) => user.id && user.id.trim() !== '')
                      .map((user) => {
                        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                        return (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {displayName}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-actions">
                <Button type="button" variant="outline" onClick={() => setIsTeleoperatorModalOpen(false)}>
                  Annuler
                </Button>
                {selectedContact && canEditContact(selectedContact) && (
                  <Button type="button" onClick={handleUpdateTeleoperator}>
                    Enregistrer
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmateur Modal */}
      {isConfirmateurModalOpen && selectedContact && (
        <div className="modal-overlay" onClick={() => setIsConfirmateurModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Modifier le confirmateur</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => setIsConfirmateurModalOpen(false)}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="modal-form-field">
                <Label htmlFor="confirmateurSelect">Confirmateur</Label>
                <Select
                  value={selectedConfirmateurId ? selectedConfirmateurId.toString() : undefined}
                  onValueChange={(value) => setSelectedConfirmateurId(value === 'none' ? '' : value)}
                >
                  <SelectTrigger id="confirmateurSelect">
                    <SelectValue placeholder="Sélectionner un confirmateur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun confirmateur</SelectItem>
                    {confirmateurs
                      .filter((user) => user.id && user.id.trim() !== '')
                      .map((user) => {
                        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                        return (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {displayName}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-actions">
                <Button type="button" variant="outline" onClick={() => setIsConfirmateurModalOpen(false)}>
                  Annuler
                </Button>
                {selectedContact && canEditContact(selectedContact) && (
                  <Button type="button" onClick={handleUpdateConfirmateur}>
                    Enregistrer
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContactList;
