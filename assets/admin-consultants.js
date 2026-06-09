(function () {
  const storageKey = "fullstacksAdminToken";
  const statuses = ["New", "Reviewing", "Interview", "Qualified", "Available", "Placed", "Inactive", "Rejected"];
  const assignmentStatuses = ["Proposed", "Contacted", "Interviewing", "Assigned", "Active", "Completed", "Declined", "Removed"];
  let adminToken = localStorage.getItem(storageKey) || "";
  let applications = [];
  let propertyOptions = [];
  const assignmentsByConsultant = new Map();
  let selectedApplicationId = null;
  let pageOffset = 0;
  let pageTotal = 0;
  let pageHasMore = false;

  const siteHeader = document.querySelector("#admin-site-header");
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
  const exportCsvBtn = document.querySelector("#export-csv-btn");

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
    if (siteHeader) siteHeader.hidden = false;
    accessPanel.hidden = true;
    dashboard.hidden = false;
  }

  function showAccess() {
    if (siteHeader) siteHeader.hidden = true;
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

  function renderPagination() {
    const paginationEl = document.querySelector("#admin-pagination");

    if (!paginationEl) {
      return;
    }

    const shown = applications.length;

    if (shown === 0) {
      paginationEl.innerHTML = "";
      return;
    }

    const rangeText = `Showing 1–${shown} of ${pageTotal} application${pageTotal === 1 ? "" : "s"}`;
    let html = `<p class="pagination-info">${rangeText}</p>`;

    if (pageHasMore) {
      html += `<button class="button secondary" id="load-more-btn" type="button">Load More</button>`;
    }

    paginationEl.innerHTML = html;

    const loadMoreBtn = paginationEl.querySelector("#load-more-btn");

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", () => {
        loadApplications(true);
      });
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
        const specialties =
          application.specialtyAreas && application.specialtyAreas.length
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

    const propertyOptionsHtml = propertyOptions
      .map(
        (property) =>
          `<option value="${property.id}">${escapeHtml(`${property.name} - ${property.location || "No location"} - ${property.lifecycleStatus}`)}</option>`
      )
      .join("");
    const assignmentStatusOptions = assignmentStatuses
      .map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`)
      .join("");

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

      <h3 class="detail-section-heading">Client / Property Matches</h3>
      <div class="detail-notes">
        <div id="consultant-assignments">
          <p class="empty-detail">Loading property assignments...</p>
        </div>
        <div class="assignment-create">
          <label for="assignment-property">
            <span>Property</span>
          </label>
          <select id="assignment-property">
            <option value="">Select property</option>
            ${propertyOptionsHtml}
          </select>
          <label for="assignment-role">
            <span>Role / Need</span>
          </label>
          <input id="assignment-role" type="text" maxlength="160" placeholder="Task force GM, housekeeping, revenue, etc." />
          <label for="assignment-status">
            <span>Assignment Status</span>
          </label>
          <select id="assignment-status">${assignmentStatusOptions}</select>
          <label for="assignment-notes">
            <span>Assignment Notes</span>
          </label>
          <textarea id="assignment-notes" maxlength="4000" rows="3" placeholder="Why this consultant may fit this property..."></textarea>
          <div class="detail-notes-footer">
            <p class="form-status" id="assignment-create-status" role="status" aria-live="polite"></p>
            <button class="button secondary" id="create-assignment-btn" type="button">Assign To Property</button>
          </div>
        </div>
      </div>
    `;

    renderAssignments(application.id);
    loadAssignments(application.id);
  }

  function renderAssignments(applicationId) {
    const container = document.querySelector("#consultant-assignments");
    if (!container) return;
    const assignments = assignmentsByConsultant.get(applicationId) || [];

    if (assignments.length === 0) {
      container.innerHTML = '<p class="empty-detail">No property assignments yet.</p>';
      return;
    }

    container.innerHTML = assignments
      .map((assignment) => {
        const statusOptions = assignmentStatuses
          .map(
            (status) =>
              `<option value="${escapeHtml(status)}"${status === assignment.status ? " selected" : ""}>${escapeHtml(status)}</option>`
          )
          .join("");
        return `
          <div class="admin-recent-item assignment-item" data-assignment-id="${assignment.id}">
            <div class="admin-recent-main">
              <strong>${escapeHtml(assignment.propertyName)}</strong>
              <span>${escapeHtml([assignment.role, assignment.propertyLocation, assignment.propertyLifecycleStatus].filter(Boolean).join(" / "))}</span>
              ${assignment.notes ? `<small>${escapeHtml(assignment.notes)}</small>` : ""}
            </div>
            <div class="admin-recent-meta">
              <select class="assignment-status-select" data-assignment-id="${assignment.id}">
                ${statusOptions}
              </select>
            </div>
          </div>
        `;
      })
      .join("");
  }

  async function loadPropertyOptions() {
    const payload = await apiFetch("/api/admin/properties?limit=200");
    propertyOptions = payload.properties || [];
  }

  async function loadAssignments(applicationId) {
    try {
      const payload = await apiFetch(`/api/admin/consultant-applications/${applicationId}/properties`);
      assignmentsByConsultant.set(applicationId, payload.assignments || []);
      if (selectedApplicationId === applicationId) renderAssignments(applicationId);
    } catch (error) {
      const container = document.querySelector("#consultant-assignments");
      if (container) container.innerHTML = `<p class="empty-detail">${escapeHtml(error.message)}</p>`;
    }
  }

  async function loadApplications(append) {
    if (!append) {
      pageOffset = 0;
    }

    setStatus(loadStatus, append ? "Loading more..." : "Loading applications...", "");

    try {
      if (propertyOptions.length === 0) {
        await loadPropertyOptions();
      }
      const params = getFilters();
      params.set("limit", "50");
      params.set("offset", String(pageOffset));

      const payload = await apiFetch(`/api/admin/consultant-applications?${params.toString()}`);
      const incoming = payload.consultants || [];

      pageTotal = payload.total || 0;
      pageHasMore = payload.hasMore || false;
      pageOffset += incoming.length;

      if (append) {
        applications = applications.concat(incoming);
      } else {
        applications = incoming;
        selectedApplicationId = null;
      }

      showDashboard();
      renderList();
      renderPagination();
      setStatus(
        loadStatus,
        `Showing ${applications.length} of ${pageTotal} application${pageTotal === 1 ? "" : "s"}.`,
        "success"
      );
    } catch (error) {
      if (!append) {
        applications = [];
      }

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
      renderPagination();
      setStatus(loadStatus, `Status updated to ${updated.status}.`, "success");
    } catch (error) {
      setStatus(loadStatus, error.message, "error");
      renderDetail(applications.find((application) => application.id === selectedApplicationId));
    }
  }

  async function createAssignment(applicationId) {
    const property = document.querySelector("#assignment-property");
    const role = document.querySelector("#assignment-role");
    const status = document.querySelector("#assignment-status");
    const notes = document.querySelector("#assignment-notes");
    const formStatus = document.querySelector("#assignment-create-status");

    if (!property || !property.value) {
      setStatus(formStatus, "Select a property first.", "error");
      return;
    }

    setStatus(formStatus, "Assigning property...", "");
    try {
      await apiFetch("/api/admin/consultant-assignments", {
        method: "POST",
        body: JSON.stringify({
          propertyId: property.value,
          consultantApplicationId: applicationId,
          role: role ? role.value : "",
          status: status ? status.value : "Proposed",
          notes: notes ? notes.value : ""
        })
      });
      if (role) role.value = "";
      if (notes) notes.value = "";
      await loadAssignments(applicationId);
      setStatus(formStatus, "Property assignment saved.", "success");
    } catch (error) {
      setStatus(formStatus, error.message, "error");
    }
  }

  async function updateAssignmentStatus(assignmentId, status) {
    setStatus(loadStatus, "Updating assignment...", "");
    try {
      const payload = await apiFetch(`/api/admin/consultant-assignments/${assignmentId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      const applicationId = payload.assignment.consultantApplicationId;
      const assignments = assignmentsByConsultant.get(applicationId) || [];
      assignmentsByConsultant.set(
        applicationId,
        assignments.map((assignment) => (assignment.id === payload.assignment.id ? payload.assignment : assignment))
      );
      renderAssignments(applicationId);
      setStatus(loadStatus, `Assignment updated to ${status}.`, "success");
    } catch (error) {
      setStatus(loadStatus, error.message, "error");
      if (selectedApplicationId) renderAssignments(selectedApplicationId);
    }
  }

  populateStatuses();

  tokenForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    adminToken = tokenInput.value.trim();
    localStorage.setItem(storageKey, adminToken);
    setStatus(tokenStatus, "Checking access...", "");
    showDashboard();
    await loadApplications(false);
  });

  filtersForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    selectedApplicationId = null;
    pageOffset = 0;
    await loadApplications(false);
  });

  filtersForm.addEventListener("reset", () => {
    window.setTimeout(() => {
      selectedApplicationId = null;
      pageOffset = 0;
      loadApplications(false);
    }, 0);
  });

  refreshButton.addEventListener("click", () => {
    pageOffset = 0;
    loadApplications(false);
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
    if (event.target.id === "application-status" && selectedApplicationId) {
      updateStatus(selectedApplicationId, event.target.value);
    }

    if (event.target.classList.contains("assignment-status-select")) {
      updateAssignmentStatus(Number(event.target.dataset.assignmentId), event.target.value);
    }
  });

  detail.addEventListener("click", (event) => {
    if (event.target.id === "create-assignment-btn" && selectedApplicationId) {
      createAssignment(selectedApplicationId);
    }
  });

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => {
      const params = getFilters();
      params.set("token", adminToken);
      window.location.href = `/api/admin/consultant-applications/export.csv?${params.toString()}`;
    });
  }

  if (adminToken) {
    showDashboard();
    loadApplications(false);
  }
})();
