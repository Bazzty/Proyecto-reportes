import { View, Text, StyleSheet, Dimensions } from 'react-native';
// Asegúrate de tener instalada la librería: npm install react-native-maps
import MapView, { Marker } from 'react-native-maps';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mapa de Incidencias</Text>
      <Text style={styles.description}>Zonas críticas y reportes ciudadanos</Text>

      <View style={styles.mapContainer}>
        {/* Componente del mapa de react-native-maps */}
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: -41.31946, 
            longitude: -72.98356,
            latitudeDelta: 0.01, // Un valor menor acerca más la cámara a la plaza
            longitudeDelta: 0.01,
          }}
        >
          {/* Marcador de prueba. Luego se generarán dinámicamente con un .map() */}
          <Marker
            coordinate={{ latitude: -33.4569, longitude: -70.6483 }}
            title="Basura acumulada"
            description="Reporte en estado: pendiente"
          />
        </MapView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginTop: 40, marginBottom: 4 },
  description: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});