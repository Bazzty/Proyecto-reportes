import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatHours } from './format';

// Preferencia colapsado/expandido: vive solo en memoria (sobrevive a salir y volver a la
// pantalla, pero no a cerrar la app).
let collapsedPreference = null;
export const resetSummaryPreference = () => { collapsedPreference = null; };

function Metric({ icon, label, value }) {
  return (
    <View style={styles.metric} accessible accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={16} color="#0e7490" />
      <Text style={styles.value} numberOfLines={1}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

// Tarjeta colapsable con cuatro datos. Sin datos (la carga falló) no se muestra.
export default function SummaryCard({ summary }) {
  // Sin preferencia guardada: en teléfonos (ancho < 480) arranca colapsada para dejar espacio a la lista.
  const { width } = useWindowDimensions();
  const [collapsed, setCollapsed] = useState(collapsedPreference ?? width < 480);
  if (!summary) return null;

  const toggle = () => {
    collapsedPreference = !collapsed;
    setCollapsed(collapsedPreference);
  };
  const topZone = summary.top_zone ? `${summary.top_zone.name} (${summary.top_zone.count})` : '—';

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel="Resumen"
        accessibilityState={{ expanded: !collapsed }}
        onPress={toggle}
      >
        <Ionicons name="stats-chart-outline" size={18} color="#0e7490" />
        <Text style={styles.title}>Resumen</Text>
        <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color="#6b7280" />
      </TouchableOpacity>
      {collapsed ? null : (
        <View style={styles.grid}>
          <Metric icon="add-circle-outline" label="Nuevos esta semana" value={String(summary.new_this_week ?? 0)} />
          <Metric icon="time-outline" label="Pendientes de revisión" value={String(summary.pending ?? 0)} />
          <Metric icon="speedometer-outline" label="Validación media" value={formatHours(summary.avg_validation_hours)} />
          <Metric icon="location-outline" label="Zona con más reportes" value={topZone} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card:   { marginTop: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12 },
  title:  { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' },
  grid:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 10 },
  metric: { width: '50%', paddingHorizontal: 4, paddingVertical: 6, gap: 2 },
  value:  { fontSize: 17, fontWeight: 'bold', color: '#0e7490' },
  label:  { fontSize: 11, color: '#6b7280' },
});
