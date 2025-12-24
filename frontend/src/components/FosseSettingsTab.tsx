import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { MultiSelect } from './ui/multi-select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Input } from './ui/input';
import { DateInput } from './ui/date-input';
import { Search, Check, ChevronDown, RefreshCw } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import LoadingIndicator from './LoadingIndicator';
import { useRoles } from '../hooks/useRoles';
import { useStatuses } from '../hooks/useStatuses';
import { useSources } from '../hooks/useSources';
import { useUsers } from '../hooks/useUsers';
import { useTeams } from '../hooks/useTeams';
import { ACCESS_TOKEN } from '../utils/constants';
import { Separator } from './ui/separator';
import { formatPhoneNumber } from '../utils/phoneNumber';
import { Filter } from 'lucide-react';
import '../styles/Contacts.css';

interface FosseSettings {
  id: string;
  roleId: string;
  roleName: string;
  forcedColumns: string[];
  forcedFilters: Record<string, { type: 'open' | 'defined'; values?: string[]; value?: string; dateRange?: { from?: string; to?: string } }>;
  defaultOrder: 'none' | 'created_at_asc' | 'created_at_desc' | 'updated_at_asc' | 'updated_at_desc' | 'assigned_at_asc' | 'assigned_at_desc' | 'email_asc' | 'random';
  defaultStatusId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Default columns to show by default (on the left)
const DEFAULT_COLUMNS = ['createdAt', 'previousStatus', 'source', 'previousTeleoperator'];

// Available columns for Fosse page (reorganized with default columns first)
const AVAILABLE_COLUMNS = [
  { id: 'createdAt', label: 'Créé le' },
  { id: 'previousStatus', label: 'Statut précédent' },
  { id: 'source', label: 'Source' },
  { id: 'previousTeleoperator', label: 'Téléopérateur précédent' },
  { id: 'fullName', label: 'Nom entier' },
  { id: 'phone', label: 'Téléphone 1' },
  { id: 'mobile', label: 'Telephone 2' },
  { id: 'email', label: 'E-Mail' },
  { id: 'status', label: 'Statut' },
  { id: 'updatedAt', label: 'Modifié le' },
  { id: 'notes', label: 'Notes' },
  { id: 'id', label: 'Id' },
  { id: 'firstName', label: 'Prénom' },
  { id: 'lastName', label: 'Nom' },
  { id: 'civility', label: 'Civilité' },
  { id: 'birthDate', label: 'Date de naissance' },
  { id: 'birthPlace', label: 'Lieu de naissance' },
  { id: 'address', label: 'Adresse' },
  { id: 'addressComplement', label: 'Complément d\'adresse' },
  { id: 'postalCode', label: 'Code postal' },
  { id: 'city', label: 'Ville' },
  { id: 'nationality', label: 'Nationalité' },
  { id: 'campaign', label: 'Campagne' },
  { id: 'teleoperator', label: 'Téléopérateur' },
  { id: 'confirmateur', label: 'Confirmateur' },
  { id: 'creator', label: 'Créateur' },
  { id: 'managerTeam', label: 'Équipe' },
];

// Columns that support filtering
// Note: teleoperator and confirmateur are excluded because contacts need both to be empty to be in fosse
const FILTERABLE_COLUMNS = [
  { id: 'status', label: 'Statut', optionsType: 'statuses' as const },
  { id: 'source', label: 'Source', optionsType: 'sources' as const },
  { id: 'creator', label: 'Créateur', optionsType: 'users' as const },
  { id: 'managerTeam', label: 'Équipe', optionsType: 'teams' as const },
  { id: 'previousStatus', label: 'Statut précédent', optionsType: 'statuses' as const },
  { id: 'previousTeleoperator', label: 'Téléopérateur précédent', optionsType: 'users' as const },
];

export function FosseSettingsTab() {
  const { roles, loading: rolesLoading } = useRoles();
  const { statuses, loading: statusesLoading } = useStatuses();
  const { sources, loading: sourcesLoading } = useSources();
  const { users, loading: usersLoading } = useUsers();
  const { teams, loading: teamsLoading } = useTeams();
  
  const [settings, setSettings] = useState<Map<string, FosseSettings>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Map<string, boolean>>(new Map());
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [fosseDefaultStatusId, setFosseDefaultStatusId] = useState<string>('');
  const [savingFosseDefaults, setSavingFosseDefaults] = useState(false);
  const [openColumnsPopover, setOpenColumnsPopover] = useState<string | null>(null);
  const [columnSearchTerm, setColumnSearchTerm] = useState<string>('');
  const [columnSearchTerms, setColumnSearchTerms] = useState<Record<string, string>>({});
  const [previewContacts, setPreviewContacts] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [columnFilterSearchTerms, setColumnFilterSearchTerms] = useState<Record<string, string>>({});
  const [statusColumnFilterType, setStatusColumnFilterType] = useState<'lead' | 'client'>('lead');
  const [previousStatusColumnFilterType, setPreviousStatusColumnFilterType] = useState<'lead' | 'client'>('lead');
  const [pendingTextFilterValues, setPendingTextFilterValues] = useState<Record<string, string>>({});
  const [pendingDateRangeFilters, setPendingDateRangeFilters] = useState<Record<string, { from?: string; to?: string }>>({});
  const [pendingMultiSelectFilters, setPendingMultiSelectFilters] = useState<Record<string, string[]>>({});
  const [showAllColumns, setShowAllColumns] = useState<Record<string, boolean>>({});

  // Load Fosse default status
  const loadFosseDefaultStatus = async () => {
    try {
      const data = await apiCall('/api/statuses/');
      const defaultStatus = (data.statuses || []).find((status: any) => status.isFosseDefault);
      setFosseDefaultStatusId(defaultStatus?.id || '');
    } catch (error: any) {
      console.error('Error loading Fosse default status:', error);
    }
  };

  // Update Fosse default status
  const updateFosseDefaultStatus = async (newStatusId: string) => {
    try {
      setSavingFosseDefaults(true);
      
      const oldStatusId = fosseDefaultStatusId;
      
      // If selecting the same status, do nothing
      if (newStatusId === oldStatusId) {
        return;
      }

      // If there was a previous default status, unset it
      if (oldStatusId) {
        const oldStatus = statuses.find(s => s.id === oldStatusId);
        if (oldStatus) {
          await apiCall(`/api/statuses/${oldStatusId}/`, {
            method: 'PUT',
            body: JSON.stringify({
              name: oldStatus.name,
              type: oldStatus.type,
              color: oldStatus.color || '',
              isFosseDefault: false,
            }),
          });
        }
      }

      // Set the new default status
      if (newStatusId) {
        const newStatus = statuses.find(s => s.id === newStatusId);
        if (newStatus) {
          const requestBody = {
            name: newStatus.name,
            type: newStatus.type,
            color: newStatus.color || '',
            isFosseDefault: true,
          };
          console.log('[FOSSE] Updating status with data:', requestBody);
          await apiCall(`/api/statuses/${newStatusId}/`, {
            method: 'PUT',
            body: JSON.stringify(requestBody),
          });
          console.log('[FOSSE] Status update completed');
        }
      }

      // Update local state
      setFosseDefaultStatusId(newStatusId || '');

      toast.success('Statut Fosse par défaut mis à jour');
    } catch (error: any) {
      console.error('Error updating Fosse default status:', error);
      toast.error('Erreur lors de la mise à jour');
      // Reload to revert
      await loadFosseDefaultStatus();
    } finally {
      setSavingFosseDefaults(false);
    }
  };

  // Load Fosse settings
  const loadSettings = async () => {
    // Check if user is authenticated before making API call
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await apiCall('/api/fosse-settings/');
      const settingsMap = new Map<string, FosseSettings>();
      
      (data.settings || []).forEach((setting: FosseSettings) => {
        settingsMap.set(setting.roleId, setting);
      });
      
      setSettings(settingsMap);
    } catch (error: any) {
      // Don't log 401 errors if we're redirecting to login (expected behavior)
      if (error?.status === 401 && error?.isRedirecting) {
        setLoading(false);
        return;
      }
      console.error('Error loading Fosse settings:', error);
      toast.error('Erreur lors du chargement des paramètres Fosse');
    } finally {
      setLoading(false);
    }
  };

