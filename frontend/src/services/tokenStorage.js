import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Token de Sanctum. En el teléfono va cifrado en el almacén seguro del sistema (Keystore en Android,
// Keychain en iOS) y no en AsyncStorage, que es texto plano. En web no hay almacén seguro: se usa
// AsyncStorage (localStorage).
const KEY = 'token';
const useSecureStore = Platform.OS !== 'web';

// Versiones anteriores lo guardaban en AsyncStorage: al leerlo se mueve al almacén seguro, así quien
// ya tenía sesión no tiene que volver a entrar.
export async function getToken() {
  if (!useSecureStore) return AsyncStorage.getItem(KEY);

  const stored = await SecureStore.getItemAsync(KEY);
  if (stored) return stored;

  const legacy = await AsyncStorage.getItem(KEY);
  if (legacy) {
    await SecureStore.setItemAsync(KEY, legacy);
    await AsyncStorage.removeItem(KEY);
  }
  return legacy;
}

export async function saveToken(token) {
  if (!useSecureStore) {
    await AsyncStorage.setItem(KEY, token);
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

// Borra las dos ubicaciones (incluida la de versiones anteriores).
export async function deleteToken() {
  await AsyncStorage.removeItem(KEY);
  if (useSecureStore) await SecureStore.deleteItemAsync(KEY);
}
