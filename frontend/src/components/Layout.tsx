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

  // Map route paths to sidebar page IDs
  const getCurrentPage = () => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    if (path === '/dashboard') return 'dashboard';
    if (path === '/users') return 'users-teams';
    if (path === '/contacts') return 'contacts';
    if (path === '/planning') return 'planning';
    if (path === '/settings') return 'settings';
    if (path === '/transactions') return 'transactions';
    if (path === '/placements') return 'placements';
    if (path === '/manage/ribs') return 'manage-ribs';
    if (path === '/manage/assets') return 'manage-assets';
    if (path === '/manage/useful-links') return 'manage-links';
    return 'dashboard';
  };

  const handleNavigate = (page: string) => {
    // Sidebar will handle navigation using useNavigate internally
    // This is just a placeholder for the onNavigate prop
  };

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
      <div style={{ display: 'flex' }}>
        <Sidebar 
          currentPage={getCurrentPage()} 
          onNavigate={handleNavigate} 
          userRole={currentUser?.roleName || currentUser?.role || 'admin'} 
        />
        <div style={{ width: '100%', padding: '30px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

