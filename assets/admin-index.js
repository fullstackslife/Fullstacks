(function () {
  const storageKey = "fullstacksAdminToken";
  const inquiryTracked = ["New", "Reviewing", "Qualified", "Active"];
  const consultantTracked = ["New", "Reviewing", "Qualified", "Available"];
  const roomTracked = ["In Service", "OOO", "Maintenance", "Renovation", "Mothballed"];
  const priorityTracked = ["Critical", "High", "Medium", "Low"];
  let adminToken = localStorage.getItem(storageKey) || "";
  const propertyStorageKey = "fullstacksAdminPropertyId";
  let selectedPropertyId = localStorage.getItem(propertyStorageKey) || "";
  let properties = [];

  const siteHeader = document.querySelector("#admin-site-header");
  const accessPanel = document.querySelector("#admin-access-panel");
  const dashboard = document.querySelector("#admin-dashboard");
  const tokenForm = document.querySelector("#admin-token-form");
  const tokenInput = document.querySelector("#admin-token");
  const tokenStatus = document.querySelector("#admin-token-status");
  const loadStatus = document.querySelector("#admin-load-status");
  const refreshButton = document.querySelector("#admin-refresh");

  function setStatus(element, message, type) {
    if (!element) {
      return;
    }

    element.textContent = message;
    element.classList.remove("success", "error");

    if (type) {
      element.classList.add(type);
    }
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
    if (!value) {
      return "";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  }

  async function apiFetch(url) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      }
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }

    return payload;
  }

  function recoveryApi(path) {
    return selectedPropertyId
      ? `/api/admin/properties/${encodeURIComponent(selectedPropertyId)}${path}`
      : `/api/admin/property${path}`;
  }

  function renderPropertySelector() {
    const anchor = document.querySelector("#property-name");
    const card = anchor ? anchor.closest(".admin-overview-card") : null;
    if (!card || document.querySelector("#admin-property-select")) return;
    const wrap = document.createElement("label");
    wrap.className = "admin-property-picker";
    wrap.innerHTML = `
      <span>Property</span>
      <select id="admin-property-select" aria-label="Select property">
        ${properties
          .map((property) => `<option value="${property.id}">${escapeHtml(property.name || "Property " + property.id)}</option>`)
          .join("")}
      </select>`;
    card.insertBefore(wrap, card.firstChild);
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
      loadSummary();
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
    await loadSummary();
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

  function renderSection(prefix, data, trackedStatuses) {
    const totalEl = document.querySelector(`#${prefix}-total`);
    const countsEl = document.querySelector(`#${prefix}-counts`);
    const recentEl = document.querySelector(`#${prefix}-recent`);

    if (totalEl) {
      totalEl.textContent = data.total;
    }

    if (countsEl) {
      countsEl.innerHTML = trackedStatuses
        .map((status) => {
          const count = data.byStatus[status] || 0;
          return `
            <div class="admin-count-card">
              <strong>${count}</strong>
              <span>${escapeHtml(status)}</span>
            </div>
          `;
        })
        .join("");
    }

    if (recentEl) {
      if (!data.recent || data.recent.length === 0) {
        recentEl.innerHTML = '<p class="empty-detail">No submissions yet.</p>';
        return;
      }

      const heading = `<p class="admin-recent-heading">Recent submissions</p>`;
      const items = data.recent
        .map((item) => {
          const sub = item.currentChallenge || item.currentRole || "";
          return `
            <div class="admin-recent-item">
              <div class="admin-recent-main">
                <strong>${escapeHtml(item.name || "Unknown")}</strong>
                ${sub ? `<span>${escapeHtml(sub)}</span>` : ""}
              </div>
              <div class="admin-recent-meta">
                <span class="status-pill">${escapeHtml(item.status)}</span>
                <small>${escapeHtml(formatDate(item.createdAt))}</small>
              </div>
            </div>
          `;
        })
        .join("");

      recentEl.innerHTML = heading + items;
    }
  }

  function renderCountCards(element, items, values) {
    if (!element) {
      return;
    }

    element.innerHTML = items
      .map((label) => {
        const count = values[label] || 0;
        return `
          <div class="admin-count-card">
            <strong>${count}</strong>
            <span>${escapeHtml(label)}</span>
          </div>
        `;
      })
      .join("");
  }

  function renderPropertySummary(data) {
    const propertyName = document.querySelector("#property-name");
    const propertyLocation = document.querySelector("#property-location");
    const propertyCounts = document.querySelector("#property-counts");
    const propertyPriorities = document.querySelector("#property-priorities");
    const roomsTotal = document.querySelector("#rooms-total");
    const roomsLabel = document.querySelector("#rooms-label");
    const roomsCounts = document.querySelector("#rooms-counts");
    const roomsAlerts = document.querySelector("#rooms-alerts");

    const property = data.property || {};
    const rooms = data.rooms || { total: 0, byStatus: {} };
    const byStatus = rooms.byStatus || {};
    const byPriority = data.oosRoomsByPriority || {};
    const totalRooms = rooms.total || property.totalRooms || 0;
    const inService = byStatus["In Service"] || 0;
    const oooRooms = byStatus.OOO || 0;
    const unavailableRooms = totalRooms - inService;
    const availabilityRate = totalRooms > 0 ? Math.round((inService / totalRooms) * 100) : 0;
    const criticalRooms = byPriority.Critical || 0;
    const highRooms = byPriority.High || 0;

    if (propertyName) {
      propertyName.textContent = property.name || "No active property";
    }

    if (propertyLocation) {
      const locationParts = [property.location, property.brandFlag].filter(Boolean);
      propertyLocation.textContent = locationParts.length > 0 ? locationParts.join(" / ") : "active recovery property";
    }

    renderCountCards(propertyCounts, ["Availability", "OOO Rooms", "High+ Priority"], {
      Availability: `${availabilityRate}%`,
      "OOO Rooms": oooRooms,
      "High+ Priority": criticalRooms + highRooms
    });

    if (propertyPriorities) {
      propertyPriorities.innerHTML = `
        <p class="admin-recent-heading">OOO rooms by priority</p>
        <div class="admin-counts">
          ${priorityTracked
            .map(
              (priority) => `
                <div class="admin-count-card">
                  <strong>${byPriority[priority] || 0}</strong>
                  <span>${escapeHtml(priority)}</span>
                </div>
              `
            )
            .join("")}
        </div>
      `;
    }

    if (roomsTotal) {
      roomsTotal.textContent = totalRooms;
    }

    if (roomsLabel) {
      roomsLabel.textContent = `${inService} in service / ${unavailableRooms} unavailable`;
    }

    renderCountCards(roomsCounts, roomTracked, byStatus);

    if (roomsAlerts) {
      roomsAlerts.innerHTML = `
        <p class="admin-recent-heading">Recovery signals</p>
        <div class="admin-recent-item">
          <div class="admin-recent-main">
            <strong>${availabilityRate}% availability</strong>
            <span>${inService} of ${totalRooms} rooms currently in service</span>
          </div>
          <div class="admin-recent-meta">
            <span class="status-pill">${oooRooms} OOO</span>
          </div>
        </div>
        <div class="admin-recent-item">
          <div class="admin-recent-main">
            <strong>${criticalRooms + highRooms} high-priority rooms</strong>
            <span>${criticalRooms} critical / ${highRooms} high priority</span>
          </div>
          <div class="admin-recent-meta">
            <span class="status-pill">${escapeHtml(property.status || "Active")}</span>
          </div>
        </div>
      `;
    }
  }

  async function loadSummary() {
    setStatus(loadStatus, "Loading...", "");

    try {
      const [adminResult, propertyResult] = await Promise.allSettled([
        apiFetch("/api/admin/summary"),
        apiFetch(recoveryApi("/summary"))
      ]);

      if (adminResult.status === "rejected") {
        throw adminResult.reason;
      }

      renderSection("inquiry", adminResult.value.inquiries, inquiryTracked);
      renderSection("consultant", adminResult.value.consultants, consultantTracked);

      if (propertyResult.status === "fulfilled") {
        renderPropertySummary(propertyResult.value);
      } else {
        renderPropertySummary({ property: null, rooms: { total: 0, byStatus: {} }, oosRoomsByPriority: {} });
      }

      showDashboard();
      setStatus(loadStatus, "", "");
    } catch (error) {
      setStatus(loadStatus, error.message, "error");

      if (/unauthorized|admin access is not configured/i.test(error.message)) {
        localStorage.removeItem(storageKey);
        showAccess();
        setStatus(tokenStatus, error.message, "error");
      }
    }
  }

  tokenForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    adminToken = tokenInput.value.trim();
    localStorage.setItem(storageKey, adminToken);
    setStatus(tokenStatus, "Checking access...", "");
    await initializeDashboard();
  });

  refreshButton.addEventListener("click", () => {
    loadSummary();
  });

  if (adminToken) {
    initializeDashboard();
  }
})();
