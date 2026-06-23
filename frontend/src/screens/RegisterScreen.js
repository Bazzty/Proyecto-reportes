import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken } from '../services/api';

export default function RegisterScreen({ navigation }) {
  const [name, setName]                         = useState('');
  const [email, setEmail]                       = useState('');
  const [password, setPassword]                 = useState('');
  const [passwordConfirm, setPasswordConfirm]   = useState('');
  const [loading, setLoading]                   = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password || !passwordConfirm) {
      Alert.alert('Error', 'Por favor completa todos los campos.');
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/register', {
        name,
        email,
        password,
        password_confirmation: passwordConfirm,
      });
      const { token } = response.data;

      await AsyncStorage.setItem('token', token);
      setAuthToken(token);

      // reset: evita que quede [Login, Home]
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (error) {
      // Laravel devuelve errores de validación en error.response.data.errors
      const errors = error.response?.data?.errors;
      if (errors) {
        const primerError = Object.values(errors)[0][0];
        Alert.alert('Error de validación', primerError);
      } else {
        Alert.alert('Error', error.response?.data?.message || 'No se pudo registrar.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Crear Cuenta</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre completo"
        value={name}
        onChangeText={setName}
      />
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
      <TextInput
        style={styles.input}
        placeholder="Confirmar contraseña"
        value={passwordConfirm}
        onChangeText={setPasswordConfirm}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="white" />
          : <Text style={styles.buttonText}>Registrarse</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>¿Ya tienes cuenta? Inicia sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flexGrow: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title:          { fontSize: 24, fontWeight: 'bold', marginBottom: 24, color: '#111827' },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 12, marginBottom: 12, backgroundColor: '#f9fafb',
  },
  button:         { backgroundColor: '#15803d', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 12, marginTop: 8 },
  buttonDisabled: { backgroundColor: '#86efac' },
  buttonText:     { color: 'white', fontWeight: 'bold', fontSize: 16 },
  link:           { color: '#15803d', textAlign: 'center', fontWeight: '500', marginTop: 12 },
});