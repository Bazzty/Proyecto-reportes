import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import AdminReportsScreen from '../screens/AdminReportsScreen';
import api from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn() },
}));
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return { useFocusEffect: (cb) => React.useEffect(cb, [cb]) };
});

const report = (overrides = {}) => ({
  id: 1,
  description: 'Basura en la plaza',
  validation_status: 'pendiente',
  photo_url: null,
  created_at: '2026-10-01T12:00:00.000Z',
  category: { id: 1, name: 'basura' },
  zone: { id: 5, name: 'Puerto Varas' },
  user: { id: 2, name: 'Ana' },
  rejection_reason: null,
  ...overrides,
});

const CATEGORIES = [{ id: 1, name: 'basura' }, { id: 2, name: 'escombros' }];

const setup = async (items = [report()], { navigation = { navigate: jest.fn() }, categories = CATEGORIES } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/categories') {
      return categories ? Promise.resolve({ data: categories }) : Promise.reject(new Error('fail'));
    }
    return Promise.resolve({
      data: { data: items, meta: { current_page: 1, last_page: 1, per_page: 20, total: items.length } },
    });
  });
  await render(<AdminReportsScreen navigation={navigation} />);
  return navigation;
};

const reportsCalls = () => api.get.mock.calls.filter(([url]) => url === '/admin/reports');
const lastReportsParams = () => reportsCalls().at(-1)[1].params;

describe('AdminReportsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('carga y muestra los reportes pendientes', async () => {
    await setup();

    expect(api.get).toHaveBeenCalledWith('/admin/reports', { params: { validation_status: 'pendiente', page: 1 } });
    expect(await screen.findByText('Basura en la plaza')).toBeTruthy();
    expect(screen.getByText('PENDIENTE')).toBeTruthy();
    expect(screen.getByText('📍 Puerto Varas · Ana')).toBeTruthy();
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

  it('rechazar sin motivo avisa y no llama a la API', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('Rechazar'));
    await fireEvent.press(screen.getAllByText('Rechazar').at(-1));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Falta motivo', 'Escribe el motivo del rechazo.'));
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('el filtro de estado envía el param status', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByText('En Progreso'));

    await waitFor(() =>
      expect(lastReportsParams()).toEqual({ validation_status: 'pendiente', status: 'En Progreso', page: 1 })
    );
  });

  it('el filtro de categoría usa /categories y envía category_id', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');
    expect(api.get).toHaveBeenCalledWith('/categories');

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
    expect(screen.queryByText('Todas')).toBeNull();
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
    api.patch.mockResolvedValue({ data: { id: 1, status: 'Resuelto' } });
    await setup([report({ validation_status: 'valido', status: 'Pendiente' })]);
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getAllByText('Resuelto').at(-1));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/reports/1/status', { status: 'Resuelto' }));
    // Sin filtro de estado la tarjeta se queda, con el total intacto.
    expect(screen.getByText('Basura en la plaza')).toBeTruthy();
    expect(screen.getByText(/1 en total/)).toBeTruthy();
  });

  it('no llama al PATCH si se elige el estado actual', async () => {
    await setup([report({ validation_status: 'valido', status: 'Pendiente' })]);
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getAllByText('Pendiente').at(-1));

    expect(api.patch).not.toHaveBeenCalled();
  });

  it('evita doble envío mientras se guarda el estado', async () => {
    let resolvePatch;
    api.patch.mockImplementation(() => new Promise((resolve) => { resolvePatch = resolve; }));
    await setup([report({ validation_status: 'valido', status: 'Pendiente' })]);
    await screen.findByText('Basura en la plaza');

    // fireEvent.press es asíncrono: se esperan sus promesas al final, con el PATCH ya resuelto.
    const first = fireEvent.press(screen.getAllByText('Resuelto').at(-1));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    const second = fireEvent.press(screen.getAllByText('En Progreso').at(-1));

    resolvePatch({ data: { id: 1, status: 'Resuelto' } });
    await first;
    await second;

    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(api.patch).toHaveBeenCalledWith('/reports/1/status', { status: 'Resuelto' });
  });

  it('el reporte sale de la lista y baja el total si deja de coincidir con el filtro de estado', async () => {
    api.patch.mockResolvedValue({ data: { id: 1, status: 'Resuelto' } });
    await setup([report({ validation_status: 'valido', status: 'Pendiente' })]);
    await screen.findByText('Basura en la plaza');
    await fireEvent.press(screen.getAllByText('Pendiente').at(0));
    await waitFor(() => expect(lastReportsParams().status).toBe('Pendiente'));
    await screen.findByText('Basura en la plaza');
    expect(screen.getByText(/1 en total/)).toBeTruthy();

    await fireEvent.press(screen.getAllByText('Resuelto').at(-1));

    await waitFor(() => expect(screen.queryByText('Basura en la plaza')).toBeNull());
    expect(screen.queryByText(/en total/)).toBeNull();
  });

  it('un error al cambiar el estado muestra alerta y deja la tarjeta igual', async () => {
    api.patch.mockRejectedValue(new Error('fail'));
    await setup([report({ validation_status: 'valido', status: 'Pendiente' })]);
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getAllByText('Resuelto').at(-1));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudo actualizar el estado.'));
    expect(screen.getByText('Basura en la plaza')).toBeTruthy();
  });

  it('una respuesta obsoleta no pisa la lista del filtro más reciente', async () => {
    let resolveSlow;
    const slow = new Promise((resolve) => { resolveSlow = resolve; });
    const page = (items) => ({ data: { data: items, meta: { current_page: 1, last_page: 1, per_page: 20, total: items.length } } });
    api.get.mockImplementation((url, config) => {
      if (url === '/categories') return Promise.resolve({ data: [] });
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
});
