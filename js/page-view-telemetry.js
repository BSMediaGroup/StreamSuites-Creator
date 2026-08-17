(() => {
  "use strict";

  if (window.StreamSuitesCreatorPageViews) return;

  const resolveRuntimeBase = () => {
    const host = String(window.location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1"
      ? `http://${host}:18087`
      : "https://api.streamsuites.app";
  };
  const endpoint = new URL("/api/public/analytics/page-visit", `${resolveRuntimeBase()}/`).toString();
  let lastRoute = "";

  const createEventId = () => {
    try {
      if (typeof crypto?.randomUUID === "function") return `pv-${crypto.randomUUID()}`;
    } catch (_error) {
      // Use the bounded non-identity fallback below.
    }
    return `pv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  };

  const normalizeRoute = (routeLike) => {
    const helper = window.StreamSuitesCreatorRoutes;
    const route = helper?.resolveKnownRoute?.(routeLike) || helper?.resolveRoute?.(routeLike) || "";
    if (!route) return "/other";
    if (route.startsWith("wheels/")) return "/wheels/:artifact";
    return helper?.getCanonicalPath?.(route) || `/${String(route).replace(/^\/+/, "")}`;
  };

  const reportRoute = (routeLike) => {
    const path = normalizeRoute(routeLike);
    if (path === lastRoute) return false;
    lastRoute = path;
    const body = JSON.stringify({
      surface: "creator",
      path,
      event_id: createEventId(),
    });
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
        if (navigator.sendBeacon(endpoint, blob)) return true;
      }
    } catch (_error) {
      // Fall through to the bounded keepalive request.
    }
    try {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body,
        keepalive: true,
        mode: "cors",
        credentials: "omit",
      }).catch(() => {});
    } catch (_error) {
      // Telemetry never affects Creator navigation.
    }
    return true;
  };

  window.StreamSuitesCreatorPageViews = Object.freeze({ normalizeRoute, reportRoute });
})();
