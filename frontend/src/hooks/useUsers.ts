import { useState, useEffect, useCallback } from 'react';
import { apiCall, clearApiCache } from '../utils/api';
import { User } from '../types';

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
    // Prevent duplicate requests
    if (isLoadingUsers && !forceRefresh) {
      return;
    }

    // Use cache if available and fresh (unless force refresh)
    const now = Date.now();
    if (!forceRefresh && usersCache.length > 0 && (now - usersCacheTime) < CACHE_DURATION) {
      setUsers(usersCache);
      return;
    }

    isLoadingUsers = true;
    setLoading(true);
    setError(null);
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
      
      // Update cache
      usersCache = validUsers;
      usersCacheTime = now;
      setUsers(validUsers);
    } catch (err: any) {
      const errorMessage = err?.message || err?.response?.detail || 'Erreur lors du chargement des utilisateurs';
      const error = new Error(errorMessage);
      setError(error);
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

  const refetch = useCallback(() => {
    clearApiCache('/api/users/');
    usersCache = [];
    usersCacheTime = 0;
    return loadUsers(true);
  }, [loadUsers]);

  return { users, loading, error, refetch, deleteUser, toggleUserActive };
}

