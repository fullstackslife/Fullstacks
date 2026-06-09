(function () {
  const storageKey = "fullstacksAdminToken";
  const statuses = ["New", "Reviewing", "Interview", "Qualified", "Available", "Placed", "Inactive", "Rejected"];
  let adminToken = localStorage.getItem(storageKey) || "";
  let applications = [];
  let selectedApplicationId = null;

  const accessPanel = document.querySelector("#admin-access-panel");
  const dashboard = document.querySelector("#admin-dashboard");
  const tokenForm = document.querySelector("#admin-token-form");
  const tokenInput = document.querySelector("#admin-token");
  const tokenStatus = document.querySelector("#admin-token-status");
  const filtersForm = document.querySelector("#consultant-filters");
  const statusFilter = filtersForm ? filtersForm.querySelector('select[name="status"]') : null;
  const loadStatus = document.querySelector("#admin-load-status");
  const list = document.querySelector("#application-list");
  const detail = document.querySelector("#application-detail");
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

  function getFilters() {
    const formData = new FormData(filtersForm);
    const params = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      const cleaned = String(value || "").trim();

      if (cleaned) {
        params.set(key, cleaned);
      }
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

  function populateStatuses() {
    if (!statusFilter) {
      return;
    }

    for (const status of statuses) {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      statusFilter.appendChild(option);
    }
  }

  function renderList() {
    if (!list) {
      return;
    }

    if (applications.length === 0) {
      list.innerHTML = '<p class="empty-detail">No consultant applications match the current filters.</p>';
      renderDetail(null);
      return;
    }

    if (!selectedApplicationId || !applications.some((application) => application.id === selectedApplicationId)) {
      selectedApplicationId = applications[0].id;
    }

    list.innerHTML = applications
      .map((application) => {
        const selected = application.id === selectedApplicationId ? " selected" : "";
        const specialties = application.specialtyAreas && application.specialtyAreas.length
          ? application.specialtyAreas.join(", ")
          : "No specialties listed";

        return `
          <button class="application-row${selected}" type="button" data-id="${application.id}">
            <span>
              <strong>${escapeHtml(application.name)}</strong>
              <small>${escapeHtml(formatDate(application.createdAt))} &middot; ${escapeHtml(application.email)}</small>
              <small>${escapeHtml(application.phone)} &middot; ${escapeHtml(application.city)}, ${escapeHtml(application.state)}</small>
            </span>
            <span>
              <strong>${escapeHtml(application.currentRole)}</strong>
              <small>${escapeHtml(application.yearsExperience)} &middot; ${escapeHtml(application.travelPreference)}</small>
              <small>${escapeHtml(application.availability)}</small>
              <small>${escapeHtml(specialties)}</small>
            </span>
            <span class="status-pill">${escapeHtml(application.status)}</span>
          </button>
        `;
      })
      .join("");

    renderDetail(applications.find((application) => application.id === selectedApplicationId));
  }

  function detailItem(label, value) {
    const displayValue = Array.isArray(value) ? value.join(", ") : value;
    return `
      <div>
        <dt>${escapeHtml(label)}</dt>
        <dd>${displayValue ? escapeHtml(displayValue) : "Not provided"}</dd>
      </div>
    `;
  }

  function linkItem(label, value) {
    if (!value) {
      return detailItem(label, "");
    }

    return `
      <div>
        <dt>${escapeHtml(label)}</dt>
        <dd><a href="${escapeHtml(value)}" target="_blank" rel="noreferrer">${escapeHtml(value)}</a></dd>
      </div>
    `;
  }

  function renderDetail(application) {
    if (!detail) {
      return;
    }

    if (!application) {
      detail.innerHTML = `
        <p class="section-kicker">Applicant Details</p>
        <p class="empty-detail">Select an application to view full details.</p>
      `;
      return;
    }

    detail.innerHTML = `
      <div class="detail-heading">
        <div>
          <p class="section-kicker">Applicant Details</p>
          <h2>${escapeHtml(application.name)}</h2>
          <p>${escapeHtml(application.currentRole)}</p>
        </div>
        <label>
          <span>Status</span>
          <select id="application-status">
            ${statuses
              .map(
                (status) =>
                  `<option value="${escapeHtml(status)}"${status === application.status ? " selected" : ""}>${escapeHtml(status)}</option>`
              )
              .join("")}
          </select>
        </label>
      </div>
      <dl class="detail-grid">
        ${detailItem("Created", formatDate(application.createdAt))}
        ${detailItem("Email", application.email)}
        ${detailItem("Phone", application.phone)}
        ${detailItem("Location", `${application.city}, ${application.state}`)}
        ${detailItem("Years Experience", application.yearsExperience)}
        ${detailItem("Travel Preference", application.travelPreference)}
        ${detailItem("Availability", application.availability)}
        ${detailItem("Specialty Areas", application.specialtyAreas)}
        ${detailItem("Brands Worked With", application.brandsWorkedWith)}
        ${detailItem("Management Companies", application.managementCompanies)}
        ${linkItem("LinkedIn URL", application.linkedinUrl)}
        ${linkItem("Resume URL", application.resumeUrl)}
        ${detailItem("Compensation Expectations", application.compensationExpectations)}
        ${detailItem("Notes / Message", application.notes)}
      </dl>
    `;
  }

  async function loadApplications() {
    setStatus(loadStatus, "Loading applications...", "");

    try {
      const params = getFilters();
      const query = params.toString();
      const payload = await apiFetch(`/api/admin/consultant-applications${query ? `?${query}` : ""}`);
      applications = payload.applications || [];
      showDashboard();
      renderList();
      setStatus(loadStatus, `${applications.length} application${applications.length === 1 ? "" : "s"} loaded.`, "success");
    } catch (error) {
      applications = [];
      renderList();
      setStatus(loadStatus, error.message, "error");

      if (/unauthorized|admin access is not configured/i.test(error.message)) {
        localStorage.removeItem(storageKey);
        showAccess();
        setStatus(tokenStatus, error.message, "error");
      }
    }
  }

  async function updateStatus(applicationId, status) {
    setStatus(loadStatus, "Updating status...", "");

    try {
      const payload = await apiFetch(`/api/admin/consultant-applications/${applicationId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      const updated = payload.application;
      applications = applications.map((application) => (application.id === updated.id ? updated : application));
      selectedApplicationId = updated.id;
      renderList();
      setStatus(loadStatus, `Status updated to ${updated.status}.`, "success");
    } catch (error) {
      setStatus(loadStatus, error.message, "error");
      renderDetail(applications.find((application) => application.id === selectedApplicationId));
    }
  }

  populateStatuses();

  tokenForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    adminToken = tokenInput.value.trim();
    localStorage.setItem(storageKey, adminToken);
    setStatus(tokenStatus, "Checking access...", "");
    showDashboard();
    await loadApplications();
  });

  filtersForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    selectedApplicationId = null;
    await loadApplications();
  });

  filtersForm.addEventListener("reset", () => {
    window.setTimeout(() => {
      selectedApplicationId = null;
      loadApplications();
    }, 0);
  });

  refreshButton.addEventListener("click", () => {
    loadApplications();
  });

  list.addEventListener("click", (event) => {
    const row = event.target.closest(".application-row");

    if (!row) {
      return;
    }

    selectedApplicationId = Number(row.dataset.id);
    renderList();
  });

  detail.addEventListener("change", (event) => {
    if (event.target.id !== "application-status" || !selectedApplicationId) {
      return;
    }

    updateStatus(selectedApplicationId, event.target.value);
  });

  if (adminToken) {
    showDashboard();
    loadApplications();
  }
})();
