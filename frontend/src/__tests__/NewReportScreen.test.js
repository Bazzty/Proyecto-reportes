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
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 4 },
}));

const CATEGORIES = [
  { id: 1, name: 'basura' },
  { id: 2, name: 'aguas' },
];

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

const getLocation = async () => {
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: -41.3198, longitude: -72.9833 } });
  await fireEvent.press(screen.getByText('Obtener mi ubicación actual'));
  await screen.findByText('Lat: -41.31980, Lng: -72.98330');
};

describe('NewReportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('carga y muestra las categorías', async () => {
    await setup();
    expect(api.get).toHaveBeenCalledWith('/categories');
    expect(screen.getByText('aguas')).toBeTruthy();
  });

  it('si falla la carga de categorías muestra el error', async () => {
    api.get.mockRejectedValue(new Error('network'));
    await render(<NewReportScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Error', expect.stringContaining('No se pudieron cargar las categorías'))
    );
  });

  it('valida en orden: foto, ubicación, descripción y categoría', async () => {
    await setup();
    const submit = () => fireEvent.press(screen.getByText('Enviar Reporte'));

    await submit();
    expect(Alert.alert).toHaveBeenLastCalledWith('Falta foto', 'Debes adjuntar una foto.');

    await takePhoto();
    await submit();
    expect(Alert.alert).toHaveBeenLastCalledWith('Falta ubicación', 'Obtén tu ubicación GPS.');

    await getLocation();
    await submit();
    expect(Alert.alert).toHaveBeenLastCalledWith('Falta descripción', 'Escribe una descripción.');

    await fireEvent.changeText(screen.getByPlaceholderText('Ej. Basura acumulada en la esquina...'), 'Basura');
    await submit();
    expect(Alert.alert).toHaveBeenLastCalledWith('Falta categoría', 'Selecciona una categoría.');

    expect(api.post).not.toHaveBeenCalled();
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

  it('permiso de ubicación denegado muestra la alerta', async () => {
    await setup();
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await fireEvent.press(screen.getByText('Obtener mi ubicación actual'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Permiso denegado', 'Se necesita acceso a la ubicación.')
    );
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('con todo completo envía el reporte como multipart y navega a Home', async () => {
    api.post.mockResolvedValue({ data: { id: 10 } });
    const navigation = await setup();
    await takePhoto();
    await getLocation();
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
    await getLocation();
    await fireEvent.changeText(screen.getByPlaceholderText('Ej. Basura acumulada en la esquina...'), 'Algo');
    await fireEvent.press(screen.getByText('basura'));
    await fireEvent.press(screen.getByText('Enviar Reporte'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'La foto es muy pesada.'));
  });
});
