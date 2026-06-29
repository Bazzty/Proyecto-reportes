import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Keyboard, TouchableWithoutFeedback,
  StyleSheet, ActivityIndicator, Alert, Image, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken } from '../services/api';

const { height } = Dimensions.get('window');

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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={styles.container}>
      <View style={styles.imageWrapper}>
        <Image source={require('../../assets/lake.png')} style={styles.image} />
        <LinearGradient
          colors={['transparent', '#0e7490']}
          style={styles.fade}
        />
      </View>

      <Text style={styles.title}>Iniciar Sesión</Text>
      <Text style={styles.subtitle}>Bienvenido de vuelta</Text>

      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        placeholderTextColor="#99f6e4"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor="#99f6e4"
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
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0e7490', paddingHorizontal: 24, paddingBottom: 40 },
  imageWrapper: { height: height * 0.42, marginHorizontal: -24 },
  image:        { width: '100%', height: '100%', resizeMode: 'cover' },
  fade: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
  },
  title:          { fontSize: 28, fontWeight: 'bold', marginTop: 24, marginBottom: 4, color: '#ffffff' },
  subtitle:       { fontSize: 15, color: '#ccfbf1', marginBottom: 32 },
  input: {
    borderWidth: 1.5, borderColor: '#5eead4', borderRadius: 12,
    padding: 14, marginBottom: 14, backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#ffffff', fontSize: 15,
  },
  button:         { backgroundColor: '#ffffff', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 16, marginTop: 4 },
  buttonDisabled: { backgroundColor: '#ccfbf1' },
  buttonText:     { color: '#0e7490', fontWeight: 'bold', fontSize: 16 },
  link:           { color: '#ccfbf1', textAlign: 'center', fontSize: 14 },
});