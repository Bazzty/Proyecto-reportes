import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DetalleReporteScreen from '../screens/DetalleReporteScreen';
import api from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const REPORT = {
  id: 5,
  description: 'Basura acumulada',
  status: 'Pendiente',
  photo_url: null,
  created_at: '2026-10-01T12:00:00.000Z',
  latitude: -33.4372,
  longitude: -70.6506,
  category: { id: 1, name: 'basura' },
  user: { id: 2, name: 'Carla' },
  confirmations_count: 1,
  confirmed_by_me: false,
};
const COMMENTS = [{ id: 1, body: 'Lo vi ayer también', user: { id: 3, name: 'Diego' }, created_at: '2026-10-02T12:00:00.000Z' }];

const mockGet = ({ report = REPORT, comments = COMMENTS } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/reports/5') return report ? Promise.resolve({ data: report }) : Promise.reject(new Error('fail'));
    if (url === '/reports/5/comments') return Promise.resolve({ data: comments });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
};

const setup = async ({ session = true, userId = '9', navigation } = {}) => {
  await AsyncStorage.clear();
  if (session) await AsyncStorage.multiSet([['token', 'tok'], ['userId', userId]]);
  await render(<DetalleReporteScreen route={{ params: { reportId: 5 } }} navigation={navigation} />);
};

