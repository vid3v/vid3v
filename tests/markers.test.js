import { test } from "node:test";
import assert from "node:assert/strict";
import { markerStart, markerEnd, replaceBlock } from "../scripts/lib/markers.js";

const readme = [
  "# Header",
  "<!-- PROFILE:START:SELECTED_WORK -->",
  "old content",
  "<!-- PROFILE:END:SELECTED_WORK -->",
  "## Editorial section",
  "<!-- PROFILE:START:CORE_STACK -->",
  "old stack",
  "<!-- PROFILE:END:CORE_STACK -->",
].join("\n");

test("markerStart and markerEnd produce the agreed format", () => {
  assert.equal(markerStart("SELECTED_WORK"), "<!-- PROFILE:START:SELECTED_WORK -->");
  assert.equal(markerEnd("SELECTED_WORK"), "<!-- PROFILE:END:SELECTED_WORK -->");
});

test("replaceBlock replaces only the targeted block", () => {
  const updated = replaceBlock(readme, "SELECTED_WORK", "new content");
  assert.match(updated, /new content/);
  assert.doesNotMatch(updated, /old content/);
  assert.match(updated, /old stack/);
  assert.match(updated, /## Editorial section/);
});

test("replaceBlock keeps markers in place", () => {
  const updated = replaceBlock(readme, "CORE_STACK", "new stack");
  assert.match(updated, /<!-- PROFILE:START:CORE_STACK -->\nnew stack\n<!-- PROFILE:END:CORE_STACK -->/);
});

test("replaceBlock throws when markers are missing", () => {
  assert.throws(() => replaceBlock("# No markers", "SELECTED_WORK", "x"), /exactly once/);
});

test("replaceBlock throws when markers are duplicated", () => {
  const duplicated = `${readme}\n${readme}`;
  assert.throws(() => replaceBlock(duplicated, "SELECTED_WORK", "x"), /exactly once/);
});

test("replaceBlock throws when end marker precedes start marker", () => {
  const reversed = [
    "<!-- PROFILE:END:SELECTED_WORK -->",
    "<!-- PROFILE:START:SELECTED_WORK -->",
  ].join("\n");
  assert.throws(() => replaceBlock(reversed, "SELECTED_WORK", "x"), /malformed/);
});
