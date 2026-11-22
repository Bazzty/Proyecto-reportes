import axios from 'axios';
import Constants from 'expo-constants';
import { resolveApiUrl, REQUEST_TIMEOUT_MS } from './apiConfig';

export const API_URL = resolveApiUrl({
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
  isDev: typeof __DEV__ !== 'undefined' && __DEV__,
});

const api = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'ngrok-skip-browser-warning': 'true' },
});

export const setAuthToken = (token) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const clearAuthToken = () => {
  delete api.defaults.headers.common['Authorization'];
};

// Callback registered by App.js to force logout when token is expired/invalid
let _onUnauthorized = null;
export const setUnauthorizedHandler = (handler) => { _onUnauthorized = handler; };

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Solo es "sesión vencida" si había token: sin él (invitado), un 401 es por ejemplo una
    // contraseña incorrecta en /login y la pantalla debe mostrar el error sin salir.
    // Además debe ser el mismo token con el que se hizo la petición: un 401 tardío de una sesión
    // anterior no debe cerrar la sesión nueva.
    const current = api.defaults.headers.common['Authorization'];
    const sentWith = error.config?.headers?.Authorization;
    const hadToken = !!current && sentWith === current;
    if (error.response?.status === 401 && hadToken && _onUnauthorized) {
      clearAuthToken();
      // El handler (App.js) borra la sesión completa con clearSession y vuelve al mapa como invitado.
      await _onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default api;
