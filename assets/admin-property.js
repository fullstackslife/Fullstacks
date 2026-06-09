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
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
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
    try {
      const data = await apiFetch("/api/admin/property/summary");
      renderOverview(data);
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
    await loadSummary();
  });

  refreshButton.addEventListener("click", () => loadSummary());

  if (adminToken) {
    showDashboard();
    loadSummary();
  }
})();
