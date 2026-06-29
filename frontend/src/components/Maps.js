import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import MapView, { Marker, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';

const API_URL = 'http://10.0.2.2:8000/api';

 // Coordenadas unificadas centradas en el Lago Llanquihue
export const LAGO_LLANQUIHUE_REGION = {
  latitude: -41.134,
  longitude: -72.828,
  latitudeDelta: 0.6,
  longitudeDelta: 0.6,
};

// Colores por defecto para tus marcadores o categorías
export const CATEGORY_COLORS = {
  Contaminacion: '#FF0000',
  Escombros: '#FFA500',
  AguasServidas: '#007BFF',
  General: '#8E44AD'
};

export default function Maps({ navigation }) {
  const [reports, setReports] = useState([]);
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Tarea 4: Consumir GET /api/reports (Marcadores reales o placeholder)
      const reportsResponse = await fetch(`${API_URL}/reports`, {
        headers: { 'Authorization': `Bearer ${USER_TOKEN}`, 'Accept': 'application/json' }
      });
      const reportsData = await reportsResponse.json();
      setReports(reportsData);

      // Tarea 5: Consumir GET /api/reports/heatmap (Capa de calor)
      const heatmapResponse = await fetch(`${API_URL}/reports/heatmap`, {
        headers: { 'Authorization': `Bearer ${USER_TOKEN}`, 'Accept': 'application/json' }
      });
      const heatmapData = await heatmapResponse.json();
      // Formatear los puntos al formato de react-native-maps: { latitude, longitude, weight }
      const formattedHeatmap = heatmapData.map(point => ({
        latitude: parseFloat(point.latitude),
        longitude: parseFloat(point.longitude),
        weight: 1
      }));
      setHeatmapPoints(formattedHeatmap);

    } catch (error) {
      console.log("Error cargando API, usando placeholders...", error);
      
      // Placeholders en caso de que la API no esté disponible aún
      setReports([
        { id: 1, latitude: -41.134, longitude: -72.828, title: "Reporte Lago Llanquihue 1", description: "Contaminación visible" },
        { id: 2, latitude: -41.310, longitude: -72.980, title: "Reporte Puerto Varas", description: "Escombros en la playa" }
      ]);
      setHeatmapPoints([
        { latitude: -41.134, longitude: -72.828, weight: 1 },
        { latitude: -41.310, longitude: -72.980, weight: 1 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={LAGO_LLANQUIHUE_REGION} // Aquí usas la constante
      >
        {/* Marcadores y Heatmap */}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject },
  map: { ...StyleSheet.absoluteFillObject },
});