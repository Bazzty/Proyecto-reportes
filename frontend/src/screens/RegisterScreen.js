import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export default function RegisterScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear Cuenta</Text>

      <TextInput style={styles.input} placeholder="Nombre completo" />
      <TextInput style={styles.input} placeholder="Correo electrónico" keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Contraseña" secureTextEntry />

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Registrarse</Text>
      </TouchableOpacity>

      {/* Navegación de vuelta al Login */}
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>¿Ya tienes cuenta? Inicia sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, color: '#111827' },
  input: {
    borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: '#f9fafb'
  },
  button: {
    backgroundColor: '#15803d', padding: 14,
    borderRadius: 8, alignItems: 'center', marginBottom: 12, marginTop: 8
  },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  link: { color: '#15803d', textAlign: 'center', fontWeight: '500', marginTop: 12 },
});