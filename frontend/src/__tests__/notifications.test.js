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
});
