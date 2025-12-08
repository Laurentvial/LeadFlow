import { useState, useEffect, useCallback } from 'react';
import { apiCall } from '../utils/api';
import { ACCESS_TOKEN } from '../utils/constants';

export interface Role {
  id: string;
  name: string;
  dataAccess: 'all' | 'team_only' | 'own_only';
  isTeleoperateur?: boolean;
  isConfirmateur?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface UseRolesOptions {
  autoLoad?: boolean;
}

// Shared loading state to prevent duplicate requests
let isLoadingRoles = false;
let rolesCache: Role[] = [];
let rolesCacheTime = 0;
const CACHE_DURATION = 5000; // 5 seconds cache

export function useRoles(options: UseRolesOptions = { autoLoad: true }) {
  const { autoLoad = true } = options;
  const [roles, setRoles] = useState<Role[]>(rolesCache);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadRoles = useCallback(async (forceRefresh = false) => {
    // Check if user is authenticated before making API call
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (!token) {
      setLoading(false);
      setError(null);
      return;
    }

    // Prevent duplicate requests
    if (isLoadingRoles && !forceRefresh) {
      return;
    }

    // Use cache if available and fresh (unless force refresh)
    const now = Date.now();
    if (!forceRefresh && rolesCache.length > 0 && (now - rolesCacheTime) < CACHE_DURATION) {
      setRoles(rolesCache);
      return;
    }

    isLoadingRoles = true;
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall('/api/roles/');
      const rolesData = response?.roles || response || [];
      
      // Normalize snake_case to camelCase for consistency
      const normalizedRoles = (Array.isArray(rolesData) ? rolesData : []).map((role: any) => ({
        id: role.id,
        name: role.name || '',
        dataAccess: role.dataAccess || role.data_access || 'own_only',
        isTeleoperateur: role.isTeleoperateur ?? role.is_teleoperateur ?? false,
        isConfirmateur: role.isConfirmateur ?? role.is_confirmateur ?? false,
        createdAt: role.createdAt || role.created_at || '',
        updatedAt: role.updatedAt || role.updated_at,
      })).filter(role => role.id && role.name); // Filter roles without ID or name
      
      // Update cache
      rolesCache = normalizedRoles;
      rolesCacheTime = now;
      setRoles(normalizedRoles);
    } catch (err: any) {
      // Don't log 401 errors if we're redirecting to login (expected behavior)
      if (err?.status === 401 && err?.isRedirecting) {
        setLoading(false);
        isLoadingRoles = false;
        return;
      }
      const errorMessage = err?.message || err?.response?.detail || 'Erreur lors du chargement des rôles';
      const error = new Error(errorMessage);
      setError(error);
      console.error('Error loading roles:', err);
      console.error('Error status:', err?.status);
    } finally {
      setLoading(false);
      isLoadingRoles = false;
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      loadRoles();
    }
  }, [autoLoad, loadRoles]);

  const refetch = useCallback(() => {
    rolesCache = [];
    rolesCacheTime = 0;
    return loadRoles(true);
  }, [loadRoles]);

  return { roles, loading, error, refetch };
}

