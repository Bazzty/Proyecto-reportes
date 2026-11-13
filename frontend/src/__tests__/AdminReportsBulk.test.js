import { screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import api from '../services/api';
import { resetSummaryPreference } from '../components/admin/SummaryCard';
import { report, validReport, setup, setupValid, reportsCalls } from './helpers/adminScreen';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return { useFocusEffect: (cb) => React.useEffect(cb, [cb]) };
});

const two = () => [report({ id: 1, description: 'Uno' }), report({ id: 2, description: 'Dos' })];
const manyPending = (n) => Array.from({ length: n }, (_, i) => report({ id: i + 1, description: `Reporte ${i + 1}` }));
const startSelecting = async () => { await fireEvent.press(await screen.findByText('Seleccionar')); };
const checkboxes = () => screen.getAllByRole('checkbox');

beforeEach(() => {
  jest.clearAllMocks();
  resetSummaryPreference();
});

describe('AdminReportsScreen: validar y rechazar en lote', () => {
  it('las casillas aparecen solo en tarjetas pendientes y exponen su estado', async () => {
    await setup([
      report({ id: 1, description: 'Pendiente uno' }),
      validReport({ id: 2, description: 'Ya válido' }),
      report({ id: 3, description: 'Ya rechazado', validation_status: 'rechazado' }),
    ]);
    await screen.findByText('Pendiente uno');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

    await startSelecting();

    expect(checkboxes()).toHaveLength(1);
    expect(checkboxes()[0]).toHaveProp('accessibilityState', { checked: false, disabled: false });
    await fireEvent.press(checkboxes()[0]);
    expect(checkboxes()[0]).toHaveProp('accessibilityState', { checked: true, disabled: false });
    expect(screen.getByText('1 seleccionado')).toBeTruthy();
  });

  it('en modo selección la barra inferior ofrece las acciones y las del reporte individual se ocultan', async () => {
    await setup(two());
    await screen.findByText('Uno');
    expect(screen.getAllByText('Validar')).toHaveLength(2);

    await startSelecting();

    expect(screen.getByText('0 seleccionados')).toBeTruthy();
    expect(screen.getByText('Seleccionar visibles')).toBeTruthy();
    expect(screen.getAllByText('Validar')).toHaveLength(1);
    expect(screen.getByText('Validar')).toBeDisabled();
    expect(screen.getByText('Rechazar')).toBeDisabled();
    expect(screen.getByText('Cancelar')).toBeEnabled();
  });

  it('"Seleccionar visibles" marca los pendientes y Cancelar sale del modo', async () => {
    await setup(two());
    await screen.findByText('Uno');
    await startSelecting();

    await fireEvent.press(screen.getByText('Seleccionar visibles'));
    expect(screen.getByText('2 seleccionados')).toBeTruthy();

    await fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByText('Seleccionar visibles')).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getAllByText('Validar')).toHaveLength(2);

    // Al volver a entrar no queda nada seleccionado.
    await startSelecting();
    expect(screen.getByText('0 seleccionados')).toBeTruthy();
  });

  it('el tope es 50: bloquea más casillas y lo avisa', async () => {
    await setup(manyPending(55));
    await screen.findByText('Reporte 1');
    await startSelecting();

    await fireEvent.press(screen.getByText('Seleccionar visibles'));

    expect(screen.getByText('50 seleccionados')).toBeTruthy();
    expect(screen.getByText('Máximo 50 reportes por lote.')).toBeTruthy();

    // Se baja al final de la lista para que se dibuje una casilla fuera de la selección.
    const list = screen.getByTestId('admin-report-list');
    await fireEvent(list, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } });
    await fireEvent(list, 'contentSizeChange', 400, 120000);
    await fireEvent.scroll(list, {
      nativeEvent: {
        contentOffset: { y: 100000 },
        contentSize: { height: 120000, width: 400 },
        layoutMeasurement: { height: 800, width: 400 },
      },
    });
    const last = await screen.findByLabelText('Seleccionar reporte: Reporte 55');
    expect(last).toHaveProp('accessibilityState', { checked: false, disabled: true });

    // Quitar una selección libera el tope.
    await fireEvent.press(checkboxes()[0]);
    expect(screen.getByText('49 seleccionados')).toBeTruthy();
    expect(screen.queryByText('Máximo 50 reportes por lote.')).toBeNull();
  });

  it('validar pide confirmación con un modal propio antes de enviar', async () => {
    api.post.mockResolvedValue({ data: { updated: [1, 2], skipped: [] } });
    await setup(two());
    await screen.findByText('Uno');
    await startSelecting();
    await fireEvent.press(screen.getByText('Seleccionar visibles'));

    await fireEvent.press(screen.getByText('Validar'));
    expect(await screen.findByText('Validar 2 reportes')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();

    // Cancelar el modal conserva la selección.
    await fireEvent.press(screen.getAllByText('Cancelar').at(-1));
    expect(screen.queryByText('Validar 2 reportes')).toBeNull();
    expect(screen.getByText('2 seleccionados')).toBeTruthy();

    await fireEvent.press(screen.getByText('Validar'));
    await fireEvent.press((await screen.findAllByText('Validar')).at(-1));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/reports/bulk-validation', {
      ids: [1, 2], validation_status: 'valido',
    }));
  });

  it('rechazar reutiliza el modal de motivo con el número de reportes en el título', async () => {
    api.post.mockResolvedValue({ data: { updated: [1, 2], skipped: [] } });
    await setup(two());
    await screen.findByText('Uno');
    await startSelecting();
    await fireEvent.press(screen.getByText('Seleccionar visibles'));

    await fireEvent.press(screen.getByText('Rechazar'));
    expect(await screen.findByText('Motivo del rechazo (2 reportes)')).toBeTruthy();
    expect(screen.getAllByText('Rechazar').at(-1)).toBeDisabled();

    await fireEvent.press(screen.getByText('Reporte duplicado'));
    await fireEvent.press(screen.getAllByText('Rechazar').at(-1));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/reports/bulk-validation', {
      ids: [1, 2], validation_status: 'rechazado', rejection_reason: 'Reporte duplicado',
    }));
    expect(await screen.findByText('2 rechazados, 0 omitidos')).toBeTruthy();
  });

  it('con un solo reporte el título y el aviso van en singular', async () => {
    api.post.mockResolvedValue({ data: { updated: [1], skipped: [] } });
    await setup([report({ id: 1, description: 'Uno' })]);
    await screen.findByText('Uno');
    await startSelecting();
    await fireEvent.press(checkboxes()[0]);

    await fireEvent.press(screen.getByText('Rechazar'));
    expect(await screen.findByText('Motivo del rechazo (1 reporte)')).toBeTruthy();
  });

  it('con todos actualizados saca de la lista los que dejan de coincidir, ajusta contadores y no recarga', async () => {
    api.post.mockResolvedValue({ data: { updated: [1, 2], skipped: [] } });
    await setup(two());
    await screen.findByText('Uno');
    const callsBefore = reportsCalls().length;
    await startSelecting();
    await fireEvent.press(screen.getByText('Seleccionar visibles'));
    await fireEvent.press(screen.getByText('Validar'));

    await fireEvent.press((await screen.findAllByText('Validar')).at(-1));

    expect(await screen.findByText('2 validados, 0 omitidos')).toBeTruthy();
    expect(screen.queryByText('Uno')).toBeNull();
    expect(screen.queryByText('Dos')).toBeNull();
    expect(screen.getByText('No hay reportes pendientes de revisión.')).toBeTruthy();
    expect(screen.queryByText(/en total/)).toBeNull();
    expect(screen.getByLabelText('Pendientes, 1')).toBeTruthy();
    expect(screen.getByLabelText('Válidos, 7')).toBeTruthy();
    expect(reportsCalls()).toHaveLength(callsBefore);
    // Sale del modo selección.
    expect(screen.queryByText('Seleccionar visibles')).toBeNull();
  });

  it('el historial de las tarjetas del lote muestra quién las validó, sin recargar', async () => {
    api.post.mockResolvedValue({
      data: { updated: [1], skipped: [], validated_by: { id: 9, name: 'Admin Uno' }, validated_at: '2026-11-12T15:00:00.000Z' },
    });
    await setup(two());
    await screen.findByText('Uno');
    await fireEvent.press(screen.getAllByText('Todos').at(0));
    await screen.findByText('Uno');
    const loadsBefore = reportsCalls().length;
    await startSelecting();
    await fireEvent.press(checkboxes()[0]);
    await fireEvent.press(screen.getByText('Validar'));
    await fireEvent.press((await screen.findAllByText('Validar')).at(-1));
    expect(await screen.findByText('1 validado, 0 omitidos')).toBeTruthy();

    await fireEvent.press(screen.getAllByLabelText('Historial').at(0));

    expect(screen.getByText(/^Validado por Admin Uno/)).toBeTruthy();
    expect(reportsCalls()).toHaveLength(loadsBefore);
  });

  it('con filtro Todos actualiza las tarjetas en su sitio', async () => {
    api.post.mockResolvedValue({ data: { updated: [1], skipped: [] } });
    await setup(two());
    await screen.findByText('Uno');
    await fireEvent.press(screen.getAllByText('Todos').at(0));
    await screen.findByText('Uno');
    await startSelecting();
    await fireEvent.press(checkboxes()[0]);
    await fireEvent.press(screen.getByText('Validar'));

    await fireEvent.press((await screen.findAllByText('Validar')).at(-1));

    expect(await screen.findByText('1 validado, 0 omitidos')).toBeTruthy();
    expect(screen.getByText('Uno')).toBeTruthy();
    expect(screen.getByText('VÁLIDO')).toBeTruthy();
    expect(screen.getByText('PENDIENTE')).toBeTruthy();
  });

  it('con omitidos avisa de cuántos y vuelve a cargar la lista', async () => {
    api.post.mockResolvedValue({ data: { updated: [1], skipped: [2] } });
    await setup(two());
    await screen.findByText('Uno');
    const callsBefore = reportsCalls().length;
    await startSelecting();
    await fireEvent.press(screen.getByText('Seleccionar visibles'));
    await fireEvent.press(screen.getByText('Validar'));

    await fireEvent.press((await screen.findAllByText('Validar')).at(-1));

    expect(await screen.findByText('1 validado, 1 omitido')).toBeTruthy();
    await waitFor(() => expect(reportsCalls()).toHaveLength(callsBefore + 1));
    // Tras recargar mandan los contadores del servidor.
    expect(screen.getByLabelText('Pendientes, 3')).toBeTruthy();
  });

  it('doble clic en confirmar envía una sola petición y los botones quedan deshabilitados', async () => {
    let resolvePost;
    api.post.mockImplementation(() => new Promise((resolve) => { resolvePost = resolve; }));
    await setup(two());
    await screen.findByText('Uno');
    await startSelecting();
    await fireEvent.press(screen.getByText('Seleccionar visibles'));
    await fireEvent.press(screen.getByText('Validar'));
    const confirm = (await screen.findAllByText('Validar')).at(-1);

    const first = fireEvent.press(confirm);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const second = fireEvent.press(confirm);
    screen.getAllByText('Cancelar').forEach(button => expect(button).toBeDisabled());
    expect(screen.getByText('Rechazar')).toBeDisabled();

    await act(async () => { resolvePost({ data: { updated: [1, 2], skipped: [] } }); });
    await first;
    await second;

    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('un error del lote avisa, conserva la selección y no usa Alert', async () => {
    api.post.mockRejectedValue(new Error('fail'));
    await setup(two());
    await screen.findByText('Uno');
    await startSelecting();
    await fireEvent.press(screen.getByText('Seleccionar visibles'));
    await fireEvent.press(screen.getByText('Validar'));

    await fireEvent.press((await screen.findAllByText('Validar')).at(-1));

    expect(await screen.findByText('No se pudo validar el lote.')).toBeTruthy();
    expect(screen.getByText('2 seleccionados')).toBeTruthy();
    expect(screen.getByText('Validar')).toBeEnabled();
  });
});

