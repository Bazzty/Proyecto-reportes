import { useState, useCallback } from 'react';
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

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function AdminReportsScreen() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('pendiente');
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const keyboardHeight = useKeyboardHeight();

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    api.get('/admin/reports', { params: filter ? { validation_status: filter } : {} })
      .then(res => setReports(res.data.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [filter]);

  useFocusEffect(load);

  const applyValidation = async (id, validationStatus, rejectionReason) => {
    const { data } = await api.patch(`/admin/reports/${id}/validation`, {
      validation_status: validationStatus,
      rejection_reason: rejectionReason,
    });
    setReports(prev => (filter
      ? prev.filter(r => r.id !== id)
      : prev.map(r => (r.id === id ? data : r))));
  };

  const handleValidate = async (id) => {
    try {
      await applyValidation(id, 'valido');
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
      await applyValidation(rejecting, 'rechazado', trimmed);
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
        {item.photo_url ? (
          <Image source={item.photo_url} style={styles.photo} contentFit="cover" cachePolicy="disk" transition={150} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="image-outline" size={28} color="#d1d5db" />
          </View>
        )}

        <View style={styles.body}>
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

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.action, styles.validateBtn]} onPress={() => handleValidate(item.id)}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#166534" />
              <Text style={styles.validateText}>Validar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.action, styles.rejectBtn]} onPress={() => { setRejecting(item.id); setReason(''); }}>
              <Ionicons name="close-circle-outline" size={18} color="#991b1b" />
              <Text style={styles.rejectText}>Rechazar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Revisión de Reportes</Text>
      <Text style={styles.subtitle}>Valida o rechaza los reportes recibidos</Text>

      <View style={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={String(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0e7490" style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-offline-outline" size={44} color="#fca5a5" />
          <Text style={styles.emptyText}>No se pudieron cargar los reportes.</Text>
          <TouchableOpacity onPress={load}><Text style={styles.emptyLink}>Reintentar</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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

  filters:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
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
  body:             { padding: 14 },
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
