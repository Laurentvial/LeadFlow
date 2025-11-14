import { useUser } from '../contexts/UserContext';

export interface Permission {
  id: string;
  component: string;
  fieldName: string | null;
  action: 'view' | 'create' | 'edit' | 'delete';
  statusId: string | null;
}

/**
 * Hook to check if user has a specific permission
 * @param component - The component name (e.g., 'dashboard', 'contact')
 * @param action - The action to check (e.g., 'view', 'create', 'edit', 'delete')
 * @param fieldName - Optional field name for field-level permissions
 * @param statusId - Optional status ID for status-specific permissions
 * @returns boolean indicating if user has the permission
 */
export function useHasPermission(
  component: string,
  action: 'view' | 'create' | 'edit' | 'delete',
  fieldName?: string | null,
  statusId?: string | null
): boolean {
  const { currentUser } = useUser();

  if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
    return false;
  }

  const permissions: Permission[] = currentUser.permissions;

  // Check if user has the permission
  return permissions.some((perm) => {
    const componentMatch = perm.component === component;
    const actionMatch = perm.action === action;
    const fieldMatch = fieldName === undefined || perm.fieldName === fieldName;
    const statusMatch = statusId === undefined || perm.statusId === statusId;

    return componentMatch && actionMatch && fieldMatch && statusMatch;
  });
}

/**
 * Hook to get all permissions for a specific component
 * @param component - The component name
 * @returns Array of permissions for the component
 */
export function useComponentPermissions(component: string): Permission[] {
  const { currentUser } = useUser();

  if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
    return [];
  }

  const permissions: Permission[] = currentUser.permissions;
  return permissions.filter((perm) => perm.component === component);
}

