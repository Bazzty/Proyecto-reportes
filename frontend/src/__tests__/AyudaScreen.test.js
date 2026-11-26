import { Alert, Linking } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AyudaScreen from '../screens/AyudaScreen';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.1.0' } },
}));

describe('AyudaScreen', () => {
  let openURL;
  let alertSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('muestra el correo de soporte y la versión', async () => {
    await render(<AyudaScreen />);
    expect(screen.getByText('soporte.lagoenlinea@gmail.com')).toBeTruthy();
    expect(screen.getByText('Versión 1.1.0')).toBeTruthy();
  });

  it('abre el correo con mailto y la versión codificada', async () => {
    await render(<AyudaScreen />);
    await fireEvent.press(screen.getByTestId('support-email-button'));

    expect(openURL).toHaveBeenCalledTimes(1);
    const url = openURL.mock.calls[0][0];
    expect(url.startsWith('mailto:soporte.lagoenlinea@gmail.com')).toBe(true);
    expect(url).toContain(encodeURIComponent('Versión de la app: 1.1.0'));
    expect(url).toContain(`subject=${encodeURIComponent('Ayuda · Lago en Línea')}`);
  });

  it('avisa con una alerta si no se puede abrir el correo', async () => {
    openURL.mockRejectedValue(new Error('sin app de correo'));
    await render(<AyudaScreen />);
    await fireEvent.press(screen.getByTestId('support-email-button'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'No se pudo abrir el correo',
      'Escríbenos a soporte.lagoenlinea@gmail.com',
    ));
  });
});
