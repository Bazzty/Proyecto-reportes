import { Alert, Keyboard, Platform } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import RegisterScreen from '../screens/RegisterScreen';
import api, { setAuthToken } from '../services/api';
import { CONNECTION_ERROR_MESSAGE } from '../services/apiConfig';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
  setAuthToken: jest.fn(),
}));

const setup = async () => {
  const navigation = { reset: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
  await render(<RegisterScreen navigation={navigation} />);
  return navigation;
};

const fill = async ({ name = 'Ana', email = 'ana@example.com', password = 'password123', confirm = 'password123' } = {}) => {
  await fireEvent.changeText(screen.getByPlaceholderText('Nombre completo'), name);
  await fireEvent.changeText(screen.getByPlaceholderText('Correo electrónico'), email);
  await fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), password);
  await fireEvent.changeText(screen.getByPlaceholderText('Confirmar contraseña'), confirm);
};

describe('RegisterScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await AsyncStorage.clear();
  });

  it('con campos vacíos muestra alerta y no llama a la API', async () => {
    await setup();
    await fireEvent.press(screen.getByText('Registrarse'));

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Por favor completa todos los campos.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('los botones ojo muestran las contraseñas mientras se mantienen presionados', async () => {
    await setup();

    expect(screen.getByPlaceholderText('Contraseña').props.secureTextEntry).toBe(true);
    expect(screen.getByPlaceholderText('Confirmar contraseña').props.secureTextEntry).toBe(true);

    await fireEvent(screen.getByTestId('toggle-password'), 'pressIn');
    expect(screen.getByPlaceholderText('Contraseña').props.secureTextEntry).toBe(false);

    await fireEvent(screen.getByTestId('toggle-confirm'), 'pressIn');
    expect(screen.getByPlaceholderText('Confirmar contraseña').props.secureTextEntry).toBe(false);

    await fireEvent(screen.getByTestId('toggle-password'), 'pressOut');
    await fireEvent(screen.getByTestId('toggle-confirm'), 'pressOut');
    expect(screen.getByPlaceholderText('Contraseña').props.secureTextEntry).toBe(true);
    expect(screen.getByPlaceholderText('Confirmar contraseña').props.secureTextEntry).toBe(true);
  });

  it('con contraseñas distintas muestra "no coinciden" y no llama a la API', async () => {
    await setup();
    await fill({ confirm: 'otra-clave' });
    await fireEvent.press(screen.getByText('Registrarse'));

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Las contraseñas no coinciden.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('un registro correcto llama a /register, guarda la sesión y va a Home', async () => {
    api.post.mockResolvedValue({ data: { token: 'tok', user: { id: 3, name: 'Ana' } } });
    const navigation = await setup();
    await fill();
    await fireEvent.press(screen.getByText('Registrarse'));

    await waitFor(() =>
      expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Home' }] })
    );
    expect(api.post).toHaveBeenCalledWith('/register', {
      name: 'Ana',
      email: 'ana@example.com',
      password: 'password123',
      password_confirmation: 'password123',
    });
    expect(setAuthToken).toHaveBeenCalledWith('tok');
    // El token va al almacén seguro, no a AsyncStorage (texto plano).
    expect(await SecureStore.getItemAsync('token')).toBe('tok');
    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(await AsyncStorage.getItem('userId')).toBe('3');
  });

  it('un 422 muestra el primer error de validación del backend', async () => {
    api.post.mockRejectedValue({
      response: { data: { errors: { email: ['El email ya está en uso.'], password: ['Otra'] } } },
    });
    const navigation = await setup();
    await fill();
    await fireEvent.press(screen.getByText('Registrarse'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Error de validación', 'El email ya está en uso.')
    );
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('un error sin detalle muestra "No se pudo registrar."', async () => {
    api.post.mockRejectedValue({ response: { status: 500, data: {} } });
    await setup();
    await fill();
    await fireEvent.press(screen.getByText('Registrarse'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudo registrar.'));
  });

  it('sin respuesta del servidor avisa que no hay conexión', async () => {
    api.post.mockRejectedValue(new Error('Network Error'));
    await setup();
    await fill();
    await fireEvent.press(screen.getByText('Registrarse'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', CONNECTION_ERROR_MESSAGE));
  });

  describe('cierre del teclado al tocar fuera', () => {
    const originalOS = Platform.OS;
    afterEach(() => {
      Platform.OS = originalOS;
      jest.restoreAllMocks();
    });

    it('en móvil cierra el teclado', async () => {
      const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
      await setup();
      await fireEvent.press(screen.getByText('Únete a la comunidad'));
      expect(dismiss).toHaveBeenCalled();
    });

    it('en web no le quita el foco a los campos', async () => {
      Platform.OS = 'web';
      const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
      await setup();
      await fireEvent.press(screen.getByText('Únete a la comunidad'));
      expect(dismiss).not.toHaveBeenCalled();
    });
  });
});
