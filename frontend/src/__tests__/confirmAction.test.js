import { Alert, Platform } from 'react-native';
import confirmAction from '../utils/confirmAction';

describe('confirmAction', () => {
  const originalOS = Platform.OS;
  const originalConfirm = globalThis.confirm;

  afterEach(() => {
    Platform.OS = originalOS;
    globalThis.confirm = originalConfirm;
    jest.restoreAllMocks();
  });

  const options = (onConfirm) => ({
    title: 'Cerrar sesión', message: '¿Seguro?', confirmText: 'Salir', destructive: true, onConfirm,
  });

  it('en móvil usa Alert.alert con Cancelar y el botón de confirmar', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onConfirm = jest.fn();

    confirmAction(options(onConfirm));

    const [title, message, buttons] = alert.mock.calls[0];
    expect([title, message]).toEqual(['Cerrar sesión', '¿Seguro?']);
    expect(buttons.map((b) => b.text)).toEqual(['Cancelar', 'Salir']);
    expect(buttons[1].style).toBe('destructive');
    buttons[1].onPress();
    expect(onConfirm).toHaveBeenCalled();
  });

  it('en web usa el diálogo del navegador y confirma solo si se acepta', () => {
    Platform.OS = 'web';
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onConfirm = jest.fn();

    globalThis.confirm = jest.fn(() => true);
    confirmAction(options(onConfirm));
    expect(globalThis.confirm).toHaveBeenCalledWith('Cerrar sesión\n\n¿Seguro?');
    expect(onConfirm).toHaveBeenCalledTimes(1);

    globalThis.confirm = jest.fn(() => false);
    confirmAction(options(onConfirm));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });
});
