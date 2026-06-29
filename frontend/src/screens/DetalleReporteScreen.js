import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // Tarea 2: Respetar Notch
import { getReportById } from '../services/reportService';

// Exportación por defecto limpia para que React Navigation lo reconozca perfectamente como componente válido
export default function DetalleReporteScreen({ route, navigation }) {
  // Extraemos el parámetro enviado desde el marcador del mapa
  const { reportId } = route.params; 
  
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarDetalle = async () => {
      try {
        const data = await getReportById(reportId); // Tarea 6: GET /api/reports/{id}
        setReporte(data);
      } catch (error) {
        console.log("Error al consultar el detalle en el servidor.");
      } finally {
        setLoading(false);
      }
    };

    cargarDetalle();
  }, [reportId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Fallback por si estás probando con un marcador placeholder local
  if (!reporte) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Reporte #{reportId}</Text>
        <Text style={styles.subError}>Estás visualizando un marcador de prueba local. El servidor backend no tiene este registro en su base de datos real.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.idText}>REPORTE #{reporte.id}</Text>
        <Text style={styles.title}>{reporte.description || 'Sin descripción'}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Estado: {reporte.status || 'Pendiente'}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  card: {
    backgroundColor: '#FFF', padding: 20, borderRadius: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  idText: { fontSize: 12, fontWeight: '700', color: '#95A5A6', marginBottom: 5 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#2C3E50', marginBottom: 15 },
  badge: { backgroundColor: '#E1F5FE', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText: { color: '#0288D1', fontWeight: '600', fontSize: 13 },
  errorText: { fontSize: 18, fontWeight: 'bold', color: '#7F8C8D', marginBottom: 10 },
  subError: { textAlign: 'center', color: '#95A5A6', fontSize: 14, lineHeight: 20 }
});