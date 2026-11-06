import { screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import api from '../services/api';
import { resetSummaryPreference } from '../components/admin/SummaryCard';
import {
  report, validReport, setup, reportsCalls, lastReportsParams, openFilters, SUMMARY,
} from './helpers/adminScreen';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return { useFocusEffect: (cb) => React.useEffect(cb, [cb]) };
});

const ZONES = [{ id: 5, name: 'Puerto Montt' }, { id: 6, name: 'Osorno' }];
const DEFAULT_PARAMS = { validation_status: 'pendiente', page: 1 };

describe('AdminReportsScreen: búsqueda, zona y orden', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSummaryPreference();
  });
  afterEach(() => { jest.useRealTimers(); });

  it('la búsqueda envía search tras 400 ms sin teclear y no antes', async () => {
    jest.useFakeTimers();
    await setup();
    await screen.findByText('Basura en la plaza');
    const callsBefore = reportsCalls().length;

    await fireEvent.changeText(screen.getByPlaceholderText('Buscar reportes'), 'plaza');
    await act(async () => { jest.advanceTimersByTime(399); });
    expect(reportsCalls()).toHaveLength(callsBefore);

    await act(async () => { jest.advanceTimersByTime(1); });
    await waitFor(() => expect(lastReportsParams()).toEqual({ ...DEFAULT_PARAMS, search: 'plaza' }));
    expect(reportsCalls()).toHaveLength(callsBefore + 1);
  });

  it('teclear de nuevo reinicia el debounce y solo se envía el último texto', async () => {
    jest.useFakeTimers();
    await setup();
    await screen.findByText('Basura en la plaza');
    const callsBefore = reportsCalls().length;
    const input = screen.getByPlaceholderText('Buscar reportes');

    await fireEvent.changeText(input, 'pla');
    await act(async () => { jest.advanceTimersByTime(300); });
    await fireEvent.changeText(input, 'plaza');
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(reportsCalls()).toHaveLength(callsBefore);

    await act(async () => { jest.advanceTimersByTime(100); });
    await waitFor(() => expect(reportsCalls()).toHaveLength(callsBefore + 1));
    expect(lastReportsParams().search).toBe('plaza');
  });

  it('el botón de borrar limpia la búsqueda al instante y cuenta como filtro activo', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');
    const input = screen.getByPlaceholderText('Buscar reportes');
    await fireEvent.changeText(input, 'plaza');
    await waitFor(() => expect(lastReportsParams().search).toBe('plaza'));
    expect(screen.getByText('Limpiar')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Borrar búsqueda'));

    expect(input).toHaveDisplayValue('');
    await waitFor(() => expect(lastReportsParams()).toEqual(DEFAULT_PARAMS));
    expect(screen.queryByLabelText('Borrar búsqueda')).toBeNull();
  });

  it('Limpiar reinicia búsqueda, zona y orden', async () => {
    await setup([report()], { zones: ZONES });
    await screen.findByText('Basura en la plaza');
    await fireEvent.changeText(screen.getByPlaceholderText('Buscar reportes'), 'plaza');
    await waitFor(() => expect(lastReportsParams().search).toBe('plaza'));
    await openFilters();
    await fireEvent.press(await screen.findByText('Osorno'));
    await fireEvent.press(screen.getByText('Más confirmados'));
    await waitFor(() => expect(lastReportsParams()).toEqual({
      ...DEFAULT_PARAMS, zone_id: 6, search: 'plaza', sort: 'confirmaciones',
    }));

    await fireEvent.press(screen.getByText('Limpiar'));

    await waitFor(() => expect(lastReportsParams()).toEqual(DEFAULT_PARAMS));
    expect(screen.getByPlaceholderText('Buscar reportes')).toHaveDisplayValue('');
    expect(screen.queryByText('Limpiar')).toBeNull();
  });

  it('el filtro de zona usa /admin/zones y envía zone_id; Todas lo quita', async () => {
    await setup([report()], { zones: ZONES });
    await screen.findByText('Basura en la plaza');
    expect(api.get).toHaveBeenCalledWith('/admin/zones');
    await openFilters();

    await fireEvent.press(await screen.findByText('Puerto Montt'));
    await waitFor(() => expect(lastReportsParams()).toEqual({ ...DEFAULT_PARAMS, zone_id: 5 }));

    // Hay dos chips "Todas" (categoría y zona): el último es el de la zona.
    await fireEvent.press(screen.getAllByText('Todas').at(-1));
    await waitFor(() => expect(lastReportsParams()).toEqual(DEFAULT_PARAMS));
  });

  it('si fallan las zonas la pantalla sigue funcionando sin ese filtro', async () => {
    await setup([report()], { zones: null });

    expect(await screen.findByText('Basura en la plaza')).toBeTruthy();
    await openFilters();
    expect(screen.queryByText('Zona')).toBeNull();
    expect(screen.getByText('Estado')).toBeTruthy();
  });

  it('el orden "Más confirmados" envía sort y volver a "Más recientes" lo omite', async () => {
    await setup();
    await screen.findByText('Basura en la plaza');
    await openFilters();
    expect(screen.getByRole('radio', { name: 'Más recientes', checked: true })).toBeTruthy();

    await fireEvent.press(screen.getByText('Más confirmados'));
    await waitFor(() => expect(lastReportsParams()).toEqual({ ...DEFAULT_PARAMS, sort: 'confirmaciones' }));
    expect(screen.getByRole('radio', { name: 'Más confirmados', checked: true })).toBeTruthy();

    await fireEvent.press(screen.getByText('Más recientes'));
    await waitFor(() => expect(lastReportsParams()).toEqual(DEFAULT_PARAMS));
  });
});

