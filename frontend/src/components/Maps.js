import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import MapView, { Marker, Heatmap } from 'react-native-maps';
import axios from 'axios';

const API_URL = 'apiconlainfo'; 

const COLORS = {
  'SOLID RESIDUE': '#E6A100',
  'FLORATION': '#1E5631',
  'POURED RESIDUE': '#D32F2F',
};

export default function MapScreen({ navigation }) {
  const [reports, setReports] = useState([]);
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para el filtro seleccionado ('All', 'SOLID RESIDUE', 'FLORATION', 'POURED RESIDUE')
  const [filterSelected, setFilterSelected] = useState('All');

  useEffect(() => {
    // Consumir marcadores y heatmap en paralelo
    const fetchData = async () => {
      try {
        const [reportsRes, heatmapRes] = await Promise.all([
          axios.get(API_URL),
          axios.get(`${API_URL}/heatmap`)
        ]);
        setReports(reportsRes.data);
        
        const formattedHeatmap = heatmapRes.data.map(p => ({
          latitude: parseFloat(p.latitude),
          longitude: parseFloat(p.longitude),
          weight: p.weight || 1
        }));
        setHeatmapPoints(formattedHeatmap);

      } catch (error) {
        console.error("Error al consumir la API del backend:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filtrar los reportes según el botón seleccionado
  const filteredReports = reports.filter(report => {
    if (filterSelected === 'All') return true;
    return report.type === filterSelected; // Se asume que el backend entrega el campo 'type'
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map} 
        initialRegion={{
          latitude: -41.1200,
          longitude: -72.8000,
          latitudeDelta: 0.35,
          longitudeDelta: 0.35,
        }}
      >
        {heatmapPoints.length > 0 && (
          <Heatmap points={heatmapPoints} radius={40} opacity={0.6} />
        )}

        {filteredReports.map((report) => (
          <Marker
            key={report.id}
            coordinate={{
              latitude: parseFloat(report.latitude),
              longitude: parseFloat(report.longitude),
            }}
            title={report.title}
            description={report.type}
            pinColor={COLORS[report.type] || '#7F8C8D'} 
            onPress={() => navigation.navigate('Detail', { reportId: report.id })}
          />
        ))}
      </MapView>

      <View style={styles.filterContainer}>
        {['All', 'SOLID RESIDUE', 'FLORATION', 'POURED RESIDUE'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterButton,
              filterSelected === type && styles.activeButton,
              filterSelected === type && type !== 'All' && { backgroundColor: COLORS[type] }
            ]}
            onPress={() => setFilterSelected(type)}
          >
            <Text style={[
              styles.filterText,
              filterSelected === type && styles.activeText
            ]}>
              {type === 'All' ? 'Todos' : type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    position: 'absolute',
    top: 20,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 10,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  activeButton: {
    backgroundColor: '#007AFF', // Azul para 'All'
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  activeText: {
    color: '#FFF',
  },
});
