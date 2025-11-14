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
  
  // Filter menu items based on role and permissions
  let visibleItems = menuItems.filter(item => {
    // First check if item requires permission and user has it
    if ((item as any).requiresPermission) {
      if (!checkPermission(item)) {
        return false;
      }
    }
    
    // Then check role-based access
    if (!isValidRole) return false;
    return item.roles.some(role => role.toLowerCase() === normalizedUserRole);
  });
  
  // Fallback: if no items match and we have a valid role, show all items for debugging
  // This helps identify role matching issues
  if (visibleItems.length === 0 && isValidRole) {
    console.warn('Aucun élément de menu visible pour le rôle:', userRole);
    console.warn('Affichage de tous les éléments pour débogage');
    // Show all items if role doesn't match (for debugging)
    visibleItems = menuItems;
  }
  
  // If role is invalid or undefined, show all items as fallback
  if (!isValidRole) {
    visibleItems = menuItems;
  }

  const handleNavigation = (item: typeof menuItems[0]) => {
    if (item.path) {
      navigate(item.path);
    } else {
      onNavigate(item.id);
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-73px)]">
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