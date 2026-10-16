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
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H" crossorigin="anonymous" />
<style>@font-face{font-family:'Ionicons';src:url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@15.1.1/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf');}
html,body,#map{height:100%;margin:0;padding:0;background:#e5e7eb;}
#fallback{display:none;align-items:center;justify-content:center;height:100%;font:14px sans-serif;color:#6b7280;text-align:center;padding:0 24px;}</style>
</head>
<body>
<div id="map"></div>
<div id="fallback">No se pudo cargar el mapa. Revisá tu conexión a internet.</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH" crossorigin="anonymous"></script>
<script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js" integrity="sha384-mFKkGiGvT5vo1fEyGCD3hshDdKmW3wzXW/x+fWriYJArD0R3gawT6lMvLboM22c0" crossorigin="anonymous"></script>
<script>
  function post(obj) {
    var s = JSON.stringify(obj);
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(s); }
    else if (window.parent && window.parent !== window) { window.parent.postMessage(s, '*'); }
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function safeUrl(url) {
    return /^https?:\\/\\//i.test(String(url == null ? '' : url)) ? esc(url) : '';
  }

  if (typeof L === 'undefined') {
    document.getElementById('map').style.display = 'none';
    document.getElementById('fallback').style.display = 'flex';
  } else {
    var map = L.map('map', { zoomControl: false, zoomSnap: 0, scrollWheelZoom: false, doubleClickZoom: false }).setView([-41.31946, -72.98356], 10);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, updateWhenIdle: true, keepBuffer: 6, attribution: 'Tiles &copy; Esri' }).addTo(map);

    var heat = null;
    var markersLayer = L.layerGroup().addTo(map);
    var heatClickLayer = L.layerGroup().addTo(map);
    var userMarker = null;
    var pickable = false;
    var pickMarker = null;

    var zoomRaf = null;
    function smoothZoomTo(targetZoom, anchorPoint) {
      if (zoomRaf) { cancelAnimationFrame(zoomRaf); zoomRaf = null; }
      map._stop();
      var startZoom = map.getZoom();
      var endZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), targetZoom));
      if (Math.abs(endZoom - startZoom) < 0.01) { return; }
      map._moveStart(true, false);
      var startTime = performance.now();
      var dur = 180;
      var viewHalf = map.getSize().divideBy(2);
      function step(now) {
        var t = Math.min(1, (now - startTime) / dur);
        var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        var z = startZoom + (endZoom - startZoom) * ease;
        var center;
        if (anchorPoint) {
          var scale = map.getZoomScale(z);
          var centerOffset = anchorPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale);
          center = map.containerPointToLatLng(viewHalf.add(centerOffset));
        } else {
          center = map.getCenter();
        }
        map._move(center, z, { pinch: true });
        if (t < 1) {
          zoomRaf = requestAnimationFrame(step);
        } else {
          zoomRaf = null;
          map._moveEnd(true);
        }
      }
      zoomRaf = requestAnimationFrame(step);
    }

    map.getContainer().addEventListener('wheel', function (e) {
      e.preventDefault();
      var anchor = map.mouseEventToContainerPoint(e);
      var dir = e.deltaY > 0 ? -1 : 1;
      smoothZoomTo(map.getZoom() + dir * 0.5, anchor);
    }, { passive: false });

    map.on('dblclick', function (e) {
      smoothZoomTo(map.getZoom() + 1, e.containerPoint);
    });

    var heatRedrawScheduled = false;
    function scheduleHeatRedraw() {
      if (heatRedrawScheduled) { return; }
      heatRedrawScheduled = true;
      requestAnimationFrame(function () {
        heatRedrawScheduled = false;
        if (heat && heat._reset) { heat._reset(); }
      });
    }
    map.on('move', scheduleHeatRedraw);

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
            var photo = safeUrl(p.photo_url);
            popup = '<div style="min-width:150px">'
              + (photo ? '<img src="' + photo + '" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:6px;" />' : '')
              + '<div style="font-weight:bold;color:#0e7490">' + esc(p.category || 'Sin categoría') + '</div>'
              + '<div style="font-size:12px;color:#374151;margin:4px 0">' + esc(p.description || '') + '</div>'
              + '<div style="font-size:11px;color:#9ca3af">' + esc(p.user || '') + '</div>'
              + '<a href="#" onclick="select(' + p.reportId + ');return false;" style="color:#0e7490;font-weight:600;font-size:12px">Ver detalle &rarr;</a></div>';
          } else {
            var n = p.count || 0;
            popup = '<div style="min-width:120px">'
              + '<div style="font-weight:bold;color:#0e7490">' + esc(p.zoneName || 'Sin zona') + '</div>'
              + '<div style="font-size:12px;color:#374151;margin-top:4px">' + n + ' reporte' + (n === 1 ? '' : 's') + '</div></div>';
          }
          L.circleMarker([p.latitude, p.longitude], { radius: 14, opacity: 0, fillOpacity: 0 }).bindPopup(popup).addTo(heatClickLayer);
        });
      }

      markersLayer.clearLayers();
      if (data.showMarkers !== false) {
        (data.reports || []).forEach(function (r) {
          var color = r.color || '#0e7490';
          var code = /^[0-9a-fA-F]+$/.test(String(r.iconCode || '')) ? r.iconCode : null;
          var glyph = code
            ? '<span style="font-family:Ionicons;font-size:20px;color:#fff;line-height:1;">&#x' + code + ';</span>'
            : '<span style="font-size:16px;line-height:1;">&#x1F4CD;</span>';
          var icon = L.divIcon({
            className: '',
            html: '<div style="width:36px;height:36px;border:2px solid ' + color + ';border-radius:8px;background:' + color + ';display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.3)">' + glyph + '</div>',
            iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -36],
          });
          var photo = safeUrl(r.photo_url);
          var popup = '<div style="min-width:150px">'
            + (photo ? '<img src="' + photo + '" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:6px;" />' : '')
            + '<div style="font-weight:bold;color:#0e7490">' + esc(r.category || 'Sin categoría') + '</div>'
            + '<div style="font-size:12px;color:#374151;margin:4px 0">' + esc(r.description || '') + '</div>'
            + '<div style="font-size:11px;color:#9ca3af">' + esc(r.user || '') + '</div>'
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
        map.flyTo([data.lat, data.lng], data.zoom || 13, { duration: 0.6 });
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
