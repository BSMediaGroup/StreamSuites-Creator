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
  "/scoreboards",
  "/tallies",
  "/design"
]);

const PREFIX_CREATOR_ROUTES = ["/integrations/", "/modules/", "/platforms/"];

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
  if (EXACT_CREATOR_ROUTES.has(normalized)) {
    return true;
  }

  return PREFIX_CREATOR_ROUTES.some((prefix) => normalized.startsWith(prefix));
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

  const shellResponse = await context.next(SPA_SHELL_PATH);
  if (!shellResponse.ok) {
    return response;
  }

  return buildFallbackResponse(shellResponse, request.method);
}
