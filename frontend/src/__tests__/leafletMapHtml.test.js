import { HTML, buildPayload, statusColor } from '../components/leafletMapHtml';

describe('leafletMapHtml', () => {
  it('el HTML incluye Leaflet, leaflet.heat y las tiles de Esri', () => {
    expect(HTML).toContain('leaflet@1.9.4');
    expect(HTML).toContain('leaflet.heat');
    expect(HTML).toContain('arcgisonline.com');
  });

  it('el HTML usa el helper post compatible con nativo y web', () => {
    expect(HTML).toContain('ReactNativeWebView');
    expect(HTML).toContain('window.parent.postMessage');
  });

  it('buildPayload mapea los reportes al formato del mapa', () => {
    const payload = buildPayload(
      [{
        id: 1,
        latitude: -41.31,
        longitude: -72.98,
        description: 'Basura',
        category: { name: 'basura' },
        status: 'Pendiente',
        photo_url: null,
        user: { name: 'Ana' },
      }],
      [{ latitude: -41.31, longitude: -72.98, weight: 3 }],
      { latitude: -41.3, longitude: -72.9 }
    );

    expect(payload.type).toBe('update');
    expect(payload.reports[0]).toEqual({
      id: 1,
      latitude: -41.31,
      longitude: -72.98,
      description: 'Basura',
      category: 'basura',
      color: statusColor('Pendiente'),
      photo_url: null,
      user: 'Ana',
    });
    expect(payload.heat).toHaveLength(1);
    expect(payload.userLocation).toEqual({ latitude: -41.3, longitude: -72.9 });
  });

  it('statusColor mapea los estados', () => {
    expect(statusColor('Resuelto')).toBe('#16a34a');
    expect(statusColor('Pendiente')).toBe('#f59e0b');
    expect(statusColor('En Progreso')).toBe('#0e7490');
  });
});
