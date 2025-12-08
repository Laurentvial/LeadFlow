import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import LoadingIndicator from './LoadingIndicator';
import { useRoles } from '../hooks/useRoles';
import { useStatuses } from '../hooks/useStatuses';
import { useSources } from '../hooks/useSources';
import { useUsers } from '../hooks/useUsers';
import { useTeams } from '../hooks/useTeams';
import { ACCESS_TOKEN } from '../utils/constants';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Separator } from './ui/separator';

interface FosseSettings {
  id: string;
  roleId: string;
  roleName: string;
  forcedColumns: string[];
  forcedFilters: Record<string, { type: 'open' | 'defined'; values?: string[] }>;
  defaultOrder: 'default' | 'created_at_asc' | 'created_at_desc' | 'updated_at_asc' | 'updated_at_desc' | 'email_asc';
  defaultStatusId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Available columns for Fosse page
const AVAILABLE_COLUMNS = [
  { id: 'createdAt', label: 'Créé le' },
  { id: 'fullName', label: 'Nom entier' },
  { id: 'source', label: 'Source' },
  { id: 'phone', label: 'Téléphone' },
  { id: 'mobile', label: 'Portable' },
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
        defaultOrder: 'default',
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
        defaultOrder: updates.defaultOrder !== undefined ? updates.defaultOrder : (currentSetting?.defaultOrder ?? 'default'),
        defaultStatusId: updates.defaultStatusId !== undefined ? updates.defaultStatusId : (currentSetting?.defaultStatusId ?? null),
      };

      const response = await apiCall(`/api/fosse-settings/${roleId}/update/`, {
        method: 'PUT',
        body: JSON.stringify(updatedData),
      });

      // If we got here without an error, the update succeeded
      // Response can be null for 204 No Content, but that's still success
      toast.success('Paramètres Fosse mis à jour avec succès');
      
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

  // Toggle column in forced columns
  const toggleColumn = (roleId: string, columnId: string) => {
    // Get current setting and calculate new columns
    const currentSetting = settings.get(roleId);
    if (!currentSetting) {
      // If no setting, load it first then retry
      loadSettingForRole(roleId).then(() => {
        toggleColumn(roleId, columnId);
      });
      return;
    }

    const currentColumns = currentSetting.forcedColumns || [];
    const newColumns = currentColumns.includes(columnId)
      ? currentColumns.filter(id => id !== columnId)
      : [...currentColumns, columnId];

    // Update local state immediately
    setSettings(prev => {
      const newMap = new Map(prev);
      const setting = newMap.get(roleId);
      if (setting) {
        newMap.set(roleId, { ...setting, forcedColumns: newColumns });
      }
      return newMap;
    });
    
    // Save to server
    updateSettings(roleId, { forcedColumns: newColumns });
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

  // Toggle a value in filter values
  const toggleFilterValue = (roleId: string, columnId: string, value: string) => {
    const setting = settings.get(roleId);
    if (!setting) return;

    const currentFilter = setting.forcedFilters[columnId];
    if (!currentFilter || currentFilter.type !== 'defined') return;

    const currentValues = currentFilter.values || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];

    updateFilterValues(roleId, columnId, newValues);
  };

  // Get options for a filterable column
  const getFilterOptions = (columnId: string) => {
    const column = FILTERABLE_COLUMNS.find(c => c.id === columnId);
    if (!column) return [];

    switch (column.optionsType) {
      case 'statuses':
        return statuses.map(s => ({ id: s.id, label: s.name }));
      case 'sources':
        return sources.map(s => ({ id: s.id, label: s.name }));
      case 'users':
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

  if (loading || rolesLoading || statusesLoading || sourcesLoading || usersLoading || teamsLoading) {
    return <LoadingIndicator />;
  }

  return (
    <div className="space-y-6">
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
        <CardContent>
          {roles.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Aucun rôle disponible. Créez d'abord des rôles dans l'onglet Permissions.
            </div>
          ) : (
            <div className="space-y-6">
              {roles.map((role) => {
                const setting = settings.get(role.id);
                const isSaving = saving.get(role.id) || false;
                const isExpanded = expandedRole === role.id;
                const forcedColumns = setting?.forcedColumns || [];
                const forcedFilters = setting?.forcedFilters || {};

                return (
                  <Card key={role.id} className="border-2 border-slate-300 rounded-none">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{role.name}</CardTitle>
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
                      <CardContent className="space-y-6">
                        {/* Forced Columns Section */}
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Colonnes forcées</h3>
                          <p className="text-sm text-slate-500 mb-4">
                            Sélectionnez les colonnes qui seront toujours visibles sur la page Fosse pour ce rôle.
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {AVAILABLE_COLUMNS.map((column) => {
                              const isChecked = forcedColumns.includes(column.id);
                              return (
                                <div key={column.id} className="flex items-center space-x-3">
                                  <Checkbox
                                    id={`${role.id}-column-${column.id}`}
                                    checked={isChecked}
                                    disabled={isSaving}
                                    onCheckedChange={() => {
                                      if (setting) {
                                        toggleColumn(role.id, column.id);
                                      } else {
                                        loadSettingForRole(role.id).then(() => {
                                          toggleColumn(role.id, column.id);
                                        });
                                      }
                                    }}
                                  />
                                  <Label
                                    htmlFor={`${role.id}-column-${column.id}`}
                                    className="text-sm font-normal cursor-pointer"
                                  >
                                    {column.label}
                                  </Label>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <Separator />

                        {/* Default Order Section */}
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Ordre par défaut</h3>
                          <p className="text-sm text-slate-500 mb-4">
                            Choisissez comment les contacts seront organisés sur la page Fosse pour ce rôle.
                          </p>
                          <div className="flex items-center space-x-4">
                            <Select
                              value={setting?.defaultOrder || 'default'}
                              disabled={isSaving || !setting}
                              onValueChange={(value: 'default' | 'created_at_asc' | 'created_at_desc' | 'updated_at_asc' | 'updated_at_desc' | 'email_asc') => {
                                if (setting) {
                                  updateSettings(role.id, { defaultOrder: value });
                                } else {
                                  loadSettingForRole(role.id).then(() => {
                                    updateSettings(role.id, { defaultOrder: value });
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="w-[300px]">
                                <SelectValue placeholder="Sélectionner un ordre" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="default">Par défaut (nom complet)</SelectItem>
                                <SelectItem value="created_at_asc">Date de création (ancien à nouveau)</SelectItem>
                                <SelectItem value="created_at_desc">Date de création (nouveau à ancien)</SelectItem>
                                <SelectItem value="updated_at_asc">Date de modification (ancien à nouveau)</SelectItem>
                                <SelectItem value="updated_at_desc">Date de modification (nouveau à ancien)</SelectItem>
                                <SelectItem value="email_asc">Email (ordre alphabétique)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Separator />

                        {/* Forced Filters Section */}
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Filtres forcés</h3>
                          <p className="text-sm text-slate-500 mb-4">
                            Configurez les filtres pour chaque colonne. "Ouvert" permet à l'utilisateur de filtrer librement.
                            "Défini" permet de pré-sélectionner des valeurs spécifiques.
                          </p>
                          <div className="space-y-4">
                            {FILTERABLE_COLUMNS.map((column) => {
                              const filter = forcedFilters[column.id];
                              const filterType = filter?.type || 'open';
                              const filterValues = filter?.values || [];
                              const options = getFilterOptions(column.id);

                              return (
                                <div key={column.id} className="border rounded-none p-4 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold">{column.label}</Label>
                                    <Select
                                      value={filterType}
                                      disabled={isSaving}
                                      onValueChange={(value: 'open' | 'defined') => {
                                        if (setting) {
                                          updateFilterType(role.id, column.id, value);
                                        } else {
                                          loadSettingForRole(role.id).then(() => {
                                            updateFilterType(role.id, column.id, value);
                                          });
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="w-[150px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="open">Ouvert</SelectItem>
                                        <SelectItem value="defined">Défini</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  {filterType === 'defined' && (
                                    <div className="space-y-2">
                                      <Label className="text-xs text-slate-500">
                                        Sélectionnez les valeurs à afficher :
                                      </Label>
                                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto">
                                        {options.map((option) => {
                                          const isChecked = filterValues.includes(option.id);
                                          return (
                                            <div key={option.id} className="flex items-center space-x-3">
                                              <Checkbox
                                                id={`${role.id}-filter-${column.id}-${option.id}`}
                                                checked={isChecked}
                                                disabled={isSaving}
                                                onCheckedChange={() => {
                                                  if (setting) {
                                                    toggleFilterValue(role.id, column.id, option.id);
                                                  } else {
                                                    loadSettingForRole(role.id).then(() => {
                                                      toggleFilterValue(role.id, column.id, option.id);
                                                    });
                                                  }
                                                }}
                                              />
                                              <Label
                                                htmlFor={`${role.id}-filter-${column.id}-${option.id}`}
                                                className="text-xs font-normal cursor-pointer truncate"
                                                title={option.label}
                                              >
                                                {option.label}
                                              </Label>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {options.length === 0 && (
                                        <p className="text-xs text-slate-400 italic">
                                          Aucune option disponible pour ce filtre.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default FosseSettingsTab;

