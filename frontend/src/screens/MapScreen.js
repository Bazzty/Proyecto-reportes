import React, { useState, useEffect } from 'react';
import { StyleSheet, SafeAreaView } from 'react-native';
import { getReports, getHeatmapPoints } from '../services/reportService';
import { LAGO_LLANQUIHUE_REGION, CATEGORY_COLORS, PLACEHOLDER_REPORTS } from '../../src/components/Maps';

export default function MapScreen({ navigation }) {
  return (
    // Tarea 2: Envolver el contenido con SafeAreaView
    <SafeAreaView style={styles.safeArea}>
      <Maps navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff', // Evita que se vea transparente abajo del notch
  },
});