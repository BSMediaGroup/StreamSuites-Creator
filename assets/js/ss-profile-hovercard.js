(() => {
  const TRIGGER_SELECTOR = ".ss-profile-hover";
  const OPTOUT_SELECTOR = '[data-ss-profile-hover="off"], .ss-no-profile-hover';
  const PROFILE_ENDPOINT = "https://api.streamsuites.app/api/public/profile";
  const HIDE_DELAY_MS = 120;
  const OFFSET = 10;
  const VIEWPORT_GAP = 12;
  const THUMB_SELECTOR = ".item-thumb, .thumb";
  const ROLE_ICON_MAP = Object.freeze({
    admin: "/assets/icons/tierbadge-admin.svg"
  });
  const TIER_ICON_MAP = Object.freeze({
    core: "/assets/icons/tierbadge-core.svg",
    gold: "/assets/icons/tierbadge-gold.svg",
    pro: "/assets/icons/tierbadge-pro.svg"
  });
  const SOCIAL_ICON_MAP = Object.freeze({
    youtube: "/assets/icons/youtube.svg",
    rumble: "/assets/icons/rumble.svg",
    discord: "/assets/icons/discord.svg",
    x: "/assets/icons/x.svg",
    twitter: "/assets/icons/twitter.svg",
    twitch: "/assets/icons/twitch.svg",
    kick: "/assets/icons/kick.svg",
    tiktok: "/assets/icons/ui/widget.svg",
    github: "/assets/icons/github.svg",
    website: "/assets/icons/ui/globe.svg",
    instagram: "/assets/icons/ui/widget.svg"
  });
  const SOCIAL_ORDER = Object.freeze([
    "x",
    "twitter",
    "youtube",
    "rumble",
    "twitch",
    "kick",
    "discord",
    "instagram",
    "tiktok",
    "github",
    "website"
  ]);
  const ROLE_BADGE_WRAPPER_QUERY = ".ss-role-badges";
  const ROLE_BADGE_PRIMARY_QUERY =
    ".ss-role-badges svg, .ss-role-badges img, .ss-role-badges [data-ss-role-badge]";
  const ROLE_BADGE_SECONDARY_QUERY =
    "[data-ss-badge-kind='role'] svg, [data-ss-badge-kind='role'] img, [data-ss-badge-kind='tier'] svg, [data-ss-badge-kind='tier'] img, .ss-role-badge, .ss-tier-badge, [data-ss-role-badge]";
  const ROLE_BADGE_MARKER_QUERY =
    "[data-ss-role-badge], [data-ss-badge-kind='role'], [data-ss-badge-kind='tier'], .ss-role-badge, .ss-tier-badge, .ss-role-badges";
  const ROLE_BADGE_INCLUDE_TOKENS = Object.freeze(["tier", "core", "gold", "pro", "admin", "role"]);
  const ROLE_BADGE_EXCLUDE_TOKENS = Object.freeze([
    "youtube",
    "twitch",
    "rumble",
    "kick",
    "twitter",
    "x",
    "discord",
    "tiktok",
    "instagram",
    "facebook",
    "platform",
    "source"
  ]);
  const BADGE_ANCESTOR_RADIUS = 3;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";
  const FALLBACK_BADGE_ICON_MAP = Object.freeze({
    admin: "M8 1.1 13.4 3.1v4.2c0 3.2-2.2 5.9-5.4 7.7C4.8 13.2 2.6 10.5 2.6 7.3V3.1L8 1.1zm2.6 5.2L7.4 9.5 5.8 8l-1.1 1.1 2.7 2.7 4.3-4.3-1.1-1.2z",
    creator: "M8 1.2 9.9 5l4.2.6-3 2.9.7 4.1L8 10.7 4.2 12.6l.7-4.1-3-2.9L6.1 5 8 1.2z",
    core: "M8 2.1a5.9 5.9 0 1 1 0 11.8A5.9 5.9 0 0 1 8 2.1zm0 2a3.9 3.9 0 1 0 0 7.8 3.9 3.9 0 0 0 0-7.8z",
    gold: "M8 1.3 11 2.6l2.8 1.6-.6 3.2a6.5 6.5 0 0 1-5.2 5.3A6.5 6.5 0 0 1 2.8 7.4l-.6-3.2L5 2.6 8 1.3zm0 2.2-1.1 2.1-2.3.3 1.7 1.6-.4 2.3L8 8.7l2.1 1.1-.4-2.3 1.7-1.6-2.3-.3L8 3.5z",
    pro: "M8 1.4 3.2 8h3L5.5 14.6 12.8 6H9.9L11 1.4H8z",
    staff: "M8 1.1 13.6 3v4.4c0 3.4-2.4 6.2-5.6 7.8C4.8 13.6 2.4 10.8 2.4 7.4V3L8 1.1z",
    verified: "M8 1.3a6.7 6.7 0 1 1 0 13.4A6.7 6.7 0 0 1 8 1.3zm2.7 4.3L7.1 9.4 5.3 7.7 4.2 8.8l2.9 2.9 4.9-4.9-1-1.2z"
  });

  let card = null;
  let activeTrigger = null;
  let hideTimer = 0;
  let fetchController = null;
  let activeFetchToken = 0;
  let cardHovered = false;
  let badgeCloneCounter = 0;

  const profileCache = new Map();

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function isInOptOutZone(node) {
    return Boolean(node?.closest(OPTOUT_SELECTOR));
  }

  function getTrigger(node) {
    const trigger = node?.closest(TRIGGER_SELECTOR);
    if (!trigger) return null;
    if (isInOptOutZone(trigger)) return null;
    return trigger;
  }

  function safeText(value, fallback = "") {
    const text = String(value || "").trim();
    return text || fallback;
  }

  function textInitial(value) {
    return safeText(value, "P").charAt(0).toUpperCase();
  }

  function parseJsonObject(value) {
    const raw = safeText(value);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (_err) {
      return null;
    }
  }

  function normalizeRole(value) {
    const raw = safeText(value).toUpperCase();
    if (raw.includes("ADMIN")) return "ADMIN";
    if (raw.includes("CREATOR")) return "CREATOR";
    if (raw.includes("VIEWER")) return "VIEWER";
    return raw || "PUBLIC";
  }

  function normalizeTier(value) {
    const tier = safeText(value).toLowerCase();
    if (tier === "gold" || tier === "pro") return tier;
    return "core";
  }

  function normalizeSocialLinks(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.entries(value).reduce((acc, [key, raw]) => {
      const normalizedKey = safeText(key).toLowerCase();
      const normalizedValue = safeText(raw);
      if (!normalizedKey || !normalizedValue) return acc;
      acc[normalizedKey] = normalizedValue;
      return acc;
    }, {});
  }

  function normalizeExternalUrl(url) {
    const raw = safeText(url);
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^(mailto:|tel:)/i.test(raw)) return raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return "";
    return `https://${raw.replace(/^\/+/, "")}`;
  }

  function socialIconPath(network) {
    const normalized = safeText(network).toLowerCase();
    return SOCIAL_ICON_MAP[normalized] || "/assets/icons/ui/globe.svg";
  }

  function collectSocialEntries(value) {
    const normalized = normalizeSocialLinks(value);
    const entries = [];
    const seen = new Set();
    SOCIAL_ORDER.forEach((network) => {
      if (!normalized[network]) return;
      const url = normalizeExternalUrl(normalized[network]);
      if (!url) return;
      entries.push({ network, url });
      seen.add(network);
    });
    Object.entries(normalized).forEach(([network, rawUrl]) => {
      if (seen.has(network)) return;
      const url = normalizeExternalUrl(rawUrl);
      if (!url) return;
      entries.push({ network, url });
    });
    return entries;
  }

  function buildBadgesFromRole(role, tier = "core") {
    const normalizedRole = normalizeRole(role);
    if (normalizedRole === "ADMIN") return [{ kind: "role-icon", value: "admin" }];
    if (normalizedRole === "CREATOR") return [{ kind: "tier-icon", value: normalizeTier(tier) }];
    return [];
  }

  function normalizeBadges(value, role, tier) {
    if (Array.isArray(value)) {
      return value
        .map((badge) => {
          if (!badge || typeof badge !== "object") return null;
          const kind = safeText(badge.kind).toLowerCase();
          const badgeValue = safeText(badge.value).toLowerCase();
          if (!kind || !badgeValue) return null;
          return { kind, value: badgeValue };
        })
        .filter(Boolean);
    }
    return buildBadgesFromRole(role, tier);
  }

  function resolveBadgeIconPath(kind, value) {
    if (kind === "role-icon") return ROLE_ICON_MAP[value] || "";
    if (kind === "tier-icon") return TIER_ICON_MAP[value] || "";
    return "";
  }

  function isLikelyBadgeIconElement(node) {
    if (!(node instanceof Element)) return false;
    if (node.closest(".ss-profile-hovercard")) return false;
    if (!node.matches("svg, img, [data-ss-role-badge], .ss-role-badge, .ss-tier-badge")) return false;
    const className = safeText(node.className || "").toLowerCase();
    if (/avatar|profile-avatar|creator-avatar/.test(className)) return false;
    return true;
  }

  function nodeRoleBadgeTokenText(node) {
    if (!(node instanceof Element)) return "";
    const parts = [
      node.getAttribute("class"),
      node.getAttribute("id"),
      node.getAttribute("data-ss-role-badge"),
      node.getAttribute("data-ss-badge-kind"),
      node.getAttribute("data-badge"),
      node.getAttribute("aria-label"),
      node.getAttribute("title")
    ];
    const useNode = node.matches("use") ? node : node.querySelector("use");
    if (useNode instanceof Element) {
      parts.push(useNode.getAttribute("href"));
      parts.push(useNode.getAttribute("xlink:href"));
    }
    return parts
      .map((value) => safeText(value).toLowerCase())
      .filter(Boolean)
      .join(" ");
  }

  function isRoleBadgeNode(node) {
    if (!isLikelyBadgeIconElement(node)) return false;
    if (node.matches(ROLE_BADGE_MARKER_QUERY) || node.closest(ROLE_BADGE_MARKER_QUERY)) return true;
    const tokenText = nodeRoleBadgeTokenText(node);
    if (!tokenText) return false;
    const hasExcluded = ROLE_BADGE_EXCLUDE_TOKENS.some((token) => tokenText.includes(token));
    if (hasExcluded) return false;
    return ROLE_BADGE_INCLUDE_TOKENS.some((token) => tokenText.includes(token));
  }

  function collectRoleBadgeCandidates(root, query, out, seen) {
    if (!(root instanceof Element) || !query) return;
    root.querySelectorAll(query).forEach((node) => {
      if (!(node instanceof Element)) return;
      if (seen.has(node) || !isRoleBadgeNode(node)) return;
      seen.add(node);
      out.push(node);
    });
  }

  function findBadgeNodes(triggerEl) {
    if (!(triggerEl instanceof Element)) return [];
    const nodes = [];
    const seen = new Set();
    const roots = [triggerEl];
    let cursor = triggerEl;
    for (let depth = 0; depth < BADGE_ANCESTOR_RADIUS; depth += 1) {
      cursor = cursor?.parentElement || null;
      if (!cursor || cursor === document.body) break;
      roots.push(cursor);
    }

    let hasRoleWrapper = false;
    roots.forEach((root) => {
      if (!root.matches?.(ROLE_BADGE_WRAPPER_QUERY) && !root.querySelector(ROLE_BADGE_WRAPPER_QUERY)) return;
      hasRoleWrapper = true;
      collectRoleBadgeCandidates(root, ROLE_BADGE_PRIMARY_QUERY, nodes, seen);
    });
    if (hasRoleWrapper) return nodes.slice(0, 6);

    let hasRoleMarker = false;
    roots.forEach((root) => {
      if (!root.matches?.(ROLE_BADGE_MARKER_QUERY) && !root.querySelector(ROLE_BADGE_MARKER_QUERY)) return;
      hasRoleMarker = true;
      collectRoleBadgeCandidates(root, ROLE_BADGE_SECONDARY_QUERY, nodes, seen);
    });
    if (!hasRoleMarker) {
      return [];
    }
    return nodes.slice(0, 6);
  }

  function patchSvgUseReferences(svg) {
    if (!(svg instanceof SVGElement)) return;
    svg.querySelectorAll("use").forEach((useNode) => {
      const hrefValue = safeText(useNode.getAttribute("href") || useNode.getAttributeNS(XLINK_NS, "href"));
      if (!hrefValue) return;
      useNode.setAttribute("href", hrefValue);
      useNode.setAttributeNS(XLINK_NS, "xlink:href", hrefValue);
    });
  }

  function dedupeSvgIds(svg) {
    if (!(svg instanceof SVGElement)) return;
    const renamed = new Map();
    svg.querySelectorAll("[id]").forEach((node) => {
      const oldId = safeText(node.id);
      if (!oldId) return;
      badgeCloneCounter += 1;
      const newId = `ss-hover-badge-${badgeCloneCounter}`;
      node.id = newId;
      renamed.set(oldId, newId);
    });
    if (!renamed.size) return;
    const attrs = ["href", "xlink:href", "fill", "stroke", "filter", "mask", "clip-path"];
    svg.querySelectorAll("*").forEach((node) => {
      attrs.forEach((attr) => {
        const raw = safeText(node.getAttribute(attr));
        if (!raw) return;
        let next = raw;
        renamed.forEach((newId, oldId) => {
          next = next
            .replaceAll(`#${oldId}`, `#${newId}`)
            .replaceAll(`url(#${oldId})`, `url(#${newId})`);
        });
        if (next !== raw) {
          node.setAttribute(attr, next);
        }
      });
    });
  }

  function cloneBadgeNode(node) {
    if (!(node instanceof Element)) return null;
    let clone = node.cloneNode(true);
    if (!(clone instanceof Element)) return null;
    if (!clone.matches("svg, img")) {
      const embeddedIcon = clone.querySelector("svg, img");
      if (!(embeddedIcon instanceof Element)) return null;
      clone = embeddedIcon;
    }
    clone.classList.add("ss-hover-badge-icon");
    clone.removeAttribute("id");
    clone.removeAttribute("aria-hidden");
    clone.setAttribute("aria-hidden", "true");
    if (clone instanceof SVGElement) {
      patchSvgUseReferences(clone);
      dedupeSvgIds(clone);
    }
    return clone;
  }

  function normalizeFallbackBadgeTokens(trigger, badges) {
    const tokens = [];
    const pushToken = (value) => {
      const token = safeText(value).toLowerCase();
      if (!token || tokens.includes(token)) return;
      tokens.push(token);
    };
    normalizeBadges(badges, "PUBLIC", "core").forEach((badge) => {
      pushToken(badge.value);
    });
    const rawAttr = safeText(trigger?.getAttribute("data-ss-badges") || trigger?.dataset?.ssBadges);
    if (!rawAttr) return tokens;
    try {
      const parsed = JSON.parse(rawAttr);
      if (Array.isArray(parsed)) {
        parsed.forEach((entry) => {
          if (typeof entry === "string") {
            pushToken(entry);
            return;
          }
          if (!entry || typeof entry !== "object") return;
          pushToken(entry.value || entry.kind);
        });
        return tokens;
      }
      if (parsed && typeof parsed === "object") {
        pushToken(parsed.value || parsed.kind);
        return tokens;
      }
    } catch (_err) {
      rawAttr.split(",").forEach((entry) => pushToken(entry));
    }
    return tokens;
  }

  function createFallbackBadgeSvg(token) {
    const pathData = FALLBACK_BADGE_ICON_MAP[token];
    if (!pathData) return null;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("ss-hover-badge-icon");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
    return svg;
  }

  function parseTriggerData(trigger) {
    const ds = trigger?.dataset || {};
    const displayName =
      safeText(ds.ssDisplayName) ||
      safeText(trigger?.getAttribute("aria-label")) ||
      safeText(trigger?.textContent, "Public User");
    const userCode = safeText(ds.ssUserCode);
    const userId = safeText(ds.ssUserId);
    const avatarUrl = safeText(ds.ssAvatarUrl);
    const role = normalizeRole(ds.ssRole);
    const bio = safeText(ds.ssBio);
    const profileHref = safeText(ds.ssProfileHref) || safeText(trigger?.getAttribute("href"));
    const coverImageUrl = safeText(ds.ssCoverUrl || ds.ssCoverImageUrl);
    const socialLinks = normalizeSocialLinks(parseJsonObject(ds.ssSocialLinks));
    const badges = normalizeBadges(parseJsonObject(ds.ssBadges), role, "core");
    return {
      displayName,
      userCode,
      userId,
      avatarUrl,
      role,
      bio,
      profileHref,
      coverImageUrl,
      socialLinks,
      badges
    };
  }

  function createCard() {
    if (card) return card;

    card = document.createElement("aside");
    card.className = "ss-profile-hovercard";
    card.setAttribute("role", "tooltip");
    card.setAttribute("aria-hidden", "true");
    card.innerHTML = `
      <div class="ss-profile-hovercard-cover">
        <img class="ss-profile-hovercard-cover-image" data-slot="cover-image" alt="" loading="eager" decoding="async" hidden />
      </div>
      <div class="ss-profile-hovercard-body">
        <div class="ss-profile-hovercard-avatar" data-slot="avatar"></div>
        <div class="ss-profile-hovercard-head">
          <div class="ss-profile-hovercard-name-row">
            <h3 class="ss-profile-hovercard-name" data-slot="name">Public User</h3>
            <span class="ss-profile-hovercard-badges" data-slot="badges"></span>
          </div>
          <p class="ss-profile-hovercard-subtitle" data-slot="subtitle">PUBLIC</p>
        </div>
        <p class="ss-profile-hovercard-bio" data-slot="bio"></p>
        <div class="ss-profile-hovercard-social-row" data-slot="social-row"></div>
        <div class="ss-profile-hovercard-actions" data-slot="actions">
          <a class="ss-profile-hovercard-action" data-slot="profile-link" href="/community/profile.html">View Profile</a>
        </div>
        <div class="ss-profile-hovercard-skeleton" aria-hidden="true">
          <span class="ss-profile-hovercard-skeleton-line"></span>
          <span class="ss-profile-hovercard-skeleton-line"></span>
        </div>
      </div>
    `;

    const coverImage = getSlot("cover-image");
    if (coverImage) {
      coverImage.addEventListener("load", () => {
        card?.classList.add("has-cover-image");
        coverImage.hidden = false;
      });
      coverImage.addEventListener("error", () => {
        card?.classList.remove("has-cover-image");
        coverImage.hidden = true;
      });
    }

    card.addEventListener("mouseenter", () => {
      cardHovered = true;
      clearHideTimer();
    });

    card.addEventListener("mouseleave", () => {
      cardHovered = false;
      scheduleHide();
    });

    document.body.appendChild(card);
    return card;
  }

  function getSlot(name) {
    return card?.querySelector(`[data-slot="${name}"]`) || null;
  }

  function renderBadgeSuffix(row, badges, trigger) {
    if (!row) return;
    row.textContent = "";
    const sourceBadges = findBadgeNodes(trigger);
    sourceBadges.forEach((node) => {
      const clone = cloneBadgeNode(node);
      if (!clone) return;
      row.appendChild(clone);
    });

    if (!row.childElementCount) {
      const normalized = normalizeBadges(badges, "PUBLIC", "core");
      normalized.forEach((badge) => {
        const iconPath = resolveBadgeIconPath(badge.kind, badge.value);
        if (!iconPath) return;
        const icon = document.createElement("img");
        icon.className = "ss-profile-hovercard-badge ss-hover-badge-icon";
        icon.src = iconPath;
        icon.alt = "";
        row.appendChild(icon);
      });
    }

    if (!row.childElementCount) {
      normalizeFallbackBadgeTokens(trigger, badges).forEach((token) => {
        const icon = createFallbackBadgeSvg(token);
        if (!icon) return;
        row.appendChild(icon);
      });
    }

    row.hidden = row.childElementCount === 0;
  }

  function renderSocialRow(row, socialLinks) {
    if (!row) return;
    row.innerHTML = "";
    const links = collectSocialEntries(socialLinks);
    if (!links.length) {
      row.hidden = true;
      return;
    }
    links.forEach(({ network, url }) => {
      const anchor = document.createElement("a");
      anchor.className = "ss-profile-hovercard-social";
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.setAttribute("aria-label", network);
      const icon = document.createElement("img");
      icon.src = socialIconPath(network);
      icon.alt = "";
      anchor.appendChild(icon);
      row.appendChild(anchor);
    });
    row.hidden = false;
  }

  function setCoverImage(url, displayName) {
    const coverImage = getSlot("cover-image");
    if (!coverImage) return;
    const source = safeText(url);
    card?.classList.remove("has-cover-image");
    if (!source) {
      coverImage.hidden = true;
      coverImage.removeAttribute("src");
      return;
    }
    coverImage.hidden = false;
    coverImage.alt = `${safeText(displayName, "Public User")} cover`;
    coverImage.src = source;
  }

  function updateCardContent(profile, trigger) {
    if (!card) return;
    const avatarEl = getSlot("avatar");
    const nameEl = getSlot("name");
    const badgesEl = getSlot("badges");
    const subtitleEl = getSlot("subtitle");
    const bioEl = getSlot("bio");
    const socialRowEl = getSlot("social-row");
    const actionsEl = getSlot("actions");
    const profileLink = getSlot("profile-link");

    if (avatarEl) {
      if (profile.avatarUrl) {
        avatarEl.style.backgroundImage = `url(${profile.avatarUrl})`;
        avatarEl.textContent = "";
      } else {
        avatarEl.style.backgroundImage = "";
        avatarEl.textContent = textInitial(profile.displayName);
      }
    }

    if (nameEl) {
      nameEl.textContent = safeText(profile.displayName, "Public User");
    }
    if (badgesEl) {
      renderBadgeSuffix(badgesEl, profile.badges, trigger || activeTrigger);
    }
    if (subtitleEl) {
      subtitleEl.textContent = safeText(profile.role, "PUBLIC");
    }
    if (bioEl) {
      bioEl.textContent = safeText(profile.bio, "Profile details are being updated.");
    }
    if (socialRowEl) {
      renderSocialRow(socialRowEl, profile.socialLinks);
    }

    setCoverImage(profile.coverImageUrl, profile.displayName);

    if (actionsEl && profileLink) {
      const href = safeText(profile.profileHref);
      if (href) {
        profileLink.href = href;
        profileLink.removeAttribute("aria-disabled");
        profileLink.removeAttribute("tabindex");
      } else {
        profileLink.href = "/community/profile.html";
        profileLink.setAttribute("aria-disabled", "true");
        profileLink.setAttribute("tabindex", "-1");
      }
    }
  }

  function setLoading(isLoading) {
    if (!card) return;
    card.classList.toggle("is-loading", Boolean(isLoading));
  }

  function showCard() {
    if (!card) return;
    card.classList.add("is-visible");
    card.setAttribute("aria-hidden", "false");
  }

  function hideCard() {
    activeTrigger = null;
    cardHovered = false;
    clearHideTimer();
    abortFetch();
    if (!card) return;
    card.classList.remove("is-visible", "is-loading");
    card.setAttribute("aria-hidden", "true");
  }

  function clearHideTimer() {
    if (!hideTimer) return;
    window.clearTimeout(hideTimer);
    hideTimer = 0;
  }

  function scheduleHide() {
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      if (!cardHovered) hideCard();
    }, HIDE_DELAY_MS);
  }

  function positionCard(trigger) {
    if (!card || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    const preferRight = rect.left + cardRect.width + OFFSET <= window.innerWidth - VIEWPORT_GAP;
    const rawLeft = preferRight ? rect.left : rect.right - cardRect.width;
    const left = clamp(rawLeft, VIEWPORT_GAP, window.innerWidth - cardRect.width - VIEWPORT_GAP);

    let top = rect.bottom + OFFSET;
    if (top + cardRect.height > window.innerHeight - VIEWPORT_GAP) {
      top = rect.top - cardRect.height - OFFSET;
    }
    if (top < VIEWPORT_GAP) {
      top = clamp(rect.top + OFFSET, VIEWPORT_GAP, window.innerHeight - cardRect.height - VIEWPORT_GAP);
    }

    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }

  function mergeProfile(base, next) {
    const role = normalizeRole(next?.role || base.role);
    const merged = {
      displayName: safeText(next?.displayName, base.displayName),
      userCode: safeText(next?.userCode, base.userCode),
      userId: safeText(next?.userId, base.userId),
      avatarUrl: safeText(next?.avatarUrl, base.avatarUrl),
      role,
      bio: safeText(next?.bio, base.bio),
      profileHref: safeText(next?.profileHref, base.profileHref),
      coverImageUrl: safeText(next?.coverImageUrl, base.coverImageUrl),
      socialLinks: normalizeSocialLinks(next?.socialLinks || base.socialLinks),
      badges: normalizeBadges(next?.badges ?? base.badges, role, safeText(next?.tier || base?.tier || "core"))
    };
    return merged;
  }

  function normalizeFetchedProfile(payload, fallback) {
    const profile = payload?.profile && typeof payload.profile === "object" ? payload.profile : payload;
    const accountType = normalizeRole(profile?.account_type || profile?.accountType || profile?.role || fallback.role);
    const tier = normalizeTier(profile?.tier || "core");
    const userCode = safeText(profile?.user_code || profile?.userCode || fallback.userCode);
    const displayName = safeText(profile?.display_name || profile?.displayName || profile?.name || fallback.displayName);
    const role = normalizeRole(accountType);
    const avatarUrl = safeText(profile?.avatar_url || profile?.avatarUrl || profile?.avatar || fallback.avatarUrl);
    const bio = safeText(profile?.bio || profile?.summary || fallback.bio);
    const coverImageUrl = safeText(
      profile?.cover_image_url ||
      profile?.coverImageUrl ||
      profile?.profile_cover ||
      profile?.banner_url ||
      profile?.bannerUrl ||
      profile?.cover_url ||
      profile?.coverUrl ||
      fallback.coverImageUrl
    );
    const socialLinks = normalizeSocialLinks(profile?.social_links || profile?.socialLinks || fallback.socialLinks);
    const badges = normalizeBadges(profile?.badges, role, tier);
    const href = userCode ? `/community/profile.html?u=${encodeURIComponent(userCode)}` : fallback.profileHref;
    return {
      displayName,
      userCode,
      userId: safeText(profile?.id || fallback.userId),
      avatarUrl,
      role,
      bio,
      profileHref: href,
      coverImageUrl,
      socialLinks,
      badges,
      tier
    };
  }

  function shouldFetchProfile(profile) {
    if (!profile.userCode) return false;
    if (profileCache.has(profile.userCode)) return false;
    return true;
  }

  function abortFetch() {
    if (!fetchController) return;
    fetchController.abort();
    fetchController = null;
  }

  async function fetchProfileData(baseProfile, token) {
    if (!baseProfile.userCode) return;
    abortFetch();
    fetchController = new AbortController();
    const endpoint = new URL(PROFILE_ENDPOINT);
    endpoint.searchParams.set("u", baseProfile.userCode);

    try {
      const response = await fetch(endpoint.toString(), {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: fetchController.signal
      });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      const profile = normalizeFetchedProfile(payload, baseProfile);
      profileCache.set(profile.userCode || baseProfile.userCode, profile);

      if (token !== activeFetchToken || !activeTrigger) return;
      const merged = mergeProfile(baseProfile, profile);
      updateCardContent(merged, activeTrigger);
      setLoading(false);
      positionCard(activeTrigger);
    } catch (_err) {
      if (token === activeFetchToken) {
        setLoading(false);
      }
    } finally {
      fetchController = null;
    }
  }

  function openForTrigger(trigger) {
    if (!trigger) return;
    createCard();
    clearHideTimer();

    const initial = parseTriggerData(trigger);
    const cached = initial.userCode ? profileCache.get(initial.userCode) : null;
    const merged = cached ? mergeProfile(initial, cached) : initial;

    activeTrigger = trigger;
    updateCardContent(merged, trigger);
    setLoading(false);
    showCard();
    positionCard(trigger);

    if (!shouldFetchProfile(merged)) return;

    setLoading(true);
    activeFetchToken += 1;
    fetchProfileData(merged, activeFetchToken);
  }

  function handlePointerOver(event) {
    const trigger = getTrigger(event.target);
    if (!trigger) return;
    if (trigger === activeTrigger) return;
    openForTrigger(trigger);
  }

  function handlePointerOut(event) {
    if (!activeTrigger || !card) return;
    if (!activeTrigger.contains(event.target)) return;
    const next = event.relatedTarget;
    if (next && (activeTrigger.contains(next) || card.contains(next))) return;
    scheduleHide();
  }

  function handleFocusIn(event) {
    const trigger = getTrigger(event.target);
    if (!trigger) return;
    openForTrigger(trigger);
  }

  function handleFocusOut(event) {
    if (!card || !activeTrigger) return;
    const next = event.relatedTarget;
    if (next && (activeTrigger.contains(next) || card.contains(next))) return;
    scheduleHide();
  }

  function handleEscape(event) {
    if (event.key !== "Escape") return;
    hideCard();
  }

  function handleViewportChange() {
    if (!card || !activeTrigger || !card.classList.contains("is-visible")) return;
    positionCard(activeTrigger);
  }

  function settleThumbLoading(thumb) {
    if (!thumb) return;
    thumb.classList.remove("is-loading");
  }

  function bindThumbMediaLoading(media, thumb) {
    if (!media || !thumb) return;
    thumb.classList.add("is-loading");
    const settle = () => settleThumbLoading(thumb);
    media.addEventListener("load", settle, { once: true });
    media.addEventListener("loadeddata", settle, { once: true });
    media.addEventListener("error", settle, { once: true });
    if (media.complete || media.readyState >= 2) {
      settle();
    }
  }

  function ensureThumbSkeleton(thumb) {
    if (!thumb || thumb.dataset.ssThumbSkeletonReady === "1") return;
    thumb.dataset.ssThumbSkeletonReady = "1";

    let skeleton = thumb.querySelector(".ss-thumb-skeleton");
    if (!skeleton) {
      skeleton = document.createElement("span");
      skeleton.className = "ss-thumb-skeleton";
      skeleton.setAttribute("aria-hidden", "true");
      thumb.prepend(skeleton);
    }

    const media =
      thumb.querySelector("img") ||
      thumb.querySelector("video");

    if (!media) {
      settleThumbLoading(thumb);
      return;
    }

    bindThumbMediaLoading(media, thumb);
  }

  function initThumbSkeletons(root = document) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll(THUMB_SELECTOR).forEach((thumb) => ensureThumbSkeleton(thumb));
  }

  function observeThumbSkeletons() {
    if (!window.MutationObserver || !document.body) return;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches?.(THUMB_SELECTOR)) {
            ensureThumbSkeleton(node);
            return;
          }
          initThumbSkeletons(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    document.addEventListener("mouseover", handlePointerOver, true);
    document.addEventListener("mouseout", handlePointerOut, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", handleFocusOut, true);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    initThumbSkeletons(document);
    observeThumbSkeletons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
