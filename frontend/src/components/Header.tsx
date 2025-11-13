import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from './ui/dropdown-menu';
import { Bell, User, LogOut } from 'lucide-react';
import React from 'react';
import '../styles/Header.css';

interface HeaderProps {
  user: any;
}

export function Header({ user }: HeaderProps) {
  const navigate = useNavigate();

  // Returns full name only if both firstName and lastName exist and are non-empty (after trimming)
  function getFullName() {
    const firstName = (user?.firstName || '').trim();
    const lastName = (user?.lastName || '').trim();
    // Show fullname only if at least one is non-empty
    if (firstName || lastName) {
      return `${firstName}${firstName && lastName ? ' ' : ''}${lastName}`.trim();
    }
    // If no names, fallback to empty string
    return '';
  }

  function handleLogout() {
    navigate('/logout');
  }

  // Use full name if available, otherwise fallback to email/userId/'User' for User Menu label
  const fullName = getFullName();
  const mainUserDisplay = fullName || user?.email || user?.userId || 'User';

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-brand">
            <div className="header-logo">
            </div>
            <div className="header-title-section">
              <img src="../static/images/logo.png" alt="Logo" className="header-logo-img" style={{ maxHeight: 100, maxWidth: 140 }} />
              <p className="header-subtitle">Protected Asset Network Offering Robust All‑class Market Access</p>
            </div>
          </div>
          
          <div className="header-actions">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="header-button header-button-notifications">
                  <Bell className="header-icon" />
                  {/* Notifications badge logic could go here */}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="header-dropdown" align="end">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="header-notification-empty">
                  Aucune notification
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="header-button header-button-user">
                  <User className="header-icon" />
                  <span className="header-user-name">
                    {/* Show full name using Django Auth data (firstName/lastName from serializer) */}
                    {mainUserDisplay}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="header-dropdown" align="end">
                <DropdownMenuLabel>
                  <div className="header-user-info">
                    <p className="header-user-name-full">
                      {fullName || user?.email || 'Email introuvable'}
                    </p>
                    {/* Show email if full name is available, otherwise it's already shown above */}
                    {fullName && user?.email && (
                      <p className="header-user-email">{user?.email}</p>
                    )}
                    {user?.role && <p className="header-user-role">{user?.role}</p>}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="header-logout">
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;