import { useState, useEffect, useCallback } from 'react';
import { apiCall } from '../utils/api';
import { Team } from '../types';

interface UseTeamsOptions {
  autoLoad?: boolean;
}

// Shared loading state to prevent duplicate requests
let isLoadingTeams = false;
let teamsCache: Team[] = [];
let teamsCacheTime = 0;
const CACHE_DURATION = 5000; // 5 seconds cache

export function useTeams(options: UseTeamsOptions = { autoLoad: true }) {
  const { autoLoad = true } = options;
  const [teams, setTeams] = useState<Team[]>(teamsCache);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadTeams = useCallback(async (forceRefresh = false) => {
    // Prevent duplicate requests
    if (isLoadingTeams && !forceRefresh) {
      return;
    }

    // Use cache if available and fresh (unless force refresh)
    const now = Date.now();
    if (!forceRefresh && teamsCache.length > 0 && (now - teamsCacheTime) < CACHE_DURATION) {
      setTeams(teamsCache);
      return;
    }

    isLoadingTeams = true;
    setLoading(true);
    setError(null);
    try {
      // Utiliser apiCall (fetch) au lieu de axios pour être cohérent
      const response = await apiCall('/api/teams/');
      const teamsData = response?.teams || response || [];
      
      // Normalize snake_case to camelCase for consistency
      const normalizedTeams = (Array.isArray(teamsData) ? teamsData : []).map((team: any) => ({
        ...team,
        id: team.id,
        name: team.name || '',
        createdAt: team.created_at || team.createdAt,
        updatedAt: team.updated_at || team.updatedAt,
      })).filter(team => team.id); // Filtrer les équipes sans ID
      
      // Update cache
      teamsCache = normalizedTeams;
      teamsCacheTime = now;
      setTeams(normalizedTeams);
    } catch (err: any) {
      const errorMessage = err?.message || err?.response?.detail || 'Erreur lors du chargement des équipes';
      const error = new Error(errorMessage);
      setError(error);
      console.error('Error loading teams:', err);
      console.error('Error status:', err?.status);
    } finally {
      setLoading(false);
      isLoadingTeams = false;
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      loadTeams();
    }
  }, [autoLoad, loadTeams]);

  const refetch = useCallback(() => {
    teamsCache = [];
    teamsCacheTime = 0;
    return loadTeams(true);
  }, [loadTeams]);

  return { teams, loading, error, refetch };
}

