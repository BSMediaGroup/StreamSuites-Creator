const DEFAULT_AUTH_API_ORIGIN = "https://api.streamsuites.app";
const DEFAULT_LOCAL_AUTH_API_ORIGIN = "http://127.0.0.1:18087";
const PROXY_TIMEOUT_MS = 15000;

function resolveUpstreamOrigin(env, requestUrl) {
  const requestHost = String(requestUrl?.hostname || "").trim().toLowerCase();
  const fallbackOrigin =
    requestHost === "127.0.0.1" || requestHost === "localhost"
      ? DEFAULT_LOCAL_AUTH_API_ORIGIN
      : DEFAULT_AUTH_API_ORIGIN;
  const raw = String(env?.STREAMSUITES_API_ORIGIN || fallbackOrigin).trim();
  try {
    const parsed = new URL(raw);
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error("invalid protocol");
    }
    parsed.pathname = "/";
    parsed.search = "";
    parsed.hash = "";
    return parsed;
  } catch (_error) {
    return new URL(fallbackOrigin);
  }
}

function isPathAllowed(pathname, allowedMatchers) {
  return allowedMatchers.some((matcher) => {
    if (matcher instanceof RegExp) {
      return matcher.test(pathname);
    }
    const normalized = String(matcher || "").trim();
    return normalized && pathname === normalized;
  });
}

function appendSetCookieHeaders(sourceHeaders, targetHeaders) {
  if (typeof sourceHeaders.getSetCookie === "function") {
    const values = sourceHeaders.getSetCookie();
    values.forEach((value) => targetHeaders.append("Set-Cookie", value));
    if (values.length) return;
  }

  if (typeof sourceHeaders.getAll === "function") {
    const values = sourceHeaders.getAll("Set-Cookie");
    values.forEach((value) => targetHeaders.append("Set-Cookie", value));
    if (values.length) return;
  }

  const fallback = sourceHeaders.get("Set-Cookie");
  if (fallback) {
    targetHeaders.append("Set-Cookie", fallback);
  }
}

function cloneResponseHeaders(sourceHeaders) {
  const headers = new Headers();
  for (const [name, value] of sourceHeaders.entries()) {
    if (name.toLowerCase() === "set-cookie") {
      continue;
    }
    headers.append(name, value);
  }
  appendSetCookieHeaders(sourceHeaders, headers);
  headers.set("Cache-Control", "no-store");
  return headers;
}

function buildErrorHtml(status, message) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${status} StreamSuites Auth Proxy</title>
</head>
<body>
  <main>
    <h1>Authentication unavailable</h1>
    <p>${message}</p>
  </main>
</body>
</html>`;
}

function buildProxyErrorResponse(request, status, message) {
  const accept = String(request.headers.get("Accept") || "").toLowerCase();
  if (accept.includes("text/html")) {
    return new Response(buildErrorHtml(status, message), {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  return Response.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function proxyAuthApiRequest(context, allowedMatchers) {
  const request = context.request;
  const requestUrl = new URL(request.url);
  if (!isPathAllowed(requestUrl.pathname, allowedMatchers)) {
    return buildProxyErrorResponse(request, 404, "Not Found");
  }

  const upstreamOrigin = resolveUpstreamOrigin(context.env, requestUrl);
  const upstreamUrl = new URL(requestUrl.pathname + requestUrl.search, upstreamOrigin);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-streamsuites-proxy-origin", requestUrl.origin);
  headers.set("x-streamsuites-creator-proxy", "cloudflare-pages");

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    init.signal = AbortSignal.timeout(PROXY_TIMEOUT_MS);
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstreamUrl.toString(), init);
  } catch (error) {
    const isTimeout = error?.name === "AbortError" || error?.name === "TimeoutError";
    return buildProxyErrorResponse(
      request,
      isTimeout ? 504 : 502,
      isTimeout
        ? "The StreamSuites Auth API timed out. Please try again."
        : "The StreamSuites Auth API is temporarily unavailable. Please try again.",
    );
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: cloneResponseHeaders(upstreamResponse.headers),
  });
}
