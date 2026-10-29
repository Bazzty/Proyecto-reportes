import { useState, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import DetalleReporteScreen from './src/screens/DetalleReporteScreen';
import NewReportScreen from './src/screens/NewReportScreen';
import MyReportsScreen from './src/screens/MyReportsScreen';
import AdminReportsScreen from './src/screens/AdminReportsScreen';
import { setAuthToken, setUnauthorizedHandler } from './src/services/api';

const Stack = createStackNavigator();

export default function App() {
  const [startup, setStartup] = useState(null);
  const navigationRef = useRef(null);

  useEffect(() => {
    // Force navigation to Login when token is expired/invalid (401 response)
    setUnauthorizedHandler(() => {
      navigationRef.current?.reset({ index: 0, routes: [{ name: 'Login' }] });
    });

    const restoreStartup = async () => {
      let token = null;
      let pendingPhoto = null;
      try {
        const pickerRequest =
          Platform.OS === 'android' && typeof ImagePicker?.getPendingResultAsync === 'function'
            ? ImagePicker.getPendingResultAsync()
            : Promise.resolve(null);

        const [tokenResult, pickerResult] = await Promise.allSettled([
          AsyncStorage.getItem('token'),
          pickerRequest,
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ]);

        token = tokenResult.status === 'fulfilled' ? tokenResult.value : null;
        if (tokenResult.status === 'rejected') {
          console.warn('No se pudo restaurar la sesión:', tokenResult.reason);
        }

        if (pickerResult.status === 'rejected') {
          console.error('No se pudo recuperar el resultado de la cámara:', pickerResult.reason);
          Alert.alert('Error', 'No se pudo recuperar la foto tomada.');
        } else if (pickerResult.value && typeof pickerResult.value === 'object' && 'code' in pickerResult.value) {
          Alert.alert('Error al recuperar la foto', pickerResult.value.message);
        } else if (pickerResult.value && !pickerResult.value.canceled) {
          pendingPhoto = pickerResult.value.assets?.[0] ?? null;
        }

        if (token) setAuthToken(token);
        else if (pendingPhoto) Alert.alert('Sesión requerida', 'Inicia sesión para guardar la foto que tomaste.');
      } catch (error) {
        console.warn('Error restaurando el inicio:', error);
      } finally {
        setStartup({
          initialRoute: token ? 'Home' : 'Login',
          pendingPhoto: token ? pendingPhoto : null,
        });
      }
    };

    restoreStartup();
  }, []);

  if (!startup) {
    return <WelcomeScreen />;
  }

  const initialState = startup.pendingPhoto
    ? {
        index: 1,
        routes: [
          { name: 'Home' },
          { name: 'NewReport', params: { pendingPhoto: startup.pendingPhoto } },
        ],
      }
    : undefined;

  return (
    <NavigationContainer ref={navigationRef} initialState={initialState}>
      <Stack.Navigator initialRouteName={startup.initialRoute}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="DetalleReporte" component={DetalleReporteScreen} options={{ title: 'Detalle del Reporte' }} />
        <Stack.Screen name="NewReport" component={NewReportScreen} options={{ title: 'Nuevo Reporte', headerTintColor: '#0e7490' }} />
        <Stack.Screen name="MyReports" component={MyReportsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AdminReports" component={AdminReportsScreen} options={{ title: 'Revisión de Reportes', headerTintColor: '#0e7490' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
