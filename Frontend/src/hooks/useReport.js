import { useCallback, useEffect, useState } from 'react';
import { getCompanyStations } from '../services/api';

export function useReport(fetcher, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message || 'Failed to load data.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, deps);

  return { data, loading, error };
}

export function useStations() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCompanyStations();
      setStations((res?.data || []).filter((s) => s.isActive !== false));
    } catch (e) {
      setError(e.message || 'Failed to load stations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  return { stations, loading, error, refetch };
}