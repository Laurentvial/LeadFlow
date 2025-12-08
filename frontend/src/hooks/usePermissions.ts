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

/**
 * Hook to check if user has permission to view the statuses management page
 * Returns true only if user has the general 'statuses' view permission (no statusId)
 * Note: This is different from contact status permissions (with statusId) which are
 * for viewing contacts with specific statuses, not for managing statuses
 * @returns boolean indicating if user has statuses management permission
 */
export function useHasStatusesPermission(): boolean {
  const { currentUser } = useUser();

  if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
    return false;
  }

  const permissions: Permission[] = currentUser.permissions;

  // Check if user has the general 'statuses' view permission (statusId must be null)
  // This is for managing statuses, not for viewing contacts with specific statuses
  return permissions.some((perm) => {
    return perm.component === 'statuses' && 
           perm.action === 'view' && 
           !perm.fieldName && // Exclude field-level permissions
           !perm.statusId; // Only general statuses permission, not contact status permissions
  });
}

/**
 * Hook to check if user has permission to view the note categories (Fiche contact) management page
 * Returns true only if user has the general 'note_categories' view permission
 * @returns boolean indicating if user has note categories management permission
 */
export function useHasNoteCategoriesPermission(): boolean {
  const { currentUser } = useUser();

  if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
    return false;
  }

  const permissions: Permission[] = currentUser.permissions;

  // Check if user has the general 'note_categories' view permission
  return permissions.some((perm) => {
    return perm.component === 'note_categories' && 
           perm.action === 'view' && 
           !perm.fieldName && // Exclude field-level permissions
           !perm.statusId; // Only general note_categories permission
  });
}

/**
 * Hook to check if user has permission to view the permissions management page
 * Returns true only if user has the general 'permissions' view permission (no fieldName or statusId)
 * @returns boolean indicating if user has permissions management permission
 */
export function useHasPermissionsPermission(): boolean {
  const { currentUser } = useUser();

  if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
    return false;
  }

  const permissions: Permission[] = currentUser.permissions;

  // Check if user has the general 'permissions' view permission
  return permissions.some((perm) => {
    return perm.component === 'permissions' && 
           perm.action === 'view' && 
           !perm.fieldName && // Exclude field-level permissions
           !perm.statusId; // Only general permissions permission
  });
}

/**
 * Hook to check if user has permission to view the notifications (Notifications) management page
 * Returns true only if user has the general 'notifications' view permission
 * @returns boolean indicating if user has notifications management permission
 */
export function useHasNotificationsPermission(): boolean {
  const { currentUser } = useUser();

  if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
    return false;
  }

  const permissions: Permission[] = currentUser.permissions;

  // Check if user has the general 'notifications' view permission
  return permissions.some((perm) => {
    return perm.component === 'notifications' && 
           perm.action === 'view' && 
           !perm.fieldName && // Exclude field-level permissions
           !perm.statusId; // Only general notifications permission
  });
}

/**
 * Hook to check if user has permission for a specific note category
 * @param categoryId - The category ID
 * @param action - The action to check (e.g., 'view', 'create', 'edit', 'delete')
 * @returns boolean indicating if user has the permission for this category
 */
export function useHasNoteCategoryPermission(
  categoryId: string | null,
  action: 'view' | 'create' | 'edit' | 'delete'
): boolean {
  const { currentUser } = useUser();

  if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
    return false;
  }

  if (!categoryId) {
    return false;
  }

  const permissions: Permission[] = currentUser.permissions;

  // Check if user has permission for this specific category (categoryId stored in fieldName)
  return permissions.some((perm) => {
    return perm.component === 'note_categories' && 
           perm.action === action && 
           perm.fieldName === categoryId &&
           !perm.statusId;
  });
}

/**
 * Hook to get all category IDs the user has view permission for
 * @returns Array of category IDs the user can view
 */
export function useAccessibleNoteCategoryIds(): string[] {
  const { currentUser } = useUser();

  if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
    return [];
  }

  const permissions: Permission[] = currentUser.permissions;

  // Get all category IDs (stored in fieldName) where user has view permission
  const categoryIds = permissions
    .filter((perm) => {
      return perm.component === 'note_categories' && 
             perm.action === 'view' && 
             perm.fieldName !== null &&
             !perm.statusId;
    })
    .map((perm) => perm.fieldName!)
    .filter((id): id is string => id !== null);

  // Remove duplicates
  return Array.from(new Set(categoryIds));
}

/**
 * Hook to check if user has permission to view the Fosse settings page
 * Returns true only if user has the general 'permissions' view permission
 * (Fosse settings are managed through the permissions system)
 * @returns boolean indicating if user has Fosse settings management permission
 */
export function useHasFosseSettingsPermission(): boolean {
  const { currentUser } = useUser();

  if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
    return false;
  }

  const permissions: Permission[] = currentUser.permissions;

  // Check if user has the general 'permissions' view permission
  // (Fosse settings are part of the permissions/settings system)
  return permissions.some((perm) => {
    return perm.component === 'permissions' && 
           perm.action === 'view' && 
           !perm.fieldName && // Exclude field-level permissions
           !perm.statusId; // Only general permissions permission
  });
}

