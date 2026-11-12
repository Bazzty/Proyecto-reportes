import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Aviso propio (Alert.alert no funciona en react-native-web). Puede traer un botón de acción,
// por ejemplo "Deshacer".
export default function Toast({ toast }) {
  if (!toast) return null;
  const { type, message, action } = toast;
  return (
    <View
      style={[styles.toast, type === 'error' ? styles.error : type === 'info' ? styles.info : styles.success]}
      accessibilityLiveRegion="polite"
      // Sin botón el aviso no captura toques; con botón sí.
      pointerEvents={action ? 'auto' : 'none'}
    >
      <Ionicons
        name={type === 'error' ? 'alert-circle-outline' : type === 'info' ? 'information-circle-outline' : 'checkmark-circle-outline'}
        size={20}
        color="#fff"
      />
      <Text style={styles.text}>{message}</Text>
      {action ? (
        <TouchableOpacity
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toast:   { position: 'absolute', left: 0, right: 0, bottom: 20, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, minHeight: 48, borderRadius: 12, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
  success: { backgroundColor: '#15803d' },
  error:   { backgroundColor: '#b91c1c' },
  info:    { backgroundColor: '#0e7490' },
  text:    { flex: 1, color: '#fff', fontSize: 14, fontWeight: '500' },
  action:  { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  actionText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
