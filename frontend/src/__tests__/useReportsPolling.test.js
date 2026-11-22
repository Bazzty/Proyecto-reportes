import { renderHook, act } from '@testing-library/react-native';
import useReportsPolling from '../hooks/useReportsPolling';
import api from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const POLL_MS = 20000;

const setup = async (overrides = {}) => {
  const onResult = jest.fn();
  const props = {
    enabled: true,
    params: { status: 'pendiente' },
    listVersionRef: { current: 1 },
    newestIdRef: { current: 10 },
    onResult,
    ...overrides,
  };
  const hook = await renderHook(() => useReportsPolling(props));
  return { ...hook, onResult, props };
};

describe('useReportsPolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it('no consulta mientras está deshabilitado', async () => {
    await setup({ enabled: false });
    await act(async () => { await jest.advanceTimersByTimeAsync(POLL_MS * 2); });
    expect(api.get).not.toHaveBeenCalled();
  });

  it('cada 20 s pide la página 1 con los filtros y avisa cuántos reportes son más nuevos', async () => {
    api.get.mockResolvedValue({
      data: { data: [{ id: 12 }, { id: 11 }, { id: 9 }], meta: { counts: { pendiente: 3 } } },
    });
    const { onResult } = await setup();

    await act(async () => { await jest.advanceTimersByTimeAsync(POLL_MS); });

    expect(api.get).toHaveBeenCalledWith('/admin/reports', expect.objectContaining({
      params: { status: 'pendiente', page: 1 },
    }));
    expect(onResult).toHaveBeenCalledWith({ newCount: 2, counts: { pendiente: 3 } });
  });

  it('no solapa peticiones: con una en vuelo ignora los siguientes ciclos', async () => {
    let resolveFirst;
    api.get.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
    api.get.mockResolvedValue({ data: { data: [] } });
    await setup();

    await act(async () => { await jest.advanceTimersByTimeAsync(POLL_MS * 3); });
    expect(api.get).toHaveBeenCalledTimes(1);

    await act(async () => { resolveFirst({ data: { data: [] } }); });
    await act(async () => { await jest.advanceTimersByTimeAsync(POLL_MS); });
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('al desmontar aborta la petición en vuelo, descarta su respuesta y detiene el intervalo', async () => {
    let resolveFirst;
    api.get.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
    const { unmount, onResult } = await setup();

    await act(async () => { await jest.advanceTimersByTimeAsync(POLL_MS); });
    const { signal } = api.get.mock.calls[0][1];
    expect(signal.aborted).toBe(false);

    await unmount();
    expect(signal.aborted).toBe(true);

    await act(async () => { resolveFirst({ data: { data: [{ id: 99 }] } }); });
    expect(onResult).not.toHaveBeenCalled();

    await act(async () => { await jest.advanceTimersByTimeAsync(POLL_MS * 2); });
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('descarta la respuesta si la lista se recargó mientras viajaba', async () => {
    let resolveFirst;
    api.get.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
    const { onResult, props } = await setup();

    await act(async () => { await jest.advanceTimersByTimeAsync(POLL_MS); });
    props.listVersionRef.current = 2;
    await act(async () => { resolveFirst({ data: { data: [{ id: 99 }] } }); });

    expect(onResult).not.toHaveBeenCalled();
  });

  it('un fallo aislado no rompe el ciclo siguiente', async () => {
    api.get.mockRejectedValueOnce(new Error('red'));
    api.get.mockResolvedValue({ data: { data: [{ id: 11 }] } });
    const { onResult } = await setup();

    await act(async () => { await jest.advanceTimersByTimeAsync(POLL_MS * 2); });

    expect(api.get).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenCalledTimes(1);
  });
});
