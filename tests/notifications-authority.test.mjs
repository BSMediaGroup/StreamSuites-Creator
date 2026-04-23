import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("creator notifications store no longer carries seed hydration branches", () => {
  const storeJs = read("js/utils/notifications-store.js");

  assert.match(storeJs, /const NOTIFICATIONS_PATH = "\/api\/creator\/notifications";/);
  assert.doesNotMatch(storeJs, /origin\s*=\s*"seed"/);
  assert.doesNotMatch(storeJs, /requestedSource === "live" \|\| requestedSource === "seed"/);
  assert.match(storeJs, /state\.unreadCount = Number\.isFinite\(payload\.unread_count\)/);
});

test("creator rumble integration detail uses the runtime bot auto-deploy authority path", () => {
  const rumbleView = read("views/platforms/rumble.html");
  const detailJs = read("js/platform-integration-detail.js");

  assert.match(rumbleView, /data-rumble-bot-autodeploy-toggle="true"/);
  assert.match(rumbleView, /data-rumble-bot-decision-summary="true"/);
  assert.match(rumbleView, /data-rumble-bot-decision-target="true"/);
  assert.match(rumbleView, /data-rumble-managed-session-pill="true"/);
  assert.match(rumbleView, /data-rumble-managed-session-alert="true"/);
  assert.match(rumbleView, /data-rumble-managed-session-timestamps="true"/);
  assert.match(rumbleView, /data-rumble-input="session_cookie_header"/);
  assert.match(rumbleView, /data-rumble-input="session_cookies_json"/);
  assert.match(detailJs, /\/api\/creator\/integrations\/rumble\/bot-auto-deploy/);
  assert.match(detailJs, /\/api\/creator\/integrations\/rumble\/secret/);
  assert.match(detailJs, /requestBody\.session_cookie_header = cookieHeaderValue/);
  assert.match(detailJs, /requestBody\.session_cookies_json = cookiesJsonValue/);
  assert.match(detailJs, /expectedSessionTypes\.every/);
  assert.match(detailJs, /safe readback did not confirm the submitted Rumble session material/);
  assert.doesNotMatch(detailJs, /session_cookie_header:\s*cookieHeaderInput/);
  assert.doesNotMatch(detailJs, /session_cookies_json:\s*cookiesJsonInput/);
  assert.match(detailJs, /integration\?\.bot_auto_deploy/);
  assert.match(detailJs, /integration\?\.bot_auto_deploy_enabled/);
  assert.match(detailJs, /integration\?\.managed_session/);
  assert.match(detailJs, /integration\?\.session_cookie_material_present/);
  assert.match(detailJs, /integration\?\.session_material_types/);
  assert.match(detailJs, /integration\?\.session_material_validation_errors/);
  assert.match(detailJs, /integration\?\.session_material_updated_at/);
  assert.match(detailJs, /auth_material_insufficient/);
  assert.match(detailJs, /last_attach_attempt_at/);
  assert.match(detailJs, /last_attach_success_at/);
  assert.match(detailJs, /last_transport_heartbeat_at/);
  assert.match(detailJs, /Only a stored `stream_key` exists/);
  assert.match(detailJs, /Waiting for live stream/);
  assert.match(detailJs, /Awaiting live stream target/);
  assert.match(detailJs, /Managed session will appear when this creator goes live/);
  assert.match(detailJs, /function renderRumbleOptionalSection/);
  assert.match(detailJs, /Optional managed-session posture detail is temporarily unavailable/);
  assert.match(detailJs, /Optional managed-dispatch detail is temporarily unavailable/);
  assert.match(detailJs, /optional_fragment_errors/);
});

test("creator integrations hub keeps runtime integration hydration authoritative even when profile or triggers are temporarily unavailable", () => {
  const hubJs = read("js/integrations-hub.js");

  assert.match(hubJs, /Promise\.allSettled/);
  assert.match(hubJs, /if \(integrationsResult\.status !== "fulfilled"\)/);
  assert.match(hubJs, /if \(triggersResult\.status !== "fulfilled"\) \{/);
  assert.match(hubJs, /state\.warnings\.push\("Trigger footing is temporarily unavailable/);
  assert.doesNotMatch(hubJs, /throw triggersResult\.reason/);
});

test("creator hovercards use the canonical compact social registry and max-8 overflow rule", () => {
  const socialPlatformsJs = read("js/social-platforms.js");
  const hovercardJs = read("assets/js/ss-profile-hovercard.js");
  const hovercardCss = read("assets/css/ss-profile-hovercard.css");

  assert.doesNotMatch(hovercardJs, /Creator surfaces intentionally do not mount profile hovercards/);
  assert.match(hovercardJs, /const TRIGGER_SELECTOR = "\.ss-profile-hover";/);
  assert.match(hovercardJs, /window\.StreamSuitesSocialPlatforms/);
  assert.match(socialPlatformsJs, /whatsappchannels/);
  assert.match(socialPlatformsJs, /icon: "\/assets\/icons\/whatsapp\.svg"/);
  assert.match(socialPlatformsJs, /applepodcasts/);
  assert.match(socialPlatformsJs, /aliases: \["x", "twitter"\]/);
  assert.match(socialPlatformsJs, /aliases: \["website", "site", "web", "url", "homepage"\]/);
  assert.match(hovercardJs, /links\.slice\(0, 8\)/);
  assert.match(hovercardJs, /overflow\.textContent = `\+\$\{links\.length - 8\}`;/);
  assert.doesNotMatch(socialPlatformsJs, /dlive/i);
  assert.match(hovercardCss, /\.social-overflow-indicator/);
});
