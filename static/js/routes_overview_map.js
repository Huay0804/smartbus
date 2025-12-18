// static/js/routes_overview_map.js
// Bản đồ tổng quan ở /routes:
// vẽ tuyến đang chọn dựa trên 2 điểm đầu/cuối (OSRM nếu có, fallback đường thẳng).

(function () {
  const DEFAULT_CENTER = [16.047079, 108.206230];
  const DEFAULT_ZOOM = 12;
  const FIT_PADDING = [56, 56];
  const FIT_MAX_ZOOM = 13;

  let map = null;
  let routeLayer = null;
  let startMarker = null;
  let endMarker = null;
  let requestSeq = 0;

  function invalidateSoon() {
    if (!map) return;
    requestAnimationFrame(() => {
      try {
        map.invalidateSize(true);
      } catch (_) {}
    });
  }

  function ensureMap(mapId) {
    if (map) return map;
    const el = document.getElementById(mapId);
    if (!el || !window.L) return null;

    map = L.map(mapId, { zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    invalidateSoon();
    return map;
  }

  function clearLayers() {
    if (!map) return;
    if (routeLayer) {
      routeLayer.remove();
      routeLayer = null;
    }
    if (startMarker) {
      startMarker.remove();
      startMarker = null;
    }
    if (endMarker) {
      endMarker.remove();
      endMarker = null;
    }
  }

  function setStatus(msg, variant = "secondary") {
    const el = document.getElementById("overviewMapStatus");
    if (!el) return;
    if (!msg) {
      el.classList.add("d-none");
      el.textContent = "";
      return;
    }
    el.className = `alert alert-${variant} py-2 px-3 mt-2`;
    el.textContent = msg;
  }

  async function fetchEndpoints(routeId) {
    const res = await fetch(`/api/routes/${routeId}/endpoints`);
    const data = await res.json();
    return { res, data };
  }

  async function fetchOsrmLine(a, b) {
    const res = await fetch("/api/osrm/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coords: [[a.lat, a.lng], [b.lat, b.lng]] }),
    });
    const data = await res.json();
    return { res, data };
  }

  function geoJsonLineToLatLng(geometry) {
    if (!geometry || geometry.type !== "LineString" || !Array.isArray(geometry.coordinates)) return [];
    return geometry.coordinates.map((c) => [c[1], c[0]]);
  }

  function drawStraight(a, b) {
    return L.polyline(
      [
        [a.lat, a.lng],
        [b.lat, b.lng],
      ],
      { color: "#0d6efd", weight: 4, opacity: 0.9 }
    );
  }

  function endpointIcon(kind, label) {
    const cls = kind === "start" ? "sb-endpoint sb-endpoint--start" : "sb-endpoint sb-endpoint--end";
    return L.divIcon({
      className: "",
      html: `<div class="${cls}">${label}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -12],
    });
  }

  function addMarkers(a, b) {
    startMarker = L.marker([a.lat, a.lng], { icon: endpointIcon("start", "A"), riseOnHover: true })
      .addTo(map)
      .bindPopup(`<b>Điểm đầu</b><br>${a.name || ""}`);

    endMarker = L.marker([b.lat, b.lng], { icon: endpointIcon("end", "B"), riseOnHover: true })
      .addTo(map)
      .bindPopup(`<b>Điểm cuối</b><br>${b.name || ""}`);
  }

  function fitAll() {
    if (!map) return;

    const layers = [];
    if (routeLayer) layers.push(routeLayer);
    if (startMarker) layers.push(startMarker);
    if (endMarker) layers.push(endMarker);

    if (!layers.length) return;

    try {
      const group = L.featureGroup(layers);
      const b = group.getBounds();
      if (b && b.isValid()) {
        map.fitBounds(b, { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM, animate: true, duration: 0.35 });
        return;
      }
    } catch (_) {}

    if (startMarker && endMarker) {
      map.fitBounds([startMarker.getLatLng(), endMarker.getLatLng()], { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM });
    } else if (startMarker) {
      map.setView(startMarker.getLatLng(), Math.min(15, FIT_MAX_ZOOM));
    } else if (endMarker) {
      map.setView(endMarker.getLatLng(), Math.min(15, FIT_MAX_ZOOM));
    }
  }

  async function setRoute(routeId, mapId = "routes-overview-map") {
    const m = ensureMap(mapId);
    if (!m) return;
    invalidateSoon();

    requestSeq += 1;
    const seq = requestSeq;

    clearLayers();
    setStatus("Đang tải tuyến…", "info");

    try {
      const { res: epRes, data: ep } = await fetchEndpoints(routeId);
      if (seq !== requestSeq) return;

      if (!epRes.ok || !ep.ok) {
        setStatus(ep?.error || "Không đủ dữ liệu để vẽ tuyến.", "warning");
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        return;
      }

      const a = ep.start;
      const b = ep.end;

      addMarkers(a, b);

      const { res: osrmRes, data: osrm } = await fetchOsrmLine(a, b);
      if (seq !== requestSeq) return;

      if (osrmRes.ok && osrm.ok && osrm.geometry) {
        const line = geoJsonLineToLatLng(osrm.geometry);
        routeLayer = L.polyline(line, { color: "#0d6efd", weight: 4, opacity: 0.9 }).addTo(map);
        setStatus("Đang hiển thị đường đi giữa điểm đầu/cuối (OSRM).", "success");
      } else {
        routeLayer = drawStraight(a, b).addTo(map);
        setStatus("Không lấy được OSRM, dùng đường thẳng để xem tổng quan.", "secondary");
      }

      fitAll();
    } catch (e) {
      if (seq !== requestSeq) return;
      console.error(e);
      setStatus("Lỗi tải tuyến. Vui lòng thử lại.", "warning");
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  }

  window.SBRouteOverview = {
    init(mapId = "routes-overview-map") {
      ensureMap(mapId);
    },
    setRoute,
    clear() {
      clearLayers();
      setStatus("", "secondary");
    },
  };
})();
