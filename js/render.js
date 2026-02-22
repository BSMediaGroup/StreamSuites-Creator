(() => {
  "use strict";

  const DEFAULT_ROUTE = "overview";
  const VIEW_FETCH_TIMEOUT_MS = 2500;
  const BLOCKED_ROUTES = new Set(["onboarding"]);
  const CORE_SHELL_SCRIPTS = new Set([
    "/js/app.js",
    "/js/auth.js",
    "/js/state.js",
    "/js/render.js",
    "/js/status-widget.js",
    "/js/utils/versioning.js",
    "/js/utils/version-stamp.js"
  ]);

  const scriptLoader = {
    cache: new Map()
  };

  const routerState = {
    mounted: false,
    currentRoute: "",
    requestId: 0
  };

  const ViewScripts = Object.freeze({
    overview: ["/js/utils/stats-formatting.js", "/js/creator-stats.js"],
    statistics: ["/js/utils/stats-formatting.js", "/js/creator-stats.js"],
    plans: ["/js/plans.js"],
    triggers: ["/js/feature-gate.js", "/js/triggers.js"],
    settings: ["/js/platforms.js", "/js/settings.js"],
    creators: ["/js/creators.js"],
    jobs: ["/js/jobs.js"]
  });

  function getApp() {
    window.App = window.App || {};
    window.App.views = window.App.views || {};
    return window.App;
  }

  function registerView(route, config = {}) {
    const normalized = normalizeRoute(route);
    if (!normalized) return;
    const app = getApp();
    app.views[normalized] = {
      route: normalized,
      templatePath: config.templatePath || normalized,
      controllerName: config.controllerName || "",
      scripts: Array.isArray(config.scripts) ? config.scripts.slice() : []
    };
  }

  function toPascalCase(value) {
    return String(value || "")
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  function normalizeRoute(rawRoute) {
    if (typeof rawRoute !== "string") return "";
    let route = decodeURIComponent(rawRoute.trim()).toLowerCase();
    if (!route) return "";

    route = route
      .replace(/^[#!]+/, "")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "")
      .replace(/\.html$/i, "");

    if (!route) {
      return "";
    }
    if (route === "index" || route === "home") {
      return DEFAULT_ROUTE;
    }
    if (route.startsWith("views/")) {
      route = route.slice("views/".length);
    }
    if (route.endsWith("/index")) {
      route = route.slice(0, -"/index".length);
    }

    return route || DEFAULT_ROUTE;
  }

  function normalizeAssetPath(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
      const url = new URL(trimmed, window.location.origin);
      return url.pathname.toLowerCase();
    } catch (err) {
      return trimmed.toLowerCase();
    }
  }

  function parseRouteFromUrl(url) {
    if (!url || !(url instanceof URL)) return "";
    if (url.origin !== window.location.origin) return "";

    const hashRoute = normalizeRoute(url.hash);
    if (hashRoute) return hashRoute;

    const queryRoute = normalizeRoute(url.searchParams.get("view") || "");
    if (queryRoute) return queryRoute;

    const pathname = (url.pathname || "").toLowerCase();
    if (pathname === "/" || pathname === "/index.html") {
      return DEFAULT_ROUTE;
    }
    if (!pathname.startsWith("/views/") || !pathname.endsWith(".html")) {
      return "";
    }
    return normalizeRoute(pathname.slice("/views/".length));
  }

  function resolveRouteFromHref(href) {
    if (typeof href !== "string" || !href.trim()) return "";
    const appResolver = window.App?.creatorShell?.resolveRouteFromHref;
    if (typeof appResolver === "function") {
      const resolved = normalizeRoute(appResolver(href));
      if (resolved) return resolved;
    }

    const trimmed = href.trim();
    if (trimmed.startsWith("#")) {
      return normalizeRoute(trimmed);
    }

    try {
      const url = new URL(trimmed, window.location.href);
      return parseRouteFromUrl(url);
    } catch (err) {
      return "";
    }
  }

  function getCurrentHashRoute() {
    return normalizeRoute(window.location.hash);
  }

  function setActiveNavState(route) {
    const normalized = normalizeRoute(route);
    document.querySelectorAll("#app-nav-list a[data-route], #app-nav-list a[href]").forEach((anchor) => {
      const declared = normalizeRoute(anchor.getAttribute("data-route") || "");
      const resolved = declared || resolveRouteFromHref(anchor.getAttribute("href") || "");
      anchor.classList.toggle("is-active", Boolean(normalized && resolved === normalized));
    });
  }

  function updateTopbarTitle(route) {
    if (normalizeRoute(route) === "notifications") {
      window.App?.creatorShell?.setTopbarTitle?.("NOTIFICATIONS CENTER");
      return;
    }

    const container = document.getElementById("view-container");
    const primaryHeading =
      container?.querySelector(
        ".creator-section .section-header h2, .ss-header .ss-subtitle, .section-header h2, .ss-panel-header h2"
      ) || null;
    const titleText = (primaryHeading?.textContent || "").trim();
    if (window.App?.creatorShell?.setTopbarTitle) {
      window.App.creatorShell.setTopbarTitle(titleText || toPascalCase(route));
    }
  }

  function showNotFound(route) {
    const container = document.getElementById("view-container");
    if (!container) return;
    container.innerHTML = `
      <section class="creator-section">
        <div class="section-header">
          <div>
            <span class="section-kicker">Not found</span>
            <h2>View unavailable</h2>
            <p class="section-subtext">
              No creator view is mapped for <code>#${escapeHtml(route)}</code>.
            </p>
          </div>
        </div>
      </section>
    `;
    setActiveNavState("");
    if (window.App?.creatorShell?.setTopbarTitle) {
      window.App.creatorShell.setTopbarTitle("Not found");
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function ensureScriptLoaded(src) {
    const pathname = normalizeAssetPath(src);
    if (!pathname || CORE_SHELL_SCRIPTS.has(pathname)) return;

    const absolute = new URL(src, window.location.origin).toString();
    if (scriptLoader.cache.has(absolute)) {
      await scriptLoader.cache.get(absolute);
      return;
    }

    const existing = Array.from(document.querySelectorAll("script[src]")).find((node) => {
      try {
        return new URL(node.src, window.location.origin).toString() === absolute;
      } catch (err) {
        return false;
      }
    });
    if (existing) {
      const done = Promise.resolve();
      scriptLoader.cache.set(absolute, done);
      await done;
      return;
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = absolute;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script ${absolute}`));
      document.body.appendChild(script);
    });

    scriptLoader.cache.set(absolute, promise);
    await promise;
  }

  async function ensureScriptsForView(view) {
    const scripts = Array.isArray(view?.scripts) ? view.scripts : [];
    for (const src of scripts) {
      await ensureScriptLoaded(src);
    }
  }

  async function fetchViewHtml(templatePath) {
    const viewPath = `views/${templatePath}.html`;
    const viewUrl = new URL(viewPath, window.location.origin);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), VIEW_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(viewUrl, {
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const html = await response.text();
      return html;
    } finally {
      clearTimeout(timer);
    }
  }

  function extractViewMarkup(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const scopedContainer = doc.querySelector("#view-container");
    const source = scopedContainer || doc.body;
    if (!source) return html;

    const clone = source.cloneNode(true);
    clone
      .querySelectorAll(
        "script, footer#app-footer, footer.creator-footer, footer.ss-footer, .creator-sidebar-scrim"
      )
      .forEach((node) => node.remove());
    return clone.innerHTML;
  }

  function resolveControllerName(route, view) {
    if (view?.controllerName) return view.controllerName;
    const last = route.split("/").pop() || route;
    const candidate = `${toPascalCase(last)}View`;
    return candidate;
  }

  async function invokeViewInit(route, view) {
    const controllerName = resolveControllerName(route, view);
    const controller = controllerName ? window[controllerName] : null;
    if (controller && typeof controller.init === "function") {
      const result = controller.init();
      if (result && typeof result.then === "function") {
        await result;
      }
    }
    if (window.App?.featureGate?.apply) {
      window.App.featureGate.apply(document.getElementById("view-container") || document);
    }
    if (typeof window.StreamSuitesAuth?.refreshSummary === "function") {
      await window.StreamSuitesAuth.refreshSummary();
    }
  }

  function invokeViewUnload(route, view) {
    if (!route || !view) return;
    const controllerName = resolveControllerName(route, view);
    const controller = controllerName ? window[controllerName] : null;
    if (controller && typeof controller.destroy === "function") {
      try {
        controller.destroy();
      } catch (err) {
        console.warn(`[Creator] View destroy failed (${route})`, err);
      }
    }
  }

  async function loadRoute(route) {
    const app = getApp();
    const normalized = normalizeRoute(route);
    const container = document.getElementById("view-container");
    if (!container) return;

    const previousRoute = app.currentView || "";
    const previousView = previousRoute ? app.views?.[previousRoute] : null;

    const requestId = ++routerState.requestId;
    const loaderToken =
      window.StreamSuitesGlobalLoader?.startLoading?.(`Loading ${normalized} view...`) || null;

    try {
      invokeViewUnload(previousRoute, previousView);

      const view = app.views?.[normalized];
      if (!view || BLOCKED_ROUTES.has(normalized)) {
        app.currentView = "";
        routerState.currentRoute = "";
        showNotFound(normalized);
        return;
      }

      const html = await fetchViewHtml(view.templatePath);
      if (requestId !== routerState.requestId) return;

      container.innerHTML = extractViewMarkup(html);
      app.currentView = normalized;
      routerState.currentRoute = normalized;

      await ensureScriptsForView(view);
      if (requestId !== routerState.requestId) return;

      await invokeViewInit(normalized, view);
      if (requestId !== routerState.requestId) return;

      setActiveNavState(normalized);
      updateTopbarTitle(normalized);
      window.Versioning?.stampFooters?.();
    } catch (err) {
      console.error(`[Creator] Failed to load route "${normalized}"`, err);
      container.innerHTML = `
        <section class="creator-section">
          <div class="section-header">
            <div>
              <span class="section-kicker">Error</span>
              <h2>Unable to load this view</h2>
              <p class="section-subtext">
                We could not fetch <code>views/${escapeHtml(normalized)}.html</code>.
              </p>
            </div>
          </div>
        </section>
      `;
      setActiveNavState("");
      routerState.currentRoute = "";
      window.App?.creatorShell?.setTopbarTitle?.("Load error");
    } finally {
      if (loaderToken) {
        window.StreamSuitesGlobalLoader?.stopLoading?.(loaderToken);
      }
    }
  }

  function navigateToRoute(route, options = {}) {
    const normalized = normalizeRoute(route);
    if (!normalized || BLOCKED_ROUTES.has(normalized)) return;

    const current = getCurrentHashRoute();
    if (current === normalized) {
      if (options.forceReload === true) {
        void loadRoute(normalized);
      }
      return;
    }
    window.location.hash = `#${normalized}`;
  }

  function onHashChange() {
    const route = getCurrentHashRoute();
    if (!route) {
      navigateToRoute(DEFAULT_ROUTE);
      return;
    }
    void loadRoute(route);
  }

  function shouldIgnoreAnchorClick(event, anchor) {
    if (!anchor) return true;
    if (event.defaultPrevented) return true;
    if (event.button !== 0) return true;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;
    if (anchor.hasAttribute("download")) return true;
    if (anchor.getAttribute("target") === "_blank") return true;
    return false;
  }

  function bindLinkInterception() {
    document.addEventListener("click", (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (shouldIgnoreAnchorClick(event, anchor)) return;

      const rawHref = anchor.getAttribute("href") || "";
      const route = resolveRouteFromHref(rawHref);
      if (!route || BLOCKED_ROUTES.has(route)) return;

      if (
        anchor.getAttribute("aria-disabled") === "true" ||
        anchor.classList.contains("is-disabled")
      ) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      navigateToRoute(route, { forceReload: true });
    });
  }

  function registerDefaultViews() {
    registerView("overview", { scripts: ViewScripts.overview, controllerName: "OverviewView" });
    registerView("statistics", {
      scripts: ViewScripts.statistics,
      controllerName: "StatisticsView"
    });
    registerView("account");
    registerView("plans", { scripts: ViewScripts.plans, controllerName: "PlansView" });
    registerView("triggers", { scripts: ViewScripts.triggers, controllerName: "TriggersView" });
    registerView("settings", { scripts: ViewScripts.settings, controllerName: "SettingsView" });
    registerView("notifications", { controllerName: "NotificationsView" });
    registerView("updates");
    registerView("creators", { scripts: ViewScripts.creators, controllerName: "CreatorsView" });
    registerView("jobs", { scripts: ViewScripts.jobs, controllerName: "JobsView" });
    registerView("scoreboards");
    registerView("tallies");
    registerView("design");
    registerView("platforms/rumble");
    registerView("platforms/youtube");
    registerView("platforms/twitch");
    registerView("platforms/kick");
    registerView("platforms/discord");
    registerView("platforms/pilled");
    registerView("modules/clips");
    registerView("modules/polls");
    registerView("modules/overlays");
    registerView("modules/livechat");
  }

  function initRouter() {
    if (routerState.mounted) return;
    routerState.mounted = true;

    registerDefaultViews();
    bindLinkInterception();
    window.addEventListener("hashchange", onHashChange);

    const initial = getCurrentHashRoute();
    if (!initial) {
      const queryRoute = normalizeRoute(new URLSearchParams(window.location.search).get("view") || "");
      if (queryRoute && !BLOCKED_ROUTES.has(queryRoute)) {
        navigateToRoute(queryRoute);
        return;
      }
      navigateToRoute(DEFAULT_ROUTE);
      return;
    }
    void loadRoute(initial);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRouter, { once: true });
  } else {
    initRouter();
  }
})();
