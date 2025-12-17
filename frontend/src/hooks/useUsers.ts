import { useState, useEffect, useCallback } from 'react';
import { apiCall, clearApiCache } from '../utils/api';
import { User } from '../types';
import { ACCESS_TOKEN } from '../utils/constants';

// Shared loading state to prevent duplicate requests
let isLoadingUsers = false;
let usersCache: User[] = [];
let usersCacheTime = 0;
const CACHE_DURATION = 5000; // 5 seconds cache

export function useUsers() {
  const [users, setUsers] = useState<User[]>(usersCache);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadUsers = useCallback(async (forceRefresh = false) => {
    // Check if user is authenticated before making API call
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (!token) {
      setLoading(false);
      setError(null);
      return;
    }

    // Prevent duplicate requests
    if (isLoadingUsers && !forceRefresh) {
      return;
    }

    // Use cache if available and fresh (unless force refresh)
    const now = Date.now();
    if (!forceRefresh && usersCache.length > 0 && (now - usersCacheTime) < CACHE_DURATION) {
      setUsers(usersCache);
      setError(null); // Clear any previous error when using cache
      return;
    }

    isLoadingUsers = true;
    setLoading(true);
    // Don't clear error immediately - we'll handle it after trying to load
    try {
      // Utiliser apiCall (fetch) au lieu de axios pour être cohérent avec les clients
      const response = await apiCall('/api/users/');
      
      // apiCall retourne directement les données JSON
      // La structure devrait être { users: [...] }
      const usersList = response?.users || response || [];
      
      // Vérifier que chaque utilisateur a les champs nécessaires
      const validUsers = (Array.isArray(usersList) ? usersList : []).filter(user => {
        const hasId = user && (user.id !== undefined && user.id !== null);
        return hasId;
      });
      
      // Sort users by creation date (most recent first)
      const sortedUsers = validUsers.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : (a.dateCreated ? new Date(a.dateCreated).getTime() : 0);
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : (b.dateCreated ? new Date(b.dateCreated).getTime() : 0);
        return dateB - dateA; // Most recent first
      });
      
      // Update cache
      usersCache = sortedUsers;
      usersCacheTime = now;
      setUsers(sortedUsers);
      setError(null); // Clear error on success
    } catch (err: any) {
      // Don't log 401 errors if we're redirecting to login (expected behavior)
      if (err?.status === 401 && err?.isRedirecting) {
        setLoading(false);
        isLoadingUsers = false;
        return;
      }
      // If we have cached data, use it even if there's an error
      if (usersCache.length > 0) {
        console.warn('Error loading users, using cached data:', err);
        setUsers(usersCache);
        setError(null); // Don't show error if we have cached data
      } else {
        // Only set error if we don't have cached data
        const errorMessage = err?.message || err?.response?.detail || 'Erreur lors du chargement des utilisateurs';
        const error = new Error(errorMessage);
        setError(error);
      }
    } finally {
      setLoading(false);
      isLoadingUsers = false;
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const deleteUser = useCallback(async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;
    
    try {
      await apiCall(`/api/users/${userId}/`, { method: 'DELETE' });
      // Clear API cache and invalidate local cache
      clearApiCache('/api/users/');
      usersCache = [];
      usersCacheTime = 0;
      await loadUsers(true);
    } catch (err) {
      throw err;
    }
  }, [loadUsers]);

  const toggleUserActive = useCallback(async (userId: string) => {
    try {
      await apiCall(`/api/users/${userId}/toggle-active/`, { method: 'POST' });
      // Clear API cache and invalidate local cache
      clearApiCache('/api/users/');
      usersCache = [];
      usersCacheTime = 0;
      await loadUsers(true);
    } catch (err) {
      throw err;
    }
  }, [loadUsers]);

  const toggleUserOtp = useCallback(async (userId: string) => {
    try {
      await apiCall(`/api/users/${userId}/toggle-otp/`, { method: 'POST' });
      // Clear API cache and invalidate local cache
      clearApiCache('/api/users/');
      usersCache = [];
      usersCacheTime = 0;
      await loadUsers(true);
    } catch (err) {
      throw err;
    }
  }, [loadUsers]);

  const refetch = useCallback(() => {
    clearApiCache('/api/users/');
    usersCache = [];
    usersCacheTime = 0;
    return loadUsers(true);
  }, [loadUsers]);

  return { users, loading, error, refetch, deleteUser, toggleUserActive, toggleUserOtp };
}

