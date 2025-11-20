import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import '../styles/UsersTeam.css';
import '../styles/PageHeader.css';
import { PermissionsTab } from './PermissionsTab';
import { StatusesTab } from './StatusesTab';
import { useHasPermission, useHasStatusesPermission } from '../hooks/usePermissions';

export function Settings() {
  const hasPermissionsPermission = useHasPermission('permissions', 'view');
  const hasStatusesPermission = useHasStatusesPermission();
  
  // Determine default tab based on available permissions
  const getDefaultTab = () => {
    if (hasPermissionsPermission) return 'permissions';
    if (hasStatusesPermission) return 'statuses';
    return 'permissions'; // Fallback
  };

  const [defaultTab] = useState(getDefaultTab());

  // If user has no permissions for either tab, they shouldn't be here (route protection handles this)
  // But we'll still check to hide tabs they can't access
  const visibleTabs: string[] = [];
  if (hasPermissionsPermission) visibleTabs.push('permissions');
  if (hasStatusesPermission) visibleTabs.push('statuses');

  return (
    <div className="users-teams-container">
      <div className="page-header-section">
        <h1 className="page-title">Paramètres</h1>
        <p className="page-subtitle">Gestion des paramètres de l'application</p>
      </div>

      {visibleTabs.length > 0 ? (
        <Tabs defaultValue={defaultTab} className="users-teams-tabs">
          <TabsList>
            {hasPermissionsPermission && <TabsTrigger value="permissions">Permissions</TabsTrigger>}
            {hasStatusesPermission && <TabsTrigger value="statuses">Statuts</TabsTrigger>}
          </TabsList>

          {hasPermissionsPermission && (
            <TabsContent value="permissions" className="users-teams-tab-content">
              <PermissionsTab />
            </TabsContent>
          )}

          {hasStatusesPermission && (
            <TabsContent value="statuses" className="users-teams-tab-content">
              <StatusesTab />
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

export default Settings;

