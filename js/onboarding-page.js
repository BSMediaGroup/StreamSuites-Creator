(() => {
  "use strict";

  console.log("Onboarding JS loaded");

  const RUNTIME_BASE_URL = "https://api.streamsuites.app";
  const CREATOR_ORIGIN = "https://creator.streamsuites.app";
  const AUTH_SESSION_ENDPOINT = `${RUNTIME_BASE_URL}/auth/session`;
  const ONBOARDING_COMPLETE_ENDPOINT = `${RUNTIME_BASE_URL}/account/onboarding/complete`;

  const VALID_TIERS = new Set(["CORE", "GOLD", "PRO"]);
  const VALID_TIER_IDS = new Set(["core", "gold", "pro"]);

  const ui = {
    tierLabel: null,
    tierCards: null,
    continueButton: null,
    status: null,
    error: null
  };
  const REQUIRED_TIER = "CORE";
  const REQUIRED_TIER_ID = "core";
  let confirmedTier = null;

  function normalizeTier(tier) {
    if (typeof tier !== "string") return "CORE";
    const normalized = tier.trim().toUpperCase();
    return VALID_TIERS.has(normalized) ? normalized : "CORE";
  }

  function normalizeTierId(tierId) {
    if (typeof tierId !== "string") return "";
    const normalized = tierId.trim().toLowerCase();
    return VALID_TIER_IDS.has(normalized) ? normalized : "";
  }

  function normalizeVisibility(visibility) {
    if (typeof visibility !== "string") return "";
    const normalized = visibility.trim().toLowerCase();
    return normalized === "public" || normalized === "soft_locked" ? normalized : "";
  }

  function normalizeEffectiveTier(raw) {
    if (!raw || typeof raw !== "object") return null;
    const tierId = normalizeTierId(raw.tier_id || raw.tierId);
    const tierLabel =
      typeof raw.tier_label === "string"
        ? raw.tier_label.trim()
        : typeof raw.tierLabel === "string"
          ? raw.tierLabel.trim()
          : "";
    const visibility = normalizeVisibility(raw.visibility);

    if (!tierId && !tierLabel && !visibility) return null;

    return {
      tierId,
      tierLabel: tierLabel || (tierId ? tierId.toUpperCase() : ""),
      visibility
    };
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

  function updateTierDisplay(tierLabel, currentTierId, effectiveTier) {
    if (ui.tierLabel) {
      ui.tierLabel.textContent = tierLabel;
    }
    if (ui.tierCards) {
      const visibility = effectiveTier?.visibility || "public";
      ui.tierCards.forEach((card) => {
        const cardTier = card.getAttribute("data-tier");
        const cardTierId = normalizeTierId(card.getAttribute("data-tier-id") || "");
        const isCore = cardTierId === REQUIRED_TIER_ID;
        const isLocked = !isCore || visibility === "soft_locked";
        const isCurrent = isCore && currentTierId === REQUIRED_TIER_ID;
        const labelEl = card.querySelector("[data-tier-label]");
        const actionEl = card.querySelector("[data-tier-action]");

        card.classList.toggle("is-active", isCurrent);
        card.classList.toggle("is-disabled", isLocked);
        if (labelEl) {
          labelEl.textContent = isCurrent ? "Current" : isLocked ? "Coming soon" : "Select";
        }
        if (actionEl instanceof HTMLButtonElement) {
          if (isLocked) {
            actionEl.textContent = "Not available yet";
            actionEl.disabled = true;
            actionEl.setAttribute("aria-disabled", "true");
          } else {
            actionEl.textContent = isCurrent ? "Current tier" : "Select tier";
            actionEl.disabled = false;
            actionEl.setAttribute("aria-disabled", "false");
          }
        }
        card.dataset.locked = isLocked ? "true" : "false";
      });
    }
  }

  let isSubmitting = false;

  async function completeOnboarding() {
    if (isSubmitting) return;
    if (confirmedTier !== REQUIRED_TIER) {
      setStatus("Select the CORE tier to continue.", true);
      return;
    }
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

  function extractEffectiveTier(accountState, session) {
    const source =
      accountState?.user && typeof accountState.user === "object"
        ? accountState.user
        : accountState;
    return normalizeEffectiveTier(
      source?.effective_tier ||
        source?.effectiveTier ||
        session?.effectiveTier ||
        session?.effective_tier
    );
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
    if (ui.tierCards) {
      ui.tierCards.forEach((card) => {
        card.addEventListener("click", () => {
          if (card.dataset.locked === "true") {
            setStatus("Only the CORE tier is available right now.", true);
            return;
          }
          const tier = card.getAttribute("data-tier");
          if (tier !== REQUIRED_TIER) {
            setStatus("Only the CORE tier is available right now.", true);
            return;
          }
          confirmedTier = REQUIRED_TIER;
          setStatus("");
          setLoading(false);
        });
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

    const effectiveTier = extractEffectiveTier(accountState, session);
    const currentTierId = normalizeTierId(
      effectiveTier?.tierId || session?.tier || REQUIRED_TIER_ID
    );
    const tierLabel =
      effectiveTier?.tierLabel || normalizeTier(currentTierId || REQUIRED_TIER_ID);
    updateTierDisplay(tierLabel, currentTierId, effectiveTier);
    if (ui.continueButton) {
      ui.continueButton.disabled = true;
    }
    setStatus("Select the CORE tier to continue.");
  }

  document.addEventListener("DOMContentLoaded", () => {
    void init();
  });
})();
