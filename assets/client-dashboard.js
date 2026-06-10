(function () {
  var ACTIVE_TONES = { Assigned: "tone-active", Active: "tone-active", Completed: "tone-muted" };
  var LIFECYCLE_TONES = {
    Onboarding: "tone-warm",
    Active: "tone-active",
    "Active Recovery": "tone-active",
    Stabilized: "tone-active",
    Completed: "tone-muted",
    Offboarded: "tone-muted"
  };
  var INQUIRY_TONES = {
    New: "tone-warm",
    Reviewing: "tone-warm",
    Contacted: "tone-warm",
    Qualified: "tone-active",
    Proposal: "tone-warm",
    Active: "tone-active",
    Closed: "tone-muted",
    Lost: "tone-muted",
    Archived: "tone-muted"
  };

  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusBadge(status, tones) {
    if (!status) return "";
    var tone = (tones && tones[status]) || "";
    return '<span class="status-badge ' + tone + '">' + escHtml(status) + "</span>";
  }

  function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function renderInquiry(inq) {
    var card = document.createElement("div");
    card.className = "portal-card";

    var meta = "";
    if (inq.currentChallenge) meta += "<span><strong>Challenge</strong> " + escHtml(inq.currentChallenge) + "</span>";
    if (inq.urgency) meta += "<span><strong>Urgency</strong> " + escHtml(inq.urgency) + "</span>";
    meta += "<span><strong>Submitted</strong> " + formatDate(inq.createdAt) + "</span>";

    card.innerHTML =
      '<div class="portal-card-header">' +
        "<div>" +
          "<h2>" + escHtml(inq.propertyName || inq.company || "Your inquiry") + "</h2>" +
          '<p class="location">' + escHtml(inq.propertyLocation || "") + "</p>" +
        "</div>" +
        statusBadge(inq.status, INQUIRY_TONES) +
      "</div>" +
      '<div class="portal-meta">' + meta + "</div>" +
      (inq.message ? '<div class="portal-message">' + escHtml(inq.message) + "</div>" : "");

    return card;
  }

  function renderProperty(p) {
    var card = document.createElement("div");
    card.className = "portal-card";

    var meta = "";
    if (p.brandFlag) meta += "<span><strong>Brand</strong> " + escHtml(p.brandFlag) + "</span>";
    if (p.totalRooms) meta += "<span><strong>Rooms</strong> " + p.totalRooms + "</span>";
    meta += "<span><strong>Since</strong> " + formatDate(p.createdAt) + "</span>";

    var consultants = "";
    if (p.consultants && p.consultants.length) {
      consultants =
        '<div class="consultant-list">' +
          "<h3>Your consultants</h3>" +
          "<ul>" +
          p.consultants
            .map(function (c) {
              return (
                "<li><strong>" + escHtml((c.firstName || "") + " " + (c.lastName || "")) + "</strong>" +
                (c.role ? '<span class="role">' + escHtml(c.role) + "</span>" : "") +
                statusBadge(c.status, ACTIVE_TONES) +
                "</li>"
              );
            })
            .join("") +
          "</ul>" +
        "</div>";
    }

    card.innerHTML =
      '<div class="portal-card-header">' +
        "<div>" +
          "<h2>" + escHtml(p.name) + "</h2>" +
          '<p class="location">' + escHtml(p.location || "") + "</p>" +
        "</div>" +
        statusBadge(p.lifecycleStatus, LIFECYCLE_TONES) +
      "</div>" +
      '<div class="portal-meta">' + meta + "</div>" +
      consultants;

    return card;
  }

  function init() {
    fetch("/api/client/me")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.ok) {
          window.location.href = "/client/login";
          return;
        }
        document.getElementById("nav-greeting").textContent = data.client.name || data.client.email;
        document.getElementById("app").removeAttribute("hidden");

        return fetch("/api/client/dashboard")
          .then(function (res) { return res.json(); })
          .then(function (data) {
            document.getElementById("loading-state").hidden = true;

            if (!data.ok) {
              document.getElementById("property-count").textContent = "Could not load your dashboard.";
              return;
            }

            document.getElementById("dashboard-body").removeAttribute("hidden");

            if (data.inquiry) {
              document.getElementById("inquiry-card").appendChild(renderInquiry(data.inquiry));
            }

            var properties = data.properties || [];
            if (!properties.length) {
              document.getElementById("empty-state").removeAttribute("hidden");
              document.getElementById("property-count").textContent = "No properties yet.";
              return;
            }

            document.getElementById("property-count").textContent =
              properties.length + " propert" + (properties.length === 1 ? "y" : "ies");

            var list = document.getElementById("property-list");
            list.removeAttribute("hidden");
            properties.forEach(function (p) {
              list.appendChild(renderProperty(p));
            });
          });
      })
      .catch(function () {
        window.location.href = "/client/login";
      });
  }

  var logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      fetch("/api/client/logout", { method: "POST" })
        .catch(function () {})
        .then(function () {
          window.location.href = "/client/login";
        });
    });
  }

  init();
})();
