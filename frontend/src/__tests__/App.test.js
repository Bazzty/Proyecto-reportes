import { act } from 'react';
import { render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../../App';
import { setAuthToken } from '../services/api';

const mockReset = jest.fn();
let mockUnauthorizedHandler = null;
let mockInitialState;

jest.mock('../services/api', () => ({
  __esModule: true,
  default: {},
  setAuthToken: jest.fn(),
  setUnauthorizedHandler: (h) => { mockUnauthorizedHandler = h; },
}));
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    NavigationContainer: React.forwardRef(function NavigationContainer({ children, initialState }, ref) {
      mockInitialState = initialState;
      React.useImperativeHandle(ref, () => ({ reset: mockReset }));
      return children;
    }),
  };
});
jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ initialRouteName }) => <Text>{`ruta:${initialRouteName}`}</Text>,
      Screen: () => null,
    }),
  };
});
const mockClearSession = jest.fn(async () => {});
jest.mock('../services/session', () => ({ clearSession: (...args) => mockClearSession(...args) }));
jest.mock('../screens/WelcomeScreen', () => () => null);
jest.mock('../screens/LoginScreen', () => () => null);
jest.mock('../screens/RegisterScreen', () => () => null);
jest.mock('../screens/HomeScreen', () => () => null);
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
    mockInitialState = undefined;
    await AsyncStorage.clear();
  });
  afterEach(() => jest.useRealTimers());

  const GUEST_STATE = { index: 0, routes: [{ name: 'Home', params: { guest: true } }] };

  it('sin token guardado abre el mapa como invitado', async () => {
    await renderApp();
    expect(await screen.findByText('ruta:Home')).toBeTruthy();
    expect(mockInitialState).toEqual(GUEST_STATE);
    expect(setAuthToken).not.toHaveBeenCalled();
  });

  it('con token guardado restaura la sesión y arranca en Home', async () => {
    await AsyncStorage.setItem('token', 'tok');
    await renderApp();

    expect(await screen.findByText('ruta:Home')).toBeTruthy();
    expect(mockInitialState).toBeUndefined();
    expect(setAuthToken).toHaveBeenCalledWith('tok');
  });

  it('un 401 vuelve al mapa como invitado', async () => {
    await AsyncStorage.setItem('token', 'tok');
    await renderApp();
    await screen.findByText('ruta:Home');

    await mockUnauthorizedHandler();
    expect(mockClearSession).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalledWith(GUEST_STATE);
  });

  it('si falla la lectura del token abre el mapa como invitado', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage'));
    await renderApp();

    expect(await screen.findByText('ruta:Home')).toBeTruthy();
    expect(mockInitialState).toEqual(GUEST_STATE);
  });
});
