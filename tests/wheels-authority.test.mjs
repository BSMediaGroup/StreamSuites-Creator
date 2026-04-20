import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("creator shell wires the new wheels route through the existing SPA shell", () => {
  const routes = read("js/routes.js");
  const render = read("js/render.js");
  const index = read("index.html");
  const fallback = read("functions/[[path]].js");

  assert.match(routes, /\{ route: "wheels", templatePath: "wheels", aliases: \["scoreboards"\] \}/);
  assert.match(render, /wheels: \["\/js\/wheels\.js"\]/);
  assert.match(render, /registerView\("wheels", \{ scripts: ViewScripts\.wheels, controllerName: "WheelsView" \}\)/);
  assert.match(index, /<a href="\/wheels" data-route="wheels">Wheels<\/a>/);
  assert.match(fallback, /"\/wheels"/);
});

test("creator wheels editor talks only to the authoritative runtime/Auth wheel endpoints", () => {
  const js = read("js/wheels.js");
  const view = read("views/wheels.html");
  const css = read("css/creator-dashboard.css");
  const appShell = read("js/app.js");

  assert.match(js, /const WHEELS_ENDPOINT = `\$\{API_BASE\}\/api\/creator\/wheels`;/);
  assert.match(js, /\/api\/creator\/wheels\/import/);
  assert.match(js, /const WHEELS_EVENTS_ENDPOINT = `\$\{API_BASE\}\/api\/creator\/wheels\/events`;/);
  assert.match(js, /function ensureWheelEvents\(\)/);
  assert.match(js, /wheelEvents = new EventSource\(WHEELS_EVENTS_ENDPOINT, \{ withCredentials: true \}\);/);
  assert.match(js, /wheelEvents\.addEventListener\("wheel\.changed"/);
  assert.match(js, /await loadWheels\(\{ selectCode: state\.selectedCode \}\);/);
  assert.match(js, /\$\{WHEELS_ENDPOINT\}\/\$\{encodeURIComponent\(state\.selectedCode\)\}\/export/);
  assert.match(js, /const WHEEL_ACCOUNT_LOOKUP_ENDPOINT = `\$\{API_BASE\}\/api\/creator\/wheels\/account-lookup`;/);
  assert.match(js, /winner_limit/);
  assert.match(js, /slice_label_mode/);
  assert.match(js, /trim_color/);
  assert.match(js, /glow_color/);
  assert.match(js, /presentation\.sound\.\$\{category\}\.asset_id|presentation\.sound\./);
  assert.match(js, /Search existing StreamSuites accounts/);
  assert.match(js, /function resolvePublicWheelDestination\(item\)/);
  assert.match(js, /View public wheel/);
  assert.match(js, /Manual editing is the authority path/);
  assert.match(js, /Unsupported fields are preserved as import metadata only/);
  assert.match(js, /default_display_mode: "wheel"/);
  assert.match(js, /List view/);
  assert.match(view, /data-wheel-manager="true"/);
  assert.match(css, /\.wheel-manager-shell/);
  assert.match(css, /\.wheel-list-card/);
  assert.match(css, /\.wheel-list-card__footer/);
  assert.match(css, /\.wheel-entry-card/);
  assert.match(css, /\.wheel-sound-grid/);
  assert.match(css, /\.wheel-assignment-results/);
  assert.match(appShell, /wheels: "\/assets\/icons\/ui\/wheelpie\.svg"/);
});
