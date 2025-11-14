import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import '../styles/UsersTeam.css';
import '../styles/PageHeader.css';
import { UsersTab } from './UsersTab';
import { TeamsTab } from './TeamsTab';
import { useHasPermission } from '../hooks/usePermissions';

export function UsersTeams() {
  const hasUsersPermission = useHasPermission('users', 'view');
  const hasTeamsPermission = useHasPermission('teams', 'view');
  
  // Determine default tab based on available permissions
  const getDefaultTab = () => {
    if (hasUsersPermission) return 'users';
    if (hasTeamsPermission) return 'teams';
    return 'users'; // Fallback
  };

  const [defaultTab] = useState(getDefaultTab());

  // If user has no permissions for either tab, they shouldn't be here (route protection handles this)
  // But we'll still check to hide tabs they can't access
  const visibleTabs: string[] = [];
  if (hasUsersPermission) visibleTabs.push('users');
  if (hasTeamsPermission) visibleTabs.push('teams');

  return (
    <div className="users-teams-container">
      <div className="page-header-section">
        <h1 className="page-title">Utilisateurs / Équipes</h1>
        <p className="page-subtitle">Gestion des utilisateurs et des équipes</p>
      </div>

      {visibleTabs.length > 0 ? (
        <Tabs defaultValue={defaultTab} className="users-teams-tabs">
          <TabsList>
            {hasUsersPermission && <TabsTrigger value="users">Utilisateurs</TabsTrigger>}
            {hasTeamsPermission && <TabsTrigger value="teams">Équipes</TabsTrigger>}
          </TabsList>

          {hasUsersPermission && (
            <TabsContent value="users" className="users-teams-tab-content">
              <UsersTab />
            </TabsContent>
          )}

          {hasTeamsPermission && (
            <TabsContent value="teams" className="users-teams-tab-content">
              <TeamsTab />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <div className="p-4 text-center text-slate-500">
          Vous n'avez pas accès à cette page.
        </div>
      )}
    </div>
  );
}

export default UsersTeams;