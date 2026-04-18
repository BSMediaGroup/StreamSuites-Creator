import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("creator account page mounts the grouped social links editor shell", () => {
  const html = read("views/account.html");
  const accountJs = read("js/account-settings.js");

  assert.match(html, /data-social-links-editor="true"/);
  assert.match(html, /data-social-links-search="true"/);
  assert.match(html, /data-social-links-filter="configured"/);
  assert.match(html, /data-social-links-first-class-list="true"/);
  assert.match(html, /data-social-links-extended-toggle="true"/);
  assert.match(html, /Configured links/);
  assert.match(accountJs, /renderSocialLinksEditor/);
  assert.match(accountJs, /data-social-links-jump/);
  assert.match(accountJs, /Existing non-canonical keys stay preserved on save/);
});

test("creator account social editor uses the shared canonical platform registry", () => {
  const helperJs = read("js/social-platforms.js");
  const accountJs = read("js/account-settings.js");

  assert.match(accountJs, /window\.StreamSuitesSocialPlatforms/);
  assert.match(helperJs, /group: "first-class"/);
  assert.match(helperJs, /group: "extended"/);
  assert.match(helperJs, /label: "WhatsApp Channels"/);
  assert.match(helperJs, /icon: "\/assets\/icons\/whatsapp\.svg"/);
  assert.match(helperJs, /label: "Custom"/);
  assert.doesNotMatch(helperJs, /dlive/i);
});
