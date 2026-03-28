(() => {
  "use strict";

  function detectFallbackApiBase() {
    const host = (window.location.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:18087";
    }
    return "https://api.streamsuites.app";
  }

  function resolveApiBase() {
    const apiBaseUrl = window.StreamSuitesAuth?.apiBaseUrl;
    if (typeof apiBaseUrl === "string" && apiBaseUrl.trim()) {
      return apiBaseUrl.replace(/\/$/, "");
    }
    return detectFallbackApiBase();
  }

  const API_BASE = resolveApiBase();
  const AUTH_METHODS_ENDPOINT = `${API_BASE}/api/account/auth-methods`;
  const AUTH_UNLINK_ENDPOINT = `${API_BASE}/api/account/auth-methods/unlink`;
  const EMAIL_CHANGE_REQUEST_ENDPOINT = `${API_BASE}/api/account/email/change/request`;
  const PUBLIC_PROFILE_ENDPOINT = `${API_BASE}/api/public/profile/me`;
  const AVATAR_UPLOAD_ENDPOINT = `${API_BASE}/api/public/profile/media/avatar`;
  const COVER_UPLOAD_ENDPOINT = `${API_BASE}/api/public/profile/media/cover`;
  const CREATOR_INTEGRATIONS_ENDPOINT = `${API_BASE}/api/creator/integrations`;
  const AVATAR_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
  const COVER_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
  const BACKGROUND_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
  const LOGO_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
  const INTEGRATION_KEYS = Object.freeze(["youtube", "rumble", "twitch", "kick", "pilled"]);
  const KNOWN_SOCIAL_KEYS = Object.freeze([
    "website",
    "x",
    "youtube",
    "twitch",
    "discord",
    "instagram",
    "tiktok",
  ]);
  const CUSTOM_LINK_MAX_ITEMS = 8;
  const CUSTOM_LINK_LABEL_MAX_LENGTH = 80;
  const CUSTOM_LINK_ICON_MAX_BYTES = 256 * 1024;
  const CUSTOM_LINK_FALLBACK_ICON = "/assets/icons/ui/portal.svg";
  const CUSTOM_LINK_ALLOWED_MIME_TYPES = Object.freeze([
    "image/svg+xml",
    "image/png",
    "image/webp",
    "image/gif",
    "image/jpeg",
  ]);
  const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  const FINDMEHERE_THEME_DEFAULTS = Object.freeze({
    header_branding: Object.freeze({
      logo_image_url: "",
      brand_text: "",
    }),
    page_accent_color: "",
    button_color: "",
    button_tone: "brand",
    font_preset: "default",
    layout_preset: "standard",
    image_visibility: Object.freeze({
      show_cover: true,
      show_avatar: true,
      show_background: true,
    }),
    advanced: Object.freeze({
      profile_custom_css: "",
    }),
  });
  const DEFAULT_ACCENT_COLOR = "#6ad6ff";
  const DEFAULT_BUTTON_COLOR = "#3f8bff";
  const ACCOUNT_SECTION_TAB_LABELS = Object.freeze({
    "account-section-core": "Profile",
    "account-section-public": "Public",
    "account-section-media": "Media",
    "account-section-theme": "Theme",
    "account-section-preview": "Preview",
    "account-section-security": "Security",
    "account-section-integrations": "Integrations",
    "account-section-billing": "Billing",
    "account-section-badges": "Badges",
  });
  const BADGE_ORDER = Object.freeze(["admin", "core", "gold", "pro", "founder", "moderator", "developer"]);
  const HIDDEN_BADGE_GOVERNANCE_SURFACES = new Set(["creator_surface", "admin_surface", "public_surface", "directory"]);
  const RESERVED_PUBLIC_SLUGS = new Set([
    "u",
    "live",
    "community",
    "search",
    "login",
    "signup",
    "admin",
    "about",
    "privacy",
    "terms",
    "clips",
    "polls",
    "scores",
    "api",
    "auth",
    "settings",
    "dashboard",
    "creator",
    "docs",
    "members",
    "public",
    "profile",
    "profiles",
    "account",
    "accounts",
    "support",
    "help",
    "static",
    "assets",
    "status",
    "legal",
    "pricing",
    "billing",
    "subscribe",
    "unsubscribe",
    "me",
  ]);

  const state = {
    profile: null,
    integrations: [],
    uploads: {
      avatar: null,
      cover: null,
      background: null,
      logo: null,
    },
    loadingProfile: false,
    savingProfile: false,
    controlsWired: false,
    accountShellWired: false,
    accountScrollHandler: null,
    accountResizeHandler: null,
    accountHashHandler: null,
    accountTabsHandler: null,
    accountTabsToggleHandler: null,
    accountTabsArrowHandler: null,
    accountTabsOverflowHandler: null,
    accountActiveSectionId: "",
    accountScrollQueued: false,
    accountTabsOverflowQueued: false,
    previewMode: "streamsuites",
    customLinks: [],
  };

  function showToast(message, tone = "info", options = {}) {
    if (!message) return;
    const mappedTone = tone === "danger" ? "danger" : tone === "warning" ? "warning" : tone === "success" ? "success" : "info";
    window.StreamSuitesAuth?.showToast?.(message, {
      tone: mappedTone,
      title: options.title || (mappedTone === "danger" ? "Error" : mappedTone),
      autoHideMs: options.autoHideMs,
      key: options.key
    });
  }

  function setMessage(selector, message, tone) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.textContent = message || "";
    if (tone) {
      el.dataset.tone = tone;
    } else {
      delete el.dataset.tone;
    }
  }

  function hasAccountSettingsSurface() {
    return !!document.querySelector("[data-profile-load-pill]");
  }

  function getIntegrationElements() {
    return {
      summaryNote: document.querySelector("[data-integration-summary-note=\"true\"]"),
      posturePill: document.querySelector("[data-hub-posture-pill=\"true\"]"),
      postureTitle: document.querySelector("[data-hub-posture-title=\"true\"]"),
      postureSummary: document.querySelector("[data-hub-posture-summary=\"true\"]"),
      overviewPill: document.querySelector("[data-hub-overview-pill=\"true\"]"),
      overviewSummary: document.querySelector("[data-hub-overview-summary=\"true\"]"),
      deployPill: document.querySelector("[data-hub-deploy-pill=\"true\"]"),
      deploySummary: document.querySelector("[data-hub-deploy-summary=\"true\"]"),
      nextPill: document.querySelector("[data-hub-next-pill=\"true\"]"),
      nextSummary: document.querySelector("[data-hub-next-summary=\"true\"]"),
      nextActions: document.querySelector("[data-hub-next-actions=\"true\"]"),
      readinessChecklist: document.querySelector("[data-hub-readiness-checklist=\"true\"]"),
      statLinked: document.querySelector("[data-hub-stat=\"linked\"]"),
      statDeployable: document.querySelector("[data-hub-stat=\"deployable\"]"),
      statLimited: document.querySelector("[data-hub-stat=\"limited\"]"),
      statPlanned: document.querySelector("[data-hub-stat=\"planned\"]"),
    };
  }

  async function requestJson(url, options = {}) {
    const creatorHeaders =
      typeof window.StreamSuitesAuth?.creatorContext?.buildHeaders === "function"
        ? window.StreamSuitesAuth.creatorContext.buildHeaders()
        : {};
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...creatorHeaders,
        ...(options.headers || {}),
      },
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (err) {
      payload = null;
    }
    if (!response.ok) {
      const message = payload?.error || payload?.message || `Request failed (${response.status})`;
      if (response.status === 401 || response.status === 403) {
        window.StreamSuitesAuth?.reportProtectedDataFailure?.({
          status: response.status,
          message,
          source: "account-settings"
        });
      }
      const error = new Error(message);
      error.payload = payload;
      error.status = response.status;
      throw error;
    }
    return payload || {};
  }

  async function requestForm(url, formData, options = {}) {
    const creatorHeaders =
      typeof window.StreamSuitesAuth?.creatorContext?.buildHeaders === "function"
        ? window.StreamSuitesAuth.creatorContext.buildHeaders()
        : {};
    const response = await fetch(url, {
      method: options.method || "POST",
      credentials: "include",
      body: formData,
      headers: {
        ...creatorHeaders,
        ...(options.headers || {}),
      },
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (err) {
      payload = null;
    }
    if (!response.ok) {
      const message = payload?.error || payload?.message || `Request failed (${response.status})`;
      const error = new Error(message);
      error.payload = payload;
      error.status = response.status;
      throw error;
    }
    return payload || {};
  }

  function escapeHtml(value) {
    if (value === undefined || value === null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function coerceText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function formatBadgeLabel(value) {
    const text = coerceText(value) || "unknown";
    return text
      .replace(/[_-]+/g, " ")
      .split(" ")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : ""))
      .join(" ");
  }

  function badgeIconPath(key) {
    const normalized = coerceText(key).toLowerCase();
    const srcMap = {
      admin: "/assets/icons/tierbadge-admin.svg",
      core: "/assets/icons/tierbadge-core.svg",
      gold: "/assets/icons/tierbadge-gold.svg",
      pro: "/assets/icons/tierbadge-pro.svg",
      founder: "/assets/icons/founder-gold.svg",
      moderator: "/assets/icons/modgavel-blue.svg",
      developer: "/assets/icons/dev-green.svg",
    };
    return srcMap[normalized] || "";
  }

  function resolveBadgeDisplayMeta(rawBadge, options = {}) {
    const key = coerceText(rawBadge?.key ?? rawBadge).toLowerCase();
    const fallback = options.fallbackLabel || key;
    const label = formatBadgeLabel(rawBadge?.label || fallback);
    return {
      key,
      iconPath: badgeIconPath(key),
      label,
      title: formatBadgeLabel(rawBadge?.title || rawBadge?.label || fallback),
    };
  }

  function renderBadgeChoiceLabel(key, meta = "") {
    const badgeMeta = resolveBadgeDisplayMeta(key);
    return `
      <span class="accounts-badge-choice-label-wrap">
        ${badgeMeta.iconPath ? `<img class="accounts-badge-choice-icon" src="${escapeHtml(badgeMeta.iconPath)}" alt="" aria-hidden="true" />` : ""}
        <span class="accounts-badge-choice-copy">
          <span class="accounts-badge-choice-label">${escapeHtml(badgeMeta.label)}</span>
          ${meta ? `<span class="accounts-badge-choice-meta">${escapeHtml(meta)}</span>` : ""}
        </span>
      </span>
    `;
  }

  function renderBadgeIconStrip(items, emptyLabel = "No effective badge icons") {
    const badges = Array.isArray(items) ? items : [];
    if (!badges.length) return `<span class="account-note">${escapeHtml(emptyLabel)}</span>`;
    return badges
      .map((badge) => {
        const badgeMeta = resolveBadgeDisplayMeta(badge);
        return badgeMeta.iconPath
          ? `<img class="accounts-details-preview-badge" src="${escapeHtml(badgeMeta.iconPath)}" alt="${escapeHtml(badgeMeta.label)}" title="${escapeHtml(badgeMeta.title)}" />`
          : "";
      })
      .filter(Boolean)
      .join("");
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
      planTier: coerceText(raw.plan_tier || raw.planTier).toLowerCase(),
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
      planFeatures: raw.plan_features && typeof raw.plan_features === "object"
        ? { ...raw.plan_features }
        : raw.planFeatures && typeof raw.planFeatures === "object"
        ? { ...raw.planFeatures }
        : {},
      sourceOfTruth: coerceText(raw.source_of_truth || raw.sourceOfTruth),
    };
  }

  function normalizeThemeColor(value) {
    const normalized = coerceText(value);
    return HEX_COLOR_RE.test(normalized) ? normalized.toLowerCase() : "";
  }

  function expandHexColor(value, fallback = DEFAULT_ACCENT_COLOR) {
    const normalized = normalizeThemeColor(value);
    if (!normalized) return fallback;
    if (normalized.length === 4) {
      return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
    }
    return normalized;
  }

  function normalizeThemePreset(value, allowed, fallback) {
    const normalized = coerceText(value).toLowerCase();
    return allowed.includes(normalized) ? normalized : fallback;
  }

  function cloneThemeDefaults() {
    return JSON.parse(JSON.stringify(FINDMEHERE_THEME_DEFAULTS));
  }

  function normalizeFindmeTheme(theme) {
    const source = theme && typeof theme === "object" ? theme : {};
    const headerBranding = source.header_branding && typeof source.header_branding === "object" ? source.header_branding : {};
    const imageVisibility = source.image_visibility && typeof source.image_visibility === "object" ? source.image_visibility : {};
    const advanced = source.advanced && typeof source.advanced === "object" ? source.advanced : {};
    return {
      header_branding: {
        logo_image_url: coerceText(headerBranding.logo_image_url || source.header_logo_image_url || source.headerLogoImageUrl),
        brand_text: coerceText(headerBranding.brand_text || source.header_brand_text || source.headerBrandText),
      },
      page_accent_color: normalizeThemeColor(source.page_accent_color || source.pageAccentColor || source.accent_color || source.accentColor),
      button_color: normalizeThemeColor(source.button_color || source.buttonColor),
      button_tone: normalizeThemePreset(source.button_tone || source.buttonTone, ["brand", "soft", "ghost"], FINDMEHERE_THEME_DEFAULTS.button_tone),
      font_preset: normalizeThemePreset(source.font_preset || source.fontPreset || source.font_style || source.fontStyle, ["default", "editorial", "condensed", "mono"], FINDMEHERE_THEME_DEFAULTS.font_preset),
      layout_preset: normalizeThemePreset(source.layout_preset || source.layoutPreset, ["standard", "condensed", "expanded"], FINDMEHERE_THEME_DEFAULTS.layout_preset),
      image_visibility: {
        show_cover: imageVisibility.show_cover !== false && source.show_cover_image !== false && source.showCoverImage !== false,
        show_avatar: imageVisibility.show_avatar !== false && source.show_avatar_image !== false && source.showAvatarImage !== false,
        show_background: imageVisibility.show_background !== false && source.show_background_image !== false && source.showBackgroundImage !== false,
      },
      advanced: {
        profile_custom_css: String(advanced.profile_custom_css || source.profile_custom_css || source.profileCustomCss || ""),
      },
    };
  }

  function createDraftId(prefix = "draft") {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  }

  function normalizeCustomLinkItem(item) {
    const source = item && typeof item === "object" ? item : {};
    return {
      id: coerceText(source.id) || createDraftId("custom-link"),
      label: coerceText(source.label || source.title || source.name).slice(0, CUSTOM_LINK_LABEL_MAX_LENGTH),
      url: coerceText(source.url || source.href || source.destination),
      icon_url: coerceText(
        source.icon_url ||
        source.iconUrl ||
        source.icon ||
        source.image_url ||
        source.imageUrl ||
        source.image
      ),
      staged_icon: null,
    };
  }

  function normalizeCustomLinks(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => normalizeCustomLinkItem(item))
      .filter((item) => item.label || item.url || item.icon_url)
      .slice(0, CUSTOM_LINK_MAX_ITEMS);
  }

  function releaseCustomLinkIconDraft(item) {
    if (item?.staged_icon?.previewUrl) {
      URL.revokeObjectURL(item.staged_icon.previewUrl);
    }
  }

  function clearCustomLinkDrafts() {
    state.customLinks.forEach((item) => releaseCustomLinkIconDraft(item));
  }

  function getCustomLinkIconPreviewUrl(item) {
    return item?.staged_icon?.previewUrl || coerceText(item?.icon_url) || CUSTOM_LINK_FALLBACK_ICON;
  }

  function getSanitizedCustomLinks() {
    return state.customLinks
      .map((item) => ({
        label: coerceText(item?.label).slice(0, CUSTOM_LINK_LABEL_MAX_LENGTH),
        url: coerceText(item?.url),
        icon_url: item?.staged_icon?.dataUrl || coerceText(item?.icon_url),
      }))
      .filter((item) => item.label && item.url)
      .slice(0, CUSTOM_LINK_MAX_ITEMS);
  }

  function readFileAsObjectUrl(file) {
    if (!(file instanceof File)) {
      throw new Error("No file selected.");
    }
    return URL.createObjectURL(file);
  }

  function getProfileElements() {
    return {
      loadPill: document.querySelector("[data-profile-load-pill]"),
      saveStatus: document.querySelector("[data-profile-save-status]"),
      slugInput: document.querySelector("[data-profile-slug-input]"),
      slugFeedback: document.querySelector("[data-profile-slug-feedback]"),
      slugAliasesWrap: document.querySelector("[data-profile-slug-aliases-wrap]"),
      slugAliases: document.querySelector("[data-profile-slug-aliases]"),
      streamsuitesToggle: document.querySelector("[data-profile-streamsuites-toggle]"),
      findmeToggle: document.querySelector("[data-profile-findme-toggle]"),
      streamsuitesStatus: document.querySelector("[data-profile-streamsuites-status]"),
      findmeStatus: document.querySelector("[data-profile-findme-status]"),
      streamsuitesReason: document.querySelector("[data-profile-streamsuites-reason]"),
      findmeReason: document.querySelector("[data-profile-findme-reason]"),
      creatorCapability: document.querySelector("[data-profile-creator-capability]"),
      surfaceAccountType: document.querySelector("[data-profile-surface-account-type]"),
      visibilitySummary: document.querySelector("[data-profile-visibility-summary]"),
      streamsuitesPreviewUrl: document.querySelector("[data-profile-streamsuites-url]"),
      findmePreviewUrl: document.querySelector("[data-profile-findme-url]"),
      streamsuitesPreviewNote: document.querySelector("[data-profile-streamsuites-preview-note]"),
      findmePreviewNote: document.querySelector("[data-profile-findme-preview-note]"),
      displayNameInput: document.querySelector("[data-account-profile-name]"),
      displayNameFeedback: document.querySelector("[data-profile-display-name-feedback]"),
      userCodeValue: document.querySelector("[data-account-profile-user-code]"),
      avatarImage: document.querySelector("[data-account-profile-avatar]"),
      avatarUrlInput: document.querySelector("[data-profile-avatar-url]"),
      avatarFeedback: document.querySelector("[data-profile-avatar-feedback]"),
      avatarFileInput: document.querySelector("[data-profile-avatar-file]"),
      avatarClearButton: document.querySelector("[data-profile-avatar-clear]"),
      avatarUploadStatus: document.querySelector("[data-profile-avatar-upload-status]"),
      coverImageInput: document.querySelector("[data-profile-cover-image]"),
      coverFileInput: document.querySelector("[data-profile-cover-file]"),
      coverClearButton: document.querySelector("[data-profile-cover-clear]"),
      coverUploadStatus: document.querySelector("[data-profile-cover-upload-status]"),
      coverPreview: document.querySelector("[data-profile-cover-preview]"),
      backgroundImageInput: document.querySelector("[data-profile-background-image]"),
      backgroundFileInput: document.querySelector("[data-profile-background-file]"),
      backgroundClearButton: document.querySelector("[data-profile-background-clear]"),
      backgroundUploadStatus: document.querySelector("[data-profile-background-upload-status]"),
      backgroundPreview: document.querySelector("[data-profile-background-preview]"),
      findmeThemeLogoInput: document.querySelector("[data-findme-theme-logo]"),
      findmeThemeLogoFileInput: document.querySelector("[data-findme-theme-logo-file]"),
      findmeThemeLogoPreview: document.querySelector("[data-findme-theme-logo-preview]"),
      findmeThemeLogoUploadStatus: document.querySelector("[data-findme-theme-logo-upload-status]"),
      findmeThemeLogoSourceButtons: Array.from(document.querySelectorAll("[data-findme-theme-logo-source]")),
      findmeThemeLogoClearButton: document.querySelector("[data-findme-theme-logo-clear]"),
      findmeThemeBrandTextInput: document.querySelector("[data-findme-theme-brand-text]"),
      findmeThemeAccentColorInput: document.querySelector("[data-findme-theme-accent-color]"),
      findmeThemeAccentColorPickerInput: document.querySelector("[data-findme-theme-accent-color-picker]"),
      findmeThemeButtonColorInput: document.querySelector("[data-findme-theme-button-color]"),
      findmeThemeButtonColorPickerInput: document.querySelector("[data-findme-theme-button-color-picker]"),
      findmeThemeButtonToneInput: document.querySelector("[data-findme-theme-button-tone]"),
      findmeThemeFontPresetInput: document.querySelector("[data-findme-theme-font-preset]"),
      findmeThemeLayoutPresetInput: document.querySelector("[data-findme-theme-layout-preset]"),
      findmeThemeShowCoverInput: document.querySelector("[data-findme-theme-show-cover]"),
      findmeThemeShowAvatarInput: document.querySelector("[data-findme-theme-show-avatar]"),
      findmeThemeShowBackgroundInput: document.querySelector("[data-findme-theme-show-background]"),
      findmeThemeCustomCssInput: document.querySelector("[data-findme-theme-custom-css]"),
      bioInput: document.querySelector("[data-profile-bio]"),
      linkInputs: Array.from(document.querySelectorAll("[data-profile-link]")),
      customLinksList: document.querySelector("[data-custom-links-list]"),
      customLinksSummary: document.querySelector("[data-custom-links-summary]"),
      customLinkAddButton: document.querySelector("[data-custom-link-add]"),
      identityInputs: Array.from(document.querySelectorAll("[data-profile-identity-input]")),
      saveButtons: Array.from(document.querySelectorAll("[data-profile-save]")),
      resetButtons: Array.from(document.querySelectorAll("[data-profile-reset]")),
      copyButtons: Array.from(document.querySelectorAll("[data-profile-copy-url]")),
      profileFields: Array.from(document.querySelectorAll("[data-profile-field]")),
      accountTabsWrap: document.querySelector("[data-account-shell-tabs-wrap]"),
      accountTabsScroller: document.querySelector("[data-account-shell-tabs-scroller]"),
      accountTabs: document.querySelector("[data-account-shell-tabs]"),
      accountTabButtons: Array.from(document.querySelectorAll("[data-account-shell-tab]")),
      accountTabsToggle: document.getElementById("account-tabs-toggle"),
      accountTabsArrowButtons: Array.from(document.querySelectorAll("[data-account-tabs-arrow]")),
      accountSectionCards: Array.from(document.querySelectorAll(".account-settings .account-grid > .card[id]")),
      previewHub: document.querySelector("[data-profile-preview-hub]"),
      previewModeButtons: Array.from(document.querySelectorAll("[data-profile-preview-mode]")),
      previewPanels: Array.from(document.querySelectorAll("[data-preview-panel]")),
      streamsuitesPreviewTarget: document.querySelector("[data-profile-preview-target=\"streamsuites\"]"),
      tooltipPreviewTarget: document.querySelector("[data-profile-preview-target=\"tooltip\"]"),
      findmePreviewTarget: document.querySelector("[data-profile-preview-target=\"findmehere\"]"),
      badgeGovernanceStatusPill: document.querySelector("[data-badge-governance-status-pill]"),
      badgeGovernanceSummary: document.querySelector("[data-badge-governance-summary]"),
      badgeGovernanceMatrix: document.querySelector("[data-badge-governance-matrix]"),
      badgeGovernanceSaveButtons: Array.from(document.querySelectorAll("[data-badge-governance-save]")),
    };
  }

  function getAccountSectionCards() {
    return getProfileElements().accountSectionCards.filter((card) => card instanceof HTMLElement);
  }

  function getAccountScrollContainer() {
    return document.getElementById("app-main");
  }

  function resolveAccountSectionTabLabel(card) {
    if (!(card instanceof HTMLElement)) return "";
    const explicit = coerceText(card.dataset.accountShellLabel);
    if (explicit) return explicit;
    const mapped = ACCOUNT_SECTION_TAB_LABELS[card.id];
    if (mapped) return mapped;
    const heading = coerceText(card.querySelector(".card-top h3")?.textContent);
    if (heading) return heading;
    return card.id.replace(/^account-section-/, "").replace(/-/g, " ");
  }

  function ensureAccountShellMounted() {
    const shellMain = document.querySelector("#app > .ss-main");
    const sidebarToggle = document.getElementById("sidebar-collapse-toggle");
    if (
      !(shellMain instanceof HTMLElement) ||
      !(sidebarToggle instanceof HTMLButtonElement)
    ) {
      return false;
    }

    let accountTabsToggle = document.getElementById("account-tabs-toggle");
    if (!(accountTabsToggle instanceof HTMLButtonElement)) {
      accountTabsToggle = document.createElement("button");
      accountTabsToggle.type = "button";
      accountTabsToggle.id = "account-tabs-toggle";
      accountTabsToggle.className = "sidebar-collapse-toggle account-tabs-toggle";
      accountTabsToggle.setAttribute("aria-controls", "account-shell-tabs-wrap");
      accountTabsToggle.setAttribute("aria-expanded", "true");
      accountTabsToggle.setAttribute("aria-label", "Collapse account section tabs");
      accountTabsToggle.setAttribute("title", "Collapse account section tabs");
      accountTabsToggle.innerHTML = `
        <span class="account-tabs-toggle-icon" aria-hidden="true"></span>
        <span class="sr-only">Toggle account section tabs</span>
      `;
    }
    if (!accountTabsToggle.isConnected) {
      sidebarToggle.insertAdjacentElement("afterend", accountTabsToggle);
    }

    let accountTabsWrap = document.querySelector("[data-account-shell-tabs-wrap]");
    if (!(accountTabsWrap instanceof HTMLElement)) {
      accountTabsWrap = document.createElement("div");
      accountTabsWrap.id = "account-shell-tabs-wrap";
      accountTabsWrap.className = "account-shell-tabs-wrap";
      accountTabsWrap.dataset.accountShellTabsWrap = "true";

      const nav = document.createElement("nav");
      nav.className = "account-shell-tabs";
      nav.dataset.accountShellTabs = "true";
      nav.setAttribute("aria-label", "Account settings sections");
      accountTabsWrap.appendChild(nav);
    }

    let accountTabs = accountTabsWrap.querySelector("[data-account-shell-tabs]");
    if (!(accountTabs instanceof HTMLElement)) {
      accountTabs = document.createElement("nav");
      accountTabs.className = "account-shell-tabs";
      accountTabs.dataset.accountShellTabs = "true";
      accountTabs.setAttribute("aria-label", "Account settings sections");
      accountTabsWrap.appendChild(accountTabs);
    }

    let accountTabsScroller = accountTabsWrap.querySelector("[data-account-shell-tabs-scroller]");
    if (!(accountTabsScroller instanceof HTMLElement)) {
      accountTabsScroller = document.createElement("div");
      accountTabsScroller.className = "account-shell-tabs-scroller";
      accountTabsScroller.dataset.accountShellTabsScroller = "true";
      accountTabs.replaceWith(accountTabsScroller);
      accountTabsScroller.appendChild(accountTabs);
    } else if (!accountTabsScroller.contains(accountTabs)) {
      accountTabsScroller.appendChild(accountTabs);
    }

    const ensureTabsArrowButton = (direction) => {
      const selector = `[data-account-tabs-arrow="${direction}"]`;
      let button = accountTabsWrap.querySelector(selector);
      if (!(button instanceof HTMLButtonElement)) {
        button = document.createElement("button");
        button.type = "button";
        button.className = `account-shell-tabs-arrow is-${direction}`;
        button.dataset.accountTabsArrow = direction;
        button.hidden = true;
        button.disabled = true;
        button.setAttribute("aria-hidden", "true");
        button.setAttribute(
          "aria-label",
          direction === "start" ? "Scroll account tabs left" : "Scroll account tabs right"
        );
        button.setAttribute(
          "title",
          direction === "start" ? "Scroll account tabs left" : "Scroll account tabs right"
        );
        button.innerHTML = `<span class="account-shell-tabs-arrow-icon" aria-hidden="true"></span>`;
      }
      if (!button.isConnected) {
        if (direction === "start") {
          accountTabsWrap.insertBefore(button, accountTabsScroller);
        } else {
          accountTabsWrap.appendChild(button);
        }
      }
      return button;
    };

    ensureTabsArrowButton("start");
    ensureTabsArrowButton("end");

    const insertBefore = document.getElementById("global-loader") || getAccountScrollContainer();
    if (!accountTabsWrap.isConnected) {
      shellMain.insertBefore(accountTabsWrap, insertBefore instanceof Node ? insertBefore : null);
    }

    const fragment = document.createDocumentFragment();
    getAccountSectionCards().forEach((card) => {
      const sectionId = card.id;
      if (!sectionId) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "account-shell-tab";
      button.dataset.accountShellTab = sectionId;
      button.textContent = resolveAccountSectionTabLabel(card);
      fragment.appendChild(button);
    });
    accountTabs.replaceChildren(fragment);
    return accountTabs.childElementCount > 0;
  }

  function getAccountSectionBody(card) {
    if (!(card instanceof HTMLElement)) return null;
    return Array.from(card.children).find(
      (child) => child instanceof HTMLElement && child.classList.contains("account-section-body")
    ) || null;
  }

  function withNoTransition(element, callback) {
    if (!(element instanceof HTMLElement) || typeof callback !== "function") return;
    const previousTransition = element.style.transition;
    element.style.transition = "none";
    callback();
    void element.offsetHeight;
    element.style.transition = previousTransition;
  }

  function getAccountScrollOffset(extra = 18) {
    return Math.ceil(extra);
  }

  function syncAccountShellMetrics() {
    const els = getProfileElements();
    if (!(els.accountTabsWrap instanceof HTMLElement)) return;
    const headerHeight = document.getElementById("app-header")?.getBoundingClientRect().height || 0;
    document.documentElement.style.setProperty("--creator-account-tabs-top", `${Math.ceil(headerHeight)}px`);
    document.documentElement.style.setProperty(
      "--creator-account-scroll-offset",
      `${getAccountScrollOffset(20)}px`
    );
  }

  function setAccountTabsArrowState(button, visible) {
    if (!(button instanceof HTMLButtonElement)) return;
    button.hidden = !visible;
    button.disabled = !visible;
    button.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function updateAccountTabOverflowControls() {
    state.accountTabsOverflowQueued = false;
    const els = getProfileElements();
    if (!(els.accountTabsWrap instanceof HTMLElement) || !(els.accountTabs instanceof HTMLElement)) {
      return;
    }

    const collapsed = els.accountTabsWrap.dataset.collapsed === "true";
    const maxScrollLeft = Math.max(0, els.accountTabs.scrollWidth - els.accountTabs.clientWidth);
    const overflowing = !collapsed && maxScrollLeft > 2;
    const showStart = overflowing && els.accountTabs.scrollLeft > 2;
    const showEnd = overflowing && els.accountTabs.scrollLeft < maxScrollLeft - 2;

    els.accountTabsWrap.dataset.overflowing = overflowing ? "true" : "false";
    els.accountTabsWrap.dataset.overflowStart = showStart ? "true" : "false";
    els.accountTabsWrap.dataset.overflowEnd = showEnd ? "true" : "false";

    els.accountTabsArrowButtons.forEach((button) => {
      const direction = button.getAttribute("data-account-tabs-arrow");
      setAccountTabsArrowState(button, direction === "start" ? showStart : showEnd);
    });
  }

  function queueAccountTabOverflowUpdate() {
    if (state.accountTabsOverflowQueued) return;
    state.accountTabsOverflowQueued = true;
    window.requestAnimationFrame(updateAccountTabOverflowControls);
  }

  function scrollAccountTabsByDirection(direction) {
    const els = getProfileElements();
    if (!(els.accountTabs instanceof HTMLElement)) return;
    const distance = Math.max(140, Math.round(els.accountTabs.clientWidth * 0.72));
    const delta = direction === "start" ? -distance : distance;
    els.accountTabs.scrollBy({
      left: delta,
      behavior: "smooth",
    });
  }

  function setAccountSectionExpanded(card, expanded, options = {}) {
    if (!(card instanceof HTMLElement)) return;
    const body = getAccountSectionBody(card);
    const toggle = card.querySelector("[data-account-section-toggle]");
    if (!(body instanceof HTMLElement) || !(toggle instanceof HTMLButtonElement)) return;

    const applyExpandedState = () => {
      card.dataset.expanded = expanded ? "true" : "false";
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      toggle.setAttribute("title", expanded ? "Collapse section" : "Expand section");
      toggle.querySelector(".account-section-toggle-label")?.replaceChildren(
        document.createTextNode(expanded ? "Collapse" : "Expand")
      );
      body.setAttribute("aria-hidden", expanded ? "false" : "true");
      if ("inert" in body) {
        body.inert = !expanded;
      }
      body.style.opacity = expanded ? "1" : "0";
      body.style.pointerEvents = expanded ? "auto" : "none";
    };

    if (options.instant) {
      withNoTransition(body, () => {
        applyExpandedState();
        body.style.maxHeight = expanded ? "none" : "0px";
      });
      return;
    }

    if (expanded) {
      applyExpandedState();
      body.style.maxHeight = `${body.scrollHeight}px`;
    } else {
      if (body.style.maxHeight === "none" || !body.style.maxHeight) {
        body.style.maxHeight = `${body.scrollHeight}px`;
        void body.offsetHeight;
      }
      applyExpandedState();
      body.style.maxHeight = "0px";
    }
  }

  function highlightActiveAccountTab(sectionId) {
    const els = getProfileElements();
    const nextSectionId = typeof sectionId === "string" ? sectionId : "";
    els.accountTabButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const active = button.getAttribute("data-account-shell-tab") === nextSectionId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "true" : "false");
      if (active && state.accountActiveSectionId !== nextSectionId) {
        button.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "auto",
        });
        queueAccountTabOverflowUpdate();
      }
    });
    state.accountActiveSectionId = nextSectionId;
  }

  function updateActiveAccountTab() {
    state.accountScrollQueued = false;
    const scrollContainer = getAccountScrollContainer();
    const cards = getAccountSectionCards();
    if (!(scrollContainer instanceof HTMLElement) || !cards.length) return;
    const scrollBounds = scrollContainer.getBoundingClientRect();
    const threshold = Math.max(20, Math.min(120, scrollContainer.clientHeight * 0.18));
    let activeId = cards[0].id;
    let nearestUpcomingId = cards[0].id;
    let nearestUpcomingTop = Number.POSITIVE_INFINITY;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const relativeTop = rect.top - scrollBounds.top;
      if (relativeTop <= threshold) {
        activeId = card.id;
        continue;
      }
      if (relativeTop < nearestUpcomingTop) {
        nearestUpcomingTop = relativeTop;
        nearestUpcomingId = card.id;
      }
    }
    highlightActiveAccountTab(activeId || nearestUpcomingId);
  }

  function queueActiveAccountTabUpdate() {
    if (state.accountScrollQueued) return;
    state.accountScrollQueued = true;
    window.requestAnimationFrame(updateActiveAccountTab);
  }

  function revealAccountSection(sectionId, options = {}) {
    const target = sectionId ? document.getElementById(sectionId) : null;
    const scrollContainer = getAccountScrollContainer();
    if (!(target instanceof HTMLElement)) return;
    setAccountSectionExpanded(target, true, { instant: !!options.instant });
    syncAccountShellMetrics();
    highlightActiveAccountTab(sectionId);
    if (options.updateHash !== false) {
      try {
        const nextHash = `#${sectionId}`;
        if (window.location.hash !== nextHash) {
          window.history.replaceState(null, "", nextHash);
        }
      } catch (_err) {
        // Ignore history update failures.
      }
    }
    if (options.scroll === false) return;
    if (scrollContainer instanceof HTMLElement) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const top =
        scrollContainer.scrollTop + (targetRect.top - containerRect.top) - getAccountScrollOffset(12);
      scrollContainer.scrollTo({
        top: Math.max(top, 0),
        behavior: options.instant ? "auto" : "smooth",
      });
      return;
    }
    target.scrollIntoView({
      block: "start",
      behavior: options.instant ? "auto" : "smooth",
    });
  }

  function setAccountTabsCollapsed(collapsed) {
    const els = getProfileElements();
    if (!(els.accountTabsWrap instanceof HTMLElement) || !(els.accountTabsToggle instanceof HTMLButtonElement)) {
      return;
    }
    els.accountTabsWrap.dataset.collapsed = collapsed ? "true" : "false";
    els.accountTabsWrap.classList.toggle("is-collapsed", collapsed);
    els.accountTabsToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    els.accountTabsToggle.setAttribute(
      "title",
      collapsed ? "Expand account section tabs" : "Collapse account section tabs"
    );
    syncAccountShellMetrics();
    queueActiveAccountTabUpdate();
    queueAccountTabOverflowUpdate();
  }

  function prepareAccountSections() {
    getAccountSectionCards().forEach((card) => {
      if (card.dataset.accountSectionReady === "true") return;
      const top = Array.from(card.children).find(
        (child) => child instanceof HTMLElement && child.classList.contains("card-top")
      );
      if (!(top instanceof HTMLElement)) return;

      const body = document.createElement("div");
      body.className = "account-section-body";
      body.id = `${card.id}-body`;
      while (top.nextSibling) {
        body.appendChild(top.nextSibling);
      }
      card.appendChild(body);

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "account-section-toggle";
      toggle.setAttribute("data-account-section-toggle", card.id);
      toggle.setAttribute("aria-controls", body.id);
      toggle.innerHTML = `
        <span class="account-section-toggle-label">Collapse</span>
        <span class="account-section-toggle-icon" aria-hidden="true"></span>
      `;
      toggle.addEventListener("click", () => {
        setAccountSectionExpanded(card, card.dataset.expanded !== "true");
        syncAccountShellMetrics();
      });
      top.appendChild(toggle);

      body.addEventListener("transitionend", (event) => {
        if (event.propertyName !== "max-height") return;
        if (card.dataset.expanded === "true") {
          body.style.maxHeight = "none";
        }
      });

      card.dataset.accountSectionReady = "true";
      card.classList.add("account-section-card");
      setAccountSectionExpanded(card, true, { instant: true });
    });
  }

  function wireAccountShell() {
    if (!ensureAccountShellMounted()) return;
    const els = getProfileElements();
    if (!(els.accountTabsWrap instanceof HTMLElement) || !(els.accountTabs instanceof HTMLElement)) return;
    if (state.accountShellWired) {
      syncAccountShellMetrics();
      queueActiveAccountTabUpdate();
      queueAccountTabOverflowUpdate();
      return;
    }

    prepareAccountSections();
    setAccountTabsCollapsed(false);

    state.accountTabsHandler = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("[data-account-shell-tab]");
      if (!(button instanceof HTMLButtonElement)) return;
      const sectionId = button.getAttribute("data-account-shell-tab") || "";
      revealAccountSection(sectionId);
    };
    els.accountTabs.addEventListener("click", state.accountTabsHandler);

    if (els.accountTabsToggle instanceof HTMLButtonElement) {
      state.accountTabsToggleHandler = () => {
        const collapsed = els.accountTabsWrap.dataset.collapsed === "true";
        setAccountTabsCollapsed(!collapsed);
      };
      els.accountTabsToggle.addEventListener("click", state.accountTabsToggleHandler);
    }

    state.accountTabsArrowHandler = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("[data-account-tabs-arrow]");
      if (!(button instanceof HTMLButtonElement)) return;
      const direction = button.getAttribute("data-account-tabs-arrow");
      if (direction !== "start" && direction !== "end") return;
      scrollAccountTabsByDirection(direction);
    };
    els.accountTabsWrap.addEventListener("click", state.accountTabsArrowHandler);

    state.accountTabsOverflowHandler = () => {
      queueAccountTabOverflowUpdate();
    };
    els.accountTabs.addEventListener("scroll", state.accountTabsOverflowHandler, { passive: true });

    const scrollContainer = getAccountScrollContainer();
    state.accountScrollHandler = () => {
      queueActiveAccountTabUpdate();
    };
    state.accountResizeHandler = () => {
      syncAccountShellMetrics();
      queueActiveAccountTabUpdate();
      queueAccountTabOverflowUpdate();
    };
    state.accountHashHandler = () => {
      const sectionId = (window.location.hash || "").replace(/^#/, "").trim();
      if (!sectionId) return;
      revealAccountSection(sectionId, { instant: true });
    };

    scrollContainer?.addEventListener("scroll", state.accountScrollHandler, { passive: true });
    window.addEventListener("resize", state.accountResizeHandler);
    window.addEventListener("hashchange", state.accountHashHandler);

    state.accountShellWired = true;
    syncAccountShellMetrics();
    queueAccountTabOverflowUpdate();
    const initialHash = (window.location.hash || "").replace(/^#/, "").trim();
    if (initialHash) {
      revealAccountSection(initialHash, { instant: true });
    } else {
      updateActiveAccountTab();
    }
  }

  function destroyAccountShell() {
    const els = getProfileElements();
    const scrollContainer = getAccountScrollContainer();
    if (state.accountTabsHandler && els.accountTabs instanceof HTMLElement) {
      els.accountTabs.removeEventListener("click", state.accountTabsHandler);
    }
    if (state.accountTabsToggleHandler && els.accountTabsToggle instanceof HTMLButtonElement) {
      els.accountTabsToggle.removeEventListener("click", state.accountTabsToggleHandler);
    }
    if (state.accountTabsArrowHandler && els.accountTabsWrap instanceof HTMLElement) {
      els.accountTabsWrap.removeEventListener("click", state.accountTabsArrowHandler);
    }
    if (state.accountTabsOverflowHandler && els.accountTabs instanceof HTMLElement) {
      els.accountTabs.removeEventListener("scroll", state.accountTabsOverflowHandler);
    }
    if (state.accountScrollHandler && scrollContainer instanceof HTMLElement) {
      scrollContainer.removeEventListener("scroll", state.accountScrollHandler);
    }
    if (state.accountResizeHandler) {
      window.removeEventListener("resize", state.accountResizeHandler);
    }
    if (state.accountHashHandler) {
      window.removeEventListener("hashchange", state.accountHashHandler);
    }
    state.accountShellWired = false;
    state.accountTabsHandler = null;
    state.accountTabsToggleHandler = null;
    state.accountScrollHandler = null;
    state.accountResizeHandler = null;
    state.accountHashHandler = null;
    state.accountTabsArrowHandler = null;
    state.accountTabsOverflowHandler = null;
    state.accountActiveSectionId = "";
    state.accountScrollQueued = false;
    state.accountTabsOverflowQueued = false;
    document.getElementById("account-tabs-toggle")?.remove();
    document.querySelector("[data-account-shell-tabs-wrap]")?.remove();
    document.documentElement.style.removeProperty("--creator-account-tabs-top");
    document.documentElement.style.removeProperty("--creator-account-scroll-offset");
  }

  function oauthStartUrl(provider) {
    const normalized = String(provider || "").trim().toLowerCase();
    const returnTo = `${window.location.origin}/account`;
    if (normalized === "twitch") {
      return `${API_BASE}/oauth/twitch/start?surface=creator&mode=link&return_to=${encodeURIComponent(returnTo)}`;
    }
    if (normalized === "x") {
      return `${API_BASE}/auth/x/start?surface=creator&mode=link&return_to=${encodeURIComponent(returnTo)}`;
    }
    return `${API_BASE}/auth/${normalized}?surface=creator&mode=link&return_to=${encodeURIComponent(returnTo)}`;
  }

  function setProviderButtons(provider, linked) {
    const connectButton = document.querySelector(`[data-account-provider-connect="${provider}"]`);
    const disconnectButton = document.querySelector(`[data-account-provider-disconnect="${provider}"]`);
    if (connectButton instanceof HTMLButtonElement) {
      connectButton.disabled = !!linked;
    }
    if (disconnectButton instanceof HTMLButtonElement) {
      disconnectButton.disabled = !linked;
    }
  }

  function setPendingEmailStatus(payload) {
    const pendingEmail = payload?.pending_email || "";
    const expiresAt = payload?.email_change_expires_at || payload?.expires_at || "";
    if (pendingEmail) {
      setMessage(
        "[data-account-email-change-status=\"true\"]",
        `Pending verification: ${pendingEmail}${expiresAt ? ` (expires ${expiresAt})` : ""}`,
        "warning"
      );
    }
  }

  function applyAuthMethods(payload) {
    const linked = new Set(Array.isArray(payload?.linked_providers) ? payload.linked_providers : []);
    const passwordStatus = document.querySelector("[data-account-password-status=\"true\"]");
    if (passwordStatus) {
      passwordStatus.textContent = payload?.password_set
        ? "Password is set for this account."
        : "Password is not set. Use OAuth or ask admin to issue a password-set email.";
    }
    ["google", "github", "discord", "x", "twitch", "email"].forEach((provider) => {
      const isLinked = linked.has(provider);
      setProviderButtons(provider, isLinked);
    });
    setPendingEmailStatus(payload);
  }

  async function refreshAuthMethods() {
    const payload = await requestJson(AUTH_METHODS_ENDPOINT, { method: "GET" });
    applyAuthMethods(payload);
    window.StreamSuitesAuth?.markProtectedDataReady?.("account-auth-methods");
    return payload;
  }

  function integrationTone(status) {
    switch (String(status || "").trim().toLowerCase()) {
      case "linked":
        return "success";
      case "pending":
      case "error":
        return "warning";
      default:
        return "subtle";
    }
  }

  function humanizeIntegrationStatus(status) {
    switch (String(status || "").trim().toLowerCase()) {
      case "linked":
        return "Linked";
      case "pending":
        return "Pending";
      case "error":
        return "Needs attention";
      case "not_configured":
        return "Not configured";
      case "unavailable":
        return "Unavailable";
      default:
        return "Unlinked";
    }
  }

  function summarizeIntegration(item) {
    if (!item || typeof item !== "object") {
      return {
        summary: "Authoritative integration state is unavailable.",
        note: "Platform page",
      };
    }
    const deployment = item.deployment && typeof item.deployment === "object" ? item.deployment : {};
    const summaryParts = [];
    if (item.channel_handle) {
      summaryParts.push(item.channel_handle);
    } else if (item.display_label) {
      summaryParts.push(item.display_label);
    }
    if (item.secret_present) {
      summaryParts.push("backend secret stored");
    } else if (item.provider_linked) {
      summaryParts.push("account identity linked");
    }
    if (typeof deployment.enabled_trigger_count === "number") {
      summaryParts.push(`${deployment.enabled_trigger_count} enabled trigger${deployment.enabled_trigger_count === 1 ? "" : "s"}`);
    }
    return {
      summary: summaryParts.join(" · ") || "No safe summary details available yet.",
      note: item.ui_message || "Platform page",
    };
  }

  function countLinkedIntegrations(items) {
    return items.filter((item) => String(item?.status || "").trim().toLowerCase() === "linked").length;
  }

  function listToneItem(text, tone = "subtle") {
    return { text, tone };
  }

  function humanizeTone(tone) {
    switch (String(tone || "").trim().toLowerCase()) {
      case "success":
        return "Ready";
      case "warning":
        return "Attention";
      default:
        return "Info";
    }
  }

  function renderHubList(element, items) {
    if (!(element instanceof HTMLElement)) return;
    element.innerHTML = (items || [])
      .map(
        (item) => `
          <li class="integration-readiness-item">
            <span class="status-pill ${escapeHtml(item.tone || "subtle")}">${escapeHtml(humanizeTone(item.tone))}</span>
            <span>${escapeHtml(item.text || "")}</span>
          </li>
        `,
      )
      .join("");
  }

  function renderHubActions(element, items) {
    if (!(element instanceof HTMLElement)) return;
    element.innerHTML = (items || [])
      .map(
        (item) => `
          <li>
            <a href="${escapeHtml(item.href || "/account")}">${escapeHtml(item.label || "Open page")}</a>
            <span>${escapeHtml(item.text || "")}</span>
          </li>
        `,
      )
      .join("");
  }

  function integrationHasPartialState(item) {
    return !!(item?.provider_linked || item?.secret_present || item?.channel_handle || item?.public_url);
  }

  function renderIntegrationHub(payload) {
    const els = getIntegrationElements();
    const items = Array.isArray(state.integrations) ? state.integrations : [];
    const linkedCount = typeof payload?.linked_count === "number" ? payload.linked_count : countLinkedIntegrations(items);
    const deployable = items.filter((item) => item?.deployment?.can_deploy);
    const limited = items.filter((item) => String(item?.status || "").trim().toLowerCase() === "linked" && !item?.deployment?.can_deploy);
    const partial = items.filter((item) => integrationHasPartialState(item) && String(item?.status || "").trim().toLowerCase() !== "linked");
    const planned = items.filter((item) => !integrationHasPartialState(item) && String(item?.status || "").trim().toLowerCase() !== "linked");
    const creatorCapable = state.profile?.creator_capable === true;
    const enabledTriggerFoundation = items.some((item) => (item?.deployment?.enabled_trigger_count || 0) > 0);
    const triggerCapablePlatforms = items.filter((item) => item?.deployment?.trigger_execution_eligible);

    if (els.summaryNote instanceof HTMLElement) {
      els.summaryNote.textContent = `Runtime/Auth reports ${linkedCount} linked platform integration${linkedCount === 1 ? "" : "s"}, ${deployable.length} deployable platform${deployable.length === 1 ? "" : "s"}, and ${partial.length} partial linkage state${partial.length === 1 ? "" : "s"} on this creator account.`;
    }

    if (els.statLinked) els.statLinked.textContent = String(linkedCount);
    if (els.statDeployable) els.statDeployable.textContent = String(deployable.length);
    if (els.statLimited) els.statLimited.textContent = String(limited.length + partial.length);
    if (els.statPlanned) els.statPlanned.textContent = String(planned.length);

    setStatusPill(
      els.posturePill,
      creatorCapable ? "Creator-capable" : "Posture blocked",
      creatorCapable ? "success" : "warning",
    );
    if (els.postureTitle) {
      els.postureTitle.textContent = creatorCapable ? "Creator account is eligible for creator integrations." : "Creator account posture currently blocks full readiness.";
    }
    if (els.postureSummary) {
      els.postureSummary.textContent = creatorCapable
        ? `Public profile posture is creator-capable and can participate in creator integration readiness checks. User code: ${state.profile?.user_code || "not exported"}.`
        : "Runtime/Auth currently marks this account as not creator-capable, so deploy readiness remains limited even if a platform is linked.";
    }

    setStatusPill(
      els.overviewPill,
      deployable.length ? "Workflow connected" : linkedCount ? "Linked but limited" : "Needs first platform link",
      deployable.length ? "success" : linkedCount ? "warning" : "subtle",
    );
    if (els.overviewSummary) {
      const readyPlatforms = deployable.map((item) => item.platform_key).join(", ");
      els.overviewSummary.textContent = deployable.length
        ? `${deployable.length} platform${deployable.length === 1 ? "" : "s"} currently pass the exported foundation checks: ${readyPlatforms}.`
        : linkedCount
          ? "Some platforms are linked, but missing capability or trigger foundations still block deployment."
          : "No supported platform is linked yet. Start from a dedicated platform page to establish the first truthful connection.";
    }

    const readinessItems = [
      listToneItem(
        creatorCapable ? "Account posture is creator-capable." : "Account posture is not currently creator-capable.",
        creatorCapable ? "success" : "warning",
      ),
      listToneItem(
        linkedCount ? `${linkedCount} supported platform integration${linkedCount === 1 ? "" : "s"} is linked.` : "No supported platform integration is linked yet.",
        linkedCount ? "success" : "warning",
      ),
      listToneItem(
        triggerCapablePlatforms.length
          ? `${triggerCapablePlatforms.length} linked platform${triggerCapablePlatforms.length === 1 ? "" : "s"} exports trigger-capable readiness.`
          : "No linked platform currently exports trigger-capable readiness.",
        triggerCapablePlatforms.length ? "success" : "warning",
      ),
      listToneItem(
        enabledTriggerFoundation ? "Foundational triggers exist and at least one scoped trigger is enabled." : "No enabled foundational trigger currently backs platform readiness.",
        enabledTriggerFoundation ? "success" : "warning",
      ),
      listToneItem(
        deployable.length ? "Bot deployment is truthfully possible for at least one platform." : "No platform is currently deployable from the exported readiness model.",
        deployable.length ? "success" : "subtle",
      ),
    ];
    renderHubList(els.readinessChecklist, readinessItems);

    setStatusPill(
      els.deployPill,
      deployable.length ? "Deployable now" : linkedCount ? "Blocked by readiness gaps" : "No platform link yet",
      deployable.length ? "success" : linkedCount ? "warning" : "subtle",
    );
    if (els.deploySummary) {
      els.deploySummary.textContent = deployable.length
        ? "Open the Discord bot area or the relevant platform page to continue deployment-oriented setup."
        : limited.length || partial.length
          ? "Review limited or partial platform pages and foundational triggers to clear the current blockers."
          : "Start by linking a platform or storing required secure credentials where the current backend supports it.";
    }

    const nextActions = [];
    if (!creatorCapable) {
      nextActions.push({
        href: "/account",
        label: "Review account posture",
        text: "Creator eligibility is currently blocking full readiness.",
      });
    }
    if (!linkedCount) {
      nextActions.push({
        href: "/integrations/rumble",
        label: "Link a platform",
        text: "Rumble currently exposes the clearest creator-managed secure linkage path.",
      });
    }
    if (partial.length) {
      nextActions.push({
        href: `/integrations/${partial[0].platform_key}`,
        label: `Finish ${partial[0].platform_key} setup`,
        text: "A partial linkage state exists but is not yet operational.",
      });
    }
    if (!enabledTriggerFoundation) {
      nextActions.push({
        href: "/triggers",
        label: "Enable foundational triggers",
        text: "At least one scoped foundational trigger should be enabled before deployment.",
      });
    }
    if (deployable.length) {
      nextActions.push({
        href: "/integrations/discord",
        label: "Continue bot deployment",
        text: "A platform already passes the exported readiness model, so the next step is bot-side setup.",
      });
    }
    if (!nextActions.length) {
      nextActions.push({
        href: "/account",
        label: "Review integration hub",
        text: "No urgent blocker is exported right now. Monitor platform detail pages for changes.",
      });
    }

    setStatusPill(
      els.nextPill,
      deployable.length ? "Deployment path available" : nextActions.length ? "Action recommended" : "Monitoring",
      deployable.length ? "success" : "warning",
    );
    if (els.nextSummary) {
      els.nextSummary.textContent = deployable.length
        ? "At least one path is ready enough to move into bot deployment and ongoing monitoring."
        : "The current next step is to clear the highest-signal blocker surfaced by runtime/Auth.";
    }
    renderHubActions(els.nextActions, nextActions);
  }

  function renderCreatorIntegrations(payload) {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.integrations = items;
    INTEGRATION_KEYS.forEach((key) => {
      const item = items.find((entry) => entry?.platform_key === key) || null;
      const statusEl = document.querySelector(`[data-integration-status="${key}"]`);
      const summaryEl = document.querySelector(`[data-integration-summary="${key}"]`);
      const noteEl = document.querySelector(`[data-integration-note="${key}"]`);
      if (statusEl instanceof HTMLElement) {
        setStatusPill(statusEl, humanizeIntegrationStatus(item?.status), integrationTone(item?.status));
      }
      const content = summarizeIntegration(item);
      if (summaryEl instanceof HTMLElement) {
        summaryEl.textContent = content.summary;
      }
      if (noteEl instanceof HTMLElement) {
        noteEl.textContent = content.note;
      }
    });
    const els = getIntegrationElements();
    renderIntegrationHub(payload);
    syncAccountShellMetrics();
  }

  async function loadCreatorIntegrations() {
    const payload = await requestJson(CREATOR_INTEGRATIONS_ENDPOINT, { method: "GET" });
    renderCreatorIntegrations(payload);
    window.StreamSuitesAuth?.markProtectedDataReady?.("account-creator-integrations");
    return payload;
  }

  function wireProviderButtons() {
    document.querySelectorAll("[data-account-provider-connect]").forEach((button) => {
      if (button.dataset.accountSettingsWired === "true") {
        return;
      }
      button.dataset.accountSettingsWired = "true";
      button.addEventListener("click", () => {
        const provider = button.getAttribute("data-account-provider-connect") || "";
        if (!provider) return;
        window.location.assign(oauthStartUrl(provider));
      });
    });

    document.querySelectorAll("[data-account-provider-disconnect]").forEach((button) => {
      if (button.dataset.accountSettingsWired === "true") {
        return;
      }
      button.dataset.accountSettingsWired = "true";
      button.addEventListener("click", async () => {
        const provider = button.getAttribute("data-account-provider-disconnect") || "";
        if (!provider) return;
        try {
          const payload = await requestJson(AUTH_UNLINK_ENDPOINT, {
            method: "POST",
            body: JSON.stringify({ provider }),
          });
          applyAuthMethods(payload);
          setMessage("[data-account-provider-status-message=\"true\"]", `Disconnected ${provider}.`, "success");
        } catch (err) {
          setMessage(
            "[data-account-provider-status-message=\"true\"]",
            err?.message || `Unable to disconnect ${provider}.`,
            "danger"
          );
        }
      });
    });
  }

  function wireEmailChange() {
    const input = document.querySelector("[data-account-email-change-input=\"true\"]");
    const button = document.querySelector("[data-account-email-change-request=\"true\"]");
    if (!(input instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) {
      return;
    }
    if (button.dataset.accountSettingsWired === "true") {
      return;
    }
    button.dataset.accountSettingsWired = "true";
    button.addEventListener("click", async () => {
      const newEmail = String(input.value || "").trim().toLowerCase();
      if (!newEmail) {
        setMessage("[data-account-email-change-status=\"true\"]", "Enter a new email address.", "danger");
        return;
      }
      button.disabled = true;
      setMessage("[data-account-email-change-status=\"true\"]", "Sending verification email...", "neutral");
      try {
        const payload = await requestJson(EMAIL_CHANGE_REQUEST_ENDPOINT, {
          method: "POST",
          body: JSON.stringify({ new_email: newEmail }),
        });
        setPendingEmailStatus(payload);
        await refreshAuthMethods();
      } catch (err) {
        setMessage(
          "[data-account-email-change-status=\"true\"]",
          err?.message || "Unable to send verification email.",
          "danger"
        );
      } finally {
        button.disabled = false;
      }
    });
  }

  function normalizePublicSlug(value) {
    const raw = String(value || "").normalize("NFKD");
    const asciiValue = raw.replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const cleaned = [];
    for (const char of asciiValue) {
      if ((char >= "a" && char <= "z") || (char >= "0" && char <= "9")) {
        cleaned.push(char);
        continue;
      }
      if (char === "-" || char === "_") {
        cleaned.push(char);
      }
    }
    return cleaned.join("").replace(/^[-_]+|[-_]+$/g, "").replace(/[-_]{2,}/g, (match) => match[0]);
  }

  function validatePublicSlug(value) {
    const normalized = normalizePublicSlug(value);
    if (!normalized) {
      return { valid: false, reason: "public_slug_empty", normalized };
    }
    if (normalized.length > 64) {
      return { valid: false, reason: "public_slug_too_long", normalized };
    }
    if (RESERVED_PUBLIC_SLUGS.has(normalized)) {
      return { valid: false, reason: "public_slug_reserved", normalized };
    }
    return { valid: true, reason: null, normalized };
  }

  function humanizeSurfaceReason(reason) {
    switch (String(reason || "").trim().toLowerCase()) {
      case "visible":
        return "Visible on the saved canonical profile.";
      case "disabled_by_account":
        return "Saved as disabled in the authoritative account profile.";
      case "missing_public_slug":
        return "Needs a saved canonical slug before the surface can go live.";
      case "creator_capable_required":
        return "Requires creator-capable eligibility from the backend account role.";
      default:
        return "Status comes directly from the authoritative backend profile export.";
    }
  }

  function humanizeSlugReason(reason) {
    switch (reason) {
      case "public_slug_empty":
        return "Enter a canonical slug to make public profile URLs possible.";
      case "public_slug_too_long":
        return "Canonical slugs are limited to 64 characters.";
      case "public_slug_reserved":
        return "That slug is reserved by the authoritative backend and cannot be used.";
      default:
        return "Slug feedback mirrors the authoritative validation rules where the current API exposes them.";
    }
  }

  function cloneProfile(profile) {
    return JSON.parse(JSON.stringify(profile || {}));
  }

  function normalizeProfilePayload(payload) {
    const profile = payload?.profile && typeof payload.profile === "object" ? payload.profile : payload;
    return {
      public_slug: coerceText(profile?.public_slug || profile?.slug),
      slug_aliases: Array.isArray(profile?.slug_aliases) ? profile.slug_aliases.map((item) => coerceText(item)).filter(Boolean) : [],
      user_code: coerceText(profile?.user_code),
      display_name: coerceText(profile?.display_name),
      avatar_url: coerceText(profile?.avatar_url),
      avatar_media: profile?.avatar_media && typeof profile.avatar_media === "object" ? { ...profile.avatar_media } : null,
      creator_capable: profile?.creator_capable === true,
      public_surface_account_type: coerceText(profile?.public_surface_account_type),
      streamsuites_profile_enabled: profile?.streamsuites_profile_enabled !== false,
      streamsuites_profile_visible: profile?.streamsuites_profile_visible === true,
      streamsuites_profile_url: coerceText(profile?.streamsuites_profile_url),
      streamsuites_share_url: coerceText(profile?.streamsuites_share_url),
      streamsuites_profile_status_reason: coerceText(profile?.streamsuites_profile_status_reason),
      findmehere_enabled: profile?.findmehere_enabled !== false,
      findmehere_eligible: profile?.findmehere_eligible === true,
      findmehere_visible: profile?.findmehere_visible === true,
      findmehere_profile_url: coerceText(profile?.findmehere_profile_url),
      findmehere_share_url: coerceText(profile?.findmehere_share_url),
      findmehere_status_reason: coerceText(profile?.findmehere_status_reason),
      cover_image_url: coerceText(profile?.cover_image_url || profile?.banner_image_url),
      cover_media: profile?.cover_media && typeof profile.cover_media === "object" ? { ...profile.cover_media } : null,
      background_image_url: coerceText(profile?.background_image_url),
      findmehere_theme: normalizeFindmeTheme(profile?.findmehere_theme || profile?.findMeHereTheme || profile?.profile_theme || profile?.profileTheme),
      bio: coerceText(profile?.bio),
      social_links: profile?.social_links && typeof profile.social_links === "object" ? { ...profile.social_links } : {},
      custom_links: normalizeCustomLinks(profile?.custom_links || profile?.customLinks),
      badges: Array.isArray(profile?.badges) ? profile.badges : [],
      findmehere_badges: Array.isArray(profile?.findmehere_badges || profile?.findmehereBadges) ? (profile?.findmehere_badges || profile?.findmehereBadges) : [],
      badge_state: profile?.badge_state && typeof profile.badge_state === "object" ? profile.badge_state : {},
      paymentSummary: normalizePaymentSummary(profile?.payment_summary || profile?.paymentSummary),
    };
  }

  function setProfileBusy(busy) {
    const els = getProfileElements();
    els.profileFields.forEach((field) => {
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        const locked = field.dataset.lockDisabled === "true";
        field.disabled = busy || locked;
      }
    });
    els.saveButtons.forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.disabled = busy || !state.profile;
      }
    });
    els.resetButtons.forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.disabled = busy || !state.profile;
      }
    });
    els.copyButtons.forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.disabled = busy || !state.profile;
      }
    });
    els.badgeGovernanceSaveButtons.forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.disabled = busy || !state.profile;
      }
    });
    els.identityInputs.forEach((field) => {
      if (field instanceof HTMLInputElement) {
        field.disabled = busy || !state.profile;
      }
    });
    if (els.avatarFileInput instanceof HTMLInputElement) {
      els.avatarFileInput.disabled = busy || !state.profile;
    }
    if (els.coverFileInput instanceof HTMLInputElement) {
      els.coverFileInput.disabled = busy || !state.profile;
    }
    if (els.backgroundFileInput instanceof HTMLInputElement) {
      els.backgroundFileInput.disabled = busy || !state.profile;
    }
    if (els.findmeThemeLogoFileInput instanceof HTMLInputElement) {
      els.findmeThemeLogoFileInput.disabled = busy || !state.profile;
    }
    if (els.avatarClearButton instanceof HTMLButtonElement) {
      els.avatarClearButton.disabled = busy || !state.profile;
    }
    if (els.coverClearButton instanceof HTMLButtonElement) {
      els.coverClearButton.disabled = busy || !state.profile;
    }
    if (els.backgroundClearButton instanceof HTMLButtonElement) {
      els.backgroundClearButton.disabled = busy || !state.profile;
    }
    if (els.findmeThemeLogoClearButton instanceof HTMLButtonElement) {
      els.findmeThemeLogoClearButton.disabled = busy || !state.profile;
    }
    els.findmeThemeLogoSourceButtons.forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.disabled = busy || !state.profile;
      }
    });
    if (els.findmeThemeAccentColorPickerInput instanceof HTMLInputElement) {
      els.findmeThemeAccentColorPickerInput.disabled = busy || !state.profile;
    }
    if (els.findmeThemeButtonColorPickerInput instanceof HTMLInputElement) {
      els.findmeThemeButtonColorPickerInput.disabled = busy || !state.profile;
    }
    renderCustomLinksEditor();
  }

  function setStatusPill(element, text, tone) {
    if (!(element instanceof HTMLElement)) return;
    element.classList.remove("success", "subtle", "warning");
    element.classList.add(tone || "subtle");
    const dot = element.querySelector(".status-dot");
    element.textContent = text;
    if (dot) {
      element.prepend(dot);
    }
  }

  function getActiveSession() {
    return window.App?.session && typeof window.App.session === "object" ? window.App.session : {};
  }

  function formatBillingDate(value, fallback = "Not scheduled") {
    const normalized = coerceText(value);
    if (!normalized) return fallback;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return normalized;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatCurrencyCents(cents, currency, fallback = "—") {
    const parsed = Number(cents);
    if (!Number.isFinite(parsed)) return fallback;
    const amount = parsed / 100;
    const currencyCode = (coerceText(currency) || "USD").toUpperCase();
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (_err) {
      return `${currencyCode} ${amount.toFixed(2)}`.trim();
    }
  }

  function humanizeStatusToken(value, fallback = "Unavailable") {
    const normalized = coerceText(value).replace(/_/g, " ").trim();
    if (!normalized) return fallback;
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function describeSupporterState(summary) {
    const source = coerceText(summary?.supporterSource).toLowerCase();
    if (source === "subscription_and_donation") return "Subscription + donation";
    if (source === "subscription") return "Subscription supporter";
    if (source === "donation") return "One-off supporter";
    return "No supporter history";
  }

  function describeRecurringState(summary) {
    const status = coerceText(summary?.recurringStatus).toLowerCase();
    if (!status || status === "not_tracked") return "No recurring renewal tracked";
    if (status === "active") return "Active recurring billing";
    if (status === "trialing") return "Trialing recurring billing";
    return humanizeStatusToken(status, "No recurring renewal tracked");
  }

  function formatDiscountValue(discount) {
    if (!discount || typeof discount !== "object") return "Discount";
    const type = coerceText(discount.discount_type || discount.discountType || discount.type).toLowerCase();
    const value = Number(discount.discount_value ?? discount.discountValue ?? discount.value);
    if (!Number.isFinite(value) || value <= 0) return "Discount";
    if (type === "percent") return `${value}% off`;
    return formatCurrencyCents(value, discount.currency, "Discount");
  }

  function paymentSummaryForView() {
    const profileSummary = normalizePaymentSummary(state.profile?.paymentSummary || state.profile?.payment_summary);
    const sessionSummary = normalizePaymentSummary(getActiveSession()?.paymentSummary || getActiveSession()?.payment_summary);
    return profileSummary || sessionSummary || normalizePaymentSummary({});
  }

  function billingFeatureEntries(summary, session) {
    const features =
      session?.features && typeof session.features === "object" && Object.keys(session.features).length
        ? session.features
        : summary?.planFeatures && typeof summary.planFeatures === "object"
        ? summary.planFeatures
        : {};
    const entries = [];
    const triggers = features.triggers && typeof features.triggers === "object" ? features.triggers : {};
    const clips = features.clips && typeof features.clips === "object" ? features.clips : {};
    const polls = features.polls && typeof features.polls === "object" ? features.polls : {};
    const automation = features.automation && typeof features.automation === "object" ? features.automation : {};
    const branding = features.branding && typeof features.branding === "object" ? features.branding : {};
    const backups = features.backups && typeof features.backups === "object" ? features.backups : {};

    if (Number.isFinite(Number(triggers.max_triggers))) {
      entries.push(`Up to ${Number(triggers.max_triggers)} trigger commands`);
    }
    if (Number.isFinite(Number(clips.max_duration_seconds))) {
      entries.push(`${Number(clips.max_duration_seconds)}s max clip duration`);
    }
    if (Number.isFinite(Number(clips.max_concurrent_jobs))) {
      entries.push(`${Number(clips.max_concurrent_jobs)} concurrent clip job${Number(clips.max_concurrent_jobs) === 1 ? "" : "s"}`);
    }
    if (Number.isFinite(Number(polls.max_active_polls))) {
      entries.push(`${Number(polls.max_active_polls)} active poll${Number(polls.max_active_polls) === 1 ? "" : "s"}`);
    }
    entries.push(automation.enabled ? "Automation features enabled" : "Automation features not enabled");
    entries.push(branding.custom_bot_identity ? "Custom bot identity available" : "Shared bot identity");
    if (backups.automated_backups) {
      const intervalHours = Number(backups.backup_interval_hours || 0);
      entries.push(intervalHours > 0 ? `Automated backups every ${intervalHours}h` : "Automated backups enabled");
    } else if (backups.manual_export) {
      entries.push("Manual export available");
    }
    return entries.filter(Boolean).slice(0, 7);
  }

  function renderBillingSection() {
    const card = document.querySelector(".account-billing-card");
    if (!(card instanceof HTMLElement)) return;
    const planNameEl = card.querySelector("[data-billing-plan-name=\"true\"]");
    const planSummaryEl = card.querySelector("[data-billing-plan-summary=\"true\"]");
    const statusPill = card.querySelector("[data-billing-status-pill=\"true\"]");
    const heroStatsEl = card.querySelector("[data-billing-hero-stats=\"true\"]");
    const kpisEl = card.querySelector("[data-billing-kpis=\"true\"]");
    const paymentGridEl = card.querySelector("[data-billing-payment-grid=\"true\"]");
    const supporterPill = card.querySelector("[data-billing-supporter-pill=\"true\"]");
    const featuresPill = card.querySelector("[data-billing-features-pill=\"true\"]");
    const featureListEl = card.querySelector("[data-billing-feature-list=\"true\"]");
    const featureNoteEl = card.querySelector("[data-billing-feature-note=\"true\"]");
    const footnoteEl = card.querySelector("[data-billing-footnote=\"true\"]");
    const session = getActiveSession();
    const summary = paymentSummaryForView();
    const effectiveTier = session?.effectiveTier || {};
    const tierLabel = summary?.planName || coerceText(effectiveTier.tierLabel) || coerceText(session?.tier) || "Core Tier";
    const planStatus = humanizeStatusToken(summary?.planStatus, "Active");
    const recurringState = describeRecurringState(summary);
    const supporterState = describeSupporterState(summary);
    const lifetimePaid = formatCurrencyCents(summary?.lifetimeTotalPaidCents, summary?.currency, "No payments yet");
    const lastPaymentAmount = formatCurrencyCents(summary?.lastPaymentAmountCents, summary?.currency, "Not captured");
    const lastPaymentDate = formatBillingDate(summary?.lastPaymentAt, "No payment recorded");
    const nextDue = formatBillingDate(summary?.nextDueAt, "Not scheduled");
    const donationTotal = formatCurrencyCents(summary?.donationTotalPaidCents, summary?.currency, "No donation history");
    const balanceRelief = formatCurrencyCents(summary?.balanceReliefTotalCents, summary?.currency, "No adjustments");
    const featureEntries = billingFeatureEntries(summary, session);
    const activeDiscountSummary = Array.isArray(summary?.activeDiscounts) && summary.activeDiscounts.length
      ? summary.activeDiscounts
          .slice(0, 3)
          .map((item) => {
            const code = coerceText(item.code).toUpperCase();
            const label = formatDiscountValue(item);
            return code ? `${code} (${label})` : label;
          })
          .join(" · ")
      : "No active discounts";
    const grantSummary = summary?.isAdminGrantedTier
      ? summary?.adminGrantIsLifetime
        ? "Admin-granted lifetime access"
        : summary?.adminGrantExpiresAt
        ? `Admin-granted access until ${formatBillingDate(summary.adminGrantExpiresAt, "scheduled expiry")}`
        : "Admin-granted timed access"
      : "Account tier contract";

    if (planNameEl instanceof HTMLElement) {
      planNameEl.textContent = tierLabel;
    }
    if (planSummaryEl instanceof HTMLElement) {
      planSummaryEl.textContent =
        summary?.isAdminGrantedTier
          ? `${tierLabel} is currently admin-granted. ${grantSummary}. ${activeDiscountSummary}.`
          : summary?.hasAnyPayment
          ? `${planStatus} account. ${supporterState}. ${recurringState}.`
          : `${planStatus} account. No recorded payments yet. ${recurringState}.`;
    }
    setStatusPill(
      statusPill,
      summary?.isAdminGrantedTier ? "Gifted plan" : summary?.hasAnyPayment ? planStatus : "No payments yet",
      summary?.isAdminGrantedTier || summary?.hasAnyPayment ? "success" : "warning"
    );
    setStatusPill(
      supporterPill,
      summary?.isSupporter ? supporterState : "No supporter history",
      summary?.isSupporter ? "success" : "warning"
    );
    setStatusPill(featuresPill, humanizeStatusToken(summary?.planTier || effectiveTier?.tierId || session?.tier || "core"), "subtle");

    if (heroStatsEl instanceof HTMLElement) {
      heroStatsEl.innerHTML = [
        { label: "Status", value: planStatus },
        { label: "Next due", value: nextDue },
        { label: "Supporter", value: supporterState },
      ].map((item) => `
        <div class="account-billing-inline-stat">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `).join("");
    }

    if (kpisEl instanceof HTMLElement) {
      kpisEl.innerHTML = [
        {
          label: "Lifetime paid",
          value: lifetimePaid,
          note: summary?.hasAnyPayment ? "All recorded payments" : "No payment history"
        },
        {
          label: "Last payment",
          value: lastPaymentAmount,
          note: lastPaymentDate
        },
        {
          label: "Entitlement",
          value: grantSummary,
          note: summary?.isAdminGrantedTier ? "Admin-controlled entitlement" : recurringState
        },
        {
          label: "Discounts / relief",
          value: summary?.hasDiscount ? activeDiscountSummary : balanceRelief,
          note: summary?.hasDiscount
            ? "Authoritative discount state"
            : summary?.balanceReliefTotalCents
            ? "Credits and write-offs exported"
            : "No discount or balance relief exported"
        },
      ].map((item) => `
        <article class="account-billing-kpi-card">
          <span class="label">${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <span>${escapeHtml(item.note)}</span>
        </article>
      `).join("");
    }

    if (paymentGridEl instanceof HTMLElement) {
      paymentGridEl.innerHTML = [
        { label: "Current plan", value: tierLabel },
        { label: "Recurring state", value: recurringState },
        { label: "Lifetime total", value: lifetimePaid },
        { label: "Last payment", value: `${lastPaymentAmount} · ${lastPaymentDate}` },
        { label: "Supporter / donations", value: `${supporterState} · ${donationTotal}` },
        { label: "Entitlement source", value: grantSummary },
        { label: "Discounts / credits", value: `${activeDiscountSummary} · ${balanceRelief}` },
      ].map((item) => `
        <div class="account-billing-meta-item">
          <span class="label">${escapeHtml(item.label)}</span>
          <span class="value">${escapeHtml(item.value)}</span>
        </div>
      `).join("");
    }

    if (featureListEl instanceof HTMLElement) {
      featureListEl.innerHTML = featureEntries.length
        ? featureEntries.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
        : "<li>Your current tier does not expose additional entitlement detail yet.</li>";
    }
    if (featureNoteEl instanceof HTMLElement) {
      featureNoteEl.textContent = summary?.isAdminGrantedTier
        ? "This plan is currently granted through the authoritative StreamSuites admin billing system."
        : summary?.hasActiveSubscription
        ? "Renewal-linked access is shown only when the backend tracks it."
        : "The current creator surface stays grounded in the active tier contract and only shows backend-exposed billing detail.";
    }
    if (footnoteEl instanceof HTMLElement) {
      footnoteEl.textContent = summary?.isAdminGrantedTier
        ? "Internal admin audit reasons stay private. This view only shows the safe account-level billing result."
        : summary?.recurringStatus === "not_tracked"
        ? "Recurring renewal schedules and billing-management actions are still hidden until the backend exposes a real recurring billing contract."
        : "Recurring renewal information is shown only from the backend-owned summary contract.";
    }
    syncAccountShellMetrics();
  }

  function getBadgeSurfaceCatalog(source) {
    const surfaceCatalog = source?.surface_catalog;
    if (Array.isArray(surfaceCatalog) && surfaceCatalog.length) {
      return surfaceCatalog
        .map((entry) => ({
          key: coerceText(entry?.key),
          label: coerceText(entry?.label || entry?.key)
        }))
        .filter((entry) => entry.key && !HIDDEN_BADGE_GOVERNANCE_SURFACES.has(entry.key));
    }
    return [
      { key: "streamsuites_profile", label: "SS Profile" },
      { key: "findmehere_profile", label: "FMH Profile" },
      { key: "profile_card", label: "Profile Cards" },
      { key: "user_widget", label: "User Widget" },
    ];
  }

  function renderVisibilityGlyph(visible, label) {
    return `
      <span class="badge-governance-state${visible ? " is-visible" : " is-hidden"}" title="${escapeHtml(label)}">
        <span class="badge-governance-glyph${visible ? " is-visible" : " is-hidden"}" aria-hidden="true"></span>
        <span class="badge-governance-state-text">${escapeHtml(visible ? "Visible" : "Hidden")}</span>
      </span>
    `;
  }

  function renderBadgeGovernanceSection() {
    const els = getProfileElements();
    if (!(els.badgeGovernanceMatrix instanceof HTMLElement)) return;
    const badgeState = state.profile?.badge_state && typeof state.profile.badge_state === "object" ? state.profile.badge_state : {};
    const applicable = Array.isArray(badgeState.applicable) ? badgeState.applicable : [];
    const surfaceCatalog = getBadgeSurfaceCatalog(badgeState);
    const governedKeys = applicable.map((item) => coerceText(item?.key || item?.value).toLowerCase()).filter(Boolean);
    if (els.badgeGovernanceStatusPill) {
      setStatusPill(
        els.badgeGovernanceStatusPill,
        governedKeys.length ? "Policy loaded" : "No badges",
        governedKeys.length ? "success" : "subtle"
      );
    }
    if (els.badgeGovernanceSummary instanceof HTMLElement) {
      els.badgeGovernanceSummary.textContent = governedKeys.length
        ? "Editable checkboxes control your own per-surface preference. Locked cells are disabled by admin or global policy."
        : "No account badges are currently governed for this profile.";
    }
    if (!governedKeys.length) {
      els.badgeGovernanceMatrix.innerHTML = '<p class="account-note">No governed badges are currently available for this account.</p>';
      return;
    }
    const sortedKeys = [...new Set(governedKeys)]
      .sort((left, right) => {
        const leftIndex = BADGE_ORDER.indexOf(left);
        const rightIndex = BADGE_ORDER.indexOf(right);
        return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
      });
    const visibleCellCount = sortedKeys.reduce((count, key) => {
      const row = applicable.find((item) => coerceText(item?.key || item?.value).toLowerCase() === key);
      const surfaces = row?.surfaces && typeof row.surfaces === "object" ? row.surfaces : {};
      return count + surfaceCatalog.filter((surface) => surfaces[surface.key]?.visible === true).length;
    }, 0);
    const rows = [...applicable]
      .sort((left, right) => {
        const leftKey = coerceText(left?.key || left?.value).toLowerCase();
        const rightKey = coerceText(right?.key || right?.value).toLowerCase();
        const leftIndex = BADGE_ORDER.indexOf(leftKey);
        const rightIndex = BADGE_ORDER.indexOf(rightKey);
        return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
      })
      .map((row) => {
        const badgeKey = coerceText(row?.key || row?.value).toLowerCase();
        const surfaces = row?.surfaces && typeof row.surfaces === "object" ? row.surfaces : {};
        const cells = surfaceCatalog.map((surface) => {
          const cell = surfaces[surface.key] && typeof surfaces[surface.key] === "object" ? surfaces[surface.key] : null;
          if (!cell || cell.supported === false) {
            return '<td class="badge-governance-cell is-unsupported"><span class="badge-governance-empty">—</span></td>';
          }
          const locked = cell.locked === true;
          const checked = cell.visible === true;
          const note = locked
            ? "Locked by admin/global policy"
            : checked
            ? "Visible"
            : "Hidden by your preference";
          return `
            <td class="badge-governance-cell${locked ? " is-locked" : ""}">
              <label class="badge-governance-cell-stack">
                ${renderVisibilityGlyph(checked, note)}
                <input
                  type="checkbox"
                  class="badge-governance-checkbox-input"
                  data-badge-preference-key="${escapeHtml(badgeKey)}"
                  data-badge-preference-surface="${escapeHtml(surface.key)}"
                  ${checked ? "checked" : ""}
                  ${locked ? "disabled" : ""}
                />
                <span class="badge-governance-cell-note">${escapeHtml(note)}</span>
              </label>
            </td>
          `;
        }).join("");
        return `
          <tr>
            <th scope="row" class="badge-governance-row-label">${renderBadgeChoiceLabel(badgeKey)}</th>
            ${cells}
          </tr>
        `;
      })
      .join("");
    els.badgeGovernanceMatrix.innerHTML = `
      <div class="badge-governance-creator-grid">
        <div class="account-billing-panel badge-governance-summary-card">
          <div class="badge-governance-card-head">
            <div>
              <h4>Effective badges</h4>
              <p class="account-note">Live icons and cell counts from the authoritative runtime badge state.</p>
            </div>
            <span class="status-pill subtle">${escapeHtml(String(visibleCellCount || 0))} visible cells</span>
          </div>
          <div class="badge-governance-icon-strip">${renderBadgeIconStrip(state.profile?.badges, "No effective badge icons")}</div>
        </div>
        <div class="account-billing-panel badge-governance-matrix-card">
          <div class="badge-governance-card-head">
            <div>
              <h4>Your badge matrix</h4>
              <p class="account-note">Only supported surfaces remain visible here. Locked cells continue to reflect admin/global policy.</p>
            </div>
            <span class="status-pill subtle">${escapeHtml(String(surfaceCatalog.length || 0))} surfaces</span>
          </div>
          <div class="badge-governance-table-scroll">
            <table class="badge-governance-table">
              <thead>
                <tr>
                  <th>Badge</th>
                  ${surfaceCatalog.map((surface) => `<th>${escapeHtml(surface.label)}</th>`).join("")}
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  async function saveBadgeGovernanceSection() {
    if (!state.profile || state.savingProfile) return;
    const payload = { badge_preferences: {} };
    document.querySelectorAll("[data-badge-preference-key][data-badge-preference-surface]").forEach((input) => {
      if (!(input instanceof HTMLInputElement) || input.disabled) return;
      const key = coerceText(input.getAttribute("data-badge-preference-key")).toLowerCase();
      const surface = coerceText(input.getAttribute("data-badge-preference-surface")).toLowerCase();
      if (!key || !surface) return;
      if (!payload.badge_preferences[key] || typeof payload.badge_preferences[key] !== "object") {
        payload.badge_preferences[key] = {};
      }
      payload.badge_preferences[key][surface] = input.checked;
    });
    state.savingProfile = true;
    setProfileBusy(true);
    setMessage("[data-profile-save-status=\"true\"]", "Saving badge preferences...", "neutral");
    try {
      const response = await requestJson(PUBLIC_PROFILE_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      applyProfile(response?.profile || response);
      if (window.StreamSuitesAuth?.loadSession) {
        try {
          await window.StreamSuitesAuth.loadSession({ force: true });
          await window.StreamSuitesAuth.refreshSummary?.();
        } catch (_sessionError) {
          // Keep the saved profile state even if session refresh lags.
        }
      }
      setMessage("[data-profile-save-status=\"true\"]", "");
      showToast("Badge preferences saved.", "success", {
        key: "creator-badge-governance-save",
        title: "Saved",
      });
    } catch (err) {
      showToast(err?.message || "Unable to save badge preferences.", "danger", {
        key: "creator-badge-governance-save",
        title: "Save failed",
      });
      setMessage("[data-profile-save-status=\"true\"]", err?.message || "Unable to save badge preferences.", "warning");
    } finally {
      state.savingProfile = false;
      setProfileBusy(state.loadingProfile);
    }
  }

  function getStagedUpload(kind) {
    return state.uploads && Object.prototype.hasOwnProperty.call(state.uploads, kind)
      ? state.uploads[kind]
      : null;
  }

  function clearStagedUpload(kind, options = {}) {
    if (!state.uploads || !Object.prototype.hasOwnProperty.call(state.uploads, kind)) return;
    const existing = state.uploads[kind];
    if (existing?.previewUrl) {
      URL.revokeObjectURL(existing.previewUrl);
    }
    state.uploads[kind] = null;
    const els = getProfileElements();
    if (kind === "avatar" && !options.preserveInput && els.avatarFileInput instanceof HTMLInputElement) {
      els.avatarFileInput.value = "";
    }
    if (kind === "cover" && !options.preserveInput && els.coverFileInput instanceof HTMLInputElement) {
      els.coverFileInput.value = "";
    }
    if (kind === "background" && !options.preserveInput && els.backgroundFileInput instanceof HTMLInputElement) {
      els.backgroundFileInput.value = "";
    }
    if (kind === "logo" && !options.preserveInput && els.findmeThemeLogoFileInput instanceof HTMLInputElement) {
      els.findmeThemeLogoFileInput.value = "";
    }
  }

  function resolveAvatarDraftValue() {
    const draftUpload = getStagedUpload("avatar");
    if (draftUpload?.previewUrl) return draftUpload.previewUrl;
    const input = getProfileElements().avatarUrlInput;
    if (input instanceof HTMLInputElement) {
      return coerceText(input.value);
    }
    return coerceText(state.profile?.avatar_url);
  }

  function resolveCoverDraftValue() {
    const draftUpload = getStagedUpload("cover");
    if (draftUpload?.previewUrl) return draftUpload.previewUrl;
    const input = getProfileElements().coverImageInput;
    if (input instanceof HTMLInputElement) {
      return coerceText(input.value);
    }
    return coerceText(state.profile?.cover_image_url);
  }

  function resolveBackgroundDraftValue() {
    const draftUpload = getStagedUpload("background");
    if (draftUpload?.previewUrl) return draftUpload.previewUrl;
    const input = getProfileElements().backgroundImageInput;
    if (input instanceof HTMLInputElement) {
      return coerceText(input.value);
    }
    return coerceText(state.profile?.background_image_url);
  }

  function resolveFindmeLogoDraftValue() {
    const draftUpload = getStagedUpload("logo");
    if (draftUpload?.previewUrl) return draftUpload.previewUrl;
    const input = getProfileElements().findmeThemeLogoInput;
    if (input instanceof HTMLInputElement) {
      return coerceText(input.value);
    }
    return coerceText(state.profile?.findmehere_theme?.header_branding?.logo_image_url);
  }

  function syncColorInputs(textInput, pickerInput, fallback) {
    if (!(textInput instanceof HTMLInputElement) || !(pickerInput instanceof HTMLInputElement)) return;
    const normalized = normalizeThemeColor(textInput.value);
    textInput.setCustomValidity(coerceText(textInput.value) && !normalized ? "Enter a valid hex color like #6ad6ff." : "");
    pickerInput.value = expandHexColor(normalized || pickerInput.value, fallback);
  }

  function applyPreviewMode() {
    const els = getProfileElements();
    if (els.previewHub instanceof HTMLElement) {
      els.previewHub.dataset.previewMode = state.previewMode;
    }
    els.previewPanels.forEach((panel) => {
      if (!(panel instanceof HTMLElement)) return;
      const active = panel.getAttribute("data-preview-panel") === state.previewMode;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    els.previewModeButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const active = button.getAttribute("data-profile-preview-mode") === state.previewMode;
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.classList.toggle("is-active", active);
    });
  }

  function renderMediaUploadStatus() {
    const els = getProfileElements();
    const avatarUpload = getStagedUpload("avatar");
    if (els.avatarUploadStatus instanceof HTMLElement) {
      if (avatarUpload?.filename) {
        els.avatarUploadStatus.textContent = `Staged upload: ${avatarUpload.filename} (${Math.round((avatarUpload.size || 0) / 1024)} KB). Save profile changes to upload it through the runtime.`;
        els.avatarUploadStatus.dataset.tone = "success";
      } else if (els.avatarUrlInput instanceof HTMLInputElement && !coerceText(els.avatarUrlInput.value) && coerceText(state.profile?.avatar_url)) {
        els.avatarUploadStatus.textContent = "Avatar removal is staged. Save profile changes to clear the authoritative media reference.";
        els.avatarUploadStatus.dataset.tone = "warning";
      } else if (state.profile?.avatar_media?.asset_key) {
        els.avatarUploadStatus.textContent = `Saved uploaded avatar: ${coerceText(state.profile.avatar_media.asset_key)}`;
        els.avatarUploadStatus.dataset.tone = "neutral";
      } else {
        els.avatarUploadStatus.textContent = "Upload from device is the default avatar update path. Manual URL entry stays available below.";
        els.avatarUploadStatus.dataset.tone = "neutral";
      }
    }
    const coverUpload = getStagedUpload("cover");
    if (els.coverUploadStatus instanceof HTMLElement) {
      if (coverUpload?.filename) {
        els.coverUploadStatus.textContent = `Staged upload: ${coverUpload.filename} (${Math.round((coverUpload.size || 0) / 1024)} KB). Save profile changes to upload it through the runtime.`;
        els.coverUploadStatus.dataset.tone = "success";
      } else if (els.coverImageInput instanceof HTMLInputElement && !coerceText(els.coverImageInput.value) && coerceText(state.profile?.cover_image_url)) {
        els.coverUploadStatus.textContent = "Cover removal is staged. Save profile changes to clear the authoritative media reference.";
        els.coverUploadStatus.dataset.tone = "warning";
      } else if (state.profile?.cover_media?.asset_key) {
        els.coverUploadStatus.textContent = `Saved uploaded cover: ${coerceText(state.profile.cover_media.asset_key)}`;
        els.coverUploadStatus.dataset.tone = "neutral";
      } else {
        els.coverUploadStatus.textContent = "Upload from device is the default cover update path. Manual URL entry stays available below.";
        els.coverUploadStatus.dataset.tone = "neutral";
      }
    }
    if (els.coverPreview instanceof HTMLElement) {
      const coverValue = resolveCoverDraftValue();
      els.coverPreview.style.backgroundImage = coverValue ? `url("${coverValue}")` : "";
      els.coverPreview.classList.toggle("has-image", Boolean(coverValue));
    }
    const backgroundUpload = getStagedUpload("background");
    if (els.backgroundUploadStatus instanceof HTMLElement) {
      if (backgroundUpload?.filename) {
        els.backgroundUploadStatus.textContent = `Staged upload: ${backgroundUpload.filename} (${Math.round((backgroundUpload.size || 0) / 1024)} KB). Save profile changes to persist it into the dedicated background slot.`;
        els.backgroundUploadStatus.dataset.tone = "success";
      } else if (els.backgroundImageInput instanceof HTMLInputElement && !coerceText(els.backgroundImageInput.value) && coerceText(state.profile?.background_image_url)) {
        els.backgroundUploadStatus.textContent = "Background removal is staged. Save profile changes to clear the saved FindMeHere background slot.";
        els.backgroundUploadStatus.dataset.tone = "warning";
      } else if (coerceText(state.profile?.background_image_url)) {
        els.backgroundUploadStatus.textContent = `Saved background reference: ${coerceText(state.profile?.background_image_url)}`;
        els.backgroundUploadStatus.dataset.tone = "neutral";
      } else {
        els.backgroundUploadStatus.textContent = "Upload from device is available for the dedicated background slot. Manual entry stays secondary.";
        els.backgroundUploadStatus.dataset.tone = "neutral";
      }
    }
    if (els.backgroundPreview instanceof HTMLElement) {
      const backgroundValue = resolveBackgroundDraftValue();
      els.backgroundPreview.style.backgroundImage = backgroundValue ? `url("${backgroundValue}")` : "";
      els.backgroundPreview.classList.toggle("has-image", Boolean(backgroundValue));
    }
    const logoUpload = getStagedUpload("logo");
    if (els.findmeThemeLogoUploadStatus instanceof HTMLElement) {
      if (logoUpload?.filename) {
        els.findmeThemeLogoUploadStatus.textContent = `Staged upload: ${logoUpload.filename} (${Math.round((logoUpload.size || 0) / 1024)} KB). Save profile changes to persist it into the custom header logo slot.`;
        els.findmeThemeLogoUploadStatus.dataset.tone = "success";
      } else if (els.findmeThemeLogoInput instanceof HTMLInputElement && !coerceText(els.findmeThemeLogoInput.value) && coerceText(state.profile?.findmehere_theme?.header_branding?.logo_image_url)) {
        els.findmeThemeLogoUploadStatus.textContent = "Custom logo removal is staged. Save profile changes to clear the FindMeHere header logo slot.";
        els.findmeThemeLogoUploadStatus.dataset.tone = "warning";
      } else if (coerceText(state.profile?.findmehere_theme?.header_branding?.logo_image_url)) {
        els.findmeThemeLogoUploadStatus.textContent = `Saved custom logo reference: ${coerceText(state.profile?.findmehere_theme?.header_branding?.logo_image_url)}`;
        els.findmeThemeLogoUploadStatus.dataset.tone = "neutral";
      } else {
        els.findmeThemeLogoUploadStatus.textContent = "Upload from device is available for the custom logo slot. Reuse buttons and manual entry stay secondary.";
        els.findmeThemeLogoUploadStatus.dataset.tone = "neutral";
      }
    }
    if (els.findmeThemeLogoPreview instanceof HTMLElement) {
      const logoValue = resolveFindmeLogoDraftValue();
      els.findmeThemeLogoPreview.style.backgroundImage = logoValue ? `url("${logoValue}")` : "";
      els.findmeThemeLogoPreview.classList.toggle("has-image", Boolean(logoValue));
    }
    syncColorInputs(els.findmeThemeAccentColorInput, els.findmeThemeAccentColorPickerInput, DEFAULT_ACCENT_COLOR);
    syncColorInputs(els.findmeThemeButtonColorInput, els.findmeThemeButtonColorPickerInput, DEFAULT_BUTTON_COLOR);
  }

  async function stageUpload(kind, file, maxBytes) {
    if (!(file instanceof File)) {
      throw new Error("No file selected.");
    }
    if (!String(file.type || "").startsWith("image/")) {
      throw new Error("Select a PNG, JPEG, WEBP, or GIF image.");
    }
    if (file.size > maxBytes) {
      throw new Error(`Selected image exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`);
    }
    state.uploads[kind] = {
      file,
      previewUrl: URL.createObjectURL(file),
      filename: file.name,
      size: file.size,
      type: file.type,
    };
    renderMediaUploadStatus();
    if (kind === "avatar") {
      updateAvatarPreview();
      renderAvatarFeedback();
    }
    renderPreviewSurface();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!(file instanceof File)) {
        reject(new Error("No file selected."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Unable to read the selected file."));
      reader.readAsDataURL(file);
    });
  }

  function renderCustomLinksEditor() {
    const els = getProfileElements();
    if (!(els.customLinksList instanceof HTMLElement)) return;

    if (els.customLinksSummary instanceof HTMLElement) {
      const count = state.customLinks.filter((item) => item.label || item.url || item.icon_url || item?.staged_icon?.dataUrl).length;
      els.customLinksSummary.textContent = count
        ? `${count} custom link${count === 1 ? "" : "s"} staged for FindMeHere. Existing social links remain separate and still render normally.`
        : "Add focused destination buttons here. Existing social links stay intact, and empty custom-link rows are ignored on save.";
    }

    if (els.customLinkAddButton instanceof HTMLButtonElement) {
      els.customLinkAddButton.disabled = state.savingProfile || !state.profile || state.customLinks.length >= CUSTOM_LINK_MAX_ITEMS;
    }

    if (!state.customLinks.length) {
      els.customLinksList.innerHTML = `
        <div class="custom-link-empty">
          <h4>No custom links added yet.</h4>
          <p>Use custom links for creator-defined buttons such as store pages, portals, media kits, or special landing pages.</p>
        </div>
      `;
      return;
    }

    const disabledAttr = state.savingProfile || !state.profile ? "disabled" : "";
    els.customLinksList.innerHTML = state.customLinks
      .map((item, index) => {
        const iconPreview = getCustomLinkIconPreviewUrl(item);
        const stagedIconName = coerceText(item?.staged_icon?.filename);
        return `
          <article class="custom-link-card" data-custom-link-row="${escapeHtml(item.id)}">
            <div class="custom-link-card-header">
              <div>
                <h4>Custom link ${index + 1}</h4>
                <p>${stagedIconName ? `Staged icon: ${escapeHtml(stagedIconName)}` : "Optional icon stays secondary to the destination itself."}</p>
              </div>
              <div class="custom-link-row-actions">
                <button class="creator-button secondary" type="button" data-custom-link-move="up" data-custom-link-id="${escapeHtml(item.id)}" ${index === 0 ? "disabled" : disabledAttr}>Up</button>
                <button class="creator-button secondary" type="button" data-custom-link-move="down" data-custom-link-id="${escapeHtml(item.id)}" ${index === state.customLinks.length - 1 ? "disabled" : disabledAttr}>Down</button>
                <button class="creator-button danger" type="button" data-custom-link-remove="${escapeHtml(item.id)}" ${disabledAttr}>Remove</button>
              </div>
            </div>
            <div class="account-field-grid custom-link-row-grid">
              <div class="account-field">
                <span class="account-field-label">Label</span>
                <input
                  class="account-field-input"
                  type="text"
                  maxlength="${CUSTOM_LINK_LABEL_MAX_LENGTH}"
                  placeholder="Portal, Store, Media kit"
                  data-custom-link-input="label"
                  data-custom-link-id="${escapeHtml(item.id)}"
                  value="${escapeHtml(item.label)}"
                  ${disabledAttr}
                />
              </div>
              <div class="account-field">
                <span class="account-field-label">Destination URL</span>
                <input
                  class="account-field-input"
                  type="url"
                  placeholder="https://example.com/destination"
                  data-custom-link-input="url"
                  data-custom-link-id="${escapeHtml(item.id)}"
                  value="${escapeHtml(item.url)}"
                  ${disabledAttr}
                />
              </div>
            </div>
            <div class="custom-link-icon-row">
              <div class="custom-link-icon-preview">
                <img src="${escapeHtml(iconPreview)}" alt="" loading="lazy" decoding="async" />
              </div>
              <div class="custom-link-icon-fields">
                <div class="account-field-grid custom-link-row-grid">
                  <div class="account-field">
                    <span class="account-field-label">Icon URL or asset path</span>
                    <input
                      class="account-field-input"
                      type="text"
                      placeholder="/assets/icons/ui/portal.svg"
                      data-custom-link-input="icon_url"
                      data-custom-link-id="${escapeHtml(item.id)}"
                      value="${escapeHtml(item.icon_url)}"
                      ${disabledAttr}
                    />
                    <span class="account-field-note">Optional. Leave blank to use the fallback portal icon.</span>
                  </div>
                  <div class="account-field">
                    <span class="account-field-label">Upload icon</span>
                    <div class="custom-link-upload-row">
                      <input
                        class="account-field-input"
                        type="file"
                        accept="image/svg+xml,image/png,image/webp,image/gif,image/jpeg"
                        data-custom-link-file="${escapeHtml(item.id)}"
                        ${disabledAttr}
                      />
                      <button class="creator-button secondary" type="button" data-custom-link-clear-icon="${escapeHtml(item.id)}" ${disabledAttr}>Clear icon</button>
                    </div>
                    <span class="account-field-note">Accepted: SVG, PNG, WEBP, GIF, JPG, or JPEG.</span>
                  </div>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function replaceCustomLinks(nextLinks) {
    clearCustomLinkDrafts();
    state.customLinks = normalizeCustomLinks(nextLinks);
    renderCustomLinksEditor();
  }

  function findCustomLinkById(id) {
    const normalized = coerceText(id);
    return state.customLinks.find((item) => item.id === normalized) || null;
  }

  function moveCustomLink(id, direction) {
    const index = state.customLinks.findIndex((item) => item.id === id);
    if (index < 0) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= state.customLinks.length) return;
    const next = [...state.customLinks];
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    state.customLinks = next;
    renderCustomLinksEditor();
    renderPreviewSurface();
  }

  function buildPreviewModel() {
    const draft = getEditableDraft();
    const session = getActiveSession();
    const theme = normalizeFindmeTheme(draft.findmehere_theme || state.profile?.findmehere_theme);
    const slugValidation = validatePublicSlug(draft.public_slug_input);
    const savedSlug = coerceText(state.profile?.public_slug);
    const slug = slugValidation.valid
      ? slugValidation.normalized
      : savedSlug || coerceText(state.profile?.user_code).toLowerCase() || "public-user";
    const displayName = draft.display_name || coerceText(state.profile?.display_name) || coerceText(session.name) || "Public User";
    const avatarUrl = resolveAvatarDraftValue() || coerceText(state.profile?.avatar_url) || coerceText(session.avatar);
    const coverImageUrl = resolveCoverDraftValue() || coerceText(state.profile?.cover_image_url);
    const backgroundImageUrl = resolveBackgroundDraftValue() || coerceText(state.profile?.background_image_url);
    const roleLabel = (coerceText(state.profile?.public_surface_account_type) || coerceText(session.role) || "creator").replace(/_/g, " ").toUpperCase();
    const tierLabel = coerceText(session.tier || session?.effectiveTier?.tierId).toUpperCase();
    const subtitle = tierLabel ? `${roleLabel} · ${tierLabel}` : roleLabel;
    const brandLogo = resolveFindmeLogoDraftValue() || coerceText(theme.header_branding.logo_image_url);
    const brandText = coerceText(theme.header_branding.brand_text) || displayName;
    const accentColor = theme.page_accent_color || DEFAULT_ACCENT_COLOR;
    const buttonColor = theme.button_color || theme.page_accent_color || DEFAULT_BUTTON_COLOR;
    const bio = draft.bio || coerceText(state.profile?.bio) || "No public bio saved yet.";
    const socialEntries = Object.entries(draft.social_links || {})
      .filter(([, value]) => coerceText(value))
      .slice(0, 6)
      .map(([key, value]) => ({
        key,
        label: key.replace(/[_-]+/g, " "),
        value: coerceText(value),
      }));
    const customLinks = getSanitizedCustomLinks().map((item) => ({
      label: item.label,
      url: item.url,
      iconUrl: coerceText(item.icon_url) || CUSTOM_LINK_FALLBACK_ICON,
    }));
    return {
      accentColor,
      avatarUrl,
      backgroundImageUrl,
      bio,
      brandLogo,
      brandText,
      buttonColor,
      coverImageUrl,
      customLinks,
      displayName,
      findmeShareUrl: slug ? `https://findmehere.live/${encodeURIComponent(slug)}` : "",
      roleLabel,
      session,
      slug,
      socialEntries,
      streamsuitesBadges:
        window.StreamSuitesAuth?.normalizeBadges?.(
          state.profile?.badges || session?.badges,
          session?.tier || session?.effectiveTier?.tierId || "core",
          session?.role || ""
        ) || [],
      streamsuitesShareUrl: slug ? `https://streamsuites.app/u/${encodeURIComponent(slug)}` : "",
      subtitle,
      theme,
      tierLabel,
      findmehereBadges:
        window.StreamSuitesAuth?.normalizeBadges?.(
          state.profile?.findmehere_badges || state.profile?.findmehereBadges || session?.findmehereBadges || session?.badges,
          session?.tier || session?.effectiveTier?.tierId || "core",
          session?.role || ""
        ) || [],
    };
  }

  function buildPreviewInitial(value, fallback = "P") {
    return escapeHtml((coerceText(value).charAt(0) || fallback).toUpperCase());
  }

  function buildPreviewAvatarMarkup(url, name, className) {
    return url
      ? `<div class="${className} has-image"><img src="${escapeHtml(url)}" alt="${escapeHtml(name)} avatar" loading="lazy" decoding="async" /></div>`
      : `<div class="${className}">${buildPreviewInitial(name)}</div>`;
  }

  function buildPreviewBadgeMarkup(badges) {
    return (Array.isArray(badges) ? badges : [])
      .map((badge) => window.StreamSuitesAuth?.badgeIconSource?.(badge?.key || badge?.value))
      .filter(Boolean)
      .map((src) => `<img class="account-preview-badge-icon" src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" />`)
      .join("");
  }

  function buildPreviewSocialMarkup(entries, className) {
    if (!entries.length) {
      return `<span class="account-preview-empty">No public links saved.</span>`;
    }
    return entries
      .map(
        ({ label, value }) =>
          `<a class="${className}" href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
      )
      .join("");
  }

  function buildPreviewCustomLinkMarkup(entries) {
    if (!entries.length) return "";
    return entries
      .map(
        ({ label, url, iconUrl }) => `
          <a class="fmh-link-item fmh-link-item-custom" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
            <span class="fmh-link-item-icon"><img src="${escapeHtml(iconUrl || CUSTOM_LINK_FALLBACK_ICON)}" alt="" loading="lazy" decoding="async" /></span>
            <span class="fmh-link-item-copy">
              <span class="fmh-link-item-label">${escapeHtml(label)}</span>
              <span class="fmh-link-item-url">${escapeHtml(url)}</span>
            </span>
          </a>
        `
      )
      .join("");
  }

  function buildStreamSuitesPreviewMarkup(model) {
    const socialMarkup = buildPreviewSocialMarkup(model.socialEntries, "social-icon-btn");
    return `
      <article class="account-preview-frame account-streamsuites-preview" style="--account-preview-accent:${escapeHtml(model.accentColor)};">
        <article class="profile-card profile-card-expanded">
          <div class="profile-cover">
            <img src="${escapeHtml(model.coverImageUrl || "/assets/placeholders/defaultprofilecover.webp")}" alt="${escapeHtml(model.displayName)} cover" loading="lazy" decoding="async" />
          </div>
          <div class="creator-meta is-expanded">
            ${buildPreviewAvatarMarkup(model.avatarUrl, model.displayName, "creator-avatar is-expanded")}
            <div class="creator-meta-text">
              <div class="creator-meta-top">
                <span class="creator-name">${escapeHtml(model.displayName)}</span>
                <span class="account-preview-badges">${buildPreviewBadgeMarkup(model.streamsuitesBadges)}</span>
              </div>
              <div class="creator-meta-bottom">${escapeHtml(model.subtitle)}</div>
            </div>
          </div>
          <div class="profile-inline-header">
            <h3>Social Links</h3>
          </div>
          <div class="profile-social-row">${socialMarkup}</div>
          <div class="profile-inline-header">
            <h3>Bio</h3>
          </div>
          <p class="profile-bio-text">${escapeHtml(model.bio)}</p>
          <div class="profile-inline-header">
            <h3>Share Links</h3>
          </div>
          <div class="profile-share-section">
            <div class="profile-share-option">
              <span class="profile-share-option-title">Canonical public URL</span>
              <div class="share-box">
                <span class="share-link-text">${escapeHtml(model.streamsuitesShareUrl || "No saved canonical URL yet")}</span>
                <span class="share-copy-btn" aria-hidden="true"><span class="share-copy-pill">Copy</span></span>
              </div>
            </div>
          </div>
        </article>
      </article>
    `;
  }

  function buildTooltipPreviewMarkup(model) {
    const hasCover = Boolean(model.coverImageUrl);
    return `
      <div class="account-preview-frame account-tooltip-preview-shell" style="--account-preview-accent:${escapeHtml(model.accentColor)};">
        <article class="ss-profile-hovercard is-visible${hasCover ? " has-cover-image" : ""}">
          <div class="ss-profile-hovercard-cover">
            <img class="ss-profile-hovercard-cover-image" src="${escapeHtml(model.coverImageUrl || "/assets/placeholders/defaultprofilecover.webp")}" alt="" loading="lazy" decoding="async" ${hasCover ? "" : "hidden"} />
          </div>
          <div class="ss-profile-hovercard-body">
            ${buildPreviewAvatarMarkup(model.avatarUrl, model.displayName, "ss-profile-hovercard-avatar")}
            <div class="ss-profile-hovercard-head">
              <div class="ss-profile-hovercard-name-row">
                <h3 class="ss-profile-hovercard-name">${escapeHtml(model.displayName)}</h3>
                <span class="ss-profile-hovercard-badges">${buildPreviewBadgeMarkup(model.streamsuitesBadges)}</span>
              </div>
              <p class="ss-profile-hovercard-subtitle">${escapeHtml(model.subtitle)}</p>
            </div>
            <p class="ss-profile-hovercard-bio">${escapeHtml(model.bio)}</p>
            <div class="ss-profile-hovercard-social-row">${buildPreviewSocialMarkup(model.socialEntries, "ss-profile-hovercard-social")}</div>
            <div class="ss-profile-hovercard-actions">
              <a class="ss-profile-hovercard-action" href="${escapeHtml(model.streamsuitesShareUrl)}" target="_blank" rel="noopener noreferrer">View Profile</a>
            </div>
          </div>
        </article>
      </div>
    `;
  }

  function buildFindmeBrandMarkup(model) {
    if (!model.brandLogo && !coerceText(model.theme.header_branding.brand_text)) {
      return `
        <a class="fmh-brand" href="/">
          <span class="fmh-brand-wordmark">FindMeHere</span>
          <span class="fmh-brand-icon">FMH</span>
        </a>
      `;
    }
    return `
      <a class="fmh-brand fmh-brand-profile" href="/${escapeHtml(model.slug)}">
        <span class="fmh-brand-icon">FMH</span>
        <span class="fmh-brand-profile-lockup">
          ${model.brandLogo ? `<img class="fmh-brand-profile-image" src="${escapeHtml(model.brandLogo)}" alt="${escapeHtml(model.brandText)} brand" loading="lazy" decoding="async" />` : ""}
          ${coerceText(model.theme.header_branding.brand_text) ? `<span class="fmh-brand-profile-text">${escapeHtml(model.brandText)}</span>` : ""}
        </span>
      </a>
    `;
  }

  function buildFindmePreviewMarkup(model) {
    const showCover = model.theme.image_visibility.show_cover !== false;
    const showAvatar = model.theme.image_visibility.show_avatar !== false;
    const showBackground = model.theme.image_visibility.show_background !== false && model.backgroundImageUrl;
    const linkMarkup = [...model.socialEntries.map((entry) => ({ kind: "social", ...entry })), ...model.customLinks.map((entry) => ({ kind: "custom", ...entry }))].length
      ? [
          model.socialEntries
          .map(
            ({ label, value }) => `
              <a class="fmh-link-item" href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">
                <span class="fmh-link-item-label">${escapeHtml(label)}</span>
                <span class="fmh-link-item-url">${escapeHtml(value)}</span>
              </a>
            `
          )
          .join(""),
          buildPreviewCustomLinkMarkup(model.customLinks),
        ]
          .filter(Boolean)
          .join("")
      : `<div class="fmh-empty"><h2>Links coming soon</h2><p>This FindMeHere page is active, but no public platform links are available yet.</p></div>`;
    return `
      <div class="account-preview-frame account-findme-preview-shell" style="--account-preview-accent:${escapeHtml(model.accentColor)};--account-preview-button:${escapeHtml(model.buttonColor)};${showBackground ? `--account-findme-background:url('${escapeHtml(model.backgroundImageUrl)}');` : ""}">
        <header class="fmh-topbar"${model.brandLogo || coerceText(model.theme.header_branding.brand_text) ? ' data-branding="profile"' : ""}>
          ${buildFindmeBrandMarkup(model)}
          <div class="fmh-topbar-actions">
            <a class="fmh-link-button fmh-icon-button" href="https://streamsuites.app" target="_blank" rel="noopener noreferrer">SS</a>
            <a class="fmh-link-button fmh-account-button" href="/settings/"><span class="fmh-account-avatar">${showAvatar ? buildPreviewInitial(model.displayName) : "U"}</span><span class="fmh-account-label">Login</span></a>
            <button class="fmh-link-button fmh-theme-toggle" type="button">Theme</button>
            <a class="fmh-button fmh-button-primary" href="/live">Live now</a>
          </div>
        </header>
        <section class="fmh-profile-route">
          <article class="fmh-profile-hero${showCover ? "" : " fmh-profile-hero-no-cover"}">
            ${showCover ? `<div class="fmh-profile-cover"><img src="${escapeHtml(model.coverImageUrl || "/assets/placeholders/defaultprofilecover.webp")}" alt="${escapeHtml(model.displayName)} cover" loading="lazy" decoding="async" /></div>` : ""}
            <div class="fmh-profile-body">
              <div class="fmh-profile-summary">
                ${showAvatar ? buildPreviewAvatarMarkup(model.avatarUrl, model.displayName, "fmh-profile-avatar") : ""}
                <div class="fmh-profile-title">
                  <span class="fmh-profile-kicker">Share page</span>
                  <div class="fmh-profile-title-row">
                    <h1>${escapeHtml(model.displayName)}</h1>
                    <span class="account-preview-badges">${buildPreviewBadgeMarkup(model.findmehereBadges)}</span>
                    <span class="fmh-live-badge fmh-live-badge-compact">LIVE</span>
                  </div>
                  <p>@${escapeHtml(model.slug)}</p>
                  <div class="fmh-profile-meta">
                    <span>${escapeHtml(model.roleLabel)}</span>
                    ${model.tierLabel ? `<span>${escapeHtml(model.tierLabel)}</span>` : ""}
                    <span>${escapeHtml(model.theme.layout_preset)}</span>
                  </div>
                </div>
              </div>
              <p class="fmh-profile-about">${escapeHtml(model.bio)}</p>
              <div class="fmh-profile-actions">
                <a class="fmh-link-button" href="/">Back to directory</a>
                <a class="fmh-button" href="${escapeHtml(model.streamsuitesShareUrl)}" target="_blank" rel="noopener noreferrer">View full StreamSuites profile</a>
              </div>
            </div>
          </article>
          <div class="fmh-profile-grid">
            <section class="fmh-profile-section">
              <h2>Primary links</h2>
              <div class="fmh-social-list">${linkMarkup}</div>
            </section>
            <div class="fmh-link-stack">
              <section class="fmh-profile-section">
                <h2>Share this FindMeHere URL</h2>
                <div class="fmh-share-box">
                  <p>Use this FindMeHere link when sharing this profile.</p>
                  <div class="fmh-share-row">
                    <div class="fmh-share-url">${escapeHtml(model.findmeShareUrl || "No eligible FindMeHere URL yet")}</div>
                    <button class="fmh-copy-button" type="button">Copy</button>
                  </div>
                </div>
              </section>
              <section class="fmh-profile-section">
                <h2>Full profile</h2>
                <div class="fmh-destination-box">
                  <p>Need the broader StreamSuites profile with additional public details and ecosystem context?</p>
                  <a class="fmh-link-button" href="${escapeHtml(model.streamsuitesShareUrl)}" target="_blank" rel="noopener noreferrer">View full StreamSuites profile</a>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function renderPreviewSurface() {
    const els = getProfileElements();
    if (!els.streamsuitesPreviewTarget && !els.tooltipPreviewTarget && !els.findmePreviewTarget) return;
    const model = buildPreviewModel();
    if (els.streamsuitesPreviewTarget instanceof HTMLElement) {
      els.streamsuitesPreviewTarget.innerHTML = buildStreamSuitesPreviewMarkup(model);
    }
    if (els.tooltipPreviewTarget instanceof HTMLElement) {
      els.tooltipPreviewTarget.innerHTML = buildTooltipPreviewMarkup(model);
    }
    if (els.findmePreviewTarget instanceof HTMLElement) {
      els.findmePreviewTarget.innerHTML = buildFindmePreviewMarkup(model);
    }
    applyPreviewMode();
  }

  function getEditableDraft() {
    const els = getProfileElements();
    const profile = state.profile || normalizeProfilePayload({});
    const unknownLinks = {};
    Object.entries(profile.social_links || {}).forEach(([key, value]) => {
      if (!KNOWN_SOCIAL_KEYS.includes(String(key))) {
        const text = coerceText(value);
        if (text) {
          unknownLinks[key] = text;
        }
      }
    });

    const socialLinks = { ...unknownLinks };
    els.linkInputs.forEach((input) => {
      const key = input.getAttribute("data-profile-link") || "";
      const value = coerceText(input.value);
      if (key && value) {
        socialLinks[key] = value;
      }
    });

    const theme = {
      header_branding: {
        logo_image_url: coerceText(els.findmeThemeLogoInput?.value),
        brand_text: coerceText(els.findmeThemeBrandTextInput?.value),
      },
      page_accent_color: normalizeThemeColor(els.findmeThemeAccentColorInput?.value),
      button_color: normalizeThemeColor(els.findmeThemeButtonColorInput?.value),
      button_tone: normalizeThemePreset(els.findmeThemeButtonToneInput?.value, ["brand", "soft", "ghost"], FINDMEHERE_THEME_DEFAULTS.button_tone),
      font_preset: normalizeThemePreset(els.findmeThemeFontPresetInput?.value, ["default", "editorial", "condensed", "mono"], FINDMEHERE_THEME_DEFAULTS.font_preset),
      layout_preset: normalizeThemePreset(els.findmeThemeLayoutPresetInput?.value, ["standard", "condensed", "expanded"], FINDMEHERE_THEME_DEFAULTS.layout_preset),
      image_visibility: {
        show_cover: !!els.findmeThemeShowCoverInput?.checked,
        show_avatar: !!els.findmeThemeShowAvatarInput?.checked,
        show_background: !!els.findmeThemeShowBackgroundInput?.checked,
      },
      advanced: {
        profile_custom_css: String(els.findmeThemeCustomCssInput?.value || ""),
      },
    };

    return {
      display_name: coerceText(els.displayNameInput?.value),
      avatar_url: coerceText(els.avatarUrlInput?.value),
      public_slug_input: coerceText(els.slugInput?.value),
      streamsuites_profile_enabled: !!els.streamsuitesToggle?.checked,
      findmehere_enabled: !!els.findmeToggle?.checked,
      cover_image_url: coerceText(els.coverImageInput?.value),
      background_image_url: coerceText(els.backgroundImageInput?.value),
      findmehere_theme: normalizeFindmeTheme(theme),
      bio: coerceText(els.bioInput?.value),
      social_links: socialLinks,
      custom_links: getSanitizedCustomLinks(),
    };
  }

  function hasPendingMediaUploads() {
    return Boolean(
      getStagedUpload("avatar")?.file ||
      getStagedUpload("cover")?.file ||
      getStagedUpload("background")?.file ||
      getStagedUpload("logo")?.file
    );
  }

  function getSupportedDraftSnapshot(draft) {
    return {
      avatar_url: coerceText(draft.avatar_url),
      streamsuites_profile_enabled: !!draft.streamsuites_profile_enabled,
      findmehere_enabled: !!draft.findmehere_enabled,
      cover_image_url: coerceText(draft.cover_image_url),
      background_image_url: coerceText(draft.background_image_url),
      findmehere_theme: normalizeFindmeTheme(draft.findmehere_theme),
      bio: coerceText(draft.bio),
      social_links: { ...(draft.social_links || {}) },
      custom_links: (draft.custom_links || []).map((item) => ({ ...item })),
    };
  }

  function getIdentityDraftSnapshot(draft) {
    return {
      display_name: coerceText(draft.display_name),
    };
  }

  function getIdentitySavedSnapshot(profile) {
    return {
      display_name: coerceText(profile?.display_name),
    };
  }

  function getSupportedSavedSnapshot(profile) {
    return {
      avatar_url: coerceText(profile?.avatar_url),
      streamsuites_profile_enabled: !!profile?.streamsuites_profile_enabled,
      findmehere_enabled: !!profile?.findmehere_enabled,
      cover_image_url: coerceText(profile?.cover_image_url),
      background_image_url: coerceText(profile?.background_image_url),
      findmehere_theme: normalizeFindmeTheme(profile?.findmehere_theme),
      bio: coerceText(profile?.bio),
      social_links: { ...(profile?.social_links || {}) },
      custom_links: normalizeCustomLinks(profile?.custom_links).map(({ staged_icon, ...item }) => ({ ...item })),
    };
  }

  function isSupportedProfileDirty() {
    const draft = getSupportedDraftSnapshot(getEditableDraft());
    const saved = getSupportedSavedSnapshot(state.profile);
    return JSON.stringify(draft) !== JSON.stringify(saved);
  }

  function isIdentityProfileDirty() {
    const draft = getIdentityDraftSnapshot(getEditableDraft());
    const saved = getIdentitySavedSnapshot(state.profile);
    return JSON.stringify(draft) !== JSON.stringify(saved);
  }

  function renderSlugFeedback() {
    const els = getProfileElements();
    if (!(els.slugInput instanceof HTMLInputElement) || !(els.slugFeedback instanceof HTMLElement)) return;

    const rawValue = els.slugInput.value;
    const validation = validatePublicSlug(rawValue);
    const savedSlug = coerceText(state.profile?.public_slug);
    if (!rawValue && savedSlug) {
      els.slugFeedback.textContent = `Saved canonical slug: ${savedSlug}`;
      els.slugFeedback.dataset.tone = "neutral";
      return;
    }
    if (!validation.valid) {
      els.slugFeedback.textContent = humanizeSlugReason(validation.reason);
      els.slugFeedback.dataset.tone = "danger";
      return;
    }
    if (validation.normalized === savedSlug) {
      els.slugFeedback.textContent = `Saved canonical slug: ${savedSlug}`;
      els.slugFeedback.dataset.tone = "success";
      return;
    }
    els.slugFeedback.textContent =
      `Valid as "${validation.normalized}", but the current creator API does not expose slug updates yet. Share previews stay locked to the saved canonical slug until that route exists.`;
    els.slugFeedback.dataset.tone = "warning";
  }

  function renderSlugAliases(profile) {
    const els = getProfileElements();
    if (!(els.slugAliases instanceof HTMLElement) || !(els.slugAliasesWrap instanceof HTMLElement)) return;
    const aliases = Array.isArray(profile?.slug_aliases) ? profile.slug_aliases : [];
    els.slugAliases.replaceChildren();
    if (!aliases.length) {
      els.slugAliasesWrap.hidden = true;
      return;
    }
    aliases.forEach((alias) => {
      const chip = document.createElement("span");
      chip.className = "alias-chip";
      chip.textContent = alias;
      els.slugAliases.appendChild(chip);
    });
    els.slugAliasesWrap.hidden = false;
  }

  function renderIdentityFeedback() {
    const els = getProfileElements();
    const saved = getIdentitySavedSnapshot(state.profile);
    const draft = getIdentityDraftSnapshot(getEditableDraft());
    const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

    if (els.displayNameFeedback) {
      els.displayNameFeedback.textContent = dirty
        ? "Display name changes save back to your authoritative account identity."
        : "Display name loads from the authoritative account identity.";
      els.displayNameFeedback.dataset.tone = dirty ? "success" : "neutral";
    }
  }

  function renderAvatarFeedback() {
    const els = getProfileElements();
    const draft = getEditableDraft();
    const savedAvatar = coerceText(state.profile?.avatar_url);
    const dirty = coerceText(draft.avatar_url) !== savedAvatar;
    if (els.avatarFeedback) {
      if (getStagedUpload("avatar")?.filename) {
        els.avatarFeedback.textContent = "A device upload is staged and will replace the saved account avatar when you save profile changes.";
        els.avatarFeedback.dataset.tone = "success";
      } else if (dirty) {
        els.avatarFeedback.textContent = "Manual avatar URL changes are supported, but upload-from-device is the preferred path.";
        els.avatarFeedback.dataset.tone = "warning";
      } else {
        els.avatarFeedback.textContent = "Avatar changes now save through the authoritative backend. Upload-from-device is preferred; manual URL stays secondary.";
        els.avatarFeedback.dataset.tone = "neutral";
      }
    }
  }

  function updateAvatarPreview() {
    const els = getProfileElements();
    if (!(els.avatarImage instanceof HTMLImageElement)) return;
    els.avatarImage.src = resolveAvatarDraftValue() || "/assets/icons/ui/profile.svg";
  }

  function renderVisibilityStatus(profile) {
    const els = getProfileElements();
    setStatusPill(
      els.streamsuitesStatus,
      profile.streamsuites_profile_visible ? "Visible" : "Hidden",
      profile.streamsuites_profile_visible ? "success" : profile.streamsuites_profile_enabled ? "warning" : "subtle"
    );
    setStatusPill(
      els.findmeStatus,
      profile.findmehere_visible ? "Listed" : profile.findmehere_eligible ? "Not listed" : "Ineligible",
      profile.findmehere_visible ? "success" : profile.findmehere_eligible ? "warning" : "subtle"
    );
    if (els.streamsuitesReason) {
      els.streamsuitesReason.textContent = humanizeSurfaceReason(profile.streamsuites_profile_status_reason);
    }
    if (els.findmeReason) {
      els.findmeReason.textContent = humanizeSurfaceReason(profile.findmehere_status_reason);
    }
    if (els.creatorCapability) {
      els.creatorCapability.textContent = profile.creator_capable
        ? "Creator-capable account can manage FindMeHere listing visibility."
        : "Backend currently marks this account as not creator-capable for FindMeHere.";
    }
    if (els.surfaceAccountType) {
      els.surfaceAccountType.textContent = profile.public_surface_account_type || "creator_capable";
    }
    if (els.visibilitySummary) {
      els.visibilitySummary.textContent =
        `StreamSuites: ${profile.streamsuites_profile_visible ? "visible" : "hidden"} | FindMeHere: ${profile.findmehere_visible ? "listed" : profile.findmehere_eligible ? "not listed" : "ineligible"}`;
    }
  }

  function renderSharePreviews(profile) {
    const els = getProfileElements();
    if (els.streamsuitesPreviewUrl) {
      els.streamsuitesPreviewUrl.textContent = profile.streamsuites_profile_url || "No saved canonical URL yet";
    }
    if (els.findmePreviewUrl) {
      els.findmePreviewUrl.textContent = profile.findmehere_profile_url || "No eligible FindMeHere URL yet";
    }
    if (els.streamsuitesPreviewNote) {
      els.streamsuitesPreviewNote.textContent = profile.streamsuites_share_url
        ? "Current saved share link is live."
        : humanizeSurfaceReason(profile.streamsuites_profile_status_reason);
    }
    if (els.findmePreviewNote) {
      els.findmePreviewNote.textContent = profile.findmehere_share_url
        ? "Current saved FindMeHere share link is live."
        : humanizeSurfaceReason(profile.findmehere_status_reason);
    }
  }

  function applyProfile(profile) {
    const normalized = normalizeProfilePayload(profile);
    state.profile = cloneProfile(normalized);
    clearStagedUpload("avatar");
    clearStagedUpload("cover");
    clearStagedUpload("background");
    clearStagedUpload("logo");
    replaceCustomLinks(normalized.custom_links);

    const els = getProfileElements();
    if (els.displayNameInput instanceof HTMLInputElement) {
      els.displayNameInput.value = normalized.display_name;
    }
    if (els.userCodeValue instanceof HTMLElement) {
      els.userCodeValue.textContent = normalized.user_code || "Not available";
    }
    if (els.avatarImage instanceof HTMLImageElement) {
      els.avatarImage.src = normalized.avatar_url || "/assets/icons/ui/profile.svg";
    }
    if (els.avatarUrlInput instanceof HTMLInputElement) {
      els.avatarUrlInput.value = normalized.avatar_url;
    }
    if (els.slugInput instanceof HTMLInputElement) {
      els.slugInput.value = normalized.public_slug;
    }
    if (els.streamsuitesToggle instanceof HTMLInputElement) {
      els.streamsuitesToggle.checked = normalized.streamsuites_profile_enabled;
    }
    if (els.findmeToggle instanceof HTMLInputElement) {
      els.findmeToggle.checked = normalized.findmehere_enabled;
      els.findmeToggle.dataset.lockDisabled = normalized.creator_capable ? "false" : "true";
      els.findmeToggle.disabled = state.savingProfile || !normalized.creator_capable;
    }
    if (els.coverImageInput instanceof HTMLInputElement) {
      els.coverImageInput.value = normalized.cover_image_url;
    }
    if (els.backgroundImageInput instanceof HTMLInputElement) {
      els.backgroundImageInput.value = normalized.background_image_url;
    }
    if (els.findmeThemeLogoInput instanceof HTMLInputElement) {
      els.findmeThemeLogoInput.value = coerceText(normalized.findmehere_theme?.header_branding?.logo_image_url);
    }
    if (els.findmeThemeBrandTextInput instanceof HTMLInputElement) {
      els.findmeThemeBrandTextInput.value = coerceText(normalized.findmehere_theme?.header_branding?.brand_text);
    }
    if (els.findmeThemeAccentColorInput instanceof HTMLInputElement) {
      els.findmeThemeAccentColorInput.value = coerceText(normalized.findmehere_theme?.page_accent_color);
    }
    if (els.findmeThemeAccentColorPickerInput instanceof HTMLInputElement) {
      els.findmeThemeAccentColorPickerInput.value = expandHexColor(normalized.findmehere_theme?.page_accent_color, DEFAULT_ACCENT_COLOR);
    }
    if (els.findmeThemeButtonColorInput instanceof HTMLInputElement) {
      els.findmeThemeButtonColorInput.value = coerceText(normalized.findmehere_theme?.button_color);
    }
    if (els.findmeThemeButtonColorPickerInput instanceof HTMLInputElement) {
      els.findmeThemeButtonColorPickerInput.value = expandHexColor(normalized.findmehere_theme?.button_color, DEFAULT_BUTTON_COLOR);
    }
    if (els.findmeThemeButtonToneInput instanceof HTMLSelectElement) {
      els.findmeThemeButtonToneInput.value = normalizeThemePreset(normalized.findmehere_theme?.button_tone, ["brand", "soft", "ghost"], FINDMEHERE_THEME_DEFAULTS.button_tone);
    }
    if (els.findmeThemeFontPresetInput instanceof HTMLSelectElement) {
      els.findmeThemeFontPresetInput.value = normalizeThemePreset(normalized.findmehere_theme?.font_preset, ["default", "editorial", "condensed", "mono"], FINDMEHERE_THEME_DEFAULTS.font_preset);
    }
    if (els.findmeThemeLayoutPresetInput instanceof HTMLSelectElement) {
      els.findmeThemeLayoutPresetInput.value = normalizeThemePreset(normalized.findmehere_theme?.layout_preset, ["standard", "condensed", "expanded"], FINDMEHERE_THEME_DEFAULTS.layout_preset);
    }
    if (els.findmeThemeShowCoverInput instanceof HTMLInputElement) {
      els.findmeThemeShowCoverInput.checked = normalized.findmehere_theme?.image_visibility?.show_cover !== false;
    }
    if (els.findmeThemeShowAvatarInput instanceof HTMLInputElement) {
      els.findmeThemeShowAvatarInput.checked = normalized.findmehere_theme?.image_visibility?.show_avatar !== false;
    }
    if (els.findmeThemeShowBackgroundInput instanceof HTMLInputElement) {
      els.findmeThemeShowBackgroundInput.checked = normalized.findmehere_theme?.image_visibility?.show_background !== false;
    }
    if (els.findmeThemeCustomCssInput instanceof HTMLTextAreaElement) {
      els.findmeThemeCustomCssInput.value = String(normalized.findmehere_theme?.advanced?.profile_custom_css || "");
    }
    if (els.bioInput instanceof HTMLTextAreaElement) {
      els.bioInput.value = normalized.bio;
    }
    els.linkInputs.forEach((input) => {
      const key = input.getAttribute("data-profile-link") || "";
      input.value = coerceText(normalized.social_links[key]);
    });

    renderSlugAliases(normalized);
    renderSlugFeedback();
    renderIdentityFeedback();
    renderAvatarFeedback();
    renderMediaUploadStatus();
    renderVisibilityStatus(normalized);
    renderSharePreviews(normalized);
    renderPreviewSurface();
    renderIntegrationHub();
    renderBillingSection();
    renderBadgeGovernanceSection();
    setStatusPill(els.loadPill, "Profile loaded", "success");
    setMessage("[data-profile-save-status=\"true\"]", "Authoritative profile settings are ready to edit.", "neutral");
  }

  async function loadPublicProfile() {
    state.loadingProfile = true;
    setProfileBusy(true);
    try {
      const payload = await requestJson(PUBLIC_PROFILE_ENDPOINT, { method: "GET" });
      applyProfile(payload?.profile || payload);
      window.StreamSuitesAuth?.markProtectedDataReady?.("account-public-profile");
      return payload;
    } finally {
      state.loadingProfile = false;
      setProfileBusy(state.savingProfile);
    }
  }

  async function copyShareUrl(surface) {
    const profile = state.profile;
    if (!profile) return;
    const url = surface === "findmehere" ? profile.findmehere_profile_url : profile.streamsuites_profile_url;
    if (!url) {
      showToast("No saved URL is available to copy yet.", "warning", {
        key: "creator-profile-copy"
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(`Copied ${surface === "findmehere" ? "FindMeHere" : "StreamSuites"} URL.`, "success", {
        key: "creator-profile-copy",
        title: "Copied"
      });
    } catch (err) {
      showToast("Copy failed. Your browser blocked clipboard access.", "danger", {
        key: "creator-profile-copy",
        title: "Copy failed",
        autoHideMs: 6800
      });
    }
  }

  async function uploadStagedMedia(kind) {
    const staged = getStagedUpload(kind);
    if (!staged?.file) {
      return null;
    }
    const formData = new FormData();
    formData.set("file", staged.file, staged.filename || staged.file.name || `${kind}.upload`);
    const endpoint = kind === "avatar" ? AVATAR_UPLOAD_ENDPOINT : COVER_UPLOAD_ENDPOINT;
    return requestForm(endpoint, formData);
  }

  async function savePublicProfile() {
    if (!state.profile || state.savingProfile) return;

    const draft = getEditableDraft();
    const slugValidation = validatePublicSlug(draft.public_slug_input);
    const savedSlug = coerceText(state.profile.public_slug);
    const slugChanged = slugValidation.valid && slugValidation.normalized !== savedSlug;
    const supportedDirty = isSupportedProfileDirty();
    const hasStagedMedia = hasPendingMediaUploads();
    const identityDirty = isIdentityProfileDirty();

    if (!supportedDirty && !hasStagedMedia && !identityDirty) {
      if (slugChanged && identityDirty) {
        setMessage(
          "[data-profile-save-status=\"true\"]",
          `Supported profile fields are unchanged. Display name edits now save here, but the canonical slug remains "${savedSlug || "unset"}" because slug writes are not exposed on this route.`,
          "warning"
        );
      } else if (slugChanged) {
        setMessage(
          "[data-profile-save-status=\"true\"]",
          `Slug updates are not yet exposed by the creator API. The saved canonical slug remains "${savedSlug || "unset"}".`,
          "warning"
        );
      } else if (identityDirty) {
        setMessage(
          "[data-profile-save-status=\"true\"]",
          "Display name edits are not persisted because the current creator API does not expose a self-serve identity write route here.",
          "warning"
        );
      } else {
        setMessage("[data-profile-save-status=\"true\"]", "No supported profile changes to save.", "neutral");
      }
      renderIdentityFeedback();
      renderAvatarFeedback();
      return;
    }

    state.savingProfile = true;
    setProfileBusy(true);
    setStatusPill(getProfileElements().loadPill, "Saving profile", "warning");
    setMessage("[data-profile-save-status=\"true\"]", "Saving authoritative profile settings...", "neutral");
    try {
      let workingProfile = state.profile;
      const draftTheme = normalizeFindmeTheme(draft.findmehere_theme);
      if (getStagedUpload("avatar")?.file) {
        const uploadResponse = await uploadStagedMedia("avatar");
        workingProfile = normalizeProfilePayload(uploadResponse?.profile || uploadResponse);
      }
      if (getStagedUpload("cover")?.file) {
        const uploadResponse = await uploadStagedMedia("cover");
        workingProfile = normalizeProfilePayload(uploadResponse?.profile || uploadResponse);
      }
      const backgroundDataUrl = getStagedUpload("background")?.file
        ? await readFileAsDataUrl(getStagedUpload("background").file)
        : null;
      const logoDataUrl = getStagedUpload("logo")?.file
        ? await readFileAsDataUrl(getStagedUpload("logo").file)
        : null;
      if (logoDataUrl) {
        draftTheme.header_branding.logo_image_url = logoDataUrl;
      }

      const payload = {
        display_name: draft.display_name,
        avatar_url: coerceText(workingProfile?.avatar_url || draft.avatar_url),
        streamsuites_profile_enabled: draft.streamsuites_profile_enabled,
        findmehere_enabled: draft.findmehere_enabled,
        cover_image_url: coerceText(workingProfile?.cover_image_url || draft.cover_image_url),
        background_image_url: backgroundDataUrl || draft.background_image_url,
        findmehere_theme: draftTheme,
        bio: draft.bio,
        social_links: draft.social_links,
        custom_links: draft.custom_links,
      };
      const response = await requestJson(PUBLIC_PROFILE_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      applyProfile(response?.profile || response);
      if (window.StreamSuitesAuth?.loadSession) {
        try {
          await window.StreamSuitesAuth.loadSession({ force: true });
          await window.StreamSuitesAuth.refreshSummary?.();
        } catch (_sessionError) {
          // Keep the saved profile visible even if the summary refresh lags behind.
        }
      }
      if (slugChanged) {
        const limitations = [];
        if (slugChanged) {
          limitations.push(`canonical slug remains "${state.profile.public_slug || "unset"}"`);
        }
        setMessage(
          "[data-profile-save-status=\"true\"]",
          `Saved authoritative profile settings. ${limitations.join(", ")} because slug writes are not exposed by the current creator API.`,
          "warning"
        );
        showToast(
          `Saved authoritative profile settings. ${limitations.join(", ")} because slug writes are not exposed by the current creator API.`,
          "warning",
          {
            key: "creator-profile-save",
            title: "Saved with limits",
            autoHideMs: 6800
          }
        );
      } else {
        setMessage("[data-profile-save-status=\"true\"]", "");
        showToast("Authoritative profile settings saved.", "success", {
          key: "creator-profile-save",
          title: "Saved"
        });
      }
    } catch (err) {
      setStatusPill(getProfileElements().loadPill, "Profile save failed", "warning");
      setMessage("[data-profile-save-status=\"true\"]", "");
      showToast(err?.message || "Unable to save public profile settings.", "danger", {
        key: "creator-profile-save",
        title: "Save failed",
        autoHideMs: 6800
      });
    } finally {
      state.savingProfile = false;
      setProfileBusy(false);
      renderSlugFeedback();
      renderIdentityFeedback();
      renderAvatarFeedback();
      renderMediaUploadStatus();
    }
  }

  function resetPublicProfileForm() {
    if (!state.profile || state.savingProfile) return;
    applyProfile(state.profile);
    setMessage("[data-profile-save-status=\"true\"]", "");
    showToast("Profile form reset to the saved authoritative values.", "info", {
      key: "creator-profile-reset",
      title: "Form reset"
    });
  }

  function wirePublicProfileControls() {
    if (state.controlsWired) return;
    state.controlsWired = true;
    const els = getProfileElements();
    if (els.displayNameInput instanceof HTMLInputElement) {
      els.displayNameInput.addEventListener("input", () => {
        renderIdentityFeedback();
        renderPreviewSurface();
      });
    }
    if (els.avatarUrlInput instanceof HTMLInputElement) {
      els.avatarUrlInput.addEventListener("input", () => {
        if (getStagedUpload("avatar")?.file) {
          clearStagedUpload("avatar");
        }
        updateAvatarPreview();
        renderAvatarFeedback();
        renderPreviewSurface();
        renderMediaUploadStatus();
      });
    }
    if (els.avatarFileInput instanceof HTMLInputElement) {
      els.avatarFileInput.addEventListener("change", async () => {
        const file = els.avatarFileInput.files?.[0];
        if (!file) return;
        try {
          await stageUpload("avatar", file, AVATAR_UPLOAD_MAX_BYTES);
        } catch (err) {
          clearStagedUpload("avatar");
          renderMediaUploadStatus();
          renderAvatarFeedback();
          showToast(err?.message || "Unable to stage the avatar upload.", "danger", {
            key: "creator-avatar-upload",
            title: "Upload failed",
            autoHideMs: 6800
          });
        }
      });
    }
    if (els.coverFileInput instanceof HTMLInputElement) {
      els.coverFileInput.addEventListener("change", async () => {
        const file = els.coverFileInput.files?.[0];
        if (!file) return;
        try {
          await stageUpload("cover", file, COVER_UPLOAD_MAX_BYTES);
        } catch (err) {
          clearStagedUpload("cover");
          renderMediaUploadStatus();
          showToast(err?.message || "Unable to stage the cover upload.", "danger", {
            key: "creator-cover-upload",
            title: "Upload failed",
            autoHideMs: 6800
          });
        }
      });
    }
    if (els.coverImageInput instanceof HTMLInputElement) {
      els.coverImageInput.addEventListener("input", () => {
        if (getStagedUpload("cover")?.file) {
          clearStagedUpload("cover");
        }
        renderMediaUploadStatus();
        renderPreviewSurface();
      });
    }
    if (els.backgroundFileInput instanceof HTMLInputElement) {
      els.backgroundFileInput.addEventListener("change", async () => {
        const file = els.backgroundFileInput.files?.[0];
        if (!file) return;
        try {
          await stageUpload("background", file, BACKGROUND_UPLOAD_MAX_BYTES);
        } catch (err) {
          clearStagedUpload("background");
          renderMediaUploadStatus();
          showToast(err?.message || "Unable to stage the background upload.", "danger", {
            key: "creator-background-upload",
            title: "Upload failed",
            autoHideMs: 6800
          });
        }
      });
    }
    if (els.backgroundImageInput instanceof HTMLInputElement) {
      els.backgroundImageInput.addEventListener("input", () => {
        if (getStagedUpload("background")?.file) {
          clearStagedUpload("background");
        }
        renderMediaUploadStatus();
        renderPreviewSurface();
      });
    }
    if (els.findmeThemeLogoFileInput instanceof HTMLInputElement) {
      els.findmeThemeLogoFileInput.addEventListener("change", async () => {
        const file = els.findmeThemeLogoFileInput.files?.[0];
        if (!file) return;
        try {
          await stageUpload("logo", file, LOGO_UPLOAD_MAX_BYTES);
        } catch (err) {
          clearStagedUpload("logo");
          renderMediaUploadStatus();
          renderPreviewSurface();
          showToast(err?.message || "Unable to stage the custom logo upload.", "danger", {
            key: "creator-findme-logo-upload",
            title: "Upload failed",
            autoHideMs: 6800
          });
        }
      });
    }
    if (els.avatarClearButton instanceof HTMLButtonElement) {
      els.avatarClearButton.addEventListener("click", () => {
        if (getStagedUpload("avatar")?.file) {
          clearStagedUpload("avatar");
        } else if (els.avatarUrlInput instanceof HTMLInputElement) {
          els.avatarUrlInput.value = "";
        }
        renderMediaUploadStatus();
        updateAvatarPreview();
        renderAvatarFeedback();
        renderPreviewSurface();
      });
    }
    if (els.coverClearButton instanceof HTMLButtonElement) {
      els.coverClearButton.addEventListener("click", () => {
        if (getStagedUpload("cover")?.file) {
          clearStagedUpload("cover");
        } else if (els.coverImageInput instanceof HTMLInputElement) {
          els.coverImageInput.value = "";
        }
        renderMediaUploadStatus();
        renderPreviewSurface();
      });
    }
    if (els.backgroundClearButton instanceof HTMLButtonElement) {
      els.backgroundClearButton.addEventListener("click", () => {
        if (getStagedUpload("background")?.file) {
          clearStagedUpload("background");
        } else if (els.backgroundImageInput instanceof HTMLInputElement) {
          els.backgroundImageInput.value = "";
        }
        renderMediaUploadStatus();
        renderPreviewSurface();
      });
    }
    if (els.findmeThemeLogoInput instanceof HTMLInputElement) {
      els.findmeThemeLogoInput.addEventListener("input", () => {
        if (getStagedUpload("logo")?.file) {
          clearStagedUpload("logo");
        }
        renderMediaUploadStatus();
        renderPreviewSurface();
      });
    }
    els.findmeThemeLogoSourceButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.addEventListener("click", () => {
        if (!(els.findmeThemeLogoInput instanceof HTMLInputElement)) return;
        if (getStagedUpload("logo")?.file) {
          clearStagedUpload("logo");
        }
        const source = button.getAttribute("data-findme-theme-logo-source") || "";
        if (source === "avatar") {
          els.findmeThemeLogoInput.value = resolveAvatarDraftValue();
        } else if (source === "cover") {
          els.findmeThemeLogoInput.value = resolveCoverDraftValue();
        } else if (source === "background") {
          els.findmeThemeLogoInput.value = resolveBackgroundDraftValue();
        }
        renderMediaUploadStatus();
        renderPreviewSurface();
      });
    });
    if (els.findmeThemeLogoClearButton instanceof HTMLButtonElement) {
      els.findmeThemeLogoClearButton.addEventListener("click", () => {
        if (getStagedUpload("logo")?.file) {
          clearStagedUpload("logo");
        } else if (els.findmeThemeLogoInput instanceof HTMLInputElement) {
          els.findmeThemeLogoInput.value = "";
        }
        renderMediaUploadStatus();
        renderPreviewSurface();
      });
    }
    if (els.findmeThemeAccentColorInput instanceof HTMLInputElement && els.findmeThemeAccentColorPickerInput instanceof HTMLInputElement) {
      els.findmeThemeAccentColorInput.addEventListener("input", () => {
        syncColorInputs(els.findmeThemeAccentColorInput, els.findmeThemeAccentColorPickerInput, DEFAULT_ACCENT_COLOR);
        renderPreviewSurface();
      });
      els.findmeThemeAccentColorPickerInput.addEventListener("input", () => {
        els.findmeThemeAccentColorInput.value = els.findmeThemeAccentColorPickerInput.value;
        syncColorInputs(els.findmeThemeAccentColorInput, els.findmeThemeAccentColorPickerInput, DEFAULT_ACCENT_COLOR);
        renderPreviewSurface();
      });
    }
    if (els.findmeThemeButtonColorInput instanceof HTMLInputElement && els.findmeThemeButtonColorPickerInput instanceof HTMLInputElement) {
      els.findmeThemeButtonColorInput.addEventListener("input", () => {
        syncColorInputs(els.findmeThemeButtonColorInput, els.findmeThemeButtonColorPickerInput, DEFAULT_BUTTON_COLOR);
        renderPreviewSurface();
      });
      els.findmeThemeButtonColorPickerInput.addEventListener("input", () => {
        els.findmeThemeButtonColorInput.value = els.findmeThemeButtonColorPickerInput.value;
        syncColorInputs(els.findmeThemeButtonColorInput, els.findmeThemeButtonColorPickerInput, DEFAULT_BUTTON_COLOR);
        renderPreviewSurface();
      });
    }
    if (els.slugInput instanceof HTMLInputElement) {
      els.slugInput.addEventListener("input", renderSlugFeedback);
    }
    if (els.customLinkAddButton instanceof HTMLButtonElement) {
      els.customLinkAddButton.addEventListener("click", () => {
        if (state.customLinks.length >= CUSTOM_LINK_MAX_ITEMS) {
          showToast(`Custom links are limited to ${CUSTOM_LINK_MAX_ITEMS}.`, "warning", {
            key: "creator-custom-links-limit",
            title: "Limit reached",
          });
          return;
        }
        state.customLinks = [...state.customLinks, normalizeCustomLinkItem({})];
        renderCustomLinksEditor();
        renderPreviewSurface();
      });
    }
    if (els.customLinksList instanceof HTMLElement) {
      els.customLinksList.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const field = target.getAttribute("data-custom-link-input");
        const id = target.getAttribute("data-custom-link-id");
        if (!field || !id) return;
        const link = findCustomLinkById(id);
        if (!link) return;
        if (field === "icon_url" && link.staged_icon) {
          releaseCustomLinkIconDraft(link);
          link.staged_icon = null;
        }
        link[field] = field === "label"
          ? coerceText(target.value).slice(0, CUSTOM_LINK_LABEL_MAX_LENGTH)
          : coerceText(target.value);
        if (field === "icon_url") {
          const row = target.closest("[data-custom-link-row]");
          const preview = row?.querySelector(".custom-link-icon-preview img");
          if (preview instanceof HTMLImageElement) {
            preview.src = getCustomLinkIconPreviewUrl(link);
          }
        }
        renderPreviewSurface();
      });
      els.customLinksList.addEventListener("change", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const id = target.getAttribute("data-custom-link-file");
        if (!id) return;
        const link = findCustomLinkById(id);
        const file = target.files?.[0];
        if (!link || !file) return;
        try {
          if (!CUSTOM_LINK_ALLOWED_MIME_TYPES.includes(String(file.type || "").toLowerCase())) {
            throw new Error("Select an SVG, PNG, WEBP, GIF, JPG, or JPEG icon.");
          }
          if (file.size > CUSTOM_LINK_ICON_MAX_BYTES) {
            throw new Error(`Selected icon exceeds the ${Math.round(CUSTOM_LINK_ICON_MAX_BYTES / 1024)} KB limit.`);
          }
          releaseCustomLinkIconDraft(link);
          link.staged_icon = {
            filename: file.name,
            previewUrl: readFileAsObjectUrl(file),
            dataUrl: await readFileAsDataUrl(file),
            type: file.type,
            size: file.size,
          };
          link.icon_url = "";
          renderCustomLinksEditor();
          renderPreviewSurface();
        } catch (err) {
          if (target instanceof HTMLInputElement) target.value = "";
          showToast(err?.message || "Unable to stage the custom link icon.", "danger", {
            key: "creator-custom-link-icon",
            title: "Upload failed",
            autoHideMs: 6800,
          });
        }
      });
      els.customLinksList.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const removeId = target.closest("[data-custom-link-remove]")?.getAttribute("data-custom-link-remove");
        if (removeId) {
          const link = findCustomLinkById(removeId);
          if (link) releaseCustomLinkIconDraft(link);
          state.customLinks = state.customLinks.filter((item) => item.id !== removeId);
          renderCustomLinksEditor();
          renderPreviewSurface();
          return;
        }
        const clearIconId = target.closest("[data-custom-link-clear-icon]")?.getAttribute("data-custom-link-clear-icon");
        if (clearIconId) {
          const link = findCustomLinkById(clearIconId);
          if (!link) return;
          releaseCustomLinkIconDraft(link);
          link.staged_icon = null;
          link.icon_url = "";
          renderCustomLinksEditor();
          renderPreviewSurface();
          return;
        }
        const moveButton = target.closest("[data-custom-link-move]");
        if (moveButton instanceof HTMLElement) {
          moveCustomLink(
            moveButton.getAttribute("data-custom-link-id") || "",
            moveButton.getAttribute("data-custom-link-move") || ""
          );
        }
      });
    }
    els.profileFields.forEach((field) => {
      const eventName = field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement ? "input" : "change";
      field.addEventListener(eventName, renderPreviewSurface);
      field.addEventListener("change", renderPreviewSurface);
    });
    els.saveButtons.forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.addEventListener("click", savePublicProfile);
      }
    });
    els.resetButtons.forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.addEventListener("click", resetPublicProfileForm);
      }
    });
    els.copyButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.dataset.accountSettingsWired === "true") return;
      button.dataset.accountSettingsWired = "true";
      button.addEventListener("click", () => {
        copyShareUrl(button.getAttribute("data-profile-copy-url") || "streamsuites");
      });
    });
    els.badgeGovernanceSaveButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.dataset.accountSettingsWired === "true") return;
      button.dataset.accountSettingsWired = "true";
      button.addEventListener("click", saveBadgeGovernanceSection);
    });
    els.previewModeButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.addEventListener("click", () => {
        state.previewMode = button.getAttribute("data-profile-preview-mode") || "streamsuites";
        applyPreviewMode();
      });
    });
  }

  async function init() {
    if (!hasAccountSettingsSurface()) return;
    wireProviderButtons();
    wireEmailChange();
    wirePublicProfileControls();
    wireAccountShell();

    const tasks = await Promise.allSettled([
      refreshAuthMethods(),
      loadPublicProfile(),
      loadCreatorIntegrations()
    ]);

    const authResult = tasks[0];
    const profileResult = tasks[1];
    const integrationsResult = tasks[2];

    if (window.location.search.includes("linked_provider=")) {
      setMessage("[data-account-provider-status-message=\"true\"]", "");
      showToast(
        `Linked ${window.location.search.split("linked_provider=")[1]?.split("&")[0] || "provider"}.`,
        "success",
        {
          key: "creator-provider-linked",
          title: "Provider linked"
        }
      );
    } else if (authResult.status === "fulfilled" && authResult.value?.pending_email) {
      setPendingEmailStatus(authResult.value);
    } else if (authResult.status === "rejected") {
      setMessage("[data-account-provider-status-message=\"true\"]", "");
      showToast(authResult.reason?.message || "Unable to load sign-in methods.", "danger", {
        key: "creator-provider-load",
        title: "Load failed",
        autoHideMs: 6800
      });
    }

    if (profileResult.status === "rejected") {
      setStatusPill(getProfileElements().loadPill, "Profile unavailable", "warning");
      setMessage("[data-profile-save-status=\"true\"]", "");
      showToast(
        profileResult.reason?.message || "Unable to load authoritative public profile settings.",
        "danger",
        {
          key: "creator-profile-load",
          title: "Load failed",
          autoHideMs: 6800
        }
      );
    }

    if (integrationsResult.status === "rejected") {
      const els = getIntegrationElements();
      if (els.summaryNote instanceof HTMLElement) {
        els.summaryNote.textContent = integrationsResult.reason?.message || "Unable to load authoritative platform integrations.";
      }
    }

    renderBillingSection();
    renderBadgeGovernanceSection();
    await window.CreatorModeratorSurface?.init?.();
  }

  function destroy() {
    state.profile = null;
    state.integrations = [];
    state.uploads = { avatar: null, cover: null, background: null, logo: null };
    state.loadingProfile = false;
    state.savingProfile = false;
    state.controlsWired = false;
    state.previewMode = "streamsuites";
    destroyAccountShell();
    window.CreatorModeratorSurface?.destroy?.();
  }

  window.AccountSettingsView = {
    init,
    destroy,
  };

  document.addEventListener("DOMContentLoaded", () => {
    void init();
  });
})();
