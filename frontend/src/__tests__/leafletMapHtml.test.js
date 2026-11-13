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

  it('valida el origen de los mensajes del padre y fija el targetOrigin', () => {
    expect(HTML).toContain('var PARENT_ORIGIN');
    expect(HTML).toContain('e.source !== window.parent');
    expect(HTML).toContain('e.origin !== PARENT_ORIGIN');
    expect(HTML).toContain("PARENT_ORIGIN === '__PARENT_ORIGIN__' ? '*' : PARENT_ORIGIN");
  });

  it('buildPayload marca como pendientes los reportes aún sin validar', () => {
    const payload = buildPayload(
      [
        { id: 1, latitude: 0, longitude: 0, status: 'Pendiente', validation_status: 'pendiente' },
        { id: 2, latitude: 0, longitude: 0, status: 'Pendiente', validation_status: 'valido' },
      ],
      [],
      null
    );
    expect(payload.reports.map(r => r.pending)).toEqual([true, false]);
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
      iconCode: null,
      pending: false,
    });
    expect(payload.heat).toHaveLength(1);
    expect(payload.userLocation).toEqual({ latitude: -41.3, longitude: -72.9 });
    expect(payload.showMarkers).toBe(true);
    expect(payload.showHeat).toBe(true);
  });

  it('buildPayload incluye los flags de visibilidad', () => {
    const payload = buildPayload([], [], null, false, true);

    expect(payload.showMarkers).toBe(false);
    expect(payload.showHeat).toBe(true);
  });

  it('buildPayload incluye pickable y pickedLocation', () => {
    const payload = buildPayload([], [], null, true, true, true, { latitude: -41.5, longitude: -73.1 });

    expect(payload.pickable).toBe(true);
    expect(payload.pickedLocation).toEqual({ latitude: -41.5, longitude: -73.1 });
  });

  it('el HTML permite elegir un punto en el mapa', () => {
    expect(HTML).toContain("map.on('click'");
    expect(HTML).toContain("type: 'pick'");
  });

  it('buildPayload incluye el iconCode del reporte', () => {
    const payload = buildPayload([{
      id: 1, latitude: -41, longitude: -72, description: 'x',
      category: { name: 'basura' }, status: 'Pendiente', photo_url: null, user: { name: 'A' }, iconCode: 'f5f6',
    }]);

    expect(payload.reports[0].iconCode).toBe('f5f6');
  });

  it('el HTML carga la fuente Ionicons y agrega popups clicleables al heat', () => {
    expect(HTML).toContain("font-family:'Ionicons'");
    expect(HTML).toContain('Ionicons.ttf');
    expect(HTML).toContain('heatClickLayer');
  });

  it('usa zoom propio y redibuja el heat en move', () => {
    expect(HTML).toContain('zoomSnap: 0');
    expect(HTML).toContain('scrollWheelZoom: false');
    expect(HTML).toContain('smoothZoomTo');
    expect(HTML).toContain("addEventListener('wheel'");
    expect(HTML).toContain("map.on('move'");
  });

  it('evita el flash de tiles animando como pinch (sin podar tiles)', () => {
    expect(HTML).toContain('updateWhenIdle: true');
    expect(HTML).toContain('pinch: true');
  });

  it('escapa el HTML de los popups (esc/safeUrl) para evitar XSS', () => {
    expect(HTML).toContain('function esc(value)');
    expect(HTML).toContain('function safeUrl(url)');
    expect(HTML).toContain('esc(r.description');
    expect(HTML).toContain('safeUrl(r.photo_url)');
  });

  it('statusColor mapea los estados', () => {
    expect(statusColor('Resuelto')).toBe('#16a34a');
    expect(statusColor('Pendiente')).toBe('#f59e0b');
    expect(statusColor('En Progreso')).toBe('#0e7490');
  });
});

describe('popups bajo los controles superpuestos', () => {
  it('buildPayload incluye topInset (0 por defecto)', () => {
    expect(buildPayload().topInset).toBe(0);
    expect(buildPayload([], [], null, true, true, false, null, 230).topInset).toBe(230);
  });

  it('los popups usan el topInset como margen al desplazar el mapa', () => {
    expect(HTML).toContain('popupTopInset = Math.max(0, Number(data.topInset) || 0)');
    expect(HTML).toContain('autoPanPaddingTopLeft: L.point(12, popupTopInset + 12)');
    expect(HTML).not.toContain('.bindPopup(popup)');
  });
});
