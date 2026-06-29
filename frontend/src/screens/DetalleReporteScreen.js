import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ActivityIndicator } from 'react-native';

const API_URL = 'http://10.0.2.2:8000/api';

export default function DetalleReporteScreen({ route }) {
  // Obtener el ID enviado desde el marcador en Maps.js
  const { reportId } = route.params;
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReportDetail = async () => {
      try {
        // Tarea 6: Consumir GET /api/reports/{id}
        const response = await fetch(`${API_URL}/reports/${reportId}`, {
          headers: { 'Authorization': `Bearer ${USER_TOKEN}`, 'Accept': 'application/json' }
        });
        const data = await response.json();
        setReport(data);
      } catch (error) {
        console.log("Error al obtener detalle, usando placeholder...", error);
        // Fallback Placeholder
        setReport({
          id: reportId,
          title: `Reporte Desconectado #${reportId}`,
          description: "No se pudo conectar al servidor backend. Verifique su conexión o token.",
          category: "General",
          status: "Pendiente"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReportDetail();
  }, [reportId]);

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />;
  }

  return (
    // Tarea 2: SafeAreaView para evitar colisiones con el Notch de iOS
    <SafeAreaView style={styles.safeArea}>
      {report && (
        <View style={styles.content}>
          <Text style={styles.title}>{report.title}</Text>
          <Text style={styles.category}>Categoría: {report.category?.name || report.category}</Text>
          <Text style={styles.description}>{report.description}</Text>
          <Text style={styles.status}>Estado: {report.status}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  category: { fontSize: 16, color: 'gray', marginBottom: 10 },
  description: { fontSize: 16, marginBottom: 15 },
  status: { fontSize: 16, fontWeight: '600', color: '#007BFF' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});