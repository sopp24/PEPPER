import test from "node:test";
import assert from "node:assert/strict";
import { isValidBearer, validateChanges, applyEditsToContent, repoFileAllowed, parseClaudeText } from "../netlify/functions/jalap-dev.mjs";

test("JALAP Dev allows only known public application files", () => {
  assert.equal(repoFileAllowed("app.js"), true);
  assert.equal(repoFileAllowed("styles.css"), true);
  assert.equal(repoFileAllowed("data/trips.json"), true);
  assert.equal(repoFileAllowed(".github/workflows/deploy-pages.yml"), false);
  assert.equal(repoFileAllowed("../netlify.toml"), false);
  assert.equal(repoFileAllowed("netlify.toml"), false);
});

test("JALAP Dev validates and applies exact code replacements", () => {
  const changes = validateChanges([{
    path: "app.js",
    summary: "Rename heading",
    edits: [{ old_text: "const title = \"PEPPER\";", new_text: "const title = \"PEPPER Travel\";", reason: "Update title" }]
  }]);
  assert.equal(changes.length, 1);
  assert.equal(applyEditsToContent("const title = \"PEPPER\";", changes[0].edits), "const title = \"PEPPER Travel\";");
});

test("JALAP Dev refuses ambiguous or missing old snippets", () => {
  assert.throws(() => applyEditsToContent("alpha alpha", [{ old_text: "alpha", new_text: "beta", reason: "test" }]), /plusieurs fois/);
  assert.throws(() => applyEditsToContent("alpha", [{ old_text: "missing", new_text: "beta", reason: "test" }]), /n'existe plus/);
});

test("JALAP Dev refuses unsafe paths and embedded access tokens", () => {
  assert.throws(() => validateChanges([{ path: ".github/workflows/deploy-pages.yml", summary: "Edit workflow", edits: [{ old_text: "x", new_text: "y", reason: "test" }] }]), /non autorisé/);
  assert.throws(() => applyEditsToContent("const key = '';", [{ old_text: "''", new_text: "'github_pat_abcdefghijklmnopqrstuvwxyz123456'", reason: "test" }]), /clé ou un jeton/);
});

test("JALAP Dev parses Claude Messages API text blocks", () => {
  const value = '{"message":"Proposition prête","changes":[]}';
  assert.equal(parseClaudeText({ content: [{ type: "text", text: value }] }), value);
});

test("JALAP Dev requires a matching PEPPER bearer token", () => {
  const ok = new Request("https://pepper.example/.netlify/functions/jalap-dev", {
    headers: { authorization: "Bearer private-token" }
  });
  const bad = new Request("https://pepper.example/.netlify/functions/jalap-dev", {
    headers: { authorization: "Bearer other-token" }
  });
  assert.equal(isValidBearer(ok, "private-token"), true);
  assert.equal(isValidBearer(bad, "private-token"), false);
});
