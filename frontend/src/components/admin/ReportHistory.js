import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buildHistory } from './format';

// Control "Historial" desplegable: quién creó, validó, rechazó o cambió el estado del reporte.
export default function ReportHistory({ item }) {
  const [open, setOpen] = useState(false);
  const lines = buildHistory(item);
  if (lines.length === 0) return null;

  return (
    <View>
      <TouchableOpacity
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityLabel="Historial"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(o => !o)}
      >
        <Ionicons name="time-outline" size={16} color="#0e7490" />
        <Text style={styles.toggleText}>Historial</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#0e7490" />
      </TouchableOpacity>
      {open ? (
        <View style={styles.lines}>
          {lines.map(line => <Text key={line} style={styles.line}>{line}</Text>)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle:     { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingRight: 8 },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#0e7490' },
  lines:      { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, gap: 4, marginBottom: 6 },
  line:       { fontSize: 12, color: '#4b5563' },
});
