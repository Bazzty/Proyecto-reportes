import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Image, Alert, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import api from '../services/api';

export default function NewReportScreen({ navigation }) {
  const [photo, setPhoto]             = useState(null);
  const [location, setLocation]       = useState(null);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId]   = useState(null);
  const [loading, setLoading]         = useState(false);
  const [categories, setCategories]   = useState([]);

  useEffect(() => {
    api.get('/categories')
      .then(res => setCategories(res.data))
      .catch(() => setCategories([
        { id: 1, name: 'basura' },
        { id: 2, name: 'escombros' },
        { id: 3, name: 'aguas' },
        { id: 4, name: 'otro' },
      ]));
  }, []);

  const toJpeg = async (asset) => {
    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
    );
    return { ...asset, uri: manipulated.uri, mimeType: 'image/jpeg' };
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled) setPhoto(await toJpeg(result.assets[0]));
  };

  const handlePickFromGallery = async () => {
    const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso denegado',
        canAskAgain
          ? 'Se necesita acceso a la galería.'
          : 'Ve a Configuración > Lago en línea y activa el acceso a fotos.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    });
    if (!result.canceled) setPhoto(await toJpeg(result.assets[0]));
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
    if (!photo)             { Alert.alert('Falta foto', 'Debes adjuntar una foto.');         return; }
    if (!location)          { Alert.alert('Falta ubicación', 'Obtén tu ubicación GPS.');     return; }
    if (!description.trim()){ Alert.alert('Falta descripción', 'Escribe una descripción.'); return; }
    if (!categoryId)        { Alert.alert('Falta categoría', 'Selecciona una categoría.');   return; }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('description', description);
      form.append('latitude',    String(location.latitude));
      form.append('longitude',   String(location.longitude));
      if (categoryId) form.append('category_id', String(categoryId));
      form.append('photo', {
        uri:  photo.uri,
        type: 'image/jpeg',
        name: 'reporte.jpg',
      });

      const { data: newReport } = await api.post('/reports', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('¡Éxito!', 'Reporte enviado correctamente.', [
        { text: 'OK', onPress: () => navigation.navigate('Home', { newReport }) },
      ]);
    } catch (error) {
      const message = error.response?.data?.message
        || (error.response?.data?.errors
            ? Object.values(error.response.data.errors).flat()[0]
            : null)
        || error.message
        || 'No se pudo enviar el reporte.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
      <LinearGradient colors={['#0e7490', '#0891b2']} style={styles.header}>
        <Text style={styles.title}>Reportar Incidencia</Text>
        <Text style={styles.subtitle}>Ayúdanos a identificar problemas ambientales</Text>
      </LinearGradient>
      <View style={styles.formBody}>

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
            <Ionicons name="camera-outline" size={20} color="#374151" />
            <Text style={styles.actionButtonText}>Tomar Foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handlePickFromGallery}>
            <Ionicons name="image-outline" size={20} color="#374151" />
            <Text style={styles.actionButtonText}>Galería</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* GPS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ubicación GPS</Text>
        <TouchableOpacity style={styles.locationButton} onPress={handleGetLocation}>
          <Ionicons name="location-outline" size={20} color="#0e7490" />
          <Text style={styles.locationButtonText}>Obtener mi ubicación actual</Text>
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
          {categories.map((cat) => (
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flexGrow: 1, backgroundColor: '#fff' },
  header:     { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28 },
  formBody:   { padding: 24 },
  title:      { fontSize: 26, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  subtitle:   { fontSize: 14, color: '#ccfbf1', marginBottom: 0 },
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
    flex: 1, backgroundColor: '#f0fdfa', padding: 12, gap: 6,
    borderRadius: 12, alignItems: 'center', marginHorizontal: 4,
    borderWidth: 1, borderColor: '#99f6e4',
  },
  actionButtonText:           { color: '#374151', fontWeight: '500', fontSize: 13 },
  locationButton:             {
    backgroundColor: '#f0fdfa', padding: 12, borderRadius: 12, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    borderWidth: 1, borderColor: '#99f6e4', gap: 8,
  },
  locationButtonText:         { color: '#0e7490', fontWeight: '600' },
  helperText:                 { fontSize: 12, color: '#6b7280', fontStyle: 'italic', marginTop: 4 },
  categoryContainer:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryButton:             {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#f9fafb',
  },
  categoryButtonSelected:     { backgroundColor: '#0e7490', borderColor: '#0e7490' },
  categoryButtonText:         { color: '#374151', fontWeight: '500' },
  categoryButtonTextSelected: { color: 'white' },
  input:                      {
    borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 8, padding: 12, backgroundColor: '#f9fafb',
  },
  textArea:                   { height: 100, textAlignVertical: 'top' },
  submitButton:               {
    backgroundColor: '#0e7490', padding: 16,
    borderRadius: 8, alignItems: 'center', marginTop: 8, marginBottom: 32,
  },
  submitButtonDisabled:       { backgroundColor: '#9ca3af' },
  submitButtonText:           { color: 'white', fontWeight: 'bold', fontSize: 18 },
});