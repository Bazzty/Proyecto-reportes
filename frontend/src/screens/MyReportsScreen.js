import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';

const getStatusStyle = (status) => {
  const s = (status ?? '').toLowerCase();
  switch (s) {
    case 'resuelto':     return { bg: '#dcfce7', text: '#166534', accent: '#16a34a' };
    case 'en progreso':  return { bg: '#dbeafe', text: '#1e40af', accent: '#2563eb' };
    case 'pendiente':
    default:             return { bg: '#fef9c3', text: '#854d0e', accent: '#ca8a04' };
  }
};

const formatDate = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const formatCoords = (lat, lng) =>
  `${Math.abs(lat).toFixed(4)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lng).toFixed(4)}°${lng < 0 ? 'O' : 'E'}`;

export default function MyReportsScreen({ navigation }) {
  const [reports, setReports]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api.get('/user/reports')
        .then(res => setReports(res.data))
        .catch(() => setReports([]))
        .finally(() => setLoading(false));
    }, [])
  );

  const renderReportCard = ({ item }) => {
    const statusColors = getStatusStyle(item.status);
    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: statusColors.accent }]}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('DetalleReporte', { reportId: item.id })}
      >
        {item.photo_url ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => setLightboxUrl(item.photo_url)}>
            <Image
              source={item.photo_url}
              style={styles.photo}
              contentFit="cover"
              cachePolicy="disk"
              transition={150}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="image-outline" size={32} color="#d1d5db" />
          </View>
        )}

        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={styles.categoryRow}>
              <View style={[styles.categoryDot, { backgroundColor: statusColors.accent }]} />
              <Text style={styles.categoryText}>
                {item.category?.name
                  ? item.category.name.charAt(0).toUpperCase() + item.category.name.slice(1)
                  : 'Sin categoría'}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.badgeText, { color: statusColors.text }]}>
                {(item.status ?? '').toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.description} numberOfLines={3}>
            {item.description}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={13} color="#9ca3af" />
              <Text style={styles.metaText}>{formatCoords(item.latitude, item.longitude)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={13} color="#9ca3af" />
              <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={24} color="#0e7490" />
        <Text style={styles.backText}>Volver</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Mis Reportes</Text>
      {!loading && (
        <View style={styles.counter}>
          <Ionicons name="document-text-outline" size={14} color="#0e7490" />
          <Text style={styles.counterText}>
            {reports.length === 0
              ? 'Sin reportes aún'
              : `${reports.length} reporte${reports.length !== 1 ? 's' : ''} encontrado${reports.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#0e7490" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderReportCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={48} color="#99f6e4" />
              <Text style={styles.emptyStateText}>Aún no has reportado incidencias.</Text>
              <TouchableOpacity onPress={() => navigation.navigate('NewReport')}>
                <Text style={styles.emptyStateLink}>¡Crea tu primer reporte!</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
      <StatusBar hidden={!!lightboxUrl} />
      <Modal
        visible={!!lightboxUrl}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setLightboxUrl(null)}
      >
        <View style={styles.lightboxBackdrop}>
          <Image
            source={lightboxUrl}
            style={styles.lightboxImage}
            contentFit="contain"
            cachePolicy="disk"
          />
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxUrl(null)}>
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 20, paddingTop: 56 },
  backButton:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 4 },
  backText:    { color: '#0e7490', fontSize: 16, fontWeight: '500' },
  title:       { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  counter:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  counterText: { fontSize: 13, color: '#0e7490', fontWeight: '500' },
  listContent: { paddingBottom: 40 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  photo: {
    width: '100%',
    height: 160,
  },
  photoPlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardBody:      { padding: 14 },
  cardHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryDot:   { width: 8, height: 8, borderRadius: 4 },
  categoryText:  { fontSize: 13, fontWeight: '600', color: '#374151' },
  badge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText:     { fontSize: 10, fontWeight: 'bold' },
  description:   { fontSize: 14, color: '#374151', lineHeight: 21, marginBottom: 12 },

  metaRow:   { flexDirection: 'row', gap: 16 },
  metaItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:  { fontSize: 11, color: '#9ca3af' },

  emptyState:     { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyStateText: { color: '#6b7280', fontSize: 16 },
  emptyStateLink: { color: '#0e7490', fontWeight: 'bold', fontSize: 16 },

  lightboxBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  lightboxImage:    { width: '100%', height: '100%' },
  lightboxClose: {
    position: 'absolute', top: 52, right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20, padding: 6,
  },
});
