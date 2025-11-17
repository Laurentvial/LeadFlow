import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';

export function useSources() {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall('/api/sources/');
      setSources(data.sources || []);
    } catch (err: any) {
      setError(err.message || 'Error loading sources');
      console.error('Error loading sources:', err);
    } finally {
      setLoading(false);
    }
  }

  return { sources, loading, error, reload: loadSources };
}

