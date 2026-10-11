import { useEffect } from 'react';
import { AppState } from 'react-native';
import useNetworkStatus from './useNetworkStatus';
import { syncPending } from '../services/offlineQueue';

export default function useOfflineSync() {
  const { isConnected } = useNetworkStatus();

  useEffect(() => {
    if (isConnected) {
      syncPending().catch(() => {});
    }
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
