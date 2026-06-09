(function () {
  const storageKey = "fullstacksAdminToken";
  const inquiryTracked = ["New", "Reviewing", "Qualified", "Active"];
  const consultantTracked = ["New", "Reviewing", "Qualified", "Available"];
  let adminToken = localStorage.getItem(storageKey) || "";

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

  function showDashboard() {
    accessPanel.hidden = true;
    dashboard.hidden = false;
  }

  function showAccess() {
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

  async function loadSummary() {
    setStatus(loadStatus, "Loading...", "");

    try {
      const payload = await apiFetch("/api/admin/summary");
      renderSection("inquiry", payload.inquiries, inquiryTracked);
      renderSection("consultant", payload.consultants, consultantTracked);
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

  refreshButton.addEventListener("click", () => {
    loadSummary();
  });

  if (adminToken) {
    showDashboard();
    loadSummary();
  }
})();
