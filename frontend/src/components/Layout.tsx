import React from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useUser } from '../contexts/UserContext';

interface LayoutProps {
  children?: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { currentUser, loading } = useUser();
  const location = useLocation();

  // Check if current route is a contact detail page
  const isContactDetailPage = /^\/contacts\/[^/]+$/.test(location.pathname);

  // Map route paths to sidebar page IDs
  const getCurrentPage = () => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    if (path === '/dashboard') return 'dashboard';
    if (path === '/users') return 'users-teams';
    if (path === '/contacts') return 'contacts';
    if (path === '/fosse') return 'fosse';
    if (path === '/planning') return 'planning';
    if (path === '/mails') return 'mails';
    if (path === '/chat') return 'chat';
    if (path === '/settings') return 'settings';
    return 'dashboard';
  };

  const handleNavigate = (page: string) => {
    // Sidebar will handle navigation using useNavigate internally
    // This is just a placeholder for the onNavigate prop
  };

  // For contact detail pages, render without Header and Sidebar (and without loading check)
  if (isContactDetailPage) {
    return (
      <div style={{ display: 'block', minHeight: '100vh' }}>
        {children}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>Chargement...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'block', minHeight: '100vh' }}>
      <Header user={currentUser} />
      <div style={{ display: 'flex', width: '100%', overflow: 'hidden' }}>
        <Sidebar 
          currentPage={getCurrentPage()} 
          onNavigate={handleNavigate} 
          userRole={currentUser?.roleName || currentUser?.role || 'admin'} 
        />
        <div style={{ flex: 1, minWidth: 0, padding: '30px', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

