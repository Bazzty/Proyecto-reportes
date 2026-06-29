import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import api from '../services/api';

export default function MapScreen() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);

  useEffect(() => {
    api.get('/reports')
      .then(res => {
        setReports(res.data);
        if (res.data.length > 0) {
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(
              res.data.map(r => ({ latitude: r.latitude, longitude: r.longitude })),
              { edgePadding: { top: 120, right: 40, bottom: 60, left: 40 }, animated: true }
            );
          }, 500);
        }
      })
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: -41.31946,
          longitude: -72.98356,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {reports.map(report => (
          <Marker
            key={report.id}
            coordinate={{ latitude: report.latitude, longitude: report.longitude }}
          >
            <Callout tooltip>
              <View style={styles.callout}>
                {report.photo_url && (
                  <Image source={{ uri: report.photo_url }} style={styles.calloutImage} />
                )}
                <View style={styles.calloutBody}>
                  <Text style={styles.calloutCategory}>
                    {report.category?.name ?? 'Sin categoría'}
                  </Text>
                  <Text style={styles.calloutDescription} numberOfLines={2}>
                    {report.description}
                  </Text>
                  <Text style={styles.calloutUser}>📍 {report.user?.name}</Text>
                </View>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <View style={styles.header}>
        <Text style={styles.title}>Mapa de Incidencias</Text>
        <Text style={styles.subtitle}>
          {loading
            ? 'Cargando reportes...'
            : `${reports.length} reporte${reports.length !== 1 ? 's' : ''} activo${reports.length !== 1 ? 's' : ''}`}
        </Text>
      </View>

      {loading && (
        <ActivityIndicator style={styles.loader} size="large" color="#0e7490" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute',
    top: 56, left: 16, right: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  title:    { fontSize: 18, fontWeight: 'bold', color: '#0e7490' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  loader:   { position: 'absolute', top: '50%', alignSelf: 'center' },
  callout: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: 220,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  calloutImage: {
    width: '100%',
    height: 130,
    resizeMode: 'cover',
  },
  calloutBody: {
    padding: 10,
    gap: 4,
  },
  calloutCategory:    { fontSize: 13, fontWeight: 'bold', color: '#0e7490' },
  calloutDescription: { fontSize: 12, color: '#374151', lineHeight: 17 },
  calloutUser:        { fontSize: 11, color: '#9ca3af', marginTop: 2 },
});
