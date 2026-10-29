import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';
import api from './api';

const STORAGE_KEY = 'offlineReports';
const PHOTO_DIR = `${FileSystem.documentDirectory}pending-reports/`;

let syncing = false;
let session = 0; // cambia al limpiar la cola (logout): aborta syncs en curso
let writeChain = Promise.resolve();
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

// Serializa cualquier read-modify-write de la cola mediante una cadena de promesas:
// un `enqueue` concurrente con el fin de un sync no se pierde ni pisa escrituras.
const mutateQueue = (mutator) => {
  const op = async () => {
    const fresh = await readQueue();
    const next = await mutator(fresh);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emit();
    return next;
  };
  const run = writeChain.then(op, op);
  writeChain = run.then(() => undefined, () => undefined);
  return run;
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

const removeFromQueue = async (localId) => {
  let removed = null;
  await mutateQueue((queue) => {
    removed = queue.find((q) => q.localId === localId) ?? null;
    return queue.filter((q) => q.localId !== localId);
  });
  if (removed) await removePhoto(removed.photoUri);
};

const markFailed = (localId, reason) => mutateQueue((queue) => queue.map((q) => (
  q.localId === localId ? { ...q, failed: true, failedReason: reason } : q
)));

export const getPending = () => readQueue();

export const getPendingCount = async () => (await readQueue()).filter((q) => !q.failed).length;

export const removeItem = (localId) => removeFromQueue(localId);

export const clearQueue = async () => {
  session += 1;
  let items = [];
  await mutateQueue((queue) => { items = queue; return []; });
  await Promise.all(items.map((q) => removePhoto(q.photoUri)));
};

export const enqueue = async ({ description, latitude, longitude, categoryId, photoUri, clientUuid }) => {
  const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const uuid = clientUuid || randomUUID();
  const storedPhotoUri = await persistPhoto(localId, photoUri);

  await mutateQueue((queue) => [...queue, {
    localId,
    clientUuid: uuid,
    description,
    latitude,
    longitude,
    categoryId,
    photoUri: storedPhotoUri,
    createdAt: new Date().toISOString(),
  }]);

  return localId;
};

export const syncPending = async () => {
  if (syncing) return { synced: 0, remaining: (await readQueue()).filter((q) => !q.failed).length };

  syncing = true;
  emit();
  const mySession = session;
  let synced = 0;
  const initial = await readQueue();

  try {
    for (const item of initial) {
      // Logout (clearQueue) durante el sync: se aborta para no enviar con otra sesión.
      if (session !== mySession) break;
      if (item.failed) continue;

      // El ítem pudo haberse quitado mientras se iteraba el snapshot inicial.
      const stillQueued = (await readQueue()).some((q) => q.localId === item.localId && !q.failed);
      if (!stillQueued) continue;

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
        if (session !== mySession) break;

        const status = error.response?.status;

        // Sin sesión válida no tiene sentido seguir intentando: se reintenta tras iniciar sesión.
        if (status === 401) break;

        // Error de datos (422/413/400…): reintentar nunca lo va a resolver → se marca fallido.
        // 408 (timeout) y 429 (rate limit) son transitorios: se reintentan.
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
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
