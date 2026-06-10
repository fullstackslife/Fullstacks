(function () {
  var STATUS_LABELS = {
    Proposed: "Proposed",
    Contacted: "Contacted",
    Interviewing: "Interviewing",
    Assigned: "Assigned",
    Active: "Active",
    Completed: "Completed",
    Declined: "Declined",
    Removed: "Removed"
  };

  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusBadge(status) {
    var label = STATUS_LABELS[status] || status;
    return '<span class="status-badge status-' + escHtml(status) + '">' + escHtml(label) + "</span>";
  }

  function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function renderAssignment(a) {
    var card = document.createElement("div");
    card.className = "assignment-card";

    var meta = "";
    if (a.role) meta += "<span><strong>Role</strong> " + escHtml(a.role) + "</span>";
    if (a.property.brandFlag) meta += "<span><strong>Brand</strong> " + escHtml(a.property.brandFlag) + "</span>";
    if (a.property.totalRooms) meta += "<span><strong>Rooms</strong> " + a.property.totalRooms + "</span>";
    if (a.property.lifecycleStatus) meta += "<span><strong>Stage</strong> " + escHtml(a.property.lifecycleStatus) + "</span>";
    meta += "<span><strong>Assigned</strong> " + formatDate(a.assignedAt) + "</span>";

    card.innerHTML =
      '<div class="assignment-card-header">' +
        "<div>" +
          "<h2>" + escHtml(a.property.name) + "</h2>" +
          '<p class="location">' + escHtml(a.property.location || "") + "</p>" +
        "</div>" +
        statusBadge(a.assignmentStatus) +
      "</div>" +
      '<div class="assignment-meta">' + meta + "</div>" +
      (a.notes ? '<div class="assignment-notes">' + escHtml(a.notes) + "</div>" : "");

    return card;
  }

  function init() {
    fetch("/api/consultant/me")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.ok) {
          window.location.href = "/consultant/login";
          return;
        }
        var me = data.consultant;
        document.getElementById("nav-greeting").textContent = me.firstName + " " + me.lastName;
        document.getElementById("app").removeAttribute("hidden");

        return fetch("/api/consultant/dashboard")
          .then(function (res) { return res.json(); })
          .then(function (data) {
            document.getElementById("loading-state").hidden = true;

            if (!data.ok || !data.assignments || !data.assignments.length) {
              document.getElementById("empty-state").removeAttribute("hidden");
              document.getElementById("assignment-count").textContent = "No active assignments.";
              return;
            }

            var count = data.assignments.length;
            document.getElementById("assignment-count").textContent =
              count + " assignment" + (count === 1 ? "" : "s");

            var list = document.getElementById("assignment-list");
            list.removeAttribute("hidden");
            data.assignments.forEach(function (a) {
              list.appendChild(renderAssignment(a));
            });
          });
      })
      .catch(function () {
        window.location.href = "/consultant/login";
      });
  }

  var logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      fetch("/api/consultant/logout", { method: "POST" })
        .catch(function () {})
        .then(function () {
          window.location.href = "/consultant/login";
        });
    });
  }

  init();
})();
