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
  assert.match(detailJs, /\/api\/creator\/integrations\/rumble\/bot-auto-deploy/);
  assert.match(detailJs, /integration\?\.bot_auto_deploy/);
  assert.match(detailJs, /integration\?\.bot_auto_deploy_enabled/);
});
