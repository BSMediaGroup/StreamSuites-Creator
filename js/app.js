(() => {
  "use strict";

  if (window.App) {
    return;
  }

  const storage = {
    loadFromLocalStorage(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (err) {
        console.warn("[Dashboard][Storage] Failed to load", err);
        return fallback;
      }
    },
    saveToLocalStorage(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        console.warn("[Dashboard][Storage] Failed to save", err);
      }
    },
    downloadJson(filename, payload) {
      const data = JSON.stringify(payload ?? {}, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename || "download.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    exportJsonToDownload(filename, payload) {
      storage.downloadJson(filename, payload);
    },
    importJsonFromFile(file) {
      return new Promise((resolve, reject) => {
        if (!file) {
          reject(new Error("No file provided"));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            resolve(JSON.parse(reader.result));
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
        reader.readAsText(file);
      });
    }
  };

  window.App = {
    storage,
    state: {}
  };

  const SIDEBAR_COLLAPSE_STORAGE_KEY = "ss_admin_sidebar_collapsed";
  const SIDEBAR_COLLAPSED_CLASS = "ss-sidebar-collapsed";
  const SIDEBAR_MOBILE_OPEN_CLASS = "ss-sidebar-mobile-open";
  const SIDEBAR_MOBILE_BREAKPOINT = 980;
  const LOADER_SHOW_DELAY_MS = 120;
  const LOADER_MIN_VISIBLE_MS = 280;
  const CREATOR_LOCAL_SESSION_KEY = "streamsuites.creator.session";
  const CREATOR_COPY_FEEDBACK_MS = 1400;
  const CREATOR_VERSION_ENDPOINT = "https://admin.streamsuites.app/runtime/exports/version.json";

  const NAV_ICON_BY_SEGMENT = Object.freeze({
    overview: "/assets/icons/ui/dashboard.svg",
    statistics: "/assets/icons/ui/dashgear.svg",
    index: "/assets/icons/ui/dashboard.svg",
    account: "/assets/icons/ui/profile.svg",
    notifications: "/assets/icons/ui/bell.svg",
    plans: "/assets/icons/ui/cards.svg",
    triggers: "/assets/icons/ui/tune.svg",
    settings: "/assets/icons/ui/cog.svg",
    clips: "/assets/icons/ui/portal.svg",
    polls: "/assets/icons/ui/clickpoint.svg",
    overlays: "/assets/icons/obs-0.svg",
    livechat: "/assets/icons/ui/bot.svg",
    rumble: "/assets/icons/rumble-0.svg",
    youtube: "/assets/icons/youtube-0.svg",
    twitch: "/assets/icons/twitch-0.svg",
    kick: "/assets/icons/kick-0.svg",
    discord: "/assets/icons/discord-0.svg",
    pilled: "/assets/icons/pilled-0.svg",
    updates: "/assets/icons/ui/package.svg"
  });

  const shell = {
    app: null,
    header: null,
    headerLeft: null,
    nav: null,
    main: null,
    toggle: null,
    scrim: null,
    hasStoredPreference: false,
    resizeBound: false,
    navLoaderToken: null,
    authLoaderToken: null
  };

  const loaderState = {
    active: new Map(),
    nextId: 0,
    showTimer: null,
    hideTimer: null,
    visibleSince: 0,
    root: null,
    text: null
  };

  function isMobileViewport() {
    return window.innerWidth <= SIDEBAR_MOBILE_BREAKPOINT;
  }

  function readSidebarCollapsedPreference() {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
      if (stored === "1") return true;
      if (stored === "0") return false;
    } catch (err) {
      // Ignore localStorage failures.
    }
    return null;
  }

  function writeSidebarCollapsedPreference(collapsed) {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
      shell.hasStoredPreference = true;
    } catch (err) {
      // Ignore localStorage failures.
    }
  }

  function isSidebarCollapsed() {
    return document.documentElement.classList.contains(SIDEBAR_COLLAPSED_CLASS);
  }

  function isSidebarMobileOpen() {
    return document.body.classList.contains(SIDEBAR_MOBILE_OPEN_CLASS);
  }

  function setSidebarCollapsed(collapsed, options = {}) {
    const persist = options.persist !== false;
    document.documentElement.classList.toggle(SIDEBAR_COLLAPSED_CLASS, collapsed);
    document.body.classList.toggle(SIDEBAR_COLLAPSED_CLASS, collapsed);
    updateNavTitles();
    updateSidebarToggleState();
    if (persist) {
      writeSidebarCollapsedPreference(collapsed);
    }
  }

  function setSidebarMobileOpen(open) {
    if (!shell.nav) return;
    const nextOpen = Boolean(open);
    const mobileViewport = isMobileViewport();
    document.documentElement.classList.toggle(SIDEBAR_MOBILE_OPEN_CLASS, nextOpen);
    document.body.classList.toggle(SIDEBAR_MOBILE_OPEN_CLASS, nextOpen);

    if (shell.scrim) {
      shell.scrim.hidden = !mobileViewport || !nextOpen;
      shell.scrim.setAttribute("aria-hidden", mobileViewport && nextOpen ? "false" : "true");
    }

    shell.nav.setAttribute("aria-hidden", mobileViewport && !nextOpen ? "true" : "false");
    updateSidebarToggleState();
  }

  function resolvePageTitle() {
    const sectionHeading = document.querySelector(".section-header h2");
    if (sectionHeading?.textContent?.trim()) {
      return sectionHeading.textContent.trim();
    }

    const raw = String(document.title || "").trim();
    if (!raw) return "Creator Workspace";
    return raw
      .replace(/^StreamSuites\s*[—-]\s*/i, "")
      .replace(/\s*[—-]\s*Creator Dashboard$/i, "")
      .trim();
  }

  function normalizeRouteValue(value) {
    if (typeof value !== "string") return "";
    return value
      .trim()
      .replace(/^#+/, "")
      .replace(/^\/+/, "")
      .replace(/\.html$/i, "")
      .replace(/\/index$/i, "")
      .toLowerCase();
  }

  function resolveRouteFromUrl(urlLike) {
    if (!urlLike) return "";

    let url = null;
    if (urlLike instanceof URL) {
      url = urlLike;
    } else {
      try {
        url = new URL(String(urlLike), window.location.href);
      } catch (err) {
        return "";
      }
    }

    if (url.origin !== window.location.origin) return "";

    const hashRoute = normalizeRouteValue(url.hash);
    if (hashRoute) return hashRoute;

    const queryRoute = normalizeRouteValue(url.searchParams.get("view") || "");
    if (queryRoute) return queryRoute;

    const pathname = normalizeRouteValue(url.pathname || "");
    if (!pathname || pathname === "index") return "overview";

    if (pathname.startsWith("views/")) {
      return normalizeRouteValue(pathname.slice("views/".length));
    }

    return "";
  }

  function resolveRouteFromHref(href) {
    if (typeof href !== "string" || !href.trim()) return "";
    const routeFromHash = normalizeRouteValue(href);
    if (href.trim().startsWith("#") && routeFromHash) {
      return routeFromHash;
    }
    return resolveRouteFromUrl(href);
  }

  function resolveNavIconPath(anchor) {
    const explicitRoute = normalizeRouteValue(anchor.dataset.route || "");
    const href = anchor.getAttribute("href") || "";
    const route = explicitRoute || resolveRouteFromHref(href);
    const segment = normalizeRouteValue(route.split("/").pop() || route);
    if (segment && NAV_ICON_BY_SEGMENT[segment]) {
      return NAV_ICON_BY_SEGMENT[segment];
    }
    return "/assets/icons/ui/portal.svg";
  }

  function decorateSidebarLinks() {
    if (!shell.nav) return;
    const navLinks = shell.nav.querySelectorAll("#app-nav-list a");
    navLinks.forEach((anchor) => {
      if (anchor.dataset.navDecorated === "1") return;
      anchor.dataset.navDecorated = "1";

      const labelText = (anchor.textContent || "").trim();
      anchor.dataset.navLabel = labelText;
      if (!anchor.dataset.navBaseTitle && anchor.hasAttribute("title")) {
        anchor.dataset.navBaseTitle = anchor.getAttribute("title") || "";
      }

      anchor.textContent = "";
      const icon = document.createElement("span");
      icon.className = "creator-nav-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.style.setProperty("--creator-nav-icon", `url("${resolveNavIconPath(anchor)}")`);

      const label = document.createElement("span");
      label.className = "creator-nav-label-text";
      label.textContent = labelText;

      anchor.append(icon, label);
    });
  }

  function updateNavTitles() {
    if (!shell.nav) return;
    const collapsed = isSidebarCollapsed();
    shell.nav.querySelectorAll("a[data-nav-label]").forEach((anchor) => {
      const label = (anchor.dataset.navLabel || "").trim();
      const baseTitle = (anchor.dataset.navBaseTitle || "").trim();
      if (!label) return;
      if (collapsed && !isMobileViewport()) {
        anchor.setAttribute("title", label);
      } else if (baseTitle) {
        anchor.setAttribute("title", baseTitle);
      } else {
        anchor.removeAttribute("title");
      }
    });
  }

  function updateSidebarToggleState() {
    if (!shell.toggle) return;
    if (isMobileViewport()) {
      const open = isSidebarMobileOpen();
      const label = open ? "Close navigation menu" : "Open navigation menu";
      shell.toggle.setAttribute("aria-expanded", open ? "true" : "false");
      shell.toggle.setAttribute("aria-label", label);
      shell.toggle.setAttribute("title", label);
      return;
    }
    const collapsed = isSidebarCollapsed();
    const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
    shell.toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    shell.toggle.setAttribute("aria-label", label);
    shell.toggle.setAttribute("title", label);
  }

  function applyAutoSidebarCollapse() {
    if (shell.hasStoredPreference) return;
    setSidebarCollapsed(isMobileViewport(), { persist: false });
  }

  function onSidebarToggleClick() {
    if (isMobileViewport()) {
      setSidebarMobileOpen(!isSidebarMobileOpen());
      return;
    }
    setSidebarCollapsed(!isSidebarCollapsed(), { persist: true });
  }

  function ensureSidebarToggle() {
    if (!shell.headerLeft) return;
    const toggle =
      document.getElementById("sidebar-collapse-toggle") ||
      shell.headerLeft.querySelector("#sidebar-collapse-toggle");
    if (!toggle) return;
    if (toggle.dataset.sidebarBound !== "1") {
      toggle.dataset.sidebarBound = "1";
      toggle.addEventListener("click", onSidebarToggleClick);
    }
    shell.toggle = toggle;
    updateSidebarToggleState();
  }

  function ensureTopbarTitle() {
    if (!shell.headerLeft) return;
    const titleNode = shell.headerLeft.querySelector(".creator-topbar-page-title");
    if (!titleNode) return;
    titleNode.textContent = resolvePageTitle();
  }

  function ensureSidebarScrim() {
    if (!shell.app || shell.scrim) return;
    const scrim =
      shell.app.querySelector(".creator-sidebar-scrim") ||
      document.querySelector(".creator-sidebar-scrim");
    if (!scrim) return;
    scrim.hidden = true;
    scrim.setAttribute("aria-hidden", "true");
    scrim.setAttribute("aria-label", "Close navigation menu");
    if (scrim.dataset.sidebarBound !== "1") {
      scrim.dataset.sidebarBound = "1";
      scrim.addEventListener("click", () => {
        setSidebarMobileOpen(false);
      });
    }
    shell.scrim = scrim;
  }

  function bindSidebarBehavior() {
    if (!shell.nav) return;
    const storedPreference = readSidebarCollapsedPreference();
    shell.hasStoredPreference = storedPreference !== null;
    const initialCollapsed =
      storedPreference !== null ? storedPreference : isMobileViewport();
    setSidebarCollapsed(initialCollapsed, { persist: false });
    setSidebarMobileOpen(false);

    if (!shell.resizeBound) {
      shell.resizeBound = true;
      window.addEventListener(
        "resize",
        () => {
          syncHeaderHeightVar();
          if (!isMobileViewport()) {
            setSidebarMobileOpen(false);
          }
          applyAutoSidebarCollapse();
          updateNavTitles();
          updateSidebarToggleState();
        },
        { passive: true }
      );
    }

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!isSidebarMobileOpen()) return;
      setSidebarMobileOpen(false);
      shell.toggle?.focus();
    });

    shell.nav.addEventListener("click", (event) => {
      const anchor = event.target.closest("a[href]");
      if (!anchor) return;
      if (isMobileViewport()) {
        setSidebarMobileOpen(false);
      }
    });
  }

  function syncHeaderHeightVar() {
    const height = shell.header?.offsetHeight || 0;
    if (!height) return;
    document.documentElement.style.setProperty("--creator-shell-header-height", `${height}px`);
  }

  function ensureGlobalLoaderDom() {
    if (!shell.app) return;
    const root = document.getElementById("global-loader");
    if (!root) return;
    loaderState.root = root;
    loaderState.text = document.getElementById("global-loader-text");
  }

  function clearLoaderTimer(key) {
    if (!loaderState[key]) return;
    clearTimeout(loaderState[key]);
    loaderState[key] = null;
  }

  function renderLoader() {
    if (!loaderState.root) return;
    const active = loaderState.active.size > 0;
    const visible = loaderState.visibleSince > 0;
    loaderState.root.classList.toggle("is-active", visible);
    loaderState.root.setAttribute("aria-hidden", visible ? "false" : "true");
    if (shell.main) {
      shell.main.setAttribute("aria-busy", active ? "true" : "false");
    }
    if (loaderState.text) {
      loaderState.text.textContent = active ? "Loading..." : "Idle";
    }
  }

  function scheduleLoaderHide() {
    clearLoaderTimer("hideTimer");
    if (!loaderState.visibleSince) return;
    const elapsed = Date.now() - loaderState.visibleSince;
    const remaining = Math.max(0, LOADER_MIN_VISIBLE_MS - elapsed);
    loaderState.hideTimer = window.setTimeout(() => {
      loaderState.hideTimer = null;
      loaderState.visibleSince = 0;
      renderLoader();
    }, remaining);
  }

  function showLoaderSoon() {
    clearLoaderTimer("showTimer");
    if (loaderState.visibleSince > 0) return;
    loaderState.showTimer = window.setTimeout(() => {
      loaderState.showTimer = null;
      if (!loaderState.active.size) return;
      loaderState.visibleSince = Date.now();
      renderLoader();
    }, LOADER_SHOW_DELAY_MS);
  }

  function startLoading(reason = "Loading...") {
    const token = `creator-loader-${Date.now()}-${++loaderState.nextId}`;
    loaderState.active.set(token, {
      reason: String(reason || "Loading..."),
      startedAt: Date.now()
    });
    if (loaderState.active.size === 1) {
      showLoaderSoon();
      renderLoader();
    }
    return token;
  }

  function stopLoading(token) {
    if (typeof token === "string" && loaderState.active.has(token)) {
      loaderState.active.delete(token);
    } else if (token == null && loaderState.active.size) {
      const firstToken = loaderState.active.keys().next().value;
      loaderState.active.delete(firstToken);
    }

    if (!loaderState.active.size) {
      clearLoaderTimer("showTimer");
      scheduleLoaderHide();
      return;
    }
    renderLoader();
  }

  function bindNavigationLoader() {
    document.addEventListener("click", (event) => {
      const anchor = event.target.closest("a[href]");
      if (!anchor) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.getAttribute("target") === "_blank") return;

      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#")) return;

      let url;
      try {
        url = new URL(href, window.location.href);
      } catch (err) {
        return;
      }
      if (anchor.dataset.route || resolveRouteFromUrl(url)) {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash === window.location.hash
      ) {
        return;
      }

      if (shell.navLoaderToken) {
        stopLoading(shell.navLoaderToken);
      }
      shell.navLoaderToken = startLoading("Loading page...");
    });

    window.addEventListener("pageshow", () => {
      if (shell.navLoaderToken) {
        stopLoading(shell.navLoaderToken);
        shell.navLoaderToken = null;
      }
    });
  }

  function bindAuthLoaderLifecycle() {
    window.addEventListener("streamsuites:auth-init-start", () => {
      if (shell.authLoaderToken) return;
      shell.authLoaderToken = startLoading("Loading creator session...");
    });

    window.addEventListener("streamsuites:auth-init-complete", () => {
      if (!shell.authLoaderToken) return;
      stopLoading(shell.authLoaderToken);
      shell.authLoaderToken = null;
    });
  }

  function initGlobalLoader() {
    ensureGlobalLoaderDom();
    renderLoader();
    bindNavigationLoader();
    bindAuthLoaderLifecycle();
    window.StreamSuitesGlobalLoader = {
      startLoading,
      stopLoading,
      async trackAsync(task, reason = "Loading...") {
        const token = startLoading(reason);
        try {
          if (typeof task === "function") {
            return await task();
          }
          return await task;
        } finally {
          stopLoading(token);
        }
      },
      getActiveCount() {
        return loaderState.active.size;
      }
    };
  }

  function readCreatorIdFromSession() {
    const sessionCode = window.App?.session?.user_code;
    if (typeof sessionCode === "string" && sessionCode.trim()) {
      return sessionCode.trim();
    }

    try {
      const raw = window.localStorage.getItem(CREATOR_LOCAL_SESSION_KEY);
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      const localCode = parsed?.user_code;
      if (typeof localCode === "string" && localCode.trim()) {
        return localCode.trim();
      }
    } catch (err) {
      // Ignore malformed local session payloads.
    }

    return "";
  }

  async function copyTextToClipboard(text) {
    const payload = String(text || "");
    if (!payload) return false;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(payload);
        return true;
      }
    } catch (err) {
      // Fallback handled below.
    }

    try {
      const area = document.createElement("textarea");
      area.value = payload;
      area.setAttribute("readonly", "true");
      area.style.position = "fixed";
      area.style.top = "-9999px";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.focus();
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return copied;
    } catch (err) {
      return false;
    }
  }

  function formatCreatorVersion(value) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return "—";
    return /^v/i.test(raw) ? raw : `v${raw}`;
  }

  function normalizeCreatorBuild(value) {
    const raw = typeof value === "string" ? value.trim() : "";
    return raw || "—";
  }

  async function fetchCreatorFooterVersionData() {
    if (window.Versioning && typeof window.Versioning.fetchVersionData === "function") {
      try {
        const payload = await window.Versioning.fetchVersionData();
        if (payload && typeof payload === "object") {
          return payload;
        }
      } catch (err) {
        // Fall back to direct fetch.
      }
    }

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller ? window.setTimeout(() => controller.abort(), 4000) : null;

    try {
      const response = await fetch(CREATOR_VERSION_ENDPOINT, {
        cache: "no-store",
        signal: controller ? controller.signal : undefined
      });
      if (!response.ok) return null;
      const payload = await response.json();
      if (!payload || typeof payload !== "object") return null;
      return payload;
    } catch (err) {
      return null;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async function syncCreatorFooterVersion(footer) {
    const versionEl = footer.querySelector(".creator-footer-version-trigger");
    const fullEl = footer.querySelector("[data-footer-version-tooltip=\"full\"]");
    if (!versionEl || !fullEl) return;

    const data = await fetchCreatorFooterVersionData();
    const version = formatCreatorVersion(data?.version);
    const build = normalizeCreatorBuild(data?.build);
    versionEl.textContent = `Dashboard ${version}`;
    fullEl.textContent = `Dashboard ${version} • build ${build}`;
  }

  function buildCreatorFooterMarkup() {
    return `
      <div class="creator-footer-left">
        <span class="creator-footer-title">StreamSuites Creator</span>
        <span class="creator-footer-user-code" data-creator-user-code data-empty="true" aria-label="Creator ID">--</span>
        <button
          type="button"
          class="creator-footer-copy"
          data-creator-copy
          aria-label="Copy Creator ID"
          disabled
        >
          <span
            class="creator-footer-copy-tooltip"
            data-text-initial="Copy to clipboard"
            data-text-end="Copied!"
            aria-hidden="true"
          ></span>
          <span class="creator-footer-copy-icons" aria-hidden="true">
            <svg viewBox="0 0 6.35 6.35" width="14" height="14" class="creator-footer-copy-clipboard">
              <path
                fill="currentColor"
                d="M2.43.265c-.3 0-.548.236-.573.53h-.328a.74.74 0 0 0-.735.734v3.822a.74.74 0 0 0 .735.734H4.82a.74.74 0 0 0 .735-.734V1.529a.74.74 0 0 0-.735-.735h-.328a.58.58 0 0 0-.573-.53zm0 .529h1.49c.032 0 .049.017.049.049v.431c0 .032-.017.049-.049.049H2.43c-.032 0-.05-.017-.05-.049V.843c0-.032.018-.05.05-.05zm-.901.53h.328c.026.292.274.528.573.528h1.49a.58.58 0 0 0 .573-.529h.328a.2.2 0 0 1 .206.206v3.822a.2.2 0 0 1-.206.205H1.53a.2.2 0 0 1-.206-.205V1.529a.2.2 0 0 1 .206-.206z"
              ></path>
            </svg>
            <svg viewBox="0 0 24 24" width="13" height="13" class="creator-footer-copy-check">
              <path
                fill="currentColor"
                d="M9.707 19.121a.997.997 0 0 1-1.414 0l-5.646-5.647a1.5 1.5 0 0 1 0-2.121l.707-.707a1.5 1.5 0 0 1 2.121 0L9 14.171l9.525-9.525a1.5 1.5 0 0 1 2.121 0l.707.707a1.5 1.5 0 0 1 0 2.121z"
              ></path>
            </svg>
          </span>
        </button>
      </div>
      <div class="creator-footer-center">
        <span class="footer-version-tooltip-container">
          <button
            id="footer-version"
            type="button"
            class="creator-footer-version creator-footer-version-trigger"
            aria-describedby="footer-version-tooltip"
            data-version-format="Dashboard {{version}}"
            data-version-unavailable="Dashboard —"
          >
            Dashboard —
          </button>
          <div class="footer-version-tooltip" id="footer-version-tooltip" role="tooltip">
            <div
              class="footer-version-tooltip-line"
              data-footer-version-tooltip="full"
              data-version-format="Dashboard {{version}} • build {{build}}"
              data-version-unavailable="Dashboard — • build —"
            >
              Dashboard — • build —
            </div>
          </div>
        </span>
        <span class="creator-footer-divider" aria-hidden="true">•</span>
        <a
          class="creator-footer-copyright"
          href="https://brainstream.media"
          target="_blank"
          rel="noopener noreferrer"
        >
          © 2026 Brainstream Media Group
        </a>
      </div>
      <div class="creator-footer-right">
        <a
          class="creator-footer-support"
          href="https://streamsuites.app/support.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          SUPPORT
        </a>
        <span class="creator-footer-status-slot" data-status-slot data-status-slot-mode="inline"></span>
      </div>
    `;
  }

  function initCreatorFooter() {
    const footer = document.getElementById("app-footer");
    if (!footer || !footer.classList.contains("creator-footer")) return;

    if (footer.dataset.creatorFooterReady !== "1") {
      const existingStatus = footer.querySelector("#ss-status-indicator");
      if (existingStatus) {
        existingStatus.remove();
      }

      footer.innerHTML = buildCreatorFooterMarkup();

      if (existingStatus) {
        const statusSlot = footer.querySelector("[data-status-slot]");
        if (statusSlot) {
          statusSlot.appendChild(existingStatus);
          existingStatus.dataset.layout = "inline";
        }
      }

      footer.dataset.creatorFooterReady = "1";
    }

    const codeEl = footer.querySelector("[data-creator-user-code]");
    const copyBtn = footer.querySelector("[data-creator-copy]");
    if (!codeEl || !copyBtn) return;

    const syncCreatorId = () => {
      const userCode = readCreatorIdFromSession();
      if (userCode) {
        codeEl.textContent = userCode;
        codeEl.dataset.empty = "false";
        copyBtn.disabled = false;
        copyBtn.dataset.creatorCode = userCode;
      } else {
        codeEl.textContent = "--";
        codeEl.dataset.empty = "true";
        copyBtn.disabled = true;
        delete copyBtn.dataset.creatorCode;
      }
    };

    if (copyBtn.dataset.bound !== "1") {
      let copyTimer = null;

      copyBtn.addEventListener("click", async () => {
        const userCode = copyBtn.dataset.creatorCode || "";
        if (!userCode) return;
        const copied = await copyTextToClipboard(userCode);
        if (!copied) return;

        copyBtn.dataset.copied = "1";
        if (copyTimer) {
          clearTimeout(copyTimer);
        }
        copyTimer = window.setTimeout(() => {
          copyBtn.dataset.copied = "0";
        }, CREATOR_COPY_FEEDBACK_MS);
      });

      copyBtn.addEventListener("blur", () => {
        if (copyBtn.dataset.copied === "1") {
          copyBtn.dataset.copied = "0";
        }
      });

      copyBtn.dataset.bound = "1";
    }

    syncCreatorId();
    void syncCreatorFooterVersion(footer);

    if (footer.dataset.creatorFooterSessionBound !== "1") {
      window.addEventListener("streamsuites:auth-init-complete", syncCreatorId);
      window.addEventListener("focus", syncCreatorId);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          syncCreatorId();
        }
      });
      footer.dataset.creatorFooterSessionBound = "1";
    }
  }

  function initCreatorShell() {
    shell.app = document.getElementById("app") || document.querySelector(".creator-app");
    if (!shell.app) return;

    shell.header = document.getElementById("app-header") || shell.app.querySelector(".creator-header");
    shell.headerLeft = shell.header?.querySelector(".creator-header-left") || shell.app.querySelector(".creator-header-left");
    shell.nav = document.getElementById("app-nav") || shell.app.querySelector(".creator-nav");
    shell.main = document.getElementById("app-main") || shell.app.querySelector(".creator-main");

    initGlobalLoader();
    initCreatorFooter();
    syncHeaderHeightVar();

    if (!shell.nav || !shell.headerLeft) return;
    decorateSidebarLinks();
    ensureSidebarToggle();
    ensureTopbarTitle();
    ensureSidebarScrim();
    bindSidebarBehavior();
    updateNavTitles();

    window.App.creatorShell = {
      resolveRouteFromHref,
      resolveRouteFromUrl,
      setTopbarTitle(title) {
        if (!shell.headerLeft) return;
        const titleNode = shell.headerLeft.querySelector(".creator-topbar-page-title");
        if (!titleNode) return;
        const text = typeof title === "string" ? title.trim() : "";
        titleNode.textContent = text || resolvePageTitle();
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCreatorShell, { once: true });
  } else {
    initCreatorShell();
  }
})();
