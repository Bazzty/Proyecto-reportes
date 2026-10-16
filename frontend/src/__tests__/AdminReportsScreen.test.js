import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
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

const setup = async (items = [report()]) => {
  api.get.mockResolvedValue({
    data: { data: items, meta: { current_page: 1, last_page: 1, per_page: 20, total: items.length } },
  });
  await render(<AdminReportsScreen />);
};

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
      expect(api.patch).toHaveBeenCalledWith('/admin/reports/1/validation', expect.objectContaining({ validation_status: 'valido' }))
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
        expect.objectContaining({ validation_status: 'rechazado', rejection_reason: 'No aplica' })
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
});
