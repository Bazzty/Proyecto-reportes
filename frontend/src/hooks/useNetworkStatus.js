import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export const isOnline = (state) =>
  Boolean(state?.isConnected) && state?.isInternetReachable !== false;

export default function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    let active = true;

    Network.getNetworkStateAsync()
      .then((state) => { if (active) setIsConnected(isOnline(state)); })
      .catch(() => {});

    const subscription = Network.addNetworkStateListener((state) => {
      setIsConnected(isOnline(state));
    });

    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  return { isConnected };
}
