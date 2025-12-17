// static/js/routes_dashboard.js
document.addEventListener("DOMContentLoaded", () => {
  const mapId = "routes-map";

  const sel = document.getElementById("routeSelect");          // có thì dùng, không có vẫn chạy
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

  if (!tbody) return; // CHỈ cần tbody là đủ để click chọn tuyến

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
      stopListEl.innerHTML = `<li class="text-muted">Chưa có dữ liệu trạm cho tuyến này.</li>`;
      return;
    }

    const items = stops
      .slice()
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
      .map((s) => {
        const hasCoord = s.lat != null && s.lng != null;
        const badge = hasCoord
          ? `<span class="badge text-bg-success ms-2">OK</span>`
          : `<span class="badge text-bg-warning ms-2">Thiếu</span>`;

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
    // Nếu routeId rỗng => clear map và clear list
    if (!routeId) {
      if (stopListEl) stopListEl.innerHTML = `<li class="text-muted">Chọn tuyến bên trái.</li>`;
      if (kpiStops) kpiStops.textContent = "0";
      if (kpiMarkers) kpiMarkers.textContent = "0";
      if (kpiMapData) kpiMapData.textContent = "—";
      if (kpiLine) kpiLine.textContent = "—";
      if (typeof window.renderRouteMap === "function") await window.renderRouteMap([], mapId);
      return;
    }

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
        await window.renderRouteMap(stops, mapId); // stops rỗng => maps_osrm.js sẽ reset map sạch
      }
    } catch (e) {
      console.error(e);
      if (stopListEl) stopListEl.innerHTML = `<li class="text-danger">Không tải được trạm. Kiểm tra API /api/routes/${routeId}/stops_geo</li>`;
      if (kpiStops) kpiStops.textContent = "0";
      if (kpiMarkers) kpiMarkers.textContent = "0";
      if (kpiMapData) kpiMapData.textContent = "—";
      if (kpiLine) kpiLine.textContent = "—";
      if (typeof window.renderRouteMap === "function") await window.renderRouteMap([], mapId);
    }
  }

  function highlight(routeId) {
    tbody.querySelectorAll(".route-row").forEach(r => {
      r.classList.toggle("table-active", r.dataset.routeId === String(routeId));
    });
  }

  function selectByRouteId(routeId) {
    routeId = String(routeId);

    // Nếu có select thì sync lại (không có cũng OK)
    if (sel) sel.value = routeId;

    const row = tbody.querySelector(`.route-row[data-route-id="${routeId}"]`);
    if (row) setInfoFromRow(row);

    setDetailLink(routeId);
    highlight(routeId);
    loadStops(routeId);
  }

  // Click tuyến trong bảng
  tbody.addEventListener("click", (e) => {
    const row = e.target.closest(".route-row");
    if (!row) return;
    selectByRouteId(row.dataset.routeId);
  });

  // Nếu có dropdown thì vẫn hỗ trợ
  if (sel) {
    sel.addEventListener("change", () => {
      if (sel.value) selectByRouteId(sel.value);
    });
  }

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

    // nếu tuyến hiện tại bị ẩn, tự chọn tuyến đầu tiên còn hiện
    const currentId = sel?.value || tbody.querySelector(".route-row.table-active")?.dataset?.routeId;
    const currentRow = currentId ? tbody.querySelector(`.route-row[data-route-id="${currentId}"]`) : null;
    const currentVisible = currentRow && currentRow.style.display !== "none";

    if (!currentVisible && firstShownId) selectByRouteId(firstShownId);
  }

  if (search) search.addEventListener("input", applyFilter);

  // init: ưu tiên __initialRouteId, rồi sel.value, rồi row đầu tiên
  const initial = window.__initialRouteId != null ? String(window.__initialRouteId) : null;
  if (initial && tbody.querySelector(`.route-row[data-route-id="${initial}"]`)) {
    selectByRouteId(initial);
  } else if (sel && sel.value) {
    selectByRouteId(sel.value);
  } else {
    const first = tbody.querySelector(".route-row");
    if (first) selectByRouteId(first.dataset.routeId);
    else loadStops(null);
  }

  applyFilter();
});
