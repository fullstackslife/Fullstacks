(function () {
  var form = document.getElementById("login-form");
  var btn = document.getElementById("login-btn");
  var errorEl = document.getElementById("login-error");

  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var email = document.getElementById("email").value.trim();
    var password = document.getElementById("password").value;

    errorEl.textContent = "";
    btn.disabled = true;
    btn.textContent = "Signing in…";

    fetch("/api/client/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.ok) {
          window.location.href = "/client/dashboard";
        } else {
          errorEl.textContent = data.error || "Login failed.";
          btn.disabled = false;
          btn.textContent = "Sign In";
        }
      })
      .catch(function () {
        errorEl.textContent = "Network error. Please try again.";
        btn.disabled = false;
        btn.textContent = "Sign In";
      });
  });
})();
