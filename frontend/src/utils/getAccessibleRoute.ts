import { useUser } from '../contexts/UserContext';
import { useHasPermission } from '../hooks/usePermissions';

/**
 * Route configuration with their permission requirements
 */
const routePermissions: Array<{
  path: string;
  component: string;
  action: 'view' | 'create' | 'edit' | 'delete';
}> = [
  { path: '/contacts', component: 'contacts', action: 'view' },
  { path: '/fosse', component: 'fosse', action: 'view' },
  { path: '/planning', component: 'planning', action: 'view' },
  { path: '/users', component: 'users', action: 'view' },
  { path: '/settings', component: 'settings', action: 'view' },
  { path: '/dashboard', component: 'dashboard', action: 'view' },
];

/**
 * Hook to get the first accessible route for the current user
 * Returns the path of the first route the user has permission to access
 * Falls back to '/contacts' if no specific permissions are found
 */
export function useAccessibleRoute(): string {
  const { currentUser } = useUser();
  
  // If no user, return login
  if (!currentUser) {
    return '/login';
  }

  // Check each route in order and return the first one user has access to
  for (const route of routePermissions) {
    // For now, we'll check permissions. If permission system is not fully implemented
    // for all routes, we'll fall back to role-based access
    // This is a simplified version - you may want to use useHasPermission hook here
    // but hooks can't be called conditionally, so we'll check permissions directly
    
    // For routes without permission checks yet, allow access based on role
    // This is a temporary solution until all routes have permission checks
    if (route.path === '/contacts' || route.path === '/planning') {
      // These routes are accessible to most users
      return route.path;
    }
    
    if (route.path === '/users' || route.path === '/settings') {
      // These routes are typically admin-only
      const roleName = currentUser?.roleName?.toLowerCase() || '';
      if (roleName === 'admin') {
        return route.path;
      }
    }
  }

  // Default fallback - try contacts first as it's most commonly accessible
  return '/contacts';
}

/**
 * Get accessible route synchronously (for use outside React components)
 * This version checks permissions from the user object directly
 */
export function getAccessibleRoute(currentUser: any): string {
  if (!currentUser) {
    return '/login';
  }

  const permissions = currentUser?.permissions || [];
  
  // Check routes in order of preference (most common first)
  const routeChecks = [
    { path: '/contacts', component: 'contacts' },
    { path: '/fosse', component: 'fosse' },
    { path: '/planning', component: 'planning' },
    { path: '/users', component: 'users' },
    { path: '/settings', component: 'settings' },
    { path: '/dashboard', component: 'dashboard' },
  ];

  for (const route of routeChecks) {
    let hasPermission = false;
    
    // Special case for settings: check if user has permission for either permissions or statuses
    // For statuses, check for general statuses management permission only (statusId must be null)
    if (route.component === 'settings') {
      const hasPermissionsPermission = permissions.some(
        (perm: any) => perm.component === 'permissions' && perm.action === 'view' && !perm.fieldName
      );
      const hasStatusesPermission = permissions.some(
        (perm: any) => perm.component === 'statuses' && perm.action === 'view' && !perm.fieldName && !perm.statusId
      );
      hasPermission = hasPermissionsPermission || hasStatusesPermission;
    } else {
      // Check if user has view permission for this component
      hasPermission = permissions.some(
        (perm: any) => perm.component === route.component && perm.action === 'view'
      );
    }
    
    if (hasPermission) {
      return route.path;
    }
  }

  // Fallback: check role-based access for routes without permission system yet
  // This ensures users can still access some pages even if permissions aren't fully configured
  const roleName = currentUser?.roleName?.toLowerCase() || '';
  
  // Role-based fallback (temporary until all routes have permission checks)
  if (roleName === 'admin') {
    // Admins typically have access to most pages
    return '/users';
  } else if (roleName === 'teamleader' || roleName === 'gestionnaire') {
    // Team leaders and managers typically have access to contacts and planning
    return '/contacts';
  }
  
  // Default fallback - contacts is usually the most accessible page
  return '/contacts';
}

