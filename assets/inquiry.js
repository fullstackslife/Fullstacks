(function () {
  const form = document.querySelector("#inquiry-form");
  const status = document.querySelector("#inquiry-status");

  if (!form || !status) {
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  const defaultButtonText = submitButton ? submitButton.textContent : "Send Inquiry";

  function setStatus(message, type) {
    status.textContent = message;
    status.classList.remove("success", "error");

    if (type) {
      status.classList.add(type);
    }
  }

  function getPayload() {
    const formData = new FormData(form);
    return {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      company: String(formData.get("company") || "").trim(),
      inquiryType: String(formData.get("inquiryType") || "").trim(),
      urgency: String(formData.get("urgency") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      website: String(formData.get("website") || "").trim()
    };
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("", "");

    if (!form.reportValidity()) {
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }

    try {
      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(getPayload())
      });

      if (!response.ok) {
        throw new Error("Inquiry request failed");
      }

      form.reset();
      setStatus("Thanks. Your inquiry has been received.", "success");
    } catch (error) {
      setStatus("Something went wrong. Please try again.", "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = defaultButtonText;
      }
    }
  });
})();
