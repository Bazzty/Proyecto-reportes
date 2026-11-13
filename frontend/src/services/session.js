import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAuthToken } from './api';
import { clearQueue } from './offlineQueue';
import { clearNotifications } from './notifications';

// Claves de AsyncStorage que pertenecen a la sesión del usuario.
export const SESSION_KEYS = ['token', 'userName', 'userId', 'isAdmin', 'reportStatusSnapshot'];

// Borra todo lo que es del usuario: la cola offline, las notificaciones y los datos de sesión.
// Se usa al cerrar sesión y cuando el token vence (401), para que un segundo usuario en el mismo
// dispositivo no publique los reportes pendientes del anterior ni vea sus notificaciones.
// Con un token vencido (`keepQueue`) la cola se conserva: son reportes del mismo usuario que se
// enviarán cuando vuelva a entrar; si entra otra cuenta, claimQueue los descarta.
export async function clearSession({ keepQueue = false } = {}) {
  if (!keepQueue) {
    try { await clearQueue(); } catch { /* se sigue limpiando el resto */ }
  }
  try { await clearNotifications(); } catch { /* se sigue limpiando el resto */ }
  await AsyncStorage.multiRemove(SESSION_KEYS);
  clearAuthToken();
}
