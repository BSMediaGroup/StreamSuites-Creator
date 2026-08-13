import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Creator account editor uses Runtime/Auth for Markdown and optional video controls", () => {
  const html = read("views/account.html");
  const app = read("js/account-settings.js");
  assert.match(html, /data-profile-about-source="none"/);
  assert.match(html, /data-profile-about-source="embed"/);
  assert.match(html, /data-profile-about-source="upload"/);
  assert.match(html, /data-profile-markdown-toolbar="true"/);
  assert.match(html, /data-profile-markdown-preview-button="true"/);
  assert.match(html, /data-profile-about-video-file="true"/);
  assert.match(html, /data-profile-about-video-validate="true"/);
  assert.match(html, /data-profile-about-video-remove="true"/);
  assert.match(app, /PUBLIC_PROFILE_ABOUT_VIDEO_RESOLVE_ENDPOINT/);
  assert.match(app, /function normalizeAboutVideoProjection/);
  assert.match(app, /iframe = document\.createElement\("iframe"\)/);
  assert.match(app, /iframe\.loading = "lazy"/);
  assert.match(app, /about_video_source_type: draft\.about_video_source_type/);
  assert.match(app, /PUBLIC_PROFILE_ABOUT_PREVIEW_ENDPOINT/);
  assert.match(app, /PUBLIC_PROFILE_ABOUT_VIDEO_UPLOAD_ENDPOINT/);
  assert.match(app, /applyMarkdownAction/);
  assert.match(app, /URL\.revokeObjectURL/);
  assert.match(app, /payload\.about_video_provider/);
  assert.match(app, /payload\.about_video_source_url/);
  assert.match(app, /payload\.remove_about_video/);
  assert.match(app, /https:\/\/rumble\.com\/embed\/v7bv5ia\/\?pub=vmzw3/);
  assert.match(app, /key: "vimeo"[\s\S]*https:\/\/vimeo\.com\/76979871/);
  assert.doesNotMatch(app, /key: "kick", label: "Kick Live Channel"/);
  assert.doesNotMatch(app, /Paste a Rumble watch URL/);
  assert.doesNotMatch(app, /innerHTML\s*=\s*.*iframe/i);
});

test("Creator CSP retains Turnstile and permits only validated About player origins", () => {
  const headers = read("_headers");
  for (const origin of ["https://challenges.cloudflare.com", "https://www.youtube.com", "https://rumble.com", "https://player.vimeo.com"]) {
    assert.ok(headers.includes(origin), `missing ${origin}`);
  }
  assert.ok(!headers.includes("https://player.kick.com"), "Kick is no longer an About iframe origin in Creator");
  assert.doesNotMatch(headers, /frame-src[^\n]*(?:\s\*|https:;|\*\.com)/);
  assert.doesNotMatch(headers, /frame-ancestors/);
  assert.match(headers, /media-src 'self' blob: https:\/\/api\.streamsuites\.app https:\/\/streamsuites\.app/);
});

test("Creator About video editor preserves the existing theme language and responsive player", () => {
  const css = read("css/creator-dashboard.css");
  assert.match(css, /\.account-about-video-frame\s*\{[\s\S]*aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(css, /var\(--profile-theme-b/);
  assert.match(css, /\.account-about-provider-selector\s*\{[\s\S]*grid-template-columns/);
});
