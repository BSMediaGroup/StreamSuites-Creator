(() => {
  "use strict";

  if (window.StreamSuitesCreatorRoutes) {
    return;
  }

  const DEFAULT_ROUTE = "overview";
  const routeDefinitions = Object.freeze([
    { route: "overview", templatePath: "overview", aliases: ["", "index", "home"] },
    { route: "statistics", templatePath: "statistics" },
    { route: "notifications", templatePath: "notifications" },
    { route: "account", templatePath: "account" },
    { route: "integrations", templatePath: "integrations" },
    { route: "plans", templatePath: "plans" },
    { route: "triggers", templatePath: "triggers" },
    { route: "settings", templatePath: "settings" },
    { route: "updates", templatePath: "updates" },
    { route: "creators", templatePath: "creators" },
    { route: "jobs", templatePath: "jobs" },
    { route: "scoreboards", templatePath: "scoreboards" },
    { route: "tallies", templatePath: "tallies" },
    { route: "design", templatePath: "design" },
    {
      route: "integrations/rumble",
      templatePath: "platforms/rumble",
      aliases: ["platforms/rumble"]
    },
    {
      route: "integrations/youtube",
      templatePath: "platforms/youtube",
      aliases: ["platforms/youtube"]
    },
    {
      route: "integrations/twitch",
      templatePath: "platforms/twitch",
      aliases: ["platforms/twitch"]
    },
    {
      route: "integrations/kick",
      templatePath: "platforms/kick",
      aliases: ["platforms/kick"]
    },
    {
      route: "integrations/discord",
      templatePath: "platforms/discord",
      aliases: ["platforms/discord"]
    },
    {
      route: "integrations/pilled",
      templatePath: "platforms/pilled",
      aliases: ["platforms/pilled"]
    },
    { route: "modules/clips", templatePath: "modules/clips" },
    { route: "modules/polls", templatePath: "modules/polls" },
    { route: "modules/overlays", templatePath: "modules/overlays" },
    { route: "modules/livechat", templatePath: "modules/livechat" }
  ]);

  const definitionsByRoute = new Map();
  const aliasToRoute = new Map();

  function normalizeRouteValue(value) {
    if (typeof value !== "string") return "";

    let normalized = value.trim();
    if (!normalized) return "";

    normalized = normalized
      .replace(/^[#!]+/, "")
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "")
      .replace(/\.html$/i, "")
      .toLowerCase();

    if (!normalized) return "";
    if (normalized === "index" || normalized === "home") return DEFAULT_ROUTE;
    if (normalized.startsWith("views/")) {
      normalized = normalized.slice("views/".length);
    }
    if (normalized.endsWith("/index")) {
      normalized = normalized.slice(0, -"/index".length);
    }
    return normalized || DEFAULT_ROUTE;
  }

  function registerDefinition(definition) {
    const route = normalizeRouteValue(definition.route);
    if (!route) return;

    const templatePath = normalizeRouteValue(definition.templatePath || route);
    const aliases = Array.isArray(definition.aliases)
      ? definition.aliases.map((alias) => normalizeRouteValue(alias)).filter(Boolean)
      : [];

    const normalizedDefinition = Object.freeze({
      route,
      templatePath,
      aliases: Object.freeze(aliases)
    });

    definitionsByRoute.set(route, normalizedDefinition);
    aliasToRoute.set(route, route);
    aliases.forEach((alias) => aliasToRoute.set(alias, route));
  }

  routeDefinitions.forEach(registerDefinition);

  function getRouteDefinition(routeLike) {
    const route = resolveRoute(routeLike);
    return route ? definitionsByRoute.get(route) || null : null;
  }

  function resolveRoute(routeLike) {
    const normalized = normalizeRouteValue(routeLike);
    if (!normalized) return "";
    return aliasToRoute.get(normalized) || normalized;
  }

  function resolveKnownRoute(routeLike) {
    const resolved = resolveRoute(routeLike);
    return resolved && definitionsByRoute.has(resolved) ? resolved : "";
  }

  function routeFromPathname(pathname) {
    const rawPath = typeof pathname === "string" ? pathname.trim().toLowerCase() : "";
    if (!rawPath || rawPath === "/" || rawPath === "/index.html") {
      return DEFAULT_ROUTE;
    }
    return resolveKnownRoute(rawPath);
  }

  function resolveRouteFromUrlLike(urlLike) {
    if (!urlLike) return "";

    let url = null;
    if (urlLike instanceof URL) {
      url = urlLike;
    } else {
      try {
        url = new URL(String(urlLike), window.location.origin);
      } catch (err) {
        return resolveKnownRoute(String(urlLike));
      }
    }

    if (url.origin !== window.location.origin) return "";

    const hashRoute = resolveKnownRoute(url.hash || "");
    if (hashRoute) return hashRoute;

    const queryRoute = resolveKnownRoute(url.searchParams.get("view") || "");
    if (queryRoute) return queryRoute;

    return routeFromPathname(url.pathname || "");
  }

  function resolveRouteFromHref(href) {
    if (typeof href !== "string" || !href.trim()) return "";
    if (href.trim().startsWith("#")) {
      return resolveKnownRoute(href);
    }

    try {
      return resolveRouteFromUrlLike(new URL(href, window.location.href));
    } catch (err) {
      return resolveKnownRoute(href);
    }
  }

  function getCanonicalPath(routeLike) {
    const resolved = resolveRoute(routeLike) || DEFAULT_ROUTE;
    return `/${resolved}`;
  }

  function isLegacyUrl(urlLike) {
    let url = null;
    try {
      url = urlLike instanceof URL ? urlLike : new URL(String(urlLike), window.location.href);
    } catch (err) {
      return false;
    }

    if (url.origin !== window.location.origin) return false;
    if (url.hash) return true;
    if (url.searchParams.has("view")) return true;

    const route = routeFromPathname(url.pathname || "");
    if (!route) return false;
    return getCanonicalPath(route) !== (url.pathname || "");
  }

  window.StreamSuitesCreatorRoutes = Object.freeze({
    DEFAULT_ROUTE,
    getDefinitions() {
      return Array.from(definitionsByRoute.values());
    },
    normalizeRouteValue,
    resolveRoute,
    resolveKnownRoute,
    resolveRouteFromHref,
    resolveRouteFromUrlLike,
    routeFromPathname,
    getRouteDefinition,
    getCanonicalPath,
    isKnownRoute(routeLike) {
      return definitionsByRoute.has(resolveRoute(routeLike));
    },
    isLegacyUrl
  });
})();
