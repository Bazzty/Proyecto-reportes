import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import MapView, { Marker, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';

const API_URL = 'http://10.0.2.2:8000/api';
const USER_TOKEN = 'PLACEHOLDER_TOKEN';

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

      // Creamos un controlador para abortar la petición si tarda mucho
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos máximo

      // Tarea 4: Consumir GET /api/reports
      const reportsResponse = await fetch(`${API_URL}/reports`, {
        headers: { 'Authorization': `Bearer ${USER_TOKEN}`, 'Accept': 'application/json' },
        signal: controller.signal // Le pasamos la señal de control
      });
      const reportsData = await reportsResponse.json();
      setReports(reportsData);

      // Tarea 5: Consumir GET /api/reports/heatmap
      const heatmapResponse = await fetch(`${API_URL}/reports/heatmap`, {
        headers: { 'Authorization': `Bearer ${USER_TOKEN}`, 'Accept': 'application/json' },
        signal: controller.signal
      });
      const heatmapData = await heatmapResponse.json();
      
      const formattedHeatmap = heatmapData.map(point => ({
        latitude: parseFloat(point.latitude),
        longitude: parseFloat(point.longitude),
        weight: 1
      }));
      setHeatmapPoints(formattedHeatmap);

      // Si todo sale bien antes de los 3 segundos, limpiamos el temporizador
      clearTimeout(timeoutId);

    } catch (error) {
      console.log("Error o Timeout cargando API, usando placeholders...", error.message);
      
      // Placeholders distribuidos en el Lago Llanquihue
      const placeholders = [
        { id: 1, latitude: -41.320, longitude: -72.985, title: "Derrame de Combustible", description: "Puerto Varas", category: "Contaminacion" },
        { id: 2, latitude: -41.135, longitude: -73.025, title: "Acumulación de Plásticos", description: "Frutillar Bajo", category: "Escombros" },
        { id: 3, latitude: -41.255, longitude: -73.008, title: "Descarga de Aguas Servidas", description: "Llanquihue", category: "AguasServidas" },
        { id: 4, latitude: -40.975, longitude: -72.885, title: "Microbasural en la Bahía", description: "Puerto Octay", category: "General" }
      ];

      setReports(placeholders);
      setHeatmapPoints(placeholders.map(p => ({ latitude: p.latitude, longitude: p.longitude, weight: 1 })));

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