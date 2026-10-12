import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import HomeScreen from '../screens/HomeScreen';
import api, { clearAuthToken } from '../services/api';

let mockLeafletProps = {};
const mockCenterOn = jest.fn();

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  clearAuthToken: jest.fn(),
}));
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return { useFocusEffect: (cb) => React.useEffect(cb, [cb]) };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
let mockIsConnected = true;
jest.mock('../hooks/useOfflineSync', () => ({
  __esModule: true,
  default: () => ({ isConnected: mockIsConnected }),
}));
jest.mock('../services/offlineQueue', () => ({
  subscribe: jest.fn(() => jest.fn()),
  getPendingCount: jest.fn(async () => 0),
  isSyncing: jest.fn(() => false),
}));
jest.mock('../components/LeafletMap', () => {
  const React = require('react');
  const { View } = require('react-native');
  const LeafletMap = React.forwardRef(function LeafletMap(props, ref) {
    mockLeafletProps = props;
    React.useImperativeHandle(ref, () => ({ centerOn: mockCenterOn }));
    return <View testID="leaflet-map" />;
  });
  return { __esModule: true, default: LeafletMap };
});

const CATEGORIES = [{ id: 1, name: 'basura' }, { id: 2, name: 'aguas' }];
const REPORTS = [
  { id: 1, description: 'Basura en la plaza', status: 'Pendiente', latitude: -41.31, longitude: -72.98, photo_url: null, category: { id: 1, name: 'basura' }, user: { name: 'Ana' } },
  { id: 2, description: 'Agua contaminada', status: 'Resuelto', latitude: -41.32, longitude: -72.99, photo_url: null, category: { id: 2, name: 'aguas' }, user: { name: 'Beto' } },
];

const mockApi = ({ mine = [] } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/categories') return Promise.resolve({ data: CATEGORIES });
    if (url === '/reports') return Promise.resolve({ data: REPORTS });
    if (url === '/reports/heatmap') return Promise.resolve({ data: [{ latitude: '-41.31', longitude: '-72.98', count: 3 }] });
    if (url === '/user/reports') return Promise.resolve({ data: mine });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
};

const setup = async ({ guest = false, params = {} } = {}) => {
  const navigation = { navigate: jest.fn(), reset: jest.fn(), setParams: jest.fn() };
  const route = { params: { ...(guest ? { guest: true } : {}), ...params } };
  await render(<HomeScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(mockLeafletProps.reports?.length).toBeGreaterThan(0));
  return navigation;
};

