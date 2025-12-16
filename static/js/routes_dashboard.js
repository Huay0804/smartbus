// static/js/routes_dashboard.js
document.addEventListener("DOMContentLoaded", () => {
  const mapId = "routes-map";
  const sel = document.getElementById("routeSelect");
  const search = document.getElementById("routeSearch");
  const tbody = document.getElementById("routeTableBody");
  const empty = document.getElementById("emptyState");
  const countEl = document.getElementById("routeCount");

  const titleEl = document.getElementById("selectedRouteTitle");
  const metaEl = document.getElementById("selectedRouteMeta");
  const stopListEl = document.getElementById("stopList");

  const kpiStops = document.getElementById("kpiStops");
  const kpiMarkers = document.getElementById("kpiMarkers");
  const kpiLine = document.getElementById("kpiLine");
  const kpiMapData = document.getElementById("kpiMapData");

  const btnDetail = document.getElementById("btnRouteDetail");

  if (!sel || !tbody) return;

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setInfoFromRow(row) {
    const code = row?.dataset?.code || "";
    const name = row?.dataset?.name || "";
    const start = row?.dataset?.start || "";
    const end = row?.dataset?.end || "";

    if (titleEl) titleEl.textContent = code ? `Tuyến ${code} — ${name || "—"}` : (name || "—");
    if (metaEl) metaEl.textContent = (start || end) ? `${start || "—"} → ${end || "—"}` : "—";
  }

  function setDetailLink(routeId) {
    if (!btnDetail) return;
    btnDetail.href = routeId ? `/routes/${routeId}` : "#";
    btnDetail.classList.toggle("disabled", !routeId);
  }

  function renderStopList(stops) {
    if (!stopListEl) return;
    if (!stops || !stops.length) {
      stopListEl.innerHTML = `<li class="text-muted">Chưa có trạm cho tuyến này.</li>`;
      return;
    }

    const items = stops
      .slice()
      .sort((a, b) => (Number(a.order ?? 0) - Number(b.order ?? 0)))
      .map((s) => {
        const hasCoord = s.lat != null && s.lng != null;
        const badge = hasCoord
          ? `<span class="badge text-bg-success ms-2">OK</span>`
          : `<span class="badge text-bg-warning ms-2">Thiếu tọa độ</span>`;
        const label = `${escapeHtml(s.order ?? "")}. ${escapeHtml(s.name ?? "")}`;
        const addr = s.address ? `<div class="text-muted small">${escapeHtml(s.address)}</div>` : "";
        return `<li class="sb-stop-item">
                  <div class="d-flex justify-content-between align-items-start">
                    <div class="fw-semibold">${label}${addr}</div>
                    ${badge}
                  </div>
                </li>`;
      })
      .join("");

    stopListEl.innerHTML = items;
  }

  async function loadStops(routeId) {
    if (!routeId) return;

    if (stopListEl) stopListEl.innerHTML = `<li class="text-muted">Đang tải trạm…</li>`;
    if (kpiStops) kpiStops.textContent = "…";
    if (kpiMarkers) kpiMarkers.textContent = "…";
    if (kpiLine) kpiLine.textContent = "…";
    if (kpiMapData) kpiMapData.textContent = "…";

    try {
      const res = await fetch(`/api/routes/${routeId}/stops_geo`);
      const stops = await res.json();

      const validMarkers = (stops || []).filter(s => s.lat != null && s.lng != null).length;

      if (kpiStops) kpiStops.textContent = String((stops || []).length);
      if (kpiMarkers) kpiMarkers.textContent = String(validMarkers);

      if (kpiMapData) kpiMapData.textContent = (validMarkers >= 2) ? "Đủ" : "Thiếu";
      if (kpiLine) kpiLine.textContent = (validMarkers >= 2) ? "OSRM" : "—";

      renderStopList(stops);

      if (typeof window.renderRouteMap === "function") {
        await window.renderRouteMap(stops, mapId);
      }
    } catch (e) {
      console.error(e);
      if (stopListEl) stopListEl.innerHTML = `<li class="text-danger">Không tải được trạm. Kiểm tra API /api/routes/${routeId}/stops_geo</li>`;
      if (kpiStops) kpiStops.textContent = "0";
      if (kpiMarkers) kpiMarkers.textContent = "0";
      if (kpiMapData) kpiMapData.textContent = "—";
      if (kpiLine) kpiLine.textContent = "—";
    }
  }

  function selectByRouteId(routeId) {
    sel.value = String(routeId);

    const rows = tbody.querySelectorAll(".route-row");
    rows.forEach(r => r.classList.toggle("table-active", r.dataset.routeId === String(routeId)));

    const row = tbody.querySelector(`.route-row[data-route-id="${routeId}"]`);
    if (row) setInfoFromRow(row);

    setDetailLink(routeId);
    loadStops(routeId);
  }

  tbody.addEventListener("click", (e) => {
    const row = e.target.closest(".route-row");
    if (!row) return;
    selectByRouteId(row.dataset.routeId);
  });

  sel.addEventListener("change", () => {
    selectByRouteId(sel.value);
  });

  function applyFilter() {
    const q = (search?.value || "").trim().toLowerCase();
    const rows = tbody.querySelectorAll(".route-row");
    let shown = 0;
    let firstShownId = null;

    rows.forEach((tr) => {
      const text = tr.getAttribute("data-text") || "";
      const ok = !q || text.includes(q);
      tr.style.display = ok ? "" : "none";
      if (ok) {
        shown++;
        if (!firstShownId) firstShownId = tr.dataset.routeId;
      }
    });

    if (countEl) countEl.textContent = String(shown);
    if (empty) empty.classList.toggle("d-none", shown !== 0);

    const currentId = sel.value;
    const currentRow = tbody.querySelector(`.route-row[data-route-id="${currentId}"]`);
    const currentVisible = currentRow && currentRow.style.display !== "none";
    if (!currentVisible && firstShownId) {
      selectByRouteId(firstShownId);
    }
  }

  if (search) search.addEventListener("input", applyFilter);

  const initial = window.__initialRouteId != null ? String(window.__initialRouteId) : null;
  if (initial && tbody.querySelector(`.route-row[data-route-id="${initial}"]`)) {
    selectByRouteId(initial);
  } else {
    if (sel.value) selectByRouteId(sel.value);
  }

  applyFilter();
});
