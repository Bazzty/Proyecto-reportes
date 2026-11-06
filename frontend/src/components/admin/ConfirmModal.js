import { View, Text, TouchableOpacity, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import shared from './sharedStyles';

// Confirmación propia (Alert.alert no funciona en react-native-web).
export default function ConfirmModal({ visible, title, message, confirmLabel, busy, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.panel} accessibilityViewIsModal>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.cancel, busy && shared.dimmed]}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!busy }}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirm, busy && shared.dimmed]}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!busy }}
              onPress={onConfirm}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  panel:    { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  title:    { fontSize: 17, fontWeight: 'bold', color: '#111827' },
  message:  { fontSize: 14, color: '#4b5563', marginTop: 6 },
  actions:  { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  cancel:   { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db' },
  cancelText:  { color: '#374151', fontWeight: '600' },
  confirm:     { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#15803d', minWidth: 96, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: '600' },
});
