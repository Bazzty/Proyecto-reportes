import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import MapView, { Marker, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { clearAuthToken } from '../services/api';

const CATEGORIES = ['Basura', 'Escombros', 'Aguas', 'Otro'];

const statusColor = (status) => {
  if (!status) return '#0e7490';
  const s = status.toLowerCase();
  if (s === 'resuelto') return '#16a34a';
  if (s === 'pendiente') return '#f59e0b';
  return '#0e7490';
};

export default function HomeScreen({ navigation, route }) {
  const mapRef = useRef(null);
  const [userLocation, setUserLocation] = useState(null);
  const [reports, setReports]           = useState([]);
  const [myReports, setMyReports]       = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation(loc.coords);
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
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
  }, [route.params?.newReport]);

  useFocusEffect(
    useCallback(() => {
      const fetchReports = async () => {
        try {
          const [allRes, myRes] = await Promise.all([
            api.get('/reports'),
            api.get('/user/reports'),
          ]);
          // Solo actualiza estado si los datos cambiaron
          setReports(prev => {
            const next = allRes.data;
            return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
          });
          setMyReports(prev => {
            const next = myRes.data;
            return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
          });
        } catch {}
      };

      fetchReports();
      const interval = setInterval(fetchReports, 5000);
      return () => clearInterval(interval);
    }, [])
  );

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          try { await api.post('/logout'); } catch {}
          await AsyncStorage.removeItem('token');
          clearAuthToken();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const pendientes = myReports.filter(r => r.status?.toLowerCase() === 'pendiente').length;
  const resueltos  = myReports.filter(r => r.status?.toLowerCase() === 'resuelto').length;

  const visibleReports = activeFilter
    ? reports.filter(r => r.category?.name?.toLowerCase() === activeFilter.toLowerCase())
    : reports;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        initialRegion={{
          latitude: -41.31946,
          longitude: -72.98356,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        {visibleReports.map(report => {
          const color = statusColor(report.status);
          return (
            <Marker
              key={report.id}
              identifier={String(report.id)}
              coordinate={{ latitude: report.latitude, longitude: report.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              recyclingKey={`report-${report.id}`}
            >
              <View style={styles.markerWrapper}>
                <View style={[styles.markerBubble, { borderColor: color }]}>
                  {report.photo_url ? (
                    <Image
                      source={report.photo_url}
                      style={styles.markerImage}
                      contentFit="cover"
                      cachePolicy="disk"
                      transition={150}
                    />
                  ) : (
                    <View style={[styles.markerPlaceholder, { backgroundColor: color }]}>
                      <Ionicons name="leaf" size={16} color="white" />
                    </View>
                  )}
                </View>
                <View style={[styles.markerArrow, { borderTopColor: color }]} />
              </View>
              <Callout tooltip>
                <View style={styles.callout}>
                  {report.photo_url && (
                    <Image
                      source={report.photo_url}
                      style={styles.calloutImage}
                      contentFit="cover"
                      cachePolicy="disk"
                    />
                  )}
                  <View style={styles.calloutBody}>
                    <View style={styles.calloutHeader}>
                      <Text style={styles.calloutCategory}>
                        {report.category?.name ?? 'Sin categoría'}
                      </Text>
                      <View style={[styles.statusDot, { backgroundColor: color }]} />
                    </View>
                    <Text style={styles.calloutDescription} numberOfLines={2}>
                      {report.description}
                    </Text>
                    <Text style={styles.calloutUser}>📍 {report.user?.name}</Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Greeting card */}
      <View style={styles.greetingCard}>
        <Text style={styles.greetingTitle}>¡Bienvenido!</Text>
        {myReports.length > 0 ? (
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

      {/* Filtros de categoría */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
          <TouchableOpacity
            style={[styles.chip, !activeFilter && styles.chipActive]}
            onPress={() => setActiveFilter(null)}
          >
            <Text style={[styles.chipText, !activeFilter && styles.chipTextActive]}>Todos</Text>
          </TouchableOpacity>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, activeFilter === cat && styles.chipActive]}
              onPress={() => setActiveFilter(activeFilter === cat ? null : cat)}
            >
              <Text style={[styles.chipText, activeFilter === cat && styles.chipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {userLocation && (
        <TouchableOpacity
          style={styles.locationButton}
          onPress={() => mapRef.current?.animateToRegion({
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }, 800)}
        >
          <Ionicons name="locate" size={22} color="#0e7490" />
        </TouchableOpacity>
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.barButton}
          onPress={() => navigation.navigate('MyReports')}
        >
          <Ionicons name="document-text-outline" size={24} color="#6b7280" />
          <Text style={styles.barLabel}>Mis Reportes</Text>
        </TouchableOpacity>

        <View style={styles.fabWrapper}>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('NewReport')}
          >
            <Ionicons name="add" size={36} color="white" />
          </TouchableOpacity>
          <Text style={styles.fabLabel}>Crear Reporte</Text>
        </View>

        <TouchableOpacity style={styles.barButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#6b7280" />
          <Text style={styles.barLabel}>Salir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  greetingCard: {
    position: 'absolute',
    top: 56, left: 16, right: 16,
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
  greetingTitle:    { fontSize: 16, fontWeight: 'bold', color: '#0e7490' },
  greetingSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
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
});
