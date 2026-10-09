import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  syncStatusNotifications,
} from '../services/notifications';

describe('notifications', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('no notifica en la primera sincronización (establece la línea base)', async () => {
    await syncStatusNotifications([{ id: 1, status: 'Pendiente' }]);

    expect(await getNotifications()).toHaveLength(0);
  });

  it('crea una notificación cuando cambia el estado de un reporte', async () => {
    await syncStatusNotifications([{ id: 1, status: 'Pendiente' }]);
    await syncStatusNotifications([{ id: 1, status: 'Resuelto' }]);

    const list = await getNotifications();
    expect(list).toHaveLength(1);
    expect(list[0].message).toBe('Tu reporte pasó a "Resuelto".');
    expect(await getUnreadCount()).toBe(1);
  });

  it('no duplica la misma notificación', async () => {
    await syncStatusNotifications([{ id: 1, status: 'Pendiente' }]);
    await syncStatusNotifications([{ id: 1, status: 'Resuelto' }]);
    await syncStatusNotifications([{ id: 1, status: 'Resuelto' }]);

    expect(await getNotifications()).toHaveLength(1);
  });

  it('markAllRead marca todas como leídas', async () => {
    await syncStatusNotifications([{ id: 1, status: 'Pendiente' }]);
    await syncStatusNotifications([{ id: 1, status: 'Resuelto' }]);

    await markAllRead();

    expect(await getUnreadCount()).toBe(0);
  });
});
