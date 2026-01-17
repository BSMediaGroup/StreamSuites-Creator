(() => {
  "use strict";

  const AUTH_BASE_URL = "https://api.streamsuites.app";
  const ONBOARDING_ENDPOINT = `${AUTH_BASE_URL}/creator/onboarding`;
  const ONBOARDING_CACHE_KEY = "streamsuites.onboarding.cache";

  const VALID_STATES = new Set(["not_started", "in_progress", "complete"]);
  const VALID_TIERS = new Set(["OPEN", "GOLD", "PRO"]);

  const STEP_DEFINITIONS = [
    {
      key: "welcome",
      title: "Welcome",
      subtitle: "Get started with StreamSuites",
      primaryLabel: "Continue"
    },
    {
      key: "terms",
      title: "Terms acknowledgement",
      subtitle: "Review and accept the creator terms",
      primaryLabel: "Continue"
    },
    {
      key: "tier",
      title: "Tier awareness",
      subtitle: "Understand your current creator tier",
      primaryLabel: "Continue"
    },
    {
      key: "integrations",
      title: "Optional integrations",
      subtitle: "Connect optional tools (coming soon)",
      primaryLabel: "Continue"
    },
    {
      key: "finish",
      title: "Finish",
      subtitle: "Confirm setup is complete",
      primaryLabel: "Finish setup"
    }
  ];

  const DEFAULT_STATE = Object.freeze({
    onboarding_state: "not_started",
    onboarding_step: "welcome",
    accepted_terms: false,
    tier: "OPEN",
    metadata: {}
  });

  const ui = {
    overlay: null,
    modal: null,
    progress: null,
    title: null,
    subtitle: null,
    body: null,
    back: null,
    skip: null,
    primary: null,
    banner: null
  };

  let currentState = null;
  let currentStepIndex = 0;
  let initialized = false;
  let sessionSnapshot = null;
  let currentPrimaryHandler = null;

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

  function normalizeTier(tier) {
    if (typeof tier !== "string") return "OPEN";
    const normalized = tier.trim().toUpperCase();
    return VALID_TIERS.has(normalized) ? normalized : "OPEN";
  }

  function normalizeStep(step) {
    if (typeof step !== "string") return "welcome";
    const trimmed = step.trim().toLowerCase();
    return STEP_DEFINITIONS.some((definition) => definition.key === trimmed)
      ? trimmed
      : "welcome";
  }

  function normalizeState(payload) {
    if (!payload || typeof payload !== "object") {
      return { ...DEFAULT_STATE };
    }

    const state = VALID_STATES.has(payload.onboarding_state)
      ? payload.onboarding_state
      : "not_started";

    return {
      onboarding_state: state,
      onboarding_step: normalizeStep(payload.onboarding_step || payload.step),
      accepted_terms: payload.accepted_terms === true,
      tier: normalizeTier(payload.tier || payload.tier_level),
      metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {}
    };
  }

  function loadCachedState() {
    try {
      const raw = localStorage.getItem(ONBOARDING_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch (err) {
      console.warn("[Dashboard][Onboarding] Failed to read cached state", err);
      return null;
    }
  }

  function saveCachedState(state) {
    try {
      localStorage.setItem(ONBOARDING_CACHE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("[Dashboard][Onboarding] Failed to cache state", err);
    }
  }

  async function loadState() {
    try {
      const payload = await fetchJson(ONBOARDING_ENDPOINT, {}, 6000);
      const normalized = normalizeState(payload);
      saveCachedState(normalized);
      return normalized;
    } catch (err) {
      if (err?.status === 404) {
        const fallback = { ...DEFAULT_STATE };
        saveCachedState(fallback);
        return fallback;
      }
      console.warn("[Dashboard][Onboarding] Unable to load state", err);
      return loadCachedState();
    }
  }

  async function persistState(nextState) {
    currentState = normalizeState(nextState);
    saveCachedState(currentState);

    try {
      await fetchJson(
        ONBOARDING_ENDPOINT,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(currentState)
        },
        6000
      );
      return true;
    } catch (err) {
      console.warn("[Dashboard][Onboarding] Unable to persist state", err);
      return false;
    }
  }

  function getStepIndex(stepKey) {
    const normalized = normalizeStep(stepKey);
    const index = STEP_DEFINITIONS.findIndex((step) => step.key === normalized);
    return index >= 0 ? index : 0;
  }

  function isOverlayOpen() {
    return Boolean(ui.overlay && ui.overlay.classList.contains("is-open"));
  }

  function openOverlay() {
    if (!ui.overlay) return;
    ui.overlay.classList.add("is-open");
  }

  function closeOverlay() {
    if (!ui.overlay) return;
    ui.overlay.classList.remove("is-open");
  }

  function setPrimaryHandler(handler) {
    currentPrimaryHandler = handler;
  }

  function renderProgress() {
    if (!ui.progress) return;
    ui.progress.innerHTML = "";

    STEP_DEFINITIONS.forEach((step, index) => {
      const item = document.createElement("li");
      item.className = "ss-onboarding-progress-step";
      if (index < currentStepIndex) item.classList.add("is-complete");
      if (index === currentStepIndex) item.classList.add("is-current");

      const label = document.createElement("span");
      label.textContent = step.title;
      item.appendChild(label);

      ui.progress.appendChild(item);
    });
  }

  function setStep(index) {
    const bounded = Math.max(0, Math.min(index, STEP_DEFINITIONS.length - 1));
    currentStepIndex = bounded;

    const step = STEP_DEFINITIONS[bounded];
    if (!step) return;

    if (ui.title) ui.title.textContent = step.title;
    if (ui.subtitle) ui.subtitle.textContent = step.subtitle;

    if (ui.primary) {
      ui.primary.textContent = step.primaryLabel;
    }

    if (ui.back) {
      ui.back.hidden = bounded === 0;
    }

    renderProgress();
    renderStepBody(step.key);
  }

  function renderStepBody(stepKey) {
    if (!ui.body) return;
    ui.body.innerHTML = "";

    switch (stepKey) {
      case "welcome":
        renderWelcome();
        break;
      case "terms":
        renderTerms();
        break;
      case "tier":
        renderTier();
        break;
      case "integrations":
        renderIntegrations();
        break;
      case "finish":
        renderFinish();
        break;
      default:
        renderWelcome();
        break;
    }
  }

  function renderWelcome() {
    const lead = document.createElement("p");
    lead.className = "ss-onboarding-lead";
    lead.textContent = "Welcome to StreamSuites Creator. This quick setup is optional and can be resumed any time.";

    const list = document.createElement("ul");
    list.className = "ss-onboarding-list";
    list.innerHTML = "<li>Review the creator terms.</li><li>Confirm your current tier.</li><li>See upcoming integrations.</li>";

    ui.body.append(lead, list);

    setPrimaryHandler(async () => {
      const nextState = {
        ...currentState,
        onboarding_state: "in_progress",
        onboarding_step: "terms"
      };
      await persistState(nextState);
      setStep(currentStepIndex + 1);
    });
  }

  function renderTerms() {
    const copy = document.createElement("p");
    copy.className = "ss-onboarding-copy";
    copy.innerHTML =
      "Review the StreamSuites creator terms before continuing. You can read the full terms in the support center.";

    const link = document.createElement("a");
    link.href = "https://streamsuites.app/terms";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "ss-onboarding-link";
    link.textContent = "View full terms →";

    const label = document.createElement("label");
    label.className = "ss-onboarding-checkbox";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(currentState?.accepted_terms);

    const span = document.createElement("span");
    span.textContent = "I accept the creator terms";

    label.append(checkbox, span);

    const error = document.createElement("p");
    error.className = "ss-onboarding-error";
    error.hidden = true;

    ui.body.append(copy, link, label, error);

    setPrimaryHandler(async () => {
      if (!checkbox.checked) {
        error.textContent = "Please accept the terms to continue or choose skip for now.";
        error.hidden = false;
        return;
      }

      const nextState = {
        ...currentState,
        accepted_terms: true,
        onboarding_state: "in_progress",
        onboarding_step: "tier"
      };
      await persistState(nextState);
      setStep(currentStepIndex + 1);
    });
  }

  function renderTier() {
    const tier = normalizeTier(sessionSnapshot?.tier || currentState?.tier || "OPEN");

    const copy = document.createElement("p");
    copy.className = "ss-onboarding-copy";
    copy.textContent =
      "StreamSuites tiers unlock additional automation and integrations. Your current tier is shown below.";

    const tierRow = document.createElement("div");
    tierRow.className = "ss-onboarding-tier";
    tierRow.innerHTML = `<span class="pill pill-success">Current tier</span> <strong>${tier}</strong>`;

    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = "GOLD and PRO tiers are coming soon. You will be notified when upgrades are available.";

    ui.body.append(copy, tierRow, hint);

    setPrimaryHandler(async () => {
      const nextState = {
        ...currentState,
        tier,
        metadata: {
          ...(currentState?.metadata || {}),
          tier_acknowledged: true
        },
        onboarding_state: "in_progress",
        onboarding_step: "integrations"
      };
      await persistState(nextState);
      setStep(currentStepIndex + 1);
    });
  }

  function renderIntegrations() {
    const copy = document.createElement("p");
    copy.className = "ss-onboarding-copy";
    copy.textContent =
      "Optional integrations help you extend StreamSuites into your creator community. These connections are optional and can be enabled later.";

    const card = document.createElement("div");
    card.className = "ss-onboarding-card";

    const header = document.createElement("div");
    header.className = "ss-onboarding-card-header";
    header.innerHTML =
      "<strong>Discord bot</strong><span class=\"pill pill-warning\">Coming soon</span>";

    const body = document.createElement("p");
    body.className = "muted";
    body.textContent = "Connect the StreamSuites Discord bot to announce overlays and sync commands.";

    card.append(header, body);

    ui.body.append(copy, card);

    setPrimaryHandler(async () => {
      const nextState = {
        ...currentState,
        metadata: {
          ...(currentState?.metadata || {}),
          integrations: {
            ...(currentState?.metadata?.integrations || {}),
            discord: "coming_soon"
          }
        },
        onboarding_state: "in_progress",
        onboarding_step: "finish"
      };
      await persistState(nextState);
      setStep(currentStepIndex + 1);
    });
  }

  function renderFinish() {
    const copy = document.createElement("p");
    copy.className = "ss-onboarding-copy";
    copy.textContent =
      "You are all set. Finish onboarding to save your progress, or skip for now to return later.";

    const summary = document.createElement("ul");
    summary.className = "ss-onboarding-list";
    summary.innerHTML =
      "<li>Terms accepted: <strong>" +
      (currentState?.accepted_terms ? "Yes" : "Not yet") +
      "</strong></li><li>Tier: <strong>" +
      normalizeTier(currentState?.tier || sessionSnapshot?.tier || "OPEN") +
      "</strong></li>";

    ui.body.append(copy, summary);

    setPrimaryHandler(async () => {
      const nextState = {
        ...currentState,
        onboarding_state: "complete",
        onboarding_step: "complete"
      };
      await persistState(nextState);
      closeOverlay();
      renderEntryPoints();
    });
  }

  function renderEntryPoints() {
    if (!currentState || currentState.onboarding_state === "complete") {
      if (ui.banner) ui.banner.remove();
      const entry = document.querySelector("[data-onboarding-entry]");
      if (entry) entry.remove();
      return;
    }

    const banner = ui.banner || document.createElement("section");
    banner.className = "ss-onboarding-banner";
    banner.dataset.onboardingBanner = "true";
    banner.innerHTML = "";

    const copy = document.createElement("div");
    copy.className = "ss-onboarding-banner-copy";

    const title = document.createElement("strong");
    title.textContent =
      currentState.onboarding_state === "not_started"
        ? "Welcome to StreamSuites Creator"
        : "Creator onboarding in progress";

    const text = document.createElement("p");
    text.textContent =
      currentState.onboarding_state === "not_started"
        ? "Complete the optional setup to confirm your tier and integrations."
        : "Resume onboarding to continue where you left off.";

    copy.append(title, text);

    const actions = document.createElement("div");
    actions.className = "ss-onboarding-banner-actions";

    const primary = document.createElement("button");
    primary.type = "button";
    primary.className = "ss-btn ss-btn-primary ss-btn-small";
    primary.textContent =
      currentState.onboarding_state === "not_started" ? "Get started" : "Resume onboarding";
    primary.addEventListener("click", () => {
      openOnboarding();
    });

    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "ss-btn ss-btn-secondary ss-btn-small";
    skip.textContent = "Skip for now";
    skip.addEventListener("click", async () => {
      await markSkipped();
      banner.remove();
    });

    actions.append(primary, skip);
    banner.append(copy, actions);

    if (!ui.banner) {
      const anchor =
        document.querySelector(".creator-hero") ||
        document.querySelector(".public-shell") ||
        document.querySelector(".ss-main") ||
        document.body;

      if (anchor && anchor.parentElement) {
        anchor.parentElement.insertBefore(banner, anchor);
      } else {
        document.body.prepend(banner);
      }
    }

    ui.banner = banner;

    ensureHeaderEntry();
  }

  function ensureHeaderEntry() {
    if (!currentState || currentState.onboarding_state === "complete") return;

    const existing = document.querySelector("[data-onboarding-entry]");
    if (existing) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ss-btn ss-btn-secondary ss-btn-small";
    button.dataset.onboardingEntry = "true";
    button.textContent =
      currentState.onboarding_state === "not_started" ? "Complete setup" : "Resume onboarding";
    button.addEventListener("click", () => {
      openOnboarding();
    });

    const topbarNav = document.querySelector(".public-topbar .public-nav");
    if (topbarNav) {
      topbarNav.appendChild(button);
      return;
    }

    const header = document.querySelector(".ss-header");
    if (!header) return;

    let right = header.querySelector(".ss-header-right");
    if (!right) {
      right = document.createElement("div");
      right.className = "ss-header-right";
      header.appendChild(right);
    }

    right.appendChild(button);
  }

  function markSkipped() {
    if (!currentState) return Promise.resolve();

    const nextState = {
      ...currentState,
      onboarding_state: "in_progress",
      onboarding_step: currentState.onboarding_step || "welcome",
      metadata: {
        ...(currentState.metadata || {}),
        skipped_at: new Date().toISOString()
      }
    };

    return persistState(nextState);
  }

  function buildModal() {
    if (ui.overlay) return;

    const overlay = document.createElement("div");
    overlay.className = "ss-onboarding-overlay";

    const modal = document.createElement("div");
    modal.className = "ss-onboarding-modal";

    const header = document.createElement("header");
    header.className = "ss-onboarding-header";

    const title = document.createElement("h2");
    title.textContent = "Welcome";

    const subtitle = document.createElement("p");
    subtitle.className = "ss-onboarding-subtitle";
    subtitle.textContent = "Get started with StreamSuites";

    header.append(title, subtitle);

    const progress = document.createElement("ol");
    progress.className = "ss-onboarding-progress";

    const body = document.createElement("div");
    body.className = "ss-onboarding-body";

    const footer = document.createElement("footer");
    footer.className = "ss-onboarding-footer";

    const back = document.createElement("button");
    back.type = "button";
    back.className = "ss-btn ss-btn-secondary";
    back.textContent = "Back";
    back.addEventListener("click", () => {
      setStep(currentStepIndex - 1);
    });

    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "ss-btn ss-btn-secondary";
    skip.textContent = "Skip for now";
    skip.addEventListener("click", async () => {
      await markSkipped();
      closeOverlay();
      renderEntryPoints();
    });

    const primary = document.createElement("button");
    primary.type = "button";
    primary.className = "ss-btn ss-btn-primary";
    primary.textContent = "Continue";
    primary.addEventListener("click", () => {
      if (typeof currentPrimaryHandler === "function") {
        currentPrimaryHandler();
      }
    });

    footer.append(back, skip, primary);

    modal.append(header, progress, body, footer);
    overlay.appendChild(modal);

    overlay.addEventListener("click", async (event) => {
      if (event.target !== overlay) return;
      await markSkipped();
      closeOverlay();
      renderEntryPoints();
    });

    document.body.appendChild(overlay);

    ui.overlay = overlay;
    ui.modal = modal;
    ui.progress = progress;
    ui.title = title;
    ui.subtitle = subtitle;
    ui.body = body;
    ui.back = back;
    ui.skip = skip;
    ui.primary = primary;
  }

  function openOnboarding() {
    if (!currentState) return;

    buildModal();

    if (currentState.onboarding_state === "not_started") {
      const nextState = {
        ...currentState,
        onboarding_state: "in_progress",
        onboarding_step: currentState.onboarding_step || "welcome"
      };
      void persistState(nextState);
    }

    const stepIndex = getStepIndex(currentState.onboarding_step);
    setStep(stepIndex);
    openOverlay();
  }

  async function init(session) {
    if (initialized) return;
    initialized = true;

    sessionSnapshot = session;

    const ready = () => {
      void (async () => {
        currentState = await loadState();

        if (!currentState) {
          console.warn("[Dashboard][Onboarding] State unavailable; skipping onboarding UI.");
          return;
        }

        if (currentState.onboarding_state === "complete") {
          return;
        }

        renderEntryPoints();

        if (currentState.onboarding_state === "not_started") {
          openOnboarding();
        }
      })();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", ready, { once: true });
      return;
    }

    ready();
  }

  window.StreamSuitesOnboarding = {
    init,
    open: openOnboarding
  };
})();
