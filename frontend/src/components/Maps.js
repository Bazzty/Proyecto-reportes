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
      const placeholders = [
        { 
          id: 1, 
          latitude: -41.320, 
          longitude: -72.985, 
          title: "Derrame de Combustible", 
          description: "Mancha aceitosa detectada cerca de la costanera de Puerto Varas.",
          category: "Contaminacion"
        },
        { 
          id: 2, 
          latitude: -41.135, 
          longitude: -73.025, 
          title: "Acumulación de Plásticos", 
          description: "Escombros y botellas abandonadas en la playa de Frutillar Bajo.",
          category: "Escombros"
        },
        { 
          id: 3, 
          latitude: -41.255, 
          longitude: -73.008, 
          title: "Descarga de Aguas Servidas", 
          description: "Salida anómala de tubería directo al lago en la comuna de Llanquihue.",
          category: "AguasServidas"
        },
        { 
          id: 4, 
          latitude: -40.975, 
          longitude: -72.885, 
          title: "Microbasural en la Bahía", 
          description: "Reporte preventivo por desechos domésticos en el sector de Puerto Octay.",
          category: "General"
        }
      ];
      setReports(placeholders);

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
        initialRegion={LAGO_LLANQUIHUE_REGION}
      >
        {/* Tarea 5: Renderizar capa de Calor si existen puntos */}
        {heatmapPoints.length > 0 && (
          <Heatmap 
            points={heatmapPoints} 
            radius={45} 
            opacity={0.6} 
          />
        )}

        {/* 2. SOLUCIÓN: Renderizado dinámico de marcadores en el mapa */}
        {reports.map((report) => (
          <Marker
            key={report.id.toString()}
            coordinate={{
              latitude: parseFloat(report.latitude),
              longitude: parseFloat(report.longitude),
            }}
            title={report.title}
            description={report.description}
            // Asigna dinámicamente el color configurado arriba según su categoría
            pinColor={CATEGORY_COLORS[report.category] || '#8E44AD'}
            // Tarea 6: Al presionar, viaja a la pantalla de detalle enviando el ID
            onPress={() => navigation.navigate('DetalleReporte', { reportId: report.id })}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject },
  map: { ...StyleSheet.absoluteFillObject },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});