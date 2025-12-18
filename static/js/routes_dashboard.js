// static/js/routes_dashboard.js
// Controller cho trang /routes: chọn tuyến, load KPI và đồng bộ bản đồ tổng quan.

document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("routeSelect");
  const search = document.getElementById("routeSearch");
  const tbody = document.getElementById("routeTableBody");
  const empty = document.getElementById("emptyState");
  const countEl = document.getElementById("routeCount");

  const titleEl = document.getElementById("selectedRouteTitle");
  const metaEl = document.getElementById("selectedRouteMeta");
  const statusEl = document.getElementById("kpiDataStatus");
  const kpiStopsDI = document.getElementById("kpiStopsDI");
  const kpiStopsVE = document.getElementById("kpiStopsVE");
  const kpiStopsDIGeo = document.getElementById("kpiStopsDIGeo");
  const kpiStopsVEGeo = document.getElementById("kpiStopsVEGeo");
  const kpiGeoPercent = document.getElementById("kpiGeoPercent");
  const errorAlert = document.getElementById("routeSummaryError");
  const badgeDI = document.getElementById("badgeDI");
  const badgeVE = document.getElementById("badgeVE");
  const infoDistance = document.getElementById("routeDistance");
  const infoHours = document.getElementById("routeHours");
  const infoFreq = document.getElementById("routeFreq");
  const infoFare = document.getElementById("routeFare");

  const tripCountBadge = document.getElementById("tripCountBadge");
  const routeTripsEmpty = document.getElementById("routeTripsEmpty");
  const routeTripsList = document.getElementById("routeTripsList");
  const hasTripsPanel = !!routeTripsList;

  const btnDetail = document.getElementById("btnRouteDetail");

  if (!tbody) return;

  if (window.SBRouteOverview && typeof window.SBRouteOverview.init === "function") {
    window.SBRouteOverview.init("routes-overview-map");
  }

  let requestSeq = 0;
  let tripsSeq = 0;

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

  function resetSummary() {
    if (kpiStopsDI) kpiStopsDI.textContent = "0 trạm";
    if (kpiStopsVE) kpiStopsVE.textContent = "0 trạm";
    if (kpiStopsDIGeo) kpiStopsDIGeo.textContent = "— tọa độ";
    if (kpiStopsVEGeo) kpiStopsVEGeo.textContent = "— tọa độ";
    if (kpiGeoPercent) kpiGeoPercent.textContent = "0%";
    if (badgeDI) badgeDI.className = "badge text-bg-secondary";
    if (badgeVE) badgeVE.className = "badge text-bg-secondary";
    if (infoDistance) infoDistance.textContent = "—";
    if (infoHours) infoHours.textContent = "—";
    if (infoFreq) infoFreq.textContent = "—";
    if (infoFare) infoFare.textContent = "—";
    if (statusEl) {
      statusEl.textContent = "—";
      statusEl.className = "badge text-bg-secondary";
    }
    if (errorAlert) errorAlert.classList.add("d-none");
  }

  function resetTrips(message = "Chưa tải dữ liệu.") {
    if (tripCountBadge) tripCountBadge.textContent = "0";
    if (routeTripsEmpty) {
      routeTripsEmpty.textContent = message;
      routeTripsEmpty.classList.remove("d-none");
    }
    if (routeTripsList) {
      routeTripsList.classList.add("d-none");
      routeTripsList.innerHTML = "";
    }
  }

  function showTripsLoading() {
    if (tripCountBadge) tripCountBadge.textContent = "…";
    if (routeTripsEmpty) {
      routeTripsEmpty.textContent = "Đang tải...";
      routeTripsEmpty.classList.remove("d-none");
    }
    if (routeTripsList) {
      routeTripsList.classList.add("d-none");
      routeTripsList.innerHTML = "";
    }
  }

  function renderTrips(items) {
    const list = routeTripsList;
    if (!list) return;

    list.innerHTML = "";

    const safeItems = Array.isArray(items) ? items : [];
    if (tripCountBadge) tripCountBadge.textContent = String(safeItems.length);

    if (!safeItems.length) {
      if (routeTripsEmpty) {
        routeTripsEmpty.textContent = "Chưa có chuyến sắp tới.";
        routeTripsEmpty.classList.remove("d-none");
      }
      list.classList.add("d-none");
      return;
    }

    if (routeTripsEmpty) routeTripsEmpty.classList.add("d-none");
    list.classList.remove("d-none");

    const frag = document.createDocumentFragment();

    safeItems.forEach((t) => {
      const tripId = t?.trip_id;
      const date = t?.date || "";
      const time = t?.time || "";
      const dir = t?.direction || "";

      const item = document.createElement("a");
      item.className = "list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-2";
      item.href = t?.detail_url || "#";

      const left = document.createElement("div");
      const title = document.createElement("div");
      title.className = "fw-semibold";
      title.textContent = time || (tripId ? `Chuyến #${tripId}` : "Chuyến");

      const meta = document.createElement("div");
      meta.className = "text-muted small";
      meta.textContent = [date, dir].filter(Boolean).join(" • ") || "—";

      left.appendChild(title);
      left.appendChild(meta);

      item.appendChild(left);
      frag.appendChild(item);
    });

    list.appendChild(frag);
  }

  function showLoading() {
    if (kpiStopsDI) kpiStopsDI.textContent = "…";
    if (kpiStopsVE) kpiStopsVE.textContent = "…";
    if (kpiStopsDIGeo) kpiStopsDIGeo.textContent = "Đang tải…";
    if (kpiStopsVEGeo) kpiStopsVEGeo.textContent = "Đang tải…";
    if (kpiGeoPercent) kpiGeoPercent.textContent = "…";
    if (statusEl) {
      statusEl.textContent = "…";
      statusEl.className = "badge text-bg-secondary";
    }
    if (errorAlert) errorAlert.classList.add("d-none");
  }

  function renderSummary(data) {
    if (!data) {
      resetSummary();
      return;
    }

    const di = data.directions?.DI || { stops: 0, with_geo: 0 };
    const ve = data.directions?.VE || { stops: 0, with_geo: 0 };

    if (kpiStopsDI) kpiStopsDI.textContent = `${di.stops} trạm`;
    if (kpiStopsVE) kpiStopsVE.textContent = `${ve.stops} trạm`;
    if (kpiStopsDIGeo) kpiStopsDIGeo.textContent = `${di.with_geo} tọa độ`;
    if (kpiStopsVEGeo) kpiStopsVEGeo.textContent = `${ve.with_geo} tọa độ`;
    if (kpiGeoPercent) kpiGeoPercent.textContent = `${data.totals?.percent_with_geo ?? 0}%`;

    if (statusEl) {
      const ok = data.data_status === "Đủ";
      statusEl.textContent = data.data_status || "—";
      statusEl.className = "badge " + (ok ? "text-bg-success" : "text-bg-warning");
    }

    if (badgeDI) {
      const ok = di.has_enough_shape ?? (di.stops >= 2 && di.with_geo >= 2);
      badgeDI.textContent = ok ? "OK" : "Thiếu";
      badgeDI.className = "badge " + (ok ? "text-bg-success" : "text-bg-warning");
    }
    if (badgeVE) {
      const ok = ve.has_enough_shape ?? (ve.stops >= 2 && ve.with_geo >= 2);
      badgeVE.textContent = ok ? "OK" : "Thiếu";
      badgeVE.className = "badge " + (ok ? "text-bg-success" : "text-bg-warning");
    }
    if (infoDistance) infoDistance.textContent = data.distance_km ? `${data.distance_km} km` : "—";
    if (infoHours) infoHours.textContent = data.operating_hours || "—";
    if (infoFreq) {
      const freq = data.frequency_min ? `${data.frequency_min} p/chuyến` : (data.trips_per_day ? `${data.trips_per_day} chuyến/ngày` : "—");
      infoFreq.textContent = freq;
    }
    if (infoFare) infoFare.textContent = data.fare || "—";

    if (errorAlert) errorAlert.classList.add("d-none");
  }

  async function loadSummary(routeId) {
    if (!routeId) {
      resetSummary();
      setDetailLink(null);
      return;
    }

    requestSeq += 1;
    const seq = requestSeq;
    showLoading();

    try {
      const res = await fetch(`/api/routes/${routeId}/summary`);
      const data = await res.json();

      if (seq !== requestSeq) return; // đã có yêu cầu mới hơn

      if (!res.ok) throw new Error("API summary lỗi");

      renderSummary(data);
      setDetailLink(routeId);

       // cập nhật data-status cho filter chip
      const row = tbody.querySelector(`.route-row[data-route-id="${routeId}"]`);
      if (row && data?.data_status) {
        row.setAttribute("data-status", data.data_status === "Đủ" ? "DU" : "THIEU");
      }
    } catch (e) {
      if (seq !== requestSeq) return;
      console.error(e);
      resetSummary();
      if (errorAlert) errorAlert.classList.remove("d-none");
      setDetailLink(routeId);
    }
  }

  async function loadTrips(routeId) {
    if (!routeId) {
      resetTrips("Chưa tải dữ liệu.");
      return;
    }

    tripsSeq += 1;
    const seq = tripsSeq;
    showTripsLoading();

    try {
      const res = await fetch(`/api/routes/${routeId}/trips?limit=12`);
      const data = await res.json();

      if (seq !== tripsSeq) return;
      if (!res.ok || !data?.ok) throw new Error("API trips lỗi");

      renderTrips(data.items || []);
    } catch (e) {
      if (seq !== tripsSeq) return;
      console.error(e);
      resetTrips("Không tải được chuyến.");
    }
  }

  function highlight(routeId) {
    tbody.querySelectorAll(".route-row").forEach((r) => {
      r.classList.toggle("table-active", r.dataset.routeId === String(routeId));
    });
  }

  function selectByRouteId(routeId) {
    routeId = String(routeId);

    if (sel) sel.value = routeId;

    const row = tbody.querySelector(`.route-row[data-route-id="${routeId}"]`);
    if (row) setInfoFromRow(row);

    highlight(routeId);
    loadSummary(routeId);
    if (hasTripsPanel) loadTrips(routeId);
    if (window.SBRouteOverview && typeof window.SBRouteOverview.setRoute === "function") {
      window.SBRouteOverview.setRoute(routeId, "routes-overview-map");
    }
  }

  tbody.addEventListener("click", (e) => {
    const row = e.target.closest(".route-row");
    if (!row) return;
    selectByRouteId(row.dataset.routeId);
  });

  if (sel) {
    sel.addEventListener("change", () => {
      if (sel.value) selectByRouteId(sel.value);
    });
  }

  function applyFilter() {
    const q = (search?.value || "").trim().toLowerCase();
    const filterStatus = "";
    const rows = tbody.querySelectorAll(".route-row");
    let shown = 0;
    let firstShownId = null;

    rows.forEach((tr) => {
      const text = tr.getAttribute("data-text") || "";
      const rowStatus = (tr.getAttribute("data-status") || "").toUpperCase();
      const statusOk = !filterStatus || rowStatus === filterStatus;
      const ok = (!q || text.includes(q)) && statusOk;
      tr.style.display = ok ? "" : "none";
      if (ok) {
        shown += 1;
        if (!firstShownId) firstShownId = tr.dataset.routeId;
      }
    });

    if (countEl) countEl.textContent = String(shown);
    if (empty) empty.classList.toggle("d-none", shown !== 0);

    const currentId = sel?.value || tbody.querySelector(".route-row.table-active")?.dataset?.routeId;
    const currentRow = currentId ? tbody.querySelector(`.route-row[data-route-id="${currentId}"]`) : null;
    const currentVisible = currentRow && currentRow.style.display !== "none";

    if (!currentVisible && firstShownId) selectByRouteId(firstShownId);
  }

  if (search) search.addEventListener("input", applyFilter);
  // no status chip filter now

  const initial = window.__initialRouteId != null ? String(window.__initialRouteId) : null;
  if (initial && tbody.querySelector(`.route-row[data-route-id="${initial}"]`)) {
    selectByRouteId(initial);
  } else if (sel && sel.value) {
    selectByRouteId(sel.value);
  } else {
    const first = tbody.querySelector(".route-row");
    if (first) selectByRouteId(first.dataset.routeId);
    else {
      resetSummary();
      if (hasTripsPanel) resetTrips("Chưa tải dữ liệu.");
    }
  }

  applyFilter();
});
