import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Maps from '../components/Maps';

export default function MapScreen({ navigation, route }) {
  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Maps navigation={navigation} focusReport={route?.params?.focusReport} />
      <View style={styles.overlay} pointerEvents="box-none">
        <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color="#0e7490" />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: 48,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  backText: { color: '#0e7490', fontSize: 15, fontWeight: '600' },
});