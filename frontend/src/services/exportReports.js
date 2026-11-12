import { Platform, Share } from 'react-native';
import api from './api';

const pad = (n) => String(n).padStart(2, '0');

// reportes-AAAA-MM-DD.csv con la fecha local.
export const csvFilename = (date = new Date()) =>
  `reportes-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;

// Filas de datos del CSV (sin la cabecera ni el BOM ni líneas vacías). Un salto de línea dentro de
// un campo entre comillas (una descripción de varias líneas) no corta la fila.
export const countCsvRows = (csv) => {
  if (typeof csv !== 'string') return 0;
  const text = csv.replace(/^﻿/, '');
  let rows = 0;
  let inQuotes = false;
  let hasContent = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      hasContent = true;
    } else if (ch === '\n' && !inQuotes) {
      if (hasContent) rows += 1;
      hasContent = false;
    } else if (ch !== '\r' && (inQuotes || ch.trim() !== '')) {
      hasContent = true;
    }
  }
  if (hasContent) rows += 1;
  return Math.max(0, rows - 1);
};

// Web: descarga con un Blob y un enlace temporal. Móvil: hoja de compartir del sistema.
export const deliverCsv = async (csv, filename) => {
  if (Platform.OS === 'web') {
    // El BOM ayuda a Excel con las tildes; la lectura como texto puede haberlo descartado.
    const content = csv.startsWith('\uFEFF') ? csv : `\uFEFF${csv}`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      URL.revokeObjectURL(url);
    }
    return { shared: true };
  }
  const result = await Share.share({ message: csv, title: filename });
  return { shared: result?.action !== Share.dismissedAction };
};

// Pide el CSV con los filtros del listado y lo entrega. Devuelve { empty: true } si no hay filas
// (sin descargar nada), o { empty: false, rows, shared }.
export const exportReports = async (params) => {
  const res = await api.get('/admin/reports/export', { params, responseType: 'text' });
  const csv = typeof res.data === 'string' ? res.data : '';
  const rows = countCsvRows(csv);
  if (rows === 0) return { empty: true, rows: 0, shared: false };
  const { shared } = await deliverCsv(csv, csvFilename());
  return { empty: false, rows, shared };
};
