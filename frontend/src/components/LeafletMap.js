import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { HTML, buildPayload } from './leafletMapHtml';

const LeafletMap = forwardRef(function LeafletMap(
  { reports = [], heat = [], userLocation = null, showMarkers = true, showHeat = true, onSelectReport, style },
  ref
) {
  const webRef = useRef(null);

  const send = (message) => {
    webRef.current?.postMessage(JSON.stringify(message));
  };

  useEffect(() => {
    send(buildPayload(reports, heat, userLocation, showMarkers, showHeat));
  }, [reports, heat, userLocation, showMarkers, showHeat]);

  useImperativeHandle(ref, () => ({
    centerOn: (latitude, longitude, zoom) => send({ type: 'center', lat: latitude, lng: longitude, zoom }),
  }));

  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'ready') {
        send(buildPayload(reports, heat, userLocation, showMarkers, showHeat));
      } else if (message.type === 'select' && onSelectReport) {
        onSelectReport(message.reportId);
      }
    } catch {
      // Mensaje no JSON: se ignora.
    }
  };

  return (
    <WebView
      ref={webRef}
      testID="leaflet-map"
      originWhitelist={['*']}
      source={{ html: HTML }}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
      style={[styles.webview, style]}
    />
  );
});

export default LeafletMap;

const styles = StyleSheet.create({
  webview: { ...StyleSheet.absoluteFillObject, backgroundColor: '#e5e7eb' },
});
