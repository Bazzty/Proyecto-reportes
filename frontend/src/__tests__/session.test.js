import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSession, SESSION_KEYS } from '../services/session';
import { clearAuthToken } from '../services/api';
import { clearQueue } from '../services/offlineQueue';
import { clearNotifications } from '../services/notifications';

jest.mock('../services/api', () => ({ clearAuthToken: jest.fn() }));
jest.mock('../services/offlineQueue', () => ({ clearQueue: jest.fn(async () => {}) }));
jest.mock('../services/notifications', () => ({ clearNotifications: jest.fn(async () => {}) }));

describe('clearSession', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('borra la cola offline, las notificaciones, los datos de sesión y el header', async () => {
    await AsyncStorage.multiSet(SESSION_KEYS.map((k) => [k, 'x']));
    await AsyncStorage.setItem('heatMode', 'foco');

    await clearSession();

    expect(clearQueue).toHaveBeenCalledTimes(1);
    expect(clearNotifications).toHaveBeenCalledTimes(1);
    expect(clearAuthToken).toHaveBeenCalledTimes(1);
    for (const key of SESSION_KEYS) {
      expect(await AsyncStorage.getItem(key)).toBeNull();
    }
    // Las preferencias de la pantalla no son de la sesión.
    expect(await AsyncStorage.getItem('heatMode')).toBe('foco');
  });

  it('si falla limpiar la cola igual borra el resto de la sesión', async () => {
    clearQueue.mockRejectedValueOnce(new Error('fs'));
    await AsyncStorage.setItem('token', 't');

    await clearSession();

    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(clearAuthToken).toHaveBeenCalled();
  });
});
