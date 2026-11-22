import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getNotifications,
  getUnreadCount,
  clearNotifications,
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

  it('avisa de nuevo si el estado vuelve a cambiar igual que antes', async () => {
    await syncStatusNotifications([{ id: 1, status: 'Pendiente' }]);
    await syncStatusNotifications([{ id: 1, status: 'En Progreso' }]);
    await syncStatusNotifications([{ id: 1, status: 'Pendiente' }]);
    await syncStatusNotifications([{ id: 1, status: 'En Progreso' }]);

    expect(await getNotifications()).toHaveLength(3);
  });

  it('dos sincronizaciones simultáneas del mismo cambio no lo duplican', async () => {
    await syncStatusNotifications([{ id: 1, status: 'Pendiente' }]);
    await Promise.all([
      syncStatusNotifications([{ id: 1, status: 'Resuelto' }]),
      syncStatusNotifications([{ id: 1, status: 'Resuelto' }]),
    ]);

    expect(await getNotifications()).toHaveLength(1);
  });

  it('markAllRead marca todas como leídas', async () => {
    await syncStatusNotifications([{ id: 1, status: 'Pendiente' }]);
    await syncStatusNotifications([{ id: 1, status: 'Resuelto' }]);

    await markAllRead();

    expect(await getUnreadCount()).toBe(0);
  });

  it('avisa cuando un reporte es aprobado', async () => {
    await syncStatusNotifications([{ id: 1, status: 'Pendiente', validation_status: 'pendiente' }]);
    await syncStatusNotifications([{ id: 1, status: 'Pendiente', validation_status: 'valido' }]);

    const list = await getNotifications();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ type: 'validation', message: 'Tu reporte fue aprobado y ya aparece en el mapa.' });
  });

  it('avisa del rechazo con su motivo aunque el estado de gestión no cambie', async () => {
    await syncStatusNotifications([{ id: 1, status: 'Pendiente', validation_status: 'pendiente' }]);
    await syncStatusNotifications([{ id: 1, status: 'Pendiente', validation_status: 'rechazado', rejection_reason: 'Duplicado' }]);

    expect((await getNotifications())[0].message).toBe('Tu reporte fue rechazado: Duplicado');
  });

  it('deshacer una validación avisa la vuelta a revisión y no un "pasó a Pendiente"', async () => {
    await syncStatusNotifications([{ id: 1, status: 'En Progreso', validation_status: 'valido' }]);
    await syncStatusNotifications([{ id: 1, status: 'Pendiente', validation_status: 'pendiente' }]);

    const list = await getNotifications();
    expect(list).toHaveLength(1);
    expect(list[0].message).toBe('Tu reporte volvió a revisión.');
  });

  it('en un reporte aprobado, "Pendiente" se anuncia como "Aprobado"', async () => {
    await syncStatusNotifications([{ id: 1, status: 'En Progreso', validation_status: 'valido' }]);
    await syncStatusNotifications([{ id: 1, status: 'Pendiente', validation_status: 'valido' }]);

    expect((await getNotifications())[0].message).toBe('Tu reporte pasó a "Aprobado".');
  });

  it('un snapshot de la versión anterior (solo estado) no genera avisos falsos de moderación', async () => {
    await AsyncStorage.setItem('reportStatusSnapshot', JSON.stringify({ 1: 'Pendiente' }));

    await syncStatusNotifications([{ id: 1, status: 'Pendiente', validation_status: 'valido' }]);

    expect(await getNotifications()).toHaveLength(0);
  });

  it('clearNotifications durante un sync en vuelo: el sync no escribe nada después', async () => {
    await syncStatusNotifications([{ id: 1, status: 'Pendiente' }]);
    await AsyncStorage.removeItem('notifications');

    const realGet = AsyncStorage.getItem.getMockImplementation();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    jest.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(async (key) => {
      const value = await realGet(key);
      await gate;
      return value;
    });

    const syncing = syncStatusNotifications([{ id: 1, status: 'Resuelto' }]);
    const clearing = clearNotifications();
    await AsyncStorage.removeItem('reportStatusSnapshot'); // lo que hace clearSession
    release();
    await Promise.all([syncing, clearing]);

    expect(await AsyncStorage.getItem('reportStatusSnapshot')).toBeNull();
    expect(await getNotifications()).toHaveLength(0);
  });

  it('markAllRead y un aviso nuevo en paralelo no pierden el aviso', async () => {
    await syncStatusNotifications([{ id: 1, status: 'Pendiente' }, { id: 2, status: 'Pendiente' }]);
    await syncStatusNotifications([{ id: 1, status: 'Resuelto' }, { id: 2, status: 'Pendiente' }]);

    // La primera lectura de avisos (la de markAllRead) es lenta: sin serializar, el aviso nuevo
    // se escribe en medio y markAllRead lo pisa con su lista vieja.
    const realGet = AsyncStorage.getItem.getMockImplementation();
    let slowed = false;
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
      const value = await realGet(key);
      if (key === 'notifications' && !slowed) {
        slowed = true;
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      return value;
    });

    await Promise.all([
      markAllRead(),
      syncStatusNotifications([{ id: 1, status: 'Resuelto' }, { id: 2, status: 'Resuelto' }]),
    ]);
    spy.mockImplementation(realGet); // mockRestore dejaría el mock de AsyncStorage sin implementación

    const list = await getNotifications();
    expect(list).toHaveLength(2);
    expect(list.some((item) => item.reportId === 2)).toBe(true);
  });
});