describe('AdminReportsScreen: tarjeta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSummaryPreference();
  });

  it('muestra la pastilla de confirmaciones en plural y en singular', async () => {
    await setup([
      report({ id: 1, description: 'Uno', confirmations_count: 3 }),
      report({ id: 2, description: 'Dos', confirmations_count: 1 }),
      report({ id: 3, description: 'Tres', confirmations_count: 0 }),
    ]);
    await screen.findByText('Uno');

    expect(screen.getByText('3 lo vieron')).toBeTruthy();
    expect(screen.getByText('1 lo vio')).toBeTruthy();
    expect(screen.queryByText(/^0 /)).toBeNull();
    expect(screen.getAllByText('icon:people-outline')).toHaveLength(2);
  });

  it('"Ver en el mapa" vuelve a Home con focusReport', async () => {
    const navigation = await setup([report({ id: 7, latitude: '-41.1', longitude: '-72.9' })]);

    await fireEvent.press(await screen.findByLabelText('Ver en el mapa'));

    expect(navigation.popTo).toHaveBeenCalledWith(
      'Home',
      { focusReport: { id: 7, latitude: '-41.1', longitude: '-72.9' } },
      { merge: true }
    );
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('no ofrece "Ver en el mapa" en reportes rechazados ni sin coordenadas', async () => {
    await setup([
      report({ id: 1, description: 'Rechazado', validation_status: 'rechazado' }),
      report({ id: 2, description: 'Sin coordenadas', latitude: null, longitude: null }),
      report({ id: 3, description: 'Normal' }),
    ]);
    await screen.findByText('Normal');

    expect(screen.getAllByLabelText('Ver en el mapa')).toHaveLength(1);
  });
});

