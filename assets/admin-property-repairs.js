(function () {
  const storageKey = "fullstacksAdminToken";
  let adminToken = localStorage.getItem(storageKey) || "";

  const mobileQuery = window.matchMedia("(max-width: 680px)");

  const siteHeader = document.querySelector("#admin-site-header");
  const accessPanel = document.querySelector("#admin-access-panel");
  const dashboard = document.querySelector("#admin-dashboard");
  const tokenForm = document.querySelector("#admin-token-form");
  const tokenInput = document.querySelector("#admin-token");
  const tokenStatus = document.querySelector("#admin-token-status");
  const filtersForm = document.querySelector("#repair-filters");
  const filtersToggle = document.querySelector("#toggle-filters-btn");
  const groupFilter = document.querySelector("#group-filter");
  const loadStatus = document.querySelector("#admin-load-status");
  const refreshButton = document.querySelector("#admin-refresh");
  const reportEl = document.querySelector("#repairs-report");

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

  async function apiFetch(url) {
    let response;
    try {
      response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
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

  function getFilters() {
    const params = new URLSearchParams();
    if (!filtersForm) return params;
    for (const [key, value] of new FormData(filtersForm).entries()) {
      const v = String(value || "").trim();
      if (v) params.set(key, v);
    }
    return params;
  }

  function populateGroupFilter(groups) {
    if (!groupFilter) return;
    const current = groupFilter.value;
    groupFilter.innerHTML =
      '<option value="">All groups</option>' +
      groups.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
    if (current && groups.includes(current)) groupFilter.value = current;
  }

  function renderReport(repairs) {
    if (!reportEl) return;
    if (repairs.length === 0) {
      reportEl.innerHTML = '<p class="empty-detail">No checklist items are marked Needs Repair for the current filters.</p>';
      return;
    }

    // Group flat rows into one card per room, preserving server sort order.
    const cards = [];
    for (const row of repairs) {
      let card = cards[cards.length - 1];
      if (!card || card.roomId !== row.roomId) {
        card = {
          roomId: row.roomId,
          roomNumber: row.roomNumber,
          floor: row.floor,
          roomStatus: row.roomStatus,
          roomPriority: row.roomPriority,
          oosReason: row.oosReason,
          items: []
        };
        cards.push(card);
      }
      card.items.push(row);
    }

    reportEl.innerHTML = cards
      .map(
        (card) => `
        <article class="repair-card">
          <header class="repair-card-header">
            <div class="repair-card-room">
              <span class="repair-room-number">${escapeHtml(card.roomNumber)}</span>
              <span class="repair-room-meta">${card.floor != null ? `Floor ${card.floor}` : ""}${card.roomPriority ? ` · ${escapeHtml(card.roomPriority)} priority` : ""}</span>
            </div>
            <span class="status-pill">${escapeHtml(card.roomStatus)}</span>
          </header>
          ${card.oosReason ? `<p class="repair-oos">OOS: ${escapeHtml(card.oosReason)}</p>` : ""}
          <ul class="repair-items">
            ${card.items
              .map(
                (item) => `
              <li class="repair-item">
                <p class="repair-item-group">${escapeHtml(item.group)}</p>
                <p class="repair-item-label">${escapeHtml(item.item)}</p>
                ${item.notes ? `<p class="repair-item-notes">${escapeHtml(item.notes)}</p>` : ""}
                <time class="repair-item-updated" datetime="${escapeHtml(item.updatedAt || "")}">Updated ${escapeHtml(formatDate(item.updatedAt))}</time>
              </li>`
              )
              .join("")}
          </ul>
        </article>`
      )
      .join("");
  }

  async function loadReport() {
    setStatus(loadStatus, "Loading report...", "");
    try {
      const params = getFilters();
      const payload = await apiFetch(`/api/admin/property/repairs?${params.toString()}`);
      populateGroupFilter(payload.groups || []);
      const repairs = payload.repairs || [];
      const roomCount = new Set(repairs.map((r) => r.roomId)).size;
      renderReport(repairs);
      showDashboard();
      setStatus(
        loadStatus,
        `${payload.total} repair item${payload.total === 1 ? "" : "s"} across ${roomCount} room${roomCount === 1 ? "" : "s"}.`,
        "success"
      );
    } catch (error) {
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

  tokenForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    adminToken = tokenInput.value.trim();
    localStorage.setItem(storageKey, adminToken);
    setStatus(tokenStatus, "Checking access...", "");
    showDashboard();
    await loadReport();
  });

  filtersForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (mobileQuery.matches) {
      filtersForm.classList.remove("filters-open");
      if (filtersToggle) filtersToggle.setAttribute("aria-expanded", "false");
    }
    await loadReport();
  });

  filtersForm.addEventListener("reset", () => {
    window.setTimeout(() => loadReport(), 0);
  });

  if (filtersToggle) {
    filtersToggle.addEventListener("click", () => {
      const open = filtersForm.classList.toggle("filters-open");
      filtersToggle.setAttribute("aria-expanded", String(open));
    });
  }

  refreshButton.addEventListener("click", () => loadReport());

  if (adminToken) {
    showDashboard();
    loadReport();
  }
})();
