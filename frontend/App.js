import { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import DetalleReporteScreen from './src/screens/DetalleReporteScreen';
import NewReportScreen from './src/screens/NewReportScreen';
import MyReportsScreen from './src/screens/MyReportsScreen';
import { setAuthToken, setUnauthorizedHandler } from './src/services/api';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

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
      const [tokenResult, pickerResult] = await Promise.allSettled([
        AsyncStorage.getItem('token'),
        ImagePicker.getPendingResultAsync(),
      ]);

      const token = tokenResult.status === 'fulfilled' ? tokenResult.value : null;
      if (tokenResult.status === 'rejected') {
        console.warn('No se pudo restaurar la sesión:', tokenResult.reason);
      }

      let pendingPhoto = null;
      if (pickerResult.status === 'rejected') {
        console.error('No se pudo recuperar el resultado de la cámara:', pickerResult.reason);
        Alert.alert('Error', 'No se pudo recuperar la foto tomada.');
      } else if (pickerResult.value && 'code' in pickerResult.value) {
        Alert.alert('Error al recuperar la foto', pickerResult.value.message);
      } else if (pickerResult.value && !pickerResult.value.canceled) {
        pendingPhoto = pickerResult.value.assets?.[0] ?? null;
      }

      if (token) {
        setAuthToken(token);
      }

      setStartup({
        initialRoute: pendingPhoto ? 'NewReport' : token ? 'Home' : 'Login',
        pendingPhoto,
      });
    };

    restoreStartup();
  }, []);

  if (!startup) {
    return <WelcomeScreen />;
  }

  return (
    <SafeAreaProvider>
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName={startup.initialRoute}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Map" component={MapScreen} options={{ headerShown: false }} />
        <Stack.Screen name="DetalleReporte" component={DetalleReporteScreen} options={{ title: 'Detalle del Reporte' }} />
        <Stack.Screen
          name="NewReport"
          component={NewReportScreen}
          initialParams={startup.pendingPhoto ? { pendingPhoto: startup.pendingPhoto } : undefined}
          options={{ title: 'Nuevo Reporte', headerTintColor: '#0e7490' }}
        />
        <Stack.Screen name="MyReports" component={MyReportsScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
    </SafeAreaProvider>
  );
}