describe('DetalleReporteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockGet();
  });

  it('carga y muestra el reporte con sus comentarios', async () => {
    await setup();

    expect(await screen.findByText('Basura acumulada')).toBeTruthy();
    expect(screen.getByText('Basura')).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(screen.getByText('Carla')).toBeTruthy();
    expect(screen.getByText('Lo vi ayer también')).toBeTruthy();
    expect(screen.getByText('Comentarios (1)')).toBeTruthy();
  });

  it('muestra la ubicación del reporte', async () => {
    await setup();
    expect(await screen.findByText('Lat -33.43720, Lng -70.65060')).toBeTruthy();
  });

  it('el botón del mapa navega a Home enfocando el reporte', async () => {
    const navigation = { popTo: jest.fn() };
    await setup({ navigation });

    await fireEvent.press(await screen.findByText('Ver en el mapa'));

    expect(navigation.popTo).toHaveBeenCalledWith('Home', {
      focusReport: { id: 5, latitude: -33.4372, longitude: -70.6506 },
    }, { merge: true });
  });

  it.each([
    ['sin coordenadas', { latitude: null, longitude: null }],
    ['cadena vacía', { latitude: -33.4, longitude: '' }],
    ['texto no numérico', { latitude: 'abc' }],
    ['fuera de rango', { latitude: 999, longitude: -70.6 }],
    ['hexadecimal', { latitude: '0x10' }],
  ])('no muestra la ubicación si las coordenadas no son válidas (%s)', async (_caso, coords) => {
    mockGet({ report: { ...REPORT, ...coords } });
    await setup();
    await screen.findByText('Basura acumulada');
    expect(screen.queryByText(/Lat /)).toBeNull();
  });

  it('muestra la ubicación en 0, 0 y con coordenadas como texto', async () => {
    mockGet({ report: { ...REPORT, latitude: 0, longitude: '0.5' } });
    await setup();
    expect(await screen.findByText('Lat 0.00000, Lng 0.50000')).toBeTruthy();
  });

  it('si solo fallan los comentarios (404) con el reporte cargado, avisa', async () => {
    api.get.mockImplementation((url) =>
      url === '/reports/5'
        ? Promise.resolve({ data: REPORT })
        : Promise.reject({ response: { status: 404 } })
    );
    await setup();

    await screen.findByText('Basura acumulada');
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudieron cargar los comentarios.')
    );
  });

  it('si fallan ambas peticiones (500) muestra una sola alerta', async () => {
    api.get.mockImplementation(() => Promise.reject({ response: { status: 500 } }));
    await setup();

    expect(await screen.findByText('No se pudo cargar el reporte.')).toBeTruthy();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudo cargar el detalle del reporte.');
  });

  it('al cambiar de reporte descarta el estado del anterior', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/reports/5') return Promise.resolve({ data: REPORT });
      if (url === '/reports/6') return Promise.reject({ response: { status: 404 } });
      return Promise.resolve({ data: [] });
    });
    await AsyncStorage.clear();
    const view = await render(<DetalleReporteScreen route={{ params: { reportId: 5 } }} />);
    await screen.findByText('Basura acumulada');

    await view.rerender(<DetalleReporteScreen route={{ params: { reportId: 6 } }} />);

    expect(await screen.findByText('Reporte no encontrado.')).toBeTruthy();
    expect(screen.queryByText('Basura acumulada')).toBeNull();
  });

  it('ignora la respuesta tardía del reporte anterior al cambiar de reporte', async () => {
    let resolveOld;
    const OTHER = { ...REPORT, id: 6, description: 'Escombros en la vereda' };
    api.get.mockImplementation((url) => {
      if (url === '/reports/5') return new Promise((resolve) => { resolveOld = resolve; });
      if (url === '/reports/5/comments') return Promise.resolve({ data: COMMENTS });
      if (url === '/reports/6') return Promise.resolve({ data: OTHER });
      return Promise.resolve({ data: [] });
    });
    await AsyncStorage.clear();
    const view = await render(<DetalleReporteScreen route={{ params: { reportId: 5 } }} />);
    await view.rerender(<DetalleReporteScreen route={{ params: { reportId: 6 } }} />);
    expect(await screen.findByText('Escombros en la vereda')).toBeTruthy();

    await act(async () => { resolveOld({ data: REPORT }); });

    expect(screen.queryByText('Basura acumulada')).toBeNull();
    expect(screen.getByText('Escombros en la vereda')).toBeTruthy();
    expect(screen.queryByText('Lo vi ayer también')).toBeNull();
  });

  it('sin reportId no hace peticiones y muestra "Reporte no encontrado"', async () => {
    api.get.mockClear();
    await render(<DetalleReporteScreen route={{ params: {} }} />);
    expect(await screen.findByText('Reporte no encontrado.')).toBeTruthy();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('si el reporte no existe (404) muestra "Reporte no encontrado" sin alerta', async () => {
    api.get.mockImplementation(() => Promise.reject({ response: { status: 404 } }));
    await setup();

    expect(await screen.findByText('Reporte no encontrado.')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('si falla la carga muestra el error', async () => {
    mockGet({ report: null });
    await setup();

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudo cargar el detalle del reporte.')
    );
    expect(await screen.findByText('No se pudo cargar el reporte.')).toBeTruthy();
  });

  it('sin comentarios muestra el mensaje para ser el primero', async () => {
    mockGet({ comments: [] });
    await setup();
    expect(await screen.findByText('Sé el primero en comentar.')).toBeTruthy();
  });

  it('si la API devuelve comentarios null muestra error en vez de fallar', async () => {
    mockGet({ comments: null });
    await setup();

    expect(await screen.findByText('No se pudieron cargar los comentarios.')).toBeTruthy();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudieron cargar los comentarios.');
  });

  it('un invitado no puede confirmar: pide iniciar sesión y no llama a la API', async () => {
    await setup({ session: false });
    await fireEvent.press(await screen.findByText('Yo también lo vi'));

    expect(Alert.alert).toHaveBeenCalledWith('Inicia sesión', 'Necesitas una cuenta para confirmar reportes.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('un invitado no puede comentar y el campo no es editable', async () => {
    await setup({ session: false });
    const input = await screen.findByPlaceholderText('Inicia sesión para comentar');
    expect(input.props.editable).toBe(false);
  });

  it('un usuario con sesión puede confirmar y se actualiza el contador', async () => {
    api.post.mockResolvedValue({ data: { confirmed: true, count: 2 } });
    await setup();
    await fireEvent.press(await screen.findByText('Yo también lo vi'));

    await waitFor(() => expect(screen.getByText('Lo confirmaste')).toBeTruthy());
    expect(api.post).toHaveBeenCalledWith('/reports/5/confirm');
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('si ya confirmé el reporte el botón aparece marcado con el contador', async () => {
    mockGet({ report: { ...REPORT, confirmations_count: 4, confirmed_by_me: true } });
    await setup();

    expect(await screen.findByText('Lo confirmaste')).toBeTruthy();
    expect(screen.getByText('icon:checkmark-circle')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.queryByText('Yo también lo vi')).toBeNull();
  });

  it('un usuario puede deshacer su confirmación y baja el contador', async () => {
    mockGet({ report: { ...REPORT, confirmations_count: 2, confirmed_by_me: true } });
    api.post.mockResolvedValue({ data: { confirmed: false, count: 1 } });
    await setup();
    await fireEvent.press(await screen.findByText('Lo confirmaste'));

    expect(await screen.findByText('Yo también lo vi')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/reports/5/confirm');
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('sin confirmaciones el botón no muestra contador', async () => {
    mockGet({ report: { ...REPORT, confirmations_count: 0 } });
    await setup();

    expect(await screen.findByText('Yo también lo vi')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('mientras se envía la confirmación ignora toques repetidos', async () => {
    let resolvePost;
    api.post.mockImplementation(() => new Promise((resolve) => { resolvePost = resolve; }));
    await setup();
    const button = await screen.findByText('Yo también lo vi');

    // Sin await: la petición queda pendiente a propósito y press esperaría al handler.
    const firstPress = fireEvent.press(button);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByText('Yo también lo vi'));
    expect(api.post).toHaveBeenCalledTimes(1);

    resolvePost({ data: { confirmed: true, count: 2 } });
    await firstPress;
    expect(await screen.findByText('Lo confirmaste')).toBeTruthy();
  });

  it('el dueño del reporte no ve el botón de confirmar sino el resumen', async () => {
    await setup({ userId: '2' });
    await screen.findByText('Basura acumulada');

    expect(screen.queryByText('Lo confirmaste')).toBeNull();
    expect(screen.getByText('1 persona confirmó este reporte')).toBeTruthy();
  });

  it('el resumen del dueño usa plural con más de una confirmación', async () => {
    mockGet({ report: { ...REPORT, confirmations_count: 3 } });
    await setup({ userId: '2' });

    expect(await screen.findByText('3 personas confirmaron este reporte')).toBeTruthy();
  });

  it('si falla la confirmación avisa al usuario', async () => {
    api.post.mockRejectedValue(new Error('fail'));
    await setup();
    await fireEvent.press(await screen.findByText('Yo también lo vi'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudo registrar tu confirmación.')
    );
  });

  it('si fallan los comentarios avisa al usuario', async () => {
    api.get.mockImplementation((url) =>
      url === '/reports/5' ? Promise.resolve({ data: REPORT }) : Promise.reject(new Error('fail'))
    );
    await setup();

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudieron cargar los comentarios.')
    );
  });

  it('un comentario vacío no se envía', async () => {
    await setup();
    await screen.findByText('Basura acumulada');
    await fireEvent.changeText(screen.getByPlaceholderText('Escribe un comentario...'), '   ');
    await fireEvent.press(screen.getByText('icon:send'));

    expect(api.post).not.toHaveBeenCalled();
  });

  it('un comentario válido se envía y se agrega al inicio de la lista', async () => {
    api.post.mockResolvedValue({
      data: { id: 2, body: 'Sigue igual', user: { id: 9, name: 'Yo' }, created_at: '2026-10-03T12:00:00.000Z' },
    });
    await setup();
    await screen.findByText('Basura acumulada');
    const input = screen.getByPlaceholderText('Escribe un comentario...');
    await fireEvent.changeText(input, '  Sigue igual  ');
    await fireEvent.press(screen.getByText('icon:send'));

    expect(await screen.findByText('Sigue igual')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/reports/5/comments', { body: 'Sigue igual' });
    expect(screen.getByText('Comentarios (2)')).toBeTruthy();
    expect(input.props.value).toBe('');
  });

  it('si falla el envío del comentario muestra el error', async () => {
    api.post.mockRejectedValue(new Error('fail'));
    await setup();
    await screen.findByText('Basura acumulada');
    await fireEvent.changeText(screen.getByPlaceholderText('Escribe un comentario...'), 'Hola');
    await fireEvent.press(screen.getByText('icon:send'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudo enviar el comentario.'));
  });
});
