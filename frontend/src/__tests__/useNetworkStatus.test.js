import { renderHook, waitFor, act } from '@testing-library/react-native';
import * as Network from 'expo-network';
import useNetworkStatus from '../hooks/useNetworkStatus';

describe('useNetworkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queda conectado cuando el dispositivo tiene internet', async () => {
    Network.getNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true });

    const { result } = await renderHook(() => useNetworkStatus());

    await waitFor(() => expect(result.current.isConnected).toBe(true));
  });

  it('queda offline cuando no hay conexión', async () => {
    Network.getNetworkStateAsync.mockResolvedValue({ isConnected: false, isInternetReachable: false });

    const { result } = await renderHook(() => useNetworkStatus());

    await waitFor(() => expect(result.current.isConnected).toBe(false));
  });

  it('reacciona a los cambios de red', async () => {
    let handler;
    Network.addNetworkStateListener.mockImplementation((callback) => {
      handler = callback;
      return { remove: jest.fn() };
    });
    Network.getNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true });

    const { result } = await renderHook(() => useNetworkStatus());
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    await act(async () => { handler({ isConnected: false, isInternetReachable: false }); });

    await waitFor(() => expect(result.current.isConnected).toBe(false));
  });
});
