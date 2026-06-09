import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function NewReportScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Reportar Incidencia</Text>
      <Text style={styles.subtitle}>Ayúdanos a identificar problemas ambientales</Text>

      {/* Sección de Fotografía [cite: 86, 119] */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Evidencia Fotográfica</Text>
        <View style={styles.photoPlaceholder}>
          <Text style={styles.placeholderText}>Ninguna imagen seleccionada</Text>
        </View>
        <View style={styles.rowButtons}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>📷 Tomar Foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>🖼️ Galería</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sección de Ubicación [cite: 86, 119] */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ubicación GPS</Text>
        <TouchableOpacity style={styles.locationButton}>
          <Text style={styles.locationButtonText}>📍 Obtener mi ubicación actual</Text>
        </TouchableOpacity>
        <Text style={styles.helperText}>Coordenadas: Esperando...</Text>
      </View>

      {/* Sección de Descripción [cite: 119, 296] */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Descripción</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          placeholder="Ej. Basura acumulada en la esquina..." 
          multiline={true}
          numberOfLines={4}
        />
      </View>

      {/* Botón de Envío [cite: 86, 233] */}
      <TouchableOpacity style={styles.submitButton}>
        <Text style={styles.submitButtonText}>Enviar Reporte</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 },
  photoPlaceholder: {
    height: 150, backgroundColor: '#f3f4f6', borderRadius: 8,
    borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  placeholderText: { color: '#9ca3af' },
  rowButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  actionButton: {
    flex: 1, backgroundColor: '#e5e7eb', padding: 12,
    borderRadius: 8, alignItems: 'center', marginHorizontal: 4,
  },
  actionButtonText: { color: '#374151', fontWeight: '500' },
  locationButton: {
    backgroundColor: '#dbeafe', padding: 12,
    borderRadius: 8, alignItems: 'center', marginBottom: 4,
    borderWidth: 1, borderColor: '#bfdbfe'
  },
  locationButtonText: { color: '#1d4ed8', fontWeight: '600' },
  helperText: { fontSize: 12, color: '#6b7280', fontStyle: 'italic', marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 8, padding: 12, backgroundColor: '#f9fafb'
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  submitButton: {
    backgroundColor: '#15803d', padding: 16,
    borderRadius: 8, alignItems: 'center', marginTop: 8, marginBottom: 32
  },
  submitButtonText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
});