import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    if (error.response?.status === 401 && _onUnauthorized) {
      // Se borra toda la sesión (igual que al cerrar sesión): la app vuelve al mapa como invitado
      // y no debe quedar, por ejemplo, isAdmin del usuario anterior.
      await AsyncStorage.multiRemove(['token', 'userName', 'userId', 'isAdmin', 'reportStatusSnapshot']);
      clearAuthToken();
      _onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default api;
