import { resolveApiUrl, isConnectionError, DEFAULT_API_URL } from '../services/apiConfig';

describe('resolveApiUrl', () => {
  it('en desarrollo reemplaza una IP local vieja por la del servidor Metro', () => {
    expect(resolveApiUrl({
      envUrl: 'http://10.151.27.171:8000/api',
      hostUri: '192.168.1.147:8081',
      isDev: true,
    })).toBe('http://192.168.1.147:8000/api');
  });

  it('en desarrollo reemplaza localhost (simulador/dispositivo usan la IP de Metro)', () => {
    expect(resolveApiUrl({ envUrl: 'http://localhost:8000/api', hostUri: '192.168.1.5:8083', isDev: true }))
      .toBe('http://192.168.1.5:8000/api');
  });

  it('no toca dominios públicos (ngrok, producción)', () => {
    const url = 'https://abc.ngrok-free.app/api';
    expect(resolveApiUrl({ envUrl: url, hostUri: '192.168.1.5:8081', isDev: true })).toBe(url);
  });

  it('fuera de desarrollo usa la URL configurada tal cual', () => {
    const url = 'http://10.0.0.2:8000/api';
    expect(resolveApiUrl({ envUrl: url, hostUri: '192.168.1.5:8081', isDev: false })).toBe(url);
  });

  it('sin hostUri de Metro usa la URL configurada', () => {
    const url = 'http://10.0.0.2:8000/api';
    expect(resolveApiUrl({ envUrl: url, hostUri: undefined, isDev: true })).toBe(url);
    expect(resolveApiUrl({ envUrl: url, hostUri: '', isDev: true })).toBe(url);
  });

  it('sin EXPO_PUBLIC_API_URL usa el valor por defecto', () => {
    expect(resolveApiUrl({ envUrl: undefined, hostUri: undefined, isDev: true })).toBe(DEFAULT_API_URL);
  });

  it('acepta hostUri con esquema y ruta', () => {
    expect(resolveApiUrl({ envUrl: 'http://localhost:8000/api', hostUri: 'exp://192.168.0.9:8081/--/', isDev: true }))
      .toBe('http://192.168.0.9:8000/api');
  });
});

describe('isConnectionError', () => {
  it('es true cuando no hay respuesta del servidor', () => {
    expect(isConnectionError(new Error('Network Error'))).toBe(true);
  });

  it('es false cuando la API respondió con error', () => {
    expect(isConnectionError({ response: { status: 401 } })).toBe(false);
  });
});
