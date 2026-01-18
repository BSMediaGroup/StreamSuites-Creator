(() => {
  "use strict";

  const AUTH_BASE_URL = "https://api.streamsuites.app";
  const ONBOARDING_ENDPOINT = `${AUTH_BASE_URL}/creator/onboarding`;

  const VALID_TIERS = new Set(["OPEN", "GOLD", "PRO"]);

  const ui = {
    tierLabel: null,
    tierCards: null,
    continueButton: null,
    status: null,
    error: null
  };

  function normalizeTier(tier) {
    if (typeof tier !== "string") return "OPEN";
    const normalized = tier.trim().toUpperCase();
    return VALID_TIERS.has(normalized) ? normalized : "OPEN";
  }

  function getFetchWithTimeout() {
    if (typeof window.fetchWithTimeout === "function") {
      return window.fetchWithTimeout;
    }

    return async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      try {
        return await fetch(url, { ...opts, signal: controller.signal });
      } finally {
        clearTimeout(id);
      }
    };
  }

  async function fetchJson(url, options = {}, timeoutMs = 8000) {
    const fetchWithTimeout = getFetchWithTimeout();
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(options.headers || {})
        },
        ...options
      },
      timeoutMs
    );

    const raw = await response.text();
    let data = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (err) {
        data = null;
      }
    }

    if (!response.ok) {
      const error = new Error("Onboarding request failed");
      error.status = response.status;
      error.payload = data;
      throw error;
    }

    return data;
  }

  function setStatus(message = "", isError = false) {
    if (ui.status) {
      ui.status.textContent = message;
    }
    if (ui.error) {
      ui.error.hidden = !isError;
      if (isError) {
        ui.error.textContent = message || "Unable to complete onboarding.";
      }
    }
  }

  function setLoading(isLoading) {
    if (ui.continueButton) ui.continueButton.disabled = isLoading;
    if (ui.continueButton) {
      ui.continueButton.textContent = isLoading ? "Completing…" : "Continue";
    }
  }

  function updateTierDisplay(tier) {
    if (ui.tierLabel) {
      ui.tierLabel.textContent = tier;
    }
    if (ui.tierCards) {
      ui.tierCards.forEach((card) => {
        const cardTier = card.getAttribute("data-tier");
        card.classList.toggle("is-active", cardTier === tier);
      });
    }
  }

  async function completeOnboarding(tier) {
    setLoading(true);
    setStatus("Saving onboarding status…");

    try {
      await fetchJson(
        ONBOARDING_ENDPOINT,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            onboarding_state: "complete",
            onboarding_step: "complete",
            tier,
            metadata: {
              completed_at: new Date().toISOString()
            }
          })
        },
        8000
      );

      window.location.assign("/index.html");
    } catch (err) {
      const message =
        typeof err?.payload?.message === "string"
          ? err.payload.message
          : "Unable to complete onboarding. Please try again.";
      setStatus(message, true);
      setLoading(false);
    }
  }

  async function init() {
    ui.tierLabel = document.querySelector("[data-onboarding-tier]");
    ui.tierCards = Array.from(document.querySelectorAll("[data-tier]"));
    ui.continueButton = document.querySelector("[data-onboarding-continue]");
    ui.status = document.querySelector("[data-onboarding-status]");
    ui.error = document.querySelector("[data-onboarding-error]");

    if (!ui.continueButton) return;

    const session = await window.StreamSuitesAuth?.loadSession?.();
    if (!session?.authenticated) return;

    if (session?.onboardingRequired === false) {
      window.location.assign("/index.html");
      return;
    }

    const tier = normalizeTier(session?.tier || "OPEN");
    updateTierDisplay(tier);

    ui.continueButton.addEventListener("click", () => {
      void completeOnboarding(tier);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    void init();
  });
})();
