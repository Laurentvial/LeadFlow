import { useState, useEffect } from 'react';
import { apiCall, clearApiCache } from '../utils/api';
import { ACCESS_TOKEN } from '../utils/constants';

export function useSources() {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    // Check if user is authenticated before making API call
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (!token) {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiCall('/api/sources/');
      setSources(data.sources || []);
    } catch (err: any) {
      // Don't log 401 errors if we're redirecting to login (expected behavior)
      if (err?.status === 401 && err?.isRedirecting) {
        setLoading(false);
        return;
      }
      setError(err.message || 'Error loading sources');
      console.error('Error loading sources:', err);
    } finally {
      setLoading(false);
    }
  }

  const reload = async () => {
    clearApiCache('/api/sources/');
    await loadSources();
  };

  return { sources, loading, error, reload };
}

