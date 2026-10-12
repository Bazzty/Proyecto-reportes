import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Linking,
  StyleSheet, ScrollView, Image, Alert, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import api from '../services/api';
import useAutoLocation from '../hooks/useAutoLocation';
import useNetworkStatus from '../hooks/useNetworkStatus';
import useKeyboardHeight from '../hooks/useKeyboardHeight';
import { enqueue } from '../services/offlineQueue';
import LeafletMap from '../components/LeafletMap';

const LOCATION_ERRORS = {
  permission: 'Permiso de ubicación denegado. Actívalo para continuar.',
  services: 'Activa el GPS de tu dispositivo para continuar.',
  unavailable: 'No se pudo obtener tu ubicación.',
};

export default function NewReportScreen({ navigation }) {
  const [photo, setPhoto]             = useState(null);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId]   = useState(null);
  const [loading, setLoading]         = useState(false);
  const [categories, setCategories]   = useState([]);
  const [manualLocation, setManualLocation] = useState(null);
  const [showPicker, setShowPicker]         = useState(false);
  const pickerRef = useRef(null);
  const scrollRef = useRef(null);

  const keyboardHeight = useKeyboardHeight();
  const { location, locating, error: locationError, permanentlyDenied, refresh: refreshLocation } = useAutoLocation();
  const { isConnected } = useNetworkStatus();

  const effectiveLocation = manualLocation ?? location;

  const selectedCategory = categories.find((cat) => cat.id === categoryId) ?? null;

  const openPicker = () => {
    setShowPicker(true);
    const base = effectiveLocation;
    setTimeout(() => {
      if (base) pickerRef.current?.centerOn(base.latitude, base.longitude, 14);
    }, 400);
  };

  const scrollToFocused = () => {
    if (Platform.OS === 'android') {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    }
  };

  useEffect(() => {
    api.get('/categories')
      .then(res => setCategories(res.data))
      .catch(() => {
        Alert.alert(
          'Error',
          'No se pudieron cargar las categorías. Verifica tu conexión e intenta de nuevo.'
        );
        setCategories([]);
      });
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

  const saveOffline = async () => {
    try {
      await enqueue({
        description,
        latitude: effectiveLocation.latitude,
        longitude: effectiveLocation.longitude,
        categoryId,
        photoUri: photo.uri,
      });
      Alert.alert(
        'Guardado sin conexión',
        'Tu reporte se enviará automáticamente cuando recuperes la conexión.',
        [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
      );
    } catch {
      Alert.alert('Error', 'No se pudo guardar el reporte sin conexión.');
    }
  };

  const handleSubmit = async () => {
    if (!photo)             { Alert.alert('Falta foto', 'Debes adjuntar una foto.');         return; }
    if (!effectiveLocation) { Alert.alert('Falta ubicación', 'Espera a que se detecte tu ubicación o elige un punto en el mapa.'); return; }
    if (!description.trim()){ Alert.alert('Falta descripción', 'Escribe una descripción.'); return; }
    if (!categoryId)        { Alert.alert('Falta categoría', 'Selecciona una categoría.');   return; }

    if (!isConnected) {
      await saveOffline();
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('description', description);
      form.append('latitude',    String(effectiveLocation.latitude));
      form.append('longitude',   String(effectiveLocation.longitude));
      form.append('category_id', String(categoryId));
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
      // Sin respuesta del servidor: probablemente falla de red -> guardar sin conexión.
      if (!error.response) {
        await saveOffline();
        return;
      }
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
    <>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[styles.container, { paddingBottom: Platform.OS === 'android' ? keyboardHeight + 24 : 24 }]}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
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
        <Text style={styles.sectionTitle}>Ubicación</Text>

        {effectiveLocation ? (
          <>
            <TouchableOpacity style={styles.locationButton} onPress={openPicker}>
              <Ionicons name="map-outline" size={20} color="#0e7490" />
              <Text style={styles.locationButtonText}>Elegir ubicación en el mapa</Text>
            </TouchableOpacity>
            <Text style={styles.helperText}>{manualLocation ? 'Ubicación elegida:' : 'Ubicación GPS:'}</Text>
            <Text style={styles.helperText}>
              Lat: {effectiveLocation.latitude.toFixed(5)}, Lng: {effectiveLocation.longitude.toFixed(5)}
            </Text>
            {manualLocation ? (
              <TouchableOpacity style={styles.settingsLink} onPress={() => setManualLocation(null)}>
                <Text style={styles.settingsLinkText}>Usar mi ubicación GPS</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.settingsLink} onPress={refreshLocation} disabled={locating}>
                <Text style={styles.settingsLinkText}>{locating ? 'Actualizando…' : 'Actualizar ubicación GPS'}</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            {locating ? (
              <View style={styles.locationLoading}>
                <ActivityIndicator color="#0e7490" />
                <Text style={styles.helperText}>Obteniendo ubicación…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.helperText}>
                  {LOCATION_ERRORS[locationError] ?? LOCATION_ERRORS.unavailable}
                </Text>
                {permanentlyDenied && (
                  <TouchableOpacity style={styles.settingsLink} onPress={() => Linking.openSettings()}>
                    <Text style={styles.settingsLinkText}>Abrir Ajustes</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            <TouchableOpacity style={styles.locationButton} onPress={refreshLocation} disabled={locating}>
              <Ionicons name="location-outline" size={20} color="#0e7490" />
              <Text style={styles.locationButtonText}>Reintentar GPS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.locationButton} onPress={openPicker}>
              <Ionicons name="map-outline" size={20} color="#0e7490" />
              <Text style={styles.locationButtonText}>Elegir ubicación en el mapa</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Categoría */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categoría</Text>
        <View style={styles.categoryContainer}>
          {categories.map((cat) => {
            const selected = categoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryButton, selected && styles.categoryButtonSelected]}
                onPress={() => setCategoryId(cat.id)}
              >
                <Ionicons
                  name={cat.icon || 'pricetag-outline'}
                  size={16}
                  color={selected ? '#ffffff' : '#0e7490'}
                />
                <Text style={[styles.categoryButtonText, selected && styles.categoryButtonTextSelected]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {selectedCategory?.description ? (
          <View style={styles.categoryHint}>
            <Ionicons name="information-circle-outline" size={16} color="#0e7490" />
            <Text style={styles.categoryHintText}>{selectedCategory.description}</Text>
          </View>
        ) : null}
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
          onFocus={scrollToFocused}
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
    </KeyboardAvoidingView>

    <Modal
      visible={showPicker}
      animationType="slide"
      onRequestClose={() => setShowPicker(false)}
    >
      <View style={styles.pickerContainer}>
        <Text style={styles.pickerTitle}>Toca el mapa para marcar el punto</Text>
        <View style={styles.pickerMap}>
          <LeafletMap
            ref={pickerRef}
            reports={[]}
            heat={[]}
            showMarkers={false}
            showHeat={false}
            pickable
            pickedLocation={manualLocation}
            userLocation={location}
            onPick={(loc) => setManualLocation(loc)}
          />
        </View>
        <View style={styles.pickerActions}>
          <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowPicker(false)}>
            <Text style={styles.pickerCancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pickerConfirm, !manualLocation && styles.pickerConfirmDisabled]}
            onPress={() => setShowPicker(false)}
            disabled={!manualLocation}
          >
            <Text style={styles.pickerConfirmText}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex:       { flex: 1 },
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
  locationLoading:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  settingsLink:               { alignSelf: 'flex-start', marginTop: 6 },
  settingsLinkText:           { color: '#0e7490', fontWeight: '600', fontSize: 13, textDecorationLine: 'underline' },
  helperText:                 { fontSize: 12, color: '#6b7280', fontStyle: 'italic', marginTop: 4 },
  categoryContainer:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryButton:             {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#f9fafb',
  },
  categoryButtonSelected:     { backgroundColor: '#0e7490', borderColor: '#0e7490' },
  categoryButtonText:         { color: '#374151', fontWeight: '500' },
  categoryButtonTextSelected: { color: 'white' },
  categoryHint:               {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10,
    backgroundColor: '#f0fdfa', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#99f6e4',
  },
  categoryHintText:           { flex: 1, fontSize: 12, color: '#0f766e', lineHeight: 17 },
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

  pickerContainer:       { flex: 1, backgroundColor: '#fff' },
  pickerTitle:           { fontSize: 16, fontWeight: '600', color: '#0e7490', textAlign: 'center', paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16 },
  pickerMap:             { flex: 1 },
  pickerActions:         { flexDirection: 'row', gap: 12, padding: 16 },
  pickerCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1,
    borderColor: '#d1d5db', alignItems: 'center',
  },
  pickerCancelText:      { color: '#374151', fontWeight: '600' },
  pickerConfirm:         { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#0e7490', alignItems: 'center' },
  pickerConfirmDisabled: { backgroundColor: '#9ca3af' },
  pickerConfirmText:     { color: '#fff', fontWeight: '600' },
});