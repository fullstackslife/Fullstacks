(function () {
  const storageKey = "fullstacksAdminToken";
  let adminToken = localStorage.getItem(storageKey) || "";

  const siteHeader = document.querySelector("#admin-site-header");
  const accessPanel = document.querySelector("#admin-access-panel");
  const dashboard = document.querySelector("#admin-dashboard");
  const tokenForm = document.querySelector("#admin-token-form");
  const tokenInput = document.querySelector("#admin-token");
  const tokenStatus = document.querySelector("#admin-token-status");
  const loadStatus = document.querySelector("#admin-load-status");
  const refreshButton = document.querySelector("#admin-refresh");
  const overviewGrid = document.querySelector("#admin-overview-grid");

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

  function renderOverview(data) {
    const { property, rooms, oosRoomsByPriority } = data;
    if (!property || !rooms) {
      overviewGrid.innerHTML = '<p class="empty-detail">No property data found.</p>';
      return;
    }

    const inService = rooms.byStatus["In Service"] || 0;
    const total = rooms.total || 0;
    const availPct = total > 0 ? Math.round((inService / total) * 100) : 0;

    const statusCards = (rooms.statuses || [])
      .map((s) => {
        const count = rooms.byStatus[s] || 0;
        return `
          <div class="admin-count-card">
            <strong>${count}</strong>
            <span>${escapeHtml(s)}</span>
          </div>`;
      })
      .join("");

    const priorityOrder = ["Critical", "High", "Medium", "Low"];
    const priorityCards = priorityOrder
      .map((p) => {
        const count = oosRoomsByPriority[p] || 0;
        return `
          <div class="admin-count-card">
            <strong>${count}</strong>
            <span>${escapeHtml(p)}</span>
          </div>`;
      })
      .join("");

    overviewGrid.innerHTML = `
      <div class="admin-overview-grid">
        <div class="admin-overview-card">
          <div class="admin-overview-header">
            <div>
              <p class="section-kicker">${escapeHtml(property.brandFlag || "")}</p>
              <p class="admin-overview-total" style="font-size:2rem">${escapeHtml(property.name)}</p>
              <p class="admin-overview-total-label">${escapeHtml(property.location || "")}</p>
            </div>
            <a href="/admin/property/rooms" class="button primary">View Rooms</a>
          </div>
        </div>

        <div class="admin-overview-card">
          <div class="admin-overview-header">
            <div>
              <p class="section-kicker">Availability Rate</p>
              <p class="admin-overview-total">${availPct}%</p>
              <p class="admin-overview-total-label">${inService} of ${total} rooms in service</p>
            </div>
          </div>
          <div class="admin-counts" aria-label="Rooms by status">
            ${statusCards}
          </div>
        </div>

        <div class="admin-overview-card">
          <div class="admin-overview-header">
            <div>
              <p class="section-kicker">OOO Rooms by Priority</p>
              <p class="admin-overview-total">${rooms.byStatus["OOO"] || 0}</p>
              <p class="admin-overview-total-label">rooms out of order</p>
            </div>
            <a href="/admin/property/rooms?status=OOO" class="button primary">View OOO</a>
          </div>
          <div class="admin-counts" aria-label="OOO rooms by priority">
            ${priorityCards}
          </div>
        </div>
      </div>
    `;
  }

  async function loadSummary() {
    setStatus(loadStatus, "Loading...", "");
    let data;
    try {
      data = await apiFetch("/api/admin/property/summary");
    } catch (error) {
      let message = error.message;
      if (error.status === 401) {
        message = "Unauthorized — your admin token was rejected. Enter it again.";
      } else if (error.status === 503) {
        message = `${error.message} (HTTP 503 — server-side configuration issue.)`;
      } else if (error.status >= 500) {
        message = `${error.message} (HTTP ${error.status} — server error. Check the deploy logs.)`;
      }
      setStatus(loadStatus, message, "error");
      if (error.status === 401 || error.status === 503) {
        localStorage.removeItem(storageKey);
        showAccess();
        setStatus(tokenStatus, message, "error");
      }
      return;
    }
    try {
      renderOverview(data);
    } catch (error) {
      setStatus(loadStatus, `Display error: ${error.message}. Hard-refresh this page (the script may be cached).`, "error");
      return;
    }
    showDashboard();
    setStatus(loadStatus, "", "");
  }

  tokenForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    adminToken = tokenInput.value.trim();
    localStorage.setItem(storageKey, adminToken);
    setStatus(tokenStatus, "Checking access...", "");
    await loadSummary();
  });

  refreshButton.addEventListener("click", () => loadSummary());

  if (adminToken) {
    showDashboard();
    loadSummary();
  }
})();