  // Load settings for a specific role (create if doesn't exist)
  const loadSettingForRole = async (roleId: string) => {
    // Check if user is authenticated before making API call
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (!token) {
      return null;
    }

    try {
      const data = await apiCall(`/api/fosse-settings/${roleId}/`);
      const setting: FosseSettings = data;
      setSettings(prev => {
        const newMap = new Map(prev);
        newMap.set(roleId, setting);
        return newMap;
      });
      return setting;
    } catch (error: any) {
      // Don't log 401 errors if we're redirecting to login (expected behavior)
      if (error?.status === 401 && error?.isRedirecting) {
        return null;
      }
      console.error('Error loading setting for role:', error);
      // If setting doesn't exist, create default one
      const defaultSetting: FosseSettings = {
        id: '',
        roleId,
        roleName: roles.find(r => r.id === roleId)?.name || '',
        forcedColumns: [],
        forcedFilters: {},
        defaultOrder: 'created_at_desc',
        defaultStatusId: null,
        createdAt: '',
        updatedAt: '',
      };
      setSettings(prev => {
        const newMap = new Map(prev);
        newMap.set(roleId, defaultSetting);
        return newMap;
      });
      return defaultSetting;
    }
  };

  // Update settings
  const updateSettings = async (roleId: string, updates: Partial<FosseSettings>) => {
    const savingKey = roleId;
    try {
      setSaving(prev => {
        const newMap = new Map(prev);
        newMap.set(savingKey, true);
        return newMap;
      });

      // Get current setting before updating
      const currentSetting = settings.get(roleId);
      
      // Update local state immediately for better UX
      setSettings(prev => {
        const newMap = new Map(prev);
        const setting = newMap.get(roleId);
        if (setting) {
          newMap.set(roleId, { ...setting, ...updates });
        }
        return newMap;
      });

      // Use updates directly, fallback to current setting if not provided
      const updatedData = {
        forcedColumns: updates.forcedColumns !== undefined ? updates.forcedColumns : (currentSetting?.forcedColumns ?? []),
        forcedFilters: updates.forcedFilters !== undefined ? updates.forcedFilters : (currentSetting?.forcedFilters ?? {}),
        defaultOrder: updates.defaultOrder !== undefined ? updates.defaultOrder : (currentSetting?.defaultOrder ?? 'created_at_desc'),
        defaultStatusId: updates.defaultStatusId !== undefined ? updates.defaultStatusId : (currentSetting?.defaultStatusId ?? null),
      };

      const response = await apiCall(`/api/fosse-settings/${roleId}/update/`, {
        method: 'PUT',
        body: JSON.stringify(updatedData),
      });

      // If we got here without an error, the update succeeded
      // Response can be null for 204 No Content, but that's still success
      toast.success('Paramètres Fosse mis à jour avec succès');
      
      // Reload preview to reflect filter changes if this role is expanded
      if (expandedRole === roleId) {
        // Use the updated order from updates or current setting
        const orderToUse = updates.defaultOrder !== undefined ? updates.defaultOrder : (currentSetting?.defaultOrder || 'created_at_desc');
        loadPreviewContacts(roleId, [], orderToUse);
      }
      
      // Don't reload - we already have the updated state locally
      // Only reload if there's an error to sync with server
    } catch (error: any) {
      // Don't show error if we're redirecting to login (expected behavior)
      if (error?.status === 401 && error?.isRedirecting) {
        return;
      }
      
      // Log the full error for debugging
      console.error('[FosseSettings] Error updating settings:', error);
      console.error('[FosseSettings] Error details:', {
        message: error?.message,
        status: error?.status,
        response: error?.response,
        name: error?.name,
        stack: error?.stack
      });
      
      // Extract error message from various formats
      let errorMessage: string | null = null;
      
      // Try to get a meaningful error message
      if (error?.message && error.message !== 'API request failed') {
        errorMessage = error.message;
      } else if (error?.response) {
        if (typeof error.response === 'string') {
          errorMessage = error.response;
        } else if (error.response.error) {
          errorMessage = typeof error.response.error === 'string' 
            ? error.response.error 
            : null;
        } else if (error.response.detail) {
          errorMessage = error.response.detail;
        } else if (error.response.details) {
          if (typeof error.response.details === 'string') {
            errorMessage = error.response.details;
          } else if (typeof error.response.details === 'object') {
            // Try to extract a meaningful message from details object
            const detailsStr = JSON.stringify(error.response.details);
            if (detailsStr !== '{}' && detailsStr.length < 200) {
              errorMessage = detailsStr;
            }
          }
        }
      }
      
      // Only show error toast if we have a meaningful error message and it's a real HTTP error
      // Don't show errors for network timeouts or other transient issues if the operation might have succeeded
      const isRealError = error?.status && error.status >= 400 && error.status < 500 && error.status !== 401;
      
      if (isRealError && errorMessage) {
        toast.error(errorMessage);
        
        // Reload to revert changes only for real errors
        try {
          await loadSettingForRole(roleId);
        } catch (reloadError: any) {
          // Don't log if reload fails due to redirect
          if (reloadError?.status !== 401 || !reloadError?.isRedirecting) {
            console.error('[FosseSettings] Error reloading settings after update error:', reloadError);
          }
        }
      } else if (!isRealError) {
        // For non-HTTP errors (like network issues), don't show error toast
        // The optimistic update might have worked, and we don't want to confuse the user
        console.warn('[FosseSettings] Non-HTTP error during settings update (may have succeeded):', error);
      } else {
        // HTTP error but no meaningful message - show generic message
        toast.error('Erreur lors de la mise à jour des paramètres');
        try {
          await loadSettingForRole(roleId);
        } catch (reloadError: any) {
          if (reloadError?.status !== 401 || !reloadError?.isRedirecting) {
            console.error('[FosseSettings] Error reloading settings after update error:', reloadError);
          }
        }
      }
    } finally {
      setSaving(prev => {
        const newMap = new Map(prev);
        newMap.set(savingKey, false);
        return newMap;
      });
    }
  };


  // Update filter type for a column
  const updateFilterType = (roleId: string, columnId: string, type: 'open' | 'defined') => {
    const setting = settings.get(roleId);
    if (!setting) return;

    const currentFilters = setting.forcedFilters || {};
    const newFilters = {
      ...currentFilters,
      [columnId]: {
        type,
        values: type === 'defined' ? (currentFilters[columnId]?.values || []) : undefined,
      },
    };

    updateSettings(roleId, { forcedFilters: newFilters });
  };

  // Update filter values for a column
  const updateFilterValues = (roleId: string, columnId: string, values: string[]) => {
    const setting = settings.get(roleId);
    if (!setting) return;

    const currentFilters = setting.forcedFilters || {};
    const newFilters = {
      ...currentFilters,
      [columnId]: {
        type: 'defined' as const,
        values,
      },
    };

    updateSettings(roleId, { forcedFilters: newFilters });
  };


  // Get options for a filterable column
  const getFilterOptions = (columnId: string, statusTypeFilter: 'lead' | 'client' = 'lead') => {
    const column = FILTERABLE_COLUMNS.find(c => c.id === columnId);
    if (!column) return [];

    switch (column.optionsType) {
      case 'statuses':
        if (columnId === 'previousStatus') {
          // For previousStatus, use status names (since it stores names, not IDs) - same as Fosse page
          // Filter by status type (lead or client) - same logic as status filter
          return statuses
            .filter((status) => {
              if (!status.id || status.id.trim() === '') return false;
              // Filter by status type - strict check
              if (!statusTypeFilter || status.type !== statusTypeFilter) {
                return false;
              }
              // Additional safety check: ensure type is valid
              if (status.type !== 'lead' && status.type !== 'client') {
                return false;
              }
              return true;
            })
            .map(status => ({
              id: status.name, // Use name for filtering since previousStatus stores names - same as Fosse page
              label: status.name
            }));
        }
        return statuses.map(s => ({ id: s.id, label: s.name }));
      case 'sources':
        return sources.map(s => ({ id: s.id, label: s.name }));
      case 'users':
        if (columnId === 'previousTeleoperator') {
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
          return Array.from(userNameMap.values());
        }
        return users.map(u => ({
          id: u.id,
          label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || u.email || `Utilisateur ${u.id}`,
        }));
      case 'teams':
        return teams.map(t => ({ id: t.id, label: t.name }));
      default:
        return [];
    }
  };

  useEffect(() => {
    if (!rolesLoading && roles.length > 0) {
      loadSettings();
    }
  }, [rolesLoading, roles.length]);

  useEffect(() => {
    if (!statusesLoading && statuses.length > 0) {
      loadFosseDefaultStatus();
    }
  }, [statusesLoading, statuses.length]);

  // Auto-load setting when a role is expanded
  useEffect(() => {
    if (expandedRole && !settings.has(expandedRole)) {
      loadSettingForRole(expandedRole);
    }
  }, [expandedRole]);

