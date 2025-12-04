import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import '../styles/UsersTeam.css';
import '../styles/PageHeader.css';
import { PermissionsTab } from './PermissionsTab';
import { StatusesTab } from './StatusesTab';
import { ContactFormTab } from './ContactFormTab';
import { NotificationPreferencesTab } from './NotificationPreferencesTab';
import { useHasPermissionsPermission, useHasStatusesPermission, useHasNoteCategoriesPermission, useHasNotificationsPermission } from '../hooks/usePermissions';

export function Settings() {
  const hasPermissionsPermission = useHasPermissionsPermission();
  const hasStatusesPermission = useHasStatusesPermission();
  const hasNoteCategoriesPermission = useHasNoteCategoriesPermission();
  const hasNotificationsPermission = useHasNotificationsPermission();
  
  // Determine default tab based on available permissions
  // Only return a tab that the user actually has permission to see
  const getDefaultTab = () => {
    if (hasNotificationsPermission) return 'notifications';
    if (hasPermissionsPermission) return 'permissions';
    if (hasStatusesPermission) return 'statuses';
    if (hasNoteCategoriesPermission) return 'contact-form';
    return 'notifications'; // Fallback (shouldn't happen due to wrapper check)
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab());

  // Include tabs based on permissions
  const visibleTabs: string[] = [];
  if (hasNotificationsPermission) visibleTabs.push('notifications');
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="users-teams-tabs">
          <TabsList>
            {hasNotificationsPermission && <TabsTrigger value="notifications">Notifications</TabsTrigger>}
            {hasPermissionsPermission && <TabsTrigger value="permissions">Permissions</TabsTrigger>}
            {hasStatusesPermission && <TabsTrigger value="statuses">Statuts</TabsTrigger>}
            {hasNoteCategoriesPermission && <TabsTrigger value="contact-form">Fiche contact</TabsTrigger>}
          </TabsList>

          {hasNotificationsPermission && (
            <TabsContent value="notifications" className="users-teams-tab-content">
              <NotificationPreferencesTab />
            </TabsContent>
          )}

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

