import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Pencil, Trash2, Shield, X, ChevronDown, ChevronUp } from 'lucide-react';
import { apiCall } from '../utils/api';
import { handleModalOverlayClick } from '../utils/modal';
import { toast } from 'sonner';
import LoadingIndicator from './LoadingIndicator';
import { useUser } from '../contexts/UserContext';
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
  planning_administrateur: 'Planning Administrateur',
  permissions: 'Permissions (Paramètres)',
  statuses: 'Statuts (Paramètres)',
  fosse_statuses: 'Statuts Fosse (Paramètres)',
  'note_categories': 'Fiche contact (Paramètres)',
  'fiche_contact': 'Details du contact',
  'contact_tabs': 'Fiche contact',
  notifications: 'Notifications (Paramètres)',
  mails: 'Mails',
  other: 'Autres permissions',
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

// Contact field names and their display labels
const contactFields = [
  { field: 'civility', label: 'Civilité' },
  { field: 'fname', label: 'Prénom' },
  { field: 'lname', label: 'Nom' },
  { field: 'phone', label: 'Téléphone 1' },
  { field: 'mobile', label: 'Telephone 2' },
  { field: 'email', label: 'Email' },
  { field: 'birth_date', label: 'Date de naissance' },
  { field: 'birth_place', label: 'Lieu de naissance' },
  { field: 'address', label: 'Adresse' },
  { field: 'address_complement', label: 'Complément d\'adresse' },
  { field: 'postal_code', label: 'Code postal' },
  { field: 'city', label: 'Ville' },
  { field: 'nationality', label: 'Nationalité' },
  { field: 'date_d_inscription', label: 'Date d\'inscription' },
  { field: 'autre_informations', label: 'Autre informations' },
  { field: 'campaign', label: 'Campagne' },
  { field: 'status', label: 'Statut' },
  { field: 'source', label: 'Source' },
  { field: 'teleoperator', label: 'Téléopérateur' },
  { field: 'confirmateur', label: 'Confirmateur' },
  { field: 'confirmateur_email', label: 'Mail Confirmateur' },
  { field: 'confirmateur_telephone', label: 'Téléphone Confirmateur' },
  { field: 'platform', label: 'Plateforme' },
  { field: 'montant_encaisse', label: 'Montant encaissé' },
  { field: 'bonus', label: 'Bonus' },
  { field: 'paiement', label: 'Paiement' },
  { field: 'contrat', label: 'Contrat' },
  { field: 'nom_de_scene', label: 'Nom de scène' },
  { field: 'date_pro_tr', label: 'Date Pro TR' },
  { field: 'potentiel', label: 'Potentiel' },
  { field: 'produit', label: 'Produit' },
];

export function PermissionsTab() {
  const { currentUser, refreshUser } = useUser();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionRoles, setPermissionRoles] = useState<PermissionRole[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [noteCategories, setNoteCategories] = useState<NoteCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState({
    roles: false,
    permissions: false,
    statuses: false,
    noteCategories: false,
  });
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
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    pages: false,
    statuses: false,
    fosseStatuses: false,
    noteCategories: false,
    ficheContact: false,
    contactTabs: false,
    otherPermissions: false,
  });

  // Check current user permissions (same logic as useHasStatusesPermission)
  const canViewPermissions = React.useMemo(() => {
    if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
      return false;
    }
    return currentUser.permissions.some((perm: any) => {
      return perm.component === 'permissions' && 
             perm.action === 'view' && 
             !perm.fieldName &&
             !perm.statusId;
    });
  }, [currentUser]);

  const canCreatePermissions = React.useMemo(() => {
    if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
      return false;
    }
    return currentUser.permissions.some((perm: any) => {
      return perm.component === 'permissions' && 
             perm.action === 'create' && 
             !perm.fieldName &&
             !perm.statusId;
    });
  }, [currentUser]);

  const canEditPermissions = React.useMemo(() => {
    if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
      return false;
    }
    return currentUser.permissions.some((perm: any) => {
      return perm.component === 'permissions' && 
             perm.action === 'edit' && 
             !perm.fieldName &&
             !perm.statusId;
    });
  }, [currentUser]);

  const canDeletePermissions = React.useMemo(() => {
    if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
      return false;
    }
    return currentUser.permissions.some((perm: any) => {
      return perm.component === 'permissions' && 
             perm.action === 'delete' && 
             !perm.fieldName &&
             !perm.statusId;
    });
  }, [currentUser]);

  useEffect(() => {
    loadEssentialData();
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

  // Load essential data (roles, permissions) on mount
  async function loadEssentialData() {
    setLoading(true);
    try {
      const [rolesData, permissionsData, permissionRolesData] = await Promise.all([
        apiCall('/api/roles/'),
        apiCall('/api/permissions/'),
        apiCall('/api/permission-roles/'),
      ]);

      setRoles(rolesData.roles || []);
      setPermissions(permissionsData.permissions || []);
      setPermissionRoles(permissionRolesData.permissionRoles || []);
      setDataLoaded(prev => ({ ...prev, roles: true, permissions: true }));
    } catch (error: any) {
      toast.error('Erreur lors du chargement des données');
      console.error('Error loading essential data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Load statuses data when statuses section is expanded
  async function loadStatuses() {
    if (dataLoaded.statuses) return; // Already loaded
    
    try {
      const statusesData = await apiCall('/api/statuses/');
      setStatuses(statusesData.statuses || []);
      setDataLoaded(prev => ({ ...prev, statuses: true }));
    } catch (error: any) {
      toast.error('Erreur lors du chargement des statuts');
      console.error('Error loading statuses:', error);
    }
  }

  // Load note categories data when note categories section is expanded
  async function loadNoteCategories() {
    if (dataLoaded.noteCategories) return; // Already loaded
    
    try {
      const categoriesData = await apiCall('/api/note-categories/');
      const sortedCategories = (categoriesData.categories || []).sort((a: NoteCategory, b: NoteCategory) => 
        a.orderIndex - b.orderIndex
      );
      setNoteCategories(sortedCategories);
      setDataLoaded(prev => ({ ...prev, noteCategories: true }));
    } catch (error: any) {
      toast.error('Erreur lors du chargement des catégories de notes');
      console.error('Error loading note categories:', error);
    }
  }

  // Legacy function for reloading all data (used after saves)
  async function loadData() {
    setLoading(true);
    try {
      const [rolesData, permissionsData, permissionRolesData, statusesData, categoriesData] = await Promise.all([
        apiCall('/api/roles/'),
        apiCall('/api/permissions/'),
        apiCall('/api/permission-roles/'),
        dataLoaded.statuses ? apiCall('/api/statuses/') : Promise.resolve({ statuses: [] }),
        dataLoaded.noteCategories ? apiCall('/api/note-categories/') : Promise.resolve({ categories: [] }),
      ]);

      setRoles(rolesData.roles || []);
      setPermissions(permissionsData.permissions || []);
      setPermissionRoles(permissionRolesData.permissionRoles || []);
      if (dataLoaded.statuses) {
        setStatuses(statusesData.statuses || []);
      }
      if (dataLoaded.noteCategories) {
        const sortedCategories = (categoriesData.categories || []).sort((a: NoteCategory, b: NoteCategory) => 
          a.orderIndex - b.orderIndex
        );
        setNoteCategories(sortedCategories);
      }
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
    'planning_administrateur',
    'permissions',
    'statuses',
    'note_categories',
    'fiche_contact',
    'contact_tabs',
    'notifications',
    'mails',
    'other',
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
  // Exclude: events, note, notes, settings, other (other is not a page, it's for miscellaneous permissions)
  const excludedComponents = ['events', 'note', 'notes', 'settings', 'other'];
  
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
               ? p.statusId === statusId && !p.fieldName  // Status permission: statusId contains status ID (for statuses and fosse_statuses)
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
    
    // Check pending changes first (for both new and existing permissions)
    const pendingChange = pendingPermissionChanges.get(changeKey);
    if (pendingChange !== undefined) {
      // If there's already a pending change, toggle from that value
      currentState = pendingChange;
    } else if (!permissionId) {
      // For new permissions that aren't in pending changes, they don't exist, so current state is false
      currentState = false;
    } else {
      // Existing permission, check actual state
      currentState = permissionRoles.some(
        pr => pr.roleId === roleId && pr.permissionId === permissionId
      );
    }
    
    setPendingPermissionChanges(prev => {
      const newMap = new Map(prev);
      // Toggle: if currently true, set to false (remove), if false, set to true (add)
      const newValue = !currentState;
      
      // If the new value matches the actual state (reverting a pending change), remove it from pending changes
      if (permissionId) {
        const actualState = permissionRoles.some(
          pr => pr.roleId === roleId && pr.permissionId === permissionId
        );
        if (newValue === actualState && pendingChange !== undefined) {
          // Reverting a pending change back to actual state - remove from pending changes
          newMap.delete(changeKey);
        } else {
          // Set the new pending change
          newMap.set(changeKey, newValue);
        }
      } else {
        // For new permissions (permissionId is null)
        if (!newValue) {
          // Setting to false for a non-existent permission - remove from pending (no-op)
          newMap.delete(changeKey);
        } else {
          // Setting to true for a new permission - add to pending
          newMap.set(changeKey, newValue);
        }
      }
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

  // Toggle all permissions in a row for Fiche Contact table
  function toggleAllFicheContactRowPermissions(fieldName: string) {
    if (!selectedRoleForPermissions) return;
    
    const roleId = selectedRoleForPermissions.id;
    
    // Get current state of all permissions for this field
    const viewPermissionId = getPermissionId('fiche_contact', 'view', null, fieldName);
    const editPermissionId = getPermissionId('fiche_contact', 'edit', null, fieldName);
    
    const hasView = hasPermission(roleId, viewPermissionId, 'fiche_contact', 'view', null, fieldName);
    const hasEdit = hasPermission(roleId, editPermissionId, 'fiche_contact', 'edit', null, fieldName);
    
    // Check if all permissions are selected
    const allSelected = hasView && hasEdit;
    
    // Toggle all permissions
    const actions: Array<'view' | 'edit'> = ['view', 'edit'];
    
    setPendingPermissionChanges(prev => {
      const newMap = new Map(prev);
      
      for (const action of actions) {
        const permissionId = getPermissionId('fiche_contact', action, null, fieldName);
        let changeKey: string;
        if (!permissionId) {
          changeKey = `${roleId}-fiche_contact-${action}-category-${fieldName}`;
        } else {
          changeKey = `${roleId}-${permissionId}`;
        }
        
        // Set to opposite of allSelected state
        newMap.set(changeKey, !allSelected);
      }
      
      return newMap;
    });
  }

  // Toggle all permissions in a column for Fiche Contact table
  function toggleAllFicheContactColumn(action: 'view' | 'edit') {
    if (!selectedRoleForPermissions) return;
    
    const roleId = selectedRoleForPermissions.id;
    
    // Check if all are currently checked
    let allChecked = true;
    for (const fieldInfo of contactFields) {
      const permissionId = getPermissionId('fiche_contact', action, null, fieldInfo.field);
      const hasPerm = hasPermission(roleId, permissionId);
      
      if (!hasPerm) {
        allChecked = false;
        break;
      }
    }
    
    // Batch all updates in a single state update
    setPendingPermissionChanges(prev => {
      const newMap = new Map(prev);
      
      // Toggle all fields
      for (const fieldInfo of contactFields) {
        const permissionId = getPermissionId('fiche_contact', action, null, fieldInfo.field);
        
        let changeKey: string;
        if (!permissionId) {
          changeKey = `${roleId}-fiche_contact-${action}-category-${fieldInfo.field}`;
        } else {
          changeKey = `${roleId}-${permissionId}`;
        }
        
        // Set to opposite of allChecked state
        newMap.set(changeKey, !allChecked);
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
    
    // Note: Contacts page-level permissions are obsolete - validation removed
    
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
    
    // Note: Contacts page-level permissions are obsolete - no validation needed
    
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

  // Toggle all permissions in a row for Fosse Status table
  function toggleAllFosseStatusRowPermissions(statusId: string) {
    if (!selectedRoleForPermissions) return;
    
    const roleId = selectedRoleForPermissions.id;
    
    // Get current state of all permissions for this status
    const viewPermissionId = getPermissionId('fosse_statuses', 'view', statusId);
    const createPermissionId = getPermissionId('fosse_statuses', 'create', statusId);
    const editPermissionId = getPermissionId('fosse_statuses', 'edit', statusId);
    const deletePermissionId = getPermissionId('fosse_statuses', 'delete', statusId);
    
    const hasView = hasPermission(roleId, viewPermissionId, 'fosse_statuses', 'view', statusId);
    const hasCreate = hasPermission(roleId, createPermissionId, 'fosse_statuses', 'create', statusId);
    const hasEdit = hasPermission(roleId, editPermissionId, 'fosse_statuses', 'edit', statusId);
    const hasDelete = hasPermission(roleId, deletePermissionId, 'fosse_statuses', 'delete', statusId);
    
    // Check if all permissions are selected
    const allSelected = hasView && hasCreate && hasEdit && hasDelete;
    
    // Toggle all permissions
    const actions: Array<'view' | 'create' | 'edit' | 'delete'> = ['view', 'create', 'edit', 'delete'];
    
    setPendingPermissionChanges(prev => {
      const newMap = new Map(prev);
      
      for (const action of actions) {
        const permissionId = getPermissionId('fosse_statuses', action, statusId);
        let changeKey: string;
        if (!permissionId) {
          changeKey = `${roleId}-fosse_statuses-${action}-${statusId}`;
        } else {
          changeKey = `${roleId}-${permissionId}`;
        }
        
        // Set to opposite of allSelected state
        newMap.set(changeKey, !allSelected);
      }
      
      return newMap;
    });
  }

  // Toggle all permissions in a column for Fosse Status table
  function toggleAllFosseStatusColumn(action: 'view' | 'create' | 'edit' | 'delete') {
    if (!selectedRoleForPermissions) return;
    
    const roleId = selectedRoleForPermissions.id;
    
    // Check if all are currently checked
    let allChecked = true;
    for (const status of statuses) {
      const permissionId = getPermissionId('fosse_statuses', action, status.id);
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
        const permissionId = getPermissionId('fosse_statuses', action, status.id);
        
        let changeKey: string;
        if (!permissionId) {
          changeKey = `${roleId}-fosse_statuses-${action}-${status.id}`;
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
          // Handle components with underscores (like 'note_categories', 'fiche_contact')
          let component: string;
          let action: string;
          let rest: string[];
          
          // Check if component has underscore (e.g., 'note_categories', 'fiche_contact', 'fosse_statuses')
          if (parts[0].includes('_')) {
            component = parts[0];
            action = parts[1];
            rest = parts.slice(2);
          } else if (parts[0] === 'note' && parts[1] === 'categories') {
            // Component was split: 'note' and 'categories'
            component = 'note_categories';
            action = parts[2];
            rest = parts.slice(3);
          } else if (parts[0] === 'fosse' && parts[1] === 'statuses') {
            // Component was split: 'fosse' and 'statuses'
            component = 'fosse_statuses';
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
          // This also handles contact_tabs tabs (informations, documents, historique)
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
          // Validate component name is a valid database component name
          if (!component || component.includes(' ')) {
            errors.push(`Nom de composant invalide: "${component}". Action: ${action}`);
            continue;
          }
          
          const payload: any = {
            component,
            action,
            fieldName: categoryId || null, // Use fieldName for category ID or tab name (contact_tabs)
            statusId: statusId || null, // Use statusId for status ID (for statuses and fosse_statuses components)
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
          const errorMsg = error.message || error.toString();
          errors.push(`Erreur lors de la création de la permission ${component}-${action}${statusId ? ` (statut: ${statusId})` : ''}${categoryId ? ` (catégorie: ${categoryId})` : ''}: ${errorMsg}`);
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
        // First, check if afterRoleId is a valid permission ID (exists in permissions list)
        // This handles IDs of any length, not just 12 characters
        const isValidPermissionId = permissions.some(p => p.id === afterRoleId);
        
        if (isValidPermissionId) {
          // This is an existing permission ID
          permissionId = afterRoleId;
        } else {
          // This might be a new permission (format: component-action-statusId/category)
          // or an ID that doesn't exist yet - try to parse it
          const parts = afterRoleId.split('-');
          
          if (parts.length >= 2) {
            // Handle components with underscores (like 'note_categories')
            let component: string;
            let action: string;
            let rest: string[];
            
            // Check if first part is 'note' and second is 'categories' (for note_categories)
            // When note_categories or fosse_statuses is split by '-', it stays as 'note_categories' or 'fosse_statuses' (underscore preserved)
            // So we need to check if parts[0] contains underscore
            if (parts[0].includes('_')) {
              // Component has underscore (e.g., 'note_categories', 'fosse_statuses')
              component = parts[0];
              action = parts[1];
              rest = parts.slice(2);
            } else if (parts[0] === 'note' && parts[1] === 'categories') {
              // Component was split: 'note' and 'categories'
              component = 'note_categories';
              action = parts[2];
              rest = parts.slice(3);
            } else if (parts[0] === 'fosse' && parts[1] === 'statuses') {
              // Component was split: 'fosse' and 'statuses'
              component = 'fosse_statuses';
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
            // This also handles contact_tabs tabs (informations, documents, historique)
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
              // This also handles contact_tabs tabs (informations, documents, historique)
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
            }
            
            await apiCall(`/api/permission-roles/${existing.id}/delete/`, {
              method: 'DELETE',
            });
          }
        } catch (error: any) {
          errors.push(`Erreur lors de la modification de la permission`);
        }
      }
      
      // Reload data to sync with server
      await loadData();
      
      // Refresh current user to get updated permissions
      await refreshUser();
      
      // Clear pending changes after reloading to ensure checkbox state reflects server state
      setPendingPermissionChanges(new Map());
      
      if (errors.length > 0) {
        toast.error(`Erreurs lors de l'enregistrement: ${errors.join(', ')}`);
      } else {
        toast.success('Permissions enregistrées avec succès');
      }
    } catch (error: any) {
      toast.error('Erreur lors de l\'enregistrement des permissions');
      console.error('Error saving permissions:', error);
      // Reload on error to restore correct state
      await loadData();
      // Clear pending changes even on error to prevent stale state
      setPendingPermissionChanges(new Map());
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

  // If user doesn't have view permission, show message
  if (!canViewPermissions) {
    return (
      <div className="p-4 text-center text-slate-500">
        Vous n'avez pas la permission de voir les permissions.
      </div>
    );
  }

  return (
    <>
      <div className="users-teams-action-bar">
        <Button 
          onClick={(e) => {
            e.stopPropagation();
            setIsRoleModalOpen(true);
          }}
          disabled={!canCreatePermissions}
          title={!canCreatePermissions ? "Vous n'avez pas la permission de créer des rôles" : ""}
        >
          <Plus className="users-teams-icon users-teams-icon-with-margin" />
          Créer un rôle
        </Button>
      </div>

      {/* Create Role Modal */}
      {isRoleModalOpen && (
        <div className="modal-overlay" onClick={(e) => {
          // Only close if clicking directly on the overlay, not on child elements
          if (e.target === e.currentTarget) {
            // Check if there's selected text - if so, don't close the modal
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) {
              return;
            }
            setIsRoleModalOpen(false);
            setRoleError('');
          }
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
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => {
          setIsEditRoleModalOpen(false);
          setRoleError('');
        })}>
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
                  <div 
                    className="flex items-center justify-between cursor-pointer mb-4 p-2 hover:bg-slate-50 rounded transition-colors"
                    onClick={() => setExpandedSections(prev => ({ ...prev, pages: !prev.pages }))}
                  >
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      Pages
                      {expandedSections.pages ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </h3>
                  </div>
                  {expandedSections.pages && (
                  <div className="border overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="text-left p-3 font-semibold">Page</th>
                          <th 
                            className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                            onClick={canEditPermissions ? () => toggleAllPagesColumn('view') : undefined}
                            title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                          >
                            Voir
                          </th>
                          <th 
                            className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                            onClick={canEditPermissions ? () => toggleAllPagesColumn('create') : undefined}
                            title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                          >
                            Créer
                          </th>
                          <th 
                            className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                            onClick={canEditPermissions ? () => toggleAllPagesColumn('edit') : undefined}
                            title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                          >
                            Modifier
                          </th>
                          <th 
                            className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                            onClick={canEditPermissions ? () => toggleAllPagesColumn('delete') : undefined}
                            title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                          >
                            Supprimer
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {getUniqueDbComponents()
                          .filter((dbComponent) => dbComponent !== 'fiche_contact' && dbComponent !== 'contact_tabs') // Remove Details du contact and Fiche contact from Pages table (contacts page is now included)
                          .map((dbComponent) => {
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
                                className={`p-3 font-medium ${canEditPermissions ? 'cursor-pointer hover:text-blue-600' : 'cursor-default'}`}
                                onClick={canEditPermissions ? () => toggleAllRowPermissions(displayLabel) : undefined}
                                title={canEditPermissions ? "Cliquer pour sélectionner/désélectionner toute la ligne" : "Vous n'avez pas la permission de modifier les permissions"}
                              >
                                {displayLabel}
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={hasView}
                                  onChange={() => {
                                    togglePendingPermission(selectedRoleForPermissions.id, displayLabel, 'view');
                                  }}
                                  disabled={!canEditPermissions}
                                  className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                  title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
                                />
                              </td>
                              <td className="p-3 text-center">
                                {!isDashboard && (
                                  <input
                                    type="checkbox"
                                    checked={hasCreate}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, displayLabel, 'create');
                                    }}
                                    disabled={!canEditPermissions}
                                    className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
                                  />
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {!isDashboard && (
                                  <input
                                    type="checkbox"
                                    checked={hasEdit}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, displayLabel, 'edit');
                                    }}
                                    disabled={!canEditPermissions}
                                    className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
                                  />
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {!isDashboard && (
                                  <input
                                    type="checkbox"
                                    checked={hasDelete}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, displayLabel, 'delete');
                                    }}
                                    disabled={!canEditPermissions}
                                    className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
                                  />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>

                {/* Status Permissions Table */}
                <div>
                  <div 
                    className="flex items-center justify-between cursor-pointer mb-4 p-2 hover:bg-slate-50 rounded transition-colors"
                    onClick={() => {
                      const willExpand = !expandedSections.statuses;
                      setExpandedSections(prev => ({ ...prev, statuses: !prev.statuses }));
                      if (willExpand) {
                        loadStatuses();
                      }
                    }}
                  >
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      Statuts
                      {expandedSections.statuses ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </h3>
                  </div>
                  {expandedSections.statuses && (
                  <>
                  {statuses.length === 0 ? (
                    <p className="text-slate-500">Aucun statut disponible</p>
                  ) : (
                    <div className="border overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="text-left p-3 font-semibold">Statut</th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => toggleAllStatusColumn('view') : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Voir
                            </th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => toggleAllStatusColumn('create') : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Créer
                            </th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => toggleAllStatusColumn('edit') : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Modifier
                            </th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => toggleAllStatusColumn('delete') : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
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
                            
                            // Note: Contacts page-level permissions are obsolete - no longer required for status permissions

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
                                    disabled={!canEditPermissions}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Statuts (Paramètres)', 'view', status.id);
                                    }}
                                    className={`w-4 h-4 ${!canEditPermissions ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ''}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasCreate}
                                    disabled={!canEditPermissions}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Statuts (Paramètres)', 'create', status.id);
                                    }}
                                    className={`w-4 h-4 ${!canEditPermissions ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ''}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasEdit}
                                    disabled={!canEditPermissions}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Statuts (Paramètres)', 'edit', status.id);
                                    }}
                                    className={`w-4 h-4 ${!canEditPermissions ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ''}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasDelete}
                                    disabled={!canEditPermissions}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Statuts (Paramètres)', 'delete', status.id);
                                    }}
                                    className={`w-4 h-4 ${!canEditPermissions ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ''}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  </>
                  )}
                </div>

                {/* Fosse Status Permissions Table */}
                <div>
                  <div 
                    className="flex items-center justify-between cursor-pointer mb-4 p-2 hover:bg-slate-50 rounded transition-colors"
                    onClick={() => {
                      const willExpand = !expandedSections.fosseStatuses;
                      setExpandedSections(prev => ({ ...prev, fosseStatuses: !prev.fosseStatuses }));
                      if (willExpand) {
                        loadStatuses();
                      }
                    }}
                  >
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      Statuts Fosse
                      {expandedSections.fosseStatuses ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </h3>
                  </div>
                  {expandedSections.fosseStatuses && (
                  <>
                  {statuses.length === 0 ? (
                    <p className="text-slate-500">Aucun statut disponible</p>
                  ) : (
                    <div className="border overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="text-left p-3 font-semibold">Statut</th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => toggleAllFosseStatusColumn('view') : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Voir
                            </th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => toggleAllFosseStatusColumn('create') : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Créer
                            </th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => toggleAllFosseStatusColumn('edit') : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Modifier
                            </th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => toggleAllFosseStatusColumn('delete') : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Supprimer
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {statuses.map((status) => {
                            const viewPermissionId = getPermissionId('fosse_statuses', 'view', status.id);
                            const createPermissionId = getPermissionId('fosse_statuses', 'create', status.id);
                            const editPermissionId = getPermissionId('fosse_statuses', 'edit', status.id);
                            const deletePermissionId = getPermissionId('fosse_statuses', 'delete', status.id);
                            const hasView = hasPermission(selectedRoleForPermissions.id, viewPermissionId, 'fosse_statuses', 'view', status.id);
                            const hasCreate = hasPermission(selectedRoleForPermissions.id, createPermissionId, 'fosse_statuses', 'create', status.id);
                            const hasEdit = hasPermission(selectedRoleForPermissions.id, editPermissionId, 'fosse_statuses', 'edit', status.id);
                            const hasDelete = hasPermission(selectedRoleForPermissions.id, deletePermissionId, 'fosse_statuses', 'delete', status.id);

                            return (
                              <tr key={status.id} className="border-b hover:bg-slate-50">
                                <td 
                                  className="p-3 cursor-pointer hover:text-blue-600"
                                  onClick={() => toggleAllFosseStatusRowPermissions(status.id)}
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
                                    disabled={!canEditPermissions}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Statuts Fosse (Paramètres)', 'view', status.id);
                                    }}
                                    className={`w-4 h-4 ${!canEditPermissions ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ''}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasCreate}
                                    disabled={!canEditPermissions}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Statuts Fosse (Paramètres)', 'create', status.id);
                                    }}
                                    className={`w-4 h-4 ${!canEditPermissions ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ''}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasEdit}
                                    disabled={!canEditPermissions}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Statuts Fosse (Paramètres)', 'edit', status.id);
                                    }}
                                    className={`w-4 h-4 ${!canEditPermissions ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ''}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasDelete}
                                    disabled={!canEditPermissions}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Statuts Fosse (Paramètres)', 'delete', status.id);
                                    }}
                                    className={`w-4 h-4 ${!canEditPermissions ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ''}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  </>
                  )}
                </div>

                {/* Note Category Permissions Table */}
                <div>
                  <div 
                    className="flex items-center justify-between cursor-pointer mb-4 p-2 hover:bg-slate-50 rounded transition-colors"
                    onClick={() => {
                      const willExpand = !expandedSections.noteCategories;
                      setExpandedSections(prev => ({ ...prev, noteCategories: !prev.noteCategories }));
                      if (willExpand) {
                        loadNoteCategories();
                      }
                    }}
                  >
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      Catégories de notes
                      {expandedSections.noteCategories ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </h3>
                  </div>
                  {expandedSections.noteCategories && (
                  <>
                  {noteCategories.length === 0 ? (
                    <p className="text-slate-500">Aucune catégorie de notes disponible</p>
                  ) : (
                    <div className="border overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="text-left p-3 font-semibold">Catégorie</th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => toggleAllNoteCategoryColumn('view') : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Voir
                            </th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => toggleAllNoteCategoryColumn('create') : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Créer
                            </th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => toggleAllNoteCategoryColumn('edit') : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Modifier
                            </th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => toggleAllNoteCategoryColumn('delete') : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
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
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact (Paramètres)', 'view', null, category.id);
                                    }}
                                    disabled={!canEditPermissions}
                                    className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasCreate}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact (Paramètres)', 'create', null, category.id);
                                    }}
                                    disabled={!canEditPermissions}
                                    className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasEdit}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact (Paramètres)', 'edit', null, category.id);
                                    }}
                                    disabled={!canEditPermissions}
                                    className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasDelete}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact (Paramètres)', 'delete', null, category.id);
                                    }}
                                    disabled={!canEditPermissions}
                                    className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  </>
                  )}
                </div>

                {/* Details du Contact Permissions Table */}
                <div>
                  <div 
                    className="flex items-center justify-between cursor-pointer mb-4 p-2 hover:bg-slate-50 rounded transition-colors"
                    onClick={() => setExpandedSections(prev => ({ ...prev, ficheContact: !prev.ficheContact }))}
                  >
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      Details du contact
                      {expandedSections.ficheContact ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </h3>
                  </div>
                  {expandedSections.ficheContact && (
                    <div className="border overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="text-left p-3 font-semibold">Champ</th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => toggleAllFicheContactColumn('view') : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Voir
                            </th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => toggleAllFicheContactColumn('edit') : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Modifier
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {contactFields.map((fieldInfo) => {
                            const viewPermissionId = getPermissionId('fiche_contact', 'view', null, fieldInfo.field);
                            const editPermissionId = getPermissionId('fiche_contact', 'edit', null, fieldInfo.field);
                            const hasView = hasPermission(selectedRoleForPermissions.id, viewPermissionId, 'fiche_contact', 'view', null, fieldInfo.field);
                            const hasEdit = hasPermission(selectedRoleForPermissions.id, editPermissionId, 'fiche_contact', 'edit', null, fieldInfo.field);

                            return (
                              <tr key={fieldInfo.field} className="border-b hover:bg-slate-50">
                                <td 
                                  className={`p-3 font-medium ${canEditPermissions ? 'cursor-pointer hover:text-blue-600' : 'cursor-default'}`}
                                  onClick={canEditPermissions ? () => toggleAllFicheContactRowPermissions(fieldInfo.field) : undefined}
                                  title={canEditPermissions ? "Cliquer pour sélectionner/désélectionner toute la ligne" : "Vous n'avez pas la permission de modifier les permissions"}
                                >
                                  {fieldInfo.label}
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasView}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Details du contact', 'view', null, fieldInfo.field);
                                    }}
                                    disabled={!canEditPermissions}
                                    className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasEdit}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Details du contact', 'edit', null, fieldInfo.field);
                                    }}
                                    disabled={!canEditPermissions}
                                    className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
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

                {/* Fiche Contact Tabs Permissions Table */}
                <div>
                  <div 
                    className="flex items-center justify-between cursor-pointer mb-4 p-2 hover:bg-slate-50 rounded transition-colors"
                    onClick={() => setExpandedSections(prev => ({ ...prev, contactTabs: !prev.contactTabs }))}
                  >
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      Fiche contact
                      {expandedSections.contactTabs ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </h3>
                  </div>
                  {expandedSections.contactTabs && (
                    <div className="border overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-100">
                          <tr>
                            <td 
                              className={`p-3 font-medium ${canEditPermissions ? 'cursor-pointer hover:text-blue-600' : 'cursor-default'}`}
                              onClick={canEditPermissions ? () => {
                                const tabs = ['informations', 'documents', 'historique'];
                                const actions: Array<'view' | 'create' | 'edit' | 'delete'> = ['view', 'create', 'edit', 'delete'];
                                tabs.forEach(tab => {
                                  actions.forEach(action => {
                                    togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact', action, null, tab);
                                  });
                                });
                              } : undefined}
                              title={canEditPermissions ? "Cliquer pour sélectionner/désélectionner toutes les permissions" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Onglet
                            </td>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => {
                                const tabs = ['informations', 'documents', 'historique'];
                                tabs.forEach(tab => {
                                  togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact', 'view', null, tab);
                                });
                              } : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Voir
                            </th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => {
                                const tabs = ['informations', 'documents', 'historique'];
                                tabs.forEach(tab => {
                                  togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact', 'create', null, tab);
                                });
                              } : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Créer
                            </th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => {
                                const tabs = ['informations', 'documents', 'historique'];
                                tabs.forEach(tab => {
                                  togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact', 'edit', null, tab);
                                });
                              } : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Modifier
                            </th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => {
                                const tabs = ['informations', 'documents', 'historique'];
                                tabs.forEach(tab => {
                                  togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact', 'delete', null, tab);
                                });
                              } : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Supprimer
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { tab: 'informations', label: 'Informations' },
                            { tab: 'documents', label: 'Documents' },
                            { tab: 'historique', label: 'Historique' }
                          ].map((tabInfo) => {
                            const viewPermissionId = getPermissionId('contact_tabs', 'view', null, tabInfo.tab);
                            const createPermissionId = getPermissionId('contact_tabs', 'create', null, tabInfo.tab);
                            const editPermissionId = getPermissionId('contact_tabs', 'edit', null, tabInfo.tab);
                            const deletePermissionId = getPermissionId('contact_tabs', 'delete', null, tabInfo.tab);
                            
                            const hasView = hasPermission(selectedRoleForPermissions.id, viewPermissionId, 'contact_tabs', 'view', null, tabInfo.tab);
                            const hasCreate = hasPermission(selectedRoleForPermissions.id, createPermissionId, 'contact_tabs', 'create', null, tabInfo.tab);
                            const hasEdit = hasPermission(selectedRoleForPermissions.id, editPermissionId, 'contact_tabs', 'edit', null, tabInfo.tab);
                            const hasDelete = hasPermission(selectedRoleForPermissions.id, deletePermissionId, 'contact_tabs', 'delete', null, tabInfo.tab);

                            return (
                              <tr key={tabInfo.tab} className="border-b hover:bg-slate-50">
                                <td 
                                  className={`p-3 font-medium ${canEditPermissions ? 'cursor-pointer hover:text-blue-600' : 'cursor-default'}`}
                                  onClick={canEditPermissions ? () => {
                                    const actions: Array<'view' | 'create' | 'edit' | 'delete'> = ['view', 'create', 'edit', 'delete'];
                                    const allSelected = hasView && hasCreate && hasEdit && hasDelete;
                                    actions.forEach(action => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact', action, null, tabInfo.tab);
                                    });
                                  } : undefined}
                                  title={canEditPermissions ? "Cliquer pour sélectionner/désélectionner toute la ligne" : "Vous n'avez pas la permission de modifier les permissions"}
                                >
                                  {tabInfo.label}
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasView}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact', 'view', null, tabInfo.tab);
                                    }}
                                    disabled={!canEditPermissions}
                                    className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasCreate}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact', 'create', null, tabInfo.tab);
                                    }}
                                    disabled={!canEditPermissions}
                                    className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasEdit}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact', 'edit', null, tabInfo.tab);
                                    }}
                                    disabled={!canEditPermissions}
                                    className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={hasDelete}
                                    onChange={() => {
                                      togglePendingPermission(selectedRoleForPermissions.id, 'Fiche contact', 'delete', null, tabInfo.tab);
                                    }}
                                    disabled={!canEditPermissions}
                                    className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                    title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
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

                {/* Other Permissions Table */}
                <div>
                  <div 
                    className="flex items-center justify-between cursor-pointer mb-4 p-2 hover:bg-slate-50 rounded transition-colors"
                    onClick={() => setExpandedSections(prev => ({ ...prev, otherPermissions: !prev.otherPermissions }))}
                  >
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      Autres permissions
                      {expandedSections.otherPermissions ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </h3>
                  </div>
                  {expandedSections.otherPermissions && (
                    <div className="border overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="text-left p-3 font-semibold">Permission</th>
                            <th 
                              className={`text-center p-3 font-semibold ${canEditPermissions ? 'cursor-pointer hover:bg-slate-200 transition-colors' : 'cursor-not-allowed opacity-50'}`}
                              onClick={canEditPermissions ? () => {
                                togglePendingPermission(selectedRoleForPermissions.id, 'Autres permissions', 'edit', null, 'status_change_note_required');
                              } : undefined}
                              title={canEditPermissions ? "Cliquer pour cocher/décocher toutes les cases de cette colonne" : "Vous n'avez pas la permission de modifier les permissions"}
                            >
                              Activer
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b hover:bg-slate-50">
                            <td className="p-3 font-medium">
                              Note requise au changement de statut
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={(() => {
                                  const permissionId = getPermissionId('other', 'edit', null, 'status_change_note_required');
                                  return hasPermission(selectedRoleForPermissions.id, permissionId, 'other', 'edit', null, 'status_change_note_required');
                                })()}
                                onChange={() => {
                                  togglePendingPermission(selectedRoleForPermissions.id, 'Autres permissions', 'edit', null, 'status_change_note_required');
                                }}
                                disabled={!canEditPermissions}
                                className={`w-4 h-4 ${canEditPermissions ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
                              />
                            </td>
                          </tr>
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
                      disabled={isSavingPermissions || !canEditPermissions}
                      title={!canEditPermissions ? "Vous n'avez pas la permission de modifier les permissions" : ""}
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

