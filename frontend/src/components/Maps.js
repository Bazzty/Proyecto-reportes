import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import MapView, { Marker, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
import api from '../services/api';

export const LAGO_LLANQUIHUE_REGION = {
  latitude: -41.134,
  longitude: -72.828,
  latitudeDelta: 0.6,
  longitudeDelta: 0.6,
};

export const CATEGORY_COLORS = {
  basura: '#FF0000',
  escombros: '#FFA500',
  aguas: '#007BFF',
  otro: '#8E44AD'
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

      const reportsData = await api.get('/reports', { timeout: 3000 }).then(r => r.data);
      setReports(reportsData);

      const heatmapData = await api.get('/reports/heatmap', { timeout: 3000 }).then(r => r.data);
      const formattedHeatmap = heatmapData.map(point => ({
        latitude: parseFloat(point.latitude),
        longitude: parseFloat(point.longitude),
        weight: 1
      }));
      setHeatmapPoints(formattedHeatmap);

    } catch (error) {
      console.log("Error cargando datos del mapa:", error.message);
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
        {Platform.OS === 'android' && heatmapPoints.length > 0 && (
          <Heatmap
            points={heatmapPoints}
            radius={40}
            opacity={0.6}
          />
        )}

        {reports.map((report) => (
          <Marker
            key={report.id.toString()}
            coordinate={{
              latitude: parseFloat(report.latitude),
              longitude: parseFloat(report.longitude),
            }}
            title={report.description}
            description={`Categoría: ${report.category?.name || report.category}`}
            pinColor={CATEGORY_COLORS[report.category?.name || report.category] || '#8E44AD'}
            onPress={() => navigation && navigation.navigate('DetalleReporte', { reportId: report.id })}
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