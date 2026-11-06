import { Alert, Platform } from 'react-native';

// Confirmación de dos botones. Alert.alert no hace nada en react-native-web, así que en web
// (donde se prueba la app en el navegador) se usa el diálogo nativo del navegador.
export default function confirmAction({ title, message, confirmText, destructive = false, onConfirm }) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
