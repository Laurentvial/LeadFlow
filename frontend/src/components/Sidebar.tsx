import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  UserCircle, 
  CreditCard, 
  Mail, 
  TrendingUp,
  Package,
  Wallet,
  Link as LinkIcon
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userRole: string;
}

export function Sidebar({ currentPage, onNavigate, userRole }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'teamleader', 'gestionnaire'], path: '/' },
    { id: 'planning', label: 'Planning', icon: Calendar, roles: ['admin', 'teamleader', 'gestionnaire'], path: '/planning' },
    { id: 'users-teams', label: 'Utilisateurs / Équipes', icon: Users, roles: ['admin'], path: '/users' },
    { id: 'clients', label: 'Clients', icon: UserCircle, roles: ['admin', 'teamleader', 'gestionnaire'], path: '/clients' },
    { id: 'transactions', label: 'Transactions', icon: CreditCard, roles: ['admin', 'teamleader', 'gestionnaire'], path: '/transactions' },
    { id: 'messagerie', label: 'Messagerie', icon: Mail, roles: ['admin', 'teamleader', 'gestionnaire'], path: '/messagerie' },
    { id: 'manage-assets', label: 'Gestion Actifs', icon: TrendingUp, roles: ['admin'], path: '/manage/assets' },
    { id: 'placements', label: 'Placements', icon: Package, roles: ['admin'], path: '/placements' },
    { id: 'manage-ribs', label: 'Gestion RIBs', icon: Wallet, roles: ['admin'], path: '/manage/ribs' },
    { id: 'manage-links', label: 'Gestion Liens Utiles', icon: LinkIcon, roles: ['admin'], path: '/manage/useful-links' },
  ];

  // Normalize user role for comparison
  // Only accept: admin, teamleader, gestionnaire
  const normalizedUserRole = userRole?.toLowerCase()?.trim() || '';
  const validRoles = ['admin', 'teamleader', 'gestionnaire'];
  const isValidRole = validRoles.includes(normalizedUserRole);
  
  // Filter menu items based on role
  let visibleItems = menuItems.filter(item => {
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