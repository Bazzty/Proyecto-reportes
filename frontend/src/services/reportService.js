import api from './api';

export const getReports = async () => {
  const response = await api.get('/reports');
  return response.data;
};

// Trae solo coordenadas GPS para el mapa
export const getHeatmapPoints = async () => {
  const response = await api.get('/reports/heatmap');
  return response.data;
};

// Trae el detalle de un solo reporte
export const getReportById = async (id) => {
  const response = await api.get(`/reports/${id}`);
  return response.data;
};
