import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { HTML, buildPayload } from './leafletMapHtml';

const LeafletMap = forwardRef(function LeafletMap(
  {
    reports = [], heat = [], userLocation = null, showMarkers = true, showHeat = true,
    pickable = false, pickedLocation = null, onSelectReport, onPick, style,
  },
  ref
) {
  const iframeRef = useRef(null);

  const send = (message) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(message), '*');
  };

  useEffect(() => {
    send(buildPayload(reports, heat, userLocation, showMarkers, showHeat, pickable, pickedLocation));
  }, [reports, heat, userLocation, showMarkers, showHeat, pickable, pickedLocation]);

  useImperativeHandle(ref, () => ({
    centerOn: (latitude, longitude, zoom) => send({ type: 'center', lat: latitude, lng: longitude, zoom }),
  }));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return undefined;
    }

    const handleMessage = (event) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'ready') {
          send(buildPayload(reports, heat, userLocation, showMarkers, showHeat, pickable, pickedLocation));
        } else if (message.type === 'select' && onSelectReport) {
          onSelectReport(message.reportId);
        } else if (message.type === 'pick' && onPick) {
          onPick({ latitude: message.latitude, longitude: message.longitude });
        }
      } catch {
        // Mensaje no JSON: se ignora.
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [reports, heat, userLocation, showMarkers, showHeat, pickable, pickedLocation, onSelectReport, onPick]);

  return (
    <View style={[styles.container, style]} testID="leaflet-map">
      <iframe
        ref={iframeRef}
        title="mapa"
        srcDoc={HTML}
        sandbox="allow-scripts allow-popups"
        style={{ border: 0, width: '100%', height: '100%' }}
      />
    </View>
  );
});

export default LeafletMap;

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject },
});
