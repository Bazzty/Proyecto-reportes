import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export default function LoginScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar Sesión</Text>
      <TextInput style={styles.input} placeholder="Correo electrónico" />
      <TextInput style={styles.input} placeholder="Contraseña" secureTextEntry />
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Ingresar</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>¿No tienes cuenta? Regístrate</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 8, padding: 12, marginBottom: 12,
  },
  button: {
    backgroundColor: '#15803d', padding: 14,
    borderRadius: 8, alignItems: 'center', marginBottom: 12,
  },
  buttonText: { color: 'white', fontWeight: 'bold' },
  link: { color: '#15803d', textAlign: 'center' },
});