describe('HomeScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    mockIsConnected = true;
    mockLeafletProps = {};
    await AsyncStorage.clear();
    mockApi();
  });

  it('carga reportes y categorías', async () => {
    await setup();

    expect(mockLeafletProps.reports.map(r => r.id)).toEqual(expect.arrayContaining([1, 2]));
    expect(screen.getByText('Todos')).toBeTruthy();
    expect(screen.getByText('Basura')).toBeTruthy();
    expect(screen.getByText('Aguas')).toBeTruthy();
  });

  it('pasa los puntos del heatmap (con conteo como peso) al mapa', async () => {
    await setup();

    await waitFor(() => expect(mockLeafletProps.heat).toEqual([
      { latitude: -41.31, longitude: -72.98, weight: 3 },
    ]));
    expect(api.get).toHaveBeenCalledWith('/reports/heatmap');
  });

  it('el modo "Foco" usa los reportes individuales como heatmap', async () => {
    await setup();

    await fireEvent.press(screen.getByText('Foco'));

    await waitFor(() => expect(mockLeafletProps.heat).toEqual([
      { latitude: -41.31, longitude: -72.98, weight: 1 },
      { latitude: -41.32, longitude: -72.99, weight: 1 },
    ]));
  });

  it('el modo "Zona" vuelve a usar los centroides por zona', async () => {
    await setup();
    await fireEvent.press(screen.getByText('Foco'));
    await fireEvent.press(screen.getByText('Zona'));

    await waitFor(() => expect(mockLeafletProps.heat).toEqual([
      { latitude: -41.31, longitude: -72.98, weight: 3 },
    ]));
  });

  it('el filtro por categoría limita los reportes del mapa', async () => {
    await setup();

    await fireEvent.press(screen.getByText('Aguas'));
    await waitFor(() => expect(mockLeafletProps.reports).toHaveLength(1));
    expect(mockLeafletProps.reports[0].category.name).toBe('aguas');

    await fireEvent.press(screen.getByText('Aguas'));
    await waitFor(() => expect(mockLeafletProps.reports).toHaveLength(2));
  });

  it('"Todos" quita el filtro', async () => {
    await setup();
    await fireEvent.press(screen.getByText('Aguas'));
    await waitFor(() => expect(mockLeafletProps.reports).toHaveLength(1));

    await fireEvent.press(screen.getByText('Todos'));
    await waitFor(() => expect(mockLeafletProps.reports).toHaveLength(2));
  });

  it('tocar un marcador del mapa navega al detalle', async () => {
    const navigation = await setup();
    mockLeafletProps.onSelectReport(2);
    expect(navigation.navigate).toHaveBeenCalledWith('DetalleReporte', { reportId: 2 });
  });

  it('saluda al usuario por su primer nombre', async () => {
    await AsyncStorage.setItem('userName', 'María José Pérez');
    await setup();
    expect(await screen.findByText('¡Bienvenido, María!')).toBeTruthy();
  });

  it('muestra el conteo de reportes propios pendientes y resueltos', async () => {
    mockApi({ mine: [{ id: 1, status: 'Pendiente' }, { id: 3, status: 'Pendiente' }, { id: 2, status: 'Resuelto' }] });
    await setup();

    expect(await screen.findByText('2 pendientes')).toBeTruthy();
    expect(screen.getByText('1 resuelto')).toBeTruthy();
  });

  it('un usuario con sesión navega a Mis Reportes y Nuevo Reporte', async () => {
    const navigation = await setup();

    await fireEvent.press(screen.getByText('Mis Reportes'));
    expect(navigation.navigate).toHaveBeenCalledWith('MyReports');
    await fireEvent.press(screen.getByText('icon:add'));
    expect(navigation.navigate).toHaveBeenCalledWith('NewReport');
  });

  it('un invitado no pide /user/reports', async () => {
    await setup({ guest: true });
    expect(api.get).not.toHaveBeenCalledWith('/user/reports');
  });

  it('un invitado ve el saludo de invitado y las acciones quedan bloqueadas', async () => {
    const navigation = await setup({ guest: true });

    expect(screen.getByText('Inicia sesión para reportar →')).toBeTruthy();
    await fireEvent.press(screen.getByText('Mis Reportes'));
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Inicia sesión', 'Para ver tus reportes necesitas una cuenta.', expect.any(Array)
    );
    await fireEvent.press(screen.getByText('icon:add'));
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Inicia sesión', 'Para crear un reporte necesitas una cuenta.', expect.any(Array)
    );
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('el botón "Iniciar sesión" de la alerta de invitado va a Login', async () => {
    const navigation = await setup({ guest: true });
    await fireEvent.press(screen.getByText('Mis Reportes'));

    const buttons = Alert.alert.mock.calls.at(-1)[2];
    buttons.find((b) => b.text === 'Iniciar sesión').onPress();
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Login' }] });
  });

  it('"Ingresar" como invitado va directo a Login sin confirmar', async () => {
    const navigation = await setup({ guest: true });
    await fireEvent.press(screen.getByText('Ingresar'));

    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Login' }] });
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('cerrar sesión pide confirmación, llama a /logout y limpia la sesión', async () => {
    await AsyncStorage.multiSet([['token', 't'], ['userName', 'Ana'], ['userId', '1']]);
    api.post.mockResolvedValue({});
    const navigation = await setup();

    await fireEvent.press(screen.getByText('Salir'));
    expect(Alert.alert).toHaveBeenLastCalledWith('Cerrar sesión', '¿Seguro que quieres salir?', expect.any(Array));

    const buttons = Alert.alert.mock.calls.at(-1)[2];
    await buttons.find((b) => b.text === 'Salir').onPress();

    expect(api.post).toHaveBeenCalledWith('/logout');
    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(await AsyncStorage.getItem('userId')).toBeNull();
    expect(clearAuthToken).toHaveBeenCalled();
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Login' }] });
  });

  it('cierra la sesión localmente aunque /logout falle', async () => {
    await AsyncStorage.setItem('token', 't');
    api.post.mockRejectedValue(new Error('offline'));
    const navigation = await setup();

    await fireEvent.press(screen.getByText('Salir'));
    const buttons = Alert.alert.mock.calls.at(-1)[2];
    await buttons.find((b) => b.text === 'Salir').onPress();

    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Login' }] });
  });

  it('con permiso de ubicación centra el mapa y muestra el botón de ubicación', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: -41.3, longitude: -72.9 } });
    await setup();

    await waitFor(() => expect(mockCenterOn).toHaveBeenCalledWith(-41.3, -72.9, 14));
    await fireEvent.press(await screen.findByText('icon:locate'));
    expect(mockCenterOn).toHaveBeenLastCalledWith(-41.3, -72.9, 15);
  });

  it('sin permiso de ubicación no centra el mapa ni muestra el botón', async () => {
    await setup();
    expect(mockCenterOn).not.toHaveBeenCalled();
    expect(screen.queryByText('icon:locate')).toBeNull();
  });

  it('un reporte nuevo recibido por parámetro se agrega al mapa y se limpia el parámetro', async () => {
    // /reports queda pendiente: solo se ve lo que agrega la actualización optimista
    api.get.mockImplementation((url) => {
      if (url === '/reports') return new Promise(() => {});
      return Promise.resolve({ data: url === '/categories' ? CATEGORIES : [] });
    });
    const newReport = { id: 99, description: 'Recién creado', status: 'Pendiente', latitude: -41.3, longitude: -72.9, photo_url: null, category: { id: 1, name: 'basura' }, user: { name: 'Yo' } };
    const navigation = { navigate: jest.fn(), reset: jest.fn(), setParams: jest.fn() };
    await render(<HomeScreen navigation={navigation} route={{ params: { newReport } }} />);

    await waitFor(() => expect(mockLeafletProps.reports?.some(r => r.id === 99)).toBe(true));
    expect(navigation.setParams).toHaveBeenCalledWith({ newReport: undefined });
  });

  describe('refresco periódico', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    // Deja que termine la primera carga (y se programe el siguiente refresco)
    const advance = (ms) => act(() => jest.advanceTimersByTimeAsync(ms));
    const settle = () => advance(0);

    const failReports = () => {
      const ok = api.get.getMockImplementation();
      api.get.mockImplementation((url) =>
        url === '/reports' ? Promise.reject(new Error('network')) : ok(url)
      );
    };

    it('un fallo aislado no muestra el aviso de conexión', async () => {
      await setup();
      await settle();
      failReports();
      await advance(5000);

      expect(screen.queryByText(/Sin conexión/)).toBeNull();
    });

    it('dos fallos seguidos muestran el aviso y al recuperarse desaparece', async () => {
      await setup();
      await settle();
      const ok = api.get.getMockImplementation();
      failReports();
      await advance(5000);
      await advance(5000);

      expect(await screen.findByText(/Sin conexión/)).toBeTruthy();

      api.get.mockImplementation(ok);
      await advance(5000);

      await waitFor(() => expect(screen.queryByText(/Sin conexión/)).toBeNull());
    });

    it('no lanza una nueva petición mientras la anterior sigue en curso', async () => {
      await setup();
      await settle();
      const ok = api.get.getMockImplementation();
      api.get.mockImplementation((url) => (url === '/reports' ? new Promise(() => {}) : ok(url)));
      await advance(5000);
      const callsAfterHang = api.get.mock.calls.filter(([u]) => u === '/reports').length;
      await advance(30000);

      expect(api.get.mock.calls.filter(([u]) => u === '/reports').length).toBe(callsAfterHang);
    });
  });

  describe('modo offline', () => {
    it('muestra el aviso sin conexión', async () => {
      mockIsConnected = false;
      await setup();

      expect(await screen.findByText('Sin conexión: los datos pueden estar desactualizados')).toBeTruthy();
    });

    it('muestra la cantidad de reportes pendientes de sincronizar', async () => {
      const { getPendingCount } = require('../services/offlineQueue');
      getPendingCount.mockResolvedValue(2);

      await setup();

      expect(await screen.findByText('2 reportes pendientes de sincronizar')).toBeTruthy();
    });
  });

  describe('novedades', () => {
    it('muestra la campana con no leídas y abre la lista', async () => {
      await AsyncStorage.setItem('notifications', JSON.stringify([
        {
          id: 'n1',
          type: 'status',
          reportId: 1,
          message: 'Tu reporte pasó a "Resuelto".',
          createdAt: '2026-10-06T12:00:00.000Z',
          read: false,
        },
      ]));

      await setup();

      expect(await screen.findByTestId('notifications-badge')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('notifications-button'));
      expect(await screen.findByText('Tu reporte pasó a "Resuelto".')).toBeTruthy();
    });
  });

  describe('admin', () => {
    it('muestra el botón de admin solo para administradores', async () => {
      await AsyncStorage.setItem('isAdmin', '1');
      await setup();

      expect(screen.getByTestId('admin-button')).toBeTruthy();
    });

    it('no muestra el botón de admin para usuarios normales', async () => {
      await setup();

      expect(screen.queryByTestId('admin-button')).toBeNull();
    });
  });
});
