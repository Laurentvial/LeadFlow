import { useState, useEffect } from 'react';
import { apiCall, clearApiCache } from '../utils/api';
import { ACCESS_TOKEN } from '../utils/constants';

export function useStatuses() {
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatuses();
  }, []);

  async function loadStatuses() {
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
      const data = await apiCall('/api/statuses/');
      setStatuses(data.statuses || []);
    } catch (err: any) {
      // Don't log 401 errors if we're redirecting to login (expected behavior)
      if (err?.status === 401 && err?.isRedirecting) {
        setLoading(false);
        return;
      }
      setError(err.message || 'Error loading statuses');
      console.error('Error loading statuses:', err);
    } finally {
      setLoading(false);
    }
  }

  const reload = async () => {
    clearApiCache('/api/statuses/');
    await loadStatuses();
  };

  return { statuses, loading, error, reload };
}

