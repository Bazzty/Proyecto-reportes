import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Heatmap } from 'react-native-maps';
import axios from 'axios';


const IP_COMPUTADORA = '192.168.1.87'; 
const API_URL = `http://${IP_COMPUTADORA}:8000/api`;

// Tarea 1: Región geográfica fija centrada en el Lago Llanquihue
export const LAGO_LLANQUIHUE_REGION = {
  latitude: -41.1350,
  longitude: -72.8900,
  latitudeDelta: 0.45,
  longitudeDelta: 0.45,
};

// Mapeo de colores oficiales según categorías del proyecto
export const CATEGORY_COLORS = {
  'basura': '#E6A100',
  'escombros': '#7F8C8D',
  'aguas': '#007AFF',
  'otro': '#9B59B6',
};

// Datos locales de respaldo por si el servidor backend está apagado
export const PLACEHOLDER_REPORTS = [
  { 
    id: 1, 
    description: "Acumulación de residuos plásticos en la costanera", 
    latitude: -41.3195, 
    longitude: -72.9854, 
    category: { name: "basura" } 
  },
  { 
    id: 2, 
    description: "Descarga sospechosa cerca del muelle", 
    latitude: -41.1255, 
    longitude: -73.0375, 
    category: { name: "aguas" } 
  }
];