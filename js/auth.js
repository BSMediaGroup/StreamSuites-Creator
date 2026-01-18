(() => {
  "use strict";

  const AUTH_BASE_URL = "https://api.streamsuites.app";
  const AUTH_ENDPOINTS = Object.freeze({
    session: `${AUTH_BASE_URL}/auth/session`,
    logout: `${AUTH_BASE_URL}/auth/logout`,
    magicLink: `${AUTH_BASE_URL}/auth/magic-link`,
    oauth: Object.freeze({
      google: `${AUTH_BASE_URL}/auth/google`,
      github: `${AUTH_BASE_URL}/auth/github`,
      discord: `${AUTH_BASE_URL}/auth/discord`
    })
  });

  const CREATOR_ROLE = "creator";
  const TIER_OPTIONS = new Set(["OPEN", "GOLD", "PRO"]);
  const PUBLIC_PATHS = new Set(["/auth/login.html", "/auth/success.html"]);

  const sessionState = {
    value: null,
    loading: false
  };

  function ensureAppNamespace() {
    if (!window.App) {
      window.App = {};
    }
  }

  function getPathname() {
    try {
      return window.location.pathname || "/";
    } catch (err) {
      return "/";
    }
  }

  function isPublicPath(pathname) {
    if (PUBLIC_PATHS.has(pathname)) return true;
    return pathname.startsWith("/auth/");
  }

  function normalizeRole(role) {
    if (typeof role !== "string") return null;
    const trimmed = role.trim().toLowerCase();
    return trimmed || null;
  }

  function normalizeTier(tier) {
    if (typeof tier !== "string") return "OPEN";
    const trimmed = tier.trim().toUpperCase();
    if (!trimmed) return "OPEN";
    return TIER_OPTIONS.has(trimmed) ? trimmed : "OPEN";
  }

  function normalizeSessionPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return { authenticated: false };
    }

    const emailCandidate =
      typeof payload.email === "string"
        ? payload.email
        : typeof payload.user?.email === "string"
          ? payload.user.email
          : "";

    const roleCandidate =
      typeof payload.role === "string"
        ? payload.role
        : typeof payload.user?.role === "string"
          ? payload.user.role
          : "";

    const role = normalizeRole(roleCandidate);
    if (!role) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      email: emailCandidate.trim() || "Signed in",
      role,
      tier: normalizeTier(payload.tier || payload.user?.tier)
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
        ...options,
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(options.headers || {})
        }
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
      const error = new Error("Auth request failed");
      error.status = response.status;
      error.payload = data;
      throw error;
    }

    return data;
  }

  async function loadSession() {
    if (sessionState.loading) return sessionState.value;
    if (sessionState.value) return sessionState.value;

    sessionState.loading = true;
    try {
      const payload = await fetchJson(AUTH_ENDPOINTS.session, {}, 5000);
      sessionState.value = normalizeSessionPayload(payload);
    } catch (err) {
      sessionState.value = { authenticated: false, error: err };
    } finally {
      sessionState.loading = false;
    }

    return sessionState.value;
  }

  function updateAppSession(session) {
    ensureAppNamespace();
    window.App.session = {
      authenticated: !!session?.authenticated,
      email: session?.email || "",
      role: session?.role || "",
      tier: session?.tier || ""
    };
  }

  function buildAuthSummary() {
    const wrapper = document.createElement("div");
    wrapper.className = "ss-auth-summary";
    wrapper.dataset.authSummary = "true";

    const email = document.createElement("span");
    email.className = "ss-chip auth-chip auth-email";
    email.dataset.authEmail = "true";
    email.textContent = "Signed out";

    const tier = document.createElement("span");
    tier.className = "ss-chip auth-chip auth-tier";
    tier.dataset.authTier = "true";
    tier.textContent = "OPEN";

    const logout = document.createElement("button");
    logout.type = "button";
    logout.className = "ss-btn ss-btn-secondary ss-btn-small auth-logout";
    logout.dataset.authLogout = "true";
    logout.textContent = "Logout";

    wrapper.append(email, tier, logout);
    return wrapper;
  }

  function ensureAuthSummaryMounts() {
    const topbarNav = document.querySelector(".public-topbar .public-nav");
    if (topbarNav && !topbarNav.querySelector("[data-auth-summary]")) {
      const summary = buildAuthSummary();
      summary.classList.add("public-auth-summary");
      topbarNav.appendChild(summary);
    }

    document.querySelectorAll(".ss-header").forEach((header) => {
      let right = header.querySelector(".ss-header-right");
      if (!right) {
        right = document.createElement("div");
        right.className = "ss-header-right";
        header.appendChild(right);
      }
      if (!right.querySelector("[data-auth-summary]")) {
        right.appendChild(buildAuthSummary());
      }
    });
  }

  function updateAuthSummary(session) {
    const summaries = document.querySelectorAll("[data-auth-summary]");
    summaries.forEach((summary) => {
      const emailEl = summary.querySelector("[data-auth-email]");
      const tierEl = summary.querySelector("[data-auth-tier]");
      const logoutEl = summary.querySelector("[data-auth-logout]");

      if (!emailEl || !tierEl || !logoutEl) return;

      if (!session?.authenticated) {
        emailEl.textContent = "Signed out";
        tierEl.hidden = true;
        logoutEl.hidden = true;
        return;
      }

      emailEl.textContent = session.email || "Signed in";
      tierEl.textContent = session.tier || "OPEN";
      tierEl.hidden = false;
      logoutEl.hidden = false;
    });
  }

  async function logout() {
    try {
      await fetchJson(
        AUTH_ENDPOINTS.logout,
        { method: "POST" },
        5000
      );
    } catch (err) {
      try {
        await fetchJson(
          AUTH_ENDPOINTS.logout,
          { method: "GET" },
          5000
        );
      } catch (fallbackErr) {
        // Ignore logout failures; we still fail closed by redirecting.
      }
    } finally {
      clearLocalSessionState();
      window.location.assign("/auth/login.html?reason=logout");
    }
  }

  function clearLocalSessionState() {
    sessionState.value = { authenticated: false };
    updateAppSession(sessionState.value);
    if (window.App?.state) {
      window.App.state = {};
    }
  }

  function wireLogoutButtons() {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("[data-auth-logout]");
      if (!button) return;
      event.preventDefault();
      logout();
    });
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function resolveLoginReason() {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason");
    switch (reason) {
      case "expired":
        return "Your session expired. Sign in again to continue.";
      case "unauthorized":
        return "Your account does not have creator access.";
      case "unavailable":
        return "Auth service is unreachable. Please try again.";
      case "logout":
        return "You have been signed out.";
      default:
        return "";
    }
  }

  async function requestMagicLink(email) {
    const payload = { email };
    return fetchJson(
      AUTH_ENDPOINTS.magicLink,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      },
      8000
    );
  }

  function wireLoginForm() {
    const form = document.querySelector("[data-auth-magic-form]");
    if (!form) return;

    const emailInput = form.querySelector("[data-auth-email-input]");
    const submitButton = form.querySelector("[data-auth-magic-submit]");
    const status = form.querySelector("[data-auth-status]");
    const error = form.querySelector("[data-auth-error]");
    const success = form.querySelector("[data-auth-success]");
    const hint = form.querySelector("[data-auth-hint]");

    const initialHint = resolveLoginReason() || window.StreamSuitesAuth?.loginHint || "";
    if (hint && initialHint) {
      hint.textContent = initialHint;
      hint.hidden = false;
    }

    function setState(state, message = "") {
      form.dataset.authState = state;
      if (status) {
        status.textContent = message;
      }
      if (error) {
        error.hidden = state !== "error";
        if (state === "error") {
          error.textContent = message || "Unable to send magic link.";
        }
      }
      if (success) {
        success.hidden = state !== "sent";
        if (state === "sent") {
          success.textContent = message || "Check your email for your sign-in link.";
        }
      }
      const isLoading = state === "loading";
      if (emailInput) emailInput.disabled = isLoading;
      if (submitButton) submitButton.disabled = isLoading;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!emailInput) return;

      const email = emailInput.value.trim();
      if (!isValidEmail(email)) {
        setState("error", "Enter a valid email to receive your magic link.");
        return;
      }

      setState("loading", "Sending magic link…");

      try {
        await requestMagicLink(email);
        setState("sent", "Check your email for your sign-in link.");
      } catch (err) {
        const message =
          typeof err?.payload?.message === "string"
            ? err.payload.message
            : "Unable to send magic link. Try again.";
        setState("error", message);
      }
    });
  }

  function wireOauthButtons() {
    const buttons = document.querySelectorAll("[data-auth-oauth]");
    buttons.forEach((button) => {
      const provider = button.getAttribute("data-auth-oauth");
      if (!provider) return;
      const url = AUTH_ENDPOINTS.oauth[provider];
      if (!url) return;
      if (button instanceof HTMLAnchorElement) {
        button.href = url;
        return;
      }
      button.addEventListener("click", (event) => {
        event.preventDefault();
        window.location.assign(url);
      });
    });
  }

  function toggleCreatorLockout(show) {
    const lockout = document.querySelector("[data-creator-lockout]");
    const content = document.querySelector("[data-creator-content]");
    if (!lockout) return false;

    if (show) {
      lockout.hidden = false;
      if (content) content.hidden = true;
      document.body.classList.add("creator-lockout-active");
    } else {
      lockout.hidden = true;
      if (content) content.hidden = false;
      document.body.classList.remove("creator-lockout-active");
    }
    return true;
  }

  async function initAuth() {
    const pathname = getPathname();
    const isPublic = isPublicPath(pathname);

    ensureAuthSummaryMounts();
    wireLogoutButtons();
    wireOauthButtons();

    const session = await loadSession();
    updateAppSession(session);
    updateAuthSummary(session);

    if (session?.authenticated && isPublic) {
      window.location.assign("/index.html");
      return;
    }

    if (!session?.authenticated && !isPublic) {
      const reason = session?.error ? "unavailable" : "expired";
      window.location.assign(`/auth/login.html?reason=${reason}`);
      return;
    }

    if (session?.authenticated) {
      const role = normalizeRole(session.role);
      if (role !== CREATOR_ROLE) {
        const locked = toggleCreatorLockout(true);
        if (!locked) {
          window.location.assign("/auth/login.html?reason=unauthorized");
        }
        return;
      }
    }

    if (session?.authenticated && !isPublic) {
      toggleCreatorLockout(false);
      loadOnboarding(session);
    }

    if (isPublic) {
      if (session?.error && !new URLSearchParams(window.location.search).get("reason")) {
        window.StreamSuitesAuth.loginHint = "Auth service is unreachable. Please try again.";
      }
      wireLoginForm();
    }
  }

  function loadOnboarding(session) {
    if (!session?.authenticated) return;

    if (window.StreamSuitesOnboarding?.init) {
      window.StreamSuitesOnboarding.init(session);
      return;
    }

    const existing = document.querySelector("script[data-onboarding-script]");
    if (existing) {
      existing.addEventListener("load", () => {
        window.StreamSuitesOnboarding?.init?.(session);
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "/js/onboarding.js";
    script.defer = true;
    script.dataset.onboardingScript = "true";
    script.addEventListener("load", () => {
      window.StreamSuitesOnboarding?.init?.(session);
    });
    script.addEventListener("error", () => {
      console.warn("[Dashboard][Auth] Failed to load onboarding module.");
    });
    document.body.appendChild(script);
  }

  window.StreamSuitesAuth = {
    endpoints: AUTH_ENDPOINTS,
    loadSession,
    logout,
    requestMagicLink
  };

  document.addEventListener("DOMContentLoaded", () => {
    initAuth();
  });
})();
