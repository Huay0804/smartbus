// static/js/maps_osrm.js
// Các helper Leaflet cho SmartBus:
// - `renderRouteMap`: vẽ tuyến theo thứ tự trạm (OSRM + fallback)
// - `renderStopsMap`: chỉ hiển thị marker trạm (không vẽ tuyến)
// - `focusStopOnMap`: zoom tới 1 trạm khi người dùng click trong danh sách

(function () {
  const maps = {}; // cache map instances theo mapId
  const mapStops = {}; // cache marker info theo mapId: [{lat,lng,marker}]

  const DEFAULT_CENTER = [16.047079, 108.206230]; // Đà Nẵng
  const DEFAULT_ZOOM = 12;

  function destroyMap(mapId) {
    if (maps[mapId]) {
      maps[mapId].remove();
      delete maps[mapId];
    }
    if (mapStops[mapId]) {
      delete mapStops[mapId];
    }
  }

  async function callBackendOSRM(latlngs) {
    const res = await fetch("/api/osrm/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coords: latlngs }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "OSRM failed");
    return data; // {distance_m, duration_s, geometry}
  }

  function addMarkers(map, pts) {
    return pts.map((p, idx) => {
      const ll = [p.lat, p.lng];
      const title = `${idx + 1}. ${p.name || "Trạm"}`;
      const addr = p.address || "";
      const marker = L.marker(ll).addTo(map).bindPopup(`<b>${title}</b><br>${addr}`);
      return { lat: p.lat, lng: p.lng, marker };
    });
  }

  function fitBounds(map, latlngs) {
    if (!latlngs.length) return;
    // Tránh zoom quá sát (khó thấy điểm đầu/cuối) và chừa padding để marker không sát mép.
    map.fitBounds(latlngs, { padding: [36, 36], maxZoom: 14 });
  }

  function drawStraightLine(map, latlngs) {
    if (latlngs.length >= 2) L.polyline(latlngs).addTo(map);
  }

  function geoJsonLineToLatLng(geometry) {
    if (!geometry || geometry.type !== "LineString" || !Array.isArray(geometry.coordinates)) return [];
    return geometry.coordinates.map(c => [c[1], c[0]]);
  }

  async function drawRouteOSRM(map, latlngs) {
    if (latlngs.length < 2) return;

    try {
      const data = await callBackendOSRM(latlngs);
      const line = geoJsonLineToLatLng(data.geometry);
      if (line.length) L.polyline(line).addTo(map);
      return;
    } catch (e) {
      console.warn("OSRM full route failed, fallback pairwise:", e.message);
    }

    for (let i = 0; i < latlngs.length - 1; i++) {
      const seg = [latlngs[i], latlngs[i + 1]];
      try {
        const data = await callBackendOSRM(seg);
        const line = geoJsonLineToLatLng(data.geometry);
        if (line.length) L.polyline(line).addTo(map);
        else drawStraightLine(map, seg);
      } catch (e) {
        console.warn("OSRM segment failed, use straight:", e.message);
        drawStraightLine(map, seg);
      }
    }
  }

  // === HÀM CHÍNH ===
  window.renderRouteMap = async function (stops, mapId) {
    if (!window.L) {
      console.error("Leaflet chưa được load: L is undefined");
      return;
    }
    if (!mapId) return;

    // LUÔN reset map để không bị dính marker tuyến cũ
    destroyMap(mapId);

    const map = L.map(mapId);
    maps[mapId] = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const pts = (stops || [])
      .filter(s => s && s.lat != null && s.lng != null)
      .map(s => ({
        lat: Number(s.lat),
        lng: Number(s.lng),
        name: s.name || s.tenTram || "",
        address: s.address || s.diaChi || "",
        order: Number(s.order ?? s.thuTuTrenTuyen ?? 0),
      }))
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    // Không có stop => map sạch + center ĐN
    if (pts.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const markers = addMarkers(map, pts);
    mapStops[mapId] = markers;

    const latlngs = pts.map(p => [p.lat, p.lng]);
    fitBounds(map, latlngs);

    if (latlngs.length >= 2) await drawRouteOSRM(map, latlngs);
  };

  // Chỉ hiển thị marker trạm (không vẽ tuyến OSRM)
  window.renderStopsMap = async function (stops, mapId) {
    if (!window.L) {
      console.error("Leaflet chưa được load: L is undefined");
      return;
    }
    if (!mapId) return;

    destroyMap(mapId);

    const map = L.map(mapId);
    maps[mapId] = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const pts = (stops || [])
      .filter(s => s && s.lat != null && s.lng != null)
      .map(s => ({
        lat: Number(s.lat),
        lng: Number(s.lng),
        name: s.name || s.tenTram || "",
        address: s.address || s.diaChi || "",
        order: Number(s.order ?? s.thuTuTrenTuyen ?? 0),
      }))
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (!pts.length) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const markers = addMarkers(map, pts);
    mapStops[mapId] = markers;

    const latlngs = pts.map(p => [p.lat, p.lng]);
    fitBounds(map, latlngs);
  };

  // Zoom vào một tọa độ/marker trên map nếu có
  window.focusStopOnMap = function (mapId, lat, lng, zoom = 16) {
    if (!maps[mapId] || lat == null || lng == null) return;
    const map = maps[mapId];
    const targetZoom = Math.max(map.getZoom() || 0, Math.min(Number(zoom) || 16, 18));
    const markerEntry = (mapStops[mapId] || []).find(
      (m) => Math.abs(m.lat - lat) < 1e-6 && Math.abs(m.lng - lng) < 1e-6
    );
    map.flyTo([lat, lng], targetZoom, { duration: 0.35 });
    if (markerEntry && markerEntry.marker) {
      markerEntry.marker.openPopup();
    }
  };
})();
