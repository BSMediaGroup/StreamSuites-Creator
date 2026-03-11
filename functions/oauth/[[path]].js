import { proxyAuthApiRequest } from "../_shared/auth-api-proxy.js";

const ALLOWED_OAUTH_PATHS = ["/oauth/twitch/start"];

export async function onRequest(context) {
  return proxyAuthApiRequest(context, ALLOWED_OAUTH_PATHS);
}
