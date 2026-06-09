(function () {
  const storageKey = "fullstacksAdminToken";
  const statuses = ["New", "Reviewing", "Contacted", "Qualified", "Proposal", "Active", "Closed", "Lost", "Archived"];
  let adminToken = localStorage.getItem(storageKey) || "";
  let inquiries = [];
  let selectedInquiryId = null;
  let pageOffset = 0;
  let pageTotal = 0;
  let pageHasMore = false;

  const accessPanel = document.querySelector("#admin-access-panel");
  const dashboard = document.querySelector("#admin-dashboard");
  const tokenForm = document.querySelector("#admin-token-form");
  const tokenInput = document.querySelector("#admin-token");
  const tokenStatus = document.querySelector("#admin-token-status");
  const filtersForm = document.querySelector("#inquiry-filters");
  const statusFilter = filtersForm ? filtersForm.querySelector('select[name="status"]') : null;
  const loadStatus = document.querySelector("#admin-load-status");
  const list = document.querySelector("#application-list");
  const detail = document.querySelector("#application-detail");
  const refreshButton = document.querySelector("#admin-refresh");
  const countsBar = document.querySelector("#admin-counts");
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

  function renderCounts() {
    if (!countsBar) {
      return;
    }

    const tracked = ["New", "Reviewing", "Qualified", "Active"];
    const counts = {};

    for (const s of tracked) {
      counts[s] = 0;
    }

    for (const inquiry of inquiries) {
      if (Object.prototype.hasOwnProperty.call(counts, inquiry.status)) {
        counts[inquiry.status]++;
      }
    }

    countsBar.innerHTML = tracked
      .map(
        (s) => `
          <div class="admin-count-card">
            <strong>${counts[s]}</strong>
            <span>${escapeHtml(s)}</span>
          </div>
        `
      )
      .join("");
  }

  function renderPagination() {
    const paginationEl = document.querySelector("#admin-pagination");

    if (!paginationEl) {
      return;
    }

    const shown = inquiries.length;

    if (shown === 0) {
      paginationEl.innerHTML = "";
      return;
    }

    const rangeText = `Showing 1–${shown} of ${pageTotal} inquir${pageTotal === 1 ? "y" : "ies"}`;
    let html = `<p class="pagination-info">${rangeText}</p>`;

    if (pageHasMore) {
      html += `<button class="button secondary" id="load-more-btn" type="button">Load More</button>`;
    }

    paginationEl.innerHTML = html;

    const loadMoreBtn = paginationEl.querySelector("#load-more-btn");

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", () => {
        loadInquiries(true);
      });
    }
  }

  function renderList() {
    if (!list) {
      return;
    }

    if (inquiries.length === 0) {
      list.innerHTML = '<p class="empty-detail">No inquiries match the current filters.</p>';
      renderDetail(null);
      return;
    }

    if (!selectedInquiryId || !inquiries.some((inq) => inq.id === selectedInquiryId)) {
      selectedInquiryId = inquiries[0].id;
    }

    list.innerHTML = inquiries
      .map((inq) => {
        const selected = inq.id === selectedInquiryId ? " selected" : "";
        const property = inq.propertyName || inq.company || "No property listed";

        return `
          <button class="application-row${selected}" type="button" data-id="${inq.id}">
            <span>
              <strong>${escapeHtml(property)}</strong>
              <small>${escapeHtml(inq.name)} &middot; ${escapeHtml(inq.email)}</small>
              <small>${escapeHtml(formatDate(inq.createdAt))}</small>
            </span>
            <span>
              <strong>${escapeHtml(inq.currentChallenge || "Not specified")}</strong>
              <small>${escapeHtml(inq.urgency || "")}</small>
            </span>
            <span class="status-pill">${escapeHtml(inq.status)}</span>
          </button>
        `;
      })
      .join("");

    renderDetail(inquiries.find((inq) => inq.id === selectedInquiryId));
  }

  function detailItem(label, value) {
    return `
      <div>
        <dt>${escapeHtml(label)}</dt>
        <dd>${value ? escapeHtml(String(value)) : "Not provided"}</dd>
      </div>
    `;
  }

  function renderDetail(inq) {
    if (!detail) {
      return;
    }

    if (!inq) {
      detail.innerHTML = `
        <p class="section-kicker">Inquiry Details</p>
        <p class="empty-detail">Select an inquiry to view full details.</p>
      `;
      return;
    }

    detail.innerHTML = `
      <div class="detail-heading">
        <div>
          <p class="section-kicker">Inquiry Details</p>
          <h2>${escapeHtml(inq.propertyName || inq.company || inq.name)}</h2>
          <p>${escapeHtml(inq.currentChallenge || "")}</p>
        </div>
        <label>
          <span>Status</span>
          <select id="application-status">
            ${statuses
              .map(
                (s) =>
                  `<option value="${escapeHtml(s)}"${s === inq.status ? " selected" : ""}>${escapeHtml(s)}</option>`
              )
              .join("")}
          </select>
        </label>
      </div>

      <h3 class="detail-section-heading">Contact Info</h3>
      <dl class="detail-grid">
        ${detailItem("Name", inq.name)}
        ${detailItem("Email", inq.email)}
        ${detailItem("Phone", inq.phone)}
        ${detailItem("Company", inq.company)}
        ${detailItem("Role", inq.propertyRelationship)}
      </dl>

      <h3 class="detail-section-heading">Property Info</h3>
      <dl class="detail-grid">
        ${detailItem("Property Name", inq.propertyName)}
        ${detailItem("Property Location", inq.propertyLocation)}
        ${detailItem("Brand / Flag", inq.brandFlag)}
        ${detailItem("Room Count", inq.roomCount)}
      </dl>

      <h3 class="detail-section-heading">Inquiry Info</h3>
      <dl class="detail-grid">
        ${detailItem("Current Challenge", inq.currentChallenge)}
        ${detailItem("Urgency", inq.urgency)}
        ${detailItem("Submitted", formatDate(inq.createdAt))}
      </dl>
      <div class="detail-message">
        <p class="detail-message-label">Message</p>
        <p>${escapeHtml(inq.message)}</p>
      </div>

      <h3 class="detail-section-heading">Admin</h3>
      <dl class="detail-grid">
        ${detailItem("Last Updated", inq.updatedAt ? formatDate(inq.updatedAt) : "Not yet updated")}
      </dl>
      <div class="detail-notes">
        <label for="inquiry-notes">
          <span>Internal Notes</span>
        </label>
        <textarea
          id="inquiry-notes"
          maxlength="4000"
          rows="5"
          placeholder="Add internal notes about this inquiry..."
        >${escapeHtml(inq.internalNotes || "")}</textarea>
        <div class="detail-notes-footer">
          <p class="form-status" id="notes-save-status" role="status" aria-live="polite"></p>
          <button class="button secondary" id="save-notes-btn" type="button">Save Notes</button>
        </div>
      </div>
    `;
  }

  async function loadInquiries(append) {
    if (!append) {
      pageOffset = 0;
    }

    setStatus(loadStatus, append ? "Loading more..." : "Loading inquiries...", "");

    try {
      const params = getFilters();
      params.set("limit", "50");
      params.set("offset", String(pageOffset));

      const payload = await apiFetch(`/api/admin/inquiries?${params.toString()}`);
      const incoming = payload.inquiries || [];

      pageTotal = payload.total || 0;
      pageHasMore = payload.hasMore || false;
      pageOffset += incoming.length;

      if (append) {
        inquiries = inquiries.concat(incoming);
      } else {
        inquiries = incoming;
        selectedInquiryId = null;
      }

      showDashboard();
      renderCounts();
      renderList();
      renderPagination();
      setStatus(
        loadStatus,
        `Showing ${inquiries.length} of ${pageTotal} inquir${pageTotal === 1 ? "y" : "ies"}.`,
        "success"
      );
    } catch (error) {
      if (!append) {
        inquiries = [];
      }

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

  async function updateStatus(inquiryId, status) {
    setStatus(loadStatus, "Updating status...", "");

    try {
      await apiFetch(`/api/admin/inquiries/${inquiryId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      inquiries = inquiries.map((inq) => (inq.id === inquiryId ? { ...inq, status } : inq));
      selectedInquiryId = inquiryId;
      renderCounts();
      renderList();
      setStatus(loadStatus, `Status updated to ${status}.`, "success");
    } catch (error) {
      setStatus(loadStatus, error.message, "error");
      renderDetail(inquiries.find((inq) => inq.id === selectedInquiryId));
    }
  }

  async function saveNotes(inquiryId, notes) {
    const saveStatus = document.querySelector("#notes-save-status");
    setStatus(saveStatus, "Saving...", "");

    try {
      await apiFetch(`/api/admin/inquiries/${inquiryId}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ notes })
      });
      inquiries = inquiries.map((inq) => (inq.id === inquiryId ? { ...inq, internalNotes: notes } : inq));
      setStatus(saveStatus, "Notes saved.", "success");
    } catch (error) {
      setStatus(saveStatus, error.message, "error");
    }
  }

  populateStatuses();

  tokenForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    adminToken = tokenInput.value.trim();
    localStorage.setItem(storageKey, adminToken);
    setStatus(tokenStatus, "Checking access...", "");
    showDashboard();
    await loadInquiries(false);
  });

  filtersForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    selectedInquiryId = null;
    pageOffset = 0;
    await loadInquiries(false);
  });

  filtersForm.addEventListener("reset", () => {
    window.setTimeout(() => {
      selectedInquiryId = null;
      pageOffset = 0;
      loadInquiries(false);
    }, 0);
  });

  refreshButton.addEventListener("click", () => {
    pageOffset = 0;
    loadInquiries(false);
  });

  list.addEventListener("click", (event) => {
    const row = event.target.closest(".application-row");

    if (!row) {
      return;
    }

    selectedInquiryId = Number(row.dataset.id);
    renderList();
  });

  detail.addEventListener("change", (event) => {
    if (event.target.id !== "application-status" || !selectedInquiryId) {
      return;
    }

    updateStatus(selectedInquiryId, event.target.value);
  });

  detail.addEventListener("click", (event) => {
    if (event.target.id !== "save-notes-btn" || !selectedInquiryId) {
      return;
    }

    const textarea = document.querySelector("#inquiry-notes");
    const notes = textarea ? textarea.value : "";
    saveNotes(selectedInquiryId, notes);
  });

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => {
      const params = getFilters();
      params.set("token", adminToken);
      window.location.href = `/api/admin/inquiries/export.csv?${params.toString()}`;
    });
  }

  if (adminToken) {
    showDashboard();
    loadInquiries(false);
  }
})();
