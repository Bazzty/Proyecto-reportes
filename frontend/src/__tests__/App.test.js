import { act } from 'react';
import { render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../../App';
import { setAuthToken } from '../services/api';

const mockReset = jest.fn();
let mockUnauthorizedHandler = null;

jest.mock('../services/api', () => ({
  __esModule: true,
  default: {},
  setAuthToken: jest.fn(),
  setUnauthorizedHandler: (h) => { mockUnauthorizedHandler = h; },
}));
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    NavigationContainer: React.forwardRef(function NavigationContainer({ children }, ref) {
      React.useImperativeHandle(ref, () => ({ reset: mockReset }));
      return children;
    }),
  };
});
jest.mock('@react-navigation/stack', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    createStackNavigator: () => ({
      Navigator: ({ initialRouteName }) => <Text>{`ruta:${initialRouteName}`}</Text>,
      Screen: () => null,
    }),
  };
});
jest.mock('../screens/WelcomeScreen', () => () => null);
jest.mock('../screens/LoginScreen', () => () => null);
jest.mock('../screens/RegisterScreen', () => () => null);
jest.mock('../screens/HomeScreen', () => () => null);
jest.mock('../screens/MapScreen', () => () => null);
jest.mock('../screens/DetalleReporteScreen', () => () => null);
jest.mock('../screens/NewReportScreen', () => () => null);
jest.mock('../screens/MyReportsScreen', () => () => null);

const renderApp = async () => {
  await render(<App />);
  await act(async () => { jest.advanceTimersByTime(2500); });
};

describe('App', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockUnauthorizedHandler = null;
    await AsyncStorage.clear();
  });
  afterEach(() => jest.useRealTimers());

  it('sin token guardado arranca en Login', async () => {
    await renderApp();
    expect(await screen.findByText('ruta:Login')).toBeTruthy();
    expect(setAuthToken).not.toHaveBeenCalled();
  });

  it('con token guardado restaura la sesión y arranca en Home', async () => {
    await AsyncStorage.setItem('token', 'tok');
    await renderApp();

    expect(await screen.findByText('ruta:Home')).toBeTruthy();
    expect(setAuthToken).toHaveBeenCalledWith('tok');
  });

  it('un 401 reinicia la navegación a Login', async () => {
    await AsyncStorage.setItem('token', 'tok');
    await renderApp();
    await screen.findByText('ruta:Home');

    mockUnauthorizedHandler();
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Login' }] });
  });

  it('si falla la lectura del token igual arranca en Login', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage'));
    await renderApp();

    expect(await screen.findByText('ruta:Login')).toBeTruthy();
  });
});
