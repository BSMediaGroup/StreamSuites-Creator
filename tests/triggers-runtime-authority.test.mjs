import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("creator triggers view exposes a controller-backed runtime authority surface", () => {
  const renderJs = read("js/render.js");
  const triggersJs = read("js/triggers.js");
  const triggersHtml = read("views/triggers.html");

  assert.match(renderJs, /controllerName:\s*"TriggersView"/);
  assert.match(triggersJs, /window\.TriggersView = \{/);
  assert.match(triggersJs, /init,\s*destroy/);
  assert.match(triggersJs, /state\.abortController = new AbortController\(\)/);
  assert.match(triggersJs, /\/api\/livechat\/registry-summary/);
  assert.match(triggersJs, /\/api\/livechat\/triggers/);
  assert.match(triggersJs, /\/api\/livechat\/capabilities/);
  assert.match(triggersJs, /\/api\/livechat\/custom-triggers/);
  assert.match(triggersJs, /const method = id \? "PATCH" : "POST"/);
  assert.match(triggersJs, /method:\s*"DELETE"/);
  assert.doesNotMatch(triggersJs, /DOMContentLoaded/);
  assert.match(triggersHtml, /Registry rows are read-only/);
  assert.match(triggersHtml, /Custom triggers are creator-owned runtime config records/);
  assert.match(triggersHtml, /Manual send testing remains separate on the <a href="\/integrations\/rumble">Rumble integration page<\/a>/);
});

test("creator triggers view keeps custom config runtime-backed and phase truthful", () => {
  const triggersJs = read("js/triggers.js");
  const triggersHtml = read("views/triggers.html");

  assert.match(triggersJs, /CUSTOM_TRIGGERS_ENDPOINT/);
  assert.match(triggersJs, /loadCustomTriggers/);
  assert.match(triggersJs, /saveCustomTrigger/);
  assert.match(triggersJs, /toggleCustomTrigger/);
  assert.match(triggersJs, /deleteCustomTrigger/);
  assert.match(triggersJs, /CUSTOM_TRIGGER_PREVIEW_ENDPOINT/);
  assert.match(triggersJs, /runPreview/);
  assert.match(triggersJs, /\/api\/livechat\/custom-triggers\/preview/);
  assert.doesNotMatch(triggersJs, /localStorage/);
  assert.match(triggersHtml, /Configured for future dispatch/);
  assert.match(triggersHtml, /Preview only - no live chat post will be sent/);
  assert.match(triggersHtml, /data-custom-trigger-preview-form/);
  assert.match(triggersHtml, /execution\/transport is a later phase/);
  assert.match(triggersHtml, /Pilled planned\/disabled/);
  assert.doesNotMatch(triggersJs, /rumble-dispatch/);
});

test("creator rumble integration distinguishes creator, admin, and trigger-generated dispatch rows", () => {
  const detailJs = read("js/platform-integration-detail.js");
  const rumbleHtml = read("views/platforms/rumble.html");

  assert.match(rumbleHtml, /data-rumble-manual-send-form="true"/);
  assert.match(detailJs, /\/api\/creator\/runtime\/rumble-dispatch/);
  assert.match(detailJs, /source === "trigger_runtime"/);
  assert.match(detailJs, /source === "admin_dashboard"/);
  assert.match(detailJs, /"Manual creator send"/);
  assert.match(detailJs, /"Manual admin send"/);
  assert.match(detailJs, /"Automatic trigger reply"/);
});
