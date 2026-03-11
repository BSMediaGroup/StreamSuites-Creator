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
  return proxyAuthApiRequest(context, ALLOWED_AUTH_PATHS);
}
