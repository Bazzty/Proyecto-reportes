// Utilidades compartidas por los tests de AdminReportsScreen. Cada archivo de test declara sus
// propios jest.mock (api y navegación); este módulo solo usa el api ya simulado.
import { render, screen, fireEvent } from '@testing-library/react-native';
import AdminReportsScreen from '../../screens/AdminReportsScreen';
import api from '../../services/api';

export const report = (overrides = {}) => ({
  id: 1,
  description: 'Basura en la plaza',
  validation_status: 'pendiente',
  photo_url: null,
  created_at: '2026-10-01T12:00:00.000Z',
  category: { id: 1, name: 'basura' },
  zone: { id: 5, name: 'Puerto Varas' },
  user: { id: 2, name: 'Ana' },
  rejection_reason: null,
  latitude: '-41.4693',
  longitude: '-72.9424',
  confirmations_count: 0,
  ...overrides,
});

export const validReport = (overrides = {}) => report({ validation_status: 'valido', status: 'Pendiente', ...overrides });

export const CATEGORIES = [{ id: 1, name: 'basura' }, { id: 2, name: 'escombros' }];
export const COUNTS = { pendiente: 3, valido: 5, rechazado: 7, total: 15 };
export const SUMMARY = {
  total: 64, pending: 62, new_this_week: 5, avg_validation_hours: 3.5,
  top_zone: { id: 5, name: 'Puerto Montt', count: 20 },
};

// Respuesta paginada del listado.
export const pageOf = (items, counts = COUNTS) => ({
  data: { data: items, meta: { current_page: 1, last_page: 1, per_page: 20, total: items.length, counts } },
});

// Opciones: `items` puede ser un array o una función (config) => array, para cambiar la respuesta
// entre llamadas (`counts` también). `categories`, `zones` y `summary` en null hacen fallar esa petición.
export const mockApi = ({
  items = [report()], categories = CATEGORIES, zones = [], detail = null, counts = COUNTS,
  summary = SUMMARY, exportCsv = 'id\n1\n',
} = {}) => {
  api.get.mockImplementation((url, config) => {
    if (url === '/categories') return categories ? Promise.resolve({ data: categories }) : Promise.reject(new Error('fail'));
    if (url === '/admin/zones') return zones ? Promise.resolve({ data: zones }) : Promise.reject(new Error('fail'));
    if (url === '/admin/reports/summary') return summary ? Promise.resolve({ data: summary }) : Promise.reject(new Error('fail'));
    if (url === '/admin/reports/export') {
      return exportCsv instanceof Error ? Promise.reject(exportCsv) : Promise.resolve({ data: exportCsv });
    }
    if (url.startsWith('/reports/')) return detail ? Promise.resolve({ data: detail }) : Promise.reject(new Error('fail'));
    const rows = typeof items === 'function' ? items(config) : items;
    return Promise.resolve(pageOf(rows, typeof counts === 'function' ? counts(config) : counts));
  });
};

export const makeNavigation = () => ({ navigate: jest.fn(), popTo: jest.fn() });

export const setup = async (items = [report()], { navigation = makeNavigation(), ...options } = {}) => {
  mockApi({ items, ...options });
  await render(<AdminReportsScreen navigation={navigation} />);
  return navigation;
};

export const reportsCalls = () => api.get.mock.calls.filter(([url]) => url === '/admin/reports');
export const lastReportsParams = () => reportsCalls().at(-1)[1].params;
export const openFilters = async () => { await fireEvent.press(await screen.findByText('Filtros')); };

// Deja la pantalla en el filtro Válidos, donde se gestiona el estado.
export const setupValid = async (items = [validReport()], options) => {
  const navigation = await setup(items, options);
  await fireEvent.press(await screen.findByText('Válidos'));
  await screen.findAllByText('Basura en la plaza');
  return navigation;
};
