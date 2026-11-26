import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

const SUPPORT_EMAIL = 'soporte.lagoenlinea@gmail.com';

const SECTIONS = [
  {
    title: '¿Cómo crear un reporte?',
    items: [
      'Toma una foto del problema.',
      'La ubicación GPS se agrega automáticamente.',
      'Elige la categoría y escribe una descripción.',
      'Envía el reporte. Si no tienes conexión, se guarda en el teléfono y se envía cuando vuelva la señal.',
    ],
  },
  {
    title: 'Estados de un reporte',
    items: [
      'Pendiente: recibimos tu reporte y espera revisión.',
      'En Progreso: se está atendiendo el problema.',
      'Resuelto: el problema fue solucionado.',
      'Un administrador revisa cada reporte antes de cambiar su estado.',
    ],
  },
  {
    title: 'Mapa',
    items: [
      'Los marcadores muestran cada reporte; toca uno para ver su detalle.',
      'El mapa de calor muestra las zonas con más focos de contaminación.',
      'Usa los filtros por categoría para ver solo lo que te interesa.',
    ],
  },
];

const getVersion = () => Constants.expoConfig?.version ?? 'desconocida';

const getDevice = () => {
  const device = Platform.OS === 'android' ? Platform.constants?.Model : Platform.OS;
  return device || 'desconocido';
};

const buildMailto = () => {
  const subject = 'Ayuda · Lago en Línea';
  const body = [
    'Tipo (error, consulta o sugerencia):',
    '',
    'Descripción:',
    '',
    '',
    '—',
    `Versión de la app: ${getVersion()}`,
    `Dispositivo: ${getDevice()}`,
    `Sistema: ${Platform.OS} ${Platform.Version}`,
  ].join('\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export default function AyudaScreen() {
  const handleSupport = async () => {
    try {
      await Linking.openURL(buildMailto());
    } catch {
      Alert.alert('No se pudo abrir el correo', `Escríbenos a ${SUPPORT_EMAIL}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.title}>{section.title}</Text>
          {section.items.map((item) => (
            <Text key={item} style={styles.item}>{`• ${item}`}</Text>
          ))}
        </View>
      ))}

      <View style={styles.section}>
        <Text style={styles.title}>¿Necesitas ayuda?</Text>
        <Text style={styles.item}>Escríbenos y te responderemos lo antes posible.</Text>
        <Text style={styles.email} selectable>{SUPPORT_EMAIL}</Text>
        <TouchableOpacity
          style={styles.button}
          testID="support-email-button"
          accessibilityRole="button"
          accessibilityLabel="Escribir a soporte"
          onPress={handleSupport}
        >
          <Ionicons name="mail-outline" size={20} color="#ffffff" />
          <Text style={styles.buttonText}>Escribir a soporte</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>{`Versión ${getVersion()}`}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 24 },
  title: { fontSize: 17, fontWeight: 'bold', color: '#0e7490', marginBottom: 8 },
  item: { fontSize: 14, color: '#6b7280', lineHeight: 21, marginBottom: 4 },
  email: { fontSize: 15, fontWeight: '600', color: '#0e7490', marginTop: 6, marginBottom: 12 },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0e7490', borderRadius: 10, paddingVertical: 12,
  },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 12, color: '#6b7280' },
});
