import axios from 'axios';

const api = axios.create({
  baseURL: 'http://192.168.1.11:8000/api',
});

export const setAuthToken = (token) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const clearAuthToken = () => {
  delete api.defaults.headers.common['Authorization'];
};

export default api;
