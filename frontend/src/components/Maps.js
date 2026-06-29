// src/components/Maps.js
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
  Contaminacion: '#FF0000',   // Rojo
  Escombros: '#FFA500',       // Naranja
  AguasServidas: '#007BFF',   // Azul
  General: '#8E44AD'          // Morado
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
      
      // Controlador para cancelar la petición en 3 segundos si la API no responde
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      // Tarea 4: Consumir GET /api/reports
      const reportsResponse = await fetch(`${API_URL}/reports`, {
        headers: { 'Authorization': `Bearer ${USER_TOKEN}`, 'Accept': 'application/json' },
        signal: controller.signal
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

      clearTimeout(timeoutId);

    } catch (error) {
      console.log("Error o Timeout cargando API, usando placeholders...", error.message);
      
      // Placeholders distribuidos por categorías dentro del Lago Llanquihue
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
      
      // Seteamos los mismos puntos para la capa de calor analítica
      setHeatmapPoints(placeholders.map(p => ({
        latitude: p.latitude,
        longitude: p.longitude,
        weight: 1
      })));
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
        {/* Tarea 5: Renderizar Capa de Calor si existen datos */}
        {heatmapPoints.length > 0 && (
          <Heatmap 
            points={heatmapPoints} 
            radius={40} 
            opacity={0.6} 
          />
        )}

        {/* Tarea 4 y 6: Renderizado dinámico de los marcadores con acción onPress */}
        {reports.map((report) => (
          <Marker
            key={report.id.toString()}
            coordinate={{
              latitude: parseFloat(report.latitude),
              longitude: parseFloat(report.longitude),
            }}
            title={report.title}
            description={report.description}
            // Asigna dinámicamente el color configurado según su propiedad category
            pinColor={CATEGORY_COLORS[report.category] || '#8E44AD'}
            // Al presionar el pin, viaja a la pantalla de detalle enviando el ID del reporte
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