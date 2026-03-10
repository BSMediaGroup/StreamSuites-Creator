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
    const sessionEndpoint = window.StreamSuitesAuth?.endpoints?.session;
    if (sessionEndpoint) {
      try {
        return new URL(sessionEndpoint).origin;
      } catch (err) {
        // Fall back to local detection below.
      }
    }
    return detectFallbackApiBase();
  }

  const API_BASE = resolveApiBase();
  const AUTH_METHODS_ENDPOINT = `${API_BASE}/api/account/auth-methods`;
  const AUTH_UNLINK_ENDPOINT = `${API_BASE}/api/account/auth-methods/unlink`;
  const EMAIL_CHANGE_REQUEST_ENDPOINT = `${API_BASE}/api/account/email/change/request`;
  const PUBLIC_PROFILE_ENDPOINT = `${API_BASE}/api/public/profile/me`;
  const KNOWN_SOCIAL_KEYS = Object.freeze([
    "website",
    "x",
    "youtube",
    "twitch",
    "discord",
    "instagram",
    "tiktok",
  ]);
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
    loadingProfile: false,
    savingProfile: false,
    controlsWired: false,
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

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
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
      throw error;
    }
    return payload || {};
  }

  function coerceText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
      coverImageInput: document.querySelector("[data-profile-cover-image]"),
      backgroundImageInput: document.querySelector("[data-profile-background-image]"),
      bioInput: document.querySelector("[data-profile-bio]"),
      linkInputs: Array.from(document.querySelectorAll("[data-profile-link]")),
      identityInputs: Array.from(document.querySelectorAll("[data-profile-identity-input]")),
      saveButtons: Array.from(document.querySelectorAll("[data-profile-save]")),
      resetButtons: Array.from(document.querySelectorAll("[data-profile-reset]")),
      copyButtons: Array.from(document.querySelectorAll("[data-profile-copy-url]")),
      profileFields: Array.from(document.querySelectorAll("[data-profile-field]")),
      previewSurface: document.querySelector("[data-profile-preview-surface]"),
      previewCover: document.querySelector("[data-profile-preview-cover]"),
      previewAvatar: document.querySelector("[data-profile-preview-avatar]"),
      previewName: document.querySelector("[data-profile-preview-name]"),
      previewSubtitle: document.querySelector("[data-profile-preview-subtitle]"),
      previewBadges: document.querySelector("[data-profile-preview-badges]"),
      previewBio: document.querySelector("[data-profile-preview-bio]"),
      previewLinks: document.querySelector("[data-profile-preview-links]"),
    };
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
      background_image_url: coerceText(profile?.background_image_url),
      bio: coerceText(profile?.bio),
      social_links: profile?.social_links && typeof profile.social_links === "object" ? { ...profile.social_links } : {},
    };
  }

  function setProfileBusy(busy) {
    const els = getProfileElements();
    els.profileFields.forEach((field) => {
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
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
    els.identityInputs.forEach((field) => {
      if (field instanceof HTMLInputElement) {
        field.disabled = busy || !state.profile;
      }
    });
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

  function resolvePreviewBadges(profile) {
    const session = getActiveSession();
    const badges = [];
    const role = coerceText(session.role).toLowerCase();
    const tier = coerceText(session.tier || session?.effectiveTier?.tierId).toLowerCase() || "core";
    if (["gold", "pro"].includes(tier)) {
      badges.push(`/assets/icons/tierbadge-${tier}.svg`);
    } else if (role === "creator") {
      badges.push("/assets/icons/tierbadge-core.svg");
    }
    if (role === "admin") {
      badges.push("/assets/icons/tierbadge-admin.svg");
    }
    return badges;
  }

  function renderPreviewSurface() {
    const els = getProfileElements();
    if (!els.previewSurface) return;
    const draft = getEditableDraft();
    const session = getActiveSession();
    const displayName = draft.display_name || coerceText(state.profile?.display_name) || coerceText(session.name) || "Public User";
    const avatarUrl = draft.avatar_url || coerceText(state.profile?.avatar_url) || coerceText(session.avatar);
    const coverImageUrl = draft.cover_image_url || coerceText(state.profile?.cover_image_url);
    const subtitle = `${(coerceText(state.profile?.public_surface_account_type) || coerceText(session.role) || "creator").replace(/_/g, " ").toUpperCase()}${coerceText(session.tier) ? ` · ${coerceText(session.tier).toUpperCase()}` : ""}`;
    if (els.previewCover) {
      els.previewCover.style.backgroundImage = coverImageUrl ? `url("${coverImageUrl}")` : "";
    }
    if (els.previewAvatar) {
      els.previewAvatar.classList.toggle("has-image", Boolean(avatarUrl));
      els.previewAvatar.innerHTML = avatarUrl
        ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)} avatar" loading="lazy" decoding="async" />`
        : escapeHtml(displayName.charAt(0).toUpperCase() || "P");
    }
    if (els.previewName) {
      els.previewName.textContent = displayName;
    }
    if (els.previewSubtitle) {
      els.previewSubtitle.textContent = subtitle;
    }
    if (els.previewBadges) {
      els.previewBadges.innerHTML = resolvePreviewBadges(state.profile)
        .map((src) => `<img src="${src}" alt="" />`)
        .join("");
    }
    if (els.previewBio) {
      els.previewBio.textContent = draft.bio || coerceText(state.profile?.bio) || "No public bio saved.";
    }
    if (els.previewLinks) {
      const links = Object.entries(draft.social_links || {})
        .filter(([, value]) => coerceText(value))
        .map(
          ([key, value]) =>
            `<a class="ss-link" href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(key)}</a>`
        );
      els.previewLinks.innerHTML = links.join(" · ") || '<span class="account-note">No public links saved.</span>';
    }
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

    return {
      display_name: coerceText(els.displayNameInput?.value),
      avatar_url: coerceText(els.avatarUrlInput?.value),
      public_slug_input: coerceText(els.slugInput?.value),
      streamsuites_profile_enabled: !!els.streamsuitesToggle?.checked,
      findmehere_enabled: !!els.findmeToggle?.checked,
      cover_image_url: coerceText(els.coverImageInput?.value),
      background_image_url: coerceText(els.backgroundImageInput?.value),
      bio: coerceText(els.bioInput?.value),
      social_links: socialLinks,
    };
  }

  function getSupportedDraftSnapshot(draft) {
    return {
      streamsuites_profile_enabled: !!draft.streamsuites_profile_enabled,
      findmehere_enabled: !!draft.findmehere_enabled,
      cover_image_url: coerceText(draft.cover_image_url),
      background_image_url: coerceText(draft.background_image_url),
      bio: coerceText(draft.bio),
      social_links: { ...(draft.social_links || {}) },
    };
  }

  function getIdentityDraftSnapshot(draft) {
    return {
      display_name: coerceText(draft.display_name),
      avatar_url: coerceText(draft.avatar_url),
    };
  }

  function getIdentitySavedSnapshot(profile) {
    return {
      display_name: coerceText(profile?.display_name),
      avatar_url: coerceText(profile?.avatar_url),
    };
  }

  function getSupportedSavedSnapshot(profile) {
    return {
      streamsuites_profile_enabled: !!profile?.streamsuites_profile_enabled,
      findmehere_enabled: !!profile?.findmehere_enabled,
      cover_image_url: coerceText(profile?.cover_image_url),
      background_image_url: coerceText(profile?.background_image_url),
      bio: coerceText(profile?.bio),
      social_links: { ...(profile?.social_links || {}) },
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
        ? "Display name edits are staged here, but the current creator API does not expose a self-serve write route yet."
        : "Display name loads from the authoritative account identity.";
      els.displayNameFeedback.dataset.tone = dirty ? "warning" : "neutral";
    }

    if (els.avatarFeedback) {
      els.avatarFeedback.textContent = dirty
        ? "Avatar URL edits are staged here, but the current creator API does not expose a self-serve avatar write route yet."
        : "Avatar URL loads from the authoritative account identity. Future upload-based media can replace this URL field cleanly.";
      els.avatarFeedback.dataset.tone = dirty ? "warning" : "neutral";
    }
  }

  function updateAvatarPreview() {
    const els = getProfileElements();
    if (!(els.avatarImage instanceof HTMLImageElement)) return;
    const inputValue = coerceText(els.avatarUrlInput?.value);
    els.avatarImage.src = inputValue || coerceText(state.profile?.avatar_url) || "/assets/icons/ui/profile.svg";
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
    renderVisibilityStatus(normalized);
    renderSharePreviews(normalized);
    renderPreviewSurface();
    setStatusPill(els.loadPill, "Profile loaded", "success");
    setMessage("[data-profile-save-status=\"true\"]", "Authoritative profile settings are ready to edit.", "neutral");
  }

  async function loadPublicProfile() {
    state.loadingProfile = true;
    setProfileBusy(true);
    try {
      const payload = await requestJson(PUBLIC_PROFILE_ENDPOINT, { method: "GET" });
      applyProfile(payload?.profile || payload);
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

  async function savePublicProfile() {
    if (!state.profile || state.savingProfile) return;

    const draft = getEditableDraft();
    const slugValidation = validatePublicSlug(draft.public_slug_input);
    const savedSlug = coerceText(state.profile.public_slug);
    const slugChanged = slugValidation.valid && slugValidation.normalized !== savedSlug;
    const supportedDirty = isSupportedProfileDirty();
    const identityDirty = isIdentityProfileDirty();

    if (!supportedDirty) {
      if (slugChanged && identityDirty) {
        setMessage(
          "[data-profile-save-status=\"true\"]",
          `Supported profile fields are unchanged. Slug, display name, and avatar edits are not persisted because the current creator self-serve backend only exposes public profile settings writes here.`,
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
          "Display name and avatar edits are not persisted because the current creator API does not expose identity write routes here.",
          "warning"
        );
      } else {
        setMessage("[data-profile-save-status=\"true\"]", "No supported profile changes to save.", "neutral");
      }
      renderIdentityFeedback();
      return;
    }

    const payload = {
      streamsuites_profile_enabled: draft.streamsuites_profile_enabled,
      findmehere_enabled: draft.findmehere_enabled,
      cover_image_url: draft.cover_image_url,
      background_image_url: draft.background_image_url,
      bio: draft.bio,
      social_links: draft.social_links,
    };

    state.savingProfile = true;
    setProfileBusy(true);
    setStatusPill(getProfileElements().loadPill, "Saving profile", "warning");
    setMessage("[data-profile-save-status=\"true\"]", "Saving authoritative profile settings...", "neutral");
    try {
      const response = await requestJson(PUBLIC_PROFILE_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      applyProfile(response?.profile || response);
      if (slugChanged || identityDirty) {
        const limitations = [];
        if (slugChanged) {
          limitations.push(`canonical slug remains "${state.profile.public_slug || "unset"}"`);
        }
        if (identityDirty) {
          limitations.push("display name and avatar remain on their saved authoritative account identity values");
        }
        setMessage(
          "[data-profile-save-status=\"true\"]",
          `Saved supported profile settings. ${limitations.join(", ")} because those write routes are not exposed by the current creator API.`,
          "warning"
        );
        showToast(
          `Saved supported profile settings. ${limitations.join(", ")} because those write routes are not exposed by the current creator API.`,
          "warning",
          {
            key: "creator-profile-save",
            title: "Saved with limits",
            autoHideMs: 6800
          }
        );
      } else {
        setMessage("[data-profile-save-status=\"true\"]", "");
        showToast("Authoritative public profile settings saved.", "success", {
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
        updateAvatarPreview();
        renderIdentityFeedback();
        renderPreviewSurface();
      });
    }
    if (els.slugInput instanceof HTMLInputElement) {
      els.slugInput.addEventListener("input", renderSlugFeedback);
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
  }

  async function init() {
    if (!hasAccountSettingsSurface()) return;
    wireProviderButtons();
    wireEmailChange();
    wirePublicProfileControls();

    const tasks = await Promise.allSettled([refreshAuthMethods(), loadPublicProfile()]);

    const authResult = tasks[0];
    const profileResult = tasks[1];

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
  }

  function destroy() {
    state.profile = null;
    state.loadingProfile = false;
    state.savingProfile = false;
    state.controlsWired = false;
  }

  window.AccountSettingsView = {
    init,
    destroy,
  };

  document.addEventListener("DOMContentLoaded", () => {
    void init();
  });
})();
