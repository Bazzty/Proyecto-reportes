import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import AdminReportsScreen from '../screens/AdminReportsScreen';
import api from '../services/api';
import { resetSummaryPreference } from '../components/admin/SummaryCard';
import {
  report, validReport, setup, setupValid, reportsCalls, lastReportsParams, openFilters,
  makeNavigation, COUNTS, SUMMARY,
} from './helpers/adminScreen';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));
// mockRefocus repite el foco de la pantalla, como al volver del detalle.
let mockRefocus;
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb) => {
      mockRefocus = cb;
      return React.useEffect(cb, [cb]);
    },
  };
});

describe('AdminReportsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSummaryPreference();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('carga y muestra los reportes pendientes', async () => {
    await setup();

    expect(api.get).toHaveBeenCalledWith('/admin/reports', { params: { validation_status: 'pendiente', page: 1 } });
    expect(await screen.findByText('Basura en la plaza')).toBeTruthy();
    expect(screen.getByText('PENDIENTE')).toBeTruthy();
    expect(screen.getByText('Puerto Varas')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
  });

  it('cambia el filtro y vuelve a pedir', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('Válidos'));

    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/admin/reports', { params: { validation_status: 'valido', page: 1 } })
    );
  });

  it('validar llama al endpoint con valido', async () => {
    api.patch.mockResolvedValue({ data: report({ validation_status: 'valido' }) });
    await setup();
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('Validar'));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        '/admin/reports/1/validation',
        expect.objectContaining({ validation_status: 'valido', expected_validation_status: 'pendiente' })
      )
    );
  });

  it('un error al validar muestra un aviso en pantalla, sin usar Alert', async () => {
    api.patch.mockRejectedValue(new Error('fail'));
    await setup();
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('Validar'));

    expect(await screen.findByText('No se pudo validar el reporte.')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('el aviso se programa para desaparecer a los 3,5 segundos', async () => {
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    api.patch.mockRejectedValue(new Error('fail'));
    await setup();
    await screen.findByText('Basura en la plaza');
    await fireEvent.press(screen.getByText('Validar'));
    expect(await screen.findByText('No se pudo validar el reporte.')).toBeTruthy();

    // Se ejecuta el callback del timer de 3500 ms en vez de esperar tiempo real.
    const call = timeoutSpy.mock.calls.find(([, delay]) => delay === 3500);
    expect(call).toBeTruthy();
    await act(async () => { call[0](); });

    expect(screen.queryByText('No se pudo validar el reporte.')).toBeNull();
    timeoutSpy.mockRestore();
  });

  it('el aviso se anuncia como región en vivo', async () => {
    api.patch.mockResolvedValue({ data: report({ validation_status: 'valido' }) });
    await setup();
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('Validar'));

    const toast = await screen.findByText('Reporte validado');
    expect(toast.parent).toHaveProp('accessibilityLiveRegion', 'polite');
  });

  it('doble clic en Validar envía un solo PATCH', async () => {
    let resolvePatch;
    api.patch.mockImplementation(() => new Promise((resolve) => { resolvePatch = resolve; }));
    await setup();
    await screen.findByText('Basura en la plaza');
    const button = screen.getByText('Validar');

    // fireEvent.press es asíncrono: se esperan sus promesas al final, con el PATCH ya resuelto.
    const first = fireEvent.press(button);
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    const second = fireEvent.press(button);
    resolvePatch({ data: report({ validation_status: 'valido' }) });
    await first;
    await second;

    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('mientras una tarjeta valida, las demás siguen usables', async () => {
    let resolvePatch;
    api.patch.mockImplementation(() => new Promise((resolve) => { resolvePatch = resolve; }));
    await setup([report({ id: 1, description: 'Uno' }), report({ id: 2, description: 'Dos' })]);
    await screen.findByText('Uno');

    const pressed = fireEvent.press(screen.getAllByText('Validar').at(0));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));

    // La primera tarjeta muestra el indicador en vez del texto; la segunda conserva el botón activo.
    expect(screen.getAllByText('Validar')).toHaveLength(1);
    expect(screen.getByText('Validar')).toBeEnabled();
    expect(screen.getAllByText('Rechazar')).toHaveLength(1);
    expect(screen.getByText('Rechazar')).toBeEnabled();

    resolvePatch({ data: report({ id: 1, description: 'Uno', validation_status: 'valido' }) });
    await pressed;
  });

  it('un 409 al validar avisa y refresca la tarjeta', async () => {
    api.patch.mockRejectedValue({ response: { status: 409 } });
    await setup([report()], { detail: report({ validation_status: 'rechazado' }) });
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('Validar'));

    expect(await screen.findByText('Este reporte cambió mientras tanto. Se actualizó la tarjeta.')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/reports/1');
    // Con el filtro Pendientes, la tarjeta rechazada sale de la lista.
    await waitFor(() => expect(screen.queryByText('Basura en la plaza')).toBeNull());
  });

  it('rechazar pide motivo y lo envía', async () => {
    api.patch.mockResolvedValue({ data: report({ validation_status: 'rechazado', rejection_reason: 'No aplica' }) });
    await setup();
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('Rechazar'));
    const input = await screen.findByPlaceholderText('Ej. No corresponde a contaminación');
    await fireEvent.changeText(input, 'No aplica');
    await fireEvent.press(screen.getAllByText('Rechazar').at(-1));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        '/admin/reports/1/validation',
        expect.objectContaining({
          validation_status: 'rechazado',
          expected_validation_status: 'pendiente',
          rejection_reason: 'No aplica',
        })
      )
    );
  });

  it('rechazar sin motivo deja el botón deshabilitado y no llama a la API', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('Rechazar'));
    await screen.findByPlaceholderText('Ej. No corresponde a contaminación');
    const confirm = screen.getAllByText('Rechazar').at(-1);
    expect(confirm).toBeDisabled();
    await fireEvent.press(confirm);

    expect(api.patch).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('si se borra el motivo muestra el error en línea dentro del modal', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');
    await fireEvent.press(screen.getByText('Rechazar'));
    const input = await screen.findByPlaceholderText('Ej. No corresponde a contaminación');
    expect(screen.queryByText('Escribe el motivo del rechazo.')).toBeNull();

    await fireEvent.changeText(input, 'abc');
    await fireEvent.changeText(input, '   ');

    expect(screen.getByText('Escribe el motivo del rechazo.')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('un motivo rápido rellena el campo y habilita Rechazar', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');
    await fireEvent.press(screen.getByText('Rechazar'));
    const input = await screen.findByPlaceholderText('Ej. No corresponde a contaminación');

    await fireEvent.press(screen.getByText('Foto poco clara'));

    expect(input).toHaveDisplayValue('Foto poco clara');
    expect(screen.getByText('15/500')).toBeTruthy();
    expect(screen.getAllByText('Rechazar').at(-1)).toBeEnabled();
  });

  it('el modal muestra la descripción del reporte', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');
    await fireEvent.press(screen.getByText('Rechazar'));

    await screen.findByText('Motivo del rechazo');
    expect(screen.getAllByText('Basura en la plaza')).toHaveLength(2);
  });

  it('mientras se guarda el rechazo no se puede cancelar', async () => {
    let resolvePatch;
    api.patch.mockImplementation(() => new Promise((resolve) => { resolvePatch = resolve; }));
    await setup();
    await screen.findByText('Basura en la plaza');
    await fireEvent.press(screen.getByText('Rechazar'));
    await fireEvent.press(await screen.findByText('Reporte duplicado'));

    const pressed = fireEvent.press(screen.getAllByText('Rechazar').at(-1));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));

    expect(screen.getByText('Cancelar')).toBeDisabled();

    await act(async () => { resolvePatch({ data: report({ validation_status: 'rechazado' }) }); });
    await pressed;
    expect(await screen.findByText('Reporte rechazado')).toBeTruthy();
  });

  it('un 409 al rechazar avisa, cierra el modal y refresca la tarjeta', async () => {
    api.patch.mockRejectedValue({ response: { status: 409 } });
    await setup([report()], { detail: report({ validation_status: 'valido' }) });
    await screen.findByText('Basura en la plaza');
    await fireEvent.press(screen.getByText('Rechazar'));
    await fireEvent.press(await screen.findByText('Reporte duplicado'));

    await fireEvent.press(screen.getAllByText('Rechazar').at(-1));

    expect(await screen.findByText('Este reporte cambió mientras tanto. Se actualizó la tarjeta.')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/reports/1');
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('el filtro de estado envía el param status', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');

    await openFilters();
    await fireEvent.press(screen.getByText('Pendiente'));

    await waitFor(() =>
      expect(lastReportsParams()).toEqual({ validation_status: 'pendiente', status: 'Pendiente', page: 1 })
    );
  });

  it('elegir un estado avanzado desde Pendientes pasa a Válidos, porque esa combinación nunca tiene datos', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');

    await openFilters();
    await fireEvent.press(screen.getByText('En Progreso'));

    await waitFor(() =>
      expect(lastReportsParams()).toEqual({ validation_status: 'valido', status: 'En Progreso', page: 1 })
    );
  });

  it('volver a Pendientes quita un filtro de estado avanzado', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');
    await openFilters();
    await fireEvent.press(screen.getByText('Resuelto'));
    await waitFor(() => expect(lastReportsParams().status).toBe('Resuelto'));

    await fireEvent.press(await screen.findByText('Pendientes'));

    await waitFor(() => expect(lastReportsParams()).toEqual({ validation_status: 'pendiente', page: 1 }));
  });

  it('los filtros de estado y categoría están ocultos hasta abrir el panel', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');
    expect(screen.queryByText('Estado')).toBeNull();
    expect(screen.queryByText('Categoría')).toBeNull();

    await openFilters();

    expect(screen.getByText('Estado')).toBeTruthy();
    expect(await screen.findByText('Categoría')).toBeTruthy();

    await fireEvent.press(screen.getByText('Filtros'));
    expect(screen.queryByText('Estado')).toBeNull();
  });

  it('muestra los contadores de cada pestaña', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');

    expect(screen.getByLabelText('Pendientes, 3')).toBeTruthy();
    expect(screen.getByLabelText('Válidos, 5')).toBeTruthy();
    expect(screen.getByLabelText('Rechazados, 7')).toBeTruthy();
    expect(screen.getByLabelText('Todos, 15')).toBeTruthy();
  });

  it('la pestaña activa queda marcada como seleccionada', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');

    expect(screen.getByRole('tab', { name: 'Pendientes, 3', selected: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Válidos, 5', selected: false })).toBeTruthy();
  });

  it('validar ajusta los contadores: resta de Pendientes y suma a Válidos', async () => {
    api.patch.mockResolvedValue({ data: report({ validation_status: 'valido' }) });
    await setup();
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('Validar'));

    expect(await screen.findByLabelText('Pendientes, 2')).toBeTruthy();
    expect(screen.getByLabelText('Válidos, 6')).toBeTruthy();
    expect(screen.getByLabelText('Todos, 15')).toBeTruthy();
  });

  it('rechazar ajusta los contadores: resta de Pendientes y suma a Rechazados', async () => {
    api.patch.mockResolvedValue({ data: report({ validation_status: 'rechazado', rejection_reason: 'No aplica' }) });
    await setup();
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('Rechazar'));
    await fireEvent.changeText(await screen.findByPlaceholderText('Ej. No corresponde a contaminación'), 'No aplica');
    await fireEvent.press(screen.getAllByText('Rechazar').at(-1));

    expect(await screen.findByLabelText('Pendientes, 2')).toBeTruthy();
    expect(screen.getByLabelText('Rechazados, 8')).toBeTruthy();
  });

  it('el botón Filtros muestra cuántos filtros hay activos y Limpiar los reinicia', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');
    expect(screen.queryByText('Limpiar')).toBeNull();

    await openFilters();
    await fireEvent.press(await screen.findByText('Escombros'));
    await waitFor(() => expect(lastReportsParams().category_id).toBe(2));

    expect(screen.getByText('1')).toBeTruthy();
    await fireEvent.press(screen.getByText('Limpiar'));

    await waitFor(() => expect(lastReportsParams()).toEqual({ validation_status: 'pendiente', page: 1 }));
    expect(screen.queryByText('Limpiar')).toBeNull();
  });

  it('el estado vacío ofrece limpiar filtros cuando hay alguno activo', async () => {
    await setup([]);
    expect(await screen.findByText('No hay reportes pendientes de revisión.')).toBeTruthy();
    expect(screen.queryByText('Limpiar filtros')).toBeNull();

    await openFilters();
    await fireEvent.press(await screen.findByText('Escombros'));
    await waitFor(() => expect(lastReportsParams().category_id).toBe(2));
    await fireEvent.press(await screen.findByText('Limpiar filtros'));

    await waitFor(() => expect(lastReportsParams()).toEqual({ validation_status: 'pendiente', page: 1 }));
  });

  it('solo ofrece la acción de validación que cambia algo', async () => {
    await setup([
      validReport({ id: 1, description: 'Uno' }),
      report({ id: 2, description: 'Dos', validation_status: 'rechazado' }),
    ]);
    await screen.findByText('Uno');

    // Una sola de cada: Rechazar en el válido y Validar en el rechazado.
    expect(screen.getAllByText('Validar')).toHaveLength(1);
    expect(screen.getAllByText('Rechazar')).toHaveLength(1);
  });

  it('validar con el filtro Todos deja la tarjeta y actualiza su insignia', async () => {
    api.patch.mockResolvedValue({ data: report({ validation_status: 'valido' }) });
    await setup();
    await screen.findByText('Basura en la plaza');
    await fireEvent.press(screen.getAllByText('Todos').at(0));
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('Validar'));

    expect(await screen.findByText('VÁLIDO')).toBeTruthy();
    expect(screen.getByText('Basura en la plaza')).toBeTruthy();
    expect(screen.getByText(/1 en total/)).toBeTruthy();
  });

  it('validar con el filtro Pendientes saca la tarjeta y baja el total', async () => {
    api.patch.mockResolvedValue({ data: report({ validation_status: 'valido' }) });
    await setup();
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('Validar'));

    await waitFor(() => expect(screen.queryByText('Basura en la plaza')).toBeNull());
    expect(screen.queryByText(/en total/)).toBeNull();
  });

  it('el filtro de categoría usa /categories y envía category_id', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');
    expect(api.get).toHaveBeenCalledWith('/categories');

    await openFilters();
    await fireEvent.press(await screen.findByText('Escombros'));

    await waitFor(() =>
      expect(lastReportsParams()).toEqual({ validation_status: 'pendiente', category_id: 2, page: 1 })
    );

    await fireEvent.press(screen.getByText('Todas'));
    await waitFor(() => expect(lastReportsParams()).toEqual({ validation_status: 'pendiente', page: 1 }));
  });

  it('si fallan las categorías la pantalla sigue funcionando sin esos chips', async () => {
    await setup([report()], { categories: null });

    expect(await screen.findByText('Basura en la plaza')).toBeTruthy();
    await openFilters();
    expect(screen.queryByText('Todas')).toBeNull();
    expect(screen.queryByText('Categoría')).toBeNull();
  });

  it('tocar la tarjeta abre el detalle del reporte', async () => {
    const navigation = await setup();
    await fireEvent.press(await screen.findByText('Basura en la plaza'));

    expect(navigation.navigate).toHaveBeenCalledWith('DetalleReporte', { reportId: 1 });
  });

  it('los botones de acción no navegan al detalle', async () => {
    api.patch.mockResolvedValue({ data: report({ validation_status: 'valido' }) });
    const navigation = await setup();
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('Validar'));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());

    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('no muestra opciones de estado en reportes no válidos', async () => {
    await setup([report({ id: 1 }), report({ id: 2, validation_status: 'rechazado' })]);
    await screen.findAllByText('Basura en la plaza');

    expect(screen.queryByText('Estado del reporte')).toBeNull();
  });

  it('cambiar estado llama al PATCH y actualiza la tarjeta sin sacarla de la lista', async () => {
    api.patch.mockResolvedValue({ data: validReport({ status: 'Resuelto' }) });
    await setupValid();

    await fireEvent.press(screen.getAllByText('Resuelto').at(-1));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/reports/1/status', { status: 'Resuelto' }));
    // Sin filtro de estado la tarjeta se queda, con el total intacto.
    expect(screen.getByText('Basura en la plaza')).toBeTruthy();
    expect(screen.getByText(/1 en total/)).toBeTruthy();
    expect(await screen.findByText('Estado actualizado a Resuelto')).toBeTruthy();
  });

  it('no llama al PATCH si se elige el estado actual', async () => {
    await setupValid();

    await fireEvent.press(screen.getAllByText('Pendiente').at(-1));

    expect(api.patch).not.toHaveBeenCalled();
  });

  it('evita doble envío mientras se guarda el estado', async () => {
    let resolvePatch;
    api.patch.mockImplementation(() => new Promise((resolve) => { resolvePatch = resolve; }));
    await setupValid();

    // fireEvent.press es asíncrono: se esperan sus promesas al final, con el PATCH ya resuelto.
    const first = fireEvent.press(screen.getAllByText('Resuelto').at(-1));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    const second = fireEvent.press(screen.getAllByText('En Progreso').at(-1));

    resolvePatch({ data: validReport({ status: 'Resuelto' }) });
    await first;
    await second;

    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(api.patch).toHaveBeenCalledWith('/reports/1/status', { status: 'Resuelto' });
  });

  it('mientras se guarda un estado solo esa tarjeta queda deshabilitada', async () => {
    let resolvePatch;
    api.patch.mockImplementation(() => new Promise((resolve) => { resolvePatch = resolve; }));
    await setupValid([validReport({ id: 1 }), validReport({ id: 2 })]);

    const first = fireEvent.press(screen.getAllByText('Resuelto').at(0));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));

    expect(screen.getAllByText('En Progreso').at(0)).toBeDisabled();
    expect(screen.getAllByText('En Progreso').at(-1)).toBeEnabled();

    resolvePatch({ data: validReport({ id: 1, status: 'Resuelto' }) });
    await first;

    expect(api.patch).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getAllByText('En Progreso').at(0)).toBeEnabled());
  });

  it('el reporte sale de la lista y baja el total si deja de coincidir con el filtro de estado', async () => {
    api.patch.mockResolvedValue({ data: validReport({ status: 'Resuelto' }) });
    await setupValid();
    await openFilters();
    await fireEvent.press(screen.getAllByText('Pendiente').at(0));
    await waitFor(() => expect(lastReportsParams().status).toBe('Pendiente'));
    await screen.findByText('Basura en la plaza');
    expect(screen.getByText(/1 en total/)).toBeTruthy();

    await fireEvent.press(screen.getAllByText('Resuelto').at(-1));

    await waitFor(() => expect(screen.queryByText('Basura en la plaza')).toBeNull());
    expect(screen.queryByText(/en total/)).toBeNull();
  });

  it('un error al cambiar el estado muestra aviso y deja la tarjeta igual', async () => {
    api.patch.mockRejectedValue(new Error('fail'));
    await setupValid();

    await fireEvent.press(screen.getAllByText('Resuelto').at(-1));

    expect(await screen.findByText('No se pudo actualizar el estado.')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(screen.getByText('Basura en la plaza')).toBeTruthy();
  });

  it('un 409 al cambiar el estado avisa y refresca la tarjeta obsoleta', async () => {
    api.patch.mockRejectedValue({ response: { status: 409 } });
    await setupValid([validReport()], { detail: report({ validation_status: 'rechazado' }) });

    await fireEvent.press(screen.getAllByText('Resuelto').at(-1));

    expect(await screen.findByText(/ya no está validado/)).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/reports/1');
    // Con el filtro Válidos, el reporte rechazado sale de la lista.
    await waitFor(() => expect(screen.queryByText('Basura en la plaza')).toBeNull());
  });

  it('si cambia el filtro con un PATCH en vuelo recarga en vez de tocar la lista nueva', async () => {
    let resolvePatch;
    api.patch.mockImplementation(() => new Promise((resolve) => { resolvePatch = resolve; }));
    await setupValid();
    await openFilters();
    await fireEvent.press(screen.getAllByText('Pendiente').at(0));
    await waitFor(() => expect(lastReportsParams().status).toBe('Pendiente'));
    await screen.findByText('Basura en la plaza');

    const pressed = fireEvent.press(screen.getAllByText('Resuelto').at(-1));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getAllByText('Todos').at(-1));
    await waitFor(() => expect(lastReportsParams().status).toBeUndefined());
    await screen.findByText('Basura en la plaza');
    const callsBefore = reportsCalls().length;

    await act(async () => { resolvePatch({ data: validReport({ status: 'Resuelto' }) }); });
    await pressed;

    await waitFor(() => expect(reportsCalls().length).toBe(callsBefore + 1));
    expect(await screen.findByText('Basura en la plaza')).toBeTruthy();
    expect(screen.getByText(/1 en total/)).toBeTruthy();
  });

  it('al volver del detalle refresca solo esa tarjeta, sin recargar la lista', async () => {
    await setup([report()], { detail: report({ description: 'Descripción editada' }) });
    await fireEvent.press(await screen.findByText('Basura en la plaza'));
    const callsBefore = reportsCalls().length;

    await act(async () => { mockRefocus(); });

    expect(await screen.findByText('Descripción editada')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/reports/1');
    expect(reportsCalls()).toHaveLength(callsBefore);
  });

  it('al volver del detalle saca la tarjeta si ya no coincide con el filtro', async () => {
    await setup([report()], { detail: report({ validation_status: 'valido' }) });
    await fireEvent.press(await screen.findByText('Basura en la plaza'));

    await act(async () => { mockRefocus(); });

    await waitFor(() => expect(screen.queryByText('Basura en la plaza')).toBeNull());
  });

  it('un foco sin venir del detalle recarga la lista', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');
    const callsBefore = reportsCalls().length;

    await act(async () => { mockRefocus(); });

    await waitFor(() => expect(reportsCalls().length).toBe(callsBefore + 1));
  });

  it('una respuesta obsoleta no pisa la lista del filtro más reciente', async () => {
    let resolveSlow;
    const slow = new Promise((resolve) => { resolveSlow = resolve; });
    const page = (items) => ({ data: { data: items, meta: { current_page: 1, last_page: 1, per_page: 20, total: items.length } } });
    api.get.mockImplementation((url, config) => {
      if (url !== '/admin/reports') return Promise.resolve({ data: [] });
      if (config.params.validation_status === 'pendiente') return slow;
      return Promise.resolve(page([report({ id: 2, description: 'Reporte válido', validation_status: 'valido' })]));
    });
    await render(<AdminReportsScreen navigation={{ navigate: jest.fn() }} />);

    await fireEvent.press(screen.getByText('Válidos'));
    expect(await screen.findByText('Reporte válido')).toBeTruthy();

    await act(async () => { resolveSlow(page([report({ id: 1, description: 'Reporte viejo' })])); });

    expect(screen.queryByText('Reporte viejo')).toBeNull();
    expect(screen.getByText('Reporte válido')).toBeTruthy();
  });

  it('"cargar más" pide por offset desde las filas que quedan tras moderar', async () => {
    const page1 = [report({ id: 3, description: 'Tercero' }), report({ id: 2, description: 'Segundo' })];
    api.get.mockImplementation((url, config) => {
      if (url === '/admin/reports') {
        if (config?.params?.offset !== undefined) {
          return Promise.resolve({ data: { data: [report({ id: 1, description: 'Primero' })], meta: { offset: config.params.offset, total: 2, counts: COUNTS } } });
        }
        return Promise.resolve({ data: { data: page1, meta: { current_page: 1, last_page: 2, per_page: 2, total: 3, counts: COUNTS } } });
      }
      if (url === '/admin/reports/summary') return Promise.resolve({ data: SUMMARY });
      return Promise.resolve({ data: [] });
    });
    api.patch.mockResolvedValue({ data: report({ id: 3, description: 'Tercero', validation_status: 'valido' }) });
    await render(<AdminReportsScreen navigation={makeNavigation()} />);
    expect(await screen.findByText('Tercero')).toBeTruthy();

    // Se valida uno: sale de "Pendientes" y quedan 1 fila de 2.
    await fireEvent.press(screen.getAllByText('Validar')[0]);
    await waitFor(() => expect(screen.queryByText('Tercero')).toBeNull());

    await fireEvent(screen.getByTestId('admin-report-list'), 'onEndReached');

    await waitFor(() => expect(lastReportsParams()).toEqual({ validation_status: 'pendiente', offset: 1 }));
    expect(await screen.findByText('Primero')).toBeTruthy();
    expect(screen.getByText('Segundo')).toBeTruthy();
  });
});
