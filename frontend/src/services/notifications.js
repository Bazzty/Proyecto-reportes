import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportDisplayStatus, isValidated } from '../constants/reports';

const STORAGE_KEY = 'notifications';
const SNAPSHOT_KEY = 'reportStatusSnapshot';
const MAX_NOTIFICATIONS = 50;

const listeners = new Set();

let generation = 0; // cambia al limpiar (logout): los syncs en vuelo descartan sus escrituras
let writeChain = Promise.resolve();

// Serializa toda operación que escribe en AsyncStorage mediante una cadena de promesas
// (mismo patrón que mutateQueue en offlineQueue): un aviso nuevo no pisa ni se pierde por otra escritura.
const serialize = (operation) => {
  const run = writeChain.then(operation, operation);
  writeChain = run.then(() => undefined, () => undefined);
  return run;
};

const emit = () => { listeners.forEach((listener) => listener()); };

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const read = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const write = async (list) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  emit();
};

export const getNotifications = () => read();

export const getUnreadCount = async () => (await read()).filter((item) => !item.read).length;

export const markAllRead = () => serialize(async () => {
  const list = await read();
  if (list.every((item) => item.read)) return;
  await write(list.map((item) => ({ ...item, read: true })));
});

export const clearNotifications = () => {
  generation += 1;
  return serialize(() => write([]));
};

// Evita duplicar el mismo cambio (dos sincronizaciones simultáneas), pero solo compara con el
// último aviso del reporte: si el estado vuelve a cambiar igual que antes (A→B→A→B), se avisa de nuevo.
const pushUnique = async (notification) => {
  const list = await read();
  const lastForReport = list.find((item) => item.reportId === notification.reportId);
  if (lastForReport?.id === notification.id) return;
  await write([notification, ...list].slice(0, MAX_NOTIFICATIONS));
};

const moderationMessage = (report) => {
  switch (report.validation_status) {
    case 'valido':    return 'Tu reporte fue aprobado y ya aparece en el mapa.';
    case 'rechazado': return report.rejection_reason
      ? `Tu reporte fue rechazado: ${report.rejection_reason}`
      : 'Tu reporte fue rechazado.';
    default:          return 'Tu reporte volvió a revisión.';
  }
};

// Snapshot por reporte: { s: estado de gestión, v: moderación }. Las versiones anteriores guardaban
// solo el estado (un string): se lee como { s } y la moderación queda como línea base sin avisar.
const readEntry = (value) => (typeof value === 'string' ? { s: value } : value);

// Compara el estado actual de los reportes del usuario con el último guardado y crea una
// notificación por cada cambio: de moderación (aprobado, rechazado, vuelta a revisión) o, ya
// aprobado, de su estado de gestión.
export const syncStatusNotifications = (myReports) => {
  // La generación se captura al llamar (no al ejecutarse en la cadena): un clearNotifications
  // posterior a la llamada descarta este sync aunque aún esté en cola.
  const startedAt = generation;
  return serialize(() => syncSnapshot(myReports, startedAt));
};

const syncSnapshot = async (myReports, startedAt) => {
  let snapshot;
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    snapshot = raw ? JSON.parse(raw) : {};
  } catch {
    snapshot = {};
  }

  if (generation !== startedAt) return;

  const nextSnapshot = { ...snapshot };

  for (const report of myReports) {
    const previous = snapshot[report.id] !== undefined ? readEntry(snapshot[report.id]) : undefined;
    const current = { s: report.status, v: report.validation_status };

    if (previous !== undefined) {
      const moderationChanged = previous.v !== undefined && current.v !== undefined && previous.v !== current.v;

      if (moderationChanged) {
        // Al volver a revisión el estado también se reinicia: basta con el aviso de moderación.
        if (generation !== startedAt) return;
        await pushUnique({
          id: `validation-${report.id}-${previous.v}-${current.v}`,
          type: 'validation',
          reportId: report.id,
          message: moderationMessage(report),
          createdAt: new Date().toISOString(),
          read: false,
        });
      } else if (previous.s !== current.s && isValidated(report)) {
        if (generation !== startedAt) return;
        await pushUnique({
          id: `status-${report.id}-${previous.s}-${current.s}`,
          type: 'status',
          reportId: report.id,
          message: `Tu reporte pasó a "${reportDisplayStatus(report)}".`,
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    }

    nextSnapshot[report.id] = current;
  }

  if (generation !== startedAt) return;
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(nextSnapshot));
};