  // Load preview contacts when forced columns change
  const loadPreviewContacts = React.useCallback(async (roleId: string, columns: string[], order?: string) => {
    // Always load contacts for preview, even if no columns are selected
    // This allows users to see all columns and configure filters
    try {
      setLoadingPreview(true);
      // Get order from settings or use default
      const setting = settings.get(roleId);
      // Get order from settings or use 'created_at_desc' as default
      const orderParam = order || setting?.defaultOrder || 'created_at_desc';
      
      // Build query parameters with forced filters for preview
      // Send forced filters as query params so preview shows what contacts would be visible with these filters
      const forcedFilters = setting?.forcedFilters || {};
      const queryParams = new URLSearchParams();
      queryParams.append('page', '1');
      queryParams.append('page_size', '100');
      queryParams.append('order', orderParam);
      
      // Add forced filters as query parameters (same format as ContactList uses)
      for (const [columnId, filterConfig] of Object.entries(forcedFilters)) {
        const config = filterConfig as { type: 'open' | 'defined'; values?: string[]; value?: string; dateRange?: { from?: string; to?: string } };
        
        if ((config.type === 'defined' || config.type === 'open') && config.values && config.values.length > 0) {
          // Multi-select filter - send multiple query params
          // Values are already names for previousStatus (same as Fosse page)
          config.values.forEach((val) => {
            queryParams.append(`filter_${columnId}`, val);
          });
        } else if (config.type === 'open') {
          if (config.value !== undefined && config.value !== '') {
            // Text filter
            queryParams.append(`filter_${columnId}`, config.value);
          } else if (config.dateRange) {
            // Date range filter
            if (config.dateRange.from) {
              queryParams.append(`filter_${columnId}_from`, config.dateRange.from);
            }
            if (config.dateRange.to) {
              queryParams.append(`filter_${columnId}_to`, config.dateRange.to);
            }
          }
        }
      }
      
      // Load contacts with filters applied server-side
      const data = await apiCall(`/api/contacts/fosse/?${queryParams.toString()}`);
      let contacts = data?.results || data?.contacts || [];
      
      // Backend already filtered and sorted contacts, but keep client-side sort as fallback
      // (in case backend doesn't handle sorting correctly)
      // Sort contacts based on order setting
      switch (orderParam) {
        case 'created_at_asc':
          contacts = [...contacts].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateA - dateB;
          });
          break;
        case 'created_at_desc':
          contacts = [...contacts].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
          break;
        case 'updated_at_asc':
          contacts = [...contacts].sort((a, b) => {
            const dateA = a.lastLogDate ? new Date(a.lastLogDate).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
            const dateB = b.lastLogDate ? new Date(b.lastLogDate).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
            return dateA - dateB;
          });
          break;
        case 'updated_at_desc':
          contacts = [...contacts].sort((a, b) => {
            const dateA = a.lastLogDate ? new Date(a.lastLogDate).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
            const dateB = b.lastLogDate ? new Date(b.lastLogDate).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
            return dateB - dateA;
          });
          break;
        case 'assigned_at_asc':
          contacts = [...contacts].sort((a, b) => {
            const dateA = a.assignedAt ? new Date(a.assignedAt).getTime() : 0;
            const dateB = b.assignedAt ? new Date(b.assignedAt).getTime() : 0;
            return dateA - dateB;
          });
          break;
        case 'assigned_at_desc':
          contacts = [...contacts].sort((a, b) => {
            const dateA = a.assignedAt ? new Date(a.assignedAt).getTime() : 0;
            const dateB = b.assignedAt ? new Date(b.assignedAt).getTime() : 0;
            return dateB - dateA;
          });
          break;
        case 'email_asc':
          contacts = [...contacts].sort((a, b) => {
            const emailA = (a.email || '').trim().toLowerCase();
            const emailB = (b.email || '').trim().toLowerCase();
            // Empty emails go to the end
            if (!emailA && !emailB) return 0;
            if (!emailA) return 1;
            if (!emailB) return -1;
            return emailA.localeCompare(emailB, 'fr', { numeric: true, sensitivity: 'base' });
          });
          break;
        case 'random':
          // Shuffle array randomly using Fisher-Yates algorithm
          contacts = [...contacts].sort(() => Math.random() - 0.5);
          break;
        default:
          // Default: sort by creation date, most recent first (same as created_at_desc)
          contacts = [...contacts].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
      }
      
      setPreviewContacts(contacts.slice(0, 10)); // Show 10 contacts for preview
    } catch (error: any) {
      console.error('Error loading preview contacts:', error);
      setPreviewContacts([]);
    } finally {
      setLoadingPreview(false);
    }
  }, [settings, statuses, sources, users, teams]);

  // Helper function to get column label
  const getColumnLabel = (columnId: string) => {
    const column = AVAILABLE_COLUMNS.find(col => col.id === columnId);
    return column?.label || columnId;
  };

  // Helper function to truncate text
  const truncateText = (text: string, maxLength: number = 20): string => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Helper function to determine if a column should use multi-select filter
  const shouldUseMultiSelectFilter = (columnId: string): boolean => {
    return ['status', 'creator', 'teleoperator', 'confirmateur', 'source', 'postalCode', 'nationality', 'campaign', 'civility', 'managerTeam', 'previousStatus', 'previousTeleoperator'].includes(columnId);
  };

  const isDateColumn = (columnId: string): boolean => {
    return ['createdAt', 'updatedAt', 'birthDate'].includes(columnId);
  };

  // Helper function to get filter options for preview
  const getPreviewFilterOptions = (columnId: string, statusTypeFilter: 'lead' | 'client' = 'lead') => {
    const options: Array<{ id: string; label: string }> = [];
    
    // Add empty option first
    options.push({ id: '__empty__', label: '(Vides)' });
    
    switch (columnId) {
      case 'status':
        const statusOptions = statuses
          .filter((status) => {
            if (!status.id || status.id.trim() === '') return false;
            return status.type === statusTypeFilter;
          })
          .map(status => ({
            id: status.id,
            label: status.name
          }));
        options.push(...statusOptions);
        break;
      case 'source':
        const sourceOptions = sources.map(s => ({ id: s.id, label: s.name }));
        options.push(...sourceOptions);
        break;
      case 'creator':
        const creatorOptions = users.map(u => ({
          id: u.id,
          label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || u.email || `Utilisateur ${u.id}`,
        }));
        options.push(...creatorOptions);
        break;
      case 'managerTeam':
        const teamOptions = teams.map(t => ({ id: t.id, label: t.name }));
        options.push(...teamOptions);
        break;
      case 'previousStatus':
        // For previousStatus, use status names (since it stores names, not IDs) - same as Fosse page
        const previousStatusOptions = statuses
          .filter((status) => {
            if (!status.id || status.id.trim() === '') return false;
            // Filter by status type - strict check
            if (!statusTypeFilter || status.type !== statusTypeFilter) {
              return false;
            }
            // Additional safety check: ensure type is valid
            if (status.type !== 'lead' && status.type !== 'client') {
              return false;
            }
            return true;
          })
          .map(status => ({
            id: status.name, // Use name for filtering since previousStatus stores names - same as Fosse page
            label: status.name
          }));
        options.push(...previousStatusOptions);
        break;
      case 'previousTeleoperator':
        // Show all users for previous teleoperator filter
        // Deduplicate by user name since multiple users might have the same name
        const userNameMap = new Map<string, { id: string; label: string }>();
        users.forEach(u => {
          const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || u.email || `Utilisateur ${u.id}`;
          if (!userNameMap.has(name)) {
            userNameMap.set(name, {
              id: name, // Use name since previousTeleoperator stores the name
              label: name
            });
          } else {
            // If duplicate name exists, use name with user ID to make it unique
            userNameMap.set(`${name}_${u.id}`, {
              id: name, // Still use name for filtering (stores name in DB)
              label: `${name} (${u.id})` // Show both in label for clarity
            });
          }
        });
        options.push(...Array.from(userNameMap.values()));
        break;
      default:
        break;
    }
    
    return options;
  };

  // Helper function to render cell content (using same style as ContactList)
  const renderPreviewCellContent = (contact: any, columnId: string) => {
    switch (columnId) {
      case 'id':
        return <span className="contacts-table-id">{contact.id?.substring(0, 8) || '-'}</span>;
      case 'fullName':
        return <span>{truncateText(contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '-')}</span>;
      case 'firstName':
        return <span>{truncateText(contact.firstName || '-')}</span>;
      case 'lastName':
        return <span>{truncateText(contact.lastName || '-')}</span>;
      case 'civility':
        return <span>{contact.civility || '-'}</span>;
      case 'phone':
        return <span>{formatPhoneNumber(contact.phone) || '-'}</span>;
      case 'mobile':
        return <span>{formatPhoneNumber(contact.mobile) || '-'}</span>;
      case 'email':
        return <span className="contacts-table-email">{contact.email || '-'}</span>;
      case 'status':
        const status = statuses.find(s => s.id === contact.statusId);
        return status ? (
          <span 
            className="contacts-status-badge"
            style={{
              backgroundColor: status.color || '#e5e7eb',
              color: status.color ? '#000000' : '#374151'
            }}
          >
                      {status.name}
          </span>
        ) : <span>-</span>;
      case 'source':
        return <span>{truncateText(contact.source || '-')}</span>;
      case 'createdAt':
        return (
          <span>
            {contact.createdAt 
              ? new Date(contact.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
              : '-'
            }
          </span>
        );
      case 'updatedAt':
        return (
          <span>
            {contact.lastLogDate 
              ? new Date(contact.lastLogDate).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
              : '-'
            }
          </span>
        );
      case 'birthDate':
        return (
          <span>
            {contact.birthDate ? new Date(contact.birthDate).toLocaleDateString('fr-FR') : '-'}
          </span>
        );
      case 'birthPlace':
        return <span>{truncateText(contact.birthPlace || '-')}</span>;
      case 'address':
        return <span>{truncateText(contact.address || '-')}</span>;
      case 'addressComplement':
        return <span>{truncateText(contact.addressComplement || '-')}</span>;
      case 'postalCode':
        return <span>{contact.postalCode || '-'}</span>;
      case 'city':
        return <span>{truncateText(contact.city || '-')}</span>;
      case 'nationality':
        return <span>{truncateText(contact.nationality || '-')}</span>;
      case 'campaign':
        return <span>{truncateText(contact.campaign || '-')}</span>;
      case 'teleoperator':
        return <span>{truncateText(contact.managerName || contact.teleoperatorName || '-')}</span>;
      case 'confirmateur':
        return <span>{truncateText(contact.confirmateurName || '-')}</span>;
      case 'creator':
        const creator = users.find(u => u.id === contact.creatorId);
        return (
          <span>
            {creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.username || '-' : '-'}
          </span>
        );
      case 'managerTeam':
        const team = teams.find(t => t.id === contact.managerTeamId);
        return <span>{team?.name || '-'}</span>;
      case 'notes':
        return <span>{contact.notesCount > 0 ? `${contact.notesCount} note(s)` : '-'}</span>;
      case 'previousStatus':
        const previousStatus = contact.previousStatus;
        if (!previousStatus) return <span>-</span>;
        const prevStatus = statuses.find(s => s.name === previousStatus);
        return prevStatus ? (
          <span 
            className="contacts-status-badge"
            style={{
              backgroundColor: prevStatus.color || '#e5e7eb',
              color: prevStatus.color ? '#000000' : '#374151'
            }}
          >
            {previousStatus}
          </span>
        ) : <span>{previousStatus}</span>;
      case 'previousTeleoperator':
        return <span>{truncateText(contact.previousTeleoperator || '-')}</span>;
      default:
        return <span>-</span>;
    }
  };

  // Handle filter change for forced filters
  const handleFilterChange = (roleId: string, columnId: string, filterType: 'open' | 'defined', values?: string[]) => {
    const setting = settings.get(roleId);
    const currentFilters = setting?.forcedFilters || {};
    
    if (filterType === 'open') {
      // Set filter to open - include values if provided (for multi-select filters)
      const newFilters = {
        ...currentFilters,
        [columnId]: values !== undefined && values.length > 0 
          ? { type: 'open' as const, values }
          : { type: 'open' as const }
      };
      if (setting) {
        updateSettings(roleId, { forcedFilters: newFilters });
      } else {
        loadSettingForRole(roleId).then(() => {
          updateSettings(roleId, { forcedFilters: newFilters });
        });
      }
    } else if (filterType === 'defined' && values !== undefined) {
      // Set filter to defined with values
      // For previousStatus, store as names (same as Fosse page)
      let normalizedValues = values;
      if (columnId === 'previousStatus') {
        // Convert any old ID values to names (for backward compatibility)
        normalizedValues = values.map(val => {
          // If val is an ID, convert to name; otherwise keep as-is (already a name)
          const status = statuses.find(s => s.id === val);
          return status ? status.name : val;
        });
      }
      
      const newFilters = {
        ...currentFilters,
        [columnId]: { type: 'defined' as const, values: normalizedValues }
      };
      if (setting) {
        updateSettings(roleId, { forcedFilters: newFilters });
      } else {
        loadSettingForRole(roleId).then(() => {
          updateSettings(roleId, { forcedFilters: newFilters });
        });
      }
    }
  };

  // Load preview when role is expanded or settings change
  useEffect(() => {
    if (expandedRole) {
      // Always load preview contacts when a role is expanded, even if no columns are selected
      // This allows users to see all columns and configure filters
      const setting = settings.get(expandedRole);
      loadPreviewContacts(expandedRole, [], setting?.defaultOrder);
    } else {
      setPreviewContacts([]);
    }
  }, [expandedRole, loadPreviewContacts, settings]);

  // Sync scrollbars for preview table
  useEffect(() => {
    if (!expandedRole) return;

    const wrapper = document.getElementById(`preview-scroll-wrapper-${expandedRole}`);
    const topScrollbar = document.getElementById(`preview-scroll-top-${expandedRole}`);
    const scrollContent = document.getElementById(`preview-scroll-content-${expandedRole}`);
    
    if (!wrapper || !topScrollbar || !scrollContent) return;

    // Sync scrollbar width
    const syncScrollbarWidth = () => {
      scrollContent.style.width = wrapper.scrollWidth + 'px';
    };
    
    // Sync scroll position from wrapper to top scrollbar
    const syncScroll = () => {
      topScrollbar.scrollLeft = wrapper.scrollLeft;
    };
    
    // Sync scroll position from top scrollbar to wrapper
    const syncScrollFromTop = () => {
      wrapper.scrollLeft = topScrollbar.scrollLeft;
    };

    syncScrollbarWidth();
    wrapper.addEventListener('scroll', syncScroll);
    topScrollbar.addEventListener('scroll', syncScrollFromTop);
    
    // Sync on resize
    const resizeObserver = new ResizeObserver(syncScrollbarWidth);
    resizeObserver.observe(wrapper);

    return () => {
      wrapper.removeEventListener('scroll', syncScroll);
      topScrollbar.removeEventListener('scroll', syncScrollFromTop);
      resizeObserver.disconnect();
    };
  }, [expandedRole, previewContacts]);

  if (loading || rolesLoading || statusesLoading || sourcesLoading || usersLoading || teamsLoading) {
    return <LoadingIndicator />;
  }

  return (
    <div className="space-y-6">
      {/* Role-specific Fosse Settings */}
      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Paramètres Fosse par rôle</CardTitle>
          <p className="text-sm text-slate-500 mt-2">
            Configurez les colonnes forcées et les filtres pour chaque rôle sur la page Fosse.
            Les colonnes forcées seront toujours visibles et ne pourront pas être masquées.
            Les filtres forcés peuvent être ouverts (l'utilisateur peut filtrer) ou définis (valeurs prédéfinies).
          </p>
        </CardHeader>
        <CardContent className="px-6 pr-0">
          {roles.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Aucun rôle disponible. Créez d'abord des rôles dans l'onglet Permissions.
            </div>
          ) : (
            <div className="space-y-6">
              {[...roles].reverse().map((role, index) => {
                const setting = settings.get(role.id);
                const isSaving = saving.get(role.id) || false;
                const isExpanded = expandedRole === role.id;
                const forcedColumns = setting?.forcedColumns || [];
                const forcedFilters = setting?.forcedFilters || {};

                return (
                  <React.Fragment key={role.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <Card className="border-2 border-slate-500 border-solid rounded-none shadow-md overflow-hidden">
                    <CardHeader 
                      className="p-4 gap-0 border-2 border-slate-600 border-solid rounded-none ml-0 mt-0 mb-0 mr-0 cursor-pointer hover:bg-slate-50 hover:border-slate-400 transition-all duration-200"
                      onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle 
                          className="text-lg hover:text-slate-700 transition-colors"
                        >
                          {role.name}
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                        >
                          {isExpanded ? 'Réduire' : 'Développer'}
                        </Button>
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent className="space-y-6 px-2 pb-2">
                        {/* Forced Columns Section */}
                        <div className="p-4">
                          <h3 className="text-sm font-semibold mb-3">Colonnes forcées</h3>
                          <p className="text-sm text-slate-500 mb-4">
                            Sélectionnez les colonnes qui seront toujours visibles sur la page Fosse pour ce rôle.
                          </p>
                          <Popover 
                            open={openColumnsPopover === role.id}
                            onOpenChange={(open) => {
                              setOpenColumnsPopover(open ? role.id : null);
                              if (!open) {
                                setColumnSearchTerms(prev => {
                                  const newTerms = { ...prev };
                                  delete newTerms[role.id];
                                  return newTerms;
                                });
                                setColumnSearchTerm('');
                              } else {
                                // Initialize search term for this role when opening
                                setColumnSearchTerm(columnSearchTerms[role.id] || '');
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between"
                                disabled={isSaving}
                              >
                                <span className={forcedColumns.length === 0 ? 'text-muted-foreground' : ''}>
                                  {forcedColumns.length === 0 
                                    ? 'Sélectionner les colonnes...' 
                                    : `${forcedColumns.length} colonne${forcedColumns.length > 1 ? 's' : ''} sélectionnée${forcedColumns.length > 1 ? 's' : ''}`
                                  }
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4" align="start" style={{ zIndex: 10001 }}>
                              <div className="flex flex-col gap-3">
                                <Label className="text-sm font-semibold">
                                  Sélectionner les colonnes
                                </Label>
                                <div className="border-b border-border pb-2 space-y-2">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                      className="pl-8 h-8 text-sm"
                                      placeholder="Rechercher..."
                                      value={columnSearchTerms[role.id] || ''}
                                      onChange={(e) => {
                                        setColumnSearchTerms(prev => ({
                                          ...prev,
                                          [role.id]: e.target.value
                                        }));
                                        setColumnSearchTerm(e.target.value);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => e.stopPropagation()}
                                      autoFocus
                                    />
                                  </div>
                                  {(() => {
                                    const searchTerm = (columnSearchTerms[role.id] || '').toLowerCase();
                                    const filteredOptions = searchTerm
                                      ? AVAILABLE_COLUMNS.filter(col =>
                                          col.label.toLowerCase().includes(searchTerm)
                                        )
                                      : AVAILABLE_COLUMNS;
                                    const allFilteredSelected = filteredOptions.length > 0 && filteredOptions.every(col => forcedColumns.includes(col.id));
                                    
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
                                            const filteredIds = filteredOptions.map(col => col.id);
                                            let newColumns: string[];
                                            if (allFilteredSelected) {
                                              newColumns = forcedColumns.filter(id => !filteredIds.includes(id));
                                            } else {
                                              newColumns = [...new Set([...forcedColumns, ...filteredIds])];
                                            }
                                            if (setting) {
                                              updateSettings(role.id, { forcedColumns: newColumns });
                                            } else {
                                              loadSettingForRole(role.id).then(() => {
                                                updateSettings(role.id, { forcedColumns: newColumns });
                                              });
                                            }
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
                                    const searchTerm = columnSearchTerm.toLowerCase();
                                    const filteredOptions = searchTerm
                                      ? AVAILABLE_COLUMNS.filter(col =>
                                          col.label.toLowerCase().includes(searchTerm)
                                        )
                                      : AVAILABLE_COLUMNS;
                                    
                                    if (filteredOptions.length === 0) {
                                      return (
                                        <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                          Aucun résultat
                                        </div>
                                      );
                                    }
                                    
                                    return filteredOptions.map(column => {
                              const isChecked = forcedColumns.includes(column.id);
                                      
                              return (
                                        <div
                                          key={column.id}
                                          className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                          onClick={() => {
                                            const newColumns = isChecked
                                              ? forcedColumns.filter(id => id !== column.id)
                                              : [...forcedColumns, column.id];
                                      if (setting) {
                                              updateSettings(role.id, { forcedColumns: newColumns });
                                      } else {
                                        loadSettingForRole(role.id).then(() => {
                                                updateSettings(role.id, { forcedColumns: newColumns });
                                        });
                                      }
                                    }}
                                        >
                                          <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                                            {isChecked && (
                                              <Check className="h-4 w-4" />
                                            )}
                                          </span>
                                          <span>{column.label}</span>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          
                          {/* Preview Table */}
                          {(
                            <div className="mt-6 border border-slate-200 rounded-none">
                              <div className="p-3 bg-slate-50 border-b border-slate-200">
                                <h4 className="text-xs font-semibold text-slate-700">Aperçu des colonnes</h4>
                                <p className="text-xs text-slate-500 mt-1">
                                  Toutes les colonnes sont affichées. Les colonnes en surbrillance ne seront pas visibles pour ce rôle mais vous pouvez configurer des filtres forcés dessus.
                                </p>
                              </div>
                              <div style={{ position: 'relative', width: '100%' }}>
                                {/* Horizontal scrollbar on top */}
                                <div 
                                  id={`preview-scroll-top-${role.id}`}
                                  style={{
                                    width: '100%',
                                    height: '12px',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    marginBottom: '0',
                                    backgroundColor: '#f8fafc',
                                    borderBottom: '1px solid #e2e8f0'
                                  }}
                                >
                                  <div id={`preview-scroll-content-${role.id}`} style={{ height: '1px' }}></div>
                                </div>
                                {/* Table wrapper with scrollbars */}
                                <div 
                                  id={`preview-scroll-wrapper-${role.id}`}
                                  className="contacts-table-wrapper" 
                                  style={{ 
                                    height: '300px', 
                                    maxHeight: '300px',
                                    overflowX: 'auto',
                                    overflowY: 'auto',
                                    position: 'relative'
                                  }}
                                  onScroll={(e) => {
                                    // Sync top scrollbar with table scroll
                                    const topScrollbar = document.getElementById(`preview-scroll-top-${role.id}`);
                                    if (topScrollbar) {
                                      topScrollbar.scrollLeft = e.currentTarget.scrollLeft;
                                    }
                                  }}
                                >
                                  <table className="contacts-table">
                                  <thead>
                                    <tr>
                                      {(() => {
                                        const isShowingAll = showAllColumns[role.id] || false;
                                        const visibleColumns = isShowingAll 
                                          ? AVAILABLE_COLUMNS 
                                          : AVAILABLE_COLUMNS.filter(col => DEFAULT_COLUMNS.includes(col.id));
                                        
                                        return (
                                          <>
                                            {visibleColumns.map((column) => {
                                              const columnId = column.id;
                                              const isColumnEnabled = forcedColumns.includes(columnId);
                                              const filter = forcedFilters[columnId];
                                              const hasFilter = filter && (
                                                filter.type === 'defined' 
                                                  ? (filter.values?.length || 0) > 0 
                                                  : filter.type === 'open' && (
                                                    (filter.value !== undefined && filter.value !== '') ||
                                                    (filter.dateRange !== undefined && (filter.dateRange.from || filter.dateRange.to))
                                                  )
                                              );
                                              
                                              return (
                                                <th 
                                                  key={columnId} 
                                                  style={{ 
                                                    position: 'relative',
                                                    backgroundColor: isColumnEnabled ? '#f8fafc' : '#fef3c7',
                                                    opacity: isColumnEnabled ? 1 : 0.8
                                                  }}
                                                >
                                              <Popover 
                                                open={openFilterColumn === `${role.id}-${columnId}`}
                                                onOpenChange={(open) => {
                                                  setOpenFilterColumn(open ? `${role.id}-${columnId}` : null);
                                                  if (open) {
                                                    // Initialize pending filter values when opening
                                                    if (isDateColumn(columnId)) {
                                                      const setting = settings.get(role.id);
                                                      const currentFilters = setting?.forcedFilters || {};
                                                      const filter = currentFilters[columnId];
                                                      // Load existing date range if available
                                                      const existingRange = filter?.dateRange || { from: '', to: '' };
                                                      setPendingDateRangeFilters(prev => ({
                                                        ...prev,
                                                        [`${role.id}-${columnId}`]: existingRange
                                                      }));
                                                    } else if (shouldUseMultiSelectFilter(columnId)) {
                                                      // Initialize pending multi-select filter values
                                                      const setting = settings.get(role.id);
                                                      const currentFilters = setting?.forcedFilters || {};
                                                      const filter = currentFilters[columnId];
                                                      const existingValues = filter?.values || [];
                                                      setPendingMultiSelectFilters(prev => ({
                                                        ...prev,
                                                        [`${role.id}-${columnId}`]: existingValues
                                                      }));
                                                    } else {
                                                      const setting = settings.get(role.id);
                                                      const currentFilters = setting?.forcedFilters || {};
                                                      const filter = currentFilters[columnId];
                                                      // Load existing filter value if available
                                                      const existingValue = filter?.value || '';
                                                      setPendingTextFilterValues(prev => ({
                                                        ...prev,
                                                        [`${role.id}-${columnId}`]: existingValue
                                                      }));
                                                    }
                                                  } else {
                                                    // Clear search terms and pending values when closing
                                                    setColumnFilterSearchTerms(prev => {
                                                      const newTerms = { ...prev };
                                                      delete newTerms[`${role.id}-${columnId}`];
                                                      return newTerms;
                                                    });
                                                    // Clear pending multi-select filter when closing (if not applied)
                                                    setPendingMultiSelectFilters(prev => {
                                                      const newValues = { ...prev };
                                                      delete newValues[`${role.id}-${columnId}`];
                                                      return newValues;
                                                    });
                                                    setPendingTextFilterValues(prev => {
                                                      const newValues = { ...prev };
                                                      delete newValues[`${role.id}-${columnId}`];
                                                      return newValues;
                                                    });
                                                    setPendingDateRangeFilters(prev => {
                                                      const newValues = { ...prev };
                                                      delete newValues[`${role.id}-${columnId}`];
                                                      return newValues;
                                                    });
                                                    if (columnId === 'status') {
                                                      setStatusColumnFilterType('lead');
                                                    }
                                                    if (columnId === 'previousStatus') {
                                                      setPreviousStatusColumnFilterType('lead');
                                                    }
                                                  }
                                                }}
                                              >
                                                <PopoverTrigger asChild>
                                                  <button 
                                                    className="contacts-column-header-button"
                                                    style={{
                                                      backgroundColor: isColumnEnabled ? '#f1f5f9' : '#fde68a',
                                                      borderColor: isColumnEnabled ? '#cbd5e1' : '#f59e0b',
                                                      opacity: isColumnEnabled ? 1 : 0.9
                                                    }}
                                                  >
                                                    <span>{getColumnLabel(columnId)}</span>
                                                    {!isColumnEnabled && (
                                                      <span className="text-xs ml-1" style={{ color: '#92400e' }}>(Masquée)</span>
                                                    )}
                                                    {hasFilter && (
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
                                                              value={columnFilterSearchTerms[`${role.id}-${columnId}`] || ''}
                                                              onChange={(e) => {
                                                                setColumnFilterSearchTerms(prev => ({
                                                                  ...prev,
                                                                  [`${role.id}-${columnId}`]: e.target.value
                                                                }));
                                                              }}
                                                              onClick={(e) => e.stopPropagation()}
                                                              onKeyDown={(e) => e.stopPropagation()}
                                                              autoFocus
                                                            />
                                                          </div>
                                                          {(() => {
                                                            const searchTerm = (columnFilterSearchTerms[`${role.id}-${columnId}`] || '').toLowerCase();
                                                            const statusTypeFilter = columnId === 'status' 
                                                              ? statusColumnFilterType 
                                                              : columnId === 'previousStatus'
                                                              ? previousStatusColumnFilterType
                                                              : 'lead';
                                                            const allOptions = getPreviewFilterOptions(columnId, statusTypeFilter);
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
                                                            
                                                            const currentFilter = forcedFilters[columnId];
                                                            const pendingValues = pendingMultiSelectFilters[`${role.id}-${columnId}`];
                                                            let rawSelectedValues = pendingValues !== undefined 
                                                              ? pendingValues 
                                                              : (currentFilter?.values || []);
                                                            
                                                            // For previousStatus, values are already names (same as Fosse page)
                                                            const selectedValues = rawSelectedValues;
                                                            
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
                                                                    const filteredIds = filteredOptions.map(opt => opt.id);
                                                                    const baseValues = pendingValues !== undefined 
                                                                      ? pendingValues 
                                                                      : (currentFilter?.values || []);
                                                                    let newValues: string[];
                                                                    if (allFilteredSelected) {
                                                                      newValues = baseValues.filter(id => !filteredIds.includes(id));
                                                                    } else {
                                                                      newValues = [...new Set([...baseValues, ...filteredIds])];
                                                                    }
                                                                    setPendingMultiSelectFilters(prev => ({
                                                                      ...prev,
                                                                      [`${role.id}-${columnId}`]: newValues
                                                                    }));
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
                                                            const searchTerm = (columnFilterSearchTerms[`${role.id}-${columnId}`] || '').toLowerCase();
                                                            const statusTypeFilter = columnId === 'status' 
                                                              ? statusColumnFilterType 
                                                              : columnId === 'previousStatus'
                                                              ? previousStatusColumnFilterType
                                                              : 'lead';
                                                            const allOptions = getPreviewFilterOptions(columnId, statusTypeFilter);
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
                                                            
                                                            if (filteredOptions.length === 0) {
                                                              return (
                                                                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                                                  Aucun résultat
                                                                </div>
                                                              );
                                                            }
                                                            
                                                            const currentFilter = forcedFilters[columnId];
                                                            const pendingValues = pendingMultiSelectFilters[`${role.id}-${columnId}`];
                                                            // Use pending values if they exist, otherwise use current filter values
                                                            let rawSelectedValues = pendingValues !== undefined 
                                                              ? pendingValues 
                                                              : (currentFilter?.values || []);
                                                            
                                                            // For previousStatus, values are already names (same as Fosse page)
                                                            const selectedValues = rawSelectedValues;
                                                            
                                                            return filteredOptions.map((option, index) => {
                                                              const isChecked = selectedValues.includes(option.id);
                                                              // Use a combination of option.id and index to ensure unique keys
                                                              const uniqueKey = `${option.id}_${index}_${columnId}`;
                                                              
                                                              return (
                                                                <div
                                                                  key={uniqueKey}
                                                                  className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                                                  onClick={() => {
                                                                    // Update pending state instead of saving immediately
                                                                    const currentPending = pendingMultiSelectFilters[`${role.id}-${columnId}`];
                                                                    const baseValues = currentPending !== undefined 
                                                                      ? currentPending 
                                                                      : (currentFilter?.values || []);
                                                                    let newValues: string[];
                                                                    if (isChecked) {
                                                                      newValues = baseValues.filter(id => id !== option.id);
                                                                    } else {
                                                                      newValues = [...baseValues, option.id];
                                                                    }
                                                                    setPendingMultiSelectFilters(prev => ({
                                                                      ...prev,
                                                                      [`${role.id}-${columnId}`]: newValues
                                                                    }));
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
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                                          <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              // Reset pending state and remove filter from forced filters
                                                              setPendingMultiSelectFilters(prev => {
                                                                const newValues = { ...prev };
                                                                delete newValues[`${role.id}-${columnId}`];
                                                                return newValues;
                                                              });
                                                              const setting = settings.get(role.id);
                                                              const currentFilters = setting?.forcedFilters || {};
                                                              const newFilters = { ...currentFilters };
                                                              delete newFilters[columnId];
                                                              if (setting) {
                                                                updateSettings(role.id, { forcedFilters: newFilters });
                                                              } else {
                                                                loadSettingForRole(role.id).then(() => {
                                                                  updateSettings(role.id, { forcedFilters: newFilters });
                                                                });
                                                              }
                                                              setOpenFilterColumn(null);
                                                            }}
                                                            disabled={(() => {
                                                              const setting = settings.get(role.id);
                                                              const currentFilters = setting?.forcedFilters || {};
                                                              const pendingValues = pendingMultiSelectFilters[`${role.id}-${columnId}`];
                                                              const hasCurrentFilter = currentFilters[columnId] !== undefined;
                                                              const hasPendingChanges = pendingValues !== undefined;
                                                              return !hasCurrentFilter && !hasPendingChanges;
                                                            })()}
                                                          >
                                                            Réinitialiser
                                                          </Button>
                                                          <Button
                                                            variant="default"
                                                            size="sm"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              // Apply pending filter changes
                                                              const pendingValues = pendingMultiSelectFilters[`${role.id}-${columnId}`];
                                                              if (pendingValues !== undefined) {
                                                                // Save pending values (even if empty array - that's valid)
                                                                if (pendingValues.length > 0) {
                                                                  handleFilterChange(role.id, columnId, 'defined', pendingValues);
                                                                } else {
                                                                  // If empty array, remove the filter
                                                                  const setting = settings.get(role.id);
                                                                  const currentFilters = setting?.forcedFilters || {};
                                                                  const newFilters = { ...currentFilters };
                                                                  delete newFilters[columnId];
                                                                  if (setting) {
                                                                    updateSettings(role.id, { forcedFilters: newFilters });
                                                                  } else {
                                                                    loadSettingForRole(role.id).then(() => {
                                                                      updateSettings(role.id, { forcedFilters: newFilters });
                                                                    });
                                                                  }
                                                                }
                                                                // Clear pending state
                                                                setPendingMultiSelectFilters(prev => {
                                                                  const newValues = { ...prev };
                                                                  delete newValues[`${role.id}-${columnId}`];
                                                                  return newValues;
                                                                });
                                                              }
                                                              setOpenFilterColumn(null);
                                                            }}
                                                            disabled={(() => {
                                                              const pendingValues = pendingMultiSelectFilters[`${role.id}-${columnId}`];
                                                              const currentFilter = forcedFilters[columnId];
                                                              const currentValues = currentFilter?.values || [];
                                                              
                                                              // Disable if no pending changes (pendingValues is undefined)
                                                              if (pendingValues === undefined) return true;
                                                              
                                                              // Disable if pending values match current values
                                                              const pendingSorted = [...pendingValues].sort().join(',');
                                                              const currentSorted = [...currentValues].sort().join(',');
                                                              return pendingSorted === currentSorted;
                                                            })()}
                                                          >
                                                            <Filter className="w-4 h-4 mr-2" />
                                                            Appliquer
                                                          </Button>
                                                        </div>
                                                      </>
                                                    ) : isDateColumn(columnId) ? (
                                                      <>
                                                        <div 
                                                          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                                                          onClick={(e) => e.stopPropagation()}
                                                          onPointerDown={(e) => e.stopPropagation()}
                                                        >
                                                          <div 
                                                            style={{ position: 'relative', zIndex: 1 }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onPointerDown={(e) => e.stopPropagation()}
                                                          >
                                                            <Label className="text-xs text-slate-600 mb-1 block">Du</Label>
                                                            <DateInput
                                                              value={(() => {
                                                                const pendingValue = pendingDateRangeFilters[`${role.id}-${columnId}`];
                                                                const setting = settings.get(role.id);
                                                                const currentFilters = setting?.forcedFilters || {};
                                                                const currentFilter = currentFilters[columnId];
                                                                if (pendingValue?.from !== undefined) {
                                                                  return pendingValue.from || '';
                                                                }
                                                                if (currentFilter?.dateRange?.from) {
                                                                  return currentFilter.dateRange.from;
                                                                }
                                                                return '';
                                                              })()}
                                                              onChange={(value) => {
                                                                // Get current pending state first, then update only the 'from' field
                                                                setPendingDateRangeFilters(prev => {
                                                                  const currentPending = prev[`${role.id}-${columnId}`] || {};
                                                                  const setting = settings.get(role.id);
                                                                  const currentFilters = setting?.forcedFilters || {};
                                                                  const currentFilter = currentFilters[columnId];
                                                                  const existingTo = currentPending.to !== undefined 
                                                                    ? currentPending.to 
                                                                    : (currentFilter?.dateRange?.to || '');
                                                                  
                                                                  return {
                                                                    ...prev,
                                                                    [`${role.id}-${columnId}`]: {
                                                                      from: value,
                                                                      to: existingTo
                                                                    }
                                                                  };
                                                                });
                                                              }}
                                                              className="w-full"
                                                              autoInitialize={false}
                                                            />
                                                          </div>
                                                          <div 
                                                            style={{ position: 'relative', zIndex: 1 }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onPointerDown={(e) => e.stopPropagation()}
                                                          >
                                                            <Label className="text-xs text-slate-600 mb-1 block">Au</Label>
                                                            <DateInput
                                                              value={(() => {
                                                                const pendingValue = pendingDateRangeFilters[`${role.id}-${columnId}`];
                                                                const setting = settings.get(role.id);
                                                                const currentFilters = setting?.forcedFilters || {};
                                                                const currentFilter = currentFilters[columnId];
                                                                if (pendingValue?.to !== undefined) {
                                                                  return pendingValue.to || '';
                                                                }
                                                                if (currentFilter?.dateRange?.to) {
                                                                  return currentFilter.dateRange.to;
                                                                }
                                                                return '';
                                                              })()}
                                                              onChange={(value) => {
                                                                // Get current pending state first, then update only the 'to' field
                                                                setPendingDateRangeFilters(prev => {
                                                                  const currentPending = prev[`${role.id}-${columnId}`] || {};
                                                                  const setting = settings.get(role.id);
                                                                  const currentFilters = setting?.forcedFilters || {};
                                                                  const currentFilter = currentFilters[columnId];
                                                                  const existingFrom = currentPending.from !== undefined 
                                                                    ? currentPending.from 
                                                                    : (currentFilter?.dateRange?.from || '');
                                                                  
                                                                  return {
                                                                    ...prev,
                                                                    [`${role.id}-${columnId}`]: {
                                                                      from: existingFrom,
                                                                      to: value
                                                                    }
                                                                  };
                                                                });
                                                              }}
                                                              className="w-full"
                                                              autoInitialize={false}
                                                            />
                                                          </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                                          <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              // Reset filter - remove it from forced filters
                                                              const setting = settings.get(role.id);
                                                              const currentFilters = setting?.forcedFilters || {};
                                                              const newFilters = { ...currentFilters };
                                                              delete newFilters[columnId];
                                                              // Clear pending date range
                                                              setPendingDateRangeFilters(prev => {
                                                                const newValues = { ...prev };
                                                                delete newValues[`${role.id}-${columnId}`];
                                                                return newValues;
                                                              });
                                                              if (setting) {
                                                                updateSettings(role.id, { forcedFilters: newFilters });
                                                              } else {
                                                                loadSettingForRole(role.id).then(() => {
                                                                  updateSettings(role.id, { forcedFilters: newFilters });
                                                                });
                                                              }
                                                              setOpenFilterColumn(null);
                                                            }}
                                                            disabled={(() => {
                                                              const setting = settings.get(role.id);
                                                              const currentFilters = setting?.forcedFilters || {};
                                                              const currentFilter = currentFilters[columnId];
                                                              const hasFilter = currentFilter !== undefined;
                                                              const pendingRange = pendingDateRangeFilters[`${role.id}-${columnId}`];
                                                              const hasPendingRange = pendingRange && (pendingRange.from || pendingRange.to);
                                                              return !hasFilter && !hasPendingRange;
                                                            })()}
                                                          >
                                                            Réinitialiser
                                                          </Button>
                                                          <Button
                                                            variant="default"
                                                            size="sm"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              // Apply filter - set to 'open' type with the date range
                                                              const pendingRange = pendingDateRangeFilters[`${role.id}-${columnId}`] || {};
                                                              const setting = settings.get(role.id);
                                                              const currentFilters = setting?.forcedFilters || {};
                                                              const dateRange = {
                                                                from: pendingRange.from?.trim() || undefined,
                                                                to: pendingRange.to?.trim() || undefined,
                                                              };
                                                              
                                                              const newFilters = {
                                                                ...currentFilters,
                                                                [columnId]: {
                                                                  type: 'open' as const,
                                                                  dateRange: (dateRange.from || dateRange.to) ? dateRange : undefined,
                                                                },
                                                              };
                                                              
                                                              if (setting) {
                                                                updateSettings(role.id, { forcedFilters: newFilters });
                                                              } else {
                                                                loadSettingForRole(role.id).then(() => {
                                                                  updateSettings(role.id, { forcedFilters: newFilters });
                                                                });
                                                              }
                                                              
                                                              // Clear pending date range
                                                              setPendingDateRangeFilters(prev => {
                                                                const newValues = { ...prev };
                                                                delete newValues[`${role.id}-${columnId}`];
                                                                return newValues;
                                                              });
                                                              setOpenFilterColumn(null);
                                                            }}
                                                            disabled={(() => {
                                                              const pendingRange = pendingDateRangeFilters[`${role.id}-${columnId}`] || {};
                                                              const setting = settings.get(role.id);
                                                              const currentFilters = setting?.forcedFilters || {};
                                                              const currentFilter = currentFilters[columnId];
                                                              const currentRange = currentFilter?.dateRange || {};
                                                              const pendingFrom = pendingRange.from?.trim() || '';
                                                              const pendingTo = pendingRange.to?.trim() || '';
                                                              const currentFrom = currentRange.from?.trim() || '';
                                                              const currentTo = currentRange.to?.trim() || '';
                                                              return pendingFrom === currentFrom && pendingTo === currentTo;
                                                            })()}
                                                          >
                                                            Appliquer
                                                          </Button>
                                                        </div>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <Input
                                                          type="text"
                                                          placeholder={`Rechercher dans ${getColumnLabel(columnId).toLowerCase()}...`}
                                                          autoFocus
                                                          value={pendingTextFilterValues[`${role.id}-${columnId}`] || ''}
                                                          onChange={(e) => {
                                                            setPendingTextFilterValues(prev => ({
                                                              ...prev,
                                                              [`${role.id}-${columnId}`]: e.target.value
                                                            }));
                                                          }}
                                                          onClick={(e) => e.stopPropagation()}
                                                          onKeyDown={(e) => e.stopPropagation()}
                                                        />
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                                          <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              // Reset filter - remove it from forced filters
                                                              const setting = settings.get(role.id);
                                                              const currentFilters = setting?.forcedFilters || {};
                                                              const newFilters = { ...currentFilters };
                                                              delete newFilters[columnId];
                                                              // Clear pending value
                                                              setPendingTextFilterValues(prev => {
                                                                const newValues = { ...prev };
                                                                delete newValues[`${role.id}-${columnId}`];
                                                                return newValues;
                                                              });
                                                              if (setting) {
                                                                updateSettings(role.id, { forcedFilters: newFilters });
                                                              } else {
                                                                loadSettingForRole(role.id).then(() => {
                                                                  updateSettings(role.id, { forcedFilters: newFilters });
                                                                });
                                                              }
                                                              setOpenFilterColumn(null);
                                                            }}
                                                            disabled={(() => {
                                                              const setting = settings.get(role.id);
                                                              const currentFilters = setting?.forcedFilters || {};
                                                              const hasFilter = currentFilters[columnId] !== undefined;
                                                              const hasPendingValue = pendingTextFilterValues[`${role.id}-${columnId}`] !== undefined && pendingTextFilterValues[`${role.id}-${columnId}`] !== '';
                                                              return !hasFilter && !hasPendingValue;
                                                            })()}
                                                          >
                                                            Réinitialiser
                                                          </Button>
                                                          <Button
                                                            variant="default"
                                                            size="sm"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              // Apply filter - set to 'open' type with the text value
                                                              const textValue = pendingTextFilterValues[`${role.id}-${columnId}`] || '';
                                                              const setting = settings.get(role.id);
                                                              const currentFilters = setting?.forcedFilters || {};
                                                              const newFilters = {
                                                                ...currentFilters,
                                                                [columnId]: {
                                                                  type: 'open' as const,
                                                                  value: textValue.trim() || undefined, // Store text value if provided
                                                                },
                                                              };
                                                              
                                                              if (setting) {
                                                                updateSettings(role.id, { forcedFilters: newFilters });
                                                              } else {
                                                                loadSettingForRole(role.id).then(() => {
                                                                  updateSettings(role.id, { forcedFilters: newFilters });
                                                                });
                                                              }
                                                              
                                                              // Clear pending value
                                                              setPendingTextFilterValues(prev => {
                                                                const newValues = { ...prev };
                                                                delete newValues[`${role.id}-${columnId}`];
                                                                return newValues;
                                                              });
                                                              setOpenFilterColumn(null);
                                                            }}
                                                            disabled={(() => {
                                                              const textValue = pendingTextFilterValues[`${role.id}-${columnId}`] || '';
                                                              const setting = settings.get(role.id);
                                                              const currentFilters = setting?.forcedFilters || {};
                                                              const currentFilter = currentFilters[columnId];
                                                              const currentValue = currentFilter?.value || '';
                                                              return textValue.trim() === currentValue.trim();
                                                            })()}
                                                          >
                                                            Appliquer
                                                          </Button>
                                                        </div>
                                                      </>
                                                    )}
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                            </th>
                                              );
                                            })}
                                            {!isShowingAll && (
                                              <th 
                                                key="voir-plus"
                                                style={{ 
                                                  position: 'relative',
                                                  backgroundColor: '#f8fafc',
                                                  minWidth: '120px'
                                                }}
                                              >
                                                <button
                                                  onClick={() => {
                                                    setShowAllColumns(prev => ({
                                                      ...prev,
                                                      [role.id]: true
                                                    }));
                                                  }}
                                                  className="contacts-column-header-button"
                                                  style={{
                                                    backgroundColor: '#f1f5f9',
                                                    borderColor: '#cbd5e1',
                                                    width: '100%',
                                                    cursor: 'pointer'
                                                  }}
                                                >
                                                  Voir plus
                                                </button>
                                              </th>
                                            )}
                                          </>
                                        );
                                      })()}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(() => {
                                        const isShowingAll = showAllColumns[role.id] || false;
                                        const visibleColumns = isShowingAll 
                                          ? AVAILABLE_COLUMNS 
                                          : AVAILABLE_COLUMNS.filter(col => DEFAULT_COLUMNS.includes(col.id));
                                        const columnCount = visibleColumns.length + (!isShowingAll ? 1 : 0); // +1 for "Voir plus" button
                                        
                                        return (
                                          <>
                                            {loadingPreview ? (
                                              <tr>
                                                <td 
                                                  colSpan={columnCount}
                                                  className="p-8 text-center text-sm text-slate-500"
                                                  style={{ backgroundColor: 'transparent' }}
                                                >
                                                  Chargement de l'aperçu...
                                                </td>
                                              </tr>
                                            ) : previewContacts.length === 0 ? (
                                              <tr>
                                                <td 
                                                  colSpan={columnCount}
                                                  className="p-8 text-center text-sm text-slate-500"
                                                  style={{ backgroundColor: 'transparent' }}
                                                >
                                                  <div className="flex flex-col items-center gap-3">
                                                    <span>Aucun contact disponible pour l'aperçu</span>
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        const setting = settings.get(role.id);
                                                        loadPreviewContacts(role.id, [], setting?.defaultOrder);
                                                      }}
                                                      className="flex items-center gap-2"
                                                    >
                                                      <RefreshCw className="w-4 h-4" />
                                                      Actualiser
                                                    </Button>
                                                  </div>
                                                </td>
                                              </tr>
                                            ) : (
                                              previewContacts.map((contact) => (
                                              <tr key={contact.id}>
                                                {visibleColumns.map((column) => {
                                                  const columnId = column.id;
                                                  const isColumnEnabled = forcedColumns.includes(columnId);
                                                  return (
                                                    <td 
                                                      key={columnId}
                                                      style={{
                                                        backgroundColor: isColumnEnabled ? 'transparent' : '#fef3c7',
                                                        opacity: isColumnEnabled ? 1 : 0.7
                                                      }}
                                                    >
                                                      {renderPreviewCellContent(contact, columnId)}
                                                    </td>
                                                  );
                                                })}
                                                {!isShowingAll && (
                                                  <td key="voir-plus-empty" style={{ backgroundColor: '#f8fafc' }}></td>
                                                )}
                                              </tr>
                                              ))
                                            )}
                                          </>
                                        );
                                      })()}
                                    </tbody>
                                  </table>
                          </div>
                                </div>
                            </div>
                          )}
                        </div>

                        <Separator />

                        {/* Default Order Section */}
                        <div className="p-4">
                          <h3 className="text-sm font-semibold mb-3">Ordre des contacts</h3>
                          <p className="text-sm text-slate-500 mb-4">
                            Choisissez comment les contacts seront organisés sur la page Fosse pour ce rôle. Cet ordre s'applique également à l'aperçu ci-dessus.
                          </p>
                          <div className="flex items-center space-x-4">
                            <Select
                              value={setting?.defaultOrder || 'created_at_desc'}
                              disabled={isSaving || !setting}
                              onValueChange={(value: 'none' | 'created_at_asc' | 'created_at_desc' | 'updated_at_asc' | 'updated_at_desc' | 'assigned_at_asc' | 'assigned_at_desc' | 'email_asc' | 'random') => {
                                if (setting) {
                                  updateSettings(role.id, { defaultOrder: value });
                                  // Reload preview with new order (use 'created_at_desc' if 'none' is selected)
                                  const orderForPreview = value === 'none' ? 'created_at_desc' : value;
                                  loadPreviewContacts(role.id, [], orderForPreview);
                                } else {
                                  loadSettingForRole(role.id).then(() => {
                                    updateSettings(role.id, { defaultOrder: value });
                                    // Reload preview with new order (use 'created_at_desc' if 'none' is selected)
                                    const orderForPreview = value === 'none' ? 'created_at_desc' : value;
                                    loadPreviewContacts(role.id, [], orderForPreview);
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="w-[300px]">
                                <SelectValue placeholder="Sélectionner un ordre" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Non défini (personnalisable)</SelectItem>
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
                          </div>
                        </div>

                      </CardContent>
                    )}
                  </Card>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* General Fosse Settings - Default Status */}
      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Statut Fosse par défaut</CardTitle>
          <p className="text-sm text-slate-500 mt-2">
            Sélectionnez le statut qui sera considéré comme le statut Fosse par défaut.
            Les contacts avec ce statut apparaîtront dans la page Fosse.
          </p>
        </CardHeader>
        <CardContent>
          {statuses.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Aucun statut disponible. Créez d'abord des statuts dans l'onglet Statuts.
            </div>
          ) : (
            <div className="flex items-center space-x-4">
                                    <Select
                value={fosseDefaultStatusId || 'none'}
                disabled={savingFosseDefaults}
                onValueChange={(value) => {
                  updateFosseDefaultStatus(value === 'none' ? '' : value);
                }}
              >
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Sélectionner un statut" />
                                      </SelectTrigger>
                                      <SelectContent>
                  <SelectItem value="none">Aucun (désactiver)</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
          )}
                      </CardContent>
      </Card>
    </div>
  );
}

export default FosseSettingsTab;

