import { StyleSheet } from 'react-native';

// Estilos que comparten varias piezas del panel (chips de filtro y motivos rápidos, botones atenuados).
export default StyleSheet.create({
  chip:           { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipActive:     { backgroundColor: '#0e7490', borderColor: '#0e7490' },
  chipText:       { fontSize: 12, color: '#4b5563', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  dimmed:         { opacity: 0.55 },
});
