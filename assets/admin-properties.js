(function () {
  const storageKey = "fullstacksAdminToken";
  const statuses = ["Lead", "Discovery", "Assessment", "Active Recovery", "Monitoring", "Closed Won", "Closed Lost", "Archived"];
  const assignmentStatuses = ["Proposed", "Contacted", "Interviewing", "Assigned", "Active", "Completed", "Declined", "Removed"];
  let adminToken = localStorage.getItem(storageKey) || "";
  let properties = [];
  let consultantOptions = [];
  const assignmentsByProperty = new Map();
  let selectedPropertyId = null;
  let pageOffset = 0;
  let pageTotal = 0;
  let pageHasMore = false;

  const siteHeader = document.querySelector("#admin-site-header");
  const accessPanel = document.querySelector("#admin-access-panel");
  const dashboard = document.querySelector("#admin-dashboard");
  const tokenForm = document.querySelector("#admin-token-form");
  const tokenInput = document.querySelector("#admin-token");
  const tokenStatus = document.querySelector("#admin-token-status");
  const filtersForm = document.querySelector("#property-filters");
  const statusFilter = filtersForm ? filtersForm.querySelector('select[name="lifecycleStatus"]') : null;
  const createPanel = document.querySelector("#property-create-panel");
  const createForm = document.querySelector("#property-create-form");
  const createStatus = document.querySelector("#property-create-status");
  const createStatusSelect = createForm ? createForm.querySelector('select[name="lifecycleStatus"]') : null;
  const addPropertyBtn = document.querySelector("#add-property-btn");
  const cancelCreateBtn = document.querySelector("#cancel-property-create");
  const loadStatus = document.querySelector("#admin-load-status");
  const refreshButton = document.querySelector("#admin-refresh");
  const list = document.querySelector("#property-list");
  const detail = document.querySelector("#property-detail");

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

  function populateStatuses() {
    for (const select of [statusFilter, createStatusSelect]) {
      if (!select) continue;
      const existing = new Set(Array.from(select.options).map((option) => option.value));
      for (const status of statuses) {
        if (existing.has(status)) continue;
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        select.appendChild(option);
      }
    }
    if (createStatusSelect && !createStatusSelect.value) {
      createStatusSelect.value = "Lead";
    }
  }

  function getFilters() {
    const params = new URLSearchParams();
    if (!filtersForm) return params;
    for (const [key, value] of new FormData(filtersForm).entries()) {
      const cleaned = String(value || "").trim();
      if (cleaned) params.set(key, cleaned);
    }
    return params;
  }

  function detailItem(label, value) {
    return `
      <div>
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(value || "Not provided")}</dd>
      </div>
    `;
  }

  function renderPagination() {
    const el = document.querySelector("#admin-pagination");
    if (!el) return;
    if (properties.length === 0) {
      el.innerHTML = "";
      return;
    }

    let html = `<p class="pagination-info">Showing ${properties.length} of ${pageTotal} propert${pageTotal === 1 ? "y" : "ies"}</p>`;
    if (pageHasMore) {
      html += `<button class="button secondary" id="load-more-btn" type="button">Load More</button>`;
    }
    el.innerHTML = html;
    const button = el.querySelector("#load-more-btn");
    if (button) button.addEventListener("click", () => loadProperties(true));
  }

  function renderList() {
    if (!list) return;

    if (properties.length === 0) {
      list.innerHTML = '<p class="empty-detail">No properties match the current filters.</p>';
      renderDetail(null);
      return;
    }

    if (!selectedPropertyId || !properties.some((property) => property.id === selectedPropertyId)) {
      selectedPropertyId = properties[0].id;
    }

    list.innerHTML = properties
      .map((property) => {
        const selected = property.id === selectedPropertyId ? " selected" : "";
        const contact = property.primaryContactName || property.company || property.primaryContactEmail || "No contact listed";
        const challenge = property.currentChallenge || property.urgency || "";
        return `
          <button class="application-row${selected}" type="button" data-id="${property.id}">
            <span>
              <strong>${escapeHtml(property.name)}</strong>
              <small>${escapeHtml(property.location || property.brandFlag || "No location listed")}</small>
            </span>
            <span>
              ${escapeHtml(contact)}
              ${challenge ? `<small>${escapeHtml(challenge)}</small>` : ""}
            </span>
            <span class="status-pill">${escapeHtml(property.lifecycleStatus)}</span>
          </button>
        `;
      })
      .join("");

    renderDetail(properties.find((property) => property.id === selectedPropertyId));
  }

  function renderDetail(property) {
    if (!detail) return;

    if (!property) {
      detail.innerHTML = `
        <p class="section-kicker">Property Details</p>
        <p class="empty-detail">Select a property to view onboarding details.</p>
      `;
      return;
    }

    const statusOptions = statuses
      .map(
        (status) =>
          `<option value="${escapeHtml(status)}"${status === property.lifecycleStatus ? " selected" : ""}>${escapeHtml(status)}</option>`
      )
      .join("");
    const consultantOptionsHtml = consultantOptions
      .map(
        (consultant) =>
          `<option value="${consultant.id}">${escapeHtml(`${consultant.name} - ${consultant.currentRole || "Consultant"} - ${consultant.availability || "Availability TBD"}`)}</option>`
      )
      .join("");
    const assignmentStatusOptions = assignmentStatuses
      .map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`)
      .join("");

    detail.innerHTML = `
      <div class="detail-heading">
        <div>
          <p class="section-kicker">Property Details</p>
          <h2>${escapeHtml(property.name)}</h2>
          <p>${escapeHtml([property.location, property.brandFlag].filter(Boolean).join(" / "))}</p>
        </div>
        <label>
          <span>Status</span>
          <select id="property-lifecycle-status">${statusOptions}</select>
        </label>
      </div>

      <h3 class="detail-section-heading">Property Profile</h3>
      <dl class="detail-grid">
        ${detailItem("Property Name", property.name)}
        ${detailItem("Location", property.location)}
        ${detailItem("Brand / Flag", property.brandFlag)}
        ${detailItem("Room Count", property.totalRooms)}
        ${detailItem("Company", property.company)}
        ${detailItem("Management Company", property.managementCompany)}
      </dl>

      <h3 class="detail-section-heading">Primary Contact</h3>
      <dl class="detail-grid">
        ${detailItem("Name", property.primaryContactName)}
        ${detailItem("Email", property.primaryContactEmail)}
        ${detailItem("Phone", property.primaryContactPhone)}
        ${detailItem("Relationship", property.propertyRelationship)}
      </dl>

      <h3 class="detail-section-heading">Onboarding</h3>
      <dl class="detail-grid">
        ${detailItem("Current Challenge", property.currentChallenge)}
        ${detailItem("Urgency", property.urgency)}
        ${detailItem("Created", formatDate(property.createdAt))}
        ${detailItem("Source Inquiry", property.sourceInquiryId ? `#${property.sourceInquiryId}` : "")}
      </dl>
      <div class="detail-message">
        <p class="detail-message-label">Onboarding Notes</p>
        <p>${escapeHtml(property.onboardingNotes || property.notes || "No notes yet.")}</p>
      </div>

      <h3 class="detail-section-heading">Consultant Matches</h3>
      <div class="detail-notes">
        <div id="property-assignments">
          <p class="empty-detail">Loading consultant assignments...</p>
        </div>
        <div class="assignment-create">
          <label for="assignment-consultant">
            <span>Consultant</span>
          </label>
          <select id="assignment-consultant">
            <option value="">Select consultant</option>
            ${consultantOptionsHtml}
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
            <button class="button secondary" id="create-assignment-btn" type="button">Assign Consultant</button>
          </div>
        </div>
      </div>
    `;

    renderAssignments(property.id);
    loadAssignments(property.id);
  }

  function renderAssignments(propertyId) {
    const container = document.querySelector("#property-assignments");
    if (!container) return;
    const assignments = assignmentsByProperty.get(propertyId) || [];

    if (assignments.length === 0) {
      container.innerHTML = '<p class="empty-detail">No consultants assigned yet.</p>';
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
              <strong>${escapeHtml(assignment.consultantName)}</strong>
              <span>${escapeHtml([assignment.role, assignment.consultantRole, assignment.consultantAvailability].filter(Boolean).join(" / "))}</span>
              ${assignment.notes ? `<small>${escapeHtml(assignment.notes)}</small>` : ""}
            </div>
            <div class="admin-recent-meta">
              <select class="assignment-status-select" data-assignment-id="${assignment.id}">
                ${statusOptions}
              </select>
              <button class="button secondary remove-assignment-btn" data-assignment-id="${assignment.id}" type="button">Remove</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  async function loadConsultantOptions() {
    const payload = await apiFetch("/api/admin/consultant-applications?limit=200");
    consultantOptions = payload.consultants || [];
  }

  async function loadAssignments(propertyId) {
    try {
      const payload = await apiFetch(`/api/admin/properties/${propertyId}/consultants`);
      assignmentsByProperty.set(propertyId, payload.assignments || []);
      if (selectedPropertyId === propertyId) renderAssignments(propertyId);
    } catch (error) {
      const container = document.querySelector("#property-assignments");
      if (container) container.innerHTML = `<p class="empty-detail">${escapeHtml(error.message)}</p>`;
    }
  }

  async function loadProperties(append) {
    if (!append) pageOffset = 0;
    setStatus(loadStatus, append ? "Loading more..." : "Loading properties...", "");

    try {
      if (consultantOptions.length === 0) {
        await loadConsultantOptions();
      }
      const params = getFilters();
      params.set("limit", "50");
      params.set("offset", String(pageOffset));
      const payload = await apiFetch(`/api/admin/properties?${params.toString()}`);
      const incoming = payload.properties || [];
      pageTotal = payload.total || 0;
      pageHasMore = payload.hasMore || false;
      pageOffset += incoming.length;
      properties = append ? properties.concat(incoming) : incoming;
      if (!append) selectedPropertyId = null;
      showDashboard();
      renderList();
      renderPagination();
      setStatus(loadStatus, `Showing ${properties.length} of ${pageTotal} propert${pageTotal === 1 ? "y" : "ies"}.`, "success");
    } catch (error) {
      if (!append) properties = [];
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

  async function createProperty() {
    const formData = new FormData(createForm);
    const body = {};
    for (const [key, value] of formData.entries()) {
      body[key] = String(value || "").trim();
    }

    setStatus(createStatus, "Creating property...", "");
    try {
      const payload = await apiFetch("/api/admin/properties", {
        method: "POST",
        body: JSON.stringify(body)
      });
      createForm.reset();
      if (createStatusSelect) createStatusSelect.value = "Lead";
      createPanel.hidden = true;
      selectedPropertyId = payload.property.id;
      await loadProperties(false);
      selectedPropertyId = payload.property.id;
      renderList();
      setStatus(loadStatus, "Property created.", "success");
    } catch (error) {
      setStatus(createStatus, error.message, "error");
    }
  }

  async function updateLifecycleStatus(propertyId, lifecycleStatus) {
    setStatus(loadStatus, "Updating property status...", "");
    try {
      const payload = await apiFetch(`/api/admin/properties/${propertyId}/lifecycle-status`, {
        method: "PATCH",
        body: JSON.stringify({ lifecycleStatus })
      });
      properties = properties.map((property) => (property.id === propertyId ? payload.property : property));
      selectedPropertyId = propertyId;
      renderList();
      setStatus(loadStatus, `Property moved to ${lifecycleStatus}.`, "success");
    } catch (error) {
      setStatus(loadStatus, error.message, "error");
      renderDetail(properties.find((property) => property.id === selectedPropertyId));
    }
  }

  async function createAssignment(propertyId) {
    const consultant = document.querySelector("#assignment-consultant");
    const role = document.querySelector("#assignment-role");
    const status = document.querySelector("#assignment-status");
    const notes = document.querySelector("#assignment-notes");
    const formStatus = document.querySelector("#assignment-create-status");

    if (!consultant || !consultant.value) {
      setStatus(formStatus, "Select a consultant first.", "error");
      return;
    }

    setStatus(formStatus, "Assigning consultant...", "");
    try {
      await apiFetch("/api/admin/consultant-assignments", {
        method: "POST",
        body: JSON.stringify({
          propertyId,
          consultantApplicationId: consultant.value,
          role: role ? role.value : "",
          status: status ? status.value : "Proposed",
          notes: notes ? notes.value : ""
        })
      });
      if (role) role.value = "";
      if (notes) notes.value = "";
      await loadAssignments(propertyId);
      setStatus(formStatus, "Consultant assignment saved.", "success");
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
      const propertyId = payload.assignment.propertyId;
      const assignments = assignmentsByProperty.get(propertyId) || [];
      assignmentsByProperty.set(
        propertyId,
        assignments.map((assignment) => (assignment.id === payload.assignment.id ? payload.assignment : assignment))
      );
      renderAssignments(propertyId);
      setStatus(loadStatus, `Assignment updated to ${status}.`, "success");
    } catch (error) {
      setStatus(loadStatus, error.message, "error");
      if (selectedPropertyId) renderAssignments(selectedPropertyId);
    }
  }

  async function removeAssignment(assignmentId) {
    setStatus(loadStatus, "Removing assignment...", "");
    try {
      await apiFetch(`/api/admin/consultant-assignments/${assignmentId}`, { method: "DELETE" });
      if (selectedPropertyId) {
        await loadAssignments(selectedPropertyId);
      }
      setStatus(loadStatus, "Assignment removed.", "success");
    } catch (error) {
      setStatus(loadStatus, error.message, "error");
    }
  }

  populateStatuses();

  tokenForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    adminToken = tokenInput.value.trim();
    localStorage.setItem(storageKey, adminToken);
    setStatus(tokenStatus, "Checking access...", "");
    showDashboard();
    await loadProperties(false);
  });

  filtersForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    selectedPropertyId = null;
    pageOffset = 0;
    await loadProperties(false);
  });

  filtersForm.addEventListener("reset", () => {
    window.setTimeout(() => {
      selectedPropertyId = null;
      pageOffset = 0;
      loadProperties(false);
    }, 0);
  });

  addPropertyBtn.addEventListener("click", () => {
    createPanel.hidden = !createPanel.hidden;
    setStatus(createStatus, "", "");
  });

  cancelCreateBtn.addEventListener("click", () => {
    createPanel.hidden = true;
    setStatus(createStatus, "", "");
  });

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createProperty();
  });

  refreshButton.addEventListener("click", () => loadProperties(false));

  list.addEventListener("click", (event) => {
    const row = event.target.closest(".application-row");
    if (!row) return;
    selectedPropertyId = Number(row.dataset.id);
    renderList();
  });

  detail.addEventListener("change", (event) => {
    if (event.target.id === "property-lifecycle-status" && selectedPropertyId) {
      updateLifecycleStatus(selectedPropertyId, event.target.value);
    }

    if (event.target.classList.contains("assignment-status-select")) {
      updateAssignmentStatus(Number(event.target.dataset.assignmentId), event.target.value);
    }
  });

  detail.addEventListener("click", (event) => {
    if (event.target.id === "create-assignment-btn" && selectedPropertyId) {
      createAssignment(selectedPropertyId);
    }

    if (event.target.classList.contains("remove-assignment-btn")) {
      removeAssignment(Number(event.target.dataset.assignmentId));
    }
  });

  if (adminToken) {
    showDashboard();
    loadProperties(false);
  }
})();
