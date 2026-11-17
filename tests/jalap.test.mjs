import test from "node:test";
import assert from "node:assert/strict";
import { isValidBearer, validateInput, outputText } from "../netlify/functions/jalap.mjs";

test("JALAP requires a matching PEPPER bearer token", () => {
  const ok = new Request("https://pepper.example/.netlify/functions/jalap", {
    headers: { authorization: "Bearer private-token" }
  });
  const bad = new Request("https://pepper.example/.netlify/functions/jalap", {
    headers: { authorization: "Bearer other-token" }
  });
  assert.equal(isValidBearer(ok, "private-token"), true);
  assert.equal(isValidBearer(bad, "private-token"), false);
});

test("JALAP validates message size and bounds conversation history", () => {
  const input = validateInput({
    message: "Ajoute une visite.",
    context: { destination: "Paris" },
    history: Array.from({ length: 15 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "Message " + i }))
  });
  assert.equal(input.message, "Ajoute une visite.");
  assert.equal(input.history.length, 10);
  assert.equal(input.history[0].content, "Message 5");
  assert.throws(() => validateInput({ message: " ".repeat(2) }), /entre 1 et 3 000/);
  assert.throws(() => validateInput({ message: "x".repeat(3001) }), /entre 1 et 3 000/);
});

test("JALAP extracts structured output from the Claude Messages API", () => {
  const payload = { content: [{ type: "text", text: '{"message":"Bonjour","operations":[]}' }] };
  assert.equal(outputText(payload), '{"message":"Bonjour","operations":[]}');
  assert.equal(outputText({ output_text: "direct" }), "direct");
});
