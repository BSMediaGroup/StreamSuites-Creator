(() => {
  "use strict";

  const AUTH_BASE_URL = "https://api.streamsuites.app";
  const CREATOR_ORIGIN = "https://creator.streamsuites.app";
  const AUTH_ENDPOINTS = Object.freeze({
    session: `${AUTH_BASE_URL}/auth/session`,
    logout: `${AUTH_BASE_URL}/auth/logout`,
    emailLogin: `${AUTH_BASE_URL}/auth/login/password`,
    resendVerify: `${AUTH_BASE_URL}/auth/verify/resend`,
    signup: `${AUTH_BASE_URL}/auth/signup/email`,
    oauth: Object.freeze({
      google: `${AUTH_BASE_URL}/auth/google`,
      github: `${AUTH_BASE_URL}/auth/github`,
      discord: `${AUTH_BASE_URL}/auth/discord`,
      x: `${AUTH_BASE_URL}/auth/x/start?surface=creator`,
      twitch: `${AUTH_BASE_URL}/oauth/twitch/start`
    })
  });
  const ACCOUNT_ENDPOINTS = Object.freeze({
    me: `${AUTH_BASE_URL}/account/me`
  });

  const CREATOR_ROLE = "creator";
  const TIER_LABELS = new Map([
    ["CORE", "CORE"],
    ["CORETIER", "CORE"],
    ["GOLD", "GOLD"],
    ["GOLDTIER", "GOLD"],
    ["PRO", "PRO"],
    ["PROTIER", "PRO"]
  ]);
  const TIER_ICON_SOURCES = new Map([
    ["CORE", "/assets/icons/tier-core.svg"],
    ["GOLD", "/assets/icons/tier-gold.svg"],
    ["PRO", "/assets/icons/tier-pro.svg"]
  ]);
  const TIER_ID_OPTIONS = new Set(["core", "gold", "pro"]);
  const PUBLIC_PATHS = new Set(["/auth/login.html", "/auth/success.html"]);
  const ACCOUNT_AUTH_PROVIDER_ALIASES = Object.freeze({
    email: Object.freeze(["email", "password", "credentials", "local"]),
    discord: Object.freeze(["discord"]),
    google: Object.freeze(["google"]),
    github: Object.freeze(["github"]),
    x: Object.freeze(["x", "twitter"])
  });

  const CREATOR_LOGIN_PAGE = `${CREATOR_ORIGIN}/auth/login.html`;
  const CREATOR_ONBOARDING_PAGE = `${CREATOR_ORIGIN}/views/onboarding.html`;
  const LOGOUT_REASON = "logout";
  const REDIRECT_GUARD_KEY = "streamsuites.creator.loginRedirected";
  const LOGOUT_GUARD_KEY = "streamsuites.creator.loggedOut";
  const LOCAL_SESSION_KEY = "streamsuites.creator.session";
  const LOCAL_SESSION_UPDATED_AT_KEY = "streamsuites.creator.session.updatedAt";
  const LAST_OAUTH_PROVIDER_KEY = "streamsuites.creator.lastOauthProvider";
  const X_EMAIL_BANNER_DISMISSED_KEY = "streamsuites.creator.banner.xMissingEmail.dismissed";
  const CREATOR_RETRY_LOGIN_URL = "/auth/login.html";
  const LOCKOUT_VARIANT_SESSION_INVALID = "session_invalid";
  const LOCKOUT_VARIANT_ROLE_MISMATCH = "role_mismatch";
  const SESSION_POLL_INTERVAL_MS = 20000;
  const SESSION_POLL_FAILURE_THRESHOLD = 3;
  const SESSION_POLL_FAILURE_COOLDOWN_MS = 60000;
  const SESSION_INVALID_REDIRECT_DELAY_MS = 1400;
  const SESSION_IDLE_REASON = "cookie_missing";
  const SESSION_RETRY_MIN_INTERVAL_MS = 7000;

  const sessionState = {
    value: null,
    loading: false
  };
  const sessionMonitor = {
    timer: null,
    checking: false,
    consecutiveFailures: 0,
    lastFailureNoticeAt: 0
  };
  const sessionRetry = {
    idle: false,
    idleReason: "",
    lastAttemptAt: 0,
    notified: false
  };
  let accountMenuWired = false;
  let isAccountMenuOpen = false;
  let activeAccountMenu = null;

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

  function coerceText(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
    return "";
  }

  function normalizeProvider(provider) {
    const normalized = coerceText(provider).toLowerCase();
    if (!normalized) return "";
    if (normalized === "twitter") return "x";
    if (normalized === "google") return "google";
    if (normalized === "github") return "github";
    if (normalized === "discord") return "discord";
    if (normalized === "x") return "x";
    if (normalized === "twitch") return "twitch";
    return normalized;
  }

  function readLocalStorageValue(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (err) {
      return "";
    }
  }

  function writeLocalStorageValue(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      // Ignore storage write errors.
    }
  }

  function getLastOauthProvider() {
    return normalizeProvider(readLocalStorageValue(LAST_OAUTH_PROVIDER_KEY));
  }

  function persistLastOauthProvider(provider) {
    const normalized = normalizeProvider(provider);
    if (!normalized) return;
    writeLocalStorageValue(LAST_OAUTH_PROVIDER_KEY, normalized);
  }

  function isEmailMissing(value) {
    return coerceText(value).length === 0;
  }

  function normalizeTier(tier) {
    if (typeof tier !== "string") return "CORE";
    const normalized = tier.toUpperCase().replace(/[\s_]+/g, "");
    if (!normalized) return "CORE";
    return TIER_LABELS.get(normalized) || "CORE";
  }

  function normalizeTierId(tierId) {
    if (typeof tierId !== "string") return "";
    const trimmed = tierId.trim().toLowerCase();
    return TIER_ID_OPTIONS.has(trimmed) ? trimmed : "";
  }

  function renderTierPill(element, tierLabel) {
    if (!element) return;
    const normalized = normalizeTier(tierLabel);
    element.classList.add("tier-pill");
    element.classList.remove("tier-core", "tier-gold", "tier-pro");
    element.dataset.tier = normalized;
    const content = document.createElement("span");
    content.className = "tier-pill-content";

    const iconSrc = TIER_ICON_SOURCES.get(normalized);
    if (iconSrc) {
      const icon = document.createElement("img");
      icon.className = "tier-pill-icon";
      icon.src = iconSrc;
      icon.alt = "";
      icon.decoding = "async";
      icon.setAttribute("aria-hidden", "true");
      content.appendChild(icon);
    }

    const text = document.createElement("span");
    text.className = "tier-pill-text";
    text.textContent = normalized;
    content.appendChild(text);

    element.replaceChildren(content);
  }

  function normalizeVisibility(visibility) {
    if (typeof visibility !== "string") return "";
    const trimmed = visibility.trim().toLowerCase();
    return trimmed === "public" || trimmed === "soft_locked" ? trimmed : "";
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

  function normalizeFeatures(raw) {
    if (!raw || typeof raw !== "object") return {};
    return { ...raw };
  }

  function normalizeSessionPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return { authenticated: false };
    }
    if (payload.authenticated === false) {
      return { authenticated: false };
    }

    const sessionSource = payload.user && typeof payload.user === "object" ? payload.user : payload;

    const displayNameCandidate =
      typeof sessionSource.name === "string"
        ? sessionSource.name
        : typeof sessionSource.display_name === "string"
          ? sessionSource.display_name
          : typeof sessionSource.displayName === "string"
            ? sessionSource.displayName
            : typeof sessionSource.username === "string"
              ? sessionSource.username
                : "";

    const emailCandidate =
      typeof sessionSource.email === "string" ? sessionSource.email : "";
    const userCodeCandidate =
      typeof sessionSource.user_code === "string"
        ? sessionSource.user_code
        : typeof sessionSource.userCode === "string"
          ? sessionSource.userCode
          : "";
    const providerCandidate = normalizeProvider(
      sessionSource.provider ||
        sessionSource.auth_provider ||
        payload.provider ||
        payload.auth_provider ||
        payload.session?.provider ||
        payload.session?.auth_provider ||
        payload.user?.provider ||
        payload.user?.auth_provider
    );
    const primaryProviderCandidate = normalizeProvider(
      sessionSource.primary_provider ||
        sessionSource.primaryProvider ||
        sessionSource.default_provider ||
        sessionSource.defaultProvider ||
        payload.primary_provider ||
        payload.primaryProvider ||
        payload.default_provider ||
        payload.defaultProvider ||
        payload.session?.primary_provider ||
        payload.session?.primaryProvider ||
        payload.session?.default_provider ||
        payload.session?.defaultProvider ||
        payload.user?.primary_provider ||
        payload.user?.primaryProvider ||
        payload.user?.default_provider ||
        payload.user?.defaultProvider
    );
    const linkedProviders = extractLinkedProviders({
      payload,
      sessionSource,
      activeProvider: providerCandidate
    });

    const roleCandidate =
      typeof sessionSource.role === "string" ? sessionSource.role : "";

    const role = normalizeRole(roleCandidate);
    if (!role) {
      return { authenticated: false };
    }

    const avatarCandidate =
      typeof sessionSource.avatar === "string"
        ? sessionSource.avatar
        : typeof sessionSource.avatar_url === "string"
          ? sessionSource.avatar_url
          : typeof sessionSource.image === "string"
            ? sessionSource.image
            : "";

    const onboardingRequired =
      sessionSource.onboarding_required === true ||
      sessionSource.onboardingRequired === true;

    const effectiveTier = normalizeEffectiveTier(
      sessionSource.effective_tier || sessionSource.effectiveTier
    );
    const features = normalizeFeatures(sessionSource.features);
    const tier = normalizeTier(effectiveTier?.tierId || sessionSource.tier);

    return {
      authenticated: true,
      email: emailCandidate.trim(),
      user_code: userCodeCandidate.trim(),
      name: displayNameCandidate.trim() || "",
      avatar: avatarCandidate.trim() || "",
      role,
      provider: providerCandidate || getLastOauthProvider(),
      primaryProvider: primaryProviderCandidate,
      linkedProviders,
      tier,
      effectiveTier,
      features,
      onboardingRequired
    };
  }

  function isTruthyProviderLink(value) {
    if (value === true || value === 1) return true;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return normalized === "true" || normalized === "1" || normalized === "linked" || normalized === "connected";
    }
    return false;
  }

  function addProviderToSet(set, value) {
    const normalized = normalizeProvider(value);
    if (!normalized) return;
    set.add(normalized);
  }

  function readProviderCollection(source, destination) {
    if (!source) return;
    if (typeof source === "string") {
      source
        .split(",")
        .map((entry) => normalizeProvider(entry))
        .filter(Boolean)
        .forEach((entry) => destination.add(entry));
      return;
    }
    if (Array.isArray(source)) {
      source.forEach((entry) => {
        if (typeof entry === "string") {
          addProviderToSet(destination, entry);
          return;
        }
        if (!entry || typeof entry !== "object") return;
        const nameCandidate =
          entry.provider ||
          entry.name ||
          entry.id ||
          entry.key ||
          entry.provider_name ||
          entry.providerName;
        if (!nameCandidate) return;
        const hasLinkState =
          Object.prototype.hasOwnProperty.call(entry, "linked") ||
          Object.prototype.hasOwnProperty.call(entry, "is_linked") ||
          Object.prototype.hasOwnProperty.call(entry, "connected") ||
          Object.prototype.hasOwnProperty.call(entry, "isConnected");
        if (
          !hasLinkState ||
          isTruthyProviderLink(entry.linked) ||
          isTruthyProviderLink(entry.is_linked) ||
          isTruthyProviderLink(entry.connected) ||
          isTruthyProviderLink(entry.isConnected)
        ) {
          addProviderToSet(destination, nameCandidate);
        }
      });
      return;
    }
    if (typeof source === "object") {
      Object.entries(source).forEach(([providerKey, linked]) => {
        if (isTruthyProviderLink(linked)) {
          addProviderToSet(destination, providerKey);
        }
      });
    }
  }

  function extractLinkedProviders({ payload, sessionSource, activeProvider }) {
    const linked = new Set();
    const providerSources = [
      sessionSource?.providers,
      sessionSource?.linked_providers,
      sessionSource?.linkedProviders,
      sessionSource?.auth_providers,
      sessionSource?.authProviders,
      payload?.providers,
      payload?.linked_providers,
      payload?.linkedProviders,
      payload?.auth_providers,
      payload?.authProviders,
      payload?.user?.providers,
      payload?.user?.linked_providers,
      payload?.user?.linkedProviders,
      payload?.session?.providers,
      payload?.session?.linked_providers,
      payload?.session?.linkedProviders
    ];
    const providerFlagSources = [
      sessionSource?.provider_flags,
      sessionSource?.providerFlags,
      sessionSource?.providers_map,
      sessionSource?.providersMap,
      payload?.provider_flags,
      payload?.providerFlags,
      payload?.providers_map,
      payload?.providersMap,
      payload?.user?.provider_flags,
      payload?.user?.providerFlags
    ];

    providerSources.forEach((entry) => readProviderCollection(entry, linked));
    providerFlagSources.forEach((entry) => readProviderCollection(entry, linked));
    addProviderToSet(linked, activeProvider);

    return Array.from(linked.values());
  }

  function getProviderAliases(providerKey) {
    const normalized = normalizeProvider(providerKey);
    if (!normalized) return [];
    if (ACCOUNT_AUTH_PROVIDER_ALIASES[normalized]) {
      return ACCOUNT_AUTH_PROVIDER_ALIASES[normalized];
    }
    return [normalized];
  }

  function buildLinkedProviderSet(session) {
    const linked = new Set();
    if (Array.isArray(session?.linkedProviders)) {
      session.linkedProviders
        .map((provider) => normalizeProvider(provider))
        .filter(Boolean)
        .forEach((provider) => linked.add(provider));
    }
    const activeProvider = normalizeProvider(session?.provider);
    if (activeProvider) {
      linked.add(activeProvider);
    }
    return linked;
  }

  function isAccountProviderLinked(session, linkedProviders, providerKey) {
    if (!session?.authenticated) return false;
    const aliases = getProviderAliases(providerKey);
    if (!aliases.length) return false;
    return aliases.some((alias) => linkedProviders.has(alias));
  }

  function getDisplayName(session) {
    return session?.name || session?.email || "Signed in";
  }

  function getEmailValue(session) {
    return session?.email || "Signed in";
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

  function normalizeAuthReason(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return "";
    if (trimmed.includes(SESSION_IDLE_REASON)) return SESSION_IDLE_REASON;
    return trimmed;
  }

  function resolveAuthReason(payload, response) {
    if (!payload || typeof payload !== "object") {
      const headerReason =
        response?.headers &&
        ["x-auth-reason", "x-streamsuites-auth-reason", "x-auth-status"]
          .map((header) => response.headers.get(header))
          .find(Boolean);
      return normalizeAuthReason(headerReason);
    }

    const candidate =
      payload.reason ||
      payload.error?.reason ||
      payload.status ||
      payload.error ||
      payload.message;

    if (candidate) {
      return normalizeAuthReason(candidate);
    }

    const headerReason =
      response?.headers &&
      ["x-auth-reason", "x-streamsuites-auth-reason", "x-auth-status"]
        .map((header) => response.headers.get(header))
        .find(Boolean);
    return normalizeAuthReason(headerReason);
  }

  function resolveAuthReasonEnum(payload, response) {
    if (payload && typeof payload === "object") {
      const candidate = payload.reason_enum || payload.error?.reason_enum;
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim().toUpperCase();
      }
    }
    const headerReason =
      response?.headers &&
      ["x-auth-reason-enum", "x-streamsuites-auth-reason-enum"]
        .map((header) => response.headers.get(header))
        .find(Boolean);
    if (typeof headerReason === "string" && headerReason.trim()) {
      return headerReason.trim().toUpperCase();
    }
    return "";
  }

  async function ensureIdleBackoff() {
    if (!sessionRetry.idle || !sessionRetry.lastAttemptAt) {
      sessionRetry.lastAttemptAt = Date.now();
      return;
    }
    const now = Date.now();
    const nextAllowedAt = sessionRetry.lastAttemptAt + SESSION_RETRY_MIN_INTERVAL_MS;
    if (now < nextAllowedAt) {
      await new Promise((resolve) => setTimeout(resolve, nextAllowedAt - now));
    }
    sessionRetry.lastAttemptAt = Date.now();
  }

  async function fetchSessionJson(timeoutMs = 8000) {
    const fetchWithTimeout = getFetchWithTimeout();
    const response = await fetchWithTimeout(
      AUTH_ENDPOINTS.session,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json"
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

    const reason = resolveAuthReason(data, response);
    const reasonEnum = resolveAuthReasonEnum(data, response);

    if (!response.ok) {
      const error = new Error("Auth request failed");
      error.status = response.status;
      error.payload = data;
      error.reason = reason;
      error.reasonEnum = reasonEnum;
      throw error;
    }

    return { payload: data, reason, reasonEnum };
  }

  function isCookieMissingError(err) {
    if (!err || err.status !== 401) return false;
    const reasonEnum = typeof err.reasonEnum === "string" ? err.reasonEnum.trim().toUpperCase() : "";
    if (reasonEnum === "COOKIE_MISSING") return true;
    const reason = normalizeAuthReason(err.reason || err.payload?.reason);
    return reason === SESSION_IDLE_REASON;
  }

  function isCookieMissingSessionState(session) {
    if (!session || session.authenticated === true) return false;
    const reasonEnum =
      typeof session.errorReasonEnum === "string" ? session.errorReasonEnum.trim().toUpperCase() : "";
    if (reasonEnum === "COOKIE_MISSING") return true;
    if (session.idle === true) return true;
    const reason = normalizeAuthReason(
      session.errorReason || session.error?.reason || session.error?.payload?.reason
    );
    return reason === SESSION_IDLE_REASON;
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

  async function requestJson(url, options = {}, timeoutMs = 8000) {
    const fetchWithTimeout = getFetchWithTimeout();
    const response = await fetchWithTimeout(
      url,
      {
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
      const error = new Error("Request failed");
      error.status = response.status;
      error.payload = data;
      throw error;
    }

    return data;
  }

  async function loadSession(options = {}) {
    if (sessionState.loading) return sessionState.value;
    if (sessionState.value && options.force !== true) return sessionState.value;
    if (sessionRetry.idle && options.force !== true) {
      return (
        sessionState.value || {
          authenticated: false,
          errorStatus: 401,
          errorReason: sessionRetry.idleReason || SESSION_IDLE_REASON,
          idle: true
        }
      );
    }

    sessionState.loading = true;
    try {
      if (sessionRetry.idle && options.force === true) {
        await ensureIdleBackoff();
      }
      const { payload } = await fetchSessionJson(5000);
      sessionRetry.idle = false;
      sessionRetry.idleReason = "";
      sessionRetry.notified = false;
      const normalized = normalizeSessionPayload(payload);
      if (normalized?.authenticated && normalized?.provider) {
        persistLastOauthProvider(normalized.provider);
      }
      sessionState.value = {
        ...normalized,
        reasonEnum: resolveAuthReasonEnum(payload, null)
      };
    } catch (err) {
      if (isCookieMissingError(err)) {
        sessionRetry.idle = true;
        sessionRetry.idleReason = SESSION_IDLE_REASON;
        sessionRetry.lastAttemptAt = Date.now();
        if (!sessionRetry.notified) {
          console.info("[Creator][Auth] Session idle (cookie missing).");
          sessionRetry.notified = true;
        }
        sessionState.value = {
          authenticated: false,
          error: err,
          errorStatus: err?.status ?? null,
          errorReason: sessionRetry.idleReason,
          errorReasonEnum: err?.reasonEnum || "COOKIE_MISSING",
          idle: true
        };
      } else {
        sessionState.value = {
          authenticated: false,
          error: err,
          errorStatus: err?.status ?? null,
          errorReasonEnum: err?.reasonEnum || ""
        };
      }
    } finally {
      sessionState.loading = false;
    }

    return sessionState.value;
  }

  function areSessionsEquivalent(left, right) {
    if (left === right) return true;
    if (!left || !right) return false;
    return (
      !!left.authenticated === !!right.authenticated &&
      (left.email || "") === (right.email || "") &&
      (left.user_code || "") === (right.user_code || "") &&
      (left.name || "") === (right.name || "") &&
      (left.avatar || "") === (right.avatar || "") &&
      (left.role || "") === (right.role || "") &&
      (left.provider || "") === (right.provider || "") &&
      (left.primaryProvider || "") === (right.primaryProvider || "") &&
      JSON.stringify(left.linkedProviders || []) === JSON.stringify(right.linkedProviders || []) &&
      (left.tier || "") === (right.tier || "") &&
      (left.effectiveTier?.tierId || "") === (right.effectiveTier?.tierId || "") &&
      (left.effectiveTier?.tierLabel || "") === (right.effectiveTier?.tierLabel || "") &&
      (left.effectiveTier?.visibility || "") === (right.effectiveTier?.visibility || "") &&
      JSON.stringify(left.features || {}) === JSON.stringify(right.features || {}) &&
      !!left.onboardingRequired === !!right.onboardingRequired
    );
  }

  function getTierLabel(session) {
    return normalizeTier(session?.effectiveTier?.tierLabel || session?.tier || "CORE");
  }

  function getCreatorIdValue(session) {
    const userCode = typeof session?.user_code === "string" ? session.user_code.trim() : "";
    return userCode || "Not available";
  }

  function ensureCreatorIdDetailValue(menu, detailsPanel) {
    if (!menu || !detailsPanel) return null;

    const existingValue = menu.querySelector("[data-account-detail-user-code]");
    if (existingValue) return existingValue;

    const detailRow = document.createElement("div");
    detailRow.className = "creator-account-detail";

    const label = document.createElement("span");
    label.className = "creator-account-detail-label";
    label.textContent = "Creator ID";

    const value = document.createElement("span");
    value.className = "creator-account-detail-value";
    value.dataset.accountDetailUserCode = "true";
    value.textContent = "Not available";

    detailRow.append(label, value);

    const tierValue = menu.querySelector("[data-account-detail-tier]");
    const tierRow = tierValue ? tierValue.closest(".creator-account-detail") : null;
    if (tierRow && tierRow.parentElement === detailsPanel) {
      detailsPanel.insertBefore(detailRow, tierRow);
    } else {
      detailsPanel.append(detailRow);
    }

    return value;
  }

  function updateAppSession(session) {
    ensureAppNamespace();
    window.App.session = {
      authenticated: !!session?.authenticated,
      email: session?.email || "",
      user_code: session?.user_code || "",
      name: session?.name || "",
      avatar: session?.avatar || "",
      role: session?.role || "",
      provider: session?.provider || "",
      primaryProvider: session?.primaryProvider || "",
      linkedProviders: Array.isArray(session?.linkedProviders) ? session.linkedProviders : [],
      tier: session?.tier || "",
      effectiveTier: session?.effectiveTier || null,
      features: session?.features || {},
      onboardingRequired: session?.onboardingRequired === true
    };
  }

  function persistLocalSession(session) {
    const payload = {
      authenticated: !!session?.authenticated,
      email: session?.email || "",
      user_code: session?.user_code || "",
      name: session?.name || "",
      avatar: session?.avatar || "",
      role: session?.role || "",
      provider: session?.provider || "",
      primaryProvider: session?.primaryProvider || "",
      linkedProviders: Array.isArray(session?.linkedProviders) ? session.linkedProviders : [],
      tier: session?.tier || "",
      effectiveTier: session?.effectiveTier || null,
      features: session?.features || {},
      onboardingRequired: session?.onboardingRequired === true
    };
    try {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(payload));
      localStorage.setItem(LOCAL_SESSION_UPDATED_AT_KEY, String(Date.now()));
    } catch (err) {
      console.warn("[Dashboard][Auth] Failed to persist session", err);
    }
  }

  function buildAuthSummary() {
    const wrapper = document.createElement("div");
    wrapper.className = "ss-auth-summary";
    wrapper.dataset.authSummary = "true";

    const avatar = document.createElement("img");
    avatar.className = "ss-auth-avatar";
    avatar.dataset.authAvatar = "true";
    avatar.alt = "Account avatar";
    avatar.src = "/assets/icons/ui/profile.svg";

    const meta = document.createElement("div");
    meta.className = "ss-auth-meta";

    const label = document.createElement("span");
    label.className = "ss-auth-label";
    label.textContent = "StreamSuites account";

    const name = document.createElement("span");
    name.className = "ss-auth-name";
    name.dataset.authName = "true";
    name.dataset.authEmail = "true";
    name.textContent = "Signed out";

    meta.append(label, name);

    const tier = document.createElement("span");
    tier.className = "ss-chip auth-chip auth-tier";
    tier.dataset.authTier = "true";
    tier.textContent = "CORE";

    const logout = document.createElement("button");
    logout.type = "button";
    logout.className = "ss-btn ss-btn-secondary ss-btn-small auth-logout";
    logout.dataset.authLogout = "true";
    logout.textContent = "Logout";

    wrapper.append(avatar, meta, tier, logout);
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
      const nameEl = summary.querySelector("[data-auth-name]");
      const tierEl = summary.querySelector("[data-auth-tier]");
      const logoutEl = summary.querySelector("[data-auth-logout]");
      const avatarEl = summary.querySelector("[data-auth-avatar]");

      if (!emailEl || !tierEl || !logoutEl) return;

      if (!session?.authenticated) {
        if (emailEl) emailEl.textContent = "Signed out";
        if (nameEl && nameEl !== emailEl) {
          nameEl.textContent = "Signed out";
        }
        tierEl.hidden = true;
        logoutEl.hidden = true;
        if (avatarEl) avatarEl.src = "/assets/icons/ui/profile.svg";
        return;
      }

      const displayName = getDisplayName(session);
      const emailValue = getEmailValue(session);
      if (emailEl) {
        emailEl.textContent = emailEl === nameEl ? displayName : emailValue;
      }
      if (nameEl) {
        nameEl.textContent = displayName;
      }
      const tierLabel = getTierLabel(session);
      renderTierPill(tierEl, tierLabel);
      tierEl.hidden = false;
      logoutEl.hidden = false;
      if (avatarEl) {
        avatarEl.src = session.avatar || "/assets/icons/ui/profile.svg";
      }
    });
    updateAccountMenuState(session);
    updateAccountSettingsPanel(session);
  }

  function updateAccountMenuState(session) {
    const menus = document.querySelectorAll("[data-account-menu]");
    const authenticated = !!session?.authenticated;

    menus.forEach((menu) => {
      menu.dataset.authenticated = authenticated ? "true" : "false";
      const toggle = menu.querySelector("[data-account-toggle]");
      const dropdown = menu.querySelector("[data-account-dropdown]");
      const detailsPanel = menu.querySelector("[data-account-details-panel]");
      const editPanel = menu.querySelector("[data-account-edit-panel]");
      const detailName = menu.querySelector("[data-account-detail-name]");
      const detailEmail = menu.querySelector("[data-account-detail-email]");
      const detailTier = menu.querySelector("[data-account-detail-tier]");
      const detailCreatorId = ensureCreatorIdDetailValue(menu, detailsPanel);

      if (toggle) {
        toggle.disabled = !authenticated;
        toggle.setAttribute("aria-expanded", "false");
      }

      if (!authenticated) {
        closeAccountMenu(menu);
      }

      if (detailName) {
        detailName.textContent = authenticated ? getDisplayName(session) : "Signed out";
      }
      if (detailEmail) {
        detailEmail.textContent = authenticated ? getEmailValue(session) : "Signed out";
      }
      if (detailCreatorId) {
        detailCreatorId.textContent = authenticated ? getCreatorIdValue(session) : "Not available";
      }
      if (detailTier) {
        renderTierPill(detailTier, authenticated ? getTierLabel(session) : "CORE");
      }
    });
  }

  function updateAccountSettingsPanel(session) {
    const nameInput = document.querySelector("[data-account-profile-name]");
    const userCodeValue = document.querySelector("[data-account-profile-user-code]");
    const profileEmailValue = document.querySelector("[data-account-profile-email]");
    const avatarImage = document.querySelector("[data-account-profile-avatar]");
    const tierValue = document.querySelector("[data-account-profile-tier]");
    const authenticated = !!session?.authenticated;
    const linkedProviders = buildLinkedProviderSet(session);
    const emailProviderStatus = document.querySelector('[data-account-provider-status="email"]');
    const emailProviderNote = document.querySelector('[data-account-provider-note="email"]');
    const emailProviderValue = document.querySelector('[data-account-provider-value="email"]');
    const discordProviderStatus = document.querySelector('[data-account-provider-status="discord"]');
    const discordProviderNote = document.querySelector('[data-account-provider-note="discord"]');
    const googleProviderStatus = document.querySelector('[data-account-provider-status="google"]');
    const googleProviderNote = document.querySelector('[data-account-provider-note="google"]');
    const githubProviderStatus = document.querySelector('[data-account-provider-status="github"]');
    const githubProviderNote = document.querySelector('[data-account-provider-note="github"]');
    const xProviderStatus = document.querySelector('[data-account-provider-status="x"]');
    const xProviderNote = document.querySelector('[data-account-provider-note="x"]');

    if (nameInput instanceof HTMLInputElement) {
      nameInput.value = authenticated ? getDisplayName(session) : "Signed out";
    }
    if (userCodeValue) {
      userCodeValue.textContent = authenticated ? getCreatorIdValue(session) : "Not available";
    }
    if (tierValue) {
      renderTierPill(tierValue, authenticated ? getTierLabel(session) : "CORE");
    }
    if (avatarImage instanceof HTMLImageElement) {
      avatarImage.src = authenticated && session?.avatar ? session.avatar : "/assets/icons/ui/profile.svg";
    }

    const emailValue = coerceText(session?.email);
    if (profileEmailValue) {
      profileEmailValue.textContent = authenticated ? emailValue : "";
    }

    const providerRows = [
      {
        key: "email",
        statusElement: emailProviderStatus,
        noteElement: emailProviderNote,
        linked: isAccountProviderLinked(session, linkedProviders, "email")
      },
      {
        key: "discord",
        statusElement: discordProviderStatus,
        noteElement: discordProviderNote,
        linked: isAccountProviderLinked(session, linkedProviders, "discord")
      },
      {
        key: "google",
        statusElement: googleProviderStatus,
        noteElement: googleProviderNote,
        linked: isAccountProviderLinked(session, linkedProviders, "google")
      },
      {
        key: "github",
        statusElement: githubProviderStatus,
        noteElement: githubProviderNote,
        linked: isAccountProviderLinked(session, linkedProviders, "github")
      },
      {
        key: "x",
        statusElement: xProviderStatus,
        noteElement: xProviderNote,
        linked: isAccountProviderLinked(session, linkedProviders, "x")
      }
    ];

    const primaryProvider = normalizeProvider(session?.primaryProvider);
    providerRows.forEach((row) => {
      setProviderStatus(row.statusElement, {
        linked: authenticated && row.linked,
        linkedText: "Connected",
        unlinkedText: "Not connected"
      });
      const isPrimary =
        !!primaryProvider &&
        row.linked &&
        getProviderAliases(row.key).includes(primaryProvider);
      setProviderNote(row.noteElement, isPrimary ? "Primary sign-in" : "");
    });

    setProviderValue(emailProviderValue, authenticated ? emailValue : "");
  }

  function setProviderStatus(element, { linked, linkedText = "Connected", unlinkedText = "Not connected" } = {}) {
    if (!(element instanceof HTMLElement)) return;
    element.classList.remove("success", "subtle");
    element.classList.add(linked ? "success" : "subtle");
    const dot = element.querySelector(".status-dot");
    element.textContent = linked ? linkedText : unlinkedText;
    if (dot) {
      element.prepend(dot);
    }
  }

  function setProviderNote(element, noteText) {
    if (!(element instanceof HTMLElement)) return;
    const value = coerceText(noteText);
    element.textContent = value;
    element.hidden = value.length === 0;
  }

  function setProviderValue(element, valueText) {
    if (!(element instanceof HTMLElement)) return;
    element.textContent = coerceText(valueText);
  }

  async function logout() {
    try {
      await fetchJson(AUTH_ENDPOINTS.logout, { method: "POST" }, 5000);
    } finally {
      stopSessionMonitor();
      clearLocalSessionState();
      setCreatorShellVisible(false);
      try {
        sessionStorage.setItem(LOGOUT_GUARD_KEY, "true");
      } catch (err) {
        console.warn("[Dashboard][Auth] Failed to set logout guard", err);
      }
      window.location.assign(`/auth/login.html?reason=${LOGOUT_REASON}`);
    }
  }

  function clearLocalSessionState() {
    sessionState.value = { authenticated: false };
    updateAppSession(sessionState.value);
    updateAuthSummary(sessionState.value);
    updateXEmailBanner(sessionState.value, isPublicPath(getPathname()));
    if (window.App?.state) {
      window.App.state = {};
    }
    try {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      localStorage.removeItem(LOCAL_SESSION_UPDATED_AT_KEY);
    } catch (err) {
      console.warn("[Dashboard][Auth] Failed to clear persisted session", err);
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

  function setAccountMenuOpen(menu, open) {
    if (!menu) return;
    const toggle = menu.querySelector("[data-account-toggle]");
    menu.classList.toggle("is-account-open", open);
    menu.dataset.accountOpen = open ? "true" : "false";
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      isAccountMenuOpen = true;
      activeAccountMenu = menu;
    } else if (activeAccountMenu === menu) {
      activeAccountMenu = null;
      isAccountMenuOpen = false;
    }
  }

  function closeAccountMenu(menu) {
    const detailsPanel = menu.querySelector("[data-account-details-panel]");
    const editPanel = menu.querySelector("[data-account-edit-panel]");
    if (detailsPanel) detailsPanel.hidden = true;
    if (editPanel) editPanel.hidden = true;
    setAccountMenuStatus(menu, "");
    setAccountMenuOpen(menu, false);
  }

  function closeAccountMenus() {
    document.querySelectorAll("[data-account-menu].is-account-open").forEach((menu) => {
      closeAccountMenu(menu);
    });
    isAccountMenuOpen = false;
    activeAccountMenu = null;
  }

  function setAccountMenuStatus(menu, message, state = "idle") {
    const status = menu.querySelector("[data-account-status]");
    if (!status) return;
    status.textContent = message || "";
    status.hidden = !message;
    if (message) {
      status.dataset.state = state;
    } else {
      status.removeAttribute("data-state");
    }
  }

  function setAccountMenuBusy(menu, busy) {
    const inputs = menu.querySelectorAll(
      "[data-account-display-name], [data-account-save], [data-account-cancel], [data-account-delete]"
    );
    inputs.forEach((input) => {
      if (input instanceof HTMLInputElement || input instanceof HTMLButtonElement) {
        input.disabled = busy;
      }
    });
  }

  function updateSessionDisplayName(displayName) {
    if (!sessionState.value) return;
    sessionState.value = {
      ...sessionState.value,
      name: displayName
    };
    updateAppSession(sessionState.value);
    persistLocalSession(sessionState.value);
    updateAuthSummary(sessionState.value);
  }

  async function requestDisplayNameUpdate(displayName) {
    return requestJson(
      ACCOUNT_ENDPOINTS.me,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          display_name: displayName
        })
      },
      8000
    );
  }

  async function requestAccountDelete() {
    return requestJson(
      ACCOUNT_ENDPOINTS.me,
      {
        method: "DELETE"
      },
      8000
    );
  }

  function wireAccountMenus() {
    const menus = document.querySelectorAll("[data-account-menu]");
    if (!menus.length) return;

    menus.forEach((menu) => {
      if (menu.dataset.menuWired === "true") return;
      menu.dataset.menuWired = "true";
      const toggle = menu.querySelector("[data-account-toggle]");
      const dropdown = menu.querySelector("[data-account-dropdown]");
      const detailsToggle = menu.querySelector("[data-account-details-toggle]");
      const detailsPanel = menu.querySelector("[data-account-details-panel]");
      const editToggle = menu.querySelector("[data-account-edit-toggle]");
      const editPanel = menu.querySelector("[data-account-edit-panel]");
      const input = menu.querySelector("[data-account-display-name]");
      const save = menu.querySelector("[data-account-save]");
      const cancel = menu.querySelector("[data-account-cancel]");
      const deleteButton = menu.querySelector("[data-account-delete]");

      if (toggle && dropdown) {
        toggle.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (toggle.disabled) return;
          const isOpen = isAccountMenuOpen && activeAccountMenu === menu;
          closeAccountMenus();
          if (!isOpen) {
            setAccountMenuOpen(menu, true);
          }
        });
      }

      if (detailsToggle && detailsPanel) {
        detailsToggle.addEventListener("click", (event) => {
          event.preventDefault();
          const nextState = detailsPanel.hidden;
          detailsPanel.hidden = !nextState;
          if (editPanel) editPanel.hidden = true;
        });
      }

      if (editToggle && editPanel) {
        editToggle.addEventListener("click", (event) => {
          event.preventDefault();
          const nextState = editPanel.hidden;
          editPanel.hidden = !nextState;
          if (detailsPanel) detailsPanel.hidden = true;
          if (nextState && input instanceof HTMLInputElement) {
            input.value = getDisplayName(sessionState.value || window.App?.session || {});
            input.focus();
          }
        });
      }

      if (cancel && editPanel) {
        cancel.addEventListener("click", (event) => {
          event.preventDefault();
          editPanel.hidden = true;
          setAccountMenuStatus(menu, "");
        });
      }

      if (save && input instanceof HTMLInputElement) {
        save.addEventListener("click", async (event) => {
          event.preventDefault();
          const nextName = input.value.trim();
          if (!nextName) {
            setAccountMenuStatus(menu, "Display name cannot be empty.", "error");
            return;
          }
          setAccountMenuBusy(menu, true);
          setAccountMenuStatus(menu, "Saving display name...");
          try {
            await requestDisplayNameUpdate(nextName);
            updateSessionDisplayName(nextName);
            setAccountMenuStatus(menu, "Display name updated.");
            if (editPanel) editPanel.hidden = true;
          } catch (err) {
            const message =
              typeof err?.payload?.message === "string"
                ? err.payload.message
                : "Unable to update display name.";
            setAccountMenuStatus(menu, message, "error");
          } finally {
            setAccountMenuBusy(menu, false);
          }
        });
      }

      if (deleteButton) {
        deleteButton.addEventListener("click", async (event) => {
          event.preventDefault();
          const confirmed = window.confirm("This will permanently disable your account");
          if (!confirmed) return;
          setAccountMenuBusy(menu, true);
          setAccountMenuStatus(menu, "Deleting account...");
          try {
            await requestAccountDelete();
            try {
              await requestJson(AUTH_ENDPOINTS.logout, { method: "POST" }, 5000);
            } catch (err) {
              // Best-effort logout before redirect.
            }
            clearLocalSessionState();
            window.location.assign("https://streamsuites.app");
          } catch (err) {
            const message =
              typeof err?.payload?.message === "string"
                ? err.payload.message
                : "Unable to delete account.";
            setAccountMenuStatus(menu, message, "error");
          } finally {
            setAccountMenuBusy(menu, false);
          }
        });
      }

      if (dropdown) {
        dropdown.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const item = target.closest(".creator-account-item");
          if (!item) return;
          closeAccountMenu(menu);
        });
      }
    });

    if (accountMenuWired) return;
    accountMenuWired = true;

    document.addEventListener("click", (event) => {
      if (!isAccountMenuOpen) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-account-menu]")) return;
      closeAccountMenus();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAccountMenus();
      }
    });
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  const PASSWORD_MIN_LENGTH = 8;

  function hasSpecialCharacter(value) {
    return /[^A-Za-z0-9]/.test(value);
  }

  function evaluatePasswordStrength(password) {
    if (!password) return { label: "Weak", score: 0 };
    let score = 0;
    if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
    if (password.length >= 12) score += 1;
    if (hasSpecialCharacter(password)) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)) score += 1;
    if (score <= 1) return { label: "Weak", score };
    if (score <= 3) return { label: "Moderate", score };
    return { label: "Strong", score };
  }

  function resolveLoginContext() {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason");
    const verified = params.get("verified");
    if (verified === "1") {
      return { message: "Email verified. Log in to continue.", showResend: false };
    }
    switch (reason) {
      case "expired":
        return { message: "Your session expired. Sign in again to continue.", showResend: false };
      case "unauthorized":
        return { message: "Your account does not have creator access.", showResend: false };
      case "unavailable":
        return { message: "Auth service is unreachable. Please try again.", showResend: false };
      case "logout":
        return { message: "You have been signed out.", showResend: false };
      case "verification-expired":
        return {
          message: "Your verification link expired. Resend a new email below.",
          showResend: true
        };
      default:
        return { message: "", showResend: false };
    }
  }

  async function requestPasswordLogin(payload) {
    return fetchJson(
      AUTH_ENDPOINTS.emailLogin,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...payload,
          surface: "creator"
        })
      },
      8000
    );
  }

  async function requestSignup(payload) {
    const data = await requestJson(
      AUTH_ENDPOINTS.signup,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...payload,
          surface: "creator"
        })
      },
      8000
    );
    if (data?.success === false) {
      const error = new Error("Signup failed");
      error.status = 400;
      error.payload = data;
      throw error;
    }
    return data;
  }

  async function requestVerificationResend(email) {
    const response = await fetch(AUTH_ENDPOINTS.resendVerify, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        email,
        surface: "creator"
      })
    });

    const raw = await response.text();
    let payload = null;
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch (err) {
        payload = null;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      payload
    };
  }

  function resolvePostAuthRedirect(session) {
    const needsOnboarding = session?.onboardingRequired === true;
    return needsOnboarding ? CREATOR_ONBOARDING_PAGE : `${CREATOR_ORIGIN}/index.html`;
  }

  async function routeAfterAuth(payload = null) {
    if (payload && typeof payload === "object") {
      const sessionFromPayload = normalizeSessionPayload(payload);
      if (sessionFromPayload.authenticated) {
        window.location.assign(resolvePostAuthRedirect(sessionFromPayload));
        return;
      }
    }

    const session = await loadSession({ force: true });
    if (session?.authenticated) {
      window.location.assign(resolvePostAuthRedirect(session));
    }
  }

  function setAuthView(view) {
    const modal = document.querySelector("[data-auth-modal]");
    if (!modal) return;
    const safeView = view === "signup" ? "signup" : "login";
    modal.dataset.authView = safeView;

    const title = modal.querySelector("[data-auth-title]");
    const titleText = title?.querySelector("[data-auth-title-text]");
    const subtitle = modal.querySelector("[data-auth-subtitle]");
    const loginPanel = modal.querySelector("[data-auth-view-panel=\"login\"]");
    const signupPanel = modal.querySelector("[data-auth-view-panel=\"signup\"]");

    if (loginPanel) loginPanel.hidden = safeView !== "login";
    if (signupPanel) signupPanel.hidden = safeView !== "signup";
    if (titleText) {
      titleText.textContent =
        safeView === "login" ? "Log in to StreamSuites™" : "Sign up to StreamSuites™";
    } else if (title) {
      title.textContent = safeView === "login" ? "Log in to StreamSuites™" : "Sign up to StreamSuites™";
    }
    if (subtitle) {
      subtitle.textContent =
        safeView === "login"
          ? "Authenticate with OAuth or email/password."
          : "Create your creator account with OAuth or email/password.";
    }
  }

  function wireAuthToggle() {
    const modal = document.querySelector("[data-auth-modal]");
    if (!modal) return;

    const initialView = modal.dataset.authView || "login";
    setAuthView(initialView);

    modal.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const toggle = target.closest("[data-auth-switch]");
      if (!toggle) return;
      event.preventDefault();
      setAuthView(toggle.getAttribute("data-auth-switch"));
    });
  }

  function wirePasswordForms() {
    const loginForm = document.querySelector("[data-auth-login-form]");
    const signupForm = document.querySelector("[data-auth-signup-form]");

    const loginContext = resolveLoginContext();
    const initialHint = loginContext.message || window.StreamSuitesAuth?.loginHint || "";

    function getResendContainer(form) {
      return form?.querySelector("[data-auth-login-resend], [data-auth-signup-resend]") || null;
    }

    function setResendState(form, options = {}) {
      const { visible = false, message = "", disabled = false } = options;
      const container = getResendContainer(form);
      if (!container) return;
      container.hidden = !visible;
      const status = container.querySelector("[data-auth-resend-status]");
      if (status) {
        status.textContent = message;
      }
      const button = container.querySelector("[data-auth-resend-button]");
      if (button instanceof HTMLButtonElement) {
        button.disabled = !!disabled;
      }
    }

    function setResendEmail(form, email) {
      if (!form) return;
      form.dataset.resendEmail = email || "";
    }

    function getResendEmail(form) {
      if (!form) return "";
      const stored = form.dataset.resendEmail || "";
      const emailInput = form.querySelector("[data-auth-login-email], [data-auth-signup-email]");
      const value =
        stored ||
        (emailInput instanceof HTMLInputElement ? emailInput.value : "");
      return value.trim();
    }

    function wireResendButton(form) {
      const container = getResendContainer(form);
      if (!container || container.dataset.resendWired === "true") return;
      container.dataset.resendWired = "true";
      const button = container.querySelector("[data-auth-resend-button]");
      if (!(button instanceof HTMLButtonElement)) return;
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        const email = getResendEmail(form);
        if (!isValidEmail(email)) {
          setResendState(form, {
            visible: true,
            message: "Enter a valid email to resend the verification link."
          });
          return;
        }
        setResendState(form, { visible: true, message: "Sending verification email...", disabled: true });
        try {
          const result = await requestVerificationResend(email);
          const payload = result.payload || {};
          if (result.ok && payload?.status === "already_verified") {
            setResendState(form, {
              visible: true,
              message: "Email already verified. Log in to continue.",
              disabled: false
            });
            return;
          }
          if (result.ok) {
            setResendState(form, {
              visible: true,
              message: payload?.message || "Verification email sent.",
              disabled: false
            });
            return;
          }
          if (result.status === 429 || payload?.status === "rate_limited") {
            setResendState(form, {
              visible: true,
              message: "Too many resend requests. Please wait and try again.",
              disabled: false
            });
            return;
          }
          setResendState(form, {
            visible: true,
            message: payload?.error || "Unable to resend verification email.",
            disabled: false
          });
        } catch (err) {
          setResendState(form, {
            visible: true,
            message: "Unable to resend verification email.",
            disabled: false
          });
        }
      });
    }

    function setFormState(form, options = {}) {
      if (!form) return;
      const { state = "idle", message = "", errorMessage = "" } = options;
      const status = form.querySelector("[data-auth-login-status], [data-auth-signup-status]");
      const error = form.querySelector("[data-auth-login-error], [data-auth-signup-error]");
      const hint = form.querySelector("[data-auth-login-hint], [data-auth-signup-hint]");
      const inputs = form.querySelectorAll("input, button");

      if (status) status.textContent = message;
      if (hint) {
        hint.hidden = !(state === "hint" && message);
        if (state === "hint") hint.textContent = message;
      }
      if (error) {
        error.hidden = state !== "error";
        if (state === "error") {
          error.textContent = errorMessage || message || "Unable to authenticate.";
        }
      }

      const isLoading = state === "loading";
      inputs.forEach((input) => {
        input.disabled = isLoading;
      });
    }

    if (loginForm) {
      const loginHint = loginForm.querySelector("[data-auth-login-hint]");
      if (loginHint && initialHint) {
        loginHint.textContent = initialHint;
        loginHint.hidden = false;
      }
      if (loginContext.showResend) {
        setResendState(loginForm, { visible: true, message: initialHint });
      }
      wireResendButton(loginForm);

      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const emailInput = loginForm.querySelector("[data-auth-login-email]");
        const passwordInput = loginForm.querySelector("[data-auth-login-password]");
        if (!(emailInput instanceof HTMLInputElement)) return;
        if (!(passwordInput instanceof HTMLInputElement)) return;

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!isValidEmail(email)) {
          setFormState(loginForm, { state: "error", errorMessage: "Enter a valid email address." });
          return;
        }
        if (!password) {
          setFormState(loginForm, { state: "error", errorMessage: "Enter your password to log in." });
          return;
        }

        setFormState(loginForm, { state: "loading", message: "Signing in…" });

        try {
          const payload = await requestPasswordLogin({ email, password });
          await routeAfterAuth(payload);
        } catch (err) {
          const message =
            typeof err?.payload?.message === "string"
              ? err.payload.message
              : typeof err?.payload?.error === "string"
                ? err.payload.error
                : "Unable to sign in. Check your credentials and try again.";
          setFormState(loginForm, { state: "error", errorMessage: message });
          const verificationRequired =
            err?.payload?.verification_required === true ||
            /not verified/i.test(message);
          if (verificationRequired) {
            setResendEmail(loginForm, email);
            setResendState(loginForm, { visible: true, message: "Need a new link? Resend below." });
          } else {
            setResendState(loginForm, { visible: false });
          }
        }
      });
    }

    if (signupForm) {
      const signupHint = signupForm.querySelector("[data-auth-signup-hint]");
      if (signupHint) {
        signupHint.textContent = "Accounts are created at runtime when eligible.";
        signupHint.hidden = false;
      }

      const passwordInput = signupForm.querySelector("[data-auth-signup-password]");
      const strengthEl = signupForm.querySelector("[data-auth-signup-strength]");
      if (passwordInput instanceof HTMLInputElement && strengthEl) {
        const updateStrength = () => {
          const strength = evaluatePasswordStrength(passwordInput.value);
          strengthEl.textContent = `Strength: ${strength.label}`;
        };
        passwordInput.addEventListener("input", updateStrength);
        updateStrength();
      }

      signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const emailInput = signupForm.querySelector("[data-auth-signup-email]");
        const confirmInput = signupForm.querySelector("[data-auth-signup-confirm]");
        if (!(emailInput instanceof HTMLInputElement)) return;
        if (!(passwordInput instanceof HTMLInputElement)) return;
        if (!(confirmInput instanceof HTMLInputElement)) return;

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;

        if (!isValidEmail(email)) {
          setFormState(signupForm, { state: "error", errorMessage: "Enter a valid email address." });
          return;
        }
        if (password.length < PASSWORD_MIN_LENGTH || !hasSpecialCharacter(password)) {
          setFormState(signupForm, {
            state: "error",
            errorMessage: "Passwords must be at least 8 characters and include a special character."
          });
          return;
        }
        if (password !== confirmPassword) {
          setFormState(signupForm, { state: "error", errorMessage: "Passwords do not match." });
          return;
        }

        setFormState(signupForm, { state: "loading", message: "Creating account…" });

        try {
          const payload = await requestSignup({ email, password });
          if (payload?.authenticated) {
            await routeAfterAuth(payload);
            return;
          }
          if (strengthEl) {
            strengthEl.textContent = "Strength: " + evaluatePasswordStrength(password).label;
          }
          setFormState(signupForm, {
            state: "hint",
            message: "Check your email to verify your account before logging in."
          });
          setResendEmail(signupForm, email);
          setResendState(signupForm, {
            visible: true,
            message: "Need another verification email? Resend below."
          });
        } catch (err) {
          const message =
            typeof err?.payload?.message === "string"
              ? err.payload.message
              : typeof err?.payload?.error === "string"
                ? err.payload.error
              : err?.status === 409
                ? "An account already exists for this email. Log in instead."
                : "Unable to create account. Try again or use OAuth.";
          setFormState(signupForm, { state: "error", errorMessage: message });
          setResendState(signupForm, { visible: false });
        }
      });
      wireResendButton(signupForm);
    }
  }

  function wireOauthButtons() {
    const buttons = document.querySelectorAll("[data-auth-oauth]");
    buttons.forEach((button) => {
      const provider = button.getAttribute("data-auth-oauth");
      if (!provider) return;
      const normalizedProvider = normalizeProvider(provider);
      const url = AUTH_ENDPOINTS.oauth[provider];
      if (!url) return;
      if (button instanceof HTMLAnchorElement) {
        button.href = url;
        button.addEventListener("click", () => {
          persistLastOauthProvider(normalizedProvider);
        });
        return;
      }
      button.addEventListener("click", (event) => {
        event.preventDefault();
        persistLastOauthProvider(normalizedProvider);
        window.location.assign(url);
      });
    });
  }

  function wireManualAuthSections() {
    const toggles = document.querySelectorAll("[data-auth-manual-toggle]");
    toggles.forEach((toggle) => {
      if (!(toggle instanceof HTMLButtonElement)) return;
      const targetId = toggle.dataset.authManualTarget || toggle.getAttribute("aria-controls") || "";
      if (!targetId) return;
      const panel = document.getElementById(targetId);
      if (!panel) return;

      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");

      if (toggle.dataset.manualWired === "true") return;
      toggle.dataset.manualWired = "true";

      toggle.addEventListener("click", () => {
        const shouldOpen = panel.hidden;
        panel.hidden = !shouldOpen;
        toggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      });
    });
  }

  function buildCreatorLockout(variant = LOCKOUT_VARIANT_SESSION_INVALID) {
    const lockout = document.createElement("section");
    lockout.className = "creator-lockout";
    lockout.dataset.creatorLockout = "true";
    lockout.dataset.variant = variant;

    if (variant === LOCKOUT_VARIANT_ROLE_MISMATCH) {
      lockout.innerHTML = `
        <div class="lockout-card">
          <span class="lockout-pill">Creator access required</span>
          <h2>This area requires creator access.</h2>
          <p>
            Your StreamSuites account is authenticated, but creator access is not enabled.
          </p>
          <div class="lockout-actions">
            <a
              class="lockout-button"
              href="https://api.streamsuites.app/auth/login/google?surface=creator"
            >
              Login as Creator
            </a>
            <button class="lockout-button secondary" type="button" data-auth-logout="true">
              Sign out
            </button>
          </div>
        </div>
      `;
      return lockout;
    }

    lockout.innerHTML = `
        <div class="lockout-card">
          <span class="lockout-pill">Not logged in</span>
          <h2>Sign in to continue.</h2>
          <p>
            Your creator session is not active.
          </p>
          <div class="lockout-actions">
            <a
              class="lockout-button"
              href="${CREATOR_RETRY_LOGIN_URL}"
            >
              Retry login
            </a>
          </div>
        </div>
      `;

    return lockout;
  }

  function toggleCreatorLockout(show, options = {}) {
    const variant =
      options.variant === LOCKOUT_VARIANT_ROLE_MISMATCH
        ? LOCKOUT_VARIANT_ROLE_MISMATCH
        : LOCKOUT_VARIANT_SESSION_INVALID;
    let lockout = document.querySelector("[data-creator-lockout]");
    const content = document.querySelector("[data-creator-content]");
    if (!lockout && show) {
      lockout = buildCreatorLockout(variant);
      document.body.prepend(lockout);
    }
    if (!lockout) return false;
    if (show && lockout.dataset.variant !== variant) {
      const replacement = buildCreatorLockout(variant);
      lockout.replaceWith(replacement);
      lockout = replacement;
    }

    if (show) {
      lockout.hidden = false;
      if (content) {
        content.hidden = true;
      } else {
        Array.from(document.body.children).forEach((child) => {
          if (child === lockout) return;
          if (child.hasAttribute("data-lockout-hidden")) return;
          child.setAttribute("data-lockout-hidden", "true");
          child.hidden = true;
        });
      }
      document.body.classList.add("creator-lockout-active");
    } else {
      lockout.hidden = true;
      if (content) {
        content.hidden = false;
      } else {
        document
          .querySelectorAll("[data-lockout-hidden=\"true\"]")
          .forEach((child) => {
            child.hidden = false;
            child.removeAttribute("data-lockout-hidden");
          });
      }
      document.body.classList.remove("creator-lockout-active");
    }
    return true;
  }

  function getLoginReason() {
    const params = new URLSearchParams(window.location.search);
    return params.get("reason");
  }

  function shouldSkipSessionFetch(isPublic) {
    if (!isPublic) return false;
    const reason = getLoginReason();
    if (reason === LOGOUT_REASON) return true;
    try {
      return sessionStorage.getItem(LOGOUT_GUARD_KEY) === "true";
    } catch (err) {
      return false;
    }
  }

  function clearRedirectGuards() {
    try {
      sessionStorage.removeItem(REDIRECT_GUARD_KEY);
      sessionStorage.removeItem(LOGOUT_GUARD_KEY);
    } catch (err) {
      console.warn("[Dashboard][Auth] Failed to clear guard flags", err);
    }
  }

  function redirectToLoginReplace() {
    window.location.replace("/auth/login.html");
  }

  function redirectToLogin(reason = "expired") {
    if (getPathname().startsWith("/auth/")) return;
    try {
      if (sessionStorage.getItem(REDIRECT_GUARD_KEY) === "true") return;
      sessionStorage.setItem(REDIRECT_GUARD_KEY, "true");
    } catch (err) {
      console.warn("[Dashboard][Auth] Failed to set redirect guard", err);
    }
    const suffix = reason ? `?reason=${encodeURIComponent(reason)}` : "";
    window.location.assign(`${CREATOR_LOGIN_PAGE}${suffix}`);
  }

  function buildAuthToast() {
    const toast = document.createElement("div");
    toast.className = "ss-alert ss-auth-toast";
    toast.dataset.authToast = "true";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.hidden = true;
    return toast;
  }

  function getAuthToast() {
    let toast = document.querySelector("[data-auth-toast]");
    if (!toast) {
      toast = buildAuthToast();
      document.body.appendChild(toast);
    }
    return toast;
  }

  function showAuthToast(message, options = {}) {
    if (!message) return;
    const { tone = "warning", autoHideMs = 4200 } = options;
    const toast = getAuthToast();
    toast.textContent = message;
    toast.classList.toggle("ss-alert-danger", tone === "danger");
    toast.hidden = false;

    if (toast._hideTimer) {
      clearTimeout(toast._hideTimer);
    }
    if (autoHideMs > 0) {
      toast._hideTimer = setTimeout(() => {
        toast.hidden = true;
      }, autoHideMs);
    }
  }

  function removeXEmailBanner() {
    const banner = document.querySelector("[data-auth-x-email-banner]");
    if (!banner) return;
    banner.remove();
  }

  function buildXEmailBanner() {
    const banner = document.createElement("div");
    banner.className = "ss-alert ss-email-completion-banner";
    banner.dataset.authXEmailBanner = "true";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");

    const message = document.createElement("span");
    message.textContent =
      "Your X account is connected without an email. You can add one later from account settings.";

    const actions = document.createElement("div");
    actions.className = "ss-email-completion-banner-actions";

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "ss-email-completion-banner-dismiss";
    dismiss.textContent = "Dismiss";
    dismiss.addEventListener("click", () => {
      writeLocalStorageValue(X_EMAIL_BANNER_DISMISSED_KEY, "1");
      banner.hidden = true;
    });

    actions.appendChild(dismiss);
    banner.append(message, actions);
    return banner;
  }

  function ensureXEmailBanner() {
    let banner = document.querySelector("[data-auth-x-email-banner]");
    if (!banner) {
      banner = buildXEmailBanner();
      document.body.prepend(banner);
    }
    return banner;
  }

  function shouldShowXEmailBanner(session, isPublic) {
    if (isPublic) return false;
    if (!session || session.authenticated !== true) return false;
    if (normalizeRole(session.role) !== CREATOR_ROLE) return false;
    const provider = normalizeProvider(session.provider || getLastOauthProvider());
    if (provider !== "x") return false;
    if (!isEmailMissing(session.email)) return false;
    return readLocalStorageValue(X_EMAIL_BANNER_DISMISSED_KEY) !== "1";
  }

  function updateXEmailBanner(session, isPublic) {
    if (!shouldShowXEmailBanner(session, isPublic)) {
      removeXEmailBanner();
      return;
    }
    const banner = ensureXEmailBanner();
    banner.hidden = false;
  }

  function setCreatorShellVisible(visible) {
    const content = document.querySelector("[data-creator-content]");
    const footer = document.querySelector(".creator-footer");
    if (content) content.hidden = !visible;
    if (footer) footer.hidden = !visible;
  }

  function showAuthModalAndHaltAppInit(session) {
    setCreatorShellVisible(false);
    const pathname = getPathname();
    if (pathname === "/auth/login.html") {
      toggleCreatorLockout(false);
      forceLoginModal();
      return true;
    }
    toggleCreatorLockout(true, { variant: LOCKOUT_VARIANT_SESSION_INVALID });
    return true;
  }

  function forceLoginModal() {
    const modal = document.querySelector("[data-auth-modal]");
    if (!modal) return false;
    modal.hidden = false;
    setAuthView("login");
    return true;
  }

  function handleSessionInvalidation(reason = "expired", reasonEnum = "") {
    const normalizedReasonEnum =
      typeof reasonEnum === "string" ? reasonEnum.trim().toUpperCase() : "";
    if (normalizedReasonEnum === "COOKIE_MISSING" || normalizeAuthReason(reason) === SESSION_IDLE_REASON) {
      redirectToLoginReplace();
      return;
    }

    stopSessionMonitor();
    clearLocalSessionState();
    showAuthToast("Session expired. Sign in again to continue.", {
      tone: "danger",
      autoHideMs: SESSION_INVALID_REDIRECT_DELAY_MS
    });
    showAuthModalAndHaltAppInit({
      authenticated: false,
      errorStatus: 401,
      errorReason: reason,
      errorReasonEnum: reasonEnum || "SESSION_UNKNOWN"
    });
  }

  function applySessionUpdate(nextSession) {
    if (!nextSession) return;
    if (areSessionsEquivalent(sessionState.value, nextSession)) return;
    sessionState.value = nextSession;
    updateAppSession(nextSession);
    updateAuthSummary(nextSession);
    updateXEmailBanner(nextSession, isPublicPath(getPathname()));
  }

  async function performSilentSessionCheck(options = {}) {
    const { isPublic = false } = options;
    if (isPublic) return;
    if (sessionMonitor.checking) return;
    if (sessionRetry.idle) return;
    if (!sessionState.value || sessionState.value.authenticated !== true) return;

    sessionMonitor.checking = true;
    try {
      const { payload, reasonEnum } = await fetchSessionJson(5000);
      const nextSession = {
        ...normalizeSessionPayload(payload),
        reasonEnum: reasonEnum || resolveAuthReasonEnum(payload, null)
      };
      sessionMonitor.consecutiveFailures = 0;
      sessionRetry.idle = false;
      sessionRetry.idleReason = "";
      sessionRetry.notified = false;

      if (!nextSession?.authenticated) {
        handleSessionInvalidation("expired", nextSession?.reasonEnum || "");
        return;
      }

      applySessionUpdate(nextSession);

      if (nextSession?.authenticated) {
        const role = normalizeRole(nextSession.role);
        if (role && role !== CREATOR_ROLE) {
          toggleCreatorLockout(true, { variant: LOCKOUT_VARIANT_ROLE_MISMATCH });
          return;
        }
        if (!isPublic) {
          toggleCreatorLockout(false);
          setCreatorShellVisible(true);
        }
      }
    } catch (err) {
      if (isCookieMissingError(err)) {
        sessionRetry.idle = true;
        sessionRetry.idleReason = SESSION_IDLE_REASON;
        sessionRetry.lastAttemptAt = Date.now();
        handleSessionInvalidation("expired", err?.reasonEnum || "COOKIE_MISSING");
        return;
      }
      const status = err?.status ?? null;
      if (status === 401 || status === 403) {
        handleSessionInvalidation("expired", err?.reasonEnum || "");
        return;
      }

      sessionMonitor.consecutiveFailures += 1;
      if (sessionMonitor.consecutiveFailures >= SESSION_POLL_FAILURE_THRESHOLD) {
        const now = Date.now();
        if (now - sessionMonitor.lastFailureNoticeAt >= SESSION_POLL_FAILURE_COOLDOWN_MS) {
          sessionMonitor.lastFailureNoticeAt = now;
          showAuthToast("Auth service is unreachable. Retrying in the background…");
        }
      }
    } finally {
      sessionMonitor.checking = false;
    }
  }

  function startSessionMonitor(options = {}) {
    if (sessionMonitor.timer) return;
    sessionMonitor.timer = setInterval(() => {
      performSilentSessionCheck(options);
    }, SESSION_POLL_INTERVAL_MS);
  }

  function stopSessionMonitor() {
    if (!sessionMonitor.timer) return;
    clearInterval(sessionMonitor.timer);
    sessionMonitor.timer = null;
  }

  async function initAuth() {
    const pathname = getPathname();
    const isPublic = isPublicPath(pathname);
    const isOnboarding = pathname === "/views/onboarding.html";

    ensureAuthSummaryMounts();
    wireLogoutButtons();
    wireAccountMenus();
    wireOauthButtons();
    wireAuthToggle();
    wireManualAuthSections();
    wirePasswordForms();

    if (shouldSkipSessionFetch(isPublic)) {
      sessionState.value = { authenticated: false };
      updateAppSession(sessionState.value);
      updateAuthSummary(sessionState.value);
      updateXEmailBanner(sessionState.value, isPublic);
      showAuthModalAndHaltAppInit(sessionState.value);
      return;
    }

    if (!isPublic) {
      setCreatorShellVisible(false);
    }

    const session = await loadSession();
    if (!isPublic && isCookieMissingSessionState(session)) {
      redirectToLoginReplace();
      return;
    }

    updateAppSession(session);
    updateAuthSummary(session);
    updateXEmailBanner(session, isPublic);

    if (!session || session.authenticated !== true) {
      if (
        isPublic &&
        session?.error &&
        session?.errorStatus !== 401 &&
        !new URLSearchParams(window.location.search).get("reason")
      ) {
        window.StreamSuitesAuth.loginHint = "Auth service is unreachable. Please try again.";
      }
      showAuthModalAndHaltAppInit(session);
      return;
    }

    if (session?.authenticated) {
      clearRedirectGuards();
    }

    if (session?.authenticated) {
      const role = normalizeRole(session.role);
      if (role !== CREATOR_ROLE) {
        toggleCreatorLockout(true, { variant: LOCKOUT_VARIANT_ROLE_MISMATCH });
        return;
      }
    }

    if (session?.authenticated && !isPublic) {
      toggleCreatorLockout(false);
      setCreatorShellVisible(true);
      startSessionMonitor({ isPublic });
    }

    if (session?.authenticated) {
      if (session?.onboardingRequired && !isOnboarding) {
        window.location.assign(CREATOR_ONBOARDING_PAGE);
        return;
      }
      if (!session?.onboardingRequired && isOnboarding) {
        window.location.assign(`${CREATOR_ORIGIN}/index.html`);
        return;
      }
      if (isPublic) {
        await routeAfterAuth(session);
        return;
      }
    }

    if (
      isPublic &&
      session?.error &&
      session?.errorStatus !== 401 &&
      !new URLSearchParams(window.location.search).get("reason")
    ) {
      window.StreamSuitesAuth.loginHint = "Auth service is unreachable. Please try again.";
    }
  }

  window.StreamSuitesTier = {
    normalizeTier,
    renderTierPill
  };

  window.StreamSuitesAuth = {
    endpoints: AUTH_ENDPOINTS,
    loadSession,
    logout,
    routeAfterAuth,
    persistLocalSession,
    storageKeys: {
      session: LOCAL_SESSION_KEY,
      sessionUpdatedAt: LOCAL_SESSION_UPDATED_AT_KEY
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    initAuth();
  });
})();
