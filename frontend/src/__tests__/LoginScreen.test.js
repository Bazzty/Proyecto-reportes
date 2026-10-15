import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from '../screens/LoginScreen';
import api, { setAuthToken } from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
  setAuthToken: jest.fn(),
}));

const setup = async () => {
  const navigation = { replace: jest.fn(), navigate: jest.fn() };
  await render(<LoginScreen navigation={navigation} />);
  return navigation;
};

const fill = async (email, password) => {
  await fireEvent.changeText(screen.getByPlaceholderText('Correo electrónico'), email);
  await fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), password);
};

describe('LoginScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await AsyncStorage.clear();
  });

  it('con campos vacíos muestra alerta y no llama a la API', async () => {
    await setup();
    await fireEvent.press(screen.getByText('Ingresar'));

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Por favor completa todos los campos.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('con credenciales válidas guarda la sesión y navega a Home', async () => {
    api.post.mockResolvedValue({ data: { token: 'tok', user: { id: 7, name: 'Ana' } } });
    const navigation = await setup();
    await fill('ana@example.com', 'password123');
    await fireEvent.press(screen.getByText('Ingresar'));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Home'));
    expect(api.post).toHaveBeenCalledWith('/login', { email: 'ana@example.com', password: 'password123' });
    expect(setAuthToken).toHaveBeenCalledWith('tok');
    expect(await AsyncStorage.getItem('token')).toBe('tok');
    expect(await AsyncStorage.getItem('userName')).toBe('Ana');
    expect(await AsyncStorage.getItem('userId')).toBe('7');
  });

  it('si la API responde con mensaje lo muestra', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'Clave inválida' } } });
    const navigation = await setup();
    await fill('ana@example.com', 'mala');
    await fireEvent.press(screen.getByText('Ingresar'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error al iniciar sesión', 'Clave inválida'));
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('si la API falla sin mensaje usa "Credenciales incorrectas."', async () => {
    api.post.mockRejectedValue(new Error('network'));
    await setup();
    await fill('ana@example.com', 'mala');
    await fireEvent.press(screen.getByText('Ingresar'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Error al iniciar sesión', 'Credenciales incorrectas.')
    );
  });

  it('"Regístrate" navega a Register', async () => {
    const navigation = await setup();
    await fireEvent.press(screen.getByText('¿No tienes cuenta? Regístrate'));
    expect(navigation.navigate).toHaveBeenCalledWith('Register');
  });

  it('"Continuar sin cuenta" navega a Home como invitado', async () => {
    const navigation = await setup();
    await fireEvent.press(screen.getByText('Continuar sin cuenta →'));
    expect(navigation.navigate).toHaveBeenCalledWith('Home', { guest: true });
  });
});
