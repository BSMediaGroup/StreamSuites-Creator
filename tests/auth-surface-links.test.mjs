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

test("creator auth consumes normalized runtime image metadata with fallback", () => {
  const authJs = read("js/auth.js");

  assert.match(authJs, /function normalizedImageContract\(source = \{\}, fallback = \{\}\)/);
  assert.match(authJs, /function stableImageUrl\(url, cacheKey\)/);
  assert.match(authJs, /provider_picture/);
  assert.match(authJs, /profile_photo_url/);
  assert.match(authJs, /public_avatar_url/);
  assert.match(authJs, /const imageContract = normalizedImageContract\(sessionSource, payload\)/);
  assert.match(authJs, /avatar: imageContract\.avatarUrl/);
  assert.match(authJs, /imageVersion: imageContract\.imageVersion/);
  assert.match(authJs, /imageEl\.onerror = \(\) => \{/);
  const stableImageHelper = authJs.match(/function stableImageUrl\(url, cacheKey\)[\s\S]*?\n  }\n\n  function normalizedImageContract/)?.[0] || "";
  assert.doesNotMatch(stableImageHelper, /Date\.now\(\)/);
  assert.match(stableImageHelper, /parsed\.origin !== window\.location\.origin\) return source/);
});
