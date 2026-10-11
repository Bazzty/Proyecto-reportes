import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { clearAuthToken } from '../services/api';
import LeafletMap from '../components/LeafletMap';
import useOfflineSync from '../hooks/useOfflineSync';
import useNotifications from '../hooks/useNotifications';
import { subscribe as subscribeQueue, getPendingCount, isSyncing } from '../services/offlineQueue';
import { syncStatusNotifications, markAllRead } from '../services/notifications';


export default function HomeScreen({ navigation, route }) {
  const isGuest = route.params?.guest === true;

  const leafletRef = useRef(null);
  const [userLocation, setUserLocation]   = useState(null);
  const [userName, setUserName]           = useState('');
  const [isAdmin, setIsAdmin]             = useState(false);
  const [reports, setReports]             = useState([]);
  const [myReports, setMyReports]         = useState([]);
  const [activeFilter, setActiveFilter]   = useState(null);
  const [categories, setCategories]       = useState([]);
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [offline, setOffline]           = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing]           = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const { isConnected } = useOfflineSync();
  const { notifications, unreadCount } = useNotifications();

  useEffect(() => {
    AsyncStorage.multiGet(['userName', 'isAdmin']).then(([[, name], [, admin]]) => {
      if (name) setUserName(name);
      setIsAdmin(admin === '1');
    });
    api.get('/categories')
      .then(res => setCategories(res.data))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!active) return;
      setPendingCount(await getPendingCount());
      setSyncing(isSyncing());
    };
    refresh();
    const unsubscribe = subscribeQueue(refresh);
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation(loc.coords);
      leafletRef.current?.centerOn(loc.coords.latitude, loc.coords.longitude, 14);
    })();
  }, []);

  // Optimistic UI: nuevo reporte desde NewReportScreen
  useEffect(() => {
    const newReport = route.params?.newReport;
    if (!newReport) return;
    setReports(prev =>
      prev.some(r => r.id === newReport.id) ? prev : [newReport, ...prev]
    );
    setMyReports(prev =>
      prev.some(r => r.id === newReport.id) ? prev : [newReport, ...prev]
    );
    navigation.setParams({ newReport: undefined });
  }, [route.params?.newReport]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let timer = null;
      let failures = 0;
      const fetchReports = async () => {
        try {
          const requests = [api.get('/reports'), api.get('/reports/heatmap')];
          if (!isGuest) requests.push(api.get('/user/reports'));

          const [allRes, heatRes, myRes] = await Promise.all(requests);
          if (!active) return;

          setReports(prev => {
            const next = allRes.data;
            return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
          });
          setHeatmapPoints(heatRes.data.map(p => ({
            latitude: parseFloat(p.latitude),
            longitude: parseFloat(p.longitude),
            weight: p.count ?? 1,
          })));
          if (!isGuest && myRes) {
            setMyReports(prev => {
              const next = myRes.data;
              return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
            });
            syncStatusNotifications(myRes.data).catch(() => {});
          }
          failures = 0;
          setOffline(false);
        } catch {
          // Un fallo aislado se ignora; dos seguidos indican que los datos mostrados están desactualizados
          failures += 1;
          if (active && failures >= 2) setOffline(true);
        }
        if (active) timer = setTimeout(fetchReports, 5000);
      };

      fetchReports();
      return () => { active = false; clearTimeout(timer); };
    }, [isGuest])
  );

  const handleLogout = () => {
    if (isGuest) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return;
    }
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          try { await api.post('/logout'); } catch {}
          await AsyncStorage.multiRemove(['token', 'userName', 'userId', 'isAdmin']);
          clearAuthToken();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const handleGuestBlock = (action) => {
    Alert.alert(
      'Inicia sesión',
      `Para ${action} necesitas una cuenta.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Iniciar sesión', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) },
      ]
    );
  };

  const pendientes = myReports.filter(r => r.status?.toLowerCase() === 'pendiente').length;
  const resueltos  = myReports.filter(r => r.status?.toLowerCase() === 'resuelto').length;

  const visibleReports = activeFilter
    ? reports.filter(r => r.category?.name === activeFilter)
    : reports;

  const offlineBanner = !isConnected
    ? { icon: 'cloud-offline-outline', text: 'Sin conexión: los datos pueden estar desactualizados' }
    : syncing
      ? { icon: 'cloud-upload-outline', text: 'Sincronizando reportes pendientes…' }
      : pendingCount > 0
        ? { icon: 'cloud-upload-outline', text: `${pendingCount} reporte${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''} de sincronizar` }
        : offline
          ? { icon: 'cloud-offline-outline', text: 'Sin conexión: los datos pueden estar desactualizados' }
          : null;

  return (
    <View style={styles.container}>
      {offlineBanner && (
        <View style={styles.offlineBanner}>
          <Ionicons name={offlineBanner.icon} size={16} color="#fff" />
          <Text style={styles.offlineText}>{offlineBanner.text}</Text>
        </View>
      )}
      <LeafletMap
        ref={leafletRef}
        reports={visibleReports}
        heat={heatmapPoints}
        userLocation={userLocation}
        onSelectReport={(reportId) => navigation.navigate('DetalleReporte', { reportId })}
      />

      {/* Greeting card */}
      <View style={styles.greetingCard}>
        <View style={styles.greetingBody}>
          <Text style={styles.greetingTitle}>
            {isGuest ? '¡Bienvenido!' : (userName ? `¡Bienvenido, ${userName.split(' ')[0]}!` : '¡Bienvenido!')}
          </Text>
          {isGuest ? (
            <TouchableOpacity onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}>
              <Text style={styles.greetingGuestLink}>Inicia sesión para reportar →</Text>
            </TouchableOpacity>
          ) : myReports.length > 0 ? (
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <View style={[styles.badgeDot, { backgroundColor: '#f59e0b' }]} />
                <Text style={styles.badgeText}>{pendientes} pendiente{pendientes !== 1 ? 's' : ''}</Text>
              </View>
              <Text style={styles.badgeSep}>·</Text>
              <View style={styles.badge}>
                <View style={[styles.badgeDot, { backgroundColor: '#16a34a' }]} />
                <Text style={styles.badgeText}>{resueltos} resuelto{resueltos !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.greetingSubtitle}>Reporta incidencias ambientales en tu zona</Text>
          )}
        </View>
        {isAdmin && (
          <TouchableOpacity
            style={styles.bell}
            testID="admin-button"
            onPress={() => navigation.navigate('AdminReports')}
          >
            <Ionicons name="shield-checkmark-outline" size={22} color="#0e7490" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.bell}
          testID="notifications-button"
          onPress={() => { markAllRead(); setShowNotifications(true); }}
        >
          <Ionicons name="notifications-outline" size={22} color="#0e7490" />
          {unreadCount > 0 && (
            <View style={styles.bellBadge} testID="notifications-badge">
              <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Filtros de categoría */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
          <TouchableOpacity
            style={[styles.chip, !activeFilter && styles.chipActive]}
            onPress={() => setActiveFilter(null)}
          >
            <Text style={[styles.chipText, !activeFilter && styles.chipTextActive]}>Todos</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, activeFilter === cat.name && styles.chipActive]}
              onPress={() => setActiveFilter(activeFilter === cat.name ? null : cat.name)}
            >
              <Text style={[styles.chipText, activeFilter === cat.name && styles.chipTextActive]}>
                {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {userLocation && (
        <TouchableOpacity
          style={styles.locationButton}
          onPress={() => leafletRef.current?.centerOn(userLocation.latitude, userLocation.longitude, 15)}
        >
          <Ionicons name="locate" size={22} color="#0e7490" />
        </TouchableOpacity>
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.barButton}
          onPress={() => isGuest ? handleGuestBlock('ver tus reportes') : navigation.navigate('MyReports')}
        >
          <Ionicons name="document-text-outline" size={24} color={isGuest ? '#d1d5db' : '#6b7280'} />
          <Text style={[styles.barLabel, isGuest && { color: '#d1d5db' }]}>Mis Reportes</Text>
        </TouchableOpacity>

        <View style={styles.fabWrapper}>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => isGuest ? handleGuestBlock('crear un reporte') : navigation.navigate('NewReport')}
          >
            <Ionicons name="add" size={36} color="white" />
          </TouchableOpacity>
          <Text style={styles.fabLabel}>Crear Reporte</Text>
        </View>

        <TouchableOpacity style={styles.barButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#6b7280" />
          <Text style={styles.barLabel}>{isGuest ? 'Ingresar' : 'Salir'}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showNotifications}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.notifBackdrop}>
          <View style={styles.notifPanel}>
            <Text style={styles.notifPanelTitle}>Novedades</Text>
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              style={styles.notifList}
              renderItem={({ item }) => (
                <View style={styles.notifItem}>
                  <Ionicons name="notifications-outline" size={16} color="#0e7490" />
                  <Text style={styles.notifText}>{item.message}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.notifEmpty}>No tienes novedades.</Text>}
            />
            <TouchableOpacity style={styles.notifClose} onPress={() => setShowNotifications(false)}>
              <Text style={styles.notifCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    position: 'absolute', top: 50, left: 16, right: 16, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#b91c1c', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  offlineText: { color: '#fff', fontSize: 12, fontWeight: '600', flexShrink: 1 },

  container: { flex: 1 },

  greetingCard: {
    position: 'absolute',
    top: 56, left: 16, right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  greetingBody:      { flex: 1 },
  greetingTitle:     { fontSize: 16, fontWeight: 'bold', color: '#0e7490' },
  greetingSubtitle:  { fontSize: 12, color: '#6b7280', marginTop: 2 },
  greetingGuestLink: { fontSize: 12, color: '#0e7490', marginTop: 2, fontWeight: '500' },
  bell:              { padding: 6 },
  bellBadge: {
    position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  bellBadgeText:     { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  badgeRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeDot:  { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 12, color: '#6b7280' },
  badgeSep:  { fontSize: 12, color: '#d1d5db' },

  filtersWrapper: {
    position: 'absolute',
    top: 126, left: 0, right: 0,
  },
  filtersContent:   { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  chipActive:     { backgroundColor: '#0e7490', borderColor: '#0e7490' },
  chipText:       { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: 'white' },

  locationButton: {
    position: 'absolute',
    left: 16, bottom: 160,
    backgroundColor: 'white',
    width: 44, height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 32,
    paddingTop: 20,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  barButton:  { width: 90, alignItems: 'center', gap: 4, marginTop: -20 },
  barLabel:   { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  fabWrapper: { width: 90, alignItems: 'center', gap: 6, marginTop: -36 },
  fab: {
    width: 64, height: 64,
    borderRadius: 32,
    backgroundColor: '#0e7490',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0e7490',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabLabel: { fontSize: 11, color: '#0e7490', fontWeight: '600' },

  markerWrapper:     { alignItems: 'center' },
  markerBubble: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerImage:       { width: '100%', height: '100%' },
  markerPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  markerArrow: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },

  callout: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: 200,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  calloutImage:       { width: '100%', height: 120 },
  calloutBody:        { padding: 10, gap: 3 },
  calloutHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calloutCategory:    { fontSize: 13, fontWeight: 'bold', color: '#0e7490' },
  statusDot:          { width: 8, height: 8, borderRadius: 4 },
  calloutDescription: { fontSize: 12, color: '#374151', lineHeight: 17 },
  calloutUser:        { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  calloutLink:        { fontSize: 11, color: '#0e7490', fontWeight: '600', marginTop: 6 },

  notifBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  notifPanel: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16, maxHeight: '70%',
  },
  notifPanelTitle: { fontSize: 18, fontWeight: 'bold', color: '#0e7490', marginBottom: 12 },
  notifList:       { flexGrow: 0 },
  notifItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  notifText:       { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  notifEmpty:      { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 16 },
  notifClose: {
    marginTop: 12, alignSelf: 'center',
    backgroundColor: '#0e7490', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10,
  },
  notifCloseText:  { color: '#ffffff', fontWeight: '600' },
});
