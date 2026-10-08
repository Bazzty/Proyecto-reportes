import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
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

const setup = async ({ session = true, userId = '9' } = {}) => {
  await AsyncStorage.clear();
  if (session) await AsyncStorage.multiSet([['token', 'tok'], ['userId', userId]]);
  await render(<DetalleReporteScreen route={{ params: { reportId: 5 } }} />);
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

  it('el dueño del reporte no ve el botón de confirmar sino el resumen', async () => {
    await setup({ userId: '2' });
    await screen.findByText('Basura acumulada');

    expect(screen.queryByText('Lo confirmaste')).toBeNull();
    expect(screen.getByText('1 persona confirmaron este reporte')).toBeTruthy();
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
