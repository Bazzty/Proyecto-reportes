import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import NewReportScreen from '../screens/NewReportScreen';
import api from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async () => ({ uri: 'file:///resized.jpg' })),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 4 },
}));

const CATEGORIES = [
  { id: 1, name: 'basura' },
  { id: 2, name: 'aguas' },
];

const COORDS_TEXT = 'Lat: -41.31980, Lng: -72.98330';

const grantLocation = () => {
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
  Location.hasServicesEnabledAsync.mockResolvedValue(true);
  Location.getLastKnownPositionAsync.mockResolvedValue(null);
  Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: -41.3198, longitude: -72.9833 } });
};

const setup = async () => {
  api.get.mockResolvedValue({ data: CATEGORIES });
  const navigation = { navigate: jest.fn() };
  await render(<NewReportScreen navigation={navigation} />);
  await screen.findByText('basura');
  return navigation;
};

const takePhoto = async () => {
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
  ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///photo.jpg' }] });
  await fireEvent.press(screen.getByText('Tomar Foto'));
  await waitFor(() => expect(screen.queryByText('Ninguna imagen seleccionada')).toBeNull());
};

describe('NewReportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    grantLocation();
  });

  it('carga y muestra las categorías', async () => {
    await setup();
    expect(api.get).toHaveBeenCalledWith('/categories');
    expect(screen.getByText('aguas')).toBeTruthy();
  });

  it('captura la ubicación automáticamente al montar', async () => {
    await setup();
    expect(await screen.findByText(COORDS_TEXT)).toBeTruthy();
    expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
  });

  it('si falla la carga de categorías muestra el error', async () => {
    api.get.mockRejectedValue(new Error('network'));
    await render(<NewReportScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Error', expect.stringContaining('No se pudieron cargar las categorías'))
    );
  });

  it('valida en orden: foto, descripción y categoría', async () => {
    await setup();
    const submit = () => fireEvent.press(screen.getByText('Enviar Reporte'));

    await submit();
    expect(Alert.alert).toHaveBeenLastCalledWith('Falta foto', 'Debes adjuntar una foto.');

    await takePhoto();
    await submit();
    expect(Alert.alert).toHaveBeenLastCalledWith('Falta descripción', 'Escribe una descripción.');

    await fireEvent.changeText(screen.getByPlaceholderText('Ej. Basura acumulada en la esquina...'), 'Basura');
    await submit();
    expect(Alert.alert).toHaveBeenLastCalledWith('Falta categoría', 'Selecciona una categoría.');

    expect(api.post).not.toHaveBeenCalled();
  });

  it('bloquea el envío si no hay ubicación', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true });
    await setup();
    await takePhoto();
    await fireEvent.press(screen.getByText('Enviar Reporte'));

    expect(Alert.alert).toHaveBeenLastCalledWith('Falta ubicación', 'Espera a que se detecte tu ubicación.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('si el permiso de ubicación se deniega muestra el mensaje y permite reintentar', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true });
    await setup();

    expect(await screen.findByText('Permiso de ubicación denegado. Actívalo para continuar.')).toBeTruthy();
    expect(screen.getByText('Reintentar')).toBeTruthy();
  });

  it('si el permiso está denegado permanentemente ofrece abrir Ajustes', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });
    await setup();

    expect(await screen.findByText('Abrir Ajustes')).toBeTruthy();
  });

  it('si el GPS está apagado muestra el mensaje correspondiente', async () => {
    Location.hasServicesEnabledAsync.mockResolvedValue(false);
    await setup();

    expect(await screen.findByText('Activa el GPS de tu dispositivo para continuar.')).toBeTruthy();
  });

  it('permiso de cámara denegado muestra la alerta y no abre la cámara', async () => {
    await setup();
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await fireEvent.press(screen.getByText('Tomar Foto'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Permiso denegado', 'Se necesita acceso a la cámara.')
    );
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('con todo completo envía el reporte como multipart y navega a Home', async () => {
    api.post.mockResolvedValue({ data: { id: 10 } });
    const navigation = await setup();
    await takePhoto();
    await screen.findByText(COORDS_TEXT);
    await fireEvent.changeText(screen.getByPlaceholderText('Ej. Basura acumulada en la esquina...'), 'Basura en la vereda');
    await fireEvent.press(screen.getByText('aguas'));
    await fireEvent.press(screen.getByText('Enviar Reporte'));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, form, config] = api.post.mock.calls[0];
    expect(url).toBe('/reports');
    expect(config.headers['Content-Type']).toBe('multipart/form-data');

    expect(form.get('description')).toBe('Basura en la vereda');
    expect(form.get('latitude')).toBe('-41.3198');
    expect(form.get('longitude')).toBe('-72.9833');
    expect(form.get('category_id')).toBe('2');
    expect(form.get('photo')).toBeTruthy();

    // El botón "OK" de la alerta de éxito navega a Home con el reporte nuevo
    const [title, , buttons] = Alert.alert.mock.calls.at(-1);
    expect(title).toBe('¡Éxito!');
    buttons[0].onPress();
    expect(navigation.navigate).toHaveBeenCalledWith('Home', { newReport: { id: 10 } });
  });

  it('si el backend devuelve un 422 muestra el primer error de validación', async () => {
    api.post.mockRejectedValue({ response: { data: { errors: { photo: ['La foto es muy pesada.'] } } } });
    await setup();
    await takePhoto();
    await screen.findByText(COORDS_TEXT);
    await fireEvent.changeText(screen.getByPlaceholderText('Ej. Basura acumulada en la esquina...'), 'Algo');
    await fireEvent.press(screen.getByText('basura'));
    await fireEvent.press(screen.getByText('Enviar Reporte'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'La foto es muy pesada.'));
  });
});
