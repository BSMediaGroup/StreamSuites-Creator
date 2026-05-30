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
  const css = read("css/creator-dashboard.css");

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
  assert.match(accountJs, /function validateCanonicalSocialUrl/);
  assert.match(accountJs, /https:\/\/\$\{expectedHost\}\/yourhandle/);
  assert.match(helperJs, /group: "first-class"/);
  assert.match(helperJs, /group: "extended"/);
  assert.match(helperJs, /label: "WhatsApp Channels"/);
  assert.match(helperJs, /icon: "\/assets\/icons\/whatsapp\.svg"/);
  assert.match(helperJs, /key: "pickax"[\s\S]*label: "Pickax"[\s\S]*icon: "\/assets\/icons\/pickax\.svg"[\s\S]*placeholder: "https:\/\/pickax\.com\/yourhandle"/);
  assert.match(helperJs, /key: "onlyfans"[\s\S]*label: "OnlyFans"[\s\S]*icon: "\/assets\/icons\/onlyfans\.svg"[\s\S]*placeholder: "https:\/\/onlyfans\.com\/yourhandle"/);
  assert.match(helperJs, /label: "Custom"/);
  assert.doesNotMatch(helperJs, /dlive/i);
});

test("creator account page wires runtime-backed platform identity aliases", () => {
  const html = read("views/account.html");
  const accountJs = read("js/account-settings.js");
  const css = read("css/creator-dashboard.css");

  assert.match(html, /data-platform-identities-panel="true"/);
  assert.match(html, /data-public-identities-panel="true"/);
  assert.match(html, /Public IDs assigned to this account/);
  assert.match(html, /data-platform-identity-form="true"/);
  assert.match(html, /data-platform-identity-field="platform_user_id"/);
  assert.match(html, /data-platform-identity-field="chat_id"/);
  assert.match(html, /Fuzzy matching is not used/);
  assert.match(accountJs, /PLATFORM_IDENTITIES_ENDPOINT = `\$\{API_BASE\}\/api\/account\/platform-identities`/);
  assert.match(accountJs, /ACCOUNT_PUBLIC_IDENTITIES_ENDPOINT = `\$\{API_BASE\}\/api\/account\/public-identities`/);
  assert.match(accountJs, /method: draft\.identity_id \? "PATCH" : "POST"/);
  assert.match(accountJs, /Add at least one Runtime\/Auth identifier/);
  assert.match(accountJs, /platformIdentityDuplicateExists/);
  assert.match(accountJs, /data-platform-identity-delete/);
  assert.match(accountJs, /data-public-identity-detach/);
  assert.match(accountJs, /DETACH PUBLIC ID/);
  assert.match(accountJs, /data-public-identity-confirm-detach/);
  assert.match(accountJs, /Confirm Detach/);
  assert.match(accountJs, /data-public-identity-cancel/);
  assert.match(accountJs, /removable_by_account_owner/);
  assert.match(accountJs, /identity\.removable_by_account_owner !== true/);
  assert.match(accountJs, /method: "DELETE"/);
  assert.match(accountJs, /creator-public-identity-chip is-primary/);
  assert.match(accountJs, /Reason \/ note/);
  assert.match(accountJs, /body: JSON\.stringify\(\{ reason \}\)/);
  assert.match(accountJs, /window\.confirm\(`Remove this manual platform alias/);
  assert.doesNotMatch(accountJs, /window\.prompt/);
  assert.doesNotMatch(accountJs, /data-public-identity-unassign/);
  assert.match(css, /\.creator-public-identity-chip\.is-primary/);
  assert.match(css, /\.creator-public-identity-detach-button/);
  assert.match(css, /\.creator-public-identity-confirm/);
});

test("creator account page wires runtime-backed scoped roll-up settings", () => {
  const html = read("views/account.html");
  const accountJs = read("js/account-settings.js");

  assert.match(html, /data-scoped-rollup-panel="true"/);
  assert.match(html, /data-scoped-rollup-list="true"/);
  assert.match(html, /data-scoped-rollup-save="true"/);
  assert.match(html, /Suppressing global roll-up is discouraged/);
  assert.match(html, /Economy and inventory roll-up remain deferred/);
  assert.match(accountJs, /SCOPED_ROLLUP_SETTINGS_ENDPOINT = `\$\{API_BASE\}\/api\/creator\/progression\/scoped-settings`/);
  assert.match(accountJs, /loadScopedRollupSettings/);
  assert.match(accountJs, /saveScopedRollupSettings/);
  assert.match(accountJs, /method: "PATCH"/);
  assert.match(accountJs, /Runtime\/Auth scoped progression settings are not available on this build/);
});

test("platform detail pages show manual chat identity matching action", () => {
  const detailJs = read("js/platform-integration-detail.js");

  assert.match(detailJs, /function renderChatIdentityPanel/);
  assert.match(detailJs, /data-platform-identity-hint="true"/);
  assert.match(detailJs, /Manage manual aliases/);
  assert.match(detailJs, /Platform user ID: \$\{status\.broadcaster_user_id/);
  assert.match(detailJs, /Rumble chat payloads can expose sender IDs and usernames/);
  assert.match(detailJs, /Fuzzy matching is not used/);
});
