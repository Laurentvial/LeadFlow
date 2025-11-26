import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useHasPermission, useHasStatusesPermission, useHasNoteCategoriesPermission } from '../hooks/usePermissions';
import { getAccessibleRoute } from '../utils/getAccessibleRoute';

interface SettingsPermissionWrapperProps {
  children?: React.ReactNode;
}

/**
 * Wrapper for Settings page that allows access if user has permission for
 * PermissionsTab (permissions component), StatusesTab (statuses component), ContactFormTab (note-categories component),
 * or NotificationPreferencesTab (always visible for authenticated users)
 */
export function SettingsPermissionWrapper({ children }: SettingsPermissionWrapperProps) {
  const { currentUser, loading } = useUser();
  const hasPermissionsPermission = useHasPermission('permissions', 'view');
  const hasStatusesPermission = useHasStatusesPermission();
  const hasNoteCategoriesPermission = useHasNoteCategoriesPermission();
  
  // User has access if they can view permissions, statuses, note categories, or if they're authenticated (for notifications tab)
  const hasAccess = hasPermissionsPermission || hasStatusesPermission || hasNoteCategoriesPermission || !!currentUser;

  // Show loading while user data is being fetched
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>Chargement...</div>
      </div>
    );
  }

  // If no user, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // If no access to any tab, redirect to an accessible route
  if (!hasAccess) {
    const accessibleRoute = getAccessibleRoute(currentUser);
    return <Navigate to={accessibleRoute} replace />;
  }

  return <>{children}</>;
}

export default SettingsPermissionWrapper;

