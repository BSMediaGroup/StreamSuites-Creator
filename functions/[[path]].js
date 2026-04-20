const SPA_SHELL_PATH = "/index.html";

const EXACT_CREATOR_ROUTES = new Set([
  "/",
  "/home",
  "/overview",
  "/statistics",
  "/notifications",
  "/account",
  "/integrations",
  "/plans",
  "/triggers",
  "/settings",
  "/updates",
  "/creators",
  "/jobs",
  "/wheels",
  "/leaderboards",
  "/scoreboards",
  "/tallies",
  "/design",
  "/integrations/rumble",
  "/integrations/youtube",
  "/integrations/twitch",
  "/integrations/kick",
  "/integrations/discord",
  "/integrations/pilled",
  "/modules/clips",
  "/modules/polls",
  "/modules/overlays",
  "/modules/livechat",
  "/platforms/rumble",
  "/platforms/youtube",
  "/platforms/twitch",
  "/platforms/kick",
  "/platforms/discord",
  "/platforms/pilled"
]);

function normalizePathname(pathname) {
  let normalized = typeof pathname === "string" && pathname.trim() ? pathname.trim() : "/";
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  normalized = normalized.replace(/\/{2,}/g, "/");
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, "");
  }
  return normalized || "/";
}

function isCreatorSpaRoute(pathname) {
  const normalized = normalizePathname(pathname);
  return EXACT_CREATOR_ROUTES.has(normalized);
}

function buildFallbackResponse(shellResponse, requestMethod) {
  const headers = new Headers(shellResponse.headers);
  headers.set("x-ss-spa-fallback", "pages-function");
  headers.delete("content-length");
  return new Response(requestMethod === "HEAD" ? null : shellResponse.body, {
    status: 200,
    headers
  });
}

async function fetchSpaShellResponse(context) {
  const { env, request } = context;
  const assetUrl = new URL(request.url);
  assetUrl.pathname = SPA_SHELL_PATH;
  assetUrl.search = "";
  assetUrl.hash = "";

  if (typeof env?.ASSETS?.fetch === "function") {
    const assetRequest = new Request(assetUrl.toString(), {
      method: request.method,
      headers: request.headers
    });
    return env.ASSETS.fetch(assetRequest);
  }

  return context.next(SPA_SHELL_PATH);
}

export async function onRequest(context) {
  const response = await context.next();
  if (response.status !== 404) {
    return response;
  }

  const { request } = context;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return response;
  }

  const { pathname } = new URL(request.url);
  if (!isCreatorSpaRoute(pathname)) {
    return response;
  }

  const shellResponse = await fetchSpaShellResponse(context);
  if (!shellResponse.ok) {
    return response;
  }

  return buildFallbackResponse(shellResponse, request.method);
}
