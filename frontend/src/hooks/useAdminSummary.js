import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

const REFRESH_DEBOUNCE_MS = 600;

// Resumen del panel. `load` pide los datos al instante (al enfocar la pantalla) y `refreshSoon`
// los pide tras una pausa corta, para agrupar varias mutaciones seguidas en una sola petición.
// Si falla, `summary` queda en null y la tarjeta se oculta sin ruido.
export default function useAdminSummary() {
  const [summary, setSummary] = useState(null);
  const requestRef = useRef(0);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const load = useCallback(() => {
    const requestId = ++requestRef.current;
    api.get('/admin/reports/summary')
      .then((res) => {
        if (mountedRef.current && requestId === requestRef.current) setSummary(res.data ?? null);
      })
      .catch(() => {
        if (mountedRef.current && requestId === requestRef.current) setSummary(null);
      });
  }, []);

  const refreshSoon = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      load();
    }, REFRESH_DEBOUNCE_MS);
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { summary, load, refreshSoon };
}
