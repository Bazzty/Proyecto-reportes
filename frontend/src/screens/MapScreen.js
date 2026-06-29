import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Maps from '../components/Maps'; 

export default function MapScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Ahora Git/React ya sabe qué es "Maps" */}
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