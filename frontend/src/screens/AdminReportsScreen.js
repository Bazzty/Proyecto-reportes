import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import useKeyboardHeight from '../hooks/useKeyboardHeight';
import useCategories from '../hooks/useCategories';
import { REPORT_STATUSES } from '../constants/reports';

const validationStyle = (status) => {
  switch (status) {
    case 'valido':    return { bg: '#dcfce7', text: '#166534', label: 'VÁLIDO' };
    case 'rechazado': return { bg: '#fee2e2', text: '#991b1b', label: 'RECHAZADO' };
    default:          return { bg: '#fef9c3', text: '#854d0e', label: 'PENDIENTE' };
  }
};

const FILTERS = [
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'valido', label: 'Válidos' },
  { key: 'rechazado', label: 'Rechazados' },
  { key: null, label: 'Todos' },
];

const STATUS_FILTERS = [
  { key: null, label: 'Todos' },
  ...REPORT_STATUSES.map(status => ({ key: status, label: status })),
];

// Un reporte pendiente de validación no puede avanzar de estado: el backend solo lo permite en
// reportes válidos y la validación no vuelve a pendiente. Esa combinación siempre daría vacío.
const isImpossibleCombination = (validation, status) => (
  validation === 'pendiente' && !!status && status !== 'Pendiente'
);

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function AdminReportsScreen({ navigation }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('pendiente');
  const [statusFilter, setStatusFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const keyboardHeight = useKeyboardHeight();
  // Si las categorías fallan, la pantalla funciona igual, solo sin esos chips.
  const categories = useCategories();

  // Contador de petición: con varios filtros se puede cambiar de filtro con una petición en
  // vuelo; solo la última puede escribir en la lista.
  const requestRef = useRef(0);
  // Guarda síncrona contra doble envío del cambio de estado (el estado de React llega tarde).
  const changingRef = useRef(false);
  // Sube con cada recarga completa: una mutación compara este valor para saber si la lista
  // cambió mientras viajaba. Cargar más páginas no lo mueve, porque no reemplaza la lista.
  const listVersionRef = useRef(0);
  // Reporte abierto en el detalle: al volver se refresca solo esa tarjeta.
  const visitedIdRef = useRef(null);
  const loadRef = useRef(null);

  const load = useCallback((pageToLoad = 1) => {
    const requestId = ++requestRef.current;
    if (pageToLoad === 1) {
      listVersionRef.current += 1;
      setLoading(true);
      setError(false);
      setLoadingMore(false);
    } else {
      setLoadingMore(true);
    }

    api.get('/admin/reports', {
      params: {
        ...(filter ? { validation_status: filter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(categoryFilter ? { category_id: categoryFilter } : {}),
        page: pageToLoad,
      },
    })
      .then((res) => {
        if (requestId !== requestRef.current) return;
        const rows = res.data.data ?? [];
        const meta = res.data.meta ?? {};
        setReports(prev => (pageToLoad === 1 ? rows : [...prev, ...rows]));
        setPage(meta.current_page ?? 1);
        setLastPage(meta.last_page ?? 1);
        setTotal(meta.total ?? rows.length);
      })
      .catch(() => { if (requestId === requestRef.current && pageToLoad === 1) setError(true); })
      .finally(() => {
        if (requestId !== requestRef.current) return;
        setLoading(false);
        setLoadingMore(false);
      });
  }, [filter, statusFilter, categoryFilter]);

  useEffect(() => { loadRef.current = load; }, [load]);

  // Combina la respuesta (puede no traer validated_by) o saca el reporte si ya no coincide con
  // los filtros. Si la lista se recargó entretanto, esa carga pudo leer el dato anterior o usar
  // otros filtros, así que se vuelve a pedir en vez de tocarla.
  const applyReportUpdate = useCallback((data, listVersion) => {
    if (listVersion !== listVersionRef.current) {
      loadRef.current(1);
      return;
    }
    const matches = (!filter || data.validation_status === filter)
      && (!statusFilter || data.status === statusFilter);
    setReports(prev => (matches
      ? prev.map(r => (r.id === data.id ? { ...r, ...data } : r))
      : prev.filter(r => r.id !== data.id)));
    if (!matches) setTotal(t => Math.max(0, t - 1));
  }, [filter, statusFilter]);

  // Si falla, la tarjeta se queda como estaba: es un refresco de cortesía.
  const refreshReport = useCallback((id) => {
    const listVersion = listVersionRef.current;
    api.get(`/reports/${id}`)
      .then(({ data }) => applyReportUpdate(data, listVersion))
      .catch(() => {});
  }, [applyReportUpdate]);

  useFocusEffect(useCallback(() => {
    const visitedId = visitedIdRef.current;
    visitedIdRef.current = null;
    // Al volver del detalle no se recarga: se perderían las páginas cargadas y el scroll.
    if (visitedId !== null) refreshReport(visitedId);
    else load(1);
  }, [load, refreshReport]));

  const openDetail = (id) => {
    visitedIdRef.current = id;
    navigation.navigate('DetalleReporte', { reportId: id });
  };

  const selectValidationFilter = (key) => {
    setFilter(key);
    if (isImpossibleCombination(key, statusFilter)) setStatusFilter(null);
  };

  const selectStatusFilter = (key) => {
    setStatusFilter(key);
    if (isImpossibleCombination(filter, key)) setFilter('valido');
  };

  const loadMore = () => {
    if (loading || loadingMore || page >= lastPage) return;
    load(page + 1);
  };

  const applyValidation = async (id, validationStatus, expectedValidationStatus, rejectionReason) => {
    const listVersion = listVersionRef.current;
    const { data } = await api.patch(`/admin/reports/${id}/validation`, {
      validation_status: validationStatus,
      expected_validation_status: expectedValidationStatus,
      rejection_reason: rejectionReason,
    });
    applyReportUpdate(data, listVersion);
  };

  const handleStatusChange = async (item, status) => {
    if (status === item.status || changingRef.current) return;
    changingRef.current = true;
    setChangingStatus(true);
    const listVersion = listVersionRef.current;
    try {
      const { data } = await api.patch(`/reports/${item.id}/status`, { status });
      applyReportUpdate(data, listVersion);
    } catch (err) {
      if (err.response?.status === 409) {
        // Otro admin le quitó la validación: la tarjeta está obsoleta.
        Alert.alert('Reporte actualizado', 'Este reporte ya no está validado, por lo que no se puede cambiar su estado.');
        refreshReport(item.id);
      } else {
        Alert.alert('Error', 'No se pudo actualizar el estado.');
      }
    } finally {
      changingRef.current = false;
      setChangingStatus(false);
    }
  };

  const handleValidate = async (id, expectedValidationStatus) => {
    try {
      await applyValidation(id, 'valido', expectedValidationStatus);
    } catch {
      Alert.alert('Error', 'No se pudo validar el reporte.');
    }
  };

  const handleReject = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      Alert.alert('Falta motivo', 'Escribe el motivo del rechazo.');
      return;
    }
    setSaving(true);
    try {
      await applyValidation(rejecting.id, 'rechazado', rejecting.validationStatus, trimmed);
      setRejecting(null);
      setReason('');
    } catch {
      Alert.alert('Error', 'No se pudo rechazar el reporte.');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }) => {
    const vs = validationStyle(item.validation_status);
    return (
      <View style={styles.card}>
        {/* Solo el resumen es táctil: un táctil que envuelva los botones los ocultaría a los lectores de pantalla. */}
        <TouchableOpacity
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityHint="Abre el detalle del reporte"
          onPress={() => openDetail(item.id)}
        >
          {item.photo_url ? (
            <Image source={item.photo_url} style={styles.photo} contentFit="cover" cachePolicy="disk" transition={150} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="image-outline" size={28} color="#d1d5db" />
            </View>
          )}

          <View style={styles.summary}>
            <View style={styles.headerRow}>
              <Text style={styles.category}>
                {item.category?.name
                  ? item.category.name.charAt(0).toUpperCase() + item.category.name.slice(1)
                  : 'Sin categoría'}
              </Text>
              <View style={[styles.badge, { backgroundColor: vs.bg }]}>
                <Text style={[styles.badgeText, { color: vs.text }]}>{vs.label}</Text>
              </View>
            </View>

            <Text style={styles.desc} numberOfLines={3}>{item.description}</Text>
            <Text style={styles.meta}>📍 {item.zone?.name ?? 'Sin zona'} · {item.user?.name}</Text>
            <Text style={styles.meta}>{formatDate(item.created_at)}</Text>

            {item.validation_status === 'rechazado' && item.rejection_reason ? (
              <Text style={styles.reason}>Motivo: {item.rejection_reason}</Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={styles.controls}>
          {item.validation_status === 'valido' ? (
            <View style={styles.statusBlock}>
              <Text style={styles.statusLabel}>Estado del reporte</Text>
              <View style={styles.statusOptions}>
                {REPORT_STATUSES.map(status => {
                  const active = item.status === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      style={[styles.statusOption, active && styles.statusOptionActive, changingStatus && styles.statusOptionBusy]}
                      disabled={changingStatus}
                      onPress={() => handleStatusChange(item, status)}
                    >
                      <Text style={[styles.statusOptionText, active && styles.statusOptionTextActive]}>{status}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.actions}>
            {item.validation_status !== 'valido' ? (
              <TouchableOpacity style={[styles.action, styles.validateBtn]} onPress={() => handleValidate(item.id, item.validation_status)}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#166534" />
                <Text style={styles.validateText}>Validar</Text>
              </TouchableOpacity>
            ) : null}
            {item.validation_status !== 'rechazado' ? (
              <TouchableOpacity style={[styles.action, styles.rejectBtn]} onPress={() => { setRejecting({ id: item.id, validationStatus: item.validation_status }); setReason(''); }}>
                <Ionicons name="close-circle-outline" size={18} color="#991b1b" />
                <Text style={styles.rejectText}>Rechazar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Revisión de Reportes</Text>
      <Text style={styles.subtitle}>
        Revisa, valida o rechaza reportes y gestiona su estado{total > 0 ? ` · ${total} en total` : ''}
      </Text>

      <Text style={styles.filterLabel}>Validación</Text>
      <View style={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={String(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => selectValidationFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.filterLabel}>Estado</Text>
      <View style={styles.filters}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={String(f.key)}
            style={[styles.chip, statusFilter === f.key && styles.chipActive]}
            onPress={() => selectStatusFilter(f.key)}
          >
            <Text style={[styles.chipText, statusFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {categories.length > 0 ? (
        <>
          <Text style={styles.filterLabel}>Categoría</Text>
          <View style={styles.filters}>
            {[{ id: null, name: 'Todas' }, ...categories].map(c => (
              <TouchableOpacity
                key={String(c.id)}
                style={[styles.chip, categoryFilter === c.id && styles.chipActive]}
                onPress={() => setCategoryFilter(c.id)}
              >
                <Text style={[styles.chipText, categoryFilter === c.id && styles.chipTextActive]}>
                  {c.id === null ? c.name : c.name.charAt(0).toUpperCase() + c.name.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color="#0e7490" style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-offline-outline" size={44} color="#fca5a5" />
          <Text style={styles.emptyText}>No se pudieron cargar los reportes.</Text>
          <TouchableOpacity onPress={() => load(1)}><Text style={styles.emptyLink}>Reintentar</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#0e7490" style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-outline" size={44} color="#99f6e4" />
              <Text style={styles.emptyText}>No hay reportes en este estado.</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={!!rejecting}
        transparent
        animationType="fade"
        onRequestClose={() => setRejecting(null)}
      >
        <KeyboardAvoidingView style={[styles.modalBackdrop, { paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>Motivo del rechazo</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej. No corresponde a contaminación"
              placeholderTextColor="#9ca3af"
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={500}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRejecting(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleReject} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Rechazar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 16, paddingTop: 56 },
  title:       { fontSize: 26, fontWeight: 'bold', color: '#111827' },
  subtitle:    { fontSize: 13, color: '#6b7280', marginTop: 2, marginBottom: 14 },

  filterLabel:    { fontSize: 11, color: '#6b7280', fontWeight: '600', marginBottom: 4 },
  filters:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipActive:     { backgroundColor: '#0e7490', borderColor: '#0e7490' },
  chipText:       { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: '#fff' },

  listContent: { paddingBottom: 40 },

  card: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  photo:            { width: '100%', height: 150 },
  photoPlaceholder: { width: '100%', height: 100, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  summary:          { paddingHorizontal: 14, paddingTop: 14 },
  controls:         { paddingHorizontal: 14, paddingBottom: 14 },
  headerRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  category:         { fontSize: 14, fontWeight: '700', color: '#0e7490' },
  badge:            { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText:        { fontSize: 10, fontWeight: 'bold' },
  desc:             { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 6 },
  meta:             { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  reason:           { fontSize: 12, color: '#991b1b', marginTop: 6, fontStyle: 'italic' },

  actions:     { flexDirection: 'row', gap: 10, marginTop: 12 },
  action:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  validateBtn: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  rejectBtn:   { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  validateText: { color: '#166534', fontWeight: '600' },
  rejectText:   { color: '#991b1b', fontWeight: '600' },

  statusBlock:            { marginTop: 12 },
  statusLabel:            { fontSize: 11, color: '#6b7280', fontWeight: '600', marginBottom: 6 },
  statusOptions:          { flexDirection: 'row', gap: 8 },
  statusOption:           { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  statusOptionActive:     { backgroundColor: '#0e7490', borderColor: '#0e7490' },
  statusOptionBusy:       { opacity: 0.6 },
  statusOptionText:       { fontSize: 12, color: '#374151', fontWeight: '600' },
  statusOptionTextActive: { color: '#fff' },

  emptyState: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText:  { color: '#6b7280', fontSize: 15 },
  emptyLink:  { color: '#0e7490', fontWeight: 'bold', fontSize: 15 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalPanel:    { backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  modalTitle:    { fontSize: 17, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  modalInput: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12,
    minHeight: 80, textAlignVertical: 'top', color: '#111827', backgroundColor: '#f9fafb',
  },
  modalActions:     { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  modalCancel:      { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db' },
  modalCancelText:  { color: '#374151', fontWeight: '600' },
  modalConfirm:     { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: '#b91c1c', minWidth: 96, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '600' },
});
