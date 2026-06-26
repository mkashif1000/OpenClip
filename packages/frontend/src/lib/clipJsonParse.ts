/**
 * Bulletproof parsing of clip JSON pasted from a chatbot (ChatGPT / Claude /
 * Gemini / Grok / DeepSeek). These models routinely wrap the JSON in markdown
 * code fences, add a sentence before/after it, use “smart quotes”, or leave
 * trailing commas. This sanitizer strips all of that and returns the parsed
 * value (which loadClipsFromJson then normalizes), or a helpful error.
 */

export interface ParseResult {
  ok: boolean;
  /** Present when ok. The parsed JSON (array or wrapper object). */
  data?: unknown;
  /** Present when !ok. A human-friendly explanation. */
  error?: string;
}

export function sanitizeAndParseClipsJson(raw: string): ParseResult {
  if (!raw || !raw.trim()) {
    return { ok: false, error: 'Nothing pasted yet — paste the chatbot’s JSON output here.' };
  }

  let s = raw.trim();

  // 1) Strip markdown code fences (```json … ``` or ``` … ```).
  s = s.replace(/```[a-zA-Z]*\s*/g, '').replace(/```/g, '').trim();

  // 2) Slice to the JSON payload: a chatbot may add prose before/after it.
  //    Prefer an array ("[ … ]"); fall back to an object ("{ … }").
  s = extractJsonSlice(s);

  // 3) First attempt — straight parse.
  const direct = tryParse(s);
  if (direct.ok) return validateShape(direct.value);

  // 4) Repair common LLM JSON mistakes, then retry.
  let repaired = s
    // smart quotes → straight quotes
    .replace(/[“”„‟″‶]/g, '"')
    .replace(/[‘’‚‛′‵]/g, "'")
    // line + block comments
    .replace(/\/\/[^\n\r]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // trailing commas before } or ]
    .replace(/,(\s*[}\]])/g, '$1');

  const repairedTry = tryParse(repaired);
  if (repairedTry.ok) return validateShape(repairedTry.value);

  // 5) Last resort: if keys are unquoted (foo: 1), quote them. Conservative —
  //    only applies to simple identifier keys.
  repaired = repaired.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3');
  const lastTry = tryParse(repaired);
  if (lastTry.ok) return validateShape(lastTry.value);

  return {
    ok: false,
    error:
      'Could not read that as JSON. Make sure you pasted the chatbot’s full reply — ' +
      'it should contain a list that starts with “[” and ends with “]”.',
  };
}

function extractJsonSlice(s: string): string {
  const firstBracket = s.indexOf('[');
  const firstBrace = s.indexOf('{');
  const lastBracket = s.lastIndexOf(']');
  const lastBrace = s.lastIndexOf('}');

  const hasArray = firstBracket !== -1 && lastBracket > firstBracket;
  const hasObject = firstBrace !== -1 && lastBrace > firstBrace;

  if (hasArray && (!hasObject || firstBracket <= firstBrace)) {
    return s.slice(firstBracket, lastBracket + 1);
  }
  if (hasObject) {
    return s.slice(firstBrace, lastBrace + 1);
  }
  return s; // leave as-is; parse will fail with a clear error
}

function tryParse(s: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch {
    return { ok: false };
  }
}

/** Make sure the parsed value can plausibly yield clips. */
function validateShape(value: unknown): ParseResult {
  const arr = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? ((value as Record<string, unknown>).clips ??
         (value as Record<string, unknown>).segments ??
         (value as Record<string, unknown>).data ??
         (value as Record<string, unknown>).results ??
         (value as Record<string, unknown>).items)
      : undefined;

  if (!Array.isArray(arr)) {
    return { ok: false, error: 'The JSON parsed, but it isn’t a list of clips. Expected an array like [ { "start": …, "end": … }, … ].' };
  }
  if (arr.length === 0) {
    return { ok: false, error: 'The list is empty — the chatbot returned no clips. Try asking for a few clips.' };
  }
  return { ok: true, data: value };
}
