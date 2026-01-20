(() => {
  "use strict";

  console.log("Onboarding JS loaded");

  const RUNTIME_BASE_URL = "https://api.streamsuites.app";
  const CREATOR_ORIGIN = "https://creator.streamsuites.app";
  const AUTH_SESSION_ENDPOINT = `${RUNTIME_BASE_URL}/auth/session`;
  const ONBOARDING_COMPLETE_ENDPOINT = `${RUNTIME_BASE_URL}/account/onboarding/complete`;

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
      ui.continueButton.textContent = isLoading ? "Completing..." : "Continue";
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

  let isSubmitting = false;

  async function completeOnboarding() {
    if (isSubmitting) return;
    isSubmitting = true;
    setLoading(true);
    setStatus("Saving onboarding status...");

    try {
      const payload = await fetchJson(ONBOARDING_COMPLETE_ENDPOINT, { method: "POST" }, 8000);
      if (!payload || payload.success !== true) {
        const error = new Error("Onboarding completion failed");
        error.payload = payload;
        throw error;
      }

      window.location.assign(`${CREATOR_ORIGIN}/index.html`);
    } catch (err) {
      console.error("[Onboarding] Completion failed", err);
      const message =
        typeof err?.payload?.message === "string"
          ? err.payload.message
          : "Unable to complete onboarding. Please try again.";
      setStatus(message, true);
      setLoading(false);
      isSubmitting = false;
    }
  }

  async function fetchAccountState() {
    return fetchJson(AUTH_SESSION_ENDPOINT, {}, 5000);
  }

  function extractTier(accountState, session) {
    const candidate =
      accountState?.tier ||
      accountState?.user?.tier ||
      session?.tier ||
      "OPEN";
    return normalizeTier(candidate);
  }

  async function init() {
    ui.tierLabel = document.querySelector("[data-onboarding-tier]");
    ui.tierCards = Array.from(document.querySelectorAll("[data-tier]"));
    ui.continueButton = document.getElementById("onboarding-continue");
    ui.status = document.querySelector("[data-onboarding-status]");
    ui.error = document.querySelector("[data-onboarding-error]");

    if (ui.continueButton) {
      ui.continueButton.addEventListener("click", (event) => {
        event.preventDefault();
        console.log("Continue clicked");
        void completeOnboarding();
      });
    }

    let accountState = null;
    try {
      accountState = await fetchAccountState();
      const onboardingStatus =
        typeof accountState?.onboarding_status === "string"
          ? accountState.onboarding_status.toLowerCase()
          : null;
      const onboardingRequired =
        accountState?.onboarding_required === true ||
        accountState?.onboardingRequired === true;

      if (onboardingStatus === "completed" || onboardingRequired === false) {
        window.location.assign(`${CREATOR_ORIGIN}/index.html`);
        return;
      }
    } catch (err) {
      console.error("[Onboarding] Unable to load account state", err);
      setStatus("Unable to verify onboarding status. Please try again.", true);
    }

    let session = null;
    try {
      session = await window.StreamSuitesAuth?.loadSession?.();
      if (session?.onboardingRequired === false) {
        window.location.assign(`${CREATOR_ORIGIN}/index.html`);
        return;
      }
    } catch (err) {
      session = null;
    }

    const tier = extractTier(accountState, session);
    updateTierDisplay(tier);
  }

  document.addEventListener("DOMContentLoaded", () => {
    void init();
  });
})();
