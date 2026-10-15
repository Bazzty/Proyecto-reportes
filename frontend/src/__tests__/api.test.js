import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken, clearAuthToken, setUnauthorizedHandler } from '../services/api';

const rejected = api.interceptors.response.handlers[0].rejected;

describe('api service', () => {
  beforeEach(async () => {
    clearAuthToken();
    setUnauthorizedHandler(null);
    await AsyncStorage.clear();
  });

  it('setAuthToken agrega el header Authorization', () => {
    setAuthToken('abc123');
    expect(api.defaults.headers.common.Authorization).toBe('Bearer abc123');
  });

  it('clearAuthToken quita el header Authorization', () => {
    setAuthToken('abc123');
    clearAuthToken();
    expect(api.defaults.headers.common.Authorization).toBeUndefined();
  });

  it('un 401 borra el token, el header y llama al handler', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    await AsyncStorage.setItem('token', 'abc123');
    setAuthToken('abc123');

    await expect(rejected({ response: { status: 401 } })).rejects.toBeDefined();

    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(api.defaults.headers.common.Authorization).toBeUndefined();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('un error distinto de 401 no llama al handler ni borra el token', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    await AsyncStorage.setItem('token', 'abc123');

    await expect(rejected({ response: { status: 500 } })).rejects.toBeDefined();

    expect(await AsyncStorage.getItem('token')).toBe('abc123');
    expect(handler).not.toHaveBeenCalled();
  });

  it('un 401 sin handler registrado no falla y mantiene el rechazo', async () => {
    await expect(rejected({ response: { status: 401 } })).rejects.toBeDefined();
  });
});
