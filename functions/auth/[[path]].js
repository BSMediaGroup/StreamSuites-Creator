import { proxyAuthApiRequest } from "../_shared/auth-api-proxy.js";

const ALLOWED_AUTH_PATHS = [
  "/auth/session",
  "/auth/logout",
  "/auth/login/password",
  "/auth/signup/email",
  "/auth/verify/resend",
  "/auth/login/google",
  "/auth/login/github",
  "/auth/login/discord",
  "/auth/x/start",
];

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname === "/auth" || url.pathname === "/auth/") {
    return Response.redirect(`${url.origin}/login${url.search}`, 302);
  }

  if (url.pathname === "/auth/login.html") {
    return Response.redirect(`${url.origin}/login${url.search}`, 302);
  }

  if (url.pathname === "/auth/success.html") {
    return Response.redirect(`${url.origin}/login-success${url.search}`, 302);
  }

  return proxyAuthApiRequest(context, ALLOWED_AUTH_PATHS);
}
