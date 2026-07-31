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

  assert.match(html, /src="\/assets\/logos\/ssmainlogosq\.webp"/);
  assert.match(html, /data-account-details-panel/);
  assert.match(html, /data-account-detail-name/);
  assert.match(html, /data-account-detail-email/);
  assert.match(html, /data-account-detail-tier/);
  assert.match(authJs, /session\?\.creatorDebug\?\.adminCapable === true/);
  assert.match(authJs, /session\?\.creatorDebug\?\.developerCapable === true/);
});

test("creator sidebar brand keeps the Studio-family font and left-aligned square mark", () => {
  const css = read("css/studio-first-system.css");

  assert.match(css, /#app-nav \.creator-title\s*\{[\s\S]*font-family:\s*var\(--ss-font-display\);[\s\S]*font-weight:\s*var\(--ss-weight-display-bold\);[\s\S]*font-variation-settings:\s*"wdth" 100;[\s\S]*letter-spacing:\s*-0\.025em;[\s\S]*line-height:\s*1;/);
  assert.match(css, /#app-nav \.creator-dashboard-badge\s*\{[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;[\s\S]*min-height:\s*17px;[\s\S]*padding:\s*3px 5px;[\s\S]*font-family:\s*var\(--ss-font-display\);[\s\S]*line-height:\s*1;/);
  assert.match(css, /#app-nav \.ss-sidebar-brand \.header-left a\s*\{[\s\S]*justify-content:\s*flex-start;[\s\S]*gap:\s*10px;/);
  assert.match(css, /#app-nav \.ss-sidebar-brand \.creator-logo-img\s*\{[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;[\s\S]*object-fit:\s*contain;/);
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
  assert.match(authJs, /function isUsableProfileImageUrl\(value\)/);
  assert.match(authJs, /profileMedia\.provider_picture/);
  assert.match(authJs, /media\.provider_picture/);
  assert.match(authJs, /find\(isUsableProfileImageUrl\)/);
  assert.match(authJs, /!source\.includes\("\/assets\/icons\/ui\/profile\.svg"\)/);
  assert.match(authJs, /const imageContract = normalizedImageContract\(sessionSource, payload\)/);
  assert.match(authJs, /avatar: imageContract\.avatarUrl/);
  assert.match(authJs, /imageVersion: imageContract\.imageVersion/);
  assert.match(authJs, /imageEl\.onerror = \(\) => \{/);
  const stableImageHelper = authJs.match(/function stableImageUrl\(url, cacheKey\)[\s\S]*?\n  }\n\n  function isUsableProfileImageUrl/)?.[0] || "";
  assert.doesNotMatch(stableImageHelper, /Date\.now\(\)/);
  assert.match(stableImageHelper, /parsed\.origin !== window\.location\.origin\) return source/);
});
