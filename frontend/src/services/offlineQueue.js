import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';
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

// Relee el storage antes de escribir: un `enqueue` ocurrido durante un sync no se pierde.
const removeFromQueue = async (localId) => {
  const fresh = await readQueue();
  const item = fresh.find((q) => q.localId === localId);
  await writeQueue(fresh.filter((q) => q.localId !== localId));
  if (item) await removePhoto(item.photoUri);
};

const markFailed = async (localId, reason) => {
  const fresh = await readQueue();
  await writeQueue(fresh.map((q) => (
    q.localId === localId ? { ...q, failed: true, failedReason: reason } : q
  )));
};

export const getPending = () => readQueue();

export const getPendingCount = async () => (await readQueue()).filter((q) => !q.failed).length;

export const removeItem = (localId) => removeFromQueue(localId);

export const clearQueue = async () => {
  const fresh = await readQueue();
  await Promise.all(fresh.map((q) => removePhoto(q.photoUri)));
  await writeQueue([]);
};

export const enqueue = async ({ description, latitude, longitude, categoryId, photoUri, clientUuid }) => {
  const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const uuid = clientUuid || randomUUID();
  const storedPhotoUri = await persistPhoto(localId, photoUri);

  const queue = await readQueue();
  queue.push({
    localId,
    clientUuid: uuid,
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
  if (syncing) return { synced: 0, remaining: (await readQueue()).filter((q) => !q.failed).length };

  syncing = true;
  emit();
  let synced = 0;
  const initial = await readQueue();

  try {
    for (const item of initial) {
      if (item.failed) continue;

      try {
        const form = new FormData();
        form.append('description', item.description);
        form.append('latitude', String(item.latitude));
        form.append('longitude', String(item.longitude));
        form.append('category_id', String(item.categoryId));
        if (item.clientUuid) {
          form.append('client_uuid', item.clientUuid);
        }
        if (item.photoUri) {
          form.append('photo', { uri: item.photoUri, type: 'image/jpeg', name: 'reporte.jpg' });
        }

        await api.post('/reports', form, { headers: { 'Content-Type': 'multipart/form-data' } });

        await removeFromQueue(item.localId);
        synced += 1;
      } catch (error) {
        const status = error.response?.status;

        // Sin sesión válida no tiene sentido seguir intentando: se reintenta tras iniciar sesión.
        if (status === 401) break;

        // Error de datos (422/413/400…): reintentar nunca lo va a resolver → se marca fallido.
        if (status && status >= 400 && status < 500) {
          await markFailed(item.localId, error.response?.data?.message || `Error ${status}`);
        }

        // Errores de red o 5xx: se dejan en la cola para reintentar más tarde.
      }
    }
  } finally {
    syncing = false;
    emit();
  }

  return { synced, remaining: (await readQueue()).filter((q) => !q.failed).length };
};
