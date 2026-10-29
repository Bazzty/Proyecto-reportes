import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Keyboard, TouchableWithoutFeedback,
  StyleSheet, ActivityIndicator, Alert, Image, ScrollView,
  KeyboardAvoidingView, useWindowDimensions, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken } from '../services/api';
import useKeyboardHeight from '../hooks/useKeyboardHeight';

export default function RegisterScreen({ navigation }) {
  const { height } = useWindowDimensions();
  const initialHeight = useRef(height).current;
  const [name, setName]                       = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [loading, setLoading]                 = useState(false);

  const keyboardHeight = useKeyboardHeight();
  const scrollRef = useRef(null);
  const scrollToFocused = () => {
    if (Platform.OS === 'android') {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    }
  };

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

      await AsyncStorage.multiSet([
        ['token', token],
        ['userName', user.name],
        ['userId', String(user.id)],
        ['isAdmin', user.is_admin ? '1' : '0'],
      ]);
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
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, { paddingBottom: Platform.OS === 'android' ? keyboardHeight + 40 : 40 }]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
      <View style={[styles.imageWrapper, { height: Math.min(initialHeight * 0.28, 240) }]}>
        <Image source={require('../../assets/lake.png')} style={styles.image} />
        <LinearGradient colors={['transparent', '#0e7490']} style={styles.fade} />
      </View>

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
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Contraseña"
            placeholderTextColor="#99f6e4"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            onFocus={scrollToFocused}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            testID="toggle-password"
            onPressIn={() => setShowPassword(true)}
            onPressOut={() => setShowPassword(false)}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#99f6e4" />
          </TouchableOpacity>
        </View>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Confirmar contraseña"
            placeholderTextColor="#99f6e4"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            secureTextEntry={!showConfirm}
            onFocus={scrollToFocused}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            testID="toggle-confirm"
            onPressIn={() => setShowConfirm(true)}
            onPressOut={() => setShowConfirm(false)}
          >
            <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#99f6e4" />
          </TouchableOpacity>
        </View>

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
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  flex:         { flex: 1 },
  wrapper:      { flex: 1, backgroundColor: '#0e7490' },
  imageWrapper: { marginHorizontal: 0 },
  image:        { width: '100%', height: '100%', resizeMode: 'cover' },
  fade:         { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  container:    { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  title:        { fontSize: 28, fontWeight: 'bold', marginBottom: 4, color: '#ffffff' },
  subtitle:     { fontSize: 15, color: '#ccfbf1', marginBottom: 24 },
  input: {
    borderWidth: 1.5, borderColor: '#5eead4', borderRadius: 12,
    padding: 14, marginBottom: 14, backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#ffffff', fontSize: 15,
  },
  passwordRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  passwordInput: { flex: 1, marginBottom: 0 },
  eyeButton:     { paddingHorizontal: 12, paddingVertical: 14 },
  button:         { backgroundColor: '#ffffff', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 16, marginTop: 4 },
  buttonDisabled: { backgroundColor: '#ccfbf1' },
  buttonText:     { color: '#0e7490', fontWeight: 'bold', fontSize: 16 },
  link:           { color: '#ccfbf1', textAlign: 'center', fontSize: 14 },
});
