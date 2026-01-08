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
import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import Notifications from './Notifications';
import { ContactSearchBar } from './ContactSearchBar';
import { ThemeToggle } from './ThemeToggle';
import '../styles/Header.css';

interface HeaderProps {
  user: any;
}

export function Header({ user }: HeaderProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Handle hydration to prevent mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Determine logo based on theme
  // Fallback to logo.png if logo-black.png doesn't exist or fails to load
  const getLogoSrc = () => {
    if (!mounted) return '/images/logo.png';
    if (theme === 'dark' && !logoError) {
      return '/images/logo-black.png';
    }
    return '/images/logo.png';
  };

  const handleLogoError = () => {
    setLogoError(true);
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-brand">
            <div className="header-logo">
            </div>
            <div className="header-title-section">
              <img 
                src={getLogoSrc()} 
                alt="Logo" 
                className="header-logo-img" 
                style={{ maxHeight: 100, maxWidth: 140 }} 
                onError={handleLogoError}
              />
              <p className="header-subtitle">Outil de prospecting et de gestion de clients</p>
            </div>
          </div>
          
          {/* Contact Search - Center */}
          <div className="header-search">
            <ContactSearchBar />
          </div>
          
          <div className="header-actions">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <Notifications />

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
                    {user?.roleName && <p className="header-user-role">{user?.roleName}</p>}
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