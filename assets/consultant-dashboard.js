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
      (a.notes ? '<div class="assignment-notes">' + escHtml(a.notes) + "</div>" : "") +
      '<button class="button secondary consultant-room-toggle" type="button" data-property-id="' + a.property.id + '">View Rooms</button>' +
      '<div class="consultant-room-list" id="consultant-rooms-' + a.property.id + '" hidden></div>';

    return card;
  }

  function renderRooms(container, rooms) {
    if (!rooms.length) {
      container.innerHTML = '<p class="empty-state">No rooms are available for this property yet.</p>';
      return;
    }
    container.innerHTML = rooms
      .map(function (room) {
        var meta = [room.roomType, room.floor != null ? "Floor " + room.floor : ""].filter(Boolean).join(" / ");
        return (
          '<div class="consultant-room-row">' +
            '<div><strong>Room ' + escHtml(room.roomNumber) + '</strong>' +
            (meta ? '<span>' + escHtml(meta) + '</span>' : '') +
            (room.oosReason ? '<small>' + escHtml(room.oosReason) + '</small>' : '') +
            '</div>' +
            '<span class="status-badge">' + escHtml(room.status) + '</span>' +
          '</div>'
        );
      })
      .join("");
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

            list.addEventListener("click", function (event) {
              var btn = event.target.closest(".consultant-room-toggle");
              if (!btn) return;
              var propertyId = btn.getAttribute("data-property-id");
              var target = document.getElementById("consultant-rooms-" + propertyId);
              if (!target) return;
              if (!target.hidden) {
                target.hidden = true;
                btn.textContent = "View Rooms";
                return;
              }
              target.hidden = false;
              btn.textContent = "Hide Rooms";
              target.innerHTML = '<p class="empty-state">Loading rooms...</p>';
              fetch("/api/consultant/properties/" + encodeURIComponent(propertyId) + "/rooms?limit=100")
                .then(function (res) { return res.json(); })
                .then(function (payload) {
                  if (!payload.ok) throw new Error(payload.error || "Unable to load rooms.");
                  renderRooms(target, payload.rooms || []);
                })
                .catch(function (error) {
                  target.innerHTML = '<p class="empty-state">' + escHtml(error.message) + "</p>";
                });
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
