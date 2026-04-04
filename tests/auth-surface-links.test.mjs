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