describe('AdminReportsScreen: resumen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSummaryPreference();
  });

  it('muestra los cuatro datos con el formato esperado', async () => {
    await setup();

    expect(await screen.findByText('Resumen')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/admin/reports/summary');
    expect(screen.getByLabelText('Nuevos esta semana: 5')).toBeTruthy();
    expect(screen.getByLabelText('Pendientes de revisión: 62')).toBeTruthy();
    expect(screen.getByLabelText('Validación media: 3,5 h')).toBeTruthy();
    expect(screen.getByLabelText('Zona con más reportes: Puerto Montt (20)')).toBeTruthy();
  });

  it('muestra "—" cuando no hay tiempo medio ni zona', async () => {
    await setup([report()], { summary: { ...SUMMARY, avg_validation_hours: null, top_zone: null } });

    await screen.findByText('Resumen');
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('pasa a días cuando el promedio supera las 48 horas', async () => {
    await setup([report()], { summary: { ...SUMMARY, avg_validation_hours: 72 } });

    expect(await screen.findByText('3 días')).toBeTruthy();
  });

  it('se puede colapsar y la preferencia se recuerda al volver a montar', async () => {
    await setup();
    await fireEvent.press(await screen.findByLabelText('Resumen'));
    expect(screen.queryByText('Puerto Montt (20)')).toBeNull();
    expect(screen.getByLabelText('Resumen')).toHaveProp('accessibilityState', { expanded: false });

    await screen.unmount();
    await setup();
    await screen.findByText('Resumen');
    expect(screen.queryByText('Puerto Montt (20)')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Resumen'));
    expect(screen.getByText('Puerto Montt (20)')).toBeTruthy();
  });

  it('si falla se oculta sin avisos y la lista sigue funcionando', async () => {
    await setup([report()], { summary: null });

    expect(await screen.findByText('Basura en la plaza')).toBeTruthy();
    expect(screen.queryByText('Resumen')).toBeNull();
    expect(screen.queryByLabelText('Resumen')).toBeNull();
  });

  it('se refresca tras una mutación exitosa', async () => {
    jest.useFakeTimers();
    try {
      api.patch.mockResolvedValue({ data: report({ validation_status: 'valido' }) });
      await setup();
      await screen.findByText('Basura en la plaza');
      const summaryCalls = () => api.get.mock.calls.filter(([url]) => url === '/admin/reports/summary').length;
      expect(summaryCalls()).toBe(1);

      await fireEvent.press(screen.getByText('Validar'));
      await act(async () => { jest.advanceTimersByTime(1000); });

      expect(summaryCalls()).toBe(2);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('AdminReportsScreen: historial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSummaryPreference();
  });

  it('el historial está plegado y muestra solo las líneas que existen', async () => {
    await setup([validReport({
      validated_by: { id: 9, name: 'Marta' },
      validated_at: '2026-10-02T10:00:00.000Z',
      auto_validated: false,
      status_updated_by: null,
      status_updated_at: null,
    })], {});
    await screen.findByText('Basura en la plaza');
    // El reporte es válido, pero la pestaña activa es Pendientes: el mock ignora el filtro.
    expect(screen.queryByText(/Creado por/)).toBeNull();

    await fireEvent.press(screen.getByLabelText('Historial'));

    expect(screen.getByText(/^Creado por Ana · /)).toBeTruthy();
    expect(screen.getByText(/^Validado por Marta · /)).toBeTruthy();
    expect(screen.queryByText(/^Rechazado por/)).toBeNull();
    expect(screen.queryByText(/Estado cambiado/)).toBeNull();
    expect(screen.getByLabelText('Historial')).toHaveProp('accessibilityState', { expanded: true });
  });

  it('indica "automáticamente" cuando la validación fue automática', async () => {
    await setup([validReport({ validated_by: null, validated_at: '2026-10-02T10:00:00.000Z', auto_validated: true })]);
    await screen.findByText('Basura en la plaza');

    await fireEvent.press(screen.getByLabelText('Historial'));

    expect(screen.getByText(/^Validado automáticamente · /)).toBeTruthy();
  });

  it('muestra rechazo con motivo y el cambio de estado', async () => {
    await setup([report({
      validation_status: 'rechazado',
      validated_by: { id: 9, name: 'Marta' },
      validated_at: '2026-10-02T10:00:00.000Z',
      rejection_reason: 'Foto poco clara',
      status_updated_by: { id: 3, name: 'Luis' },
      status_updated_at: '2026-10-03T10:00:00.000Z',
    })]);
    await screen.findAllByText('Basura en la plaza');

    await fireEvent.press(screen.getByLabelText('Historial'));

    expect(screen.getByText(/^Rechazado por Marta · .* · Foto poco clara$/)).toBeTruthy();
    expect(screen.getByText(/^Estado cambiado por Luis · /)).toBeTruthy();
  });
});
