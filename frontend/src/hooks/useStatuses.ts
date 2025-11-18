import { useState, useEffect } from 'react';
import { apiCall, clearApiCache } from '../utils/api';

export function useStatuses() {
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatuses();
  }, []);

  async function loadStatuses() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall('/api/statuses/');
      setStatuses(data.statuses || []);
    } catch (err: any) {
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

