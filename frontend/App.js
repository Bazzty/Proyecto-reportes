import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context'; // Proveedor global para SafeAreaView

// 1. IMPORTACIONES CORRECTAS (Sin llaves '{ }' porque usamos export default)
import MapScreen from './src/screens/MapScreen';
import DetalleReporteScreen from './src/screens/DetalleReporteScreen';

// Creación del contenedor de navegación Stack
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    // SafeAreaProvider debe envolver toda la aplicación para que SafeAreaView funcione en iOS y Android
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Map"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#007AFF', // Color azul institucional para la barra superior
            },
            headerTintColor: '#fff', // Color del texto y flecha de volver atrás
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          
          {/* PANTALLA 1: El Mapa principal */}
          <Stack.Screen 
            name="Map" 
            component={MapScreen} 
            options={{ title: 'Cuenca Lago Llanquihue' }} 
          />

          {/* PANTALLA 2: Detalle del reporte */}
          {/* CRÍTICO: El 'name' debe ser exactamente 'Detail' (Sensible a mayúsculas) 
              porque es el nombre que gatillamos en el mapa con navigation.navigate('Detail') */}
          <Stack.Screen 
            name="Detail" 
            component={DetalleReporteScreen} 
            options={{ title: 'Detalle de Alerta' }} 
          />

        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}