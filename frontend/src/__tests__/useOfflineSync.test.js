import { renderHook } from '@testing-library/react-native';
import useOfflineSync from '../hooks/useOfflineSync';
import useNetworkStatus from '../hooks/useNetworkStatus';
import { syncPending, getPendingCount } from '../services/offlineQueue';

jest.mock('../hooks/useNetworkStatus', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../services/offlineQueue', () => ({
  syncPending: jest.fn(),
  getPendingCount: jest.fn(),
}));

const flush = async () => { await jest.advanceTimersByTimeAsync(0); };

describe('useOfflineSync reintento periódico', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    syncPending.mockResolvedValue({ synced: 0, remaining: 1 });
    getPendingCount.mockResolvedValue(1);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('conectado con pendientes reintenta cada 60 s', async () => {
    useNetworkStatus.mockReturnValue({ isConnected: true });
    await renderHook(() => useOfflineSync());
    await flush();
    const initial = syncPending.mock.calls.length;

    await jest.advanceTimersByTimeAsync(60000);
    expect(syncPending.mock.calls.length).toBe(initial + 1);
    await jest.advanceTimersByTimeAsync(60000);
    expect(syncPending.mock.calls.length).toBe(initial + 2);
  });

  it('sin pendientes no llama syncPending en el intervalo', async () => {
    useNetworkStatus.mockReturnValue({ isConnected: true });
    getPendingCount.mockResolvedValue(0);
    await renderHook(() => useOfflineSync());
    await flush();
    const initial = syncPending.mock.calls.length;

    await jest.advanceTimersByTimeAsync(120000);
    expect(syncPending.mock.calls.length).toBe(initial);
  });

  it('desconectado no sincroniza', async () => {
    useNetworkStatus.mockReturnValue({ isConnected: false });
    await renderHook(() => useOfflineSync());
    await jest.advanceTimersByTimeAsync(180000);
    expect(syncPending).not.toHaveBeenCalled();
  });

  it('al desmontar deja de reintentar', async () => {
    useNetworkStatus.mockReturnValue({ isConnected: true });
    const { unmount } = await renderHook(() => useOfflineSync());
    await flush();
    await unmount();
    const calls = syncPending.mock.calls.length;

    await jest.advanceTimersByTimeAsync(180000);
    expect(syncPending.mock.calls.length).toBe(calls);
  });
});
