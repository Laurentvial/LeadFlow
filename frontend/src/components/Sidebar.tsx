import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  UserCircle, 
  Settings as SettingsIcon
} from 'lucide-react';
import { useHasPermission } from '../hooks/usePermissions';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userRole: string;
}

export function Sidebar({ currentPage, onNavigate, userRole }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check permissions for all menu items (hooks must be called at top level)
  const hasDashboardPermission = useHasPermission('dashboard', 'view');
  const hasPlanningPermission = useHasPermission('planning', 'view');
  const hasContactsPermission = useHasPermission('contacts', 'view');
  const hasUsersPermission = useHasPermission('users', 'view');
  const hasPermissionsPermission = useHasPermission('permissions', 'view');
  const hasStatusesPermission = useHasPermission('statuses', 'view');
  // Settings page is accessible if user has access to either permissions or statuses
  const hasSettingsPermission = hasPermissionsPermission || hasStatusesPermission;

  const menuItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard, 
      roles: ['admin', 'teamleader', 'gestionnaire'], 
      path: '/',
      requiresPermission: true,
      permissionComponent: 'dashboard',
      permissionAction: 'view' as const,
    },
    { 
      id: 'planning', 
      label: 'Planning', 
      icon: Calendar, 
      roles: ['admin', 'teamleader', 'gestionnaire'], 
      path: '/planning',
      requiresPermission: true,
      permissionComponent: 'planning',
      permissionAction: 'view' as const,
    },
    { 
      id: 'contacts', 
      label: 'Contacts', 
      icon: UserCircle, 
      roles: ['admin', 'teamleader', 'gestionnaire'], 
      path: '/contacts',
      requiresPermission: true,
      permissionComponent: 'contacts',
      permissionAction: 'view' as const,
    },
    { 
      id: 'users-teams', 
      label: 'Utilisateurs / Équipes', 
      icon: Users, 
      roles: ['admin'], 
      path: '/users',
      requiresPermission: true,
      permissionComponent: 'users',
      permissionAction: 'view' as const,
    },
    { 
      id: 'settings', 
      label: 'Paramètres', 
      icon: SettingsIcon, 
      roles: ['admin'], 
      path: '/settings',
      requiresPermission: true,
      permissionComponent: 'settings',
      permissionAction: 'view' as const,
    },
  ];

  // Normalize user role for comparison
  // Only accept: admin, teamleader, gestionnaire
  const normalizedUserRole = userRole?.toLowerCase()?.trim() || '';
  const validRoles = ['admin', 'teamleader', 'gestionnaire'];
  const isValidRole = validRoles.includes(normalizedUserRole);
  
  // Helper function to check permission for a menu item
  const checkPermission = (item: typeof menuItems[0]): boolean => {
    if (!(item as any).requiresPermission) return true;
    
    const component = (item as any).permissionComponent;
    if (component === 'dashboard') return hasDashboardPermission;
    if (component === 'planning') return hasPlanningPermission;
    if (component === 'contacts') return hasContactsPermission;
    if (component === 'users') return hasUsersPermission;
    if (component === 'settings') return hasSettingsPermission; // This checks permissions OR statuses
    
    return true; // Default to true if permission check not implemented
  };
  
  // Filter menu items based on permissions - permissions are the primary security mechanism
  // Items are only shown if user has the required permission
  // Role check is kept as a secondary filter for additional security
  const visibleItems = menuItems.filter(item => {
    // Primary check: if item requires permission, user must have it
    // If user doesn't have permission, hide the item regardless of role
    if ((item as any).requiresPermission) {
      if (!checkPermission(item)) {
        return false; // Hide item if no permission - this is the primary security check
      }
    }
    
    // Secondary check: role-based access (only if permission check passed)
    // This provides an additional layer of security
    // Only check role if it's a valid role and item has role requirements
    if (isValidRole && item.roles.length > 0) {
      // Check if user's role matches one of the required roles for this item
      const hasRequiredRole = item.roles.some(role => role.toLowerCase() === normalizedUserRole);
      if (!hasRequiredRole) {
        return false; // Hide item if role doesn't match
      }
    }
    
    // Show item if permission check passed (and role check passed if applicable)
    return true;
  });

  const handleNavigation = (item: typeof menuItems[0]) => {
    if (item.path) {
      navigate(item.path);
    } else {
      onNavigate(item.id);
    }
  };

  return (
    <aside className="w-64 border-r border-slate-200 min-h-[calc(100vh-73px)]">
      <nav className="p-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || currentPage === item.id;
          
          return (
            <Button
              key={item.id}
              variant={isActive ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => handleNavigation(item)}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.label}
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;