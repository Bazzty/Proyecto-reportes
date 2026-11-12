import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { exportReports } from '../services/exportReports';
import useCategories from '../hooks/useCategories';
import useAdminZones from '../hooks/useAdminZones';
import useAdminSummary from '../hooks/useAdminSummary';
import useAppActive from '../hooks/useAppActive';
import useReportsPolling from '../hooks/useReportsPolling';
import ReportCard from '../components/admin/ReportCard';
import FilterPanel from '../components/admin/FilterPanel';
import SearchBar from '../components/admin/SearchBar';
import SummaryCard from '../components/admin/SummaryCard';
import Toolbar from '../components/admin/Toolbar';
import SelectionBar from '../components/admin/SelectionBar';
import NewReportsBanner from '../components/admin/NewReportsBanner';
import RejectModal from '../components/admin/RejectModal';
import ConfirmModal from '../components/admin/ConfirmModal';
import Toast from '../components/admin/Toast';
import { MAX_BULK } from '../components/admin/format';

const FILTERS = [
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'valido', label: 'Válidos' },
  { key: 'rechazado', label: 'Rechazados' },
  { key: null, label: 'Todos' },
];

const TOAST_MS = 3500;
const UNDO_MS = 6000;
const SEARCH_DEBOUNCE_MS = 400;
const DEFAULT_SORT = 'recientes';
const CONFLICT_MESSAGE = 'Este reporte cambió mientras tanto. Se actualizó la tarjeta.';

// Un reporte pendiente de validación no puede avanzar de estado: el backend solo lo permite en
// reportes válidos. Esa combinación siempre daría vacío.
const isImpossibleCombination = (validation, status) => (
  validation === 'pendiente' && !!status && status !== 'Pendiente'
);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function AdminReportsScreen({ navigation }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('pendiente');
  const [statusFilter, setStatusFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [zoneFilter, setZoneFilter] = useState(null);
  const [sort, setSort] = useState(DEFAULT_SORT);
  // Lo que se escribe en el buscador; `search` es el valor ya aplicado (tras el debounce).
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState(null);
  // Motivo de rechazo: un reporte ({ id, validationStatus, description }) o un lote ({ bulk, count }).
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyIds, setBusyIds] = useState([]);
  const [toast, setToast] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState([]);
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  // Si las categorías o las zonas fallan, la pantalla funciona igual, solo sin esos chips.
  const categories = useCategories();
  const zones = useAdminZones();
  const { summary, load: loadSummary, refreshSoon: refreshSummary } = useAdminSummary();
  const appActive = useAppActive();

  // Contador de petición: con varios filtros se puede cambiar de filtro con una petición en
  // vuelo; solo la última puede escribir en la lista. El polling NO lo comparte.
  const requestRef = useRef(0);
  // Tarjetas con una acción en curso (validar, rechazar, cambiar estado o deshacer). Es un
  // conjunto en una ref síncrona (el estado de React llega tarde y dejaría pasar un doble clic) y
  // se refleja en `busyIds` para deshabilitar los botones. Así las demás tarjetas siguen usables.
  const busyRef = useRef(new Set());
  // Sube con cada recarga completa: una mutación compara este valor para saber si la lista
  // cambió mientras viajaba. Cargar más páginas no lo mueve, porque no reemplaza la lista.
  const listVersionRef = useRef(0);
  // Reporte abierto en el detalle: al volver se refresca solo esa tarjeta.
  const visitedIdRef = useRef(null);
  const loadRef = useRef(null);
  const toastTimerRef = useRef(null);
  // Guardas síncronas contra doble envío del lote, el deshacer y la exportación.
  const bulkRef = useRef(false);
  const undoingRef = useRef(false);
  const exportingRef = useRef(false);
  // Última versión de la lista y de sus ids, para el polling y para decidir si una tarjeta sigue.
  const reportsRef = useRef([]);
  const knownIdsRef = useRef(new Set());
  // Id más alto visto desde la última recarga completa: el polling solo avisa de reportes más nuevos.
  // No baja cuando un reporte sale de la lista, así los que suben desde la página 2 no cuentan.
  const newestIdRef = useRef(0);
  // Los avisos con "Deshacer" llaman a la versión más reciente del manejador, no a la del render
  // en que se mostraron.
  const undoHandlerRef = useRef(null);

  useEffect(() => {
    reportsRef.current = reports;
    knownIdsRef.current = new Set(reports.map(r => r.id));
    reports.forEach((r) => { if (r.id > newestIdRef.current) newestIdRef.current = r.id; });
  }, [reports]);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setToast(null);
  }, []);

  // Alert.alert no hace nada en react-native-web, así que los avisos son un toast propio. Solo
  // hay uno a la vez: un aviso nuevo (y su "Deshacer") reemplaza al anterior.
  const showToast = useCallback((type, message, { action, duration = TOAST_MS } = {}) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, message, action });
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null;
      setToast(null);
    }, duration);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const undoAction = (entry) => ({ label: 'Deshacer', onPress: () => undoHandlerRef.current(entry) });

  // Quién moderó el reporte antes de la acción, para que deshacer lo restaure. Solo tiene sentido si
  // ya estaba moderado (válido o rechazado) y se conocen ambos datos.
  const previousModeration = (validationStatus, validatedBy, validatedAt) => (
    validationStatus !== 'pendiente' && validatedBy?.id && validatedAt
      ? { prevValidatedBy: validatedBy.id, prevValidatedAt: validatedAt }
      : {}
  );

  // Búsqueda con debounce: el valor aplicado (y la recarga) sigue al escrito 400 ms después.
  useEffect(() => {
    const applied = searchInput.trim();
    if (applied === search) return undefined;
    const timer = setTimeout(() => setSearch(applied), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const beginBusy = (id) => {
    if (busyRef.current.has(id)) return false;
    busyRef.current.add(id);
    setBusyIds([...busyRef.current]);
    return true;
  };

  const endBusy = (id) => {
    busyRef.current.delete(id);
    setBusyIds([...busyRef.current]);
  };

  // Filtros del listado; los comparten la carga, la exportación y el polling.
  const listParams = useMemo(() => ({
    ...(filter ? { validation_status: filter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(categoryFilter ? { category_id: categoryFilter } : {}),
    ...(zoneFilter ? { zone_id: zoneFilter } : {}),
    ...(search ? { search } : {}),
    ...(sort !== DEFAULT_SORT ? { sort } : {}),
  }), [filter, statusFilter, categoryFilter, zoneFilter, search, sort]);

  const load = useCallback((pageToLoad = 1) => {
    const requestId = ++requestRef.current;
    if (pageToLoad === 1) {
      listVersionRef.current += 1;
      setLoading(true);
      setError(false);
      setLoadingMore(false);
      setNewCount(0);
    } else {
      setLoadingMore(true);
    }

    api.get('/admin/reports', { params: { ...listParams, page: pageToLoad } })
      .then((res) => {
        if (requestId !== requestRef.current) return;
        const rows = res.data.data ?? [];
        const meta = res.data.meta ?? {};
        // Recarga completa (otros filtros o "Mostrar"): el tope se recalcula con la lista nueva.
        if (pageToLoad === 1) newestIdRef.current = 0;
        setReports(prev => (pageToLoad === 1 ? rows : [...prev, ...rows]));
        setPage(meta.current_page ?? 1);
        setLastPage(meta.last_page ?? 1);
        setTotal(meta.total ?? rows.length);
        if (meta.counts) setCounts(meta.counts);
      })
      .catch(() => { if (requestId === requestRef.current && pageToLoad === 1) setError(true); })
      .finally(() => {
        if (requestId !== requestRef.current) return;
        setLoading(false);
        setLoadingMore(false);
      });
  }, [listParams]);

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

  // Primero el foco general (resumen y estado "enfocada" para el polling) y después el de la
  // lista, que es el que decide si se recarga o solo se refresca la tarjeta visitada.
  useFocusEffect(useCallback(() => {
    setIsFocused(true);
    loadSummary();
    return () => setIsFocused(false);
  }, [loadSummary]));

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

  // Home centra el mapa con latitude/longitude de focusReport. Se vuelve a la instancia existente
  // de Home con popTo (navigate apilaría una segunda) y se envía solo lo necesario.
  const viewOnMap = (item) => {
    navigation.popTo('Home', {
      focusReport: { id: item.id, latitude: item.latitude, longitude: item.longitude },
    }, { merge: true });
  };

  const selectValidationFilter = (key) => {
    setFilter(key);
    if (isImpossibleCombination(key, statusFilter)) setStatusFilter(null);
  };

  const selectStatusFilter = (key) => {
    setStatusFilter(key);
    if (isImpossibleCombination(filter, key)) setFilter('valido');
  };

  const activeFilterCount = (statusFilter ? 1 : 0) + (categoryFilter ? 1 : 0) + (zoneFilter ? 1 : 0)
    + (searchInput.trim() ? 1 : 0) + (sort !== DEFAULT_SORT ? 1 : 0);

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
  };

  const clearFilters = () => {
    setStatusFilter(null);
    setCategoryFilter(null);
    setZoneFilter(null);
    setSort(DEFAULT_SORT);
    clearSearch();
  };

  const loadMore = () => {
    if (loading || loadingMore || page >= lastPage) return;
    load(page + 1);
  };

  // Mueve reportes de un contador al otro sin pedir de nuevo. Si la lista se recargó, los
  // conteos del servidor ya vienen al día y no hay nada que ajustar.
  const adjustCounts = (from, to, amount = 1) => {
    if (from === to || amount <= 0) return;
    setCounts(c => (c ? {
      ...c,
      [from]: Math.max(0, (c[from] ?? 0) - amount),
      [to]: (c[to] ?? 0) + amount,
    } : c));
  };

  const applyValidation = async (id, validationStatus, expectedValidationStatus, rejectionReason) => {
    const listVersion = listVersionRef.current;
    const { data } = await api.patch(`/admin/reports/${id}/validation`, {
      validation_status: validationStatus,
      expected_validation_status: expectedValidationStatus,
      rejection_reason: rejectionReason,
    });
    if (listVersion === listVersionRef.current) adjustCounts(expectedValidationStatus, validationStatus);
    applyReportUpdate(data, listVersion);
    refreshSummary();
  };

  const handleStatusChange = async (item, status) => {
    if (status === item.status || !beginBusy(item.id)) return;
    const listVersion = listVersionRef.current;
    try {
      const { data } = await api.patch(`/reports/${item.id}/status`, { status });
      applyReportUpdate(data, listVersion);
      refreshSummary();
      showToast('success', `Estado actualizado a ${status}`, item.status ? {
        duration: UNDO_MS,
        action: undoAction({ kind: 'status', id: item.id, status: item.status }),
      } : undefined);
    } catch (err) {
      if (err.response?.status === 409) {
        // Otro admin le quitó la validación: la tarjeta está obsoleta.
        showToast('error', 'Este reporte ya no está validado, por lo que no se puede cambiar su estado.');
        refreshReport(item.id);
      } else {
        showToast('error', 'No se pudo actualizar el estado.');
      }
    } finally {
      endBusy(item.id);
    }
  };

  const handleValidate = async (item) => {
    if (!beginBusy(item.id)) return;
    try {
      await applyValidation(item.id, 'valido', item.validation_status);
      showToast('success', 'Reporte validado', {
        duration: UNDO_MS,
        action: undoAction({
          kind: 'validation', id: item.id, from: item.validation_status, to: 'valido', reason: item.rejection_reason,
          ...previousModeration(item.validation_status, item.validated_by, item.validated_at),
        }),
      });
    } catch (err) {
      if (err.response?.status === 409) {
        showToast('error', CONFLICT_MESSAGE);
        refreshReport(item.id);
      } else {
        showToast('error', 'No se pudo validar el reporte.');
      }
    } finally {
      endBusy(item.id);
    }
  };

  // Deshacer la última acción sobre UN reporte. Si el reporte salió de la lista al aplicarla
  // (por el filtro activo), se recarga para que vuelva a aparecer.
  const handleUndo = async (entry) => {
    if (undoingRef.current) return;
    undoingRef.current = true;
    dismissToast();
    if (!beginBusy(entry.id)) {
      undoingRef.current = false;
      return;
    }
    const listVersion = listVersionRef.current;
    try {
      let data;
      if (entry.kind === 'status') {
        ({ data } = await api.patch(`/reports/${entry.id}/status`, { status: entry.status }));
      } else {
        ({ data } = await api.patch(`/admin/reports/${entry.id}/validation`, {
          validation_status: entry.from,
          expected_validation_status: entry.to,
          ...(entry.from === 'rechazado' && entry.reason ? { rejection_reason: entry.reason } : {}),
          ...(entry.prevValidatedBy ? {
            restore_validated_by: entry.prevValidatedBy,
            restore_validated_at: entry.prevValidatedAt,
          } : {}),
        }));
        if (listVersion === listVersionRef.current) adjustCounts(entry.to, entry.from);
      }
      if (knownIdsRef.current.has(entry.id)) applyReportUpdate(data, listVersion);
      else loadRef.current(1);
      refreshSummary();
      showToast('success', 'Acción deshecha');
    } catch (err) {
      if (err.response?.status === 409) {
        showToast('error', CONFLICT_MESSAGE);
        refreshReport(entry.id);
      } else {
        showToast('error', 'No se pudo deshacer la acción.');
      }
    } finally {
      endBusy(entry.id);
      undoingRef.current = false;
    }
  };
  undoHandlerRef.current = handleUndo;

  const openReject = (item) => {
    setRejecting({
      id: item.id,
      validationStatus: item.validation_status,
      description: item.description,
      ...previousModeration(item.validation_status, item.validated_by, item.validated_at),
    });
    setReason('');
    setReasonTouched(false);
  };

  const closeReject = () => {
    if (saving) return;
    setRejecting(null);
  };

  const changeReason = (text) => {
    setReason(text);
    setReasonTouched(true);
  };

  // ---- Modo selección y lote ----

  const exitSelection = () => {
    setSelectionMode(false);
    setSelected([]);
  };

  const toggleSelectionMode = () => {
    if (selectionMode) exitSelection();
    else setSelectionMode(true);
  };

  const toggleSelected = (id) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return prev.length >= MAX_BULK ? prev : [...prev, id];
    });
  };

  const selectVisible = () => {
    setSelected(prev => {
      const next = [...prev];
      reports.forEach((r) => {
        if (r.validation_status === 'pendiente' && !next.includes(r.id) && next.length < MAX_BULK) next.push(r.id);
      });
      return next;
    });
  };

  // Si la lista cambia con el modo activo (otro filtro, recarga), se descartan los ids que ya no
  // están o que dejaron de estar pendientes.
  useEffect(() => {
    if (!selectionMode) return;
    const pending = new Set(reports.filter(r => r.validation_status === 'pendiente').map(r => r.id));
    setSelected(prev => {
      const kept = prev.filter(id => pending.has(id));
      return kept.length === prev.length ? prev : kept;
    });
  }, [reports, selectionMode]);

  // Aplica a la lista y al total el resultado de un lote: los reportes cambiados que ya no
  // coinciden con el filtro activo salen, igual que en las acciones individuales.
  const applyBulkUpdate = (updatedIds, validationStatus, rejectionReason, validatedBy = null, validatedAt = null) => {
    const ids = new Set(updatedIds);
    let removed = 0;
    const next = [];
    reportsRef.current.forEach((r) => {
      if (!ids.has(r.id)) {
        next.push(r);
        return;
      }
      // validated_by/at vienen en la respuesta del lote: el historial de la tarjeta queda al día sin recargar.
      const changed = {
        ...r,
        validation_status: validationStatus,
        rejection_reason: validationStatus === 'rechazado' ? rejectionReason : null,
        validated_by: validatedBy,
        validated_at: validatedAt,
        auto_validated: false,
      };
      const matches = (!filter || validationStatus === filter) && (!statusFilter || changed.status === statusFilter);
      if (matches) next.push(changed);
      else removed += 1;
    });
    setReports(next);
    if (removed > 0) setTotal(t => Math.max(0, t - removed));
  };

  const runBulk = async (validationStatus, rejectionReason) => {
    if (bulkRef.current || selected.length === 0) return;
    bulkRef.current = true;
    setSaving(true);
    const listVersion = listVersionRef.current;
    const label = validationStatus === 'valido' ? ['validado', 'validados'] : ['rechazado', 'rechazados'];
    try {
      const { data } = await api.post('/admin/reports/bulk-validation', {
        ids: selected,
        validation_status: validationStatus,
        ...(rejectionReason ? { rejection_reason: rejectionReason } : {}),
      });
      const updated = data?.updated ?? [];
      const skipped = data?.skipped ?? [];
      if (listVersion === listVersionRef.current) {
        adjustCounts('pendiente', validationStatus, updated.length);
        applyBulkUpdate(updated, validationStatus, rejectionReason, data?.validated_by ?? null, data?.validated_at ?? null);
      } else {
        loadRef.current(1);
      }
      // Los omitidos cambiaron por otro lado: se vuelve a pedir la lista para verlos al día.
      if (skipped.length > 0) loadRef.current(1);
      setConfirmingBulk(false);
      setRejecting(null);
      setReason('');
      exitSelection();
      refreshSummary();
      showToast('success', `${plural(updated.length, label[0], label[1])}, ${plural(skipped.length, 'omitido', 'omitidos')}`);
    } catch (err) {
      setConfirmingBulk(false);
      showToast('error', err.response?.status === 422
        ? `Se pueden procesar hasta ${MAX_BULK} reportes por lote.`
        : `No se pudo ${validationStatus === 'valido' ? 'validar' : 'rechazar'} el lote.`);
    } finally {
      bulkRef.current = false;
      setSaving(false);
    }
  };

  const openBulkReject = () => {
    setRejecting({ bulk: true, count: selected.length });
    setReason('');
    setReasonTouched(false);
  };

  const handleReject = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonTouched(true);
      return;
    }
    if (rejecting.bulk) {
      await runBulk('rechazado', trimmed);
      return;
    }
    if (!beginBusy(rejecting.id)) return;
    setSaving(true);
    try {
      await applyValidation(rejecting.id, 'rechazado', rejecting.validationStatus, trimmed);
      setRejecting(null);
      setReason('');
      showToast('success', 'Reporte rechazado', {
        duration: UNDO_MS,
        action: undoAction({
          kind: 'validation', id: rejecting.id, from: rejecting.validationStatus, to: 'rechazado',
          ...(rejecting.prevValidatedBy ? {
            prevValidatedBy: rejecting.prevValidatedBy,
            prevValidatedAt: rejecting.prevValidatedAt,
          } : {}),
        }),
      });
    } catch (err) {
      if (err.response?.status === 409) {
        setRejecting(null);
        showToast('error', CONFLICT_MESSAGE);
        refreshReport(rejecting.id);
      } else {
        showToast('error', 'No se pudo rechazar el reporte.');
      }
    } finally {
      endBusy(rejecting.id);
      setSaving(false);
    }
  };

  // ---- Exportación ----

  const handleExport = async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    try {
      const result = await exportReports(listParams);
      if (result.empty) showToast('info', 'No hay reportes para exportar con los filtros actuales.');
      else if (result.shared) showToast('success', `${plural(result.rows, 'reporte exportado', 'reportes exportados')}.`);
    } catch {
      showToast('error', 'No se pudo exportar los reportes.');
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  };

  // ---- Actualización automática ----

  const handlePollResult = useCallback(({ newCount: found, counts: fresh }) => {
    setNewCount(found);
    if (fresh) setCounts(fresh);
  }, []);

  const actionInProgress = busyIds.length > 0 || saving || exporting;
  useReportsPolling({
    enabled: isFocused && appActive && !loading && !error && !selectionMode && !rejecting
      && !confirmingBulk && !actionInProgress,
    params: listParams,
    listVersionRef,
    newestIdRef,
    onResult: handlePollResult,
  });

  const renderItem = ({ item }) => (
    <ReportCard
      item={item}
      busy={busyIds.includes(item.id)}
      selectionMode={selectionMode}
      selected={selected.includes(item.id)}
      selectDisabled={selected.length >= MAX_BULK}
      onToggleSelect={toggleSelected}
      onOpenDetail={openDetail}
      onValidate={handleValidate}
      onReject={openReject}
      onStatusChange={handleStatusChange}
      onViewOnMap={viewOnMap}
    />
  );

  const emptyMessage = {
    pendiente: 'No hay reportes pendientes de revisión.',
    valido: 'No hay reportes válidos.',
    rechazado: 'No hay reportes rechazados.',
  }[filter] ?? 'No hay reportes.';

  const bulkReject = !!rejecting?.bulk;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {FILTERS.map(f => {
            const isSelected = filter === f.key;
            const count = counts ? counts[f.key ?? 'total'] : null;
            return (
              <TouchableOpacity
                key={String(f.key)}
                style={[styles.tab, isSelected && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityLabel={count === null ? f.label : `${f.label}, ${count}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => selectValidationFilter(f.key)}
              >
                <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>{f.label}</Text>
                {count !== null ? (
                  <Text style={[styles.tabCount, isSelected && styles.tabCountActive]}>{count}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <SummaryCard summary={summary} />

        <SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          onClear={clearSearch}
          onSubmit={() => setSearch(searchInput.trim())}
        />

        <Toolbar
          filtersOpen={filtersOpen}
          activeFilterCount={activeFilterCount}
          onToggleFilters={() => setFiltersOpen(open => !open)}
          onClear={clearFilters}
          selectionMode={selectionMode}
          onToggleSelection={toggleSelectionMode}
          exporting={exporting}
          onExport={handleExport}
        />
        {total > 0 ? <Text style={styles.totalText}>{total} en total</Text> : null}

        {filtersOpen ? (
          <FilterPanel
            statusFilter={statusFilter}
            onStatusChange={selectStatusFilter}
            categories={categories}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            zones={zones}
            zoneFilter={zoneFilter}
            onZoneChange={setZoneFilter}
            sort={sort}
            onSortChange={setSort}
          />
        ) : null}

        <NewReportsBanner count={newCount} onShow={() => load(1)} />

        {loading ? (
          <ActivityIndicator size="large" color="#0e7490" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={44} color="#fca5a5" />
            <Text style={styles.emptyText}>No se pudieron cargar los reportes.</Text>
            <TouchableOpacity style={styles.emptyButton} accessibilityRole="button" onPress={() => load(1)}>
              <Text style={styles.emptyLink}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            testID="admin-report-list"
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
                <Ionicons name="checkmark-done-outline" size={44} color="#5eead4" />
                <Text style={styles.emptyText}>{emptyMessage}</Text>
                {activeFilterCount > 0 ? (
                  <TouchableOpacity style={styles.emptyButton} accessibilityRole="button" onPress={clearFilters}>
                    <Text style={styles.emptyLink}>Limpiar filtros</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            }
          />
        )}

        <Toast toast={toast} />
      </View>

      {selectionMode ? (
        <SelectionBar
          count={selected.length}
          atLimit={selected.length >= MAX_BULK}
          busy={saving}
          onSelectVisible={selectVisible}
          onValidate={() => setConfirmingBulk(true)}
          onReject={openBulkReject}
          onCancel={exitSelection}
        />
      ) : null}

      <RejectModal
        visible={!!rejecting}
        title={bulkReject ? `Motivo del rechazo (${plural(rejecting.count, 'reporte', 'reportes')})` : 'Motivo del rechazo'}
        subtitle={bulkReject ? null : rejecting?.description}
        reason={reason}
        touched={reasonTouched}
        saving={saving}
        onChangeReason={changeReason}
        onClose={closeReject}
        onConfirm={handleReject}
      />

      <ConfirmModal
        visible={confirmingBulk}
        title={`Validar ${plural(selected.length, 'reporte', 'reportes')}`}
        message="Se marcarán como válidos los reportes seleccionados que sigan pendientes."
        confirmLabel="Validar"
        busy={saving}
        onConfirm={() => runBulk('valido')}
        onCancel={() => setConfirmingBulk(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 16, paddingTop: 12 },
  content:   { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },

  tabs:          { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 12, padding: 3, gap: 2 },
  tab:           { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 4 },
  tabActive:     { backgroundColor: '#0e7490' },
  tabText:       { fontSize: 12, fontWeight: '600', color: '#4b5563' },
  tabTextActive: { color: '#fff' },
  tabCount:      { fontSize: 12, fontWeight: '700', color: '#111827', marginTop: 1 },
  tabCountActive: { color: '#fff' },

  totalText: { fontSize: 12, color: '#6b7280', marginBottom: 8 },

  listContent: { paddingBottom: 40 },

  emptyState:  { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText:   { color: '#6b7280', fontSize: 15, textAlign: 'center' },
  emptyButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  emptyLink:   { color: '#0e7490', fontWeight: 'bold', fontSize: 15 },
});
