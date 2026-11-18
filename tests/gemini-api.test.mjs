import test from "node:test";
import assert from "node:assert/strict";
import { GEMINI_MODEL, extractGeminiOutputText, sanitizeGeminiSchema } from "../lib/gemini-api.mjs";

test("PEPPER uses the agreed Gemini Flash model", () => {
  assert.equal(GEMINI_MODEL, "gemini-3.8-flash");
});

test("Gemini output parser reads model_output steps from the Interactions API", () => {
  const payload = {
    steps: [
      { type: "user_input", content: [{ type: "text", text: "Ignore this" }] },
      { type: "model_output", content: [{ type: "text", text: "{\"message\":\"Bonjour\",\"operations\":[]}" }] }
    ]
  };
  assert.equal(extractGeminiOutputText(payload), "{\"message\":\"Bonjour\",\"operations\":[]}");
});

test("Gemini output parser accepts output_text and candidate fallbacks", () => {
  assert.equal(extractGeminiOutputText({ output_text: "  {\"ok\":true}  " }), "{\"ok\":true}");
  assert.equal(extractGeminiOutputText({ candidates: [{ content: { parts: [{ text: "réponse" }] } }] }), "réponse");
  assert.equal(extractGeminiOutputText({ steps: [] }), "");
});

test("Gemini schema removes array size constraints without mutating source", () => {
  const source = {
    type: "object",
    properties: {
      changes: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: { type: "object", required: ["path"] }
      }
    }
  };
  const result = sanitizeGeminiSchema(source);
  assert.equal(result.properties.changes.minItems, undefined);
  assert.equal(result.properties.changes.maxItems, undefined);
  assert.deepEqual(result.properties.changes.items.required, ["path"]);
  assert.equal(source.properties.changes.maxItems, 8);
});
