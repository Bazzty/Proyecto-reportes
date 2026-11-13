import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getToken, saveToken, deleteToken } from '../services/tokenStorage';
import { clearSession } from '../services/session';

describe('tokenStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('guarda y lee el token en el almacén seguro', async () => {
    await saveToken('abc');

    expect(await SecureStore.getItemAsync('token')).toBe('abc');
    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(await getToken()).toBe('abc');
  });

  it('mueve al almacén seguro el token que versiones anteriores dejaron en AsyncStorage', async () => {
    await AsyncStorage.setItem('token', 'viejo');

    expect(await getToken()).toBe('viejo');
    expect(await SecureStore.getItemAsync('token')).toBe('viejo');
    expect(await AsyncStorage.getItem('token')).toBeNull();
  });

  it('sin token devuelve null', async () => {
    expect(await getToken()).toBeNull();
  });

  it('deleteToken borra las dos ubicaciones', async () => {
    await saveToken('abc');
    await AsyncStorage.setItem('token', 'viejo');

    await deleteToken();

    expect(await SecureStore.getItemAsync('token')).toBeNull();
    expect(await AsyncStorage.getItem('token')).toBeNull();
  });

  it('clearSession también borra el token del almacén seguro', async () => {
    await saveToken('abc');

    await clearSession();

    expect(await getToken()).toBeNull();
  });
});
