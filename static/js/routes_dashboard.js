document.addEventListener("DOMContentLoaded", () => {
  const mapEl = document.getElementById("routes-map");
  const sel = document.getElementById("routeSelect");
  const search = document.getElementById("routeSearch");
  const tbody = document.getElementById("routeTableBody");

  const titleEl = document.getElementById("selectedRouteTitle");
  const metaEl = document.getElementById("selectedRouteMeta");
  const stopListEl = document.getElementById("stopList");

  const kpiStops = document.getElementById("kpiStops");
  const kpiMarkers = document.getElementById("kpiMarkers");
  const kpiLine = document.getElementById("kpiLine");
  const kpiMapData = document.getElementById("kpiMapData");

  const btnDetail = document.getElementById("btnRouteDetail");
  const btnAdminStops = document.getElementById("btnAdminStops");
  const btnAdminTrips = document.getElementById("btnAdminTrips");

  if (!mapEl || !window.L || !sel) return;

  // Map init
  const map = L.map("routes-map");
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  const markers = L.layerGroup().addTo(map);
  let polyline = null;

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setRouteInfoFromSelect() {
    const opt = sel.options[sel.selectedIndex];
    const code = opt.dataset.code || "";
    const name = opt.dataset.name || "";
    const start = opt.dataset.start || "";
    const end = opt.dataset.end || "";

    if (titleEl) titleEl.textContent = `${code} — ${name}`;
    if (metaEl) metaEl.textContent = `${start} → ${end}`;

    const routeId = sel.value;

    if (btnDetail) btnDetail.href = `/routes/${routeId}`;
    if (btnAdminStops) btnAdminStops.href = `/admin/routes/${routeId}/stops`;
    if (btnAdminTrips) btnAdminTrips.href = `/admin/routes/${routeId}/trips`;

    // highlight selected row
    if (tbody) {
      const rows = tbody.querySelectorAll(".route-row");
      rows.forEach(r => r.classList.toggle("is-selected", r.dataset.routeId === String(routeId)));
    }
  }

  function renderStopList(stops) {
    if (!stopListEl) return;
    stopListEl.innerHTML = "";

    if (!stops || !stops.length) {
      stopListEl.innerHTML = `<li class="text-muted small">Chưa có dữ liệu trạm.</li>`;
      return;
    }

    stops.slice(0, 18).forEach((s) => {
      const li = document.createElement("li");
      li.className = "sb-stop-item";
      const order = (s.order !== undefined && s.order !== null) ? s.order : "";
      const name = s.name || "—";
      const addr = s.address || "";

      li.innerHTML = `
        <div class="sb-stop-top">
          <span class="sb-stop-order">${escapeHtml(order)}</span>
          <span class="sb-stop-name">${escapeHtml(name)}</span>
        </div>
        ${addr ? `<div class="sb-stop-addr">${escapeHtml(addr)}</div>` : ``}
      `;
      stopListEl.appendChild(li);
    });

    if (stops.length > 18) {
      const more = document.createElement("li");
      more.className = "text-muted small";
      more.textContent = `… còn ${stops.length - 18} trạm (xem đầy đủ ở trang Chi tiết tuyến).`;
      stopListEl.appendChild(more);
    }
  }

  async function loadRoute(routeId) {
    setRouteInfoFromSelect();

    try {
      const res = await fetch(`/api/routes/${routeId}/stops_geo`);
      const stops = await res.json();

      markers.clearLayers();
      if (polyline) {
        map.removeLayer(polyline);
        polyline = null;
      }

      const latlngs = [];
      let validMarkers = 0;

      stops.forEach((s) => {
        if (s.lat == null || s.lng == null) return;
        const ll = [s.lat, s.lng];
        latlngs.push(ll);
        validMarkers++;

        const label = (s.order ? `${s.order}. ` : "") + (s.name || "");
        const popup = `<b>${escapeHtml(label)}</b>${s.address ? "<br>" + escapeHtml(s.address) : ""}`;
        L.marker(ll).addTo(markers).bindPopup(popup);
      });

      renderStopList(stops);

      if (kpiStops) kpiStops.textContent = String(stops.length);
      if (kpiMarkers) kpiMarkers.textContent = String(validMarkers);

      // user-friendly indicator
      if (kpiMapData) kpiMapData.textContent = (validMarkers >= 2) ? "Đủ" : "Thiếu";

      if (latlngs.length >= 2) {
        polyline = L.polyline(latlngs).addTo(map);
        map.fitBounds(L.latLngBounds(latlngs).pad(0.2));
        if (kpiLine) kpiLine.textContent = "Polyline";
      } else {
        map.setView([16.047, 108.206], 12);
        if (kpiLine) kpiLine.textContent = "—";
      }

      setTimeout(() => map.invalidateSize(), 120);
    } catch (e) {
      renderStopList([]);
      if (kpiStops) kpiStops.textContent = "0";
      if (kpiMarkers) kpiMarkers.textContent = "0";
      if (kpiMapData) kpiMapData.textContent = "Thiếu";
      if (kpiLine) kpiLine.textContent = "—";
      map.setView([16.047, 108.206], 12);
      setTimeout(() => map.invalidateSize(), 120);
    }
  }

  // init
  const initial = window.SB_ROUTES?.initialRouteId || sel.value;
  if (initial) sel.value = String(initial);
  loadRoute(sel.value);

  sel.addEventListener("change", () => loadRoute(sel.value));

  // row click selects route
  if (tbody) {
    tbody.addEventListener("click", (ev) => {
      const tr = ev.target.closest(".route-row");
      if (!tr) return;
      const routeId = tr.dataset.routeId;
      if (!routeId) return;
      sel.value = String(routeId);
      loadRoute(routeId);
    });
  }

  // search filter
  if (search && tbody) {
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      const rows = tbody.querySelectorAll(".route-row");
      rows.forEach((tr) => {
        const text = tr.getAttribute("data-text") || "";
        tr.style.display = text.includes(q) ? "" : "none";
      });
    });
  }
});
