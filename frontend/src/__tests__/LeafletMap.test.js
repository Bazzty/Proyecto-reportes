import { createRef } from 'react';
import { render, waitFor } from '@testing-library/react-native';
import LeafletMap from '../components/LeafletMap';

let mockWebViewProps = {};
const mockPostMessage = jest.fn();

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const WebView = React.forwardRef(function WebView(props, ref) {
    mockWebViewProps = props;
    React.useImperativeHandle(ref, () => ({ postMessage: mockPostMessage }));
    return <View testID="webview" />;
  });
  return { __esModule: true, WebView };
});

const REPORTS = [
  {
    id: 1,
    latitude: -41.31,
    longitude: -72.98,
    description: 'Basura',
    category: { name: 'basura' },
    status: 'Pendiente',
    photo_url: null,
    user: { name: 'Ana' },
  },
];
const HEAT = [{ latitude: -41.31, longitude: -72.98, weight: 3 }];

describe('LeafletMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWebViewProps = {};
  });

  it('carga el HTML con Leaflet y tiles del proveedor', async () => {
    await render(<LeafletMap reports={REPORTS} heat={HEAT} />);

    expect(mockWebViewProps.source.html).toContain('leaflet');
    expect(mockWebViewProps.source.html).toContain('arcgisonline.com');
  });

  it('al recibir "ready" envía los reportes y el heat', async () => {
    await render(<LeafletMap reports={REPORTS} heat={HEAT} />);

    mockWebViewProps.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'ready' }) } });

    await waitFor(() => expect(mockPostMessage).toHaveBeenCalled());
    const sent = JSON.parse(mockPostMessage.mock.calls.at(-1)[0]);
    expect(sent.type).toBe('update');
    expect(sent.reports[0].id).toBe(1);
    expect(sent.reports[0].category).toBe('basura');
    expect(sent.heat).toEqual(HEAT);
  });

  it('avisa al tocar un marcador (select)', async () => {
    const onSelectReport = jest.fn();
    await render(<LeafletMap reports={REPORTS} onSelectReport={onSelectReport} />);

    mockWebViewProps.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'select', reportId: 1 }) } });

    expect(onSelectReport).toHaveBeenCalledWith(1);
  });

  it('avisa al elegir un punto en el mapa (pick)', async () => {
    const onPick = jest.fn();
    await render(<LeafletMap reports={REPORTS} pickable onPick={onPick} />);

    mockWebViewProps.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'pick', latitude: -41.5, longitude: -73.1 }) } });

    expect(onPick).toHaveBeenCalledWith({ latitude: -41.5, longitude: -73.1 });
  });

  it('centerOn envía el mensaje de centrado', async () => {
    const ref = createRef();
    await render(<LeafletMap ref={ref} reports={REPORTS} />);

    ref.current.centerOn(-41.3, -72.9, 14);

    expect(mockPostMessage).toHaveBeenCalledWith(
      JSON.stringify({ type: 'center', lat: -41.3, lng: -72.9, zoom: 14 })
    );
  });
});
