import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import MapaReportes from './src/components/Maps';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <MapaReportes /> 
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});