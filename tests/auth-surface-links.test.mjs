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

test("creator expanded status widget presents the two read-only custom metrics", () => {
  const script = read("js/status-widget.js");
  const css = read("css/status-widget.css");

  assert.match(script, /api\.streamsuites\.app\/api\/public\/status\/diagnostics/);
  assert.match(script, /Atlassian custom metrics/);
  assert.match(script, /Core API response time/);
  assert.match(script, /Studio Room Readiness/);
  assert.match(script, /core_api_response_time/);
  assert.match(script, /studio_room_readiness/);
  assert.match(script, /diagnosticsStale/);
  assert.match(script, /Number\(coreValue\) >= 0/);
  assert.match(script, /Sanitized Runtime\/Auth projection/);
  assert.doesNotMatch(script, /manage\.statuspage|api[_-]?key|method:\s*["'](?:POST|PUT|PATCH|DELETE)/i);
  assert.match(css, /\.ss-status-metrics-grid/);
  assert.match(css, /\.ss-status-metric\[data-state='deferred'\]/);
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

test("creator sidebar brand uses direct Tektur axes and optically centered chip text", () => {
  const html = read("index.html");
  const css = read("css/studio-first-system.css");

  assert.match(html, /studio-first-system\.css\?v=20260801-creator-visual-polish/);
  assert.match(html, /class="creator-dashboard-badge-text">CREATOR DASHBOARD<\/span>/);
  assert.match(css, /#app-nav \.creator-title\s*\{[\s\S]*font-family:\s*"Tektur"[\s\S]*font-weight:\s*var\(--ss-weight-display-semibold\);[\s\S]*font-stretch:\s*96%;[\s\S]*font-variation-settings:\s*"wdth" 96, "wght" 600;[\s\S]*line-height:\s*1;/);
  assert.match(css, /#app-nav \.creator-dashboard-badge\s*\{[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;[\s\S]*height:\s*18px;[\s\S]*padding:\s*2px 6px;[\s\S]*line-height:\s*1;/);
  assert.match(css, /#app-nav \.creator-dashboard-badge-text\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*align-items:\s*center;[\s\S]*font-family:\s*var\(--ss-font-mono\);[\s\S]*line-height:\s*1;/);
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
