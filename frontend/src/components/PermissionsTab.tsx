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
  fosse: 'Fosse',
  users: 'Utilisateurs',
  teams: 'Équipes',
  planning: 'Planning',
  permissions: 'Permissions (Paramètres)',
  statuses: 'Statuts (Paramètres)',
  'note_categories': 'Fiche contact (Paramètres)',
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

interface NoteCategory {
  id: string;
  name: string;
  orderIndex: number;
}

export function PermissionsTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionRoles, setPermissionRoles] = useState<PermissionRole[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [noteCategories, setNoteCategories] = useState<NoteCategory[]>([]);
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
      const [rolesData, permissionsData, permissionRolesData, statusesData, categoriesData] = await Promise.all([
        apiCall('/api/roles/'),
        apiCall('/api/permissions/'),
        apiCall('/api/permission-roles/'),
        apiCall('/api/statuses/'),
        apiCall('/api/note-categories/'),
      ]);

      setRoles(rolesData.roles || []);
      setPermissions(permissionsData.permissions || []);
      setPermissionRoles(permissionRolesData.permissionRoles || []);
      setStatuses(statusesData.statuses || []);
      const sortedCategories = (categoriesData.categories || []).sort((a: NoteCategory, b: NoteCategory) => 
        a.orderIndex - b.orderIndex
      );
      setNoteCategories(sortedCategories);
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
    'fosse',
    'users',
    'teams',
    'planning',
    'permissions',
    'statuses',
    'note_categories',
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
  // Exclude: events, note, notes, settings
  const excludedComponents = ['events', 'note', 'notes', 'settings'];
  
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
  function getPermissionId(dbComponentName: string, action: 'view' | 'create' | 'edit' | 'delete', statusId?: string | null, categoryId?: string | null): string | null {
    const perm = permissions.find(
      p => p.component === dbComponentName &&
           p.action === action &&
           (categoryId 
             ? p.fieldName === categoryId && !p.statusId  // Category permission: fieldName contains category ID
             : statusId 
               ? p.statusId === statusId && !p.fieldName  // Status permission: statusId contains status ID
               : !p.fieldName && !p.statusId)  // General permission: no fieldName or statusId
    );
    return perm?.id || null;
  }

  // Check if a role has a specific permission (including pending changes)
  function hasPermission(roleId: string, permissionId: string | null, component?: string, action?: string, statusId?: string | null, categoryId?: string | null): boolean {
    // Check pending changes first
    if (permissionId) {
      const changeKey = `${roleId}-${permissionId}`;
      const pendingChange = pendingPermissionChanges.get(changeKey);
      if (pendingChange !== undefined) {
        return pendingChange;
      }
    }
    
    // Also check for new permissions in pending changes (format: roleId-component-action-statusId/categoryId)
    if (component && action) {
      let newPermissionKey: string;
      if (categoryId) {
        newPermissionKey = `${roleId}-${component}-${action}-category-${categoryId}`;
      } else {
        newPermissionKey = `${roleId}-${component}-${action}-${statusId || 'none'}`;
      }
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
    statusId?: string | null,
    categoryId?: string | null
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
    
    // Note category permissions are independent - no need to check for general permission
    
    const permissionId = getPermissionId(dbComponentName, action, statusId, categoryId);
    
    // Use different key format for new vs existing permissions
    let changeKey: string;
    if (!permissionId) {
      // Permission doesn't exist yet, use component-action-statusId/categoryId format
      if (categoryId) {
        changeKey = `${roleId}-${dbComponentName}-${action}-category-${categoryId}`;
      } else {
        changeKey = `${roleId}-${dbComponentName}-${action}-${statusId || 'none'}`;
      }
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

  // Toggle all permissions in a row for Pages table
  function toggleAllRowPermissions(displayComponentLabel: string) {
    if (!selectedRoleForPermissions) return;
    
    const dbComponentName = getDbComponentName(displayComponentLabel);
    const roleId = selectedRoleForPermissions.id;
    const isDashboard = dbComponentName === 'dashboard';
    
    // Get current state of all permissions for this component
    const viewPermissionId = getPermissionId(dbComponentName, 'view');
    const createPermissionId = getPermissionId(dbComponentName, 'create');
    const editPermissionId = getPermissionId(dbComponentName, 'edit');
    const deletePermissionId = getPermissionId(dbComponentName, 'delete');
    
    const hasView = hasPermission(roleId, viewPermissionId, dbComponentName, 'view');
    const hasCreate = hasPermission(roleId, createPermissionId, dbComponentName, 'create');
    const hasEdit = hasPermission(roleId, editPermissionId, dbComponentName, 'edit');
    const hasDelete = hasPermission(roleId, deletePermissionId, dbComponentName, 'delete');
    
    // Check if all permissions are selected (for dashboard, only view matters)
    const allSelected = isDashboard ? hasView : (hasView && hasCreate && hasEdit && hasDelete);
    
    // Toggle all permissions: if all selected, unselect all; otherwise select all
    const actions: Array<'view' | 'create' | 'edit' | 'delete'> = isDashboard 
      ? ['view'] 
      : ['view', 'create', 'edit', 'delete'];
    
    setPendingPermissionChanges(prev => {
      const newMap = new Map(prev);
      
      for (const action of actions) {
        const permissionId = getPermissionId(dbComponentName, action);
        let changeKey: string;
        if (!permissionId) {
          changeKey = `${roleId}-${dbComponentName}-${action}-none`;
        } else {
          changeKey = `${roleId}-${permissionId}`;
        }
        
        // Set to opposite of allSelected state
        newMap.set(changeKey, !allSelected);
      }
      
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

  // Toggle all permissions in a row for Status table
  function toggleAllStatusRowPermissions(statusId: string) {
    if (!selectedRoleForPermissions) return;
    
    const roleId = selectedRoleForPermissions.id;
    
    // Check if role has the corresponding general contact permission
    const contactViewPermissionId = getPermissionId('contacts', 'view');
    const hasContactView = hasPermission(roleId, contactViewPermissionId);
    
    if (!hasContactView) {
      toast.error(
        'Le rôle doit d\'abord avoir la permission "voir" pour les contacts avant de pouvoir avoir cette permission pour un statut spécifique'
      );
      return;
    }
    
    // Get current state of all permissions for this status
    const viewPermissionId = getPermissionId('statuses', 'view', statusId);
    const createPermissionId = getPermissionId('statuses', 'create', statusId);
    const editPermissionId = getPermissionId('statuses', 'edit', statusId);
    const deletePermissionId = getPermissionId('statuses', 'delete', statusId);
    
    const hasView = hasPermission(roleId, viewPermissionId, 'statuses', 'view', statusId);
    const hasCreate = hasPermission(roleId, createPermissionId, 'statuses', 'create', statusId);
    const hasEdit = hasPermission(roleId, editPermissionId, 'statuses', 'edit', statusId);
    const hasDelete = hasPermission(roleId, deletePermissionId, 'statuses', 'delete', statusId);
    
    // Check if all permissions are selected
    const allSelected = hasView && hasCreate && hasEdit && hasDelete;
    
    // Toggle all permissions
    const actions: Array<'view' | 'create' | 'edit' | 'delete'> = ['view', 'create', 'edit', 'delete'];
    
    setPendingPermissionChanges(prev => {
      const newMap = new Map(prev);
      
      for (const action of actions) {
        const permissionId = getPermissionId('statuses', action, statusId);
        let changeKey: string;
        if (!permissionId) {
          changeKey = `${roleId}-statuses-${action}-${statusId}`;
        } else {
          changeKey = `${roleId}-${permissionId}`;
        }
        
        // Set to opposite of allSelected state
        newMap.set(changeKey, !allSelected);
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

  // Toggle all permissions in a row for Note Category table
  function toggleAllNoteCategoryRowPermissions(categoryId: string) {
    if (!selectedRoleForPermissions) return;
    
    const roleId = selectedRoleForPermissions.id;
    
    // Get current state of all permissions for this category
    const viewPermissionId = getPermissionId('note_categories', 'view', null, categoryId);
    const createPermissionId = getPermissionId('note_categories', 'create', null, categoryId);
    const editPermissionId = getPermissionId('note_categories', 'edit', null, categoryId);
    const deletePermissionId = getPermissionId('note_categories', 'delete', null, categoryId);
    
    const hasView = hasPermission(roleId, viewPermissionId, 'note_categories', 'view', null, categoryId);
    const hasCreate = hasPermission(roleId, createPermissionId, 'note_categories', 'create', null, categoryId);
    const hasEdit = hasPermission(roleId, editPermissionId, 'note_categories', 'edit', null, categoryId);
    const hasDelete = hasPermission(roleId, deletePermissionId, 'note_categories', 'delete', null, categoryId);
    
    // Check if all permissions are selected
    const allSelected = hasView && hasCreate && hasEdit && hasDelete;
    
    // Toggle all permissions
    const actions: Array<'view' | 'create' | 'edit' | 'delete'> = ['view', 'create', 'edit', 'delete'];
    
    setPendingPermissionChanges(prev => {
      const newMap = new Map(prev);
      
      for (const action of actions) {
        const permissionId = getPermissionId('note_categories', action, null, categoryId);
        let changeKey: string;
        if (!permissionId) {
          changeKey = `${roleId}-note_categories-${action}-category-${categoryId}`;
        } else {
          changeKey = `${roleId}-${permissionId}`;
        }
        
        // Set to opposite of allSelected state
        newMap.set(changeKey, !allSelected);
      }
      
      return newMap;
    });
  }

  // Toggle all permissions in a column for Note Category table
  function toggleAllNoteCategoryColumn(action: 'view' | 'create' | 'edit' | 'delete') {
    if (!selectedRoleForPermissions) return;
    
    const roleId = selectedRoleForPermissions.id;
    
    // Check if all are currently checked
    let allChecked = true;
    for (const category of noteCategories) {
      const permissionId = getPermissionId('note_categories', action, null, category.id);
      const hasPerm = hasPermission(roleId, permissionId);
      
      if (!hasPerm) {
        allChecked = false;
        break;
      }
    }
    
    // Batch all updates in a single state update
    setPendingPermissionChanges(prev => {
      const newMap = new Map(prev);
      
      // Toggle all categories
      for (const category of noteCategories) {
        const permissionId = getPermissionId('note_categories', action, null, category.id);
        
        let changeKey: string;
        if (!permissionId) {
          changeKey = `${roleId}-note_categories-${action}-category-${category.id}`;
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
      const permissionsToCreate: Array<{component: string, action: string, statusId: string | null, categoryId: string | null}> = [];
      const processedKeys = new Set<string>();
      
      for (const [changeKey, shouldHave] of pendingPermissionChanges.entries()) {
        // Check if this is a new permission (format: roleId-component-action-statusId or roleId-component-action-category-categoryId)
        // Note: component might be 'note_categories' which contains underscore, so we need to handle splitting carefully
        if (!changeKey.startsWith(`${roleId}-`)) continue;
        
        const afterRoleId = changeKey.substring(roleId.length + 1); // Everything after "roleId-"
        const parts = afterRoleId.split('-');
        
        if (parts.length >= 3) {
          // Handle components with underscores (like 'note_categories')
          let component: string;
          let action: string;
          let rest: string[];
          
          // Check if first part is 'note' and second is 'categories' (for note_categories)
          if (parts[0] === 'note' && parts[1] === 'categories') {
            component = 'note_categories';
            action = parts[2];
            rest = parts.slice(3);
          } else {
            // Regular component (single word)
            component = parts[0];
            action = parts[1];
            rest = parts.slice(2);
          }
          
          let statusId: string | null = null;
          let categoryId: string | null = null;
          
          // Check if it's a category permission (format: ...-category-categoryId)
          if (rest.length >= 2 && rest[0] === 'category') {
            categoryId = rest.slice(1).join('-'); // Join in case categoryId has hyphens
          } else if (rest.length > 0) {
            // It's a status permission (format: ...-statusId)
            const statusIdStr = rest.join('-'); // Join in case statusId has hyphens
            statusId = statusIdStr === 'none' ? null : statusIdStr;
          }
          
          if (shouldHave) {
            permissionsToCreate.push({ component, action, statusId, categoryId });
          }
          processedKeys.add(changeKey);
        }
      }
      
      // Create new permissions first
      const createdPermissionIds: Map<string, string> = new Map();
      for (const { component, action, statusId, categoryId } of permissionsToCreate) {
        try {
          const payload: any = {
            component,
            action,
            fieldName: categoryId || null, // Use fieldName for category ID
            statusId: statusId || null, // Use statusId for status ID
          };
          
          const newPermission = await apiCall('/api/permissions/create/', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          
          // Create unique key for both status and category permissions
          let key: string;
          if (categoryId) {
            key = `${component}-${action}-category-${categoryId}`;
          } else {
            key = `${component}-${action}-${statusId || 'none'}`;
          }
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
        // Format: roleId-component-action-statusId/category or roleId-permissionId
        const afterRoleId = changeKey.substring(roleId.length + 1);
        
        // Check if it's an existing permission (format: roleId-permissionId)
        // Existing permissions have format "roleId-{12charId}" where ID doesn't contain hyphens
        const existingParts = afterRoleId.split('-');
        if (existingParts.length === 1 && existingParts[0].length === 12) {
          // This is an existing permission ID
          permissionId = existingParts[0];
        } else {
          // This is a new permission (format: component-action-statusId/category)
          const parts = afterRoleId.split('-');
          
          if (parts.length >= 2) {
            // Handle components with underscores (like 'note_categories')
            let component: string;
            let action: string;
            let rest: string[];
            
            // Check if first part is 'note' and second is 'categories' (for note_categories)
            // When note_categories is split by '-', it stays as 'note_categories' (underscore preserved)
            // So we need to check if parts[0] contains underscore
            if (parts[0].includes('_')) {
              // Component has underscore (e.g., 'note_categories')
              component = parts[0];
              action = parts[1];
              rest = parts.slice(2);
            } else if (parts[0] === 'note' && parts[1] === 'categories') {
              // Component was split: 'note' and 'categories'
              component = 'note_categories';
              action = parts[2];
              rest = parts.slice(3);
            } else {
              // Regular component (single word)
              component = parts[0];
              action = parts[1];
              rest = parts.slice(2);
            }
            
            let key: string;
            
            // Check if it's a category permission
            if (rest.length >= 2 && rest[0] === 'category') {
              const categoryId = rest.slice(1).join('-');
              key = `${component}-${action}-category-${categoryId}`;
            } else {
              // It's a status permission or general permission
              const statusIdStr = rest.join('-') || 'none';
              key = `${component}-${action}-${statusIdStr}`;
            }
            permissionId = createdPermissionIds.get(key) || null;
            
            // If not found in created permissions, try to find existing permission
            if (!permissionId) {
              let statusId: string | null = null;
              let categoryId: string | null = null;
              
              // Check if it's a category permission
              if (rest.length >= 2 && rest[0] === 'category') {
                categoryId = rest.slice(1).join('-');
              } else if (rest.length > 0) {
                // It's a status permission
                const statusIdStr = rest.join('-');
                statusId = statusIdStr === 'none' ? null : statusIdStr;
              }
              permissionId = getPermissionId(component, action as 'view' | 'create' | 'edit' | 'delete', statusId, categoryId);
            }
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
                          const hasView = hasPermission(selectedRoleForPermissions.id, viewPermissionId, dbComponent, 'view');
                          const hasCreate = hasPermission(selectedRoleForPermissions.id, createPermissionId, dbComponent, 'create');
                          const hasEdit = hasPermission(selectedRoleForPermissions.id, editPermissionId, dbComponent, 'edit');
                          const hasDelete = hasPermission(selectedRoleForPermissions.id, deletePermissionId, dbComponent, 'delete');
                          
                          // Dashboard only has view permission
                          const isDashboard = dbComponent === 'dashboard';

                          return (
                            <tr key={dbComponent} className="border-b hover:bg-slate-50">
                              <td 
                                className="p-3 font-medium cursor-pointer hover:text-blue-600"
                                onClick={() => toggleAllRowPermissions(displayLabel)}
                                title="Cliquer pour sélectionner/désélectionner toute la ligne"
                              >
                                {displayLabel}
                              </td>
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
                            const hasView = hasPermission(selectedRoleForPermissions.id, viewPermissionId, 'statuses', 'view', status.id);
                            const hasCreate = hasPermission(selectedRoleForPermissions.id, createPermissionId, 'statuses', 'create', status.id);
                            const hasEdit = hasPermission(selectedRoleForPermissions.id, editPermissionId, 'statuses', 'edit', status.id);
                            const hasDelete = hasPermission(selectedRoleForPermissions.id, deletePermissionId, 'statuses', 'delete', status.id);
                            
                            // Check if role has general contact permissions
                            const contactViewPermissionId = getPermissionId('contacts', 'view');
                            const contactCreatePermissionId = getPermissionId('contacts', 'create');
                            const contactEditPermissionId = getPermissionId('contacts', 'edit');
                            const contactDeletePermissionId = getPermissionId('contacts', 'delete');
                            const hasContactView = hasPermission(selectedRoleForPermissions.id, contactViewPermissionId, 'contacts', 'view');
                            const hasContactCreate = hasPermission(selectedRoleForPermissions.id, contactCreatePermissionId, 'contacts', 'create');
                            const hasContactEdit = hasPermission(selectedRoleForPermissions.id, contactEditPermissionId, 'contacts', 'edit');
                            const hasContactDelete = hasPermission(selectedRoleForPermissions.id, contactDeletePermissionId, 'contacts', 'delete');

                            return (
                              <tr key={status.id} className="border-b hover:bg-slate-50">
                                <td 
                                  className="p-3 cursor-pointer hover:text-blue-600"
                                  onClick={() => toggleAllStatusRowPermissions(status.id)}
                                  title="Cliquer pour sélectionner/désélectionner toute la ligne"
                                >
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

                {/* Note Category Permissions Table */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Catégories de notes</h3>
                  {noteCategories.length === 0 ? (
                    <p className="text-slate-500">Aucune catégorie de notes disponible</p>
                  ) : (
                    <div className="border overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="text-left p-3 font-semibold">Catégorie</th>
                            <th 
                              className="text-center p-3 font-semibold cursor-pointer hover:bg-slate-200 transition-colors"
                              onClick={() => toggleAllNoteCategoryColumn('view')}
                              title="Cliquer pour cocher/décocher toutes les cases de cette colonne"
                            >
                              Voir
                            </th>
                            <th 
                              className="text-center p-3 font-semibold cursor-pointer hover:bg-slate-200 transition-colors"
                              onClick={() => toggleAllNoteCategoryColumn('create')}
                              title="Cliquer pour cocher/décocher toutes les cases de cette colonne"
                            >
                              Créer
                            </th>
                            <th 
                              className="text-center p-3 font-semibold cursor-pointer hover:bg-slate-200 transition-colors"
                              onClick={() => toggleAllNoteCategoryColumn('edit')}
                              title="Cliquer pour cocher/décocher toutes les cases de cette colonne"
                            >
                              Modifier
                            </th>
                            <th 
                              className="text-center p-3 font-semibold cursor-pointer hover:bg-slate-200 transition-colors"
                              onClick={() => toggleAllNoteCategoryColumn('delete')}
                              title="Cliquer pour cocher/décocher toutes les cases de cette colonne"
                            >
                              Supprimer
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {noteCategories.map((category) => {
                            const viewPermissionId = getPermissionId('note_categories', 'view', null, category.id);
                            const createPermissionId = getPermissionId('note_categories', 'create', null, category.id);
                            const editPermissionId = getPermissionId('note_categories', 'edit', null, category.id);
                            const deletePermissionId = getPermissionId('note_categories', 'delete', null, category.id);
                            const hasView = hasPermission(selectedRoleForPermissions.id, viewPermissionId, 'note_categories', 'view', null, category.id);
                            const hasCreate = hasPermission(selectedRoleForPermissions.id, createPermissionId, 'note_categories', 'create', null, category.id);
                            const hasEdit = hasPermission(selectedRoleForPermissions.id, editPermissionId, 'note_categories', 'edit', null, category.id);
                            const hasDelete = hasPermission(selectedRoleForPermissions.id, deletePermissionId, 'note_categories', 'delete', null, category.id);

                            return (
                              <tr key={category.id} className="border-b hover:bg-slate-50">
                                <td 
                                  className="p-3 cursor-pointer hover:text-blue-600"
                                  onClick={() => toggleAllNoteCategoryRowPermissions(category.id)}
                                  title="Cliquer pour sélectionner/désélectionner toute la ligne"
                                >
                                  <span className="font-medium">{category.name}</span>
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasView}
                                    onChange={() =>
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact (Paramètres)', 'view', null, category.id)
                                    }
                                    className="w-4 h-4 cursor-pointer"
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasCreate}
                                    onChange={() =>
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact (Paramètres)', 'create', null, category.id)
                                    }
                                    className="w-4 h-4 cursor-pointer"
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasEdit}
                                    onChange={() =>
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact (Paramètres)', 'edit', null, category.id)
                                    }
                                    className="w-4 h-4 cursor-pointer"
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasDelete}
                                    onChange={() =>
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact (Paramètres)', 'delete', null, category.id)
                                    }
                                    className="w-4 h-4 cursor-pointer"
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

