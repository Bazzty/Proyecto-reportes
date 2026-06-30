import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api',
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
      await AsyncStorage.removeItem('token');
      clearAuthToken();
      _onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default api;
