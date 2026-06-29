import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

// Funciones movidas FUERA del componente — no dependen de estado
const getStatusStyle = (status) => {
  switch (status) {
    case 'Resuelto':    return { bg: '#dcfce7', text: '#166534' };
    case 'En Progreso': return { bg: '#dbeafe', text: '#1e40af' };
    case 'Pendiente':
    default:            return { bg: '#fef9c3', text: '#854d0e' };
  }
};

const formatDate = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

// Mock con los valores de status exactos del backend
const mockReports = [
  {
    id: '1',
    description: 'Basura acumulada en la esquina del paradero.',
    status: 'Pendiente',
    created_at: '2026-06-08T10:00:00Z',
  },
  {
    id: '2',
    description: 'Aguas contaminadas en el canal.',
    status: 'En Progreso',
    created_at: '2026-06-05T08:30:00Z',
  },
  {
    id: '3',
    description: 'Escombros bloqueando la vereda principal.',
    status: 'Resuelto',
    created_at: '2026-05-28T14:15:00Z',
  },
];

export default function MyReportsScreen({ navigation }) {

  const renderReportCard = ({ item }) => {
    const statusColors = getStatusStyle(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
          <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.badgeText, { color: statusColors.text }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
        <TouchableOpacity style={styles.detailsButton}>
          <Text style={styles.detailsButtonText}>Ver detalles</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis Reportes</Text>
      <Text style={styles.subtitle}>Historial de tus contribuciones ciudadanas</Text>
      <FlatList
        data={mockReports}
        keyExtractor={(item) => item.id}
        renderItem={renderReportCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Aún no has reportado incidencias.</Text>
            <TouchableOpacity onPress={() => navigation.navigate('NewReport')}>
              <Text style={styles.emptyStateLink}>¡Crea tu primer reporte!</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 20, paddingTop: 40 },
  title:             { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  subtitle:          { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  listContent:       { paddingBottom: 40 },
  card:              {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#e5e7eb', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2,
  },
  cardHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  date:              { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  badge:             { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText:         { fontSize: 10, fontWeight: 'bold' },
  description:       { fontSize: 15, color: '#374151', marginBottom: 16, lineHeight: 22 },
  detailsButton:     { alignSelf: 'flex-start' },
  detailsButtonText: { color: '#15803d', fontWeight: '600', fontSize: 14 },
  emptyState:        { alignItems: 'center', marginTop: 40 },
  emptyStateText:    { color: '#6b7280', fontSize: 16, marginBottom: 8 },
  emptyStateLink:    { color: '#15803d', fontWeight: 'bold', fontSize: 16 },
});