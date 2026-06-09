import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

// Datos de prueba simulando la respuesta del backend (GET /api/user/reports)
const mockReports = [
  {
    id: '1',
    description: 'Basura acumulada en la esquina del paradero.',
    status: 'pendiente',
    date: '08 Jun 2026',
  },
  {
    id: '2',
    description: 'Aguas contaminadas en el canal.',
    status: 'en revisión',
    date: '05 Jun 2026',
  },
  {
    id: '3',
    description: 'Escombros bloqueando la vereda principal.',
    status: 'resuelto',
    date: '28 May 2026',
  },
];

export default function MyReportsScreen({ navigation }) {
  
  // Función para asignar colores según el estado del reporte
  const getStatusStyle = (status) => {
    switch (status) {
      case 'resuelto': return { bg: '#dcfce7', text: '#166534' }; // Verde
      case 'en revisión': return { bg: '#dbeafe', text: '#1e40af' }; // Azul
      case 'pendiente': default: return { bg: '#fef9c3', text: '#854d0e' }; // Amarillo
    }
  };

  // Renderizado de cada tarjeta de reporte (Futuro ReportCard.js)
  const renderReportCard = ({ item }) => {
    const statusColors = getStatusStyle(item.status);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.date}>{item.date}</Text>
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
  container: { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 20, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  listContent: { paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 2, // Sombra suave en Android
    shadowColor: '#000', // Sombra suave en iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  date: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  description: { fontSize: 15, color: '#374151', marginBottom: 16, lineHeight: 22 },
  detailsButton: { alignSelf: 'flex-start' },
  detailsButtonText: { color: '#15803d', fontWeight: '600', fontSize: 14 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyStateText: { color: '#6b7280', fontSize: 16, marginBottom: 8 },
  emptyStateLink: { color: '#15803d', fontWeight: 'bold', fontSize: 16 },
});