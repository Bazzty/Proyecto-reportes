import React from 'react';
import { StyleSheet, Text, View, SafeAreaView } from 'react-native';

export default function ReportScreen() {
  return (
    // Tarea 2: Implementación de SafeAreaView
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.text}>Pantalla de Creación de Reportes Ambientales</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
  }
});