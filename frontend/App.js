import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Comenté WelcomeScreen porque no lo agregaste al Stack abajo. 
// import WelcomeScreen from './src/screens/WelcomeScreen';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import NewReportScreen from './src/screens/NewReportScreen';
import MyReportsScreen from './src/screens/MyReportsScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Iniciar Sesión' }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Registro' }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Inicio' }} />
        <Stack.Screen name="Map" component={MapScreen} options={{ title: 'Mapa' }} />
        <Stack.Screen name="NewReport" component={NewReportScreen} options={{ title: 'Nuevo Reporte' }} />
        <Stack.Screen name="MyReports" component={MyReportsScreen} options={{ title: 'Mis Reportes' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}