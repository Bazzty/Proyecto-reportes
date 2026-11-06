import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// true mientras la app está en primer plano. Al montar, un estado desconocido cuenta como activo:
// solo se pausa si se sabe que está en segundo plano o inactiva.
export default function useAppActive() {
  const [state, setState] = useState(() => {
    const current = AppState.currentState;
    return current === 'background' || current === 'inactive' ? current : 'active';
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setState);
    return () => subscription?.remove?.();
  }, []);

  return state === 'active';
}
