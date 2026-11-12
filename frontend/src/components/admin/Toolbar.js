import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import shared from './sharedStyles';

// Barra de herramientas: filtros, limpiar, modo selección y exportación.
export default function Toolbar({
  filtersOpen, activeFilterCount, onToggleFilters, onClear,
  selectionMode, onToggleSelection, exporting, onExport,
}) {
  // En pantallas angostas "Seleccionar" y "Exportar" van solo con ícono, para que la barra quepa en una fila.
  const compact = useWindowDimensions().width < 400;

  return (
    <View style={styles.bar}>
      <TouchableOpacity
        style={[styles.button, (filtersOpen || activeFilterCount > 0) && styles.buttonActive]}
        accessibilityRole="button"
        accessibilityState={{ expanded: filtersOpen }}
        onPress={onToggleFilters}
      >
        <Ionicons name="options-outline" size={18} color="#0e7490" />
        <Text style={styles.buttonText}>Filtros</Text>
        {activeFilterCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeFilterCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      {activeFilterCount > 0 ? (
        <TouchableOpacity style={styles.clearLink} accessibilityRole="button" onPress={onClear}>
          <Text style={styles.clearLinkText}>Limpiar</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.right}>
        <TouchableOpacity
          style={[styles.button, selectionMode && styles.buttonActive]}
          accessibilityRole="button"
          accessibilityLabel="Seleccionar"
          accessibilityState={{ selected: selectionMode }}
          onPress={onToggleSelection}
        >
          <Ionicons name="checkbox-outline" size={18} color="#0e7490" />
          {compact ? null : <Text style={styles.buttonText}>Seleccionar</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, exporting && shared.dimmed]}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityLabel={exporting ? 'Exportando' : 'Exportar'}
          accessibilityState={{ disabled: exporting, busy: exporting }}
          onPress={onExport}
        >
          {exporting
            ? <ActivityIndicator size="small" color="#0e7490" />
            : <Ionicons name="download-outline" size={18} color="#0e7490" />}
          {compact ? null : <Text style={styles.buttonText}>Exportar</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar:          { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 8 },
  right:        { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  button:       { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  buttonActive: { borderColor: '#0e7490', backgroundColor: '#ecfeff' },
  buttonText:   { fontSize: 13, fontWeight: '600', color: '#0e7490' },
  badge:        { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#0e7490', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText:    { fontSize: 11, fontWeight: 'bold', color: '#fff' },
  clearLink:    { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  clearLinkText: { fontSize: 13, fontWeight: '600', color: '#0e7490' },
});
