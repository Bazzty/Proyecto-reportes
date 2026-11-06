import { Dimensions } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import SummaryCard, { resetSummaryPreference } from '../components/admin/SummaryCard';
import Toolbar from '../components/admin/Toolbar';

const SUMMARY = {
  total: 64, pending: 62, new_this_week: 5, avg_validation_hours: 3.5,
  top_zone: { id: 5, name: 'Puerto Montt', count: 20 },
};

const setWidth = (width) => {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });
};

const toolbar = () => (
  <Toolbar
    filtersOpen={false}
    activeFilterCount={0}
    onToggleFilters={() => {}}
    onClear={() => {}}
    selectionMode={false}
    onToggleSelection={() => {}}
    exporting={false}
    onExport={() => {}}
  />
);

describe('responsive del panel admin', () => {
  beforeEach(() => resetSummaryPreference());
  afterEach(() => jest.restoreAllMocks());

  describe('Resumen', () => {
    it('en teléfono arranca colapsado', async () => {
      setWidth(320);
      await render(<SummaryCard summary={SUMMARY} />);
      expect(screen.queryByText('Nuevos esta semana')).toBeNull();
    });

    it('en pantallas anchas arranca expandido', async () => {
      setWidth(768);
      await render(<SummaryCard summary={SUMMARY} />);
      expect(screen.getByText('Nuevos esta semana')).toBeTruthy();
    });
  });

  describe('barra de herramientas', () => {
    it('en teléfono muestra Seleccionar y Exportar solo con ícono, pero accesibles', async () => {
      setWidth(320);
      await render(toolbar());

      expect(screen.queryByText('Seleccionar')).toBeNull();
      expect(screen.queryByText('Exportar')).toBeNull();
      expect(screen.getByLabelText('Seleccionar')).toBeTruthy();
      expect(screen.getByLabelText('Exportar')).toBeTruthy();
      expect(screen.getByText('Filtros')).toBeTruthy();
    });

    it('en pantallas anchas muestra las etiquetas', async () => {
      setWidth(768);
      await render(toolbar());

      expect(screen.getByText('Seleccionar')).toBeTruthy();
      expect(screen.getByText('Exportar')).toBeTruthy();
    });
  });
});
