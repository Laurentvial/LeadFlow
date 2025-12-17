import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useHasPermission } from '../hooks/usePermissions';
import { getAccessibleRoute } from '../utils/getAccessibleRoute';

interface PermissionProtectedRouteProps {
  children?: React.ReactNode;
  component: string;
  action: 'view' | 'create' | 'edit' | 'delete';
  fieldName?: string | null;
  statusId?: string | null;
  fallbackPath?: string;
}

/**
 * Protected route that checks if user has the required permission
 * If user doesn't have permission, redirects to an accessible route
 */
export function PermissionProtectedRoute({
  children,
  component,
  action,
  fieldName,
  statusId,
  fallbackPath,
}: PermissionProtectedRouteProps) {
  const { currentUser, loading } = useUser();
  
  // For page-level permissions (when fieldName/statusId are not provided),
  // we want to match only general permissions (where fieldName and statusId are null)
  // If fieldName/statusId are explicitly provided (even if null), use them as-is
  let hasPermission: boolean;
  if (fieldName === undefined && statusId === undefined) {
    // Page-level permission check: only match permissions without fieldName or statusId
    hasPermission = useHasPermission(component, action, null, null);
  } else {
    // Field-level or status-level permission check: use provided values
    hasPermission = useHasPermission(component, action, fieldName, statusId);
  }

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
    return <Navigate to="/login/otp" replace />;
  }

  // If no permission, redirect to an accessible route
  if (!hasPermission) {
    const accessibleRoute = fallbackPath || getAccessibleRoute(currentUser);
    return <Navigate to={accessibleRoute} replace />;
  }

  return <>{children}</>;
}

export default PermissionProtectedRoute;

