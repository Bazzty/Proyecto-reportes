import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import MyReportsScreen from '../screens/MyReportsScreen';
import api from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
// useFocusEffect se comporta como un useEffect: corre al montar la pantalla
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return { useFocusEffect: (cb) => React.useEffect(cb, [cb]) };
});

const report = (overrides = {}) => ({
  id: 1,
  description: 'Basura en la esquina',
  status: 'Pendiente',
  latitude: -41.3198,
  longitude: -72.9833,
  photo_url: null,
  created_at: '2026-10-01T12:00:00.000Z',
  category: { id: 1, name: 'basura' },
  ...overrides,
});

const setup = async (reports) => {
  if (reports instanceof Error) api.get.mockRejectedValue(reports);
  else api.get.mockResolvedValue({ data: reports });
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  await render(<MyReportsScreen navigation={navigation} />);
  return navigation;
};

describe('MyReportsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pide /user/reports y muestra los datos de cada reporte', async () => {
    await setup([report()]);

    expect(await screen.findByText('Basura en la esquina')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/user/reports');
    expect(screen.getByText('Basura')).toBeTruthy();
    expect(screen.getByText('PENDIENTE')).toBeTruthy();
    expect(screen.getByText('41.3198°S, 72.9833°O')).toBeTruthy();
  });

  it('usa singular y plural en el contador', async () => {
    await setup([report()]);
    expect(await screen.findByText('1 reporte encontrado')).toBeTruthy();
  });

  it('usa plural con más de un reporte', async () => {
    await setup([report(), report({ id: 2, description: 'Otro' })]);
    expect(await screen.findByText('2 reportes encontrados')).toBeTruthy();
  });

  it('un reporte sin categoría muestra "Sin categoría"', async () => {
    await setup([report({ category: null })]);
    expect(await screen.findByText('Sin categoría')).toBeTruthy();
  });

  it('sin reportes muestra el estado vacío y el enlace crea el primero', async () => {
    const navigation = await setup([]);

    expect(await screen.findByText('Aún no has reportado incidencias.')).toBeTruthy();
    expect(screen.getByText('Sin reportes aún')).toBeTruthy();
    await fireEvent.press(screen.getByText('¡Crea tu primer reporte!'));
    expect(navigation.navigate).toHaveBeenCalledWith('NewReport');
  });

  it('si la API falla muestra el error y no el estado vacío', async () => {
    await setup(new Error('network'));

    expect(await screen.findByText('No se pudieron cargar tus reportes.')).toBeTruthy();
    expect(screen.queryByText('Aún no has reportado incidencias.')).toBeNull();
    expect(screen.queryByText('Sin reportes aún')).toBeNull();
  });

  it('Reintentar vuelve a pedir los reportes y los muestra', async () => {
    await setup(new Error('network'));
    api.get.mockResolvedValue({ data: [report()] });

    await fireEvent.press(await screen.findByText('Reintentar'));

    expect(await screen.findByText('Basura en la esquina')).toBeTruthy();
    expect(screen.queryByText('No se pudieron cargar tus reportes.')).toBeNull();
  });

  it('tocar un reporte navega al detalle', async () => {
    const navigation = await setup([report({ id: 42 })]);

    await fireEvent.press(await screen.findByText('Basura en la esquina'));
    expect(navigation.navigate).toHaveBeenCalledWith('DetalleReporte', { reportId: 42 });
  });

  it('"Volver" regresa a la pantalla anterior', async () => {
    const navigation = await setup([]);
    await waitFor(() => expect(screen.getByText('Sin reportes aún')).toBeTruthy());

    await fireEvent.press(screen.getByText('Volver'));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
