export const GEMINI_MODEL = "gemini-3.8-flash";

export function sanitizeGeminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(sanitizeGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const clean = {};
  for (const [key, value] of Object.entries(schema)) {
    // Local PEPPER validation enforces these limits before a change is applied.
    if (key === "minItems" || key === "maxItems") continue;
    clean[key] = sanitizeGeminiSchema(value);
  }
  return clean;
}

export function extractGeminiOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  const textBlocks = [];
  for (const step of steps) {
    if (step?.type !== "model_output" || !Array.isArray(step.content)) continue;
    for (const block of step.content) {
      if (block?.type === "text" && typeof block.text === "string") textBlocks.push(block.text);
    }
  }
  if (textBlocks.length) return textBlocks.join("\n").trim();
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const text = parts.filter(part => typeof part?.text === "string").map(part => part.text).join("\n").trim();
    if (text) return text;
  }
  return "";
}
