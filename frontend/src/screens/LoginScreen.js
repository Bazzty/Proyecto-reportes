import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Keyboard, TouchableWithoutFeedback,
  StyleSheet, ActivityIndicator, Alert, Image,
  KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken } from '../services/api';
import useKeyboardHeight from '../hooks/useKeyboardHeight';

export default function LoginScreen({ navigation }) {
  const { height } = useWindowDimensions();
  const initialHeight = useRef(height).current;
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]   = useState(false);

  const keyboardHeight = useKeyboardHeight();
  const scrollRef = useRef(null);
  const scrollToFocused = () => {
    if (Platform.OS === 'android') {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/login', { email, password });
      const { token, user } = response.data;

      await AsyncStorage.multiSet([
        ['token', token],
        ['userName', user.name],
        ['userId', String(user.id)],
        ['isAdmin', user.is_admin ? '1' : '0'],
      ]);
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
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView
      ref={scrollRef}
      style={styles.scrollView}
      contentContainerStyle={[styles.container, { paddingBottom: Platform.OS === 'android' ? keyboardHeight + 40 : 40 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={[styles.imageWrapper, { height: Math.min(initialHeight * 0.42, 340) }]}>
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
        onFocus={scrollToFocused}
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

      <TouchableOpacity style={{ marginTop: 12 }} onPress={() => navigation.navigate('Home', { guest: true })}>
        <Text style={styles.guestLink}>Continuar sin cuenta →</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  wrapper:      { flex: 1, backgroundColor: '#0e7490' },
  scrollView:   { backgroundColor: '#0e7490' },
  container:    { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, backgroundColor: '#0e7490' },
  imageWrapper: { marginHorizontal: -24 },
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
  passwordRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  passwordInput: { flex: 1, marginBottom: 0 },
  eyeButton:     { paddingHorizontal: 12, paddingVertical: 14 },
  button:         { backgroundColor: '#ffffff', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 16, marginTop: 4 },
  buttonDisabled: { backgroundColor: '#ccfbf1' },
  buttonText:     { color: '#0e7490', fontWeight: 'bold', fontSize: 16 },
  link:           { color: '#ccfbf1', textAlign: 'center', fontSize: 14 },
  guestLink:      { color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: 13 },
});
