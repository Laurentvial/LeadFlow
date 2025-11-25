import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  UserCircle, 
  Settings as SettingsIcon,
  Mail,
  MessageSquare,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useHasPermission, useHasStatusesPermission, useHasNoteCategoriesPermission } from '../hooks/usePermissions';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userRole: string;
}

const SIDEBAR_STORAGE_KEY = 'sidebar_collapsed';

export function Sidebar({ currentPage, onNavigate, userRole }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };
  
  // Check permissions for all menu items (hooks must be called at top level)
  const hasDashboardPermission = useHasPermission('dashboard', 'view');
  const hasPlanningPermission = useHasPermission('planning', 'view');
  const hasContactsPermission = useHasPermission('contacts', 'view');
  const hasFossePermission = useHasPermission('fosse', 'view');
  const hasUsersPermission = useHasPermission('users', 'view');
  const hasPermissionsPermission = useHasPermission('permissions', 'view');
  const hasStatusesPermission = useHasStatusesPermission();
  const hasNoteCategoriesPermission = useHasNoteCategoriesPermission();
  const hasMailsPermission = useHasPermission('mails', 'view');
  // Settings page is accessible if user has access to permissions, statuses, or note categories
  const hasSettingsPermission = hasPermissionsPermission || hasStatusesPermission || hasNoteCategoriesPermission;
  // Chat doesn't require permission check - available to all authenticated users

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
      id: 'fosse', 
      label: 'Fosse', 
      icon: UserCircle, 
      roles: ['admin', 'teamleader', 'gestionnaire'], 
      path: '/fosse',
      requiresPermission: true,
      permissionComponent: 'fosse',
      permissionAction: 'view' as const,
    },
    { 
      id: 'mails', 
      label: 'Mails', 
      icon: Mail, 
      roles: ['admin', 'teamleader', 'gestionnaire'], 
      path: '/mails',
      requiresPermission: true,
      permissionComponent: 'mails',
      permissionAction: 'view' as const,
    },
    { 
      id: 'chat', 
      label: 'Messages', 
      icon: MessageSquare, 
      roles: ['admin', 'teamleader', 'gestionnaire'], 
      path: '/chat',
      requiresPermission: false, // Chat is available to all authenticated users
      permissionComponent: 'chat',
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
    if (component === 'fosse') return hasFossePermission;
    if (component === 'mails') return hasMailsPermission;
    if (component === 'chat') return true; // Chat is available to all authenticated users
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
    <TooltipProvider delayDuration={0}>
      <aside 
        className={`border-r border-slate-200 min-h-[calc(100vh-73px)] transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Toggle Button */}
          <div className="p-2 border-b border-slate-200 flex justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className="h-8 w-8"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{isCollapsed ? 'Déplier le menu' : 'Replier le menu'}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1 flex-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || currentPage === item.id;
              
              const buttonContent = (
                <Button
                  key={item.id}
                  variant={isActive ? 'default' : 'ghost'}
                  className={`w-full ${isCollapsed ? 'justify-center px-0' : 'justify-start'}`}
                  onClick={() => handleNavigation(item)}
                >
                  <Icon className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
                  {!isCollapsed && <span>{item.label}</span>}
                </Button>
              );

              if (isCollapsed) {
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      {buttonContent}
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return buttonContent;
            })}
          </nav>
        </div>
      </aside>
    </TooltipProvider>
  );
}

export default Sidebar;