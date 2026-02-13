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

  const NAV_ICON_BY_SEGMENT = Object.freeze({
    index: "/assets/icons/ui/dashboard.svg",
    account: "/assets/icons/ui/profile.svg",
    plans: "/assets/icons/ui/cards.svg",
    triggers: "/assets/icons/ui/tune.svg",
    settings: "/assets/icons/ui/cog.svg",
    rumble: "/assets/icons/ui/globe.svg",
    youtube: "/assets/icons/ui/globe.svg",
    twitch: "/assets/icons/ui/globe.svg",
    kick: "/assets/icons/ui/globe.svg",
    pilled: "/assets/icons/ui/globe.svg",
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
    document.documentElement.classList.toggle(SIDEBAR_MOBILE_OPEN_CLASS, nextOpen);
    document.body.classList.toggle(SIDEBAR_MOBILE_OPEN_CLASS, nextOpen);

    if (shell.scrim) {
      shell.scrim.hidden = !nextOpen;
      shell.scrim.setAttribute("aria-hidden", nextOpen ? "false" : "true");
    }

    shell.nav.setAttribute("aria-hidden", nextOpen ? "false" : "true");
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

  function resolveNavIconPath(anchor) {
    const href = anchor.getAttribute("href") || "";
    if (!href) return "/assets/icons/ui/cog.svg";
    try {
      const url = new URL(href, window.location.origin);
      const segments = url.pathname.split("/").filter(Boolean);
      const last = (segments[segments.length - 1] || "").replace(/\.html$/i, "").toLowerCase();
      if (NAV_ICON_BY_SEGMENT[last]) return NAV_ICON_BY_SEGMENT[last];
    } catch (err) {
      // Fall through to default icon.
    }
    return "/assets/icons/ui/cog.svg";
  }

  function decorateSidebarLinks() {
    if (!shell.nav) return;
    const navLinks = shell.nav.querySelectorAll("a");
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
    let toggle = shell.headerLeft.querySelector("#sidebar-collapse-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.id = "sidebar-collapse-toggle";
      toggle.className = "sidebar-collapse-toggle";
      toggle.setAttribute("aria-controls", "app-nav");
      toggle.innerHTML =
        '<span class="sidebar-collapse-toggle-icon" aria-hidden="true"></span><span class="sr-only">Toggle sidebar</span>';
      shell.headerLeft.prepend(toggle);
    }
    if (toggle.dataset.sidebarBound !== "1") {
      toggle.dataset.sidebarBound = "1";
      toggle.addEventListener("click", onSidebarToggleClick);
    }
    shell.toggle = toggle;
    updateSidebarToggleState();
  }

  function ensureTopbarTitle() {
    if (!shell.headerLeft) return;
    let titleNode = shell.headerLeft.querySelector(".creator-topbar-page-title");
    if (!titleNode) {
      titleNode = document.createElement("span");
      titleNode.className = "creator-topbar-page-title";
      shell.headerLeft.append(titleNode);
    }
    titleNode.textContent = resolvePageTitle();
  }

  function ensureSidebarScrim() {
    if (!shell.app || shell.scrim) return;
    const scrim = document.createElement("button");
    scrim.type = "button";
    scrim.className = "creator-sidebar-scrim";
    scrim.hidden = true;
    scrim.setAttribute("aria-label", "Close navigation menu");
    scrim.setAttribute("aria-hidden", "true");
    scrim.addEventListener("click", () => {
      setSidebarMobileOpen(false);
    });
    shell.app.append(scrim);
    shell.scrim = scrim;
  }

  function bindSidebarBehavior() {
    if (!shell.nav) return;
    const storedPreference = readSidebarCollapsedPreference();
    shell.hasStoredPreference = storedPreference !== null;
    const initialCollapsed =
      storedPreference !== null ? storedPreference : isMobileViewport();
    setSidebarCollapsed(initialCollapsed, { persist: false });

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
    let root = document.getElementById("global-loader");
    if (!root) {
      root = document.createElement("div");
      root.id = "global-loader";
      root.className = "ss-global-loader";
      root.setAttribute("role", "status");
      root.setAttribute("aria-live", "polite");
      root.setAttribute("aria-hidden", "true");
      root.innerHTML =
        '<div class="ss-global-loader-track" aria-hidden="true"><span class="ss-global-loader-bar"></span></div><span id="global-loader-text" class="ss-global-loader-text">Loading...</span>';
      shell.header?.insertAdjacentElement("afterend", root);
    }
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

  function initCreatorShell() {
    shell.app = document.querySelector(".creator-app");
    if (!shell.app) return;

    shell.header = shell.app.querySelector(".creator-header");
    shell.headerLeft = shell.app.querySelector(".creator-header-left");
    shell.nav = shell.app.querySelector(".creator-nav");
    shell.main = shell.app.querySelector(".creator-main");

    if (shell.nav) {
      shell.nav.id = "app-nav";
      shell.app.classList.add("has-shell");
    }
    if (shell.main) {
      shell.main.id = "app-main";
    }

    if (shell.header) {
      shell.header.id = "app-header";
    }

    initGlobalLoader();
    syncHeaderHeightVar();

    if (!shell.nav || !shell.headerLeft) return;
    decorateSidebarLinks();
    ensureSidebarToggle();
    ensureTopbarTitle();
    ensureSidebarScrim();
    bindSidebarBehavior();
    updateNavTitles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCreatorShell, { once: true });
  } else {
    initCreatorShell();
  }
})();
