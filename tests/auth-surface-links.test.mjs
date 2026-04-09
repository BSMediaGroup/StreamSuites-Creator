import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("creator login uses the collapsed alternate surface section", () => {
  const html = read("login/index.html");
  const css = read("css/overrides.css");

  assert.match(html, /Login to other surfaces/);
  assert.doesNotMatch(html, /Elsewhere/);
  assert.match(html, /Admin Dashboard/);
  assert.match(html, /Developer Console/);
  assert.match(css, /ss-auth-surface-links__icon--public/);
});

test("creator dropdown keeps the compact overview card and role-gated debug control", () => {
  const html = read("index.html");
  const authJs = read("js/auth.js");

  assert.match(html, /data-account-details-panel/);
  assert.match(html, /data-account-detail-name/);
  assert.match(html, /data-account-detail-email/);
  assert.match(html, /data-account-detail-tier/);
  assert.match(authJs, /session\?\.creatorDebug\?\.adminCapable === true/);
  assert.match(authJs, /session\?\.creatorDebug\?\.developerCapable === true/);
});

test("creator auth uses the runtime turnstile config as the single widget visibility gate", () => {
  const authJs = read("js/auth.js");

  assert.match(authJs, /payload\?\.enabled === true/);
  assert.match(authJs, /ui\.panel\.hidden = !authTurnstile\.enabled/);
  assert.match(authJs, /if \(!authTurnstile\.enabled \|\| !ui\?\.slot\)/);
  assert.match(authJs, /if \(!authTurnstile\.enabled\) return "";/);
});
