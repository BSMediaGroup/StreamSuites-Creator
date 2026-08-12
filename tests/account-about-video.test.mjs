import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Creator account editor uses Runtime/Auth for Text and Video About controls", () => {
  const html = read("views/account.html");
  const app = read("js/account-settings.js");
  assert.match(html, /data-profile-about-mode="text"/);
  assert.match(html, /data-profile-about-mode="video"/);
  assert.match(html, /data-profile-about-video-validate="true"/);
  assert.match(html, /data-profile-about-video-remove="true"/);
  assert.match(app, /PUBLIC_PROFILE_ABOUT_VIDEO_RESOLVE_ENDPOINT/);
  assert.match(app, /function normalizeAboutVideoProjection/);
  assert.match(app, /iframe = document\.createElement\("iframe"\)/);
  assert.match(app, /iframe\.loading = "lazy"/);
  assert.match(app, /about_mode: draft\.about_mode/);
  assert.match(app, /payload\.about_video_provider/);
  assert.match(app, /payload\.about_video_source_url/);
  assert.match(app, /payload\.remove_about_video/);
  assert.match(app, /https:\/\/rumble\.com\/embed\/v7bv5ia\/\?pub=vmzw3/);
  assert.doesNotMatch(app, /Paste a Rumble watch URL/);
  assert.doesNotMatch(app, /innerHTML\s*=\s*.*iframe/i);
});

test("Creator CSP retains Turnstile and permits only validated About player origins", () => {
  const headers = read("_headers");
  for (const origin of ["https://challenges.cloudflare.com", "https://www.youtube.com", "https://rumble.com", "https://player.kick.com"]) {
    assert.ok(headers.includes(origin), `missing ${origin}`);
  }
  assert.doesNotMatch(headers, /frame-src[^\n]*(?:\s\*|https:;|\*\.com)/);
  assert.doesNotMatch(headers, /frame-ancestors/);
});

test("Creator About video editor preserves the existing theme language and responsive player", () => {
  const css = read("css/creator-dashboard.css");
  assert.match(css, /\.account-about-video-frame\s*\{[\s\S]*aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(css, /var\(--profile-theme-b/);
  assert.match(css, /\.account-about-provider-selector\s*\{[\s\S]*grid-template-columns/);
});
