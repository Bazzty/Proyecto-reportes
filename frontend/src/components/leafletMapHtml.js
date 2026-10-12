export const statusColor = (status) => {
  if (!status) return '#0e7490';
  const s = status.toLowerCase();
  if (s === 'resuelto') return '#16a34a';
  if (s === 'pendiente') return '#f59e0b';
  return '#0e7490';
};

export const buildPayload = (
  reports = [],
  heat = [],
  userLocation = null,
  showMarkers = true,
  showHeat = true,
  pickable = false,
  pickedLocation = null
) => ({
  type: 'update',
  reports: reports.map(r => ({
    id: r.id,
    latitude: r.latitude,
    longitude: r.longitude,
    description: r.description,
    category: r.category?.name ?? null,
    color: statusColor(r.status),
    photo_url: r.photo_url ?? null,
    user: r.user?.name ?? null,
    iconCode: r.iconCode ?? null,
  })),
  heat,
  userLocation,
  showMarkers,
  showHeat,
  pickable,
  pickedLocation,
});

export const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>@font-face{font-family:'Ionicons';src:url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@15.1.1/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf');}
html,body,#map{height:100%;margin:0;padding:0;background:#e5e7eb;}
#fallback{display:none;align-items:center;justify-content:center;height:100%;font:14px sans-serif;color:#6b7280;text-align:center;padding:0 24px;}</style>
</head>
<body>
<div id="map"></div>
<div id="fallback">No se pudo cargar el mapa. Revisá tu conexión a internet.</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
<script>
  function post(obj) {
    var s = JSON.stringify(obj);
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(s); }
    else if (window.parent && window.parent !== window) { window.parent.postMessage(s, '*'); }
  }

  if (typeof L === 'undefined') {
    document.getElementById('map').style.display = 'none';
    document.getElementById('fallback').style.display = 'flex';
  } else {
    var map = L.map('map', { zoomControl: false }).setView([-41.31946, -72.98356], 10);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri' }).addTo(map);

    var heat = null;
    var markersLayer = L.layerGroup().addTo(map);
    var heatClickLayer = L.layerGroup().addTo(map);
    var userMarker = null;
    var pickable = false;
    var pickMarker = null;

    map.on('click', function (e) {
      if (!pickable) { return; }
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;
      if (pickMarker) { map.removeLayer(pickMarker); }
      pickMarker = L.marker([lat, lng]).addTo(map);
      post({ type: 'pick', latitude: lat, longitude: lng });
    });

    function select(id) {
      post({ type: 'select', reportId: id });
    }

    function render(data) {
      if (heat) { map.removeLayer(heat); heat = null; }
      heatClickLayer.clearLayers();
      if (data.showHeat !== false && data.heat && data.heat.length) {
        if (L.heatLayer) {
          heat = L.heatLayer(data.heat.map(function (p) { return [p.latitude, p.longitude, p.weight || 1]; }), { radius: 35, blur: 25, maxZoom: 12 });
          heat.addTo(map);
        }
        data.heat.forEach(function (p) {
          var popup;
          if (p.reportId != null) {
            popup = '<div style="min-width:150px">'
              + (p.photo_url ? '<img src="' + p.photo_url + '" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:6px;" />' : '')
              + '<div style="font-weight:bold;color:#0e7490">' + (p.category || 'Sin categoría') + '</div>'
              + '<div style="font-size:12px;color:#374151;margin:4px 0">' + (p.description || '') + '</div>'
              + '<div style="font-size:11px;color:#9ca3af">' + (p.user || '') + '</div>'
              + '<a href="#" onclick="select(' + p.reportId + ');return false;" style="color:#0e7490;font-weight:600;font-size:12px">Ver detalle &rarr;</a></div>';
          } else {
            var n = p.count || 0;
            popup = '<div style="min-width:120px">'
              + '<div style="font-weight:bold;color:#0e7490">' + (p.zoneName || 'Sin zona') + '</div>'
              + '<div style="font-size:12px;color:#374151;margin-top:4px">' + n + ' reporte' + (n === 1 ? '' : 's') + '</div></div>';
          }
          L.circleMarker([p.latitude, p.longitude], { radius: 14, opacity: 0, fillOpacity: 0 }).bindPopup(popup).addTo(heatClickLayer);
        });
      }

      markersLayer.clearLayers();
      if (data.showMarkers !== false) {
        (data.reports || []).forEach(function (r) {
          var color = r.color || '#0e7490';
          var glyph = r.iconCode
            ? '<span style="font-family:Ionicons;font-size:20px;color:#fff;line-height:1;">&#x' + r.iconCode + ';</span>'
            : '<span style="font-size:16px;line-height:1;">&#x1F4CD;</span>';
          var icon = L.divIcon({
            className: '',
            html: '<div style="width:36px;height:36px;border:2px solid ' + color + ';border-radius:8px;background:' + color + ';display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.3)">' + glyph + '</div>',
            iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -36],
          });
          var popup = '<div style="min-width:150px">'
            + (r.photo_url ? '<img src="' + r.photo_url + '" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:6px;" />' : '')
            + '<div style="font-weight:bold;color:#0e7490">' + (r.category || 'Sin categoría') + '</div>'
            + '<div style="font-size:12px;color:#374151;margin:4px 0">' + (r.description || '') + '</div>'
            + '<div style="font-size:11px;color:#9ca3af">' + (r.user || '') + '</div>'
            + '<a href="#" onclick="select(' + r.id + ');return false;" style="color:#0e7490;font-weight:600;font-size:12px">Ver detalle &rarr;</a></div>';
          L.marker([r.latitude, r.longitude], { icon: icon }).bindPopup(popup).addTo(markersLayer);
        });
      }

      if (data.userLocation) {
        if (userMarker) { map.removeLayer(userMarker); }
        userMarker = L.circleMarker([data.userLocation.latitude, data.userLocation.longitude], { radius: 7, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 });
        userMarker.addTo(map);
      }

      pickable = data.pickable === true;
      map.getContainer().style.cursor = pickable ? 'crosshair' : '';

      if (data.pickedLocation) {
        if (pickMarker) { map.removeLayer(pickMarker); }
        pickMarker = L.marker([data.pickedLocation.latitude, data.pickedLocation.longitude]).addTo(map);
      } else if (pickMarker) {
        map.removeLayer(pickMarker);
        pickMarker = null;
      }
    }

    function center(data) {
      if (data.lat != null && data.lng != null) {
        map.setView([data.lat, data.lng], data.zoom || 13);
      }
    }

    function onMessage(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'update') { render(msg); }
        else if (msg.type === 'center') { center(msg); }
      } catch (err) {}
    }
    window.addEventListener('message', onMessage);
    document.addEventListener('message', onMessage);

    post({ type: 'ready' });
  }
</script>
</body>
</html>`;
