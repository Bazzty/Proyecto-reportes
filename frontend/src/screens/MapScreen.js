import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // Tarea 2: Solución correcta al notch sin deprecación
import MapView, { Marker, Heatmap } from 'react-native-maps';

// Importamos el servicio de la API y las constantes geográficasfijas
import { getReports, getHeatmapPoints } from '../services/reportService';
import { LAGO_LLANQUIHUE_REGION, CATEGORY_COLORS, PLACEHOLDER_REPORTS } from '../constants/Maps';

export default function MapScreen({ navigation }) {
  const [reports, setReports] = useState(PLACEHOLDER_REPORTS);
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSelected, setFilterSelected] = useState('All');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Tarea 4 y 5: Consumo paralelo
        const [reportsData, heatmapData] = await Promise.all([
          getReports(),
          getHeatmapPoints()
        ]);
        
        if (reportsData && reportsData.length > 0) setReports(reportsData);
        
        const formattedHeatmap = heatmapData.map(p => ({
          latitude: parseFloat(p.latitude),
          longitude: parseFloat(p.longitude),
          weight: 1 
        }));
        setHeatmapPoints(formattedHeatmap);

      } catch (error) {
        console.log("Usando datos locales de prueba en Lago Llanquihue (Backend desconectado).");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredReports = reports.filter(report => {
    if (filterSelected === 'All') return true;
    return report.category?.name === filterSelected;
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <MapView style={styles.map} initialRegion={LAGO_LLANQUIHUE_REGION}>
        
        {/* Tarea 5: Capa de calor dinámica */}
        {heatmapPoints.length > 0 && (
          <Heatmap points={heatmapPoints} radius={40} opacity={0.6} />
        )}

        {/* Tarea 4: Marcadores en el mapa */}
        {filteredReports.map((report) => (
          <Marker
            key={report.id}
            coordinate={{
              latitude: parseFloat(report.latitude),
              longitude: parseFloat(report.longitude),
            }}
            title={report.category?.name?.toUpperCase() || 'REPORTE'}
            description={report.description}
            pinColor={CATEGORY_COLORS[report.category?.name] || '#7F8C8D'} 
            // Tarea 6: Al presionar la etiqueta flotante, navega enviando el ID correcto
            onCalloutPress={() => navigation.navigate('Detail', { reportId: report.id })}
          />
        ))}
      </MapView>

      {/* Barra superior de Filtros */}
      <View style={styles.filterContainer}>
        {['All', 'basura', 'escombros', 'aguas', 'otro'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterButton,
              filterSelected === type && styles.activeButton,
              filterSelected === type && type !== 'All' && { backgroundColor: CATEGORY_COLORS[type] }
            ]}
            onPress={() => setFilterSelected(type)}
          >
            <Text style={[styles.filterText, filterSelected === type && styles.activeText]}>
              {type === 'All' ? 'Todos' : type.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { ...StyleSheet.absoluteFillObject },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterContainer: {
    position: 'absolute', top: 50, left: 10, right: 10,
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.95)', paddingVertical: 10, borderRadius: 25,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3.84,
  },
  filterButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 15 },
  activeButton: { backgroundColor: '#007AFF' },
  filterText: { fontSize: 11, fontWeight: '600', color: '#333' },
  activeText: { color: '#FFF' },
});