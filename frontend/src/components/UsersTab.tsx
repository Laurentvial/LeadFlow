import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Pencil, Trash2, Key } from 'lucide-react';
import { useUsers } from '../hooks/useUsers';
import { useTeams } from '../hooks/useTeams';
import { CreateUserModal } from './CreateUserModal';
import { EditUserModal } from './EditUserModal';
import { ResetPasswordModal } from './ResetPasswordModal';
import { User } from '../types';
import LoadingIndicator from './LoadingIndicator';

export function UsersTab() {
  const { users: usersData, loading: usersLoading, error: usersError, deleteUser, toggleUserActive, toggleUserOtp, refetch } = useUsers();
  const { teams, loading: teamsLoading } = useTeams();
  
  // Sort users by creation date (most recent first) - already sorted in hook, but ensure it's maintained
  const users = [...usersData].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : (a.dateCreated ? new Date(a.dateCreated).getTime() : 0);
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : (b.dateCreated ? new Date(b.dateCreated).getTime() : 0);
    return dateB - dateA; // Most recent first
  });
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  async function handleDelete(userId: string) {
    try {
      await deleteUser(userId);
    } catch (error) {
      // Error already handled in the hook
    }
  }

  async function handleToggleActive(userId: string) {
    try {
      await toggleUserActive(userId);
    } catch (error) {
      // Error already handled in the hook
    }
  }

  async function handleToggleOtp(userId: string) {
    try {
      await toggleUserOtp(userId);
    } catch (error) {
      // Error already handled in the hook
    }
  }

  function handleUserCreated() {
    setIsUserModalOpen(false);
    refetch();
  }

  function handleEditClick(user: User) {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  }

  function handleUserUpdated() {
    setIsEditModalOpen(false);
    setSelectedUser(null);
    refetch();
  }

  function handleResetPasswordClick(user: User) {
    setSelectedUser(user);
    setIsResetPasswordModalOpen(true);
  }

  function handlePasswordReset() {
    setIsResetPasswordModalOpen(false);
    setSelectedUser(null);
    refetch();
  }

  return (
    <>
      <div className="users-teams-action-bar">
        <Button onClick={() => setIsUserModalOpen(true)}>
          <Plus className="users-teams-icon users-teams-icon-with-margin" />
          Créer un utilisateur
        </Button>
      </div>

      <CreateUserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onUserCreated={handleUserCreated}
      />

      <EditUserModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onUserUpdated={handleUserUpdated}
      />

      <ResetPasswordModal
        isOpen={isResetPasswordModalOpen}
        onClose={() => {
          setIsResetPasswordModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onPasswordReset={handlePasswordReset}
      />

      <Card>
        <CardHeader>
          <CardTitle>Liste des utilisateurs</CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading || teamsLoading ? (
            <LoadingIndicator />
          ) : usersError ? (
            <div className="users-teams-error-message">
              <p>Erreur lors du chargement des utilisateurs: {usersError.message}</p>
              <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-2">
                Réessayer
              </Button>
            </div>
          ) : users.length > 0 ? (
            <div className="users-teams-table-container">
              <table className="users-teams-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nom</th>
                    <th>Couleur</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Équipe</th>
                    <th>Statut</th>
                    <th>OTP</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const userTeam = teams.find(t => t.id === user.teamId);
                    
                    return (
                      <tr key={user.id}>
                        <td className="users-teams-table-id">{user.id.substring(0, 8)}</td>
                        <td>
                          {`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`}
                        </td>
                        <td>
                          {user.hrex ? (
                            <div
                              className="w-4 h-4 rounded border border-slate-300"
                              style={{ backgroundColor: user.hrex }}
                              title={user.hrex}
                            />
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="users-teams-table-email">{user.email || user.username || '-'}</td>
                        <td>
                          <Badge variant="outline">{user.roleName || user.role}</Badge>
                        </td>
                        <td>
                          {userTeam ? userTeam.name : '-'}
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(user.id)}
                            className={user.active ? 'users-teams-status-active' : 'users-teams-status-inactive'}
                          >
                            {user.active ? 'Actif' : 'Inactif'}
                          </Button>
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleOtp(user.id)}
                            className={user.requireOtp ? 'users-teams-status-active' : 'users-teams-status-inactive'}
                          >
                            {user.requireOtp ? 'Activé' : 'Désactivé'}
                          </Button>
                        </td>
                        <td className="text-right">
                          <div className="users-teams-table-actions">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditClick(user)}
                              title="Modifier"
                            >
                              <Pencil className="users-teams-icon" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleResetPasswordClick(user)}
                              title="Réinitialiser le mot de passe"
                            >
                              <Key className="users-teams-icon" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDelete(user.id)}
                              className="users-teams-delete-button"
                              title="Supprimer"
                            >
                              <Trash2 className="users-teams-icon" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="users-teams-empty-message">
              <p>Aucun utilisateur trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

