import { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import DetalleReporteScreen from './src/screens/DetalleReporteScreen';
import NewReportScreen from './src/screens/NewReportScreen';
import MyReportsScreen from './src/screens/MyReportsScreen';
import { setAuthToken } from './src/services/api';

const Stack = createStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const [token] = await Promise.all([
          AsyncStorage.getItem('token'),
          new Promise(resolve => setTimeout(resolve, 2500)),
        ]);
        if (token) {
          setAuthToken(token);
          setInitialRoute('Home');
        }
      } catch (error) {
        console.warn('No se pudo restaurar la sesión:', error);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  if (isLoading) {
    return <WelcomeScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Map" component={MapScreen} options={{ headerShown: false }} />
        <Stack.Screen name="DetalleReporte" component={DetalleReporteScreen} options={{ title: 'Detalle del Reporte' }} />
        <Stack.Screen name="NewReport" component={NewReportScreen} options={{ title: 'Nuevo Reporte', headerTintColor: '#0e7490' }} />
        <Stack.Screen name="MyReports" component={MyReportsScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
