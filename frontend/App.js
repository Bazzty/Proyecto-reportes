import { useState, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import { clearSession } from './src/services/session';
import { getToken } from './src/services/tokenStorage';

const Stack = createNativeStackNavigator();

// En web el stack deja crecer cada pantalla con su contenido y el scroll pasa al documento, que la app
// tiene bloqueado (body con overflow hidden): lo que queda bajo el borde de la ventana no se puede
// alcanzar, las listas largas se dibujan enteras y los avisos fijos quedan al final de la página.
// Acotar la tarjeta a la ventana hace que scrollee cada ScrollView/FlatList, como en móvil.
const WEB_CARD_STYLE = Platform.OS === 'web' ? { flex: 1, overflow: 'hidden' } : undefined;

export default function App() {
  const [startup, setStartup] = useState(null);
  const navigationRef = useRef(null);

  useEffect(() => {
    // Token vencido o inválido (401): vuelve al mapa como invitado
    setUnauthorizedHandler(async () => {
      // Token vencido: se conserva la cola offline (reportes del mismo usuario sin enviar).
      try { await clearSession({ keepQueue: true }); } catch { /* se vuelve al mapa igual */ }
      navigationRef.current?.reset({ index: 0, routes: [{ name: 'Home', params: { guest: true } }] });
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
          getToken(),
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
          hasSession: !!token,
          pendingPhoto: token ? pendingPhoto : null,
        });
      }
    };

    restoreStartup();
  }, []);

  if (!startup) {
    return <WelcomeScreen />;
  }

  // Sin sesión se abre el mapa como invitado; desde ahí se puede iniciar sesión.
  // Se usa initialState y no initialParams: estos últimos también se aplicarían a la
  // ruta Home creada tras el login y dejarían al usuario autenticado como invitado.
  let initialState;
  if (startup.pendingPhoto) {
    initialState = {
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'NewReport', params: { pendingPhoto: startup.pendingPhoto } },
      ],
    };
  } else if (!startup.hasSession) {
    initialState = { index: 0, routes: [{ name: 'Home', params: { guest: true } }] };
  }

  return (
    <NavigationContainer ref={navigationRef} initialState={initialState}>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ contentStyle: WEB_CARD_STYLE }}>
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
