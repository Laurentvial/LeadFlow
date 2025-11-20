import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Pencil, Trash2, Shield, X } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import LoadingIndicator from './LoadingIndicator';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import '../styles/Modal.css';

// Mapping database names to user-facing labels (for translation/special character, etc.)
const componentNameMap: Record<string, string> = {
  dashboard: 'Tableau de bord',
  contacts: 'Contacts',
  users: 'Utilisateurs',
  teams: 'Équipes',
  planning: 'Planning',
  permissions: 'Permissions',
  statuses: 'Statuts',
  mails: 'Mails',
};

const componentLabelToDbName = Object.fromEntries(
  Object.entries(componentNameMap).map(([dbName, label]) => [label, dbName])
);

interface Role {
  id: string;
  name: string;
  dataAccess: 'all' | 'team_only' | 'own_only';
  isTeleoperateur?: boolean;
  isConfirmateur?: boolean;
  createdAt: string;
}

interface Permission {
  id: string;
  component: string; // always DB value, e.g., 'contacts'
  fieldName?: string | null;
  action: 'view' | 'edit' | 'create' | 'delete';
  statusId?: string | null;
}

interface PermissionRole {
  id: string;
  roleId: string;
  roleName: string;
  permissionId: string;
  permission: Permission;
}

interface Status {
  id: string;
  name: string;
  type: 'lead' | 'client';
  color: string;
  orderIndex: number;
}

export function PermissionsTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionRoles, setPermissionRoles] = useState<PermissionRole[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: '',
    dataAccess: 'own_only' as 'all' | 'team_only' | 'own_only',
    isTeleoperateur: false,
    isConfirmateur: false,
  });
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState<Role | null>(null);
  
  // Pending permissions changes (before saving)
  // Map: "roleId-permissionId" -> boolean (true = add, false = remove, undefined = no change)
  const [pendingPermissionChanges, setPendingPermissionChanges] = useState<Map<string, boolean>>(new Map());
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  useEffect(() => {
    loadData();
  }, []);
  
  // Reset pending changes when role changes
  useEffect(() => {
    setPendingPermissionChanges(new Map());
  }, [selectedRoleForPermissions?.id]);

  // Set default selected role to first role when roles are loaded
  useEffect(() => {
    if (roles.length > 0 && !selectedRoleForPermissions) {
      setSelectedRoleForPermissions(roles[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles]);

  async function loadData() {
    setLoading(true);
    try {
      const [rolesData, permissionsData, permissionRolesData, statusesData] = await Promise.all([
        apiCall('/api/roles/'),
        apiCall('/api/permissions/'),
        apiCall('/api/permission-roles/'),
        apiCall('/api/statuses/'),
      ]);

      setRoles(rolesData.roles || []);
      setPermissions(permissionsData.permissions || []);
      setPermissionRoles(permissionRolesData.permissionRoles || []);
      setStatuses(statusesData.statuses || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des données');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRole() {
    setRoleError('');
    setRoleLoading(true);
    try {
      await apiCall('/api/roles/create/', {
        method: 'POST',
        body: JSON.stringify({
          name: roleForm.name,
          dataAccess: roleForm.dataAccess,
          isTeleoperateur: roleForm.isTeleoperateur,
          isConfirmateur: roleForm.isConfirmateur,
        }),
      });
      toast.success('Rôle créé avec succès');
      setIsRoleModalOpen(false);
      setRoleForm({ name: '', dataAccess: 'own_only', isTeleoperateur: false, isConfirmateur: false });
      loadData();
    } catch (error: any) {
      const message = error.message || 'Erreur lors de la création du rôle';
      setRoleError(message);
      toast.error(message);
    } finally {
      setRoleLoading(false);
    }
  }

  async function handleUpdateRole() {
    if (!selectedRole) return;
    setRoleError('');
    setRoleLoading(true);
    try {
      await apiCall(`/api/roles/${selectedRole.id}/`, {
        method: 'PUT',
        body: JSON.stringify({
          name: roleForm.name,
          dataAccess: roleForm.dataAccess,
          isTeleoperateur: roleForm.isTeleoperateur,
          isConfirmateur: roleForm.isConfirmateur,
        }),
      });
      toast.success('Rôle mis à jour avec succès');
      setIsEditRoleModalOpen(false);
      setSelectedRole(null);
      setRoleForm({ name: '', dataAccess: 'own_only', isTeleoperateur: false, isConfirmateur: false });
      loadData();
    } catch (error: any) {
      const message = error.message || 'Erreur lors de la mise à jour du rôle';
      setRoleError(message);
      toast.error(message);
    } finally {
      setRoleLoading(false);
    }
  }

  async function handleDeleteRole(roleId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rôle ?')) return;
    try {
      await apiCall(`/api/roles/${roleId}/delete/`, {
        method: 'DELETE',
      });
      toast.success('Rôle supprimé avec succès');
      // If deleted role was selected, clear selection
      if (selectedRoleForPermissions?.id === roleId) {
        setSelectedRoleForPermissions(null);
      }
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression du rôle');
    }
  }

  function handleEditRole(role: Role) {
    setSelectedRole(role);
    setRoleForm({ 
      name: role.name, 
      dataAccess: role.dataAccess,
      isTeleoperateur: role.isTeleoperateur ?? false,
      isConfirmateur: role.isConfirmateur ?? false,
    });
    setIsEditRoleModalOpen(true);
  }

  // Predefined list of components (DB names)
  const predefinedComponents = [
    'dashboard',
    'contacts',
    'users',
    'teams',
    'planning',
    'permissions',
    'statuses',
    'mails',
  ];

  /**
   * Used in UI for display only (always translate for display)
   */
  function getDisplayComponentLabel(dbComponentName: string): string {
    return componentNameMap[dbComponentName] || dbComponentName;
  }

  /**
   * Used for API and DB actions (store and fetch are always with DB names)
   * For custom/unknown components (not mapped), dbName IS the same as display name.
   */
  function getDbComponentName(displayLabel: string): string {
    return componentLabelToDbName[displayLabel] || displayLabel;
  }

  // Get unique db component names from permissions and predefined list
  // Order: predefined components first (in their defined order), then any additional components from DB (alphabetically)
  // Exclude: events, notes, settings
  const excludedComponents = ['events', 'notes', 'settings'];
  
  function getUniqueDbComponents(): string[] {
    const predefinedSet = new Set(predefinedComponents);
    const additionalComponents: string[] = [];
    
    permissions.forEach(p => {
      if (!p.fieldName && !p.statusId && !predefinedSet.has(p.component) && !excludedComponents.includes(p.component)) {
        additionalComponents.push(p.component);
      }
    });
    
    // Sort additional components alphabetically
    additionalComponents.sort();
    
    // Return predefined components first (in their original order), then additional ones
    // Filter out excluded components from predefined list as well
    return [...predefinedComponents.filter(c => !excludedComponents.includes(c)), ...additionalComponents];
  }

  // Get permission ID for a component + action combination
  function getPermissionId(dbComponentName: string, action: 'view' | 'create' | 'edit' | 'delete', statusId?: string | null): string | null {
    const perm = permissions.find(
      p => p.component === dbComponentName &&
           p.action === action &&
           !p.fieldName &&
           (statusId ? p.statusId === statusId : !p.statusId)
    );
    return perm?.id || null;
  }

  // Check if a role has a specific permission (including pending changes)
  function hasPermission(roleId: string, permissionId: string | null, component?: string, action?: string, statusId?: string | null): boolean {
    // Check pending changes first
    if (permissionId) {
      const changeKey = `${roleId}-${permissionId}`;
      const pendingChange = pendingPermissionChanges.get(changeKey);
      if (pendingChange !== undefined) {
        return pendingChange;
      }
    }
    
    // Also check for new permissions in pending changes (format: roleId-component-action-statusId)
    if (component && action) {
      const newPermissionKey = `${roleId}-${component}-${action}-${statusId || 'none'}`;
      const pendingNewPermission = pendingPermissionChanges.get(newPermissionKey);
      if (pendingNewPermission !== undefined) {
        return pendingNewPermission;
      }
    }
    
    // Otherwise check current state
    if (!permissionId) return false;
    return permissionRoles.some(
      pr => pr.roleId === roleId && pr.permissionId === permissionId
    );
  }
  
  // Toggle permission in pending changes (local state only, no API call)
  function togglePendingPermission(
    roleId: string,
    displayComponentLabel: string,
    action: 'view' | 'create' | 'edit' | 'delete',
    statusId?: string | null
  ) {
    const dbComponentName = getDbComponentName(displayComponentLabel);
    
    // If this is a status permission, check if role has the corresponding general contact permission
    if (dbComponentName === 'statuses' && statusId) {
      const contactPermissionId = getPermissionId('contacts', action);
      const hasContactPermission = hasPermission(roleId, contactPermissionId);
      
      if (!hasContactPermission) {
        const actionLabels: Record<string, string> = {
          view: 'voir',
          create: 'créer',
          edit: 'modifier',
          delete: 'supprimer',
        };
        toast.error(
          `Le rôle doit d'abord avoir la permission "${actionLabels[action]}" pour les contacts avant de pouvoir avoir cette permission pour un statut spécifique`
        );
        return;
      }
    }
    
    const permissionId = getPermissionId(dbComponentName, action, statusId);
    
    // Use different key format for new vs existing permissions
    let changeKey: string;
    if (!permissionId) {
      // Permission doesn't exist yet, use component-action-statusId format
      changeKey = `${roleId}-${dbComponentName}-${action}-${statusId || 'none'}`;
    } else {
      // Existing permission, use roleId-permissionId format
      changeKey = `${roleId}-${permissionId}`;
    }
    
    // Get current state (checking both pending changes and actual state)
    let currentState: boolean;
    if (!permissionId) {
      // For new permissions, they don't exist, so current state is false
      currentState = false;
    } else {
      // Check pending changes first, then actual state
      const pendingChange = pendingPermissionChanges.get(changeKey);
      if (pendingChange !== undefined) {
        currentState = pendingChange;
      } else {
        currentState = permissionRoles.some(
          pr => pr.roleId === roleId && pr.permissionId === permissionId
        );
      }
    }
    
    setPendingPermissionChanges(prev => {
      const newMap = new Map(prev);
      // Toggle: if currently true, set to false (remove), if false, set to true (add)
      newMap.set(changeKey, !currentState);
      return newMap;
    });
  }

  // Toggle all permissions in a column for Pages table
  function toggleAllPagesColumn(action: 'view' | 'create' | 'edit' | 'delete') {
    if (!selectedRoleForPermissions) return;
    
    const roleId = selectedRoleForPermissions.id;
    const components = getUniqueDbComponents();
    
    // Check if all are currently checked
    let allChecked = true;
    for (const dbComponent of components) {
      // Skip dashboard for create/edit/delete actions
      if (dbComponent === 'dashboard' && action !== 'view') {
        continue;
      }
      
      const permissionId = getPermissionId(dbComponent, action);
      const hasPerm = hasPermission(roleId, permissionId);
      
      if (!hasPerm) {
        allChecked = false;
        break;
      }
    }
    
    // Batch all updates in a single state update
    setPendingPermissionChanges(prev => {
      const newMap = new Map(prev);
      
      // Toggle all components
      for (const dbComponent of components) {
        // Skip dashboard for create/edit/delete actions
        if (dbComponent === 'dashboard' && action !== 'view') {
          continue;
        }
        
        const permissionId = getPermissionId(dbComponent, action);
        
        let changeKey: string;
        if (!permissionId) {
          changeKey = `${roleId}-${dbComponent}-${action}-none`;
        } else {
          changeKey = `${roleId}-${permissionId}`;
        }
        
        // Set to opposite of allChecked state
        newMap.set(changeKey, !allChecked);
      }
      
      return newMap;
    });
  }

  // Toggle all permissions in a column for Status table
  function toggleAllStatusColumn(action: 'view' | 'create' | 'edit' | 'delete') {
    if (!selectedRoleForPermissions) return;
    
    const roleId = selectedRoleForPermissions.id;
    
    // Check if role has the corresponding general contact permission
    const contactPermissionId = getPermissionId('contacts', action);
    const hasContactPermission = hasPermission(roleId, contactPermissionId);
    
    if (!hasContactPermission) {
      const actionLabels: Record<string, string> = {
        view: 'voir',
        create: 'créer',
        edit: 'modifier',
        delete: 'supprimer',
      };
      toast.error(
        `Le rôle doit d'abord avoir la permission "${actionLabels[action]}" pour les contacts avant de pouvoir avoir cette permission pour un statut spécifique`
      );
      return;
    }
    
    // Check if all are currently checked
    let allChecked = true;
    for (const status of statuses) {
      const permissionId = getPermissionId('statuses', action, status.id);
      const hasPerm = hasPermission(roleId, permissionId);
      
      if (!hasPerm) {
        allChecked = false;
        break;
      }
    }
    
    // Batch all updates in a single state update
    setPendingPermissionChanges(prev => {
      const newMap = new Map(prev);
      
      // Toggle all statuses
      for (const status of statuses) {
        const permissionId = getPermissionId('statuses', action, status.id);
        
        let changeKey: string;
        if (!permissionId) {
          changeKey = `${roleId}-statuses-${action}-${status.id}`;
        } else {
          changeKey = `${roleId}-${permissionId}`;
        }
        
        // Set to opposite of allChecked state
        newMap.set(changeKey, !allChecked);
      }
      
      return newMap;
    });
  }

  // Save all pending permission changes
  async function handleSavePermissions() {
    if (!selectedRoleForPermissions) return;
    
    setIsSavingPermissions(true);
    const errors: string[] = [];
    const roleId = selectedRoleForPermissions.id;
    
    try {
      // First, handle permissions that need to be created
      const permissionsToCreate: Array<{component: string, action: string, statusId: string | null}> = [];
      const processedKeys = new Set<string>();
      
      for (const [changeKey, shouldHave] of pendingPermissionChanges.entries()) {
        // Check if this is a new permission (format: roleId-component-action-statusId)
        const parts = changeKey.split('-');
        if (parts.length >= 4 && parts[0] === roleId) {
          const [, component, action, statusIdStr] = parts;
          const statusId = statusIdStr === 'none' ? null : statusIdStr;
          
          if (shouldHave) {
            permissionsToCreate.push({ component, action, statusId });
          }
          processedKeys.add(changeKey);
        }
      }
      
      // Create new permissions first
      const createdPermissionIds: Map<string, string> = new Map();
      for (const { component, action, statusId } of permissionsToCreate) {
        try {
          const newPermission = await apiCall('/api/permissions/create/', {
            method: 'POST',
            body: JSON.stringify({
              component,
              action,
              fieldName: null,
              statusId: statusId || null,
            }),
          });
          
          const key = `${component}-${action}-${statusId || 'none'}`;
          createdPermissionIds.set(key, newPermission.id);
          
          // Add to local permissions list
          setPermissions(prev => [...prev, newPermission]);
        } catch (error: any) {
          errors.push(`Erreur lors de la création de la permission ${component}-${action}`);
        }
      }
      
      // Now process all changes (including newly created permissions)
      for (const [changeKey, shouldHave] of pendingPermissionChanges.entries()) {
        if (!changeKey.startsWith(`${roleId}-`)) continue;
        
        let permissionId: string | null = null;
        
        // Check if this was a new permission we just created
        const parts = changeKey.split('-');
        if (parts.length >= 4 && parts[0] === roleId) {
          const [, component, action, statusIdStr] = parts;
          const key = `${component}-${action}-${statusIdStr}`;
          permissionId = createdPermissionIds.get(key) || null;
        } else {
          // Existing permission
          permissionId = parts[1] || null;
        }
        
        if (!permissionId) {
          // Try to find permission ID
          const parts = changeKey.split('-');
          if (parts.length >= 4) {
            const [, component, action, statusIdStr] = parts;
            const statusId = statusIdStr === 'none' ? null : statusIdStr;
            permissionId = getPermissionId(component, action as 'view' | 'create' | 'edit' | 'delete', statusId);
          } else {
            permissionId = parts[1] || null;
          }
        }
        
        if (!permissionId) continue;
        
        const existing = permissionRoles.find(
          pr => pr.roleId === roleId && pr.permissionId === permissionId
        );
        
        try {
          if (shouldHave && !existing) {
            // Add permission
            await apiCall('/api/permission-roles/create/', {
              method: 'POST',
              body: JSON.stringify({
                roleId,
                permissionId,
              }),
            });
          } else if (!shouldHave && existing) {
            // Remove permission
            const perm = permissions.find(p => p.id === permissionId);
            
            // If removing a general contact permission, also remove status permissions
            if (perm && perm.component === 'contacts' && !perm.statusId) {
              const statusPerms = permissionRoles.filter(pr => {
                if (pr.roleId !== roleId) return false;
                const statusPerm = permissions.find(p => p.id === pr.permissionId);
                return statusPerm && 
                       statusPerm.component === 'statuses' && 
                       statusPerm.action === perm.action && 
                       statusPerm.statusId;
              });
              
              for (const statusPerm of statusPerms) {
                await apiCall(`/api/permission-roles/${statusPerm.id}/delete/`, {
                  method: 'DELETE',
                });
              }
            }
            
            await apiCall(`/api/permission-roles/${existing.id}/delete/`, {
              method: 'DELETE',
            });
          }
        } catch (error: any) {
          errors.push(`Erreur lors de la modification de la permission`);
        }
      }
      
      if (errors.length > 0) {
        toast.error(`Erreurs lors de l'enregistrement: ${errors.join(', ')}`);
      } else {
        toast.success('Permissions enregistrées avec succès');
        setPendingPermissionChanges(new Map());
      }
      
      // Reload data to sync with server
      await loadData();
    } catch (error: any) {
      toast.error('Erreur lors de l\'enregistrement des permissions');
      console.error('Error saving permissions:', error);
      // Reload on error to restore correct state
      await loadData();
    } finally {
      setIsSavingPermissions(false);
    }
  }
  
  // Old function kept for reference but replaced by togglePendingPermission
  async function handleToggleComponentPermission(
    roleId: string,
    displayComponentLabel: string,
    action: 'view' | 'create' | 'edit' | 'delete',
    statusId?: string | null
  ) {
    // Convert from UI label to DB component name
    const dbComponentName = getDbComponentName(displayComponentLabel);
    
    // If this is a status permission, check if role has the corresponding general contact permission
    if (dbComponentName === 'statuses' && statusId) {
      // Check if role has the general contact permission for the same action
      const contactPermissionId = getPermissionId('contacts', action);
      const hasContactPermission = hasPermission(roleId, contactPermissionId);
      
      if (!hasContactPermission) {
        const actionLabels: Record<string, string> = {
          view: 'voir',
          create: 'créer',
          edit: 'modifier',
          delete: 'supprimer',
        };
        toast.error(
          `Le rôle doit d'abord avoir la permission "${actionLabels[action]}" pour les contacts avant de pouvoir avoir cette permission pour un statut spécifique`
        );
        return;
      }
    }
    
    const permissionId = getPermissionId(dbComponentName, action, statusId);

    // Permission exists, toggle it
    const existing = permissionRoles.find(
      pr => pr.roleId === roleId && pr.permissionId === permissionId
    );

    // Optimistic update: update UI immediately
    if (existing) {
      // Remove permission optimistically
      setPermissionRoles(prev => prev.filter(pr => pr.id !== existing.id));
      
      // If removing a general contact permission, also remove status permissions optimistically
      if (dbComponentName === 'contacts' && !statusId) {
        const statusPerms = permissionRoles.filter(pr => {
          if (pr.roleId !== roleId) return false;
          const perm = permissions.find(p => p.id === pr.permissionId);
          return perm && perm.component === 'statuses' && perm.action === action && perm.statusId;
        });
        
        if (statusPerms.length > 0) {
          const actionLabels: Record<string, string> = {
            view: 'voir',
            create: 'créer',
            edit: 'modifier',
            delete: 'supprimer',
          };
          toast.warning(
            `Attention : Ce rôle a des permissions "${actionLabels[action]}" pour des statuts spécifiques. ` +
            `Ces permissions seront également retirées car elles nécessitent la permission générale pour les contacts.`
          );
          // Remove status permissions optimistically
          setPermissionRoles(prev => prev.filter(pr => !statusPerms.some(sp => sp.id === pr.id)));
        }
      }
    } else {
      // Add permission optimistically
      // First, check if permission exists, if not we need to create it
      if (!permissionId) {
        // Permission doesn't exist, create it first (no optimistic update here as we need the ID)
        try {
          const newPermission = await apiCall('/api/permissions/create/', {
            method: 'POST',
            body: JSON.stringify({
              component: dbComponentName,
              action,
              fieldName: null,
              statusId: statusId || null,
            }),
          });

          // Add the new permission to permissions list
          setPermissions(prev => [...prev, newPermission]);

          // Create permission role
          const newPermissionRole = await apiCall('/api/permission-roles/create/', {
            method: 'POST',
            body: JSON.stringify({
              roleId,
              permissionId: newPermission.id,
            }),
          });

          // Add optimistically
          setPermissionRoles(prev => [...prev, {
            id: newPermissionRole.id,
            roleId,
            roleName: roles.find(r => r.id === roleId)?.name || '',
            permissionId: newPermission.id,
            permission: newPermission
          }]);

          toast.success(`Permission ${action} ajoutée`);
          // Reload to sync with server
          loadData();
        } catch (error: any) {
          toast.error(error.message || 'Erreur lors de la création de la permission');
          // Reload on error to restore correct state
          loadData();
        }
        return;
      }

      // Permission exists, add it optimistically
      const perm = permissions.find(p => p.id === permissionId);
      if (perm) {
        const role = roles.find(r => r.id === roleId);
        setPermissionRoles(prev => [...prev, {
          id: `temp-${Date.now()}`, // Temporary ID
          roleId,
          roleName: role?.name || '',
          permissionId: permissionId,
          permission: perm
        }]);
      }
    }

    // Now perform the actual API call
    try {
      if (existing) {
        // Remove permission
        // If removing a general contact permission, also remove status permissions
        if (dbComponentName === 'contacts' && !statusId) {
          const statusPerms = permissionRoles.filter(pr => {
            if (pr.roleId !== roleId) return false;
            const perm = permissions.find(p => p.id === pr.permissionId);
            return perm && perm.component === 'statuses' && perm.action === action && perm.statusId;
          });
          
          // Remove all status permissions for this action
          for (const statusPerm of statusPerms) {
            await apiCall(`/api/permission-roles/${statusPerm.id}/delete/`, {
              method: 'DELETE',
            });
          }
        }
        
        await apiCall(`/api/permission-roles/${existing.id}/delete/`, {
          method: 'DELETE',
        });
        toast.success(`Permission ${action} retirée`);
      } else {
        // Add permission
        const response = await apiCall('/api/permission-roles/create/', {
          method: 'POST',
          body: JSON.stringify({
            roleId,
            permissionId,
          }),
        });
        
        // Update with real ID from server
        if (response) {
          setPermissionRoles(prev => {
            const tempIndex = prev.findIndex(pr => 
              pr.roleId === roleId && 
              pr.permissionId === permissionId && 
              pr.id.startsWith('temp-')
            );
            if (tempIndex !== -1) {
              const updated = [...prev];
              updated[tempIndex] = {
                ...updated[tempIndex],
                id: response.id
              };
              return updated;
            }
            return prev;
          });
        }
        
        toast.success(`Permission ${action} ajoutée`);
      }
      // Reload to sync with server (ensures consistency)
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification de la permission');
      // Reload on error to restore correct state
      loadData();
    }
  }

  function getDataAccessLabel(dataAccess: string) {
    const labels: Record<string, string> = {
      all: 'Tous',
      team_only: 'Équipe uniquement',
      own_only: 'Propre uniquement',
    };
    return labels[dataAccess] || dataAccess;
  }

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <>
      <div className="users-teams-action-bar">
        <Button onClick={() => setIsRoleModalOpen(true)}>
          <Plus className="users-teams-icon users-teams-icon-with-margin" />
          Créer un rôle
        </Button>
      </div>

      {/* Create Role Modal */}
      {isRoleModalOpen && (
        <div className="modal-overlay" onClick={() => {
          setIsRoleModalOpen(false);
          setRoleError('');
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Créer un nouveau rôle</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsRoleModalOpen(false);
                  setRoleError('');
                }}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateRole();
              }}
              className="modal-form"
            >
              <div className="modal-form-field">
                <Label htmlFor="role-name">Nom du rôle</Label>
                <Input
                  id="role-name"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="Ex: Gestionnaire"
                  required
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="data-access">Accès aux données</Label>
                <Select
                  value={roleForm.dataAccess}
                  onValueChange={(value: 'all' | 'team_only' | 'own_only') =>
                    setRoleForm({ ...roleForm, dataAccess: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="team_only">Équipe uniquement</SelectItem>
                    <SelectItem value="own_only">Propre uniquement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-field">
                <Label htmlFor="is-teleoperateur">Téléopérateur</Label>
                <Select
                  value={roleForm.isTeleoperateur ? 'yes' : 'no'}
                  onValueChange={(value) =>
                    setRoleForm({ ...roleForm, isTeleoperateur: value === 'yes' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Oui</SelectItem>
                    <SelectItem value="no">Non</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-field">
                <Label htmlFor="is-confirmateur">Confirmateur</Label>
                <Select
                  value={roleForm.isConfirmateur ? 'yes' : 'no'}
                  onValueChange={(value) =>
                    setRoleForm({ ...roleForm, isConfirmateur: value === 'yes' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Oui</SelectItem>
                    <SelectItem value="no">Non</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {roleError && (
                <div className="bg-red-50 text-red-600 px-4 py-2 text-sm">
                  {roleError}
                </div>
              )}
              {roleLoading && <LoadingIndicator />}
              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsRoleModalOpen(false);
                    setRoleError('');
                  }}
                  disabled={roleLoading}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={roleLoading}>
                  {roleLoading ? 'Création...' : 'Créer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {isEditRoleModalOpen && selectedRole && (
        <div className="modal-overlay" onClick={() => {
          setIsEditRoleModalOpen(false);
          setRoleError('');
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Modifier le rôle</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsEditRoleModalOpen(false);
                  setRoleError('');
                }}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateRole();
              }}
              className="modal-form"
            >
              <div className="modal-form-field">
                <Label htmlFor="edit-role-name">Nom du rôle</Label>
                <Input
                  id="edit-role-name"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="Ex: Gestionnaire"
                  required
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="edit-data-access">Accès aux données</Label>
                <Select
                  value={roleForm.dataAccess}
                  onValueChange={(value: 'all' | 'team_only' | 'own_only') =>
                    setRoleForm({ ...roleForm, dataAccess: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="team_only">Équipe uniquement</SelectItem>
                    <SelectItem value="own_only">Propre uniquement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-field">
                <Label htmlFor="edit-is-teleoperateur">Téléopérateur</Label>
                <Select
                  value={roleForm.isTeleoperateur ? 'yes' : 'no'}
                  onValueChange={(value) =>
                    setRoleForm({ ...roleForm, isTeleoperateur: value === 'yes' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Oui</SelectItem>
                    <SelectItem value="no">Non</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-field">
                <Label htmlFor="edit-is-confirmateur">Confirmateur</Label>
                <Select
                  value={roleForm.isConfirmateur ? 'yes' : 'no'}
                  onValueChange={(value) =>
                    setRoleForm({ ...roleForm, isConfirmateur: value === 'yes' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Oui</SelectItem>
                    <SelectItem value="no">Non</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {roleError && (
                <div className="bg-red-50 text-red-600 px-4 py-2 text-sm">
                  {roleError}
                </div>
              )}
              {roleLoading && <LoadingIndicator />}
              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditRoleModalOpen(false);
                    setRoleError('');
                  }}
                  disabled={roleLoading}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={roleLoading}>
                  {roleLoading ? 'Mise à jour...' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Roles and Permissions Side by Side */}
      <div className="grid grid-cols-2 gap-6">
        {/* Roles List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Rôles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {roles.length === 0 ? (
              <p className="text-slate-500">Aucun rôle créé</p>
            ) : (
              <div className="space-y-2">
                {roles.map((role) => {
                  const isSelected = selectedRoleForPermissions?.id === role.id;
                  return (
                    <div
                      key={role.id}
                      className={`flex items-center justify-between p-4 border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-blue-300'
                          : 'hover:bg-slate-50'
                      }`}
                      onClick={() => setSelectedRoleForPermissions(role)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{role.name}</h3>
                          <Badge variant="outline">
                            {getDataAccessLabel(role.dataAccess)}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          {permissionRoles.filter(pr => pr.roleId === role.id).length} permission(s) assignée(s)
                        </p>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRole(role)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRole(role.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Permissions Management */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedRoleForPermissions
                ? `Permissions pour: ${selectedRoleForPermissions.name}`
                : 'Sélectionnez un rôle'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedRoleForPermissions ? (
              <p className="text-slate-500">Sélectionnez un rôle pour gérer ses permissions</p>
            ) : (
              <div className="space-y-6">
                {/* Pages Permissions Table */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Pages</h3>
                  <div className="border overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="text-left p-3 font-semibold">Page</th>
                          <th 
                            className="text-center p-3 font-semibold cursor-pointer hover:bg-slate-200 transition-colors"
                            onClick={() => toggleAllPagesColumn('view')}
                            title="Cliquer pour cocher/décocher toutes les cases de cette colonne"
                          >
                            Voir
                          </th>
                          <th 
                            className="text-center p-3 font-semibold cursor-pointer hover:bg-slate-200 transition-colors"
                            onClick={() => toggleAllPagesColumn('create')}
                            title="Cliquer pour cocher/décocher toutes les cases de cette colonne"
                          >
                            Créer
                          </th>
                          <th 
                            className="text-center p-3 font-semibold cursor-pointer hover:bg-slate-200 transition-colors"
                            onClick={() => toggleAllPagesColumn('edit')}
                            title="Cliquer pour cocher/décocher toutes les cases de cette colonne"
                          >
                            Modifier
                          </th>
                          <th 
                            className="text-center p-3 font-semibold cursor-pointer hover:bg-slate-200 transition-colors"
                            onClick={() => toggleAllPagesColumn('delete')}
                            title="Cliquer pour cocher/décocher toutes les cases de cette colonne"
                          >
                            Supprimer
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {getUniqueDbComponents().map((dbComponent) => {
                          const displayLabel = getDisplayComponentLabel(dbComponent);
                          const viewPermissionId = getPermissionId(dbComponent, 'view');
                          const createPermissionId = getPermissionId(dbComponent, 'create');
                          const editPermissionId = getPermissionId(dbComponent, 'edit');
                          const deletePermissionId = getPermissionId(dbComponent, 'delete');
                          const hasView = hasPermission(selectedRoleForPermissions.id, viewPermissionId);
                          const hasCreate = hasPermission(selectedRoleForPermissions.id, createPermissionId);
                          const hasEdit = hasPermission(selectedRoleForPermissions.id, editPermissionId);
                          const hasDelete = hasPermission(selectedRoleForPermissions.id, deletePermissionId);
                          
                          // Dashboard only has view permission
                          const isDashboard = dbComponent === 'dashboard';

                          return (
                            <tr key={dbComponent} className="border-b hover:bg-slate-50">
                              <td className="p-3 font-medium">{displayLabel}</td>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={hasView}
                                  onChange={() =>
                                    togglePendingPermission(selectedRoleForPermissions.id, displayLabel, 'view')
                                  }
                                  className="w-4 h-4 cursor-pointer"
                                />
                              </td>
                              <td className="p-3 text-center">
                                {!isDashboard && (
                                  <input
                                    type="checkbox"
                                    checked={hasCreate}
                                    onChange={() =>
                                      togglePendingPermission(selectedRoleForPermissions.id, displayLabel, 'create')
                                    }
                                    className="w-4 h-4 cursor-pointer"
                                  />
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {!isDashboard && (
                                  <input
                                    type="checkbox"
                                    checked={hasEdit}
                                    onChange={() =>
                                      togglePendingPermission(selectedRoleForPermissions.id, displayLabel, 'edit')
                                    }
                                    className="w-4 h-4 cursor-pointer"
                                  />
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {!isDashboard && (
                                  <input
                                    type="checkbox"
                                    checked={hasDelete}
                                    onChange={() =>
                                      togglePendingPermission(selectedRoleForPermissions.id, displayLabel, 'delete')
                                    }
                                    className="w-4 h-4 cursor-pointer"
                                  />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Status Permissions Table */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Statuts</h3>
                  {statuses.length === 0 ? (
                    <p className="text-slate-500">Aucun statut disponible</p>
                  ) : (
                    <div className="border overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="text-left p-3 font-semibold">Statut</th>
                            <th 
                              className="text-center p-3 font-semibold cursor-pointer hover:bg-slate-200 transition-colors"
                              onClick={() => toggleAllStatusColumn('view')}
                              title="Cliquer pour cocher/décocher toutes les cases de cette colonne"
                            >
                              Voir
                            </th>
                            <th 
                              className="text-center p-3 font-semibold cursor-pointer hover:bg-slate-200 transition-colors"
                              onClick={() => toggleAllStatusColumn('create')}
                              title="Cliquer pour cocher/décocher toutes les cases de cette colonne"
                            >
                              Créer
                            </th>
                            <th 
                              className="text-center p-3 font-semibold cursor-pointer hover:bg-slate-200 transition-colors"
                              onClick={() => toggleAllStatusColumn('edit')}
                              title="Cliquer pour cocher/décocher toutes les cases de cette colonne"
                            >
                              Modifier
                            </th>
                            <th 
                              className="text-center p-3 font-semibold cursor-pointer hover:bg-slate-200 transition-colors"
                              onClick={() => toggleAllStatusColumn('delete')}
                              title="Cliquer pour cocher/décocher toutes les cases de cette colonne"
                            >
                              Supprimer
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {statuses.map((status) => {
                            const viewPermissionId = getPermissionId('statuses', 'view', status.id);
                            const createPermissionId = getPermissionId('statuses', 'create', status.id);
                            const editPermissionId = getPermissionId('statuses', 'edit', status.id);
                            const deletePermissionId = getPermissionId('statuses', 'delete', status.id);
                            const hasView = hasPermission(selectedRoleForPermissions.id, viewPermissionId);
                            const hasCreate = hasPermission(selectedRoleForPermissions.id, createPermissionId);
                            const hasEdit = hasPermission(selectedRoleForPermissions.id, editPermissionId);
                            const hasDelete = hasPermission(selectedRoleForPermissions.id, deletePermissionId);
                            
                            // Check if role has general contact permissions
                            const contactViewPermissionId = getPermissionId('contacts', 'view');
                            const contactCreatePermissionId = getPermissionId('contacts', 'create');
                            const contactEditPermissionId = getPermissionId('contacts', 'edit');
                            const contactDeletePermissionId = getPermissionId('contacts', 'delete');
                            const hasContactView = hasPermission(selectedRoleForPermissions.id, contactViewPermissionId);
                            const hasContactCreate = hasPermission(selectedRoleForPermissions.id, contactCreatePermissionId);
                            const hasContactEdit = hasPermission(selectedRoleForPermissions.id, contactEditPermissionId);
                            const hasContactDelete = hasPermission(selectedRoleForPermissions.id, contactDeletePermissionId);

                            return (
                              <tr key={status.id} className="border-b hover:bg-slate-50">
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: status.color || '#e5e7eb' }}
                                    />
                                    <span className="font-medium">{status.name}</span>
                                    <Badge variant="outline" className="ml-2">
                                      {status.type === 'lead' ? 'Lead' : 'Client'}
                                    </Badge>
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasView}
                                    disabled={!hasContactView}
                                    onChange={() =>
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Statuts', 'view', status.id)
                                    }
                                    className={`w-4 h-4 ${!hasContactView ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    title={!hasContactView ? 'Le rôle doit d\'abord avoir la permission "Voir" pour les contacts' : ''}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasCreate}
                                    disabled={!hasContactCreate}
                                    onChange={() =>
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Statuts', 'create', status.id)
                                    }
                                    className={`w-4 h-4 ${!hasContactCreate ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    title={!hasContactCreate ? 'Le rôle doit d\'abord avoir la permission "Créer" pour les contacts' : ''}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasEdit}
                                    disabled={!hasContactEdit}
                                    onChange={() =>
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Statuts', 'edit', status.id)
                                    }
                                    className={`w-4 h-4 ${!hasContactEdit ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    title={!hasContactEdit ? 'Le rôle doit d\'abord avoir la permission "Modifier" pour les contacts' : ''}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasDelete}
                                    disabled={!hasContactDelete}
                                    onChange={() =>
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Statuts', 'delete', status.id)
                                    }
                                    className={`w-4 h-4 ${!hasContactDelete ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    title={!hasContactDelete ? 'Le rôle doit d\'abord avoir la permission "Supprimer" pour les contacts' : ''}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                
                {/* Save button */}
                {pendingPermissionChanges.size > 0 && (
                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      onClick={handleSavePermissions}
                      disabled={isSavingPermissions}
                    >
                      {isSavingPermissions ? 'Enregistrement...' : `Enregistrer (${pendingPermissionChanges.size} modification${pendingPermissionChanges.size > 1 ? 's' : ''})`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default PermissionsTab;

