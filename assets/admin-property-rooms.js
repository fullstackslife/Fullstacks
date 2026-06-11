(function () {
  const storageKey = "fullstacksAdminToken";
  const propertyStorageKey = "fullstacksAdminPropertyId";
  const roomStatuses = ["In Service", "OOO", "Maintenance", "Renovation", "Mothballed"];
  const roomPriorities = ["Low", "Normal", "High", "Critical"];
  let adminToken = localStorage.getItem(storageKey) || "";
  let selectedPropertyId = localStorage.getItem(propertyStorageKey) || "";
  let properties = [];
  let rooms = [];
  let selectedRoomId = null;
  let pageOffset = 0;
  let pageTotal = 0;
  let pageHasMore = false;
  let walkActive = false;
  let walkIndex = 0;
  let walkChecklistOpen = false;
  let walkDetailsOpen = false;
  let walkReturnOpen = false;
  const checklistShortLabels = { "OK": "OK", "Needs Repair": "Repair", "Complete": "Done", "N/A": "N/A" };
  const checklistStatuses = ["OK", "Needs Repair", "Complete", "N/A"];
  const checklistCache = new Map(); // roomId -> [{id, group, label, status, notes}]
  const checklistDirty = new Map(); // roomId -> Set(itemId) staged but not yet saved
  let checklistSummaries = { totalItems: 0, rooms: {} }; // batch per-room counts for list rows

  const mobileQuery = window.matchMedia("(max-width: 680px)");

  const siteHeader = document.querySelector("#admin-site-header");
  const accessPanel = document.querySelector("#admin-access-panel");
  const dashboard = document.querySelector("#admin-dashboard");
  const tokenForm = document.querySelector("#admin-token-form");
  const tokenInput = document.querySelector("#admin-token");
  const tokenStatus = document.querySelector("#admin-token-status");
  const filtersForm = document.querySelector("#room-filters");
  const loadStatus = document.querySelector("#admin-load-status");
  const roomList = document.querySelector("#room-list");
  const roomDetail = document.querySelector("#room-detail");
  const refreshButton = document.querySelector("#admin-refresh");
  const countsBar = document.querySelector("#admin-counts");
  const sheetBackdrop = document.querySelector("#sheet-backdrop");
  const filtersToggle = document.querySelector("#toggle-filters-btn");
  const walkButton = document.querySelector("#walk-mode-btn");
  const walkSection = document.querySelector("#walk-mode");

  function setStatus(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove("success", "error");
    if (type) element.classList.add(type);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(value));
  }

  function getFilters() {
    const params = new URLSearchParams();
    if (!filtersForm) return params;
    for (const [key, value] of new FormData(filtersForm).entries()) {
      const v = String(value || "").trim();
      if (v) params.set(key, v);
    }
    return params;
  }

  async function apiFetch(url, options) {
    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
          ...(options && options.headers ? options.headers : {})
        }
      });
    } catch (networkError) {
      throw new Error("Network error — could not reach the server. Check your connection and try again.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Request failed (HTTP ${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function recoveryApi(path) {
    return selectedPropertyId
      ? `/api/admin/properties/${encodeURIComponent(selectedPropertyId)}${path}`
      : `/api/admin/property${path}`;
  }

  function renderPropertySelector() {
    const toolbar = document.querySelector("#room-toolbar");
    if (!toolbar || document.querySelector("#admin-property-select")) return;
    const wrap = document.createElement("label");
    wrap.className = "admin-property-picker";
    wrap.innerHTML = `
      <span>Property</span>
      <select id="admin-property-select" aria-label="Select property">
        ${properties
          .map((property) => `<option value="${property.id}">${escapeHtml(property.name || "Property " + property.id)}</option>`)
          .join("")}
      </select>`;
    toolbar.insertBefore(wrap, toolbar.firstChild);
    const select = wrap.querySelector("#admin-property-select");
    if (selectedPropertyId) select.value = selectedPropertyId;
    if (!select.value && properties[0]) {
      select.value = String(properties[0].id);
      selectedPropertyId = select.value;
      localStorage.setItem(propertyStorageKey, selectedPropertyId);
    }
    select.addEventListener("change", () => {
      selectedPropertyId = select.value;
      localStorage.setItem(propertyStorageKey, selectedPropertyId);
      rooms = [];
      selectedRoomId = null;
      checklistCache.clear();
      checklistDirty.clear();
      checklistSummaries = { totalItems: 0, rooms: {} };
      if (walkActive) exitWalkMode();
      loadRooms(false);
    });
  }

  async function loadProperties() {
    const payload = await apiFetch("/api/admin/properties?limit=200");
    properties = payload.properties || [];
    if (!selectedPropertyId || !properties.some((property) => String(property.id) === String(selectedPropertyId))) {
      selectedPropertyId = properties[0] ? String(properties[0].id) : "";
      if (selectedPropertyId) localStorage.setItem(propertyStorageKey, selectedPropertyId);
    }
    renderPropertySelector();
  }

  async function initializeDashboard() {
    showDashboard();
    await loadProperties();
    await loadRooms(false);
  }

  function showDashboard() {
    if (siteHeader) siteHeader.hidden = false;
    accessPanel.hidden = true;
    dashboard.hidden = false;
  }

  function showAccess() {
    if (siteHeader) siteHeader.hidden = true;
    dashboard.hidden = true;
    accessPanel.hidden = false;
  }

  // On phones the detail panel behaves as a slide-up sheet; on wider screens
  // these classes have no visual effect (see styles.css @media 680px rules).
  function openSheet() {
    if (!mobileQuery.matches) return;
    roomDetail.classList.add("sheet-open");
    if (sheetBackdrop) sheetBackdrop.hidden = false;
  }

  function closeSheet() {
    roomDetail.classList.remove("sheet-open");
    if (sheetBackdrop) sheetBackdrop.hidden = true;
  }

  function renderCounts() {
    if (!countsBar) return;
    const counts = {};
    for (const s of roomStatuses) counts[s] = 0;
    for (const r of rooms) {
      if (Object.prototype.hasOwnProperty.call(counts, r.status)) counts[r.status]++;
    }
    countsBar.innerHTML = roomStatuses
      .map(
        (s) => `
        <div class="admin-count-card">
          <strong>${counts[s]}</strong>
          <span>${escapeHtml(s)}</span>
        </div>`
      )
      .join("");
  }

  function renderPagination() {
    const el = document.querySelector("#admin-pagination");
    if (!el) return;
    if (rooms.length === 0) { el.innerHTML = ""; return; }
    let html = `<p class="pagination-info">Showing ${rooms.length} of ${pageTotal} room${pageTotal === 1 ? "" : "s"}</p>`;
    if (pageHasMore) {
      html += `<button class="button secondary" id="load-more-btn" type="button">Load More</button>`;
    }
    el.innerHTML = html;
    const btn = el.querySelector("#load-more-btn");
    if (btn) btn.addEventListener("click", () => loadRooms(true));
  }

  function renderList() {
    if (!roomList) return;
    if (rooms.length === 0) {
      roomList.innerHTML = '<p class="empty-detail">No rooms match the current filters.</p>';
      renderDetail(null);
      return;
    }
    if (!selectedRoomId || !rooms.some((r) => r.id === selectedRoomId)) {
      selectedRoomId = rooms[0].id;
    }
    roomList.innerHTML = rooms
      .map((r) => {
        const selected = r.id === selectedRoomId ? " selected" : "";
        const floorLabel = r.floor ? `Floor ${r.floor}` : "";
        const typeFloor = [r.roomType, floorLabel].filter(Boolean).join("  /  ");
        const cs = checklistSummaries.rooms[r.id];
        const checklistLine =
          cs && cs.answered > 0 && checklistSummaries.totalItems > 0
            ? `<small class="row-checklist${cs.needsRepair > 0 ? " has-repairs" : ""}">Checklist ${cs.answered}/${checklistSummaries.totalItems}${cs.needsRepair > 0 ? ` · ${cs.needsRepair} repair${cs.needsRepair === 1 ? "" : "s"}` : ""}</small>`
            : "";
        return `
          <button class="application-row${selected}" type="button" data-id="${r.id}">
            <span>
              <strong>Room ${escapeHtml(r.roomNumber)}</strong>
              ${r.oosReason ? `<small>${escapeHtml(r.oosReason.slice(0, 80))}${r.oosReason.length > 80 ? "..." : ""}</small>` : ""}
              ${checklistLine}
            </span>
            <span>${escapeHtml(typeFloor)}</span>
            <span class="status-pill">${escapeHtml(r.status)}</span>
          </button>`;
      })
      .join("");
    renderDetail(rooms.find((r) => r.id === selectedRoomId));
  }

  function renderDetail(room) {
    if (!roomDetail) return;
    if (!room) {
      roomDetail.innerHTML = `
        <p class="section-kicker">Room Details</p>
        <p class="empty-detail">Select a room to view and update details.</p>`;
      return;
    }

    const statusOptions = roomStatuses
      .map((s) => `<option value="${escapeHtml(s)}"${s === room.status ? " selected" : ""}>${escapeHtml(s)}</option>`)
      .join("");
    const priorityOptions = roomPriorities
      .map((p) => `<option value="${escapeHtml(p)}"${p === room.priority ? " selected" : ""}>${escapeHtml(p)}</option>`)
      .join("");
    const returnDateValue = room.returnDate ? String(room.returnDate).slice(0, 10) : "";

    roomDetail.innerHTML = `
      <button class="sheet-close" id="detail-close-btn" type="button" aria-label="Close room details">&times;</button>
      <div class="detail-heading">
        <div>
          <p class="section-kicker">Room Details</p>
          <h2>Room ${escapeHtml(room.roomNumber)}</h2>
          <p>${escapeHtml([room.roomType, room.floor ? "Floor " + room.floor : ""].filter(Boolean).join("  /  "))}</p>
        </div>
        <label>
          <span>Status</span>
          <select id="room-status-select">${statusOptions}</select>
        </label>
      </div>

      <h3 class="detail-section-heading">Details</h3>
      <dl class="detail-grid">
        <div><dt>Room Number</dt><dd>${escapeHtml(room.roomNumber)}</dd></div>
        <div><dt>Type</dt><dd>${escapeHtml(room.roomType || "-")}</dd></div>
        <div><dt>Floor</dt><dd>${room.floor != null ? room.floor : "-"}</dd></div>
        <div><dt>Priority</dt><dd>${escapeHtml(room.priority || "Normal")}</dd></div>
        ${returnDateValue ? `<div><dt>Return Date</dt><dd>${escapeHtml(formatDate(returnDateValue))}</dd></div>` : ""}
      </dl>

      <h3 class="detail-section-heading">Update Room</h3>
      <div class="detail-notes">
        <label for="room-priority-select">
          <span>Priority</span>
        </label>
        <select id="room-priority-select" style="margin-bottom:1rem">
          ${priorityOptions}
        </select>

        <label for="room-oos-reason">
          <span>OOS Reason</span>
        </label>
        <textarea
          id="room-oos-reason"
          maxlength="1000"
          rows="3"
          placeholder="Describe what is wrong with this room..."
        >${escapeHtml(room.oosReason || "")}</textarea>

        <label for="room-return-date" style="margin-top:0.75rem;display:block">
          <span>Estimated Return Date</span>
        </label>
        <input
          id="room-return-date"
          type="date"
          value="${escapeHtml(returnDateValue)}"
          style="margin-bottom:1rem"
        />

        <label for="room-notes">
          <span>Internal Notes</span>
        </label>
        <textarea
          id="room-notes"
          maxlength="2000"
          rows="3"
          placeholder="Internal notes about this room..."
        >${escapeHtml(room.notes || "")}</textarea>

        <div class="detail-notes-footer">
          <p class="form-status" id="detail-save-status" role="status" aria-live="polite"></p>
          <button class="button secondary" id="save-details-btn" type="button">Save Details</button>
        </div>
      </div>
    `;
  }

  async function loadRooms(append) {
    if (!append) pageOffset = 0;
    setStatus(loadStatus, append ? "Loading more..." : "Loading rooms...", "");
    try {
      const params = getFilters();
      params.set("limit", "100");
      params.set("offset", String(pageOffset));
      const payload = await apiFetch(`${recoveryApi("/rooms")}?${params.toString()}`);
      const incoming = payload.rooms || [];
      pageTotal = payload.total || 0;
      pageHasMore = payload.hasMore || false;
      pageOffset += incoming.length;
      rooms = append ? rooms.concat(incoming) : incoming;
      if (!append) selectedRoomId = null;
      showDashboard();
      renderCounts();
      renderList();
      renderPagination();
      setStatus(loadStatus, `${pageTotal} room${pageTotal === 1 ? "" : "s"} loaded.`, "success");
      loadChecklistSummaries();
    } catch (error) {
      if (!append) rooms = [];
      renderCounts();
      renderList();
      renderPagination();
      let message = error.message;
      if (error.status === 401) {
        message = "Unauthorized — your admin token was rejected. Enter it again.";
      } else if (error.status >= 500 && error.status !== 503) {
        message = `${error.message} (HTTP ${error.status} — server error. Check the deploy logs.)`;
      }
      setStatus(loadStatus, message, "error");
      if (error.status === 401 || error.status === 503) {
        localStorage.removeItem(storageKey);
        showAccess();
        setStatus(tokenStatus, message, "error");
      }
    }
  }

  // One batch request decorates the room list with checklist counts.
  // Purely cosmetic — failures leave the rows without chips, nothing breaks.
  async function loadChecklistSummaries() {
    try {
      const payload = await apiFetch(recoveryApi("/rooms/checklist-summaries"));
      checklistSummaries = { totalItems: payload.totalItems || 0, rooms: payload.rooms || {} };
      if (!walkActive) renderList();
    } catch (error) {
      // non-critical decoration; skip
    }
  }

  async function updateRoomStatus(roomId, status) {
    setStatus(loadStatus, "Updating status...", "");
    try {
      const payload = await apiFetch(`${recoveryApi("/rooms")}/${roomId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      rooms = rooms.map((r) => (r.id === roomId ? payload.room : r));
      selectedRoomId = roomId;
      renderCounts();
      renderList();
      setStatus(loadStatus, `Room updated to ${status}.`, "success");
    } catch (error) {
      setStatus(loadStatus, error.message, "error");
      renderDetail(rooms.find((r) => r.id === selectedRoomId));
    }
  }

  async function saveRoomDetails(roomId) {
    const saveStatus = document.querySelector("#detail-save-status");
    const oosReason = document.querySelector("#room-oos-reason");
    const returnDate = document.querySelector("#room-return-date");
    const notes = document.querySelector("#room-notes");
    const priority = document.querySelector("#room-priority-select");
    setStatus(saveStatus, "Saving...", "");
    try {
      const body = {
        oosReason: oosReason ? oosReason.value : undefined,
        returnDate: returnDate ? (returnDate.value || null) : undefined,
        notes: notes ? notes.value : undefined,
        priority: priority ? priority.value : undefined
      };
      const payload = await apiFetch(`${recoveryApi("/rooms")}/${roomId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      rooms = rooms.map((r) => (r.id === roomId ? payload.room : r));
      renderCounts();
      if (!walkActive) renderList();
      // renderList rebuilds the detail panel, so re-query the status node —
      // the reference captured above may be detached by now.
      setStatus(document.querySelector("#detail-save-status"), "Saved.", "success");
      return true;
    } catch (error) {
      setStatus(saveStatus, error.message, "error");
      return false;
    }
  }

  // ── Walk Mode ──────────────────────────────────────────────────────────
  // Steps through the currently loaded (filtered, server-ordered) rooms one
  // at a time. Reuses the detail-form element ids, so the detail panel must
  // be cleared (renderDetail(null)) while walk mode owns those ids.

  function enterWalkMode() {
    if (rooms.length === 0) {
      setStatus(loadStatus, "Load rooms before starting Walk Mode.", "error");
      return;
    }
    walkActive = true;
    const idx = rooms.findIndex((r) => r.id === selectedRoomId);
    walkIndex = idx >= 0 ? idx : 0;
    closeSheet();
    renderDetail(null);
    dashboard.classList.add("walk-active");
    document.body.classList.add("walk-active");
    walkSection.hidden = false;
    renderWalk();
    window.scrollTo(0, 0);
  }

  function exitWalkMode() {
    walkActive = false;
    walkSection.hidden = true;
    walkSection.innerHTML = "";
    dashboard.classList.remove("walk-active");
    document.body.classList.remove("walk-active");
    const room = rooms[Math.min(walkIndex, rooms.length - 1)];
    if (room) selectedRoomId = room.id;
    renderCounts();
    renderList();
  }

  function renderWalk() {
    if (!walkSection) return;
    const room = rooms[walkIndex];
    if (!room) {
      renderWalkComplete();
      return;
    }
    const statusButtons = roomStatuses
      .map(
        (s) =>
          `<button class="walk-status-btn${s === room.status ? " active" : ""}" type="button" data-status="${escapeHtml(s)}">${escapeHtml(s)}</button>`
      )
      .join("");
    const priorityOptions = roomPriorities
      .map((p) => `<option value="${escapeHtml(p)}"${p === room.priority ? " selected" : ""}>${escapeHtml(p)}</option>`)
      .join("");
    const returnDateValue = room.returnDate ? String(room.returnDate).slice(0, 10) : "";
    const meta = [room.roomType, room.floor != null ? `Fl ${room.floor}` : ""].filter(Boolean).join(" / ");

    walkSection.innerHTML = `
      <div class="walk-top">
        <div class="walk-top-room">
          <span class="walk-room-number">${escapeHtml(room.roomNumber)}</span>
          <span class="walk-top-meta">${walkIndex + 1}/${rooms.length}${meta ? " · " + escapeHtml(meta) : ""} · <span class="walk-top-status" id="walk-top-status">${escapeHtml(room.status)}</span></span>
        </div>
        <button class="button secondary walk-exit-btn" id="walk-exit" type="button">Exit</button>
      </div>
      <div class="walk-body">
        <div class="walk-status-grid" aria-label="Set room status">${statusButtons}</div>
        <div class="walk-fields walk-quick-note">
          <label for="room-notes"><span>Quick note</span></label>
          <textarea id="room-notes" maxlength="2000" rows="2" placeholder="Internal note for this room...">${escapeHtml(room.notes || "")}</textarea>
        </div>
        <details class="walk-section" id="walk-checklist-section"${walkChecklistOpen ? " open" : ""}>
          <summary>Checklist <span class="walk-section-hint" id="walk-checklist-progress">&hellip;</span></summary>
          <div class="walk-section-content" id="walk-checklist-body"></div>
        </details>
        <details class="walk-section" id="walk-details-section"${walkDetailsOpen ? " open" : ""}>
          <summary>Details <span class="walk-section-hint">priority · OOS · return date</span></summary>
          <div class="walk-section-content walk-fields">
            <label for="room-priority-select"><span>Priority</span></label>
            <select id="room-priority-select">${priorityOptions}</select>
            <label for="room-oos-reason"><span>OOS Reason</span></label>
            <textarea id="room-oos-reason" maxlength="1000" rows="2" placeholder="What is wrong with this room...">${escapeHtml(room.oosReason || "")}</textarea>
            <label for="room-return-date"><span>Estimated Return Date</span></label>
            <input id="room-return-date" type="date" value="${escapeHtml(returnDateValue)}" />
          </div>
        </details>
        <details class="walk-section" id="walk-return-section"${walkReturnOpen ? " open" : ""}>
          <summary>Return <span class="walk-section-hint" id="walk-return-state">&hellip;</span></summary>
          <div class="walk-section-content" id="walk-return-body"></div>
        </details>
      </div>
      <div class="walk-actions">
        <p class="form-status" id="detail-save-status" role="status" aria-live="polite"></p>
        <div class="walk-actions-buttons" id="walk-actions-main">
          <button class="button secondary" id="walk-prev" type="button"${walkIndex === 0 ? " disabled" : ""}>Prev</button>
          <button class="button secondary" id="walk-next" type="button">Next</button>
          <button class="button primary" id="walk-save-next" type="button">Save &amp; Next</button>
        </div>
        <div class="walk-confirm" id="walk-confirm" hidden>
          <p class="walk-confirm-text">Save changes before moving on?</p>
          <div class="walk-actions-buttons">
            <button class="button primary" id="walk-confirm-save" type="button">Save &amp; Next</button>
            <button class="button secondary" id="walk-confirm-discard" type="button">Discard</button>
            <button class="button secondary" id="walk-confirm-cancel" type="button">Cancel</button>
          </div>
        </div>
      </div>`;
    renderWalkReturn(room);
    loadWalkChecklist(room.id);
  }

  function renderWalkComplete() {
    walkSection.innerHTML = `
      <div class="walk-top">
        <div class="walk-top-room">
          <span class="walk-room-number">&#10003;</span>
          <span class="walk-top-meta">Walk complete — ${rooms.length} room${rooms.length === 1 ? "" : "s"} in this list.</span>
        </div>
        <button class="button secondary walk-exit-btn" id="walk-exit" type="button">Exit</button>
      </div>
      <div class="walk-actions">
        <div class="walk-actions-buttons">
          <button class="button secondary" id="walk-prev" type="button">Prev</button>
          <button class="button primary" id="walk-exit-done" type="button">Back to List</button>
        </div>
      </div>`;
  }

  async function walkSetStatus(roomId, status) {
    const statusEl = walkSection.querySelector("#detail-save-status");
    setStatus(statusEl, "Updating status...", "");
    try {
      const payload = await apiFetch(`${recoveryApi("/rooms")}/${roomId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      rooms = rooms.map((r) => (r.id === roomId ? payload.room : r));
      walkSection.querySelectorAll(".walk-status-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.status === status);
      });
      const topStatus = walkSection.querySelector("#walk-top-status");
      if (topStatus) topStatus.textContent = status;
      setStatus(statusEl, `Status saved: ${status}.`, "success");
    } catch (error) {
      setStatus(statusEl, error.message, "error");
    }
  }

  // ── Walk Mode checklist ────────────────────────────────────────────────
  // Items + responses load once per room and are cached for the rest of the
  // walk. Taps stage changes in memory (checklistDirty); Save & Next sends
  // only the staged items. Loading/error states stay inside the checklist
  // section so room navigation is never blocked.

  function currentWalkRoomId() {
    const room = rooms[walkIndex];
    return room ? room.id : null;
  }

  async function loadWalkChecklist(roomId) {
    if (checklistCache.has(roomId)) {
      renderWalkChecklist(roomId);
      return;
    }
    const body = walkSection.querySelector("#walk-checklist-body");
    if (body) body.innerHTML = '<p class="walk-check-state">Loading checklist...</p>';
    try {
      const payload = await apiFetch(`${recoveryApi("/rooms")}/${roomId}/checklist`);
      checklistCache.set(
        roomId,
        (payload.items || []).map((it) => ({
          id: it.id,
          group: it.group,
          label: it.label,
          status: it.response ? it.response.status : "",
          notes: it.response && it.response.notes ? it.response.notes : ""
        }))
      );
      if (currentWalkRoomId() === roomId) renderWalkChecklist(roomId);
    } catch (error) {
      if (currentWalkRoomId() !== roomId) return;
      const errBody = walkSection.querySelector("#walk-checklist-body");
      if (errBody) {
        errBody.innerHTML = `
          <p class="walk-check-state error">Checklist failed to load: ${escapeHtml(error.message)}</p>
          <button class="button secondary" id="walk-check-retry" type="button">Retry</button>`;
      }
      const progress = walkSection.querySelector("#walk-checklist-progress");
      if (progress) progress.textContent = "load failed";
      const returnState = walkSection.querySelector("#walk-return-state");
      if (returnState) returnState.textContent = "checklist unavailable";
    }
  }

  function checklistProgressText(items) {
    const answered = items.filter((it) => it.status).length;
    const repairs = items.filter((it) => it.status === "Needs Repair").length;
    let text = `${answered}/${items.length}`;
    if (repairs > 0) text += ` · ${repairs} repair${repairs === 1 ? "" : "s"}`;
    return text;
  }

  function renderWalkChecklist(roomId) {
    const body = walkSection.querySelector("#walk-checklist-body");
    const progress = walkSection.querySelector("#walk-checklist-progress");
    const items = checklistCache.get(roomId) || [];
    if (progress) progress.textContent = checklistProgressText(items);
    const currentRoom = rooms[walkIndex];
    if (currentRoom && currentRoom.id === roomId) renderWalkReturn(currentRoom);
    if (!body) return;
    if (items.length === 0) {
      body.innerHTML = '<p class="walk-check-state">No checklist items configured.</p>';
      return;
    }
    const groups = [];
    for (const item of items) {
      let group = groups[groups.length - 1];
      if (!group || group.name !== item.group) {
        group = { name: item.group, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    }
    body.innerHTML = groups
      .map(
        (group) => `
        <div class="walk-check-group">
          <p class="walk-check-group-title">${escapeHtml(group.name)}</p>
          ${group.items
            .map(
              (item) => `
            <div class="walk-check-item" data-item-id="${item.id}">
              <p class="walk-check-label">${escapeHtml(item.label)}</p>
              <div class="walk-check-buttons">
                ${checklistStatuses
                  .map(
                    (s) =>
                      `<button class="walk-check-btn${item.status === s ? " active" : ""}${s === "Needs Repair" ? " repair" : ""}" type="button" data-status="${escapeHtml(s)}">${escapeHtml(checklistShortLabels[s])}</button>`
                  )
                  .join("")}
                <button class="walk-check-note-toggle${item.notes ? " has-note" : ""}" type="button" aria-label="Toggle note for ${escapeHtml(item.label)}">&#9998;</button>
              </div>
              <textarea class="walk-check-note" maxlength="1000" rows="2" placeholder="Note for this item..."${item.notes ? "" : " hidden"}>${escapeHtml(item.notes)}</textarea>
            </div>`
            )
            .join("")}
        </div>`
      )
      .join("");
  }

  function stageChecklistChange(roomId, itemId, changes) {
    const items = checklistCache.get(roomId);
    if (!items) return;
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    Object.assign(item, changes);
    let dirty = checklistDirty.get(roomId);
    if (!dirty) {
      dirty = new Set();
      checklistDirty.set(roomId, dirty);
    }
    dirty.add(itemId);
    const progress = walkSection.querySelector("#walk-checklist-progress");
    if (progress && currentWalkRoomId() === roomId) {
      progress.textContent = checklistProgressText(items);
      renderWalkReturn(rooms[walkIndex]);
    }
  }

  async function saveWalkChecklist(roomId) {
    const dirty = checklistDirty.get(roomId);
    if (!dirty || dirty.size === 0) return true;
    const items = checklistCache.get(roomId) || [];
    // Items with a staged note but no status yet can't be persisted (the API
    // requires a status) — keep them staged instead of silently dropping them.
    const responses = items
      .filter((it) => dirty.has(it.id) && it.status)
      .map((it) => ({ itemId: it.id, status: it.status, notes: it.notes || "" }));
    if (responses.length === 0) return true;
    try {
      await apiFetch(`${recoveryApi("/rooms")}/${roomId}/checklist`, {
        method: "PATCH",
        body: JSON.stringify({ responses })
      });
      for (const sent of responses) dirty.delete(sent.itemId);
      if (dirty.size === 0) checklistDirty.delete(roomId);
      refreshChecklistSummary(roomId);
      return true;
    } catch (error) {
      setStatus(walkSection.querySelector("#detail-save-status"), `Checklist: ${error.message}`, "error");
      return false;
    }
  }

  async function saveWalkRoom(roomId) {
    const results = await Promise.all([saveRoomDetails(roomId), saveWalkChecklist(roomId)]);
    return results.every(Boolean);
  }

  // ── Ready for Return ───────────────────────────────────────────────────
  // Eligibility mirrors the server rule: no Needs Repair responses and at
  // least one answered item. Computed from the cached checklist (including
  // staged taps); submit saves staged checklist changes first so the
  // server's check sees the same state.

  function walkReturnEligibility(room) {
    if (room.readyForReturnAt) {
      return { state: "marked", text: `Marked ready ${formatDate(room.readyForReturnAt)}` };
    }
    const items = checklistCache.get(room.id);
    if (!items) return { state: "loading", text: "checking..." };
    const repairs = items.filter((it) => it.status === "Needs Repair").length;
    const answered = items.filter((it) => it.status).length;
    if (repairs > 0) {
      return { state: "blocked", text: `Ready blocked: ${repairs} repair item${repairs === 1 ? "" : "s"} remain` };
    }
    if (answered === 0) {
      return { state: "blocked", text: "Ready blocked: checklist not started" };
    }
    return { state: "eligible", text: "Eligible for return" };
  }

  function renderWalkReturn(room) {
    const stateEl = walkSection.querySelector("#walk-return-state");
    const body = walkSection.querySelector("#walk-return-body");
    if (!stateEl || !body || !room) return;
    const eligibility = walkReturnEligibility(room);
    stateEl.textContent = eligibility.text;
    stateEl.className = `walk-section-hint walk-return-${eligibility.state}`;

    if (eligibility.state === "marked") {
      body.innerHTML = `
        <p class="walk-return-marked">Marked ready for return on ${escapeHtml(formatDate(room.readyForReturnAt))}.</p>
        ${room.readyForReturnNote ? `<p class="walk-return-note-text">${escapeHtml(room.readyForReturnNote)}</p>` : ""}`;
      return;
    }
    if (eligibility.state !== "eligible") {
      body.innerHTML = `<p class="walk-check-state">${escapeHtml(eligibility.text)}. Resolve checklist items, then save, to enable Ready for Return.</p>`;
      return;
    }
    body.innerHTML = `
      <div class="walk-fields">
        <label for="walk-return-note"><span>Final note (required)</span></label>
        <textarea id="walk-return-note" maxlength="1000" rows="2" placeholder="Condition and basis for returning this room..."></textarea>
        <label class="walk-return-inservice">
          <input type="checkbox" id="walk-return-inservice" checked />
          <span>Set status to In Service</span>
        </label>
        <button class="button primary" id="walk-return-submit" type="button">Mark Ready for Return</button>
      </div>`;
  }

  async function submitReadyForReturn(room) {
    const statusEl = walkSection.querySelector("#detail-save-status");
    const noteEl = walkSection.querySelector("#walk-return-note");
    const note = noteEl ? noteEl.value.trim() : "";
    if (!note) {
      setStatus(statusEl, "A final note is required to mark ready for return.", "error");
      if (noteEl) noteEl.focus();
      return;
    }
    const inServiceEl = walkSection.querySelector("#walk-return-inservice");
    const setInService = !!(inServiceEl && inServiceEl.checked);
    const btn = walkSection.querySelector("#walk-return-submit");
    if (btn) btn.disabled = true;
    setStatus(statusEl, "Marking ready...", "");
    try {
      const checklistSaved = await saveWalkChecklist(room.id);
      if (!checklistSaved) return;
      const payload = await apiFetch(`${recoveryApi("/rooms")}/${room.id}/ready-for-return`, {
        method: "POST",
        body: JSON.stringify({ note, setInService })
      });
      rooms = rooms.map((r) => (r.id === room.id ? payload.room : r));
      const updated = payload.room;
      walkSection.querySelectorAll(".walk-status-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.status === updated.status);
      });
      const topStatus = walkSection.querySelector("#walk-top-status");
      if (topStatus) topStatus.textContent = updated.status;
      renderCounts();
      renderWalkReturn(updated);
      setStatus(statusEl, "Room marked ready for return.", "success");
    } catch (error) {
      setStatus(statusEl, error.message, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // Unsaved-change detection for the Next guard: staged checklist taps, or
  // any walk form field that differs from the room's server record.
  function walkHasUnsavedChanges(room) {
    const dirty = checklistDirty.get(room.id);
    if (dirty && dirty.size > 0) return true;
    const fields = [
      ["#room-notes", room.notes],
      ["#room-oos-reason", room.oosReason],
      ["#room-return-date", room.returnDate ? String(room.returnDate).slice(0, 10) : ""],
      ["#room-priority-select", room.priority || "Normal"]
    ];
    for (const [selector, original] of fields) {
      const el = walkSection.querySelector(selector);
      if (!el) continue;
      if (el.value.trim() !== String(original || "").trim()) return true;
    }
    return false;
  }

  function showWalkConfirm(show) {
    const main = walkSection.querySelector("#walk-actions-main");
    const confirmEl = walkSection.querySelector("#walk-confirm");
    if (main) main.hidden = show;
    if (confirmEl) confirmEl.hidden = !show;
  }

  function discardWalkChanges(roomId) {
    // Evict the cached checklist too: cached items hold the staged values,
    // so the next visit refetches clean server state.
    checklistDirty.delete(roomId);
    checklistCache.delete(roomId);
  }

  function refreshChecklistSummary(roomId) {
    const items = checklistCache.get(roomId);
    if (!items || items.length === 0) return;
    checklistSummaries.rooms[roomId] = {
      answered: items.filter((it) => it.status).length,
      needsRepair: items.filter((it) => it.status === "Needs Repair").length
    };
    if (!checklistSummaries.totalItems) checklistSummaries.totalItems = items.length;
  }

  // Apply URL filter params on load (supports ?status=OOO links from overview page)
  function applyUrlParams() {
    if (!filtersForm) return;
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of params.entries()) {
      const el = filtersForm.elements[key];
      if (el) el.value = value;
    }
  }

  tokenForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    adminToken = tokenInput.value.trim();
    localStorage.setItem(storageKey, adminToken);
    setStatus(tokenStatus, "Checking access...", "");
    await initializeDashboard();
  });

  filtersForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    selectedRoomId = null;
    pageOffset = 0;
    closeSheet();
    if (mobileQuery.matches) {
      filtersForm.classList.remove("filters-open");
      if (filtersToggle) filtersToggle.setAttribute("aria-expanded", "false");
    }
    await loadRooms(false);
  });

  filtersForm.addEventListener("reset", () => {
    window.setTimeout(() => {
      selectedRoomId = null;
      pageOffset = 0;
      closeSheet();
      loadRooms(false);
    }, 0);
  });

  refreshButton.addEventListener("click", () => {
    pageOffset = 0;
    loadRooms(false);
  });

  roomList.addEventListener("click", (event) => {
    const row = event.target.closest(".application-row");
    if (!row) return;
    selectedRoomId = Number(row.dataset.id);
    renderList();
    openSheet();
  });

  roomDetail.addEventListener("change", (event) => {
    if (event.target.id === "room-status-select" && selectedRoomId) {
      updateRoomStatus(selectedRoomId, event.target.value);
    }
  });

  roomDetail.addEventListener("click", (event) => {
    if (event.target.id === "save-details-btn" && selectedRoomId) {
      saveRoomDetails(selectedRoomId);
    }
    if (event.target.id === "detail-close-btn") {
      closeSheet();
    }
  });

  if (sheetBackdrop) {
    sheetBackdrop.addEventListener("click", closeSheet);
  }

  if (filtersToggle) {
    filtersToggle.addEventListener("click", () => {
      const open = filtersForm.classList.toggle("filters-open");
      filtersToggle.setAttribute("aria-expanded", String(open));
    });
  }

  if (walkButton) {
    walkButton.addEventListener("click", enterWalkMode);
  }

  if (walkSection) {
    walkSection.addEventListener("click", async (event) => {
      const room = rooms[walkIndex];
      const statusBtn = event.target.closest(".walk-status-btn");
      if (statusBtn && room) {
        walkSetStatus(room.id, statusBtn.dataset.status);
        return;
      }
      const checkBtn = event.target.closest(".walk-check-btn");
      if (checkBtn && room) {
        const itemEl = checkBtn.closest(".walk-check-item");
        if (itemEl) {
          stageChecklistChange(room.id, Number(itemEl.dataset.itemId), { status: checkBtn.dataset.status });
          itemEl.querySelectorAll(".walk-check-btn").forEach((b) => {
            b.classList.toggle("active", b === checkBtn);
          });
        }
        return;
      }
      const noteToggle = event.target.closest(".walk-check-note-toggle");
      if (noteToggle) {
        const note = noteToggle.closest(".walk-check-item").querySelector(".walk-check-note");
        note.hidden = !note.hidden;
        if (!note.hidden) note.focus();
        return;
      }
      const id = event.target.id;
      if (id === "walk-return-submit" && room) {
        submitReadyForReturn(room);
      } else if (id === "walk-check-retry" && room) {
        loadWalkChecklist(room.id);
      } else if (id === "walk-exit" || id === "walk-exit-done") {
        exitWalkMode();
      } else if (id === "walk-prev") {
        if (walkIndex > 0) {
          walkIndex = Math.min(walkIndex - 1, rooms.length - 1);
          renderWalk();
        }
      } else if (id === "walk-next" && room) {
        if (walkHasUnsavedChanges(room)) {
          showWalkConfirm(true);
        } else {
          walkIndex += 1;
          renderWalk();
        }
      } else if (id === "walk-confirm-cancel") {
        showWalkConfirm(false);
      } else if (id === "walk-confirm-discard" && room) {
        discardWalkChanges(room.id);
        walkIndex += 1;
        renderWalk();
      } else if ((id === "walk-save-next" || id === "walk-confirm-save") && room) {
        const saveBtn = walkSection.querySelector(`#${id}`);
        if (saveBtn) saveBtn.disabled = true;
        const saved = await saveWalkRoom(room.id);
        if (saveBtn) saveBtn.disabled = false;
        if (saved) {
          walkIndex += 1;
          renderWalk();
        } else {
          // Show the error in the normal action bar rather than the confirm strip.
          showWalkConfirm(false);
        }
      }
    });

    // Stage per-item checklist notes as they are typed.
    walkSection.addEventListener("input", (event) => {
      if (!event.target.classList.contains("walk-check-note")) return;
      const room = rooms[walkIndex];
      const itemEl = event.target.closest(".walk-check-item");
      if (room && itemEl) {
        stageChecklistChange(room.id, Number(itemEl.dataset.itemId), { notes: event.target.value });
      }
    });

    // Remember open/closed state of the collapsible sections between rooms.
    walkSection.addEventListener("toggle", (event) => {
      if (event.target.id === "walk-checklist-section") walkChecklistOpen = event.target.open;
      if (event.target.id === "walk-details-section") walkDetailsOpen = event.target.open;
      if (event.target.id === "walk-return-section") walkReturnOpen = event.target.open;
    }, true);
  }

  applyUrlParams();

  if (adminToken) {
    initializeDashboard();
  }
})();
