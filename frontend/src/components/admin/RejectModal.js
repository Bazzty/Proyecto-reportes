import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import useKeyboardHeight from '../../hooks/useKeyboardHeight';
import { MAX_REASON } from './format';
import shared from './sharedStyles';

const REJECT_REASONS = [
  'No corresponde a contaminación',
  'Foto poco clara',
  'Reporte duplicado',
  'Ubicación incorrecta',
];

// Modal del motivo de rechazo. Sirve para un reporte (con su descripción como subtítulo) y para
// un lote (con el número de reportes en el título).
export default function RejectModal({
  visible, title = 'Motivo del rechazo', subtitle, reason, touched, saving,
  onChangeReason, onClose, onConfirm,
}) {
  const keyboardHeight = useKeyboardHeight();
  const reasonEmpty = !reason.trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.backdrop, { paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.panel}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}

          <View style={styles.quickReasons}>
            {REJECT_REASONS.map(text => (
              <TouchableOpacity
                key={text}
                style={[shared.chip, reason === text && shared.chipActive]}
                disabled={saving}
                accessibilityRole="button"
                accessibilityState={{ selected: reason === text, disabled: saving }}
                onPress={() => onChangeReason(text)}
              >
                <Text style={[shared.chipText, reason === text && shared.chipTextActive]}>{text}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.input, touched && reasonEmpty && styles.inputError]}
            placeholder="Ej. No corresponde a contaminación"
            placeholderTextColor="#9ca3af"
            value={reason}
            onChangeText={onChangeReason}
            editable={!saving}
            multiline
            maxLength={MAX_REASON}
          />
          <View style={styles.inputFooter}>
            <Text style={styles.errorText}>{touched && reasonEmpty ? 'Escribe el motivo del rechazo.' : ''}</Text>
            <Text style={styles.counter}>{reason.length}/{MAX_REASON}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.cancel, saving && shared.dimmed]}
              disabled={saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirm, (reasonEmpty || saving) && shared.dimmed]}
              onPress={onConfirm}
              disabled={reasonEmpty || saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: reasonEmpty || saving }}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Rechazar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  panel:    { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  title:    { fontSize: 17, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2, marginBottom: 12 },
  quickReasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12,
    minHeight: 80, textAlignVertical: 'top', color: '#111827', backgroundColor: '#f9fafb',
  },
  inputError:  { borderColor: '#b91c1c' },
  inputFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  errorText:   { flex: 1, fontSize: 12, color: '#b91c1c' },
  counter:     { fontSize: 12, color: '#6b7280' },
  actions:     { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancel:      { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db' },
  cancelText:  { color: '#374151', fontWeight: '600' },
  confirm:     { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#b91c1c', minWidth: 96, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: '600' },
});
