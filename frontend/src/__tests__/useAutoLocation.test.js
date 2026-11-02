import { renderHook, waitFor, act } from '@testing-library/react-native';
import * as Location from 'expo-location';
import useAutoLocation from '../hooks/useAutoLocation';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 4 },
}));

const grantPermissions = () => {
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
  Location.hasServicesEnabledAsync.mockResolvedValue(true);
  Location.getLastKnownPositionAsync.mockResolvedValue(null);
  Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: -41.1, longitude: -72.8 } });
};

describe('useAutoLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    grantPermissions();
  });

  it('captura la ubicación automáticamente al montar', async () => {
    const { result } = await renderHook(() => useAutoLocation());

    await waitFor(() => expect(result.current.locating).toBe(false));
    expect(result.current.location).toEqual({ latitude: -41.1, longitude: -72.8 });
    expect(result.current.error).toBeNull();
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 4 });
  });

  it('muestra la última conocida y luego la refina con la posición actual', async () => {
    Location.getLastKnownPositionAsync.mockResolvedValue({ coords: { latitude: 1, longitude: 2 } });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 3, longitude: 4 } });

    const { result } = await renderHook(() => useAutoLocation());

    await waitFor(() => expect(result.current.location).toEqual({ latitude: 3, longitude: 4 }));
  });

  it('conserva la última conocida si la posición actual falla', async () => {
    Location.getLastKnownPositionAsync.mockResolvedValue({ coords: { latitude: 1, longitude: 2 } });
    Location.getCurrentPositionAsync.mockRejectedValue(new Error('timeout'));

    const { result } = await renderHook(() => useAutoLocation());

    await waitFor(() => expect(result.current.locating).toBe(false));
    expect(result.current.location).toEqual({ latitude: 1, longitude: 2 });
    expect(result.current.error).toBeNull();
  });

  it('reporta error de permiso denegado', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true });

    const { result } = await renderHook(() => useAutoLocation());

    await waitFor(() => expect(result.current.error).toBe('permission'));
    expect(result.current.permanentlyDenied).toBe(false);
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('marca el permiso como denegado permanentemente', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });

    const { result } = await renderHook(() => useAutoLocation());

    await waitFor(() => expect(result.current.permanentlyDenied).toBe(true));
  });

  it('reporta cuando el GPS está apagado', async () => {
    Location.hasServicesEnabledAsync.mockResolvedValue(false);

    const { result } = await renderHook(() => useAutoLocation());

    await waitFor(() => expect(result.current.error).toBe('services'));
    expect(Location.getLastKnownPositionAsync).not.toHaveBeenCalled();
  });

  it('reporta error si no hay ninguna posición disponible', async () => {
    Location.getCurrentPositionAsync.mockRejectedValue(new Error('nope'));

    const { result } = await renderHook(() => useAutoLocation());

    await waitFor(() => expect(result.current.error).toBe('unavailable'));
  });

  it('refresh vuelve a capturar la ubicación', async () => {
    const { result } = await renderHook(() => useAutoLocation());
    await waitFor(() => expect(result.current.locating).toBe(false));

    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 9, longitude: 9 } });
    await act(async () => { await result.current.refresh(); });

    expect(result.current.location).toEqual({ latitude: 9, longitude: 9 });
  });
});

