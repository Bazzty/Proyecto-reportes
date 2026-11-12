import { useEffect, useRef } from 'react';
import api from '../services/api';

const POLL_MS = 20000;
const POLL_TIMEOUT_MS = 10000;

// Consulta la página 1 del listado cada 20 s mientras `enabled`. No toca la lista: avisa con
// `onResult({ newCount, counts })` cuántos reportes de esa página son más nuevos (id mayor) que el
// más nuevo ya visto (`newestIdRef`). Comparar por id y no por "no está en la lista" evita contar
// como nuevos los reportes de la página 2 que suben a la 1 cuando el admin modera la cola.
// Mismo patrón que el polling de HomeScreen: cada ejecución del efecto tiene su propio
// AbortController y guarda de petición en vuelo; al pausar, desmontar o cambiar los filtros se
// cancela y se descarta la respuesta. El contador de la lista (requestRef de la pantalla) no se
// comparte: el polling usa solo `listVersionRef` para saber si la lista se recargó entretanto.
export default function useReportsPolling({ enabled, params, listVersionRef, newestIdRef, onResult }) {
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  // Los filtros llegan serializados para que el efecto solo se reinicie cuando cambian de verdad.
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    const baseParams = JSON.parse(paramsKey);
    let inFlight = false;

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      const listVersion = listVersionRef.current;
      try {
        const res = await api.get('/admin/reports', {
          params: { ...baseParams, page: 1 },
          signal,
          timeout: POLL_TIMEOUT_MS,
        });
        // Obsoleta: se canceló el efecto o la lista se recargó mientras viajaba.
        if (signal.aborted || listVersion !== listVersionRef.current) return;
        const rows = res.data?.data ?? [];
        const newCount = rows.filter(r => r.id > newestIdRef.current).length;
        onResultRef.current({ newCount, counts: res.data?.meta?.counts ?? null });
      } catch {
        // Un fallo aislado no importa: se vuelve a intentar en el próximo ciclo.
      } finally {
        inFlight = false;
      }
    };

    const interval = setInterval(poll, POLL_MS);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [enabled, paramsKey, listVersionRef, newestIdRef]);
}
