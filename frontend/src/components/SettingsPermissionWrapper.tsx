import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useHasPermission } from '../hooks/usePermissions';
import { getAccessibleRoute } from '../utils/getAccessibleRoute';

interface SettingsPermissionWrapperProps {
  children?: React.ReactNode;
}

/**
 * Wrapper for Settings page that allows access if user has permission for
 * either PermissionsTab (permissions component) or StatusesTab (statuses component)
 */
export function SettingsPermissionWrapper({ children }: SettingsPermissionWrapperProps) {
  const { currentUser, loading } = useUser();
  const hasPermissionsPermission = useHasPermission('permissions', 'view');
  const hasStatusesPermission = useHasPermission('statuses', 'view');
  
  // User has access if they can view either permissions or statuses
  const hasAccess = hasPermissionsPermission || hasStatusesPermission;

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

  // If no access to either tab, redirect to an accessible route
  if (!hasAccess) {
    const accessibleRoute = getAccessibleRoute(currentUser);
    return <Navigate to={accessibleRoute} replace />;
  }

  return <>{children}</>;
}

export default SettingsPermissionWrapper;

