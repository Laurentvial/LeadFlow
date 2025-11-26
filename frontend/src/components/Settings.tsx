import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import '../styles/UsersTeam.css';
import '../styles/PageHeader.css';
import { PermissionsTab } from './PermissionsTab';
import { StatusesTab } from './StatusesTab';
import { ContactFormTab } from './ContactFormTab';
import { NotificationPreferencesTab } from './NotificationPreferencesTab';
import { useHasStatusesPermission, useHasNoteCategoriesPermission } from '../hooks/usePermissions';
import { useUser } from '../contexts/UserContext';

export function Settings() {
  const { currentUser } = useUser();
  
  // Check permissions permission using same logic as useHasStatusesPermission
  const hasPermissionsPermission = (() => {
    if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
      return false;
    }
    return currentUser.permissions.some((perm: any) => {
      return perm.component === 'permissions' && 
             perm.action === 'view' && 
             !perm.fieldName &&
             !perm.statusId;
    });
  })();
  
  const hasStatusesPermission = useHasStatusesPermission();
  const hasNoteCategoriesPermission = useHasNoteCategoriesPermission();
  
  // Determine default tab based on available permissions
  const getDefaultTab = () => {
    if (hasPermissionsPermission) return 'permissions';
    if (hasStatusesPermission) return 'statuses';
    if (hasNoteCategoriesPermission) return 'contact-form';
    return 'notifications'; // Fallback to notifications if no other permissions
  };

  const [defaultTab] = useState(getDefaultTab());

  // Include tabs based on permissions
  // Notification preferences is always visible for authenticated users
  const visibleTabs: string[] = ['notifications'];
  if (hasPermissionsPermission) visibleTabs.push('permissions');
  if (hasStatusesPermission) visibleTabs.push('statuses');
  if (hasNoteCategoriesPermission) visibleTabs.push('contact-form');

  return (
    <div className="users-teams-container">
      <div className="page-header-section">
        <h1 className="page-title">Paramètres</h1>
        <p className="page-subtitle">Gestion des paramètres de l'application</p>
      </div>

      {visibleTabs.length > 0 ? (
        <Tabs defaultValue={defaultTab} className="users-teams-tabs">
          <TabsList>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            {hasPermissionsPermission && <TabsTrigger value="permissions">Permissions</TabsTrigger>}
            {hasStatusesPermission && <TabsTrigger value="statuses">Statuts</TabsTrigger>}
            {hasNoteCategoriesPermission && <TabsTrigger value="contact-form">Fiche contact</TabsTrigger>}
          </TabsList>

          <TabsContent value="notifications" className="users-teams-tab-content">
            <NotificationPreferencesTab />
          </TabsContent>

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

          {hasNoteCategoriesPermission && (
            <TabsContent value="contact-form" className="users-teams-tab-content">
              <ContactFormTab />
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

