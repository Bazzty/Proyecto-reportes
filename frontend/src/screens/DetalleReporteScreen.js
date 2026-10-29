import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator,
  Alert, TouchableOpacity, FlatList, TextInput, KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

// Gris del botón "Yo también lo vi" mientras espera la respuesta del servidor.
const BUSY_COLOR = '#6b7280';

const statusColor = (status) => {
  if (!status) return '#0e7490';
  const s = status.toLowerCase();
  if (s === 'resuelto')    return '#16a34a';
  if (s === 'en progreso') return '#2563eb';
  return '#f59e0b';
};

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Coordenada válida: número finito; null, '' o texto no numérico no cuentan.
const DECIMAL = /^\s*[-+]?\d+(\.\d+)?([eE][-+]?\d+)?\s*$/;
const toCoord = (value) => (typeof value === 'string' && !DECIMAL.test(value) ? NaN : Number(value ?? NaN));

// Se remonta al cambiar de reporte, así el estado (reporte, comentarios, errores,
// respuestas en vuelo) nunca se mezcla entre reportes.
export default function DetalleReporteScreen(props) {
  return <DetalleReporte key={props.route?.params?.reportId} {...props} />;
}

function DetalleReporte({ route, navigation }) {
  const { reportId } = route?.params ?? {};

  const [report, setReport]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [notFound, setNotFound]     = useState(false);
  const [comments, setComments]     = useState([]);
  const [commentsError, setCommentsError] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending]       = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isGuest, setIsGuest]       = useState(false);
  const [myUserId, setMyUserId]     = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    AsyncStorage.multiGet(['token', 'userId']).then(([[, token], [, uid]]) => {
      setIsGuest(!token);
      setMyUserId(uid ? Number(uid) : null);
    });
  }, []);

  useEffect(() => {
    if (reportId == null) {
      setNotFound(true);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    // Resuelve true si el reporte cargó; los comentarios solo alertan en ese caso
    // (si el reporte falla, la pantalla y su alerta ya lo informan).
    const reportLoaded = api.get(`/reports/${reportId}`)
      .then(({ data }) => {
        if (!cancelled) setReport(data);
        return true;
      })
      .catch((error) => {
        if (cancelled) return false;
        if (error.response?.status === 404) {
          setNotFound(true);
        } else {
          Alert.alert('Error', 'No se pudo cargar el detalle del reporte.');
        }
        return false;
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    api.get(`/reports/${reportId}/comments`)
      .then(async ({ data }) => {
        if (cancelled) return;
        if (!Array.isArray(data)) {
          setComments([]);
          setCommentsError(true);
          if (await reportLoaded && !cancelled) Alert.alert('Error', 'No se pudieron cargar los comentarios.');
          return;
        }
        setComments(data);
      })
      .catch(async () => {
        if (cancelled) return;
        setCommentsError(true);
        if (await reportLoaded && !cancelled) Alert.alert('Error', 'No se pudieron cargar los comentarios.');
      });

    return () => { cancelled = true; };
  }, [reportId]);

  const handleConfirm = async () => {
    if (isGuest) {
      Alert.alert('Inicia sesión', 'Necesitas una cuenta para confirmar reportes.');
      return;
    }
    // El endpoint alterna: un segundo toque en vuelo desharía la confirmación recién enviada.
    if (confirming) return;

    setConfirming(true);
    try {
      const { data } = await api.post(`/reports/${reportId}/confirm`);
      setReport(prev => ({
        ...prev,
        confirmations_count: data.count,
        confirmed_by_me:     data.confirmed,
      }));
    } catch {
      Alert.alert('Error', 'No se pudo registrar tu confirmación.');
    } finally {
      setConfirming(false);
    }
  };

  const handleSendComment = async () => {
    if (isGuest) {
      Alert.alert('Inicia sesión', 'Necesitas una cuenta para comentar.');
      return;
    }
    const body = newComment.trim();
    if (!body) return;

    setSending(true);
    try {
      const { data } = await api.post(`/reports/${reportId}/comments`, { body });
      setComments(prev => [data, ...prev]);
      setCommentsError(false);
      setNewComment('');
    } catch {
      Alert.alert('Error', 'No se pudo enviar el comentario.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#0e7490" style={styles.loader} />;
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.errorText}>
          {notFound ? 'Reporte no encontrado.' : 'No se pudo cargar el reporte.'}
        </Text>
      </SafeAreaView>
    );
  }

  const confirmed  = report.confirmed_by_me;
  const lat = toCoord(report.latitude);
  const lng = toCoord(report.longitude);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng) &&
                      Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const isOwner    = myUserId && report.user?.id === myUserId;

  const Header = (
    <View>
      {report.photo_url ? (
        <Image
          source={report.photo_url}
          style={styles.photo}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Ionicons name="image-outline" size={40} color="#d1d5db" />
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.metaRow}>
          <Text style={styles.category}>
            {report.category?.name
              ? report.category.name.charAt(0).toUpperCase() + report.category.name.slice(1)
              : 'Sin categoría'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(report.status) + '22' }]}>
            <Text style={[styles.statusText, { color: statusColor(report.status) }]}>
              {report.status}
            </Text>
          </View>
        </View>

        <Text style={styles.description}>{report.description}</Text>

        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={14} color="#9ca3af" />
          <Text style={styles.infoText}>{report.user?.name}</Text>
          <Ionicons name="calendar-outline" size={14} color="#9ca3af" style={{ marginLeft: 12 }} />
          <Text style={styles.infoText}>{formatDate(report.created_at)}</Text>
        </View>

        {hasLocation && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color="#9ca3af" />
            <Text style={styles.infoText}>
              {`Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`}
            </Text>
          </View>
        )}

        {hasLocation && (
          <TouchableOpacity
            style={styles.mapBtn}
            activeOpacity={0.75}
            onPress={() => navigation.popTo('Home', {
              focusReport: { id: report.id, latitude: report.latitude, longitude: report.longitude },
            }, { merge: true })}
          >
            <Ionicons name="map-outline" size={20} color="#fff" />
            <Text style={styles.mapBtnText}>Ver en el mapa</Text>
          </TouchableOpacity>
        )}

        {/* Confirmaciones — oculto si es tu propio reporte */}

        {!isOwner && <TouchableOpacity
          style={[styles.confirmBtn, confirmed && styles.confirmBtnActive, confirming && styles.confirmBtnBusy]}
          onPress={handleConfirm}
          disabled={confirming}
          activeOpacity={0.75}
          accessibilityState={{ disabled: confirming, busy: confirming }}
        >
          {/* Mientras espera la respuesta el botón pasa a grises y el ícono se vuelve el indicador
              de carga nativo de cada plataforma (rayitas en iOS, círculo en Android) */}
          {confirming ? (
            <ActivityIndicator size="small" color={BUSY_COLOR} accessibilityLabel="Enviando confirmación" />
          ) : (
            <Ionicons
              name={confirmed ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={20}
              color={confirmed ? '#fff' : '#0e7490'}
            />
          )}
          <Text style={[styles.confirmText, confirmed && styles.confirmTextActive, confirming && styles.confirmTextBusy]}>
            {confirmed ? 'Lo confirmaste' : 'Yo también lo vi'}
          </Text>
          {report.confirmations_count > 0 && (
            <View style={[styles.confirmCount, confirmed && styles.confirmCountActive, confirming && styles.confirmCountBusy]}>
              <Text style={[styles.confirmCountText, confirmed && { color: '#0e7490' }, confirming && styles.confirmTextBusy]}>
                {report.confirmations_count}
              </Text>
            </View>
          )}
        </TouchableOpacity>}

        {isOwner && report.confirmations_count > 0 && (
          <View style={styles.ownerConfirmRow}>
            <Ionicons name="people-outline" size={16} color="#6b7280" />
            <Text style={styles.ownerConfirmText}>
              {report.confirmations_count === 1
                ? '1 persona confirmó este reporte'
                : `${report.confirmations_count} personas confirmaron este reporte`}
            </Text>
          </View>
        )}

        <Text style={styles.commentsTitle}>
          Comentarios {comments.length > 0 ? `(${comments.length})` : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={comments}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={Header}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.user.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.commentUser}>{item.user.name}</Text>
                  <Text style={styles.commentDate}>{formatDate(item.created_at)}</Text>
                </View>
              </View>
              <Text style={styles.commentBody}>{item.body}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyComments}>
              {commentsError ? 'No se pudieron cargar los comentarios.' : 'Sé el primero en comentar.'}
            </Text>
          }
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={isGuest ? 'Inicia sesión para comentar' : 'Escribe un comentario...'}
            placeholderTextColor="#9ca3af"
            value={newComment}
            onChangeText={setNewComment}
            editable={!isGuest}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!newComment.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSendComment}
            disabled={!newComment.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:   { flex: 1, backgroundColor: '#f9fafb' },
  loader:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:  { fontSize: 16, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  listContent: { paddingBottom: 16 },

  photo:           { width: '100%', height: 240 },
  photoPlaceholder: {
    width: '100%', height: 160, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },

  content:     { padding: 16 },
  metaRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  category:    { fontSize: 18, fontWeight: 'bold', color: '#0e7490' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText:  { fontSize: 12, fontWeight: '700' },
  description: { fontSize: 15, color: '#374151', lineHeight: 23, marginBottom: 10 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  infoText:    { fontSize: 12, color: '#9ca3af', marginLeft: 4 },

  mapBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0e7490', borderRadius: 12, paddingVertical: 12, marginBottom: 12,
  },
  mapBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#0e7490', borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start',
    marginBottom: 24,
  },
  confirmBtnActive:   { backgroundColor: '#0e7490' },
  confirmText:        { fontSize: 14, fontWeight: '600', color: '#0e7490' },
  confirmTextActive:  { color: '#fff' },
  confirmCount: {
    backgroundColor: '#e0f2fe', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 1,
  },
  confirmCountActive:   { backgroundColor: 'rgba(255,255,255,0.25)' },
  confirmCountText:     { fontSize: 12, fontWeight: 'bold', color: '#0e7490' },
  confirmBtnBusy:       { borderColor: '#d1d5db', backgroundColor: '#f3f4f6' },
  confirmTextBusy:      { color: BUSY_COLOR },
  confirmCountBusy:     { backgroundColor: '#e5e7eb' },

  ownerConfirmRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  ownerConfirmText: { fontSize: 13, color: '#6b7280' },

  commentsTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },

  commentCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    marginHorizontal: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#0e7490', alignItems: 'center', justifyContent: 'center',
  },
  avatarText:   { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  commentUser:  { fontSize: 13, fontWeight: '600', color: '#111827' },
  commentDate:  { fontSize: 11, color: '#9ca3af' },
  commentBody:  { fontSize: 14, color: '#374151', lineHeight: 20 },
  emptyComments: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 8, marginBottom: 8, paddingHorizontal: 16 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 100,
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 14, color: '#111827', backgroundColor: '#f9fafb',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#0e7490', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#d1d5db' },
});
