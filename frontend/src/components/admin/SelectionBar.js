import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MAX_BULK } from './format';
import shared from './sharedStyles';

// Barra fija inferior del modo selección (validar o rechazar varios reportes a la vez).
export default function SelectionBar({ count, atLimit, busy, onSelectVisible, onValidate, onReject, onCancel }) {
  const none = count === 0;
  return (
    <View style={styles.bar}>
      <View style={styles.top}>
        <Text style={styles.count} accessibilityLiveRegion="polite">
          {count} {count === 1 ? 'seleccionado' : 'seleccionados'}
        </Text>
        <TouchableOpacity
          style={[styles.link, busy && shared.dimmed]}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          onPress={onSelectVisible}
        >
          <Text style={styles.linkText}>Seleccionar visibles</Text>
        </TouchableOpacity>
      </View>
      {atLimit ? <Text style={styles.limit}>Máximo {MAX_BULK} reportes por lote.</Text> : null}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.validate, (none || busy) && shared.dimmed]}
          disabled={none || busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: none || busy }}
          onPress={onValidate}
        >
          <Text style={styles.validateText}>Validar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.reject, (none || busy) && shared.dimmed]}
          disabled={none || busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: none || busy }}
          onPress={onReject}
        >
          <Text style={styles.rejectText}>Rechazar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.cancel, busy && shared.dimmed]}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          onPress={onCancel}
        >
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar:    { width: '100%', maxWidth: 760, alignSelf: 'center', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  top:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count:  { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  link:   { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  linkText: { fontSize: 13, fontWeight: '600', color: '#0e7490' },
  limit:  { fontSize: 12, color: '#b45309' },
  actions: { flexDirection: 'row', gap: 8 },
  btn:    { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
  validate:     { backgroundColor: '#15803d', borderColor: '#15803d' },
  validateText: { color: '#fff', fontWeight: '600' },
  reject:       { backgroundColor: '#fff', borderColor: '#b91c1c' },
  rejectText:   { color: '#b91c1c', fontWeight: '600' },
  cancel:       { backgroundColor: '#fff', borderColor: '#d1d5db' },
  cancelText:   { color: '#374151', fontWeight: '600' },
});
