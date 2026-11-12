import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Aviso de la actualización automática: hay reportes nuevos que aún no están en la lista.
export default function NewReportsBanner({ count, onShow }) {
  if (!count) return null;
  const text = `${count} ${count === 1 ? 'reporte nuevo' : 'reportes nuevos'}`;
  return (
    <TouchableOpacity
      style={styles.banner}
      accessibilityRole="button"
      accessibilityLabel={`${text}. Mostrar`}
      onPress={onShow}
    >
      <Ionicons name="refresh-outline" size={18} color="#fff" />
      <Text style={styles.text}>{text} · Mostrar</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, marginBottom: 8, borderRadius: 12, backgroundColor: '#0e7490', paddingHorizontal: 12 },
  text:   { color: '#fff', fontSize: 14, fontWeight: '600' },
});