describe('AdminReportsScreen: deshacer', () => {
  it('validar ofrece Deshacer, dura 6 s y restaura el estado anterior', async () => {
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    api.patch
      .mockResolvedValueOnce({ data: report({ validation_status: 'valido' }) })
      .mockResolvedValueOnce({ data: report({ validation_status: 'pendiente' }) });
    await setup();
    await screen.findByText('Basura en la plaza');
    const callsBefore = reportsCalls().length;

    await fireEvent.press(screen.getByText('Validar'));
    expect(await screen.findByText('Reporte validado')).toBeTruthy();
    expect(timeoutSpy.mock.calls.some(([, delay]) => delay === 6000)).toBe(true);

    await fireEvent.press(screen.getByLabelText('Deshacer'));

    await waitFor(() => expect(api.patch).toHaveBeenLastCalledWith('/admin/reports/1/validation', {
      validation_status: 'pendiente', expected_validation_status: 'valido',
    }));
    expect(await screen.findByText('Acción deshecha')).toBeTruthy();
    expect(screen.queryByLabelText('Deshacer')).toBeNull();
    // Con el filtro Pendientes la tarjeta había salido: se recarga para que vuelva.
    await waitFor(() => expect(reportsCalls()).toHaveLength(callsBefore + 1));
    expect(await screen.findByText('Basura en la plaza')).toBeTruthy();
    expect(screen.getByLabelText('Pendientes, 3')).toBeTruthy();
    timeoutSpy.mockRestore();
  });

  it('deshacer el rechazo de un reporte ya válido pide al servidor restaurar la moderación anterior', async () => {
    api.patch
      .mockResolvedValueOnce({ data: report({ validation_status: 'rechazado', rejection_reason: 'Reporte duplicado' }) })
      .mockResolvedValueOnce({ data: report({ validation_status: 'valido' }) });
    await setup([report({
      validation_status: 'valido', validated_by: { id: 7, name: 'Eva' }, validated_at: '2026-11-01T10:00:00.000Z',
    })]);
    await screen.findAllByText('Basura en la plaza');
    await fireEvent.press(screen.getByText('Rechazar'));
    await fireEvent.press(await screen.findByText('Reporte duplicado'));
    await fireEvent.press(screen.getAllByText('Rechazar').at(-1));
    expect(await screen.findByText('Reporte rechazado')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Deshacer'));

    await waitFor(() => expect(api.patch).toHaveBeenLastCalledWith('/admin/reports/1/validation', {
      validation_status: 'valido',
      expected_validation_status: 'rechazado',
      restore_previous: true,
    }));
  });

  it('deshacer una validación de un reporte rechazado reenvía su motivo', async () => {
    api.patch
      .mockResolvedValueOnce({ data: report({ validation_status: 'valido' }) })
      .mockResolvedValueOnce({ data: report({ validation_status: 'rechazado' }) });
    await setup([report({ validation_status: 'rechazado', rejection_reason: 'Foto poco clara' })]);
    await screen.findAllByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('Validar'));
    await fireEvent.press(await screen.findByLabelText('Deshacer'));

    await waitFor(() => expect(api.patch).toHaveBeenLastCalledWith('/admin/reports/1/validation', {
      validation_status: 'rechazado', expected_validation_status: 'valido', rejection_reason: 'Foto poco clara',
      restore_previous: true,
    }));
  });

  it('rechazar ofrece Deshacer que vuelve a pendiente', async () => {
    api.patch
      .mockResolvedValueOnce({ data: report({ validation_status: 'rechazado', rejection_reason: 'No aplica' }) })
      .mockResolvedValueOnce({ data: report({ validation_status: 'pendiente' }) });
    await setup();
    await screen.findByText('Basura en la plaza');
    await fireEvent.press(screen.getByText('Rechazar'));
    await fireEvent.press(await screen.findByText('Reporte duplicado'));
    await fireEvent.press(screen.getAllByText('Rechazar').at(-1));
    expect(await screen.findByText('Reporte rechazado')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Deshacer'));

    await waitFor(() => expect(api.patch).toHaveBeenLastCalledWith('/admin/reports/1/validation', {
      validation_status: 'pendiente', expected_validation_status: 'rechazado',
    }));
    expect(await screen.findByText('Acción deshecha')).toBeTruthy();
  });

  it('cambiar el estado ofrece Deshacer con el estado anterior', async () => {
    api.patch
      .mockResolvedValueOnce({ data: validReport({ status: 'Resuelto' }) })
      .mockResolvedValueOnce({ data: validReport({ status: 'Pendiente' }) });
    await setupValid();

    await fireEvent.press(screen.getAllByText('Resuelto').at(-1));
    expect(await screen.findByText('Estado actualizado a Resuelto')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Deshacer'));

    await waitFor(() => expect(api.patch).toHaveBeenLastCalledWith('/reports/1/status', { status: 'Pendiente' }));
    expect(await screen.findByText('Acción deshecha')).toBeTruthy();
  });

  it('si el deshacer falla muestra un error', async () => {
    api.patch
      .mockResolvedValueOnce({ data: report({ validation_status: 'valido' }) })
      .mockRejectedValueOnce(new Error('fail'));
    await setup();
    await screen.findByText('Basura en la plaza');
    await fireEvent.press(screen.getByText('Validar'));

    await fireEvent.press(await screen.findByLabelText('Deshacer'));

    expect(await screen.findByText('No se pudo deshacer la acción.')).toBeTruthy();
    expect(screen.queryByLabelText('Deshacer')).toBeNull();
  });

  it('un 409 al deshacer avisa y refresca la tarjeta', async () => {
    api.patch
      .mockResolvedValueOnce({ data: report({ validation_status: 'valido' }) })
      .mockRejectedValueOnce({ response: { status: 409 } });
    await setup([report()], { detail: report({ validation_status: 'rechazado' }) });
    await screen.findByText('Basura en la plaza');
    await fireEvent.press(screen.getByText('Validar'));

    await fireEvent.press(await screen.findByLabelText('Deshacer'));

    expect(await screen.findByText('Este reporte cambió mientras tanto. Se actualizó la tarjeta.')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/reports/1');
  });

  it('una acción nueva reemplaza el Deshacer anterior: solo hay uno activo', async () => {
    api.patch.mockImplementation((url) => Promise.resolve({
      data: report({ id: Number(url.match(/reports\/(\d+)/)[1]), validation_status: 'valido' }),
    }));
    await setup(two());
    await screen.findByText('Uno');

    await fireEvent.press(screen.getAllByText('Validar').at(0));
    await screen.findByLabelText('Deshacer');
    await fireEvent.press(screen.getAllByText('Validar').at(0));

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    expect(screen.getAllByLabelText('Deshacer')).toHaveLength(1);
    await fireEvent.press(screen.getByLabelText('Deshacer'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(3));
    expect(api.patch).toHaveBeenLastCalledWith('/admin/reports/2/validation', {
      validation_status: 'pendiente', expected_validation_status: 'valido',
    });
  });

  it('el aviso con Deshacer desaparece al expirar', async () => {
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    api.patch.mockResolvedValue({ data: report({ validation_status: 'valido' }) });
    await setup();
    await screen.findByText('Basura en la plaza');
    await fireEvent.press(screen.getByText('Validar'));
    await screen.findByLabelText('Deshacer');

    const call = timeoutSpy.mock.calls.find(([, delay]) => delay === 6000);
    await act(async () => { call[0](); });

    expect(screen.queryByLabelText('Deshacer')).toBeNull();
    expect(screen.queryByText('Reporte validado')).toBeNull();
    timeoutSpy.mockRestore();
  });

  it('doble clic en Deshacer envía una sola petición', async () => {
    let resolveUndo;
    api.patch
      .mockResolvedValueOnce({ data: report({ validation_status: 'valido' }) })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveUndo = resolve; }));
    await setup();
    await screen.findByText('Basura en la plaza');
    await fireEvent.press(screen.getByText('Validar'));
    const undo = await screen.findByLabelText('Deshacer');

    const first = fireEvent.press(undo);
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    const second = fireEvent.press(undo);
    await act(async () => { resolveUndo({ data: report({ validation_status: 'pendiente' }) }); });
    await first;
    await second;

    expect(api.patch).toHaveBeenCalledTimes(2);
  });

  it('el lote no ofrece Deshacer', async () => {
    api.post.mockResolvedValue({ data: { updated: [1], skipped: [] } });
    await setup([report({ id: 1, description: 'Uno' })]);
    await screen.findByText('Uno');
    await fireEvent.press(screen.getByText('Seleccionar'));
    await fireEvent.press(screen.getAllByRole('checkbox')[0]);
    await fireEvent.press(screen.getByText('Validar'));

    await fireEvent.press((await screen.findAllByText('Validar')).at(-1));

    expect(await screen.findByText('1 validado, 0 omitidos')).toBeTruthy();
    expect(screen.queryByLabelText('Deshacer')).toBeNull();
  });
});
