import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';

const getStatusStyle = (status) => {
  const s = (status ?? '').toLowerCase();
  switch (s) {
    case 'resuelto':    return { bg: '#dcfce7', text: '#166534', accent: '#16a34a' };
    case 'en progreso': return { bg: '#dbeafe', text: '#1e40af', accent: '#2563eb' };
    case 'pendiente':
    default:            return { bg: '#fef9c3', text: '#854d0e', accent: '#ca8a04' };
  }
};

const formatDate = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export default function MyReportsScreen({ navigation }) {
  const [reports, setReports]   = useState([]);
  const [loading, setLoading]   = useState(true);

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
      <View style={[styles.card, { borderLeftColor: statusColors.accent }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
          <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.badgeText, { color: statusColors.text }]}>
              {(item.status ?? '').toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 20, paddingTop: 56 },
  backButton:        { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 4 },
  backText:          { color: '#0e7490', fontSize: 16, fontWeight: '500' },
  title:             { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  listContent:       { paddingBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    borderLeftWidth: 4, borderLeftColor: '#0e7490',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  cardHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  date:              { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  badge:             { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText:         { fontSize: 10, fontWeight: 'bold' },
  description:       { fontSize: 15, color: '#374151', marginBottom: 16, lineHeight: 22 },
  detailsButton:     { alignSelf: 'flex-start' },
  detailsButtonText: { color: '#0e7490', fontWeight: '600', fontSize: 14 },
  counter:           { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  counterText:       { fontSize: 13, color: '#0e7490', fontWeight: '500' },
  emptyState:        { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyStateText:    { color: '#6b7280', fontSize: 16 },
  emptyStateLink:    { color: '#0e7490', fontWeight: 'bold', fontSize: 16 },
});
