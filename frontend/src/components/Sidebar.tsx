import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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
import { useUser } from '../contexts/UserContext';
import { UnreadMessagesContext } from '../contexts/UnreadMessagesContext';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userRole: string;
}

const SIDEBAR_STORAGE_KEY = 'sidebar_collapsed';

export function Sidebar({ currentPage, onNavigate, userRole }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, loading: userLoading } = useUser();
  
  // Safely access unread messages context
  const unreadMessagesContext = useContext(UnreadMessagesContext);
  const totalUnreadCount = unreadMessagesContext?.totalUnreadCount || 0;
  
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
  
  // Check permissions directly from user permissions (same logic as useHasStatusesPermission)
  // This ensures permissions are checked correctly - only matches page-level permissions
  // Page-level permissions have null/undefined/empty fieldName and statusId
  const checkUserPermission = (component: string, action: string = 'view'): boolean => {
    if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
      return false;
    }
    
    return currentUser.permissions.some((perm: any) => {
      // Only match general page-level permissions (no fieldName or statusId)
      // Check that fieldName and statusId are null, undefined, or empty string
      const isPageLevelPermission = 
        (perm.fieldName === null || perm.fieldName === undefined || perm.fieldName === '') &&
        (perm.statusId === null || perm.statusId === undefined || perm.statusId === '');
      
      return perm.component === component && 
             perm.action === action &&
             isPageLevelPermission;
    });
  };
  
  // Check permissions for all menu items using direct permission check
  const hasDashboardPermission = checkUserPermission('dashboard', 'view');
  const hasPlanningPermission = checkUserPermission('planning', 'view');
  const hasContactsPermission = checkUserPermission('contacts', 'view');
  const hasFossePermission = checkUserPermission('fosse', 'view');
  const hasUsersPermission = checkUserPermission('users', 'view');
  const hasPermissionsPermission = checkUserPermission('permissions', 'view');
  const hasMailsPermission = checkUserPermission('mails', 'view');
  
  // Check statuses permission (same logic as useHasStatusesPermission)
  const hasStatusesPermission = (() => {
    if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
      return false;
    }
    return currentUser.permissions.some((perm: any) => {
      return perm.component === 'statuses' && 
             perm.action === 'view' && 
             !perm.fieldName &&
             !perm.statusId;
    });
  })();
  
  // Check note categories permission (same logic as useHasNoteCategoriesPermission)
  const hasNoteCategoriesPermission = (() => {
    if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
      return false;
    }
    return currentUser.permissions.some((perm: any) => {
      return perm.component === 'note_categories' && 
             perm.action === 'view' && 
             !perm.fieldName &&
             !perm.statusId;
    });
  })();
  
  // Check notifications permission (same logic as useHasNotificationsPermission)
  const hasNotificationsPermission = (() => {
    if (!currentUser || !currentUser.permissions || !Array.isArray(currentUser.permissions)) {
      return false;
    }
    return currentUser.permissions.some((perm: any) => {
      return perm.component === 'notifications' && 
             perm.action === 'view' && 
             !perm.fieldName &&
             !perm.statusId;
    });
  })();
  
  // Settings page is accessible if user has access to permissions, statuses, note categories, or notifications
  const hasSettingsPermission = hasPermissionsPermission || hasStatusesPermission || hasNoteCategoriesPermission || hasNotificationsPermission;
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
      icon: Users, 
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
    
    // Default to false for security - if component is not recognized, don't show it
    return false;
  };
  
  // Filter menu items based on permissions - permissions are the primary security mechanism
  // Items are only shown if user has the required permission
  // Don't filter if user is still loading
  const visibleItems = userLoading ? [] : menuItems.filter(item => {
    // If item requires permission, user must have it
    // If user doesn't have permission, hide the item
    if ((item as any).requiresPermission) {
      const hasPermission = checkPermission(item);
      if (!hasPermission) {
        return false; // Hide item if no permission
      }
    }
    
    // Show item if permission check passed (or if no permission required, like chat)
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
              const showUnreadBadge = item.id === 'chat' && totalUnreadCount > 0;
              
              const buttonContent = (
                <Button
                  key={item.id}
                  variant={isActive ? 'default' : 'ghost'}
                  className={`w-full ${isCollapsed ? 'justify-center px-0' : 'justify-start'} relative`}
                  onClick={() => handleNavigation(item)}
                >
                  <Icon className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
                  {!isCollapsed && <span>{item.label}</span>}
                  {showUnreadBadge && (
                    <Badge 
                      variant="destructive" 
                      className={`absolute ${isCollapsed ? 'top-0 right-0 h-5 w-5 p-0 flex items-center justify-center text-xs' : 'ml-auto'} rounded-full`}
                    >
                      {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                    </Badge>
                  )}
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