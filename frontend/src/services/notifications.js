import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'notifications';
const SNAPSHOT_KEY = 'reportStatusSnapshot';
const MAX_NOTIFICATIONS = 50;

const listeners = new Set();

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

export const markAllRead = async () => {
  const list = await read();
  if (list.every((item) => item.read)) return;
  await write(list.map((item) => ({ ...item, read: true })));
};

export const clearNotifications = () => write([]);

const pushUnique = async (notification) => {
  const list = await read();
  if (list.some((item) => item.id === notification.id)) return;
  await write([notification, ...list].slice(0, MAX_NOTIFICATIONS));
};

// Compara el estado actual de los reportes del usuario con el último guardado
// y crea una notificación por cada cambio de estado detectado.
export const syncStatusNotifications = async (myReports) => {
  let snapshot;
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    snapshot = raw ? JSON.parse(raw) : {};
  } catch {
    snapshot = {};
  }

  const nextSnapshot = { ...snapshot };

  for (const report of myReports) {
    const previous = snapshot[report.id];
    const current = report.status;

    if (previous !== undefined && previous !== current) {
      await pushUnique({
        id: `status-${report.id}-${current}`,
        type: 'status',
        reportId: report.id,
        message: `Tu reporte pasó a "${current}".`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    nextSnapshot[report.id] = current;
  }

  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(nextSnapshot));
};
