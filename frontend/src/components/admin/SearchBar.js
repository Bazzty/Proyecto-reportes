import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Campo de búsqueda con ícono y botón para limpiar. El debounce vive en la pantalla.
export default function SearchBar({ value, onChangeText, onClear, onSubmit }) {
  return (
    <View style={styles.box}>
      <Ionicons name="search-outline" size={18} color="#6b7280" />
      <TextInput
        style={styles.input}
        placeholder="Buscar reportes"
        placeholderTextColor="#9ca3af"
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        maxLength={100}
        autoCorrect={false}
        accessibilityLabel="Buscar reportes"
      />
      {value ? (
        <TouchableOpacity
          style={styles.clear}
          accessibilityRole="button"
          accessibilityLabel="Borrar búsqueda"
          onPress={onClear}
        >
          <Ionicons name="close-circle" size={20} color="#9ca3af" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box:   { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 10, paddingLeft: 12, borderRadius: 12, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  input: { flex: 1, minHeight: 44, fontSize: 14, color: '#111827' },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
