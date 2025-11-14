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
  clients: 'Contacts',
  users: 'Utilisateurs',
  teams: 'Équipes',
  planning: 'Planning',
  permissions: 'Permissions',
  statuses: 'Statuts',
};

const componentLabelToDbName = Object.fromEntries(
  Object.entries(componentNameMap).map(([dbName, label]) => [label, dbName])
);

interface Role {
  id: string;
  name: string;
  dataAccess: 'all' | 'team_only' | 'own_only';
  createdAt: string;
}

interface Permission {
  id: string;
  component: string; // always DB value, e.g., 'clients'
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

export function PermissionsTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionRoles, setPermissionRoles] = useState<PermissionRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: '',
    dataAccess: 'own_only' as 'all' | 'team_only' | 'own_only',
  });
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState<Role | null>(null);

  useEffect(() => {
    loadData();
  }, []);

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
      const [rolesData, permissionsData, permissionRolesData] = await Promise.all([
        apiCall('/api/roles/'),
        apiCall('/api/permissions/'),
        apiCall('/api/permission-roles/'),
      ]);

      setRoles(rolesData.roles || []);
      setPermissions(permissionsData.permissions || []);
      setPermissionRoles(permissionRolesData.permissionRoles || []);
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
        }),
      });
      toast.success('Rôle créé avec succès');
      setIsRoleModalOpen(false);
      setRoleForm({ name: '', dataAccess: 'own_only' });
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
        }),
      });
      toast.success('Rôle mis à jour avec succès');
      setIsEditRoleModalOpen(false);
      setSelectedRole(null);
      setRoleForm({ name: '', dataAccess: 'own_only' });
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
    setRoleForm({ name: role.name, dataAccess: role.dataAccess });
    setIsEditRoleModalOpen(true);
  }

  // Predefined list of components (DB names)
  const predefinedComponents = [
    'dashboard',
    'clients',
    'users',
    'teams',
    'planning',
    'permissions',
    'statuses',
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
  function getPermissionId(dbComponentName: string, action: 'view' | 'create' | 'edit' | 'delete'): string | null {
    const perm = permissions.find(
      p => p.component === dbComponentName &&
           p.action === action &&
           !p.fieldName &&
           !p.statusId
    );
    return perm?.id || null;
  }

  // Check if a role has a specific permission
  function hasPermission(roleId: string, permissionId: string | null): boolean {
    if (!permissionId) return false;
    return permissionRoles.some(
      pr => pr.roleId === roleId && pr.permissionId === permissionId
    );
  }

  // Toggle permission for a role and component/action
  async function handleToggleComponentPermission(
    roleId: string,
    displayComponentLabel: string,
    action: 'view' | 'create' | 'edit' | 'delete'
  ) {
    // Convert from UI label to DB component name
    const dbComponentName = getDbComponentName(displayComponentLabel);
    const permissionId = getPermissionId(dbComponentName, action);

    if (!permissionId) {
      // Permission doesn't exist, create it first
      try {
        const newPermission = await apiCall('/api/permissions/create/', {
          method: 'POST',
          body: JSON.stringify({
            component: dbComponentName,
            action,
            fieldName: null,
            statusId: null,
          }),
        });

        // Then assign it to the role
        await apiCall('/api/permission-roles/create/', {
          method: 'POST',
          body: JSON.stringify({
            roleId,
            permissionId: newPermission.id,
          }),
        });
        toast.success(`Permission ${action} ajoutée`);
        loadData();
      } catch (error: any) {
        toast.error(error.message || 'Erreur lors de la création de la permission');
      }
      return;
    }

    // Permission exists, toggle it
    const existing = permissionRoles.find(
      pr => pr.roleId === roleId && pr.permissionId === permissionId
    );

    try {
      if (existing) {
        // Remove permission
        await apiCall(`/api/permission-roles/${existing.id}/delete/`, {
          method: 'DELETE',
        });
        toast.success(`Permission ${action} retirée`);
      } else {
        // Add permission
        await apiCall('/api/permission-roles/create/', {
          method: 'POST',
          body: JSON.stringify({
            roleId,
            permissionId,
          }),
        });
        toast.success(`Permission ${action} ajoutée`);
      }
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification de la permission');
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
            ) : getUniqueDbComponents().length === 0 ? (
              <p className="text-slate-500">Aucun composant disponible. Les permissions seront créées automatiquement lors de l'assignation.</p>
            ) : (
              <div className="space-y-3">
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
                    <div
                      key={dbComponent}
                      className="flex items-center justify-between p-4 border hover:bg-slate-50"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium">{displayLabel}</h4>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hasView}
                            onChange={() =>
                              handleToggleComponentPermission(selectedRoleForPermissions.id, displayLabel, 'view')
                            }
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Voir</span>
                        </label>
                        {!isDashboard && (
                          <>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hasCreate}
                                onChange={() =>
                                  handleToggleComponentPermission(selectedRoleForPermissions.id, displayLabel, 'create')
                                }
                                className="w-4 h-4"
                              />
                              <span className="text-sm">Créer</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hasEdit}
                                onChange={() =>
                                  handleToggleComponentPermission(selectedRoleForPermissions.id, displayLabel, 'edit')
                                }
                                className="w-4 h-4"
                              />
                              <span className="text-sm">Modifier</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hasDelete}
                                onChange={() =>
                                  handleToggleComponentPermission(selectedRoleForPermissions.id, displayLabel, 'delete')
                                }
                                className="w-4 h-4"
                              />
                              <span className="text-sm">Supprimer</span>
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default PermissionsTab;

