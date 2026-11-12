import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { REPORT_STATUSES } from '../../constants/reports';
import { capitalize } from './format';
import shared from './sharedStyles';

const STATUS_FILTERS = [
  { key: null, label: 'Todos' },
  ...REPORT_STATUSES.map(status => ({ key: status, label: status })),
];

export const SORT_OPTIONS = [
  { key: 'recientes', label: 'Más recientes' },
  { key: 'confirmaciones', label: 'Más confirmados' },
];

function Chip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[shared.chip, selected && shared.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
    >
      <Text style={[shared.chipText, selected && shared.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Panel con los filtros de estado, categoría y zona, y el orden de la lista.
export default function FilterPanel({
  statusFilter, onStatusChange,
  categories, categoryFilter, onCategoryChange,
  zones, zoneFilter, onZoneChange,
  sort, onSortChange,
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.label}>Estado</Text>
      <View style={styles.chips}>
        {STATUS_FILTERS.map(f => (
          <Chip key={String(f.key)} label={f.label} selected={statusFilter === f.key} onPress={() => onStatusChange(f.key)} />
        ))}
      </View>

      {categories.length > 0 ? (
        <>
          <Text style={styles.label}>Categoría</Text>
          <View style={styles.chips}>
            {[{ id: null, name: 'Todas' }, ...categories].map(c => (
              <Chip
                key={String(c.id)}
                label={c.id === null ? c.name : capitalize(c.name)}
                selected={categoryFilter === c.id}
                onPress={() => onCategoryChange(c.id)}
              />
            ))}
          </View>
        </>
      ) : null}

      {zones.length > 0 ? (
        <>
          <Text style={styles.label}>Zona</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneRow} style={styles.zoneScroll}>
            {[{ id: null, name: 'Todas' }, ...zones].map(z => (
              <Chip key={String(z.id)} label={z.name} selected={zoneFilter === z.id} onPress={() => onZoneChange(z.id)} />
            ))}
          </ScrollView>
        </>
      ) : null}

      <Text style={styles.label}>Orden</Text>
      <View style={styles.segmented} accessibilityRole="radiogroup">
        {SORT_OPTIONS.map(option => {
          const selected = sort === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.segment, selected && styles.segmentActive]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onSortChange(option.key)}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel:      { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  label:      { fontSize: 11, color: '#6b7280', fontWeight: '600', marginBottom: 6 },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  zoneScroll: { marginBottom: 10, flexGrow: 0 },
  zoneRow:    { flexDirection: 'row', gap: 8, paddingRight: 8 },
  segmented:  { flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', overflow: 'hidden' },
  segment:    { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  segmentActive:     { backgroundColor: '#0e7490' },
  segmentText:       { fontSize: 12, color: '#374151', fontWeight: '600' },
  segmentTextActive: { color: '#fff' },
});
