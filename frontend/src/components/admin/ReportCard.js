import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { REPORT_STATUSES } from '../../constants/reports';
import { capitalize, formatDate, validationStyle, confirmationsLabel } from './format';
import ReportHistory from './ReportHistory';
import shared from './sharedStyles';

const isCoord = (value) => value != null && value !== '' && Number.isFinite(Number(value));
const hasCoords = (item) => isCoord(item.latitude) && isCoord(item.longitude);

// Tarjeta de un reporte en la lista de administración. No guarda estado de negocio: todo llega
// por props y las acciones se delegan a la pantalla.
export default function ReportCard({
  item, busy, selectionMode, selected, selectDisabled,
  onToggleSelect, onOpenDetail, onValidate, onReject, onStatusChange, onViewOnMap,
}) {
  const vs = validationStyle(item.validation_status);
  const isValid = item.validation_status === 'valido';
  const isRejected = item.validation_status === 'rechazado';
  const isPending = !isValid && !isRejected;
  const confirmations = Number(item.confirmations_count) || 0;
  const checkboxDisabled = busy || (selectDisabled && !selected);

  return (
    <View style={styles.card}>
      {selectionMode && isPending ? (
        <TouchableOpacity
          style={styles.checkRow}
          disabled={checkboxDisabled}
          accessibilityRole="checkbox"
          accessibilityLabel={`Seleccionar reporte: ${item.description}`}
          accessibilityState={{ checked: selected, disabled: checkboxDisabled }}
          onPress={() => onToggleSelect(item.id)}
        >
          <Ionicons
            name={selected ? 'checkbox' : 'square-outline'}
            size={24}
            color={checkboxDisabled ? '#9ca3af' : '#0e7490'}
          />
          <Text style={styles.checkText}>{selected ? 'Seleccionado' : 'Seleccionar'}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Solo el resumen es táctil: un táctil que envuelva los botones los ocultaría a los lectores de pantalla. */}
      <TouchableOpacity
        style={styles.summary}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityHint="Abre el detalle del reporte"
        onPress={() => onOpenDetail(item.id)}
      >
        <View style={styles.summaryRow}>
          {item.photo_url ? (
            <Image source={item.photo_url} style={styles.photo} contentFit="cover" cachePolicy="disk" transition={150} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="image-outline" size={24} color="#9ca3af" />
            </View>
          )}

          <View style={styles.info}>
            <Text style={styles.category}>{item.category?.name ? capitalize(item.category.name) : 'Sin categoría'}</Text>
            <View style={styles.pills}>
              <View style={[styles.pill, { backgroundColor: vs.bg }]}>
                <Text style={[styles.pillText, { color: vs.text }]}>{vs.label}</Text>
              </View>
              {item.status ? (
                <View style={[styles.pill, styles.statusPill]}>
                  <Text style={[styles.pillText, styles.statusPillText]}>{item.status}</Text>
                </View>
              ) : null}
              {confirmations > 0 ? (
                <View style={[styles.pill, styles.confirmPill]} accessible accessibilityLabel={confirmationsLabel(confirmations)}>
                  <Ionicons name="people-outline" size={12} color="#0e7490" />
                  <Text style={[styles.pillText, styles.confirmPillText]}>{confirmationsLabel(confirmations)}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={13} color="#6b7280" />
                <Text style={styles.meta} numberOfLines={1}>{item.zone?.name ?? 'Sin zona'}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={13} color="#6b7280" />
                <Text style={styles.meta} numberOfLines={1}>{item.user?.name}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={13} color="#6b7280" />
                <Text style={styles.meta}>{formatDate(item.created_at)}</Text>
              </View>
            </View>
          </View>
        </View>

        {isRejected && item.rejection_reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reason}>Motivo: {item.rejection_reason}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.footer}>
        <View style={styles.secondaryRow}>
          <ReportHistory item={item} />
          {/* El mapa oculta los reportes rechazados y sin coordenadas no hay a dónde centrar. */}
          {!isRejected && hasCoords(item) ? (
            <TouchableOpacity
              style={styles.mapButton}
              accessibilityRole="button"
              accessibilityLabel="Ver en el mapa"
              onPress={() => onViewOnMap(item)}
            >
              <Ionicons name="map-outline" size={16} color="#0e7490" />
              <Text style={styles.mapText}>Ver en el mapa</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {selectionMode ? null : (
          <>
            {isValid ? (
              <View style={styles.statusBlock}>
                <Text style={styles.statusLabel}>Estado del reporte</Text>
                <View style={styles.statusOptions}>
                  {REPORT_STATUSES.map(status => {
                    const active = item.status === status;
                    return (
                      <TouchableOpacity
                        key={status}
                        style={[styles.statusOption, active && styles.statusOptionActive, busy && shared.dimmed]}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active, disabled: busy }}
                        onPress={() => onStatusChange(item, status)}
                      >
                        <Text style={[styles.statusOptionText, active && styles.statusOptionTextActive]}>{status}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {busy ? <ActivityIndicator size="small" color="#0e7490" style={styles.statusSpinner} /> : null}
              </View>
            ) : null}

            <View style={styles.actions}>
              {!isValid ? (
                <TouchableOpacity
                  style={[styles.action, styles.validateBtn, busy && shared.dimmed]}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  onPress={() => onValidate(item)}
                >
                  {busy ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={styles.validateText}>Validar</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
              {!isRejected ? (
                <TouchableOpacity
                  style={[styles.action, styles.rejectBtn, busy && shared.dimmed]}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  onPress={() => onReject(item)}
                >
                  {busy ? <ActivityIndicator size="small" color="#b91c1c" /> : (
                    <>
                      <Ionicons name="close-circle-outline" size={18} color="#b91c1c" />
                      <Text style={styles.rejectText}>Rechazar</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  checkRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  checkText: { fontSize: 13, fontWeight: '600', color: '#0e7490' },
  summary:          { padding: 12 },
  summaryRow:       { flexDirection: 'row', gap: 12 },
  photo:            { width: 88, height: 88, borderRadius: 10 },
  photoPlaceholder: { width: 88, height: 88, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  info:             { flex: 1, minWidth: 0 },
  category:         { fontSize: 14, fontWeight: '700', color: '#0e7490' },
  pills:            { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pill:             { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  pillText:         { fontSize: 10, fontWeight: 'bold' },
  statusPill:       { backgroundColor: '#e0f2fe' },
  statusPillText:   { color: '#075985' },
  confirmPill:      { backgroundColor: '#ecfeff' },
  confirmPillText:  { color: '#0e7490' },
  desc:             { fontSize: 14, color: '#374151', lineHeight: 19, marginTop: 6 },
  metaRow:          { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2, marginTop: 6 },
  metaItem:         { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
  meta:             { fontSize: 11, color: '#6b7280', flexShrink: 1 },
  reasonBox:        { marginTop: 10, backgroundColor: '#fef2f2', borderRadius: 8, padding: 10 },
  reason:           { fontSize: 12, color: '#991b1b' },

  footer:       { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 4 },
  secondaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  mapButton:    { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingLeft: 8 },
  mapText:      { fontSize: 13, fontWeight: '600', color: '#0e7490' },
  actions: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  action:  { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  validateBtn:  { backgroundColor: '#15803d', borderColor: '#15803d' },
  rejectBtn:    { backgroundColor: '#fff', borderColor: '#b91c1c' },
  validateText: { color: '#fff', fontWeight: '600' },
  rejectText:   { color: '#b91c1c', fontWeight: '600' },

  statusBlock:            { marginTop: 6, marginBottom: 6 },
  statusLabel:            { fontSize: 11, color: '#6b7280', fontWeight: '600', marginBottom: 6 },
  statusOptions:          { flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', overflow: 'hidden' },
  statusOption:           { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  statusOptionActive:     { backgroundColor: '#0e7490' },
  statusOptionText:       { fontSize: 12, color: '#374151', fontWeight: '600' },
  statusOptionTextActive: { color: '#fff' },
  statusSpinner:          { marginTop: 6 },
});
