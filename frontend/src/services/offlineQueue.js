import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import api from './api';

const STORAGE_KEY = 'offlineReports';
const PHOTO_DIR = `${FileSystem.documentDirectory}pending-reports/`;

let syncing = false;
const listeners = new Set();

const emit = () => { listeners.forEach((listener) => listener()); };

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const isSyncing = () => syncing;

const readQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeQueue = async (queue) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  emit();
};

const persistPhoto = async (localId, uri) => {
  if (!uri) return null;
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
  const destination = `${PHOTO_DIR}${localId}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
};

const removePhoto = async (uri) => {
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // La foto ya no existe: nada que limpiar.
  }
};

export const getPending = () => readQueue();

export const getPendingCount = async () => (await readQueue()).length;

export const enqueue = async ({ description, latitude, longitude, categoryId, photoUri }) => {
  const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storedPhotoUri = await persistPhoto(localId, photoUri);

  const queue = await readQueue();
  queue.push({
    localId,
    description,
    latitude,
    longitude,
    categoryId,
    photoUri: storedPhotoUri,
    createdAt: new Date().toISOString(),
  });
  await writeQueue(queue);

  return localId;
};

export const syncPending = async () => {
  if (syncing) return { synced: 0, remaining: (await readQueue()).length };

  syncing = true;
  emit();
  let synced = 0;
  let queue = await readQueue();

  try {
    for (const item of [...queue]) {
      try {
        const form = new FormData();
        form.append('description', item.description);
        form.append('latitude', String(item.latitude));
        form.append('longitude', String(item.longitude));
        form.append('category_id', String(item.categoryId));
        if (item.photoUri) {
          form.append('photo', { uri: item.photoUri, type: 'image/jpeg', name: 'reporte.jpg' });
        }

        await api.post('/reports', form, { headers: { 'Content-Type': 'multipart/form-data' } });

        queue = queue.filter((q) => q.localId !== item.localId);
        await writeQueue(queue);
        await removePhoto(item.photoUri);
        synced += 1;
      } catch (error) {
        // Sin sesión válida no tiene sentido seguir intentando: se reintenta tras iniciar sesión.
        if (error.response?.status === 401) break;
      }
    }
  } finally {
    syncing = false;
    emit();
  }

  return { synced, remaining: queue.length };
};
