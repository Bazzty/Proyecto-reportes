import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import api from '../services/api';
import { enqueue, getPending, getPendingCount, syncPending, subscribe } from '../services/offlineQueue';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const report = (overrides = {}) => ({
  description: 'Basura en la vereda',
  latitude: -41.31,
  longitude: -72.98,
  categoryId: 1,
  photoUri: 'file:///cache/a.jpg',
  ...overrides,
});

describe('offlineQueue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
  });

  it('encola un reporte y persiste la foto en el directorio de documentos', async () => {
    FileSystem.getInfoAsync.mockResolvedValue({ exists: false });

    const localId = await enqueue(report());

    expect(localId).toBeTruthy();
    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalled();
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///cache/a.jpg',
      to: expect.stringContaining(`${localId}.jpg`),
    });

    const pending = await getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ description: 'Basura en la vereda', categoryId: 1 });
    expect(pending[0].clientUuid).toBeTruthy();
    expect(await getPendingCount()).toBe(1);
  });

  it('sincroniza los pendientes, los quita y borra la foto', async () => {
    await enqueue(report());
    api.post.mockResolvedValue({ data: { id: 10 } });

    const result = await syncPending();

    expect(api.post).toHaveBeenCalledTimes(1);
    const [url, form] = api.post.mock.calls[0];
    expect(url).toBe('/reports');
    expect(form.get('description')).toBe('Basura en la vereda');
    expect(form.get('category_id')).toBe('1');
    expect(form.get('client_uuid')).toBeTruthy();
    expect(result).toEqual({ synced: 1, remaining: 0 });
    expect(await getPendingCount()).toBe(0);
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
  });

  it('conserva el pendiente si el envío falla por red', async () => {
    await enqueue(report());
    api.post.mockRejectedValue(new Error('Network Error'));

    const result = await syncPending();

    expect(result).toEqual({ synced: 0, remaining: 1 });
    expect(await getPendingCount()).toBe(1);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('se detiene ante un 401 sin vaciar la cola', async () => {
    await enqueue(report());
    await enqueue(report({ description: 'Otro' }));
    api.post.mockRejectedValue({ response: { status: 401 } });

    const result = await syncPending();

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(result.remaining).toBe(2);
  });

  it('reutiliza el clientUuid provisto (evita duplicados online/offline)', async () => {
    await enqueue(report({ clientUuid: '11111111-1111-4111-8111-111111111111' }));
    api.post.mockResolvedValue({ data: { id: 10 } });

    await syncPending();

    expect(api.post.mock.calls[0][1].get('client_uuid')).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('marca como fallido un error 4xx y no lo reintenta', async () => {
    await enqueue(report());
    api.post.mockRejectedValue({ response: { status: 422, data: { message: 'inválido' } } });

    const result = await syncPending();

    const pending = await getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].failed).toBe(true);
    expect(pending[0].failedReason).toBe('inválido');
    expect(await getPendingCount()).toBe(0);
    expect(result.remaining).toBe(0);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('notifica a los suscriptores cuando cambia la cola', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribe(listener);

    await enqueue(report());

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});
