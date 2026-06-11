import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Kick integration UI does not present unresolved OAuth as success", () => {
  const js = read("js/platform-integration-detail.js");

  assert.match(js, /force_verify=true/);
  assert.match(js, /Kick OAuth did not attach because Runtime\/Auth could not confirm the authenticated channel/);
  assert.match(js, /Kick OAuth attached to the authenticated channel/);
  assert.match(js, /Connect Kick through OAuth before saving a channel target/);
  assert.match(js, /data-kick-channel-save="true" \$\{connected \? "" : "disabled"\}/);
});
