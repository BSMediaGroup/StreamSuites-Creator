import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const telemetry = fs.readFileSync("js/page-view-telemetry.js", "utf8");
const render = fs.readFileSync("js/render.js", "utf8");
const shell = fs.readFileSync("index.html", "utf8");

test("Creator reports one centralized route-family page view without account content", () => {
  assert.match(shell, /\/js\/page-view-telemetry\.js/);
  assert.match(render, /StreamSuitesCreatorPageViews\?\.reportRoute\?\.\(normalized\)/);
  assert.match(telemetry, /surface:\s*"creator"/);
  assert.match(telemetry, /\/api\/public\/analytics\/page-visit/);
  assert.match(telemetry, /if \(path === lastRoute\) return false/);
  assert.match(telemetry, /keepalive:\s*true/);
  assert.match(telemetry, /credentials:\s*"omit"/);
  assert.doesNotMatch(telemetry, /account|email|session|integration_id|form_value/i);
});

test("Creator telemetry ignores query and hash state by accepting canonical router names only", () => {
  assert.match(telemetry, /resolveKnownRoute/);
  assert.match(telemetry, /getCanonicalPath/);
  assert.match(telemetry, /\/wheels\/:artifact/);
  assert.doesNotMatch(telemetry, /location\.search|location\.hash|document\.title|document\.referrer/);
});
