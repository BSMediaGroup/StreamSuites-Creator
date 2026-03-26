(() => {
  "use strict";

  const API_BASE_URL = "https://api.streamsuites.app";
  const AUTH_BASE_URL = "";
  const CREATOR_ORIGIN = "https://creator.streamsuites.app";
  const AUTH_ENDPOINTS = Object.freeze({
    accessState: `${AUTH_BASE_URL}/auth/access-state`,
    debugUnlock: `${AUTH_BASE_URL}/auth/debug/unlock`,
    session: `${AUTH_BASE_URL}/auth/session`,
    logout: `${AUTH_BASE_URL}/auth/logout`,
    emailLogin: `${AUTH_BASE_URL}/auth/login/password`,
    resendVerify: `${AUTH_BASE_URL}/auth/verify/resend`,
    signup: `${AUTH_BASE_URL}/auth/signup/email`,
    oauth: Object.freeze({
      google: `${AUTH_BASE_URL}/auth/login/google?surface=creator`,
      github: `${AUTH_BASE_URL}/auth/login/github?surface=creator`,
      discord: `${AUTH_BASE_URL}/auth/login/discord?surface=creator`,
      x: `${AUTH_BASE_URL}/auth/x/start?surface=creator`,
      twitch: `${AUTH_BASE_URL}/oauth/twitch/start?surface=creator`
    })
  });
  const ACCOUNT_ENDPOINTS = Object.freeze({
    me: `${API_BASE_URL}/account/me`
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
  const BADGE_ICON_SOURCES = new Map([
    ["admin", "/assets/icons/tierbadge-admin.svg"],
    ["core", "/assets/icons/tierbadge-core.svg"],
    ["gold", "/assets/icons/tierbadge-gold.svg"],
    ["pro", "/assets/icons/tierbadge-pro.svg"],
    ["founder", "/assets/icons/founder-gold.svg"],
    ["moderator", "/assets/icons/modgavel-blue.svg"],
    ["developer", "/assets/icons/dev-green.svg"]
  ]);
  const TIER_ID_OPTIONS = new Set(["core", "gold", "pro"]);
  const PUBLIC_PATHS = new Set([
    "/login",
    "/login/",
    "/login.html",
    "/login-success",
    "/login-success/",
    "/login-success.html"
  ]);
  const ACCOUNT_AUTH_PROVIDER_ALIASES = Object.freeze({
    email: Object.freeze(["email", "password", "credentials", "local"]),
    discord: Object.freeze(["discord"]),
    google: Object.freeze(["google"]),
    github: Object.freeze(["github"]),
    x: Object.freeze(["x", "twitter"])
  });

  const CREATOR_LOGIN_PAGE = `${CREATOR_ORIGIN}/login/`;
  const CREATOR_LOGIN_SUCCESS_PAGE = `${CREATOR_ORIGIN}/login-success/`;
  const CREATOR_ONBOARDING_PAGE = `${CREATOR_ORIGIN}/views/onboarding.html`;
  const LOGOUT_REASON = "logout";
  const REDIRECT_GUARD_KEY = "streamsuites.creator.loginRedirected";
  const LOGOUT_GUARD_KEY = "streamsuites.creator.loggedOut";
  const POST_AUTH_SETTLE_KEY = "streamsuites.creator.postAuthSettle";
  const POST_AUTH_SETTLE_TTL_MS = 15000;
  const POST_AUTH_SETTLE_RETRY_DELAYS_MS = Object.freeze([180, 360, 720, 1280]);
  const LOCAL_SESSION_KEY = "streamsuites.creator.session";
  const LOCAL_SESSION_UPDATED_AT_KEY = "streamsuites.creator.session.updatedAt";
  const AUTH_ACCESS_UNLOCK_STATE_KEY = "streamsuites.creator.authAccessGate";
  const AUTH_ACCESS_CACHE_MS = 30000;
  const AUTH_ACCESS_FALLBACK_MESSAGES = Object.freeze({
    normal: "Authentication is operating normally.",
    maintenance: "Authentication is temporarily unavailable while maintenance is in progress.",
    development: "Authentication is temporarily limited while development access mode is active."
  });
  const PUBLIC_SESSION_HINT_TTL_MS = 12 * 60 * 60 * 1000;
  const LAST_OAUTH_PROVIDER_KEY = "streamsuites.creator.lastOauthProvider";
  const X_EMAIL_BANNER_DISMISSED_KEY = "streamsuites.creator.banner.xMissingEmail.dismissed";
  const CREATOR_DEBUG_MODE_KEY = "ss_creator_debug_mode";
  const CREATOR_DEBUG_MODE_EVENT = "streamsuites:creator-debug-mode";
  const CREATOR_DEBUG_MODE_STORAGE_KEYS = Object.freeze([CREATOR_DEBUG_MODE_KEY]);
  const ADMIN_ROLE_ALIASES = new Set([
    "admin",
    "administrator",
    "super_admin",
    "superadmin",
    "owner"
  ]);
  const CREATOR_RETRY_LOGIN_URL = "/login/";
  const LOCKOUT_VARIANT_SESSION_INVALID = "session_invalid";
  const LOCKOUT_VARIANT_ROLE_MISMATCH = "role_mismatch";
  const SESSION_POLL_INTERVAL_MS = 20000;
  const SESSION_POLL_FAILURE_THRESHOLD = 3;
  const SESSION_POLL_FAILURE_COOLDOWN_MS = 60000;
  const SESSION_INVALID_REDIRECT_DELAY_MS = 1400;
  const SESSION_IDLE_REASON = "cookie_missing";
  const SESSION_RETRY_MIN_INTERVAL_MS = 7000;
  const AUTH_BOOT_STATES = Object.freeze({
    bootstrapping: "bootstrapping",
    authenticated: "authenticated",
    unauthenticated: "unauthenticated",
    degraded: "auth-available-but-hydration-failed"
  });
  const AUTH_STATE_EVENT = "streamsuites:auth-state-changed";

  const sessionState = {
    value: null,
    loading: false
  };
  const authBootstrap = {
    status: AUTH_BOOT_STATES.bootstrapping,
    protectedDataStatus: "idle",
    protectedDataSource: "",
    message: "",
    sessionChecked: false,
    readyPromise: null,
    resolveReady: null
  };
  authBootstrap.readyPromise = new Promise((resolve) => {
    authBootstrap.resolveReady = resolve;
  });
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
  const authAccess = {
    state: null,
    loadedAt: 0,
    refreshPromise: null,
    formOpen: false
  };
  let accountMenuWired = false;
  let isAccountMenuOpen = false;
  let activeAccountMenu = null;
  let creatorDebugWired = false;

  function ensureAppNamespace() {
    if (!window.App) {
      window.App = {};
    }
  }

  function resolveAuthorityApiUrl(path = "/") {
    const normalizedPath = typeof path === "string" && path.trim() ? path.trim() : "/";
    return new URL(normalizedPath, `${API_BASE_URL}/`).toString();
  }

  function getAuthBootstrapState() {
    return {
      status: authBootstrap.status,
      protectedDataStatus: authBootstrap.protectedDataStatus,
      protectedDataSource: authBootstrap.protectedDataSource,
      message: authBootstrap.message,
      sessionChecked: authBootstrap.sessionChecked
    };
  }

  function syncAuthBootstrapState() {
    ensureAppNamespace();
    window.App.authBootstrap = getAuthBootstrapState();
  }

  function setAuthBootstrapState(status, details = {}) {
    const nextStatus = AUTH_BOOT_STATES[status] || status || AUTH_BOOT_STATES.bootstrapping;
    authBootstrap.status = nextStatus;
    authBootstrap.protectedDataStatus =
      typeof details.protectedDataStatus === "string"
        ? details.protectedDataStatus
        : authBootstrap.protectedDataStatus;
    authBootstrap.protectedDataSource =
      typeof details.protectedDataSource === "string"
        ? details.protectedDataSource
        : authBootstrap.protectedDataSource;
    authBootstrap.message =
      typeof details.message === "string" ? details.message : authBootstrap.message;
    if (details.sessionChecked === true || details.sessionChecked === false) {
      authBootstrap.sessionChecked = details.sessionChecked;
    }
    syncAuthBootstrapState();
    document.documentElement.dataset.creatorAuthBootstrap = nextStatus;
    window.dispatchEvent(
      new CustomEvent(AUTH_STATE_EVENT, {
        detail: getAuthBootstrapState()
      })
    );
    if (
      authBootstrap.resolveReady &&
      nextStatus !== AUTH_BOOT_STATES.bootstrapping
    ) {
      authBootstrap.resolveReady(getAuthBootstrapState());
      authBootstrap.resolveReady = null;
    }
    if (nextStatus !== AUTH_BOOT_STATES.bootstrapping) {
      console.info(
        `[Creator][Auth] bootstrap=${nextStatus} protected=${authBootstrap.protectedDataStatus || "idle"}`
      );
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
    return false;
  }

  function isCreatorAuthPath(pathname) {
    return PUBLIC_PATHS.has(pathname);
  }

  function parseCreatorUrl(value, base = CREATOR_ORIGIN) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      return new URL(value, base);
    } catch (err) {
      return null;
    }
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function normalizeCreatorReturnTarget(value, fallback = `${CREATOR_ORIGIN}/`) {
    const parsed = parseCreatorUrl(value);
    if (!parsed || parsed.origin !== CREATOR_ORIGIN) {
      return fallback;
    }
    if (isCreatorAuthPath(parsed.pathname || "/")) {
      return fallback;
    }
    return `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  function getRequestedReturnTarget() {
    const params = new URLSearchParams(window.location.search);
    for (const key of ["return_to", "redirect_to", "next"]) {
      const raw = params.get(key);
      if (raw) {
        return normalizeCreatorReturnTarget(raw, "");
      }
    }
    return "";
  }

  function getCurrentReturnTarget() {
    return normalizeCreatorReturnTarget(window.location.href, `${CREATOR_ORIGIN}/`);
  }

  function buildCreatorLoginPageUrl({ reason = "", returnTo = "" } = {}) {
    const url = new URL(CREATOR_LOGIN_PAGE);
    const safeReturnTo = normalizeCreatorReturnTarget(
      returnTo || getRequestedReturnTarget() || getCurrentReturnTarget(),
      ""
    );
    if (safeReturnTo) {
      url.searchParams.set("return_to", safeReturnTo);
    }
    if (reason) {
      url.searchParams.set("reason", reason);
    }
    return url.toString();
  }

  function buildCreatorLoginSuccessUrl(returnTo = "") {
    const url = new URL(CREATOR_LOGIN_SUCCESS_PAGE);
    const safeReturnTo = normalizeCreatorReturnTarget(
      returnTo || getRequestedReturnTarget() || `${CREATOR_ORIGIN}/`,
      ""
    );
    if (safeReturnTo) {
      url.searchParams.set("return_to", safeReturnTo);
    }
    return url.toString();
  }

  function readSessionStorageJson(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function writeSessionStorageJson(key, payload) {
    try {
      sessionStorage.setItem(key, JSON.stringify(payload));
    } catch (err) {
      console.warn("[Creator][Auth] Failed to persist session state", err);
    }
  }

  function clearAuthAccessUnlockState() {
    try {
      sessionStorage.removeItem(AUTH_ACCESS_UNLOCK_STATE_KEY);
    } catch (err) {
      console.warn("[Creator][Auth] Failed to clear auth access unlock state", err);
    }
  }

  function readAuthAccessUnlockState() {
    const payload = readSessionStorageJson(AUTH_ACCESS_UNLOCK_STATE_KEY);
    if (!payload) return { active: false, expiresAt: "" };

    const expiresAt = typeof payload.expiresAt === "string" ? payload.expiresAt.trim() : "";
    const expiresAtMs = Date.parse(expiresAt);
    if (!expiresAt || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      clearAuthAccessUnlockState();
      return { active: false, expiresAt: "" };
    }

    return { active: true, expiresAt };
  }

  function persistAuthAccessUnlockState(expiresAt) {
    if (typeof expiresAt !== "string" || !expiresAt.trim()) return;
    writeSessionStorageJson(AUTH_ACCESS_UNLOCK_STATE_KEY, {
      unlocked: true,
      expiresAt: expiresAt.trim()
    });
  }

  function fallbackAuthAccessMessage(mode) {
    return AUTH_ACCESS_FALLBACK_MESSAGES[mode] || AUTH_ACCESS_FALLBACK_MESSAGES.normal;
  }

  function normalizeAuthAccessState(payload, available = true) {
    const rawMode = typeof payload?.mode === "string" ? payload.mode.trim().toLowerCase() : "";
    const mode = rawMode === "maintenance" || rawMode === "development" ? rawMode : "normal";
    const gateActive = mode !== "normal";
    const bypassEnabled = gateActive && payload?.bypass_enabled === true;
    const unlockState = bypassEnabled ? readAuthAccessUnlockState() : { active: false, expiresAt: "" };
    if (!gateActive || !bypassEnabled) {
      clearAuthAccessUnlockState();
    }
    return {
      available,
      mode,
      gateActive,
      message:
        typeof payload?.message === "string" && payload.message.trim()
          ? payload.message.trim()
          : fallbackAuthAccessMessage(mode),
      bypassEnabled,
      bypassUnlocked: bypassEnabled && unlockState.active,
      unlockExpiresAt: unlockState.expiresAt
    };
  }

  authAccess.state = normalizeAuthAccessState(null, false);

  function clearPostAuthSettleState() {
    try {
      sessionStorage.removeItem(POST_AUTH_SETTLE_KEY);
    } catch (err) {
      console.warn("[Creator][Auth] Failed to clear post-auth settle state", err);
    }
  }

  function readPostAuthSettleState() {
    const payload = readSessionStorageJson(POST_AUTH_SETTLE_KEY);
    if (!payload) return null;

    const createdAt = Number(payload.createdAt || 0);
    const target = normalizeCreatorReturnTarget(payload.target || "", "");
    if (!target || !Number.isFinite(createdAt) || Date.now() - createdAt > POST_AUTH_SETTLE_TTL_MS) {
      clearPostAuthSettleState();
      return null;
    }

    return {
      target,
      source: typeof payload.source === "string" ? payload.source.trim() : "",
      createdAt
    };
  }

  function stagePostAuthSettleState(target, { source = "" } = {}) {
    const normalizedTarget = normalizeCreatorReturnTarget(target, "");
    if (!normalizedTarget) {
      return "";
    }
    writeSessionStorageJson(POST_AUTH_SETTLE_KEY, {
      target: normalizedTarget,
      source: typeof source === "string" ? source.trim() : "",
      createdAt: Date.now()
    });
    return normalizedTarget;
  }

  function logGuardDecision(decision, details = {}) {
    console.info("[Creator][Auth] guard", {
      decision,
      path: getPathname(),
      ...details
    });
  }

  async function settlePostAuthSession(pendingState, initialSession = null) {
    let session = initialSession;
    logGuardDecision("pending", {
      source: pendingState?.source || "",
      continueTo: pendingState?.target || ""
    });

    if (isCookieMissingSessionState(session)) {
      sessionRetry.idle = false;
      sessionRetry.idleReason = "";
      sessionRetry.notified = false;
      sessionRetry.lastAttemptAt = 0;
    }

    for (const delayMs of POST_AUTH_SETTLE_RETRY_DELAYS_MS) {
      if (session?.authenticated || !isCookieMissingSessionState(session)) {
        return session;
      }
      await wait(delayMs);
      session = await loadSession({ force: true });
    }

    return session;
  }

  function logCreatorLoginTarget(provider, endpointUrl) {
    const providerName = normalizeProvider(provider);
    try {
      const endpoint = new URL(endpointUrl, window.location.origin);
      const callbackLanding = endpoint.searchParams.get("return_to") || buildCreatorLoginSuccessUrl();
      let continueTo = `${CREATOR_ORIGIN}/`;
      try {
        const callbackUrl = new URL(callbackLanding, CREATOR_ORIGIN);
        continueTo = normalizeCreatorReturnTarget(
          callbackUrl.searchParams.get("return_to") || "",
          `${CREATOR_ORIGIN}/`
        );
      } catch (err) {
        continueTo = `${CREATOR_ORIGIN}/`;
      }
      console.info("[Creator][Auth] login_target", {
        provider: providerName,
        callbackLanding,
        continueTo
      });
    } catch (err) {
      console.info("[Creator][Auth] login_target", {
        provider: providerName,
        callbackLanding: endpointUrl || "",
        continueTo: `${CREATOR_ORIGIN}/`
      });
    }
  }

  function buildCreatorOauthUrl(provider) {
    const raw = AUTH_ENDPOINTS.oauth[provider];
    const endpoint = parseCreatorUrl(raw, CREATOR_ORIGIN);
    if (!endpoint) return "";
    endpoint.searchParams.set("surface", "creator");
    endpoint.searchParams.set("return_to", buildCreatorLoginSuccessUrl());
    return endpoint.toString();
  }

  function normalizeRole(role) {
    if (typeof role !== "string") return null;
    const trimmed = role.trim().toLowerCase();
    return trimmed || null;
  }

  function isAdminRole(role) {
    const normalized = normalizeRole(role);
    return normalized ? ADMIN_ROLE_ALIASES.has(normalized) : false;
  }

  function isAdminSession(session) {
    return !!session?.authenticated && isAdminRole(session?.role);
  }

  function isCreatorSession(session) {
    if (!session?.authenticated) return false;
    if (session?.creatorCapable === true || session?.creator_capable === true) return true;
    return normalizeRole(session?.role) === CREATOR_ROLE;
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

  function readCreatorDebugModeFlag() {
    return readLocalStorageValue(CREATOR_DEBUG_MODE_KEY) === "1";
  }

  function writeCreatorDebugModeFlag(enabled) {
    writeLocalStorageValue(CREATOR_DEBUG_MODE_KEY, enabled ? "1" : "0");
  }

  function clearCreatorDebugModeFlag() {
    CREATOR_DEBUG_MODE_STORAGE_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        writeLocalStorageValue(key, "0");
      }
    });
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

  function normalizeBadgeKey(value) {
    if (typeof value !== "string") return "";
    const normalized = value.trim().toLowerCase();
    return BADGE_ICON_SOURCES.has(normalized) ? normalized : "";
  }

  function normalizeAuthoritativeBadges(value, tierFallback = "core", roleFallback = "") {
    let normalized = [];
    if (Array.isArray(value) && value.length) {
      normalized = value
        .map((badge) => {
          if (!badge || typeof badge !== "object") return null;
          const key = normalizeBadgeKey(
            String(badge.key || badge.icon_key || badge.iconKey || badge.value || "").trim()
          );
          if (!key) return null;
          return {
            key,
            kind: String(badge.kind || (key === "admin" ? "role" : "entitlement")).trim().toLowerCase(),
            label: String(badge.label || badge.title || key).trim() || key,
            title: String(badge.title || badge.label || key).trim() || key
          };
        })
        .filter(Boolean);
    } else if (isAdminRole(roleFallback)) {
      normalized = [{ key: "admin", kind: "role", label: "Admin", title: "Administrator" }];
    } else {
      const tierKey = normalizeTierId(tierFallback) || "core";
      normalized = [{ key: tierKey, kind: "tier", label: tierKey.toUpperCase(), title: `${tierKey.toUpperCase()} Creator` }];
    }

    const hasAdminBadge = normalized.some((badge) => badge?.key === "admin");
    return normalized.filter((badge) => !(hasAdminBadge && ["core", "gold", "pro"].includes(badge?.key)));
  }

  function badgeIconSource(key) {
    return BADGE_ICON_SOURCES.get(normalizeBadgeKey(key)) || "";
  }

  function renderBadgeStrip(element, badges, tierLabel = "CORE") {
    if (!element) return;
    const normalizedBadges = normalizeAuthoritativeBadges(badges, tierLabel);
    element.classList.add("ss-role-badges");
    const row = document.createElement("span");
    row.className = "tier-pill-content";
    normalizedBadges.forEach((badge) => {
      const iconSrc = badgeIconSource(badge.key);
      if (!iconSrc) return;
      const icon = document.createElement("img");
      icon.className = ["core", "gold", "pro"].includes(badge.key) ? "tier-pill-icon ss-tier-badge" : "tier-pill-icon ss-role-badge";
      icon.src = iconSrc;
      icon.alt = badge.label || badge.key;
      icon.title = badge.title || badge.label || badge.key;
      icon.decoding = "async";
      icon.setAttribute("data-ss-role-badge", badge.key);
      row.appendChild(icon);
    });
    element.replaceChildren(row);
  }

  function renderTierPill(element, tierLabel) {
    if (!element) return;
    const normalized = normalizeTier(tierLabel);
    element.classList.add("tier-pill");
    element.classList.add("ss-role-badges");
    element.classList.remove("tier-core", "tier-gold", "tier-pro");
    element.dataset.tier = normalized;
    element.setAttribute("data-ss-badge-kind", "tier");
    const content = document.createElement("span");
    content.className = "tier-pill-content";

    const iconSrc = TIER_ICON_SOURCES.get(normalized);
    if (iconSrc) {
      const icon = document.createElement("img");
      icon.className = "tier-pill-icon ss-tier-badge";
      icon.src = iconSrc;
      icon.alt = "";
      icon.decoding = "async";
      icon.setAttribute("aria-hidden", "true");
      icon.setAttribute("data-ss-role-badge", normalized.toLowerCase());
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

  function normalizeInteger(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.trunc(parsed);
  }

  function normalizePaymentSummary(raw) {
    if (!raw || typeof raw !== "object") return null;
    return {
      planName: coerceText(raw.plan_name || raw.planName),
      planTier: normalizeTierId(raw.plan_tier || raw.planTier) || coerceText(raw.plan_tier || raw.planTier),
      planStatus: coerceText(raw.plan_status || raw.planStatus).toLowerCase(),
      recurringStatus: coerceText(raw.recurring_status || raw.recurringStatus).toLowerCase(),
      billingInterval: coerceText(raw.billing_interval || raw.billingInterval).toLowerCase(),
      nextDueAt: coerceText(raw.next_due_at || raw.nextDueAt),
      currency: coerceText(raw.currency).toLowerCase(),
      isSupporter: raw.is_supporter === true || raw.isSupporter === true,
      supporterSource: coerceText(raw.supporter_source || raw.supporterSource).toLowerCase(),
      hasAnyPayment: raw.has_any_payment === true || raw.hasAnyPayment === true,
      hasOneoffDonation: raw.has_oneoff_donation === true || raw.hasOneoffDonation === true,
      hasActiveSubscription: raw.has_active_subscription === true || raw.hasActiveSubscription === true,
      lifetimeTotalPaidCents: normalizeInteger(raw.lifetime_total_paid_cents ?? raw.lifetimeTotalPaidCents),
      subscriptionTotalPaidCents: normalizeInteger(raw.subscription_total_paid_cents ?? raw.subscriptionTotalPaidCents),
      donationTotalPaidCents: normalizeInteger(raw.donation_total_paid_cents ?? raw.donationTotalPaidCents),
      lastPaymentAmountCents: normalizeInteger(raw.last_payment_amount_cents ?? raw.lastPaymentAmountCents),
      lastPaymentAt: coerceText(raw.last_payment_at || raw.lastPaymentAt),
      lastPaymentSource: coerceText(raw.last_payment_source || raw.lastPaymentSource).toLowerCase(),
      donationCount: normalizeInteger(raw.donation_count ?? raw.donationCount),
      effectiveTierSource: coerceText(raw.effective_tier_source || raw.effectiveTierSource).toLowerCase(),
      isAdminGrantedTier: raw.is_admin_granted_tier === true || raw.isAdminGrantedTier === true,
      adminGrantIsLifetime: raw.admin_grant_is_lifetime === true || raw.adminGrantIsLifetime === true,
      adminGrantStartedAt: coerceText(raw.admin_grant_started_at || raw.adminGrantStartedAt),
      adminGrantExpiresAt: coerceText(raw.admin_grant_expires_at || raw.adminGrantExpiresAt),
      adminGrantDurationUnit: coerceText(raw.admin_grant_duration_unit || raw.adminGrantDurationUnit).toLowerCase(),
      adminGrantDurationValue: normalizeInteger(raw.admin_grant_duration_value ?? raw.adminGrantDurationValue),
      hasDiscount: raw.has_discount === true || raw.hasDiscount === true,
      activeDiscounts: Array.isArray(raw.active_discounts || raw.activeDiscounts)
        ? (raw.active_discounts || raw.activeDiscounts)
        : [],
      creditTotalCents: normalizeInteger(raw.credit_total_cents ?? raw.creditTotalCents),
      writeoffTotalCents: normalizeInteger(raw.writeoff_total_cents ?? raw.writeoffTotalCents),
      balanceReliefTotalCents: normalizeInteger(raw.balance_relief_total_cents ?? raw.balanceReliefTotalCents),
      planFeatures: normalizeFeatures(raw.plan_features || raw.planFeatures),
      sourceOfTruth: coerceText(raw.source_of_truth || raw.sourceOfTruth),
    };
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
    const paymentSummary = normalizePaymentSummary(
      sessionSource.payment_summary || sessionSource.paymentSummary
    );
    const creatorCapable =
      sessionSource.creator_capable === true ||
      sessionSource.creatorCapable === true;
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
      creatorCapable,
      badges: normalizeAuthoritativeBadges(sessionSource.badges, tier, role),
      findmehereBadges: normalizeAuthoritativeBadges(
        sessionSource.findmehere_badges || sessionSource.findmehereBadges,
        tier,
        role
      ),
      effectiveTier,
      features,
      paymentSummary,
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
      JSON.stringify(left.badges || []) === JSON.stringify(right.badges || []) &&
      JSON.stringify(left.findmehereBadges || []) === JSON.stringify(right.findmehereBadges || []) &&
      (left.effectiveTier?.tierId || "") === (right.effectiveTier?.tierId || "") &&
      (left.effectiveTier?.tierLabel || "") === (right.effectiveTier?.tierLabel || "") &&
      (left.effectiveTier?.visibility || "") === (right.effectiveTier?.visibility || "") &&
      JSON.stringify(left.features || {}) === JSON.stringify(right.features || {}) &&
      JSON.stringify(left.paymentSummary || null) === JSON.stringify(right.paymentSummary || null) &&
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
      paymentSummary: session?.paymentSummary || null,
      onboardingRequired: session?.onboardingRequired === true
    };
    syncAuthBootstrapState();
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
      paymentSummary: session?.paymentSummary || null,
      onboardingRequired: session?.onboardingRequired === true
    };
    try {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(payload));
      localStorage.setItem(LOCAL_SESSION_UPDATED_AT_KEY, String(Date.now()));
    } catch (err) {
      console.warn("[Dashboard][Auth] Failed to persist session", err);
    }
  }

  function clearPersistedLocalSession() {
    try {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      localStorage.removeItem(LOCAL_SESSION_UPDATED_AT_KEY);
    } catch (err) {
      console.warn("[Dashboard][Auth] Failed to clear persisted session", err);
    }
  }

  function readPersistedLocalSession() {
    try {
      const raw = localStorage.getItem(LOCAL_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function hasRecentAuthenticatedSessionHint() {
    const persisted = readPersistedLocalSession();
    if (!persisted || persisted.authenticated !== true) {
      return false;
    }
    try {
      const updatedAt = Number(localStorage.getItem(LOCAL_SESSION_UPDATED_AT_KEY) || 0);
      if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
        return true;
      }
      return Date.now() - updatedAt <= PUBLIC_SESSION_HINT_TTL_MS;
    } catch (err) {
      return true;
    }
  }

  function shouldBootstrapPublicSession(pendingPostAuth = null) {
    if (pendingPostAuth) {
      return true;
    }
    return hasRecentAuthenticatedSessionHint();
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
      if (header.closest("#view-container")) {
        return;
      }
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

  function removeCreatorRoleTags(summary) {
    if (!summary) return;
    summary.querySelectorAll(".streamsuites-auth-role").forEach((roleTag) => {
      roleTag.remove();
    });
  }

  function ensureCreatorDebugPill(summary) {
    if (!summary) return null;
    let pill = summary.querySelector("[data-creator-debug-indicator]");
    if (pill) return pill;

    pill = document.createElement("span");
    pill.className = "creator-debug-pill";
    pill.dataset.creatorDebugIndicator = "true";
    pill.textContent = "Debug Mode";
    pill.hidden = true;

    const tierEl = summary.querySelector("[data-auth-tier]");
    if (tierEl && tierEl.parentElement === summary) {
      summary.insertBefore(pill, tierEl);
    } else {
      summary.appendChild(pill);
    }

    return pill;
  }

  function ensureCreatorDebugExitControl(menu) {
    if (!menu) return null;
    let control = menu.querySelector("[data-creator-debug-exit]");
    if (control) return control;

    const dropdown = menu.querySelector("[data-account-dropdown]");
    if (!dropdown) return null;

    control = document.createElement("button");
    control.type = "button";
    control.className = "creator-account-item secondary";
    control.dataset.creatorDebugExit = "true";
    control.textContent = "Exit Debug Mode";
    control.hidden = true;

    const logoutButton = dropdown.querySelector("[data-auth-logout]");
    if (logoutButton && logoutButton.parentElement === dropdown) {
      dropdown.insertBefore(control, logoutButton);
    } else {
      dropdown.appendChild(control);
    }

    return control;
  }

  function isCreatorDebugModeEligible(session = sessionState.value) {
    return isAdminSession(session) && !isCreatorSession(session);
  }

  function isCreatorDebugModeActive(session = sessionState.value) {
    if (!isCreatorDebugModeEligible(session)) return false;
    return readCreatorDebugModeFlag();
  }

  function syncDebugModeUI(session = sessionState.value) {
    const enabled = isCreatorDebugModeActive(session);

    document.querySelectorAll("[data-auth-summary]").forEach((summary) => {
      removeCreatorRoleTags(summary);
      const pill = ensureCreatorDebugPill(summary);
      if (pill) {
        pill.hidden = !enabled;
      }
    });

    document.querySelectorAll("[data-account-menu]").forEach((menu) => {
      const exitControl = ensureCreatorDebugExitControl(menu);
      if (exitControl) {
        exitControl.hidden = !enabled;
      }
    });

    document.documentElement.classList.toggle("creator-debug-mode", enabled);
    document.body.classList.toggle("creator-debug-mode", enabled);
    return enabled;
  }

  function syncCreatorDebugModeState(session = sessionState.value) {
    const requested = readCreatorDebugModeFlag();
    const authenticated = !!session?.authenticated;
    const creatorSession = isCreatorSession(session);
    const adminSession = isAdminSession(session);
    const eligible = isCreatorDebugModeEligible(session);

    const forcedOffForCreator = authenticated && creatorSession && requested;
    if (authenticated && creatorSession) {
      clearCreatorDebugModeFlag();
    } else if (authenticated && !eligible && requested) {
      clearCreatorDebugModeFlag();
    }
    const forcedOffForIneligible = authenticated && !creatorSession && !eligible && requested;

    const requestedAfterEnforcement = readCreatorDebugModeFlag();
    const enabled = adminSession && !creatorSession && requestedAfterEnforcement;

    ensureAppNamespace();
    window.App.creatorDebugMode = {
      enabled,
      eligible,
      requested: requestedAfterEnforcement,
      isAdminSession: adminSession,
      isCreatorSession: creatorSession,
      storageKey: CREATOR_DEBUG_MODE_KEY,
      storageKeys: CREATOR_DEBUG_MODE_STORAGE_KEYS.slice()
    };

    syncDebugModeUI(session);
    window.dispatchEvent(
      new CustomEvent(CREATOR_DEBUG_MODE_EVENT, {
        detail: {
          enabled,
          eligible,
          isAdminSession: adminSession,
          isCreatorSession: creatorSession,
          forcedOffForIneligible,
          forcedOffForCreator
        }
      })
    );
    return enabled;
  }

  function setCreatorDebugModeEnabled(enabled, session = sessionState.value) {
    if (enabled && !isCreatorDebugModeEligible(session)) {
      return false;
    }
    if (enabled) {
      writeCreatorDebugModeFlag(true);
    } else {
      clearCreatorDebugModeFlag();
    }
    syncCreatorDebugModeState(session);
    return true;
  }

  function isRoleMismatchBypassAllowed(session = sessionState.value) {
    return isCreatorDebugModeActive(session);
  }

  function setProfileHoverAttr(node, attr, value) {
    if (!(node instanceof Element) || !attr) return;
    const text = String(value || "").trim();
    if (text) {
      node.setAttribute(attr, text);
      return;
    }
    node.removeAttribute(attr);
  }

  function applyProfileHoverSummaryAttrs(node, session) {
    if (!(node instanceof Element)) return;
    if (node.closest('[data-ss-profile-hover="off"], .ss-no-profile-hover')) return;
    if (!session?.authenticated) {
      node.classList.remove("ss-profile-hover");
      return;
    }
    const displayName = getDisplayName(session);
    const userCode = coerceText(session?.user_code);
    const avatarUrl = coerceText(session?.avatar);
    const role = normalizeRole(session?.role);
    const profileHref = userCode
      ? `https://streamsuites.app/community/profile.html?u=${encodeURIComponent(userCode)}`
      : "";

    node.classList.add("ss-profile-hover");
    setProfileHoverAttr(node, "data-ss-display-name", displayName);
    setProfileHoverAttr(node, "data-ss-user-code", userCode);
    setProfileHoverAttr(node, "data-ss-user-id", userCode);
    setProfileHoverAttr(node, "data-ss-avatar-url", avatarUrl);
    setProfileHoverAttr(node, "data-ss-role", role ? role.toUpperCase() : "CREATOR");
    setProfileHoverAttr(node, "data-ss-profile-href", profileHref);
    setProfileHoverAttr(node, "data-ss-badges", JSON.stringify(session?.badges || []));
  }

  function ensureTopbarProfileHoverOptOut() {
    document.querySelectorAll('#app-header [data-auth-summary], .ss-topbar [data-auth-summary]').forEach((node) => {
      node.setAttribute("data-ss-profile-hover", "off");
      node.classList.add("ss-no-profile-hover");
    });
  }

  function isCreatorDashboardSummary(summary) {
    return summary instanceof HTMLElement && summary.matches(".creator-account, [data-account-menu]");
  }

  function getRoleBadgeLabel(session) {
    const normalizedRole = normalizeRole(session?.role);
    if (!normalizedRole) return "Creator";
    return normalizedRole
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function updateAuthSummary(session) {
    const summaries = document.querySelectorAll("[data-auth-summary]");
    summaries.forEach((summary) => {
      removeCreatorRoleTags(summary);
      const emailEl = summary.querySelector("[data-auth-email]");
      const nameEl = summary.querySelector("[data-auth-name]");
      const tierEl = summary.querySelector("[data-auth-tier]");
      const logoutEl = summary.querySelector("[data-auth-logout]");
      const avatarEl = summary.querySelector("[data-auth-avatar]");
      const creatorDashboardSummary = isCreatorDashboardSummary(summary);

      if (!emailEl || !tierEl || !logoutEl) return;

      if (!session?.authenticated) {
        if (emailEl) emailEl.textContent = "Signed out";
        if (emailEl) emailEl.removeAttribute("data-auth-role");
        if (nameEl && nameEl !== emailEl) {
          nameEl.textContent = "Signed out";
        }
        tierEl.hidden = true;
        logoutEl.hidden = true;
        if (avatarEl) avatarEl.src = "/assets/icons/ui/profile.svg";
        if (nameEl) nameEl.classList.remove("ss-profile-hover");
        if (avatarEl) avatarEl.classList.remove("ss-profile-hover");
        return;
      }

      const displayName = getDisplayName(session);
      const emailValue = getEmailValue(session);
      if (emailEl) {
        emailEl.textContent = creatorDashboardSummary
          ? getRoleBadgeLabel(session)
          : emailEl === nameEl
            ? displayName
            : emailValue;
        if (creatorDashboardSummary) {
          emailEl.setAttribute("data-auth-role", normalizeRole(session?.role) || "creator");
        } else {
          emailEl.removeAttribute("data-auth-role");
        }
      }
      if (nameEl) {
        nameEl.textContent = displayName;
      }
      const tierLabel = getTierLabel(session);
      renderBadgeStrip(tierEl, session?.badges, tierLabel);
      tierEl.hidden = false;
      logoutEl.hidden = false;
      if (avatarEl) {
        avatarEl.src = session.avatar || "/assets/icons/ui/profile.svg";
      }
      applyProfileHoverSummaryAttrs(nameEl, session);
      applyProfileHoverSummaryAttrs(avatarEl, session);
    });
    updateAccountMenuState(session);
    updateAccountSettingsPanel(session);
    syncCreatorDebugModeState(session);
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
        renderBadgeStrip(detailTier, authenticated ? session?.badges : [], authenticated ? getTierLabel(session) : "CORE");
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
      renderBadgeStrip(tierValue, authenticated ? session?.badges : [], authenticated ? getTierLabel(session) : "CORE");
    }
    if (avatarImage instanceof HTMLImageElement) {
      avatarImage.src = authenticated && session?.avatar ? session.avatar : "/assets/icons/ui/profile.svg";
    }
    applyProfileHoverSummaryAttrs(nameInput, session);
    applyProfileHoverSummaryAttrs(userCodeValue, session);
    applyProfileHoverSummaryAttrs(profileEmailValue, session);
    applyProfileHoverSummaryAttrs(avatarImage, session);

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
      window.location.assign(buildCreatorLoginPageUrl({ reason: LOGOUT_REASON }));
    }
  }

  function clearLocalSessionState() {
    sessionState.value = { authenticated: false };
    updateAppSession(sessionState.value);
    updateAuthSummary(sessionState.value);
    updateXEmailBanner(sessionState.value, isPublicPath(getPathname()));
    setAuthBootstrapState(AUTH_BOOT_STATES.unauthenticated, {
      sessionChecked: true,
      protectedDataStatus: "idle",
      protectedDataSource: "",
      message: ""
    });
    if (window.App?.state) {
      window.App.state = {};
    }
    clearPersistedLocalSession();
  }

  function markProtectedDataReady(source = "") {
    if (authBootstrap.status === AUTH_BOOT_STATES.unauthenticated) return;
    setAuthBootstrapState(AUTH_BOOT_STATES.authenticated, {
      sessionChecked: true,
      protectedDataStatus: "ready",
      protectedDataSource: source,
      message: ""
    });
  }

  function reportProtectedDataFailure({ status = null, message = "", source = "" } = {}) {
    const normalizedStatus = Number.isFinite(Number(status)) ? Number(status) : null;
    const normalizedSource = typeof source === "string" ? source : "";
    if (normalizedStatus === 401 || normalizedStatus === 403) {
      console.warn(
        `[Creator][Auth] Protected data unauthorized from ${normalizedSource || "unknown-source"}`
      );
      handleSessionInvalidation("expired", "PROTECTED_DATA_UNAUTHORIZED");
      return true;
    }

    const fallbackMessage =
      message || "Authenticated session is present, but creator data could not be hydrated.";
    console.warn(
      `[Creator][Auth] Protected data degraded from ${normalizedSource || "unknown-source"}: ${fallbackMessage}`
    );
    setAuthBootstrapState(AUTH_BOOT_STATES.degraded, {
      sessionChecked: true,
      protectedDataStatus: "failed",
      protectedDataSource: normalizedSource,
      message: fallbackMessage
    });
    showAuthToast(fallbackMessage, {
      tone: "warning",
      key: `creator-protected-data:${normalizedSource || "unknown"}`
    });
    return false;
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

  function wireCreatorDebugControls() {
    if (creatorDebugWired) return;
    creatorDebugWired = true;

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const proceedButton = target.closest("[data-creator-debug-proceed]");
      if (proceedButton) {
        event.preventDefault();
        const session = sessionState.value || window.App?.session || null;
        if (!setCreatorDebugModeEnabled(true, session)) {
          showAuthToast("Debug Mode is only available to admin accounts.");
          return;
        }
        if (session?.authenticated) {
          persistLocalSession(session);
        }
        window.location.reload();
        return;
      }

      const exitButton = target.closest("[data-creator-debug-exit]");
      if (!exitButton) return;

      event.preventDefault();
      setCreatorDebugModeEnabled(false, sessionState.value || window.App?.session || null);

      if (sessionState.value?.authenticated && !isCreatorSession(sessionState.value)) {
        toggleCreatorLockout(true, { variant: LOCKOUT_VARIANT_ROLE_MISMATCH });
        setCreatorShellVisible(false);
      } else {
        toggleCreatorLockout(false);
        setCreatorShellVisible(true);
      }
      showAuthToast("Debug Mode disabled.");
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
    if (session?.authenticated && !isCreatorSession(session)) {
      return `${CREATOR_ORIGIN}/index.html`;
    }
    const needsOnboarding = session?.onboardingRequired === true;
    if (needsOnboarding) {
      return CREATOR_ONBOARDING_PAGE;
    }
    return getRequestedReturnTarget() || `${CREATOR_ORIGIN}/index.html`;
  }

  async function routeAfterAuth(payload = null) {
    let session = null;
    let source = "session_refresh";
    if (payload && typeof payload === "object") {
      const sessionFromPayload = normalizeSessionPayload(payload);
      if (sessionFromPayload.authenticated) {
        session = sessionFromPayload;
        source = "direct_login";
      }
    }

    if (!session) {
      session = await loadSession({ force: true });
    }
    if (session?.authenticated) {
      applySessionUpdate(session);
      const redirectTarget = resolvePostAuthRedirect(session);
      const stagedTarget = stagePostAuthSettleState(redirectTarget, { source }) || redirectTarget;
      console.info("[Creator][Auth] post_auth_navigate", {
        source,
        destination: stagedTarget
      });
      window.location.assign(stagedTarget);
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
    syncAuthAccessUi();
  }

  function getAuthAccessElements() {
    const modal = document.querySelector("[data-auth-modal]");
    if (!modal) return null;
    return {
      modal,
      gate: modal.querySelector("[data-auth-access-gate]"),
      message: modal.querySelector("[data-auth-access-message]"),
      toggle: modal.querySelector("[data-auth-access-toggle]"),
      form: modal.querySelector("[data-auth-access-form]"),
      input: modal.querySelector("[data-auth-access-input]"),
      submit: modal.querySelector("[data-auth-access-submit]"),
      feedback: modal.querySelector("[data-auth-access-feedback]")
    };
  }

  function isAuthAccessBlocked(state = authAccess.state) {
    return Boolean(state?.gateActive && !state?.bypassUnlocked);
  }

  function setAuthAccessFeedback(message, tone = "") {
    const ui = getAuthAccessElements();
    if (!ui?.feedback) return;
    const text = typeof message === "string" ? message.trim() : "";
    ui.feedback.hidden = !text;
    ui.feedback.textContent = text;
    ui.feedback.dataset.tone = tone;
  }

  function setAuthAccessFormOpen(open) {
    const ui = getAuthAccessElements();
    authAccess.formOpen = Boolean(
      open &&
      authAccess.state?.gateActive &&
      authAccess.state?.bypassEnabled &&
      !authAccess.state?.bypassUnlocked
    );
    if (!ui) return;
    if (ui.form) {
      ui.form.hidden = !authAccess.formOpen;
    }
    if (ui.toggle instanceof HTMLButtonElement) {
      ui.toggle.setAttribute("aria-expanded", authAccess.formOpen ? "true" : "false");
      ui.toggle.classList.toggle("is-active", authAccess.formOpen);
    }
    if (authAccess.formOpen && ui.input instanceof HTMLInputElement) {
      window.setTimeout(() => ui.input.focus(), 0);
    }
  }

  function syncAuthAccessUi() {
    const ui = getAuthAccessElements();
    if (!ui) return;

    if (ui.gate) {
      ui.gate.hidden = !authAccess.state?.gateActive;
      ui.gate.classList.toggle("is-unlocked", authAccess.state?.bypassUnlocked === true);
    }
    if (ui.message) {
      ui.message.textContent = authAccess.state?.gateActive ? authAccess.state.message : "";
    }
    if (ui.toggle instanceof HTMLButtonElement) {
      ui.toggle.hidden = !(authAccess.state?.gateActive && authAccess.state?.bypassEnabled);
    }
    if (!authAccess.state?.gateActive || !authAccess.state?.bypassEnabled || authAccess.state?.bypassUnlocked) {
      setAuthAccessFormOpen(false);
    } else if (ui.form) {
      ui.form.hidden = !authAccess.formOpen;
    }

    const blocked = isAuthAccessBlocked();
    document.querySelectorAll("[data-auth-oauth]").forEach((button) => {
      button.classList.toggle("is-disabled", blocked);
      button.setAttribute("aria-disabled", blocked ? "true" : "false");
    });
    document.querySelectorAll("[data-auth-manual-toggle]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.disabled = blocked;
    });
    document
      .querySelectorAll("[data-auth-login-submit], [data-auth-signup-submit]")
      .forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const form = button.closest("form");
        const busy = form?.dataset.authBusy === "true";
        button.disabled = blocked || busy;
      });
  }

  async function loadAuthAccessState(force = false) {
    if (!isPublicPath(getPathname())) {
      return authAccess.state;
    }

    const shouldUseCache =
      !force &&
      authAccess.loadedAt > 0 &&
      Date.now() - authAccess.loadedAt < AUTH_ACCESS_CACHE_MS;
    if (shouldUseCache) {
      syncAuthAccessUi();
      return authAccess.state;
    }
    if (authAccess.refreshPromise) return authAccess.refreshPromise;

    authAccess.refreshPromise = fetchJson(
      AUTH_ENDPOINTS.accessState,
      {
        method: "GET",
        cache: "no-store"
      },
      5000
    )
      .then((payload) => {
        authAccess.state = normalizeAuthAccessState(payload, true);
        authAccess.loadedAt = Date.now();
        syncAuthAccessUi();
        return authAccess.state;
      })
      .catch(() => {
        authAccess.state = normalizeAuthAccessState(null, false);
        authAccess.loadedAt = Date.now();
        syncAuthAccessUi();
        return authAccess.state;
      })
      .finally(() => {
        authAccess.refreshPromise = null;
      });

    return authAccess.refreshPromise;
  }

  async function unlockAuthAccess(code) {
    const payload = await requestJson(
      AUTH_ENDPOINTS.debugUnlock,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ code })
      },
      5000
    );
    const expiresAt = typeof payload?.expires_at === "string" ? payload.expires_at.trim() : "";
    if (expiresAt) {
      persistAuthAccessUnlockState(expiresAt);
    }
    authAccess.state = {
      ...normalizeAuthAccessState(
        {
          mode: payload?.mode || authAccess.state?.mode,
          message: payload?.message || authAccess.state?.message,
          bypass_enabled: true
        },
        true
      ),
      bypassUnlocked: true,
      unlockExpiresAt: expiresAt || authAccess.state?.unlockExpiresAt || ""
    };
    authAccess.loadedAt = Date.now();
    setAuthAccessFormOpen(false);
    setAuthAccessFeedback("Access unlocked.", "success");
    syncAuthAccessUi();
    return authAccess.state;
  }

  async function ensureAuthAccessReady(options = {}) {
    const { force = false, reveal = false } = options;
    const nextState = await loadAuthAccessState(force);
    if (reveal && isAuthAccessBlocked(nextState) && nextState?.bypassEnabled) {
      setAuthAccessFormOpen(true);
    }
    return nextState;
  }

  function wireAuthAccessGate() {
    const ui = getAuthAccessElements();
    if (!ui) return;

    ui.toggle?.addEventListener("click", () => {
      setAuthAccessFeedback("", "");
      setAuthAccessFormOpen(!authAccess.formOpen);
    });

    ui.form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const code = ui.input instanceof HTMLInputElement ? ui.input.value.trim() : "";
      if (!code) {
        setAuthAccessFeedback("Enter the access code.", "error");
        return;
      }

      if (ui.submit instanceof HTMLButtonElement) {
        ui.submit.disabled = true;
        ui.submit.textContent = "Unlocking...";
      }
      setAuthAccessFeedback("", "");

      try {
        await unlockAuthAccess(code);
        if (ui.input instanceof HTMLInputElement) {
          ui.input.value = "";
        }
      } catch (err) {
        const message =
          err?.status === 403
            ? "Invalid access code."
            : err?.status === 429
              ? "Too many attempts. Please wait and try again."
              : "Unlock is unavailable right now.";
        setAuthAccessFeedback(message, "error");
      } finally {
        if (ui.submit instanceof HTMLButtonElement) {
          ui.submit.disabled = false;
          ui.submit.textContent = "Unlock";
        }
        syncAuthAccessUi();
      }
    });

    syncAuthAccessUi();
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
      form.dataset.authBusy = isLoading ? "true" : "false";
      inputs.forEach((input) => {
        input.disabled = isLoading;
      });
      syncAuthAccessUi();
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
        const accessState = await ensureAuthAccessReady({ reveal: true });
        if (isAuthAccessBlocked(accessState)) {
          setFormState(loginForm, {
            state: "hint",
            message: accessState?.bypassEnabled ? "Unlock access to continue." : accessState.message
          });
          return;
        }
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
        const accessState = await ensureAuthAccessReady({ reveal: true });
        if (isAuthAccessBlocked(accessState)) {
          setFormState(signupForm, {
            state: "hint",
            message: accessState?.bypassEnabled ? "Unlock access to continue." : accessState.message
          });
          return;
        }
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
      const url = buildCreatorOauthUrl(provider);
      if (!url) return;
      if (button instanceof HTMLAnchorElement) {
        button.href = url;
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          const accessState = await ensureAuthAccessReady({ reveal: true });
          if (isAuthAccessBlocked(accessState)) {
            return;
          }
          persistLastOauthProvider(normalizedProvider);
          logCreatorLoginTarget(normalizedProvider, url);
          window.location.assign(url);
        });
        return;
      }
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        const accessState = await ensureAuthAccessReady({ reveal: true });
        if (isAuthAccessBlocked(accessState)) {
          return;
        }
        persistLastOauthProvider(normalizedProvider);
        logCreatorLoginTarget(normalizedProvider, url);
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

      toggle.addEventListener("click", async () => {
        const accessState = await ensureAuthAccessReady({ reveal: true });
        if (isAuthAccessBlocked(accessState)) {
          return;
        }
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
      const adminSession = isAdminSession(sessionState.value);
      const debugEnabled = isCreatorDebugModeActive(sessionState.value);

      if (adminSession) {
        lockout.innerHTML = `
          <div class="lockout-card">
            <span class="lockout-pill">Creator access required</span>
            <h2>This area is for creators.</h2>
            <p>
              You are signed in with an admin account. You can continue with sample data in Debug Mode.
            </p>
            <div class="lockout-actions">
              <button class="lockout-button" type="button" data-creator-debug-proceed="true">
                ${debugEnabled ? "Continue in Debug Mode" : "Proceed in Debug Mode"}
              </button>
              ${
                debugEnabled
                  ? '<button class="lockout-button secondary" type="button" data-creator-debug-exit="true">Exit Debug Mode</button>'
                  : '<button class="lockout-button secondary" type="button" data-auth-logout="true">Sign out</button>'
              }
            </div>
          </div>
        `;
        return lockout;
      }

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
              href="/login/"
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
    window.location.replace(buildCreatorLoginPageUrl());
  }

  function redirectToLogin(reason = "expired") {
    if (isCreatorAuthPath(getPathname())) return;
    try {
      if (sessionStorage.getItem(REDIRECT_GUARD_KEY) === "true") return;
      sessionStorage.setItem(REDIRECT_GUARD_KEY, "true");
    } catch (err) {
      console.warn("[Dashboard][Auth] Failed to set redirect guard", err);
    }
    window.location.assign(buildCreatorLoginPageUrl({ reason }));
  }

  function buildAuthToast() {
    const title = document.createElement("strong");
    title.className = "ss-auth-toast-title";
    const message = document.createElement("span");
    message.className = "ss-auth-toast-message";
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "ss-auth-toast-dismiss";
    dismiss.setAttribute("aria-label", "Dismiss notification");
    dismiss.textContent = "×";
    const toast = document.createElement("div");
    toast.className = "ss-alert ss-auth-toast";
    toast.dataset.authToast = "true";
    toast.append(title, message, dismiss);
    return toast;
  }

  function getAuthToastStack() {
    let stack = document.querySelector("[data-auth-toast-stack]");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "ss-auth-toast-stack";
      stack.dataset.authToastStack = "true";
      stack.setAttribute("aria-live", "polite");
      stack.setAttribute("aria-atomic", "false");
      document.body.appendChild(stack);
    }
    return stack;
  }

  function showAuthToast(message, options = {}) {
    if (!message) return;
    const { tone = "warning", autoHideMs = 4200, key = "", title = tone } = options;
    const toastId = String(key || `${tone}:${message}`).trim();
    const existing = document.querySelector(`[data-auth-toast-id="${CSS.escape(toastId)}"]`);
    if (existing) {
      existing.querySelector(".ss-auth-toast-dismiss")?.click();
    }
    const toast = buildAuthToast();
    toast.dataset.authToastId = toastId;
    toast.dataset.tone = tone;
    toast.classList.toggle("ss-alert-danger", tone === "danger" || tone === "error");
    toast.setAttribute("role", tone === "danger" || tone === "error" ? "alert" : "status");
    toast.setAttribute("aria-live", tone === "danger" || tone === "error" ? "assertive" : "polite");
    toast.querySelector(".ss-auth-toast-title").textContent = title;
    toast.querySelector(".ss-auth-toast-message").textContent = message;
    toast.querySelector(".ss-auth-toast-dismiss").addEventListener("click", () => {
      if (toast._hideTimer) {
        clearTimeout(toast._hideTimer);
      }
      toast.classList.remove("is-visible");
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(), 220);
    });
    getAuthToastStack().appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    if (autoHideMs > 0) {
      toast._hideTimer = setTimeout(() => {
        toast.querySelector(".ss-auth-toast-dismiss")?.click();
      }, autoHideMs);
    }
  }

  function clearAuthToasts() {
    document.querySelectorAll("[data-auth-toast-id]").forEach((toast) => {
      toast.querySelector(".ss-auth-toast-dismiss")?.click();
    });
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
    if (!isCreatorSession(session)) return false;
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
    if (pathname === "/login" || pathname === "/login/" || pathname === "/login.html") {
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
    persistLocalSession(nextSession);
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
        if (!isCreatorSession(nextSession) && !isRoleMismatchBypassAllowed(nextSession)) {
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
    const pendingPostAuth = readPostAuthSettleState();
    const shouldBootstrapSession = !isPublic || shouldBootstrapPublicSession(pendingPostAuth);
    setAuthBootstrapState(AUTH_BOOT_STATES.bootstrapping, {
      sessionChecked: false,
      protectedDataStatus: "idle",
      protectedDataSource: "",
      message: ""
    });

    ensureAuthSummaryMounts();
    ensureTopbarProfileHoverOptOut();
    wireLogoutButtons();
    wireCreatorDebugControls();
    wireAccountMenus();
    wireOauthButtons();
    wireAuthToggle();
    wireManualAuthSections();
    wirePasswordForms();
    wireAuthAccessGate();
    syncCreatorDebugModeState(sessionState.value);
    if (isPublic) {
      void loadAuthAccessState(true);
    }

    if (shouldSkipSessionFetch(isPublic)) {
      clearPostAuthSettleState();
      clearPersistedLocalSession();
      sessionState.value = { authenticated: false };
      updateAppSession(sessionState.value);
      updateAuthSummary(sessionState.value);
      updateXEmailBanner(sessionState.value, isPublic);
      setAuthBootstrapState(AUTH_BOOT_STATES.unauthenticated, {
        sessionChecked: true,
        protectedDataStatus: "idle",
        protectedDataSource: "",
        message: ""
      });
      showAuthModalAndHaltAppInit(sessionState.value);
      return;
    }

    if (!isPublic) {
      setCreatorShellVisible(false);
    }

    if (isPublic && !shouldBootstrapSession) {
      sessionState.value = {
        authenticated: false,
        idle: true,
        bootstrapDeferred: true
      };
      updateAppSession(sessionState.value);
      updateAuthSummary(sessionState.value);
      updateXEmailBanner(sessionState.value, isPublic);
      setAuthBootstrapState(AUTH_BOOT_STATES.unauthenticated, {
        sessionChecked: false,
        protectedDataStatus: "idle",
        protectedDataSource: "",
        message: ""
      });
      showAuthModalAndHaltAppInit(sessionState.value);
      return;
    }

    let session = await loadSession();
    if (pendingPostAuth && !session?.authenticated && isCookieMissingSessionState(session)) {
      setAuthBootstrapState(AUTH_BOOT_STATES.bootstrapping, {
        sessionChecked: false,
        protectedDataStatus: "pending",
        protectedDataSource: pendingPostAuth.source || "callback",
        message: "Finalizing your creator session..."
      });
      session = await settlePostAuthSession(pendingPostAuth, session);
    }

    logGuardDecision(session?.authenticated ? "authenticated" : "unauthenticated", {
      pendingPostAuth: Boolean(pendingPostAuth),
      source: pendingPostAuth?.source || "",
      reasonEnum: session?.errorReasonEnum || session?.reasonEnum || ""
    });

    if (!isPublic && isCookieMissingSessionState(session)) {
      clearPostAuthSettleState();
      clearPersistedLocalSession();
      setAuthBootstrapState(AUTH_BOOT_STATES.unauthenticated, {
        sessionChecked: true,
        protectedDataStatus: "idle",
        protectedDataSource: "",
        message: ""
      });
      redirectToLoginReplace();
      return;
    }

    if (!session?.authenticated) {
      clearPostAuthSettleState();
      clearPersistedLocalSession();
    }
    updateAppSession(session);
    if (session?.authenticated) {
      persistLocalSession(session);
    }
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
      setAuthBootstrapState(AUTH_BOOT_STATES.unauthenticated, {
        sessionChecked: true,
        protectedDataStatus: "idle",
        protectedDataSource: "",
        message:
          typeof window.StreamSuitesAuth?.loginHint === "string"
            ? window.StreamSuitesAuth.loginHint
            : ""
      });
      showAuthModalAndHaltAppInit(session);
      return;
    }

    if (session?.authenticated) {
      clearPostAuthSettleState();
      clearRedirectGuards();
    }

    if (session?.authenticated) {
      if (!isCreatorSession(session) && !isRoleMismatchBypassAllowed(session)) {
        toggleCreatorLockout(true, { variant: LOCKOUT_VARIANT_ROLE_MISMATCH });
        return;
      }
    }

    if (session?.authenticated && !isPublic) {
      toggleCreatorLockout(false);
      setCreatorShellVisible(true);
      startSessionMonitor({ isPublic });
    }
    setAuthBootstrapState(AUTH_BOOT_STATES.authenticated, {
      sessionChecked: true,
      protectedDataStatus: "pending",
      protectedDataSource: "",
      message: ""
    });

    if (session?.authenticated) {
      if (session?.onboardingRequired && !isOnboarding) {
        if (isCreatorSession(session)) {
          window.location.assign(CREATOR_ONBOARDING_PAGE);
          return;
        }
      }
      if (!session?.onboardingRequired && isOnboarding) {
        if (isCreatorSession(session)) {
          window.location.assign(`${CREATOR_ORIGIN}/index.html`);
          return;
        }
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
    apiBaseUrl: API_BASE_URL,
    endpoints: AUTH_ENDPOINTS,
    loadSession,
    logout,
    routeAfterAuth,
    resolveApiUrl: (path = "/") => resolveAuthorityApiUrl(path),
    whenReady: () => authBootstrap.readyPromise,
    getBootstrapState: () => getAuthBootstrapState(),
    markProtectedDataReady,
    reportProtectedDataFailure,
    refreshSummary: async () => {
      updateAuthSummary(sessionState.value);
      return sessionState.value;
    },
    showToast: showAuthToast,
    clearToasts: clearAuthToasts,
    debugMode: {
      key: CREATOR_DEBUG_MODE_KEY,
      isEnabled: () => isCreatorDebugModeActive(sessionState.value),
      isEligible: () => isCreatorDebugModeEligible(sessionState.value),
      setEnabled: (enabled) => setCreatorDebugModeEnabled(Boolean(enabled), sessionState.value),
      sync: () => syncCreatorDebugModeState(sessionState.value),
      syncUI: () => syncDebugModeUI(sessionState.value)
    },
    sessionRoleChecks: {
      isCreatorSession: (session) => isCreatorSession(session),
      isAdminSession: (session) => isAdminSession(session)
    },
    normalizeBadges: (value, tierFallback, roleFallback) =>
      normalizeAuthoritativeBadges(value, tierFallback, roleFallback),
    badgeIconSource: (key) => badgeIconSource(key),
    persistLocalSession,
    storageKeys: {
      session: LOCAL_SESSION_KEY,
      sessionUpdatedAt: LOCAL_SESSION_UPDATED_AT_KEY
    }
  };

  syncAuthBootstrapState();
  if (!isPublicPath(getPathname())) {
    document.documentElement.dataset.creatorAuthBootstrap = AUTH_BOOT_STATES.bootstrapping;
    setCreatorShellVisible(false);
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.dispatchEvent(new CustomEvent("streamsuites:auth-init-start"));
    Promise.resolve()
      .then(() => initAuth())
      .catch((err) => {
        console.warn("[Dashboard][Auth] Initialization failed", err);
      })
      .finally(() => {
        window.dispatchEvent(new CustomEvent("streamsuites:auth-init-complete"));
      });
  });
})();
