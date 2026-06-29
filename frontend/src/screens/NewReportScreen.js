import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Image, Alert, ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import api from '../services/api';

const CATEGORIES = [
  { id: 1, name: 'Basura' },
  { id: 2, name: 'Escombros' },
  { id: 3, name: 'Aguas' },
  { id: 4, name: 'Otro' },
];

export default function NewReportScreen({ navigation }) {
  const [photo, setPhoto]             = useState(null);
  const [location, setLocation]       = useState(null);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId]   = useState(null);
  const [loading, setLoading]         = useState(false);

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  };

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  };

  const handleGetLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la ubicación.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    setLocation(loc.coords);
  };

  const handleSubmit = async () => {
    if (!photo)            { Alert.alert('Falta foto', 'Debes adjuntar una foto.');         return; }
    if (!location)         { Alert.alert('Falta ubicación', 'Obtén tu ubicación GPS.');     return; }
    if (!description.trim()){ Alert.alert('Falta descripción', 'Escribe una descripción.'); return; }
    if (!categoryId)       { Alert.alert('Falta categoría', 'Selecciona una categoría.');   return; }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('description', description);
      form.append('latitude',    String(location.latitude));
      form.append('longitude',   String(location.longitude));
      form.append('category_id', String(categoryId));
      form.append('photo', {
        uri:  photo.uri,
        type: 'image/jpeg',
        name: 'reporte.jpg',
      });

      await api.post('/reports', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('¡Éxito!', 'Reporte enviado correctamente.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      const message = error.response?.data?.message || 'No se pudo enviar el reporte.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Reportar Incidencia</Text>
      <Text style={styles.subtitle}>Ayúdanos a identificar problemas ambientales</Text>

      {/* Foto */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Evidencia Fotográfica</Text>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.previewImage} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.placeholderText}>Ninguna imagen seleccionada</Text>
          </View>
        )}
        <View style={styles.rowButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleTakePhoto}>
            <Text style={styles.actionButtonText}>📷 Tomar Foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handlePickFromGallery}>
            <Text style={styles.actionButtonText}>🖼️ Galería</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* GPS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ubicación GPS</Text>
        <TouchableOpacity style={styles.locationButton} onPress={handleGetLocation}>
          <Text style={styles.locationButtonText}>📍 Obtener mi ubicación actual</Text>
        </TouchableOpacity>
        <Text style={styles.helperText}>
          {location
            ? `Lat: ${location.latitude.toFixed(5)}, Lng: ${location.longitude.toFixed(5)}`
            : 'Coordenadas: Esperando...'}
        </Text>
      </View>

      {/* Categoría */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categoría</Text>
        <View style={styles.categoryContainer}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryButton,
                categoryId === cat.id && styles.categoryButtonSelected,
              ]}
              onPress={() => setCategoryId(cat.id)}
            >
              <Text style={[
                styles.categoryButtonText,
                categoryId === cat.id && styles.categoryButtonTextSelected,
              ]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Descripción */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Descripción</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Ej. Basura acumulada en la esquina..."
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="white" />
          : <Text style={styles.submitButtonText}>Enviar Reporte</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:                  { flexGrow: 1, padding: 24, backgroundColor: '#fff' },
  title:                      { fontSize: 26, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  subtitle:                   { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  section:                    { marginBottom: 24 },
  sectionTitle:               { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 },
  photoPlaceholder:           {
    height: 150, backgroundColor: '#f3f4f6', borderRadius: 8,
    borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  previewImage:               { width: '100%', height: 200, borderRadius: 8, marginBottom: 12 },
  placeholderText:            { color: '#9ca3af' },
  rowButtons:                 { flexDirection: 'row', justifyContent: 'space-between' },
  actionButton:               {
    flex: 1, backgroundColor: '#e5e7eb', padding: 12,
    borderRadius: 8, alignItems: 'center', marginHorizontal: 4,
  },
  actionButtonText:           { color: '#374151', fontWeight: '500' },
  locationButton:             {
    backgroundColor: '#dbeafe', padding: 12, borderRadius: 8,
    alignItems: 'center', marginBottom: 4, borderWidth: 1, borderColor: '#bfdbfe',
  },
  locationButtonText:         { color: '#1d4ed8', fontWeight: '600' },
  helperText:                 { fontSize: 12, color: '#6b7280', fontStyle: 'italic', marginTop: 4 },
  categoryContainer:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryButton:             {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#f9fafb',
  },
  categoryButtonSelected:     { backgroundColor: '#15803d', borderColor: '#15803d' },
  categoryButtonText:         { color: '#374151', fontWeight: '500' },
  categoryButtonTextSelected: { color: 'white' },
  input:                      {
    borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 8, padding: 12, backgroundColor: '#f9fafb',
  },
  textArea:                   { height: 100, textAlignVertical: 'top' },
  submitButton:               {
    backgroundColor: '#15803d', padding: 16,
    borderRadius: 8, alignItems: 'center', marginTop: 8, marginBottom: 32,
  },
  submitButtonDisabled:       { backgroundColor: '#86efac' },
  submitButtonText:           { color: 'white', fontWeight: 'bold', fontSize: 18 },
});