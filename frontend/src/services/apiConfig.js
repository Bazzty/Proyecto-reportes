// URL base de la API.
//
// En desarrollo, EXPO_PUBLIC_API_URL suele llevar la IP local del computador que corre el backend
// (p. ej. http://192.168.1.10:8000/api). Esa IP cambia con cada red (casa, universidad...) y, si
// queda una vieja, todas las peticiones se cuelgan. Como el backend corre en el mismo computador que
// Metro, en desarrollo se reemplaza ese host local por el host desde el que la app cargó el bundle
// (`hostUri` de Expo), conservando protocolo, puerto y ruta.
//
// Una URL pública (ngrok, un servidor desplegado) no se toca, y en producción se usa tal cual.

export const DEFAULT_API_URL = 'http://localhost:8000/api';

// localhost, loopback y rangos de red privada (RFC 1918).
const isLocalHost = (host) => (
  host === 'localhost'
  || /^127\./.test(host)
  || /^10\./.test(host)
  || /^192\.168\./.test(host)
  || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
);

// "192.168.1.147:8081" -> "192.168.1.147". Sin host utilizable devuelve null.
const hostFromHostUri = (hostUri) => {
  if (typeof hostUri !== 'string' || hostUri.trim() === '') return null;
  const host = hostUri.trim().replace(/^[a-z]+:\/\//i, '').split('/')[0].split(':')[0];
  return host || null;
};

export function resolveApiUrl({ envUrl, hostUri, isDev }) {
  const configured = envUrl || DEFAULT_API_URL;
  if (!isDev) return configured;

  const metroHost = hostFromHostUri(hostUri);
  if (!metroHost) return configured;

  // Sin `new URL`: el polyfill de React Native no implementa hostname/port en todas las versiones.
  const match = /^(https?:\/\/)([^/:?#]+)(:\d+)?(.*)$/i.exec(configured);
  if (!match) return configured;
  const [, protocol, host, port = '', rest] = match;
  // Con `expo start --tunnel` Metro es un dominio público (*.exp.direct) que no sirve el backend:
  // solo se reemplaza cuando ambos hosts son de la red local.
  if (!isLocalHost(host) || !isLocalHost(metroHost) || host === metroHost) return configured;

  return `${protocol}${metroHost}${port}${rest}`;
}

// Sin timeout, una IP que no responde deja la petición colgada hasta que el sistema la corta
// (más de un minuto) y la pantalla queda cargando. Las subidas con foto usan UPLOAD_TIMEOUT_MS.
export const REQUEST_TIMEOUT_MS = 15000;
export const UPLOAD_TIMEOUT_MS = 60000;

// Sin respuesta del servidor (IP equivocada, sin red, timeout): distinto de un error de la API.
export const isConnectionError = (error) => !error?.response;

export const CONNECTION_ERROR_MESSAGE = 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
