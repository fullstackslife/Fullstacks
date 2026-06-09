(function () {
  const storageKey = "fullstacksAdminToken";
  const roomStatuses = ["In Service", "OOO", "Maintenance", "Renovation", "Mothballed"];
  const roomPriorities = ["Low", "Medium", "High", "Critical"];
  let adminToken = localStorage.getItem(storageKey) || "";
  let rooms = [];
  let selectedRoomId = null;
  let pageOffset = 0;
  let pageTotal = 0;
  let pageHasMore = false;

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
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
        ...(options && options.headers ? options.headers : {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Request failed.");
    return payload;
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
        return `
          <button class="application-row${selected}" type="button" data-id="${r.id}">
            <span>
              <strong>Room ${escapeHtml(r.roomNumber)}</strong>
              ${r.oosReason ? `<small>${escapeHtml(r.oosReason.slice(0, 80))}${r.oosReason.length > 80 ? "..." : ""}</small>` : ""}
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
        <div><dt>Priority</dt><dd>${escapeHtml(room.priority || "Medium")}</dd></div>
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
      const payload = await apiFetch(`/api/admin/property/rooms?${params.toString()}`);
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
    } catch (error) {
      if (!append) rooms = [];
      renderCounts();
      renderList();
      renderPagination();
      setStatus(loadStatus, error.message, "error");
      if (/unauthorized|admin access is not configured/i.test(error.message)) {
        localStorage.removeItem(storageKey);
        showAccess();
        setStatus(tokenStatus, error.message, "error");
      }
    }
  }

  async function updateRoomStatus(roomId, status) {
    setStatus(loadStatus, "Updating status...", "");
    try {
      const payload = await apiFetch(`/api/admin/property/rooms/${roomId}/status`, {
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
      const payload = await apiFetch(`/api/admin/property/rooms/${roomId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      rooms = rooms.map((r) => (r.id === roomId ? payload.room : r));
      renderCounts();
      renderList();
      setStatus(saveStatus, "Saved.", "success");
    } catch (error) {
      setStatus(saveStatus, error.message, "error");
    }
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
    showDashboard();
    await loadRooms(false);
  });

  filtersForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    selectedRoomId = null;
    pageOffset = 0;
    await loadRooms(false);
  });

  filtersForm.addEventListener("reset", () => {
    window.setTimeout(() => {
      selectedRoomId = null;
      pageOffset = 0;
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
  });

  applyUrlParams();

  if (adminToken) {
    showDashboard();
    loadRooms(false);
  }
})();
