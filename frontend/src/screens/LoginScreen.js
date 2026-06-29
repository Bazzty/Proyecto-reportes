import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken } from '../services/api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/login', { email, password });
      const { token } = response.data;

      // Guardar token y activarlo para peticiones futuras
      await AsyncStorage.setItem('token', token);
      setAuthToken(token);

      // replace evita que al presionar "atrás" en Home se vuelva al Login
      navigation.replace('Home');
    } catch (error) {
      const message = error.response?.data?.message || 'Credenciales incorrectas.';
      Alert.alert('Error al iniciar sesión', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar Sesión</Text>

      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="white" />
          : <Text style={styles.buttonText}>Ingresar</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>¿No tienes cuenta? Regístrate</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title:          { fontSize: 24, fontWeight: 'bold', marginBottom: 24, color: '#111827' },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 12, marginBottom: 12, backgroundColor: '#f9fafb',
  },
  button:         { backgroundColor: '#15803d', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  buttonDisabled: { backgroundColor: '#86efac' },
  buttonText:     { color: 'white', fontWeight: 'bold', fontSize: 16 },
  link:           { color: '#15803d', textAlign: 'center' },
});