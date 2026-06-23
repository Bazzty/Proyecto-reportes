import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAuthToken } from '../services/api';

export default function HomeScreen({ navigation }) {
  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('token');
          clearAuthToken();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inicio</Text>
      <Text style={styles.subtitle}>¿Qué deseas hacer hoy?</Text>

      {/* Navega al mapa de calor y reportes */}
      <TouchableOpacity 
        style={styles.button} 
        onPress={() => navigation.navigate('Map')}
      >
        <Text style={styles.buttonText}>Ver Mapa de Reportes</Text>
      </TouchableOpacity>

      {/* Navega al formulario para subir foto y GPS */}
      <TouchableOpacity 
        style={[styles.button, styles.buttonSecondary]} 
        onPress={() => navigation.navigate('NewReport')}
      >
        <Text style={styles.buttonTextSecondary}>+ Crear Nuevo Reporte</Text>
      </TouchableOpacity>

      {/* Navega al listado de reportes del usuario */}
      <TouchableOpacity 
        style={styles.linkButton} 
        onPress={() => navigation.navigate('MyReports')}
      >
        <Text style={styles.link}>Ver mis reportes</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6b7280', marginBottom: 32 },
  button: {
    backgroundColor: '#15803d', padding: 16,
    borderRadius: 8, alignItems: 'center', marginBottom: 16,
  },
  buttonSecondary: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#15803d',
  },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  buttonTextSecondary: { color: '#15803d', fontWeight: 'bold', fontSize: 16 },
  linkButton: { marginTop: 16 },
  link: { color: '#15803d', textAlign: 'center', fontSize: 16, fontWeight: 'bold' },
  logoutButton: { marginTop: 32 },
  logoutText: { color: '#9ca3af', textAlign: 'center', fontSize: 14 },
});