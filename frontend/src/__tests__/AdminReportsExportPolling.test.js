import { AppState, Share } from 'react-native';
import { screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import api from '../services/api';
import { resetSummaryPreference } from '../components/admin/SummaryCard';
import { report, COUNTS, setup, reportsCalls, lastReportsParams, openFilters } from './helpers/adminScreen';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return { useFocusEffect: (cb) => React.useEffect(cb, [cb]) };
});

const exportCalls = () => api.get.mock.calls.filter(([url]) => url === '/admin/reports/export');

beforeEach(() => {
  jest.clearAllMocks();
  resetSummaryPreference();
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('AdminReportsScreen: exportar CSV', () => {
  it('pide el CSV con los filtros actuales y lo comparte', async () => {
    await setup([report()], { zones: [{ id: 6, name: 'Osorno' }], exportCsv: 'id,descripcion\n1,Basura\n' });
    await screen.findByText('Basura en la plaza');
    await fireEvent.changeText(screen.getByPlaceholderText('Buscar reportes'), 'plaza');
    await waitFor(() => expect(lastReportsParams().search).toBe('plaza'));
    await openFilters();
    await fireEvent.press(await screen.findByText('Escombros'));
    await fireEvent.press(screen.getByText('Osorno'));
    await fireEvent.press(screen.getByText('Más confirmados'));
    await fireEvent.press(screen.getAllByText('Pendiente').at(0));
    await waitFor(() => expect(lastReportsParams().status).toBe('Pendiente'));

    await fireEvent.press(screen.getByLabelText('Exportar'));

    await waitFor(() => expect(exportCalls()).toHaveLength(1));
    expect(exportCalls()[0][1]).toEqual({
      params: {
        validation_status: 'pendiente', status: 'Pendiente', category_id: 2, zone_id: 6, search: 'plaza', sort: 'confirmaciones',
      },
      responseType: 'text',
    });
    await waitFor(() => expect(Share.share).toHaveBeenCalledWith({
      message: 'id,descripcion\n1,Basura\n',
      title: expect.stringMatching(/^reportes-\d{4}-\d{2}-\d{2}\.csv$/),
    }));
    expect(await screen.findByText('1 reporte exportado.')).toBeTruthy();
  });

  it('mientras exporta el botón muestra carga y no admite otro clic', async () => {
    let resolveExport;
    await setup();
    await screen.findByText('Basura en la plaza');
    const original = api.get.getMockImplementation();
    api.get.mockImplementation((url, config) => (url === '/admin/reports/export'
      ? new Promise((resolve) => { resolveExport = resolve; })
      : original(url, config)));

    const first = fireEvent.press(screen.getByLabelText('Exportar'));
    await waitFor(() => expect(exportCalls()).toHaveLength(1));
    const busy = screen.getByLabelText('Exportando');
    expect(busy).toBeDisabled();
    const second = fireEvent.press(busy);

    await act(async () => { resolveExport({ data: 'id\n1\n' }); });
    await first;
    await second;

    expect(exportCalls()).toHaveLength(1);
    expect(await screen.findByLabelText('Exportar')).toBeEnabled();
  });

  it('un error al exportar muestra un aviso y rehabilita el botón', async () => {
    await setup([report()], { exportCsv: new Error('fail') });
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByLabelText('Exportar'));

    expect(await screen.findByText('No se pudo exportar los reportes.')).toBeTruthy();
    expect(Share.share).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Exportar')).toBeEnabled();
  });

  it('si no hay filas lo dice y no comparte nada', async () => {
    await setup([report()], { exportCsv: '﻿id,descripcion\n' });
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByLabelText('Exportar'));

    expect(await screen.findByText('No hay reportes para exportar con los filtros actuales.')).toBeTruthy();
    expect(Share.share).not.toHaveBeenCalled();
  });
});

describe('AdminReportsScreen: actualización automática', () => {
  const tick = async (ms = 20000) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
  const NEW = report({ id: 2, description: 'Reporte nuevo' });
  const pollCalls = () => reportsCalls().filter(([, config]) => config.signal);

  const setupPolling = async (options = {}) => {
    jest.useFakeTimers();
    const state = { rows: [report()], counts: COUNTS };
    await setup((config) => state.rows.map(r => ({ ...r })), { ...options, counts: () => state.counts });
    await screen.findByText('Basura en la plaza');
    return state;
  };

  it('consulta la página 1 con los mismos filtros, con señal y timeout, solo cada 20 s', async () => {
    await setupPolling();
    expect(pollCalls()).toHaveLength(0);

    await tick(19999);
    expect(pollCalls()).toHaveLength(0);
    await tick(1);

    expect(pollCalls()).toHaveLength(1);
    const [, config] = pollCalls()[0];
    expect(config.params).toEqual({ validation_status: 'pendiente', page: 1 });
    expect(config.timeout).toBe(10000);
    expect(config.signal.aborted).toBe(false);
  });

  it('avisa de los reportes nuevos sin cambiar la lista y actualiza los contadores', async () => {
    const state = await setupPolling();
    state.rows = [report(), NEW];
    state.counts = { ...COUNTS, pendiente: 4, total: 16 };

    await tick();

    expect(await screen.findByText('1 reporte nuevo · Mostrar')).toBeTruthy();
    expect(screen.queryByText('Reporte nuevo')).toBeNull();
    expect(screen.getByLabelText('Pendientes, 4')).toBeTruthy();
    expect(screen.getByLabelText('Todos, 16')).toBeTruthy();
  });

  it('no cuenta como nuevos los reportes más antiguos que suben a la página 1', async () => {
    const state = await setupPolling();
    // El admin moderó la cola: en la página 1 aparece un reporte anterior (id menor) que no estaba cargado.
    state.rows = [report(), report({ id: 0, description: 'Reporte antiguo de la página 2' })];

    await tick();

    expect(pollCalls()).toHaveLength(1);
    expect(screen.queryByText(/nuevo/)).toBeNull();
  });

  it('sin ids nuevos no muestra aviso', async () => {
    await setupPolling();

    await tick();

    expect(pollCalls()).toHaveLength(1);
    expect(screen.queryByText(/nuevo/)).toBeNull();
  });

  it('"Mostrar" recarga la lista con los nuevos y quita el aviso', async () => {
    const state = await setupPolling();
    state.rows = [report(), NEW, report({ id: 3, description: 'Otro nuevo' })];
    await tick();
    const callsBefore = reportsCalls().length;
    await fireEvent.press(await screen.findByText('2 reportes nuevos · Mostrar'));

    await waitFor(() => expect(reportsCalls().length).toBe(callsBefore + 1));
    expect(await screen.findByText('Reporte nuevo')).toBeTruthy();
    expect(screen.queryByText(/reportes nuevos/)).toBeNull();
  });

  it('se pausa con la app en segundo plano y se reanuda al volver', async () => {
    const listeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, cb) => {
      if (event === 'change') listeners.push(cb);
      return { remove: jest.fn() };
    });
    await setupPolling();

    await act(async () => { listeners.forEach(cb => cb('background')); });
    await tick(60000);
    expect(pollCalls()).toHaveLength(0);

    await act(async () => { listeners.forEach(cb => cb('active')); });
    await tick();
    expect(pollCalls()).toHaveLength(1);
  });

  it('se pausa con el modal de rechazo abierto', async () => {
    await setupPolling();
    await fireEvent.press(screen.getByText('Rechazar'));
    await screen.findByText('Motivo del rechazo');

    await tick(60000);
    expect(pollCalls()).toHaveLength(0);

    await fireEvent.press(screen.getByText('Cancelar'));
    await tick();
    expect(pollCalls()).toHaveLength(1);
  });

  it('se pausa en modo selección', async () => {
    await setupPolling();
    await fireEvent.press(screen.getByText('Seleccionar'));

    await tick(60000);
    expect(pollCalls()).toHaveLength(0);

    await fireEvent.press(screen.getByText('Cancelar'));
    await tick();
    expect(pollCalls()).toHaveLength(1);
  });

  it('se pausa mientras hay una acción en curso', async () => {
    let resolvePatch;
    api.patch.mockImplementation(() => new Promise((resolve) => { resolvePatch = resolve; }));
    await setupPolling();
    const pressed = fireEvent.press(screen.getByText('Validar'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));

    await tick(60000);
    expect(pollCalls()).toHaveLength(0);

    await act(async () => { resolvePatch({ data: report({ validation_status: 'valido' }) }); });
    await pressed;
  });

  it('descarta la respuesta si los filtros cambian mientras viaja y cancela la petición', async () => {
    jest.useFakeTimers();
    await setup([report()]);
    let resolvePoll;
    const original = api.get.getMockImplementation();
    api.get.mockImplementation((url, config) => (url === '/admin/reports' && config.signal && !resolvePoll
      ? new Promise((resolve) => { resolvePoll = resolve; })
      : original(url, config)));
    await screen.findByText('Basura en la plaza');

    await tick();
    expect(pollCalls()).toHaveLength(1);
    const { signal } = pollCalls()[0][1];

    await fireEvent.press(screen.getByText('Válidos'));
    expect(signal.aborted).toBe(true);
    await act(async () => {
      resolvePoll({ data: { data: [report(), NEW], meta: { current_page: 1, last_page: 1, total: 2, counts: COUNTS } } });
    });

    expect(screen.queryByText(/nuevo/)).toBeNull();
  });

  it('no lanza otra consulta mientras la anterior sigue en vuelo', async () => {
    jest.useFakeTimers();
    await setup([report()]);
    const original = api.get.getMockImplementation();
    api.get.mockImplementation((url, config) => (url === '/admin/reports' && config.signal
      ? new Promise(() => {})
      : original(url, config)));
    await screen.findByText('Basura en la plaza');

    await tick(100000);

    expect(pollCalls()).toHaveLength(1);
  });

  it('al desmontar cancela la petición y limpia el intervalo', async () => {
    await setupPolling();
    await tick();
    const { signal } = pollCalls()[0][1];

    await screen.unmount();

    expect(signal.aborted).toBe(true);
    await tick(100000);
    expect(pollCalls()).toHaveLength(1);
  });
});
