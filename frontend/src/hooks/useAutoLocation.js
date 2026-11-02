import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

const LAST_KNOWN_MAX_AGE_MS = 60 * 1000;

export default function useAutoLocation() {
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(true);
  const [error, setError] = useState(null);
  const [permanentlyDenied, setPermanentlyDenied] = useState(false);

  const refresh = useCallback(async () => {
    setLocating(true);
    setError(null);
    let hasPosition = false;

    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermanentlyDenied(!canAskAgain);
        setError('permission');
        return;
      }
      setPermanentlyDenied(false);

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setError('services');
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
      if (lastKnown?.coords) {
        setLocation(lastKnown.coords);
        hasPosition = true;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (current?.coords) setLocation(current.coords);
    } catch {
      if (!hasPosition) setError('unavailable');
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { location, locating, error, permanentlyDenied, refresh };
}
