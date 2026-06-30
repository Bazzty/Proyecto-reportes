import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Keyboard, TouchableWithoutFeedback,
  StyleSheet, ActivityIndicator, Alert, Image, Dimensions, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken } from '../services/api';

const { height } = Dimensions.get('window');

export default function RegisterScreen({ navigation }) {
  const [name, setName]                       = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading]                 = useState(false);

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
      const { token, user } = response.data;

      await AsyncStorage.multiSet([['token', token], ['userName', user.name], ['userId', String(user.id)]]);
      setAuthToken(token);

      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (error) {
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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={styles.wrapper}>
      <View style={styles.imageWrapper}>
        <Image source={require('../../assets/lake.png')} style={styles.image} />
        <LinearGradient colors={['transparent', '#0e7490']} style={styles.fade} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Crear Cuenta</Text>
        <Text style={styles.subtitle}>Únete a la comunidad</Text>

        <TextInput
          style={styles.input}
          placeholder="Nombre completo"
          placeholderTextColor="#99f6e4"
          value={name}
          onChangeText={setName}
        />
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
        <TextInput
          style={styles.input}
          placeholder="Confirmar contraseña"
          placeholderTextColor="#99f6e4"
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
            ? <ActivityIndicator color="#0e7490" />
            : <Text style={styles.buttonText}>Registrarse</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>¿Ya tienes cuenta? Inicia sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  wrapper:      { flex: 1, backgroundColor: '#0e7490' },
  imageWrapper: { height: height * 0.28, marginHorizontal: 0 },
  image:        { width: '100%', height: '100%', resizeMode: 'cover' },
  fade:         { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  container:    { paddingHorizontal: 24, paddingBottom: 40 },
  title:        { fontSize: 28, fontWeight: 'bold', marginBottom: 4, color: '#ffffff' },
  subtitle:     { fontSize: 15, color: '#ccfbf1', marginBottom: 24 },
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
