import React, { useState, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getReports, getHeatmapPoints } from '../services/reportService';
import { LAGO_LLANQUIHUE_REGION, CATEGORY_COLORS, PLACEHOLDER_REPORTS } from '../components/Maps';

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
    backgroundColor: '#fff', 
  },
});