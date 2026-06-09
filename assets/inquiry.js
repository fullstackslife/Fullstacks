(function () {
  function setStatus(status, message, type) {
    status.textContent = message;
    status.classList.remove("success", "error");

    if (type) {
      status.classList.add(type);
    }
  }

  function getString(formData, name) {
    return String(formData.get(name) || "").trim();
  }

  function getCheckedValues(form, name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((input) =>
      input.value.trim()
    );
  }

  function setupForm(config) {
    const form = document.querySelector(config.formSelector);
    const status = document.querySelector(config.statusSelector);

    if (!form || !status) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const defaultButtonText = submitButton ? submitButton.textContent : config.defaultButtonText;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus(status, "", "");

      if (!form.reportValidity()) {
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
      }

      try {
        const response = await fetch(config.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(config.getPayload(form))
        });

        if (response.status === 409) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            data.error ||
              (config.duplicateMessage || "A submission with this information already exists.")
          );
        }

        if (!response.ok) {
          throw new Error("Request failed");
        }

        form.reset();
        setStatus(status, config.successMessage, "success");
      } catch (error) {
        setStatus(status, error.message || "Something went wrong. Please try again.", "error");
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = defaultButtonText;
        }
      }
    });
  }

  setupForm({
    formSelector: "#inquiry-form",
    statusSelector: "#inquiry-status",
    endpoint: "/api/inquiry",
    defaultButtonText: "Send Inquiry",
    successMessage: "Thanks. Your property support inquiry has been received.",
    getPayload(form) {
      const formData = new FormData(form);
      return {
        name: getString(formData, "name"),
        email: getString(formData, "email"),
        phone: getString(formData, "phone"),
        company: getString(formData, "company"),
        propertyName: getString(formData, "propertyName"),
        propertyLocation: getString(formData, "propertyLocation"),
        brandFlag: getString(formData, "brandFlag"),
        roomCount: getString(formData, "roomCount"),
        propertyRelationship: getString(formData, "propertyRelationship"),
        currentChallenge: getString(formData, "currentChallenge"),
        urgency: getString(formData, "urgency"),
        message: getString(formData, "message"),
        website: getString(formData, "website")
      };
    }
  });

  setupForm({
    formSelector: "#consultant-form",
    statusSelector: "#consultant-status",
    endpoint: "/api/consultant-application",
    defaultButtonText: "Submit Consultant Inquiry",
    successMessage: "Thanks. Your consultant inquiry has been received.",
    duplicateMessage:
      "An application with this email address is already on file. If you need to update your information, please reach out directly.",
    getPayload(form) {
      const formData = new FormData(form);
      return {
        firstName: getString(formData, "firstName"),
        lastName: getString(formData, "lastName"),
        email: getString(formData, "email"),
        phone: getString(formData, "phone"),
        city: getString(formData, "city"),
        state: getString(formData, "state"),
        currentRole: getString(formData, "currentRole"),
        yearsExperience: getString(formData, "yearsExperience"),
        travelPreference: getString(formData, "travelPreference"),
        availability: getString(formData, "availability"),
        brandsWorkedWith: getString(formData, "brandsWorkedWith"),
        managementCompanies: getString(formData, "managementCompanies"),
        linkedinUrl: getString(formData, "linkedinUrl"),
        resumeUrl: getString(formData, "resumeUrl"),
        compensationExpectations: getString(formData, "compensationExpectations"),
        specialtyAreas: getCheckedValues(form, "specialtyAreas"),
        notes: getString(formData, "notes"),
        website: getString(formData, "website")
      };
    }
  });
})();
