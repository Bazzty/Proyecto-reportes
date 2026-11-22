import { useEffect } from 'react';
import { AppState } from 'react-native';
import useNetworkStatus from './useNetworkStatus';
import { syncPending, getPendingCount } from '../services/offlineQueue';

// Reintento periódico: un 5xx/timeout estando "conectado" no cambia la red ni el AppState.
const RETRY_INTERVAL_MS = 60000;

export default function useOfflineSync() {
  const { isConnected } = useNetworkStatus();

  useEffect(() => {
    if (isConnected) {
      syncPending().catch(() => {});
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) return undefined;
    const timer = setInterval(async () => {
      try {
        if ((await getPendingCount()) > 0) await syncPending();
      } catch {
        // Se reintenta en el siguiente ciclo.
      }
    }, RETRY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isConnected]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncPending().catch(() => {});
      }
    });
    return () => subscription.remove();
  }, []);

  return { isConnected };
}
