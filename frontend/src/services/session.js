import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAuthToken } from './api';
import { clearQueue } from './offlineQueue';
import { clearNotifications } from './notifications';

// Claves de AsyncStorage que pertenecen a la sesión del usuario.
export const SESSION_KEYS = ['token', 'userName', 'userId', 'isAdmin', 'reportStatusSnapshot'];

// Borra todo lo que es del usuario: la cola offline, las notificaciones y los datos de sesión.
// Se usa al cerrar sesión y cuando el token vence (401), para que un segundo usuario en el mismo
// dispositivo no publique los reportes pendientes del anterior ni vea sus notificaciones.
export async function clearSession() {
  try { await clearQueue(); } catch { /* se sigue limpiando el resto */ }
  try { await clearNotifications(); } catch { /* se sigue limpiando el resto */ }
  await AsyncStorage.multiRemove(SESSION_KEYS);
  clearAuthToken();
}
