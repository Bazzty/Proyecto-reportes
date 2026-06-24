import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import axios from 'axios';

export default function MapaReportes() {
  const regionInicial = {
    latitude: -41.1200,
    longitude: -72.8000,
    latitudeDelta: 0.35,
    longitudeDelta: 0.35,
  };

return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={regionInicial}>
        <Marker
          coordinate={{ latitude: -41.1200, longitude: -72.7000 }}
          title="Punto de Monitoreo"
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    ...StyleSheet.absoluteFillObject,
  },
});