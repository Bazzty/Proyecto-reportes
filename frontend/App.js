import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MapScreen from './src/screens/MapScreen';
import DetalleReporteScreen from './src/screens/DetalleReporteScreen';
import ReportScreen from './src/services/reportService';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    // SafeAreaProvider asegura la correcta medición del notch en todas las vistas internas
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Map">
          <Stack.Screen 
            name="Map" 
            component={MapScreen} 
            options={{ headerShown: false }} // Ocultamos barra por defecto ya que usamos nuestro SafeAreaView
          />
          <Stack.Screen 
            name="DetalleReporte" 
            component={DetalleReporteScreen} 
            options={{ title: 'Detalle del Reporte' }}
          />
          <Stack.Screen 
            name="Report" 
            component={ReportScreen} 
            options={{ title: 'Crear Reporte' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}