/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) + WebCrypto SHA-256 helpers.
 * Compatible with Node.js >= 20, Cloudflare Workers, Deno, and modern browsers.
 */

function escapeJcsString(str: string): string {
  let out = '"';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code === 0x08) out += "\\b";
    else if (code === 0x09) out += "\\t";
    else if (code === 0x0a) out += "\\n";
    else if (code === 0x0c) out += "\\f";
    else if (code === 0x0d) out += "\\r";
    else if (code === 0x22) out += '\\"';
    else if (code === 0x5c) out += "\\\\";
    else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, "0")}`;
    else out += str[i];
  }
  return `${out}"`;
}

function compareUtf16CodeUnits(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = a.charCodeAt(i) - b.charCodeAt(i);
    if (diff !== 0) return diff;
  }
  return a.length - b.length;
}

export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("RFC 8785 forbids NaN and Infinity in canonical JSON");
    }
    if (Object.is(value, -0)) return "0";
    return String(value);
  }
  if (typeof value === "string") {
    return escapeJcsString(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalizeJson(item === undefined ? null : item));
    return `[${items.join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((k) => record[k] !== undefined)
      .sort(compareUtf16CodeUnits);
    const entries = keys.map((k) => `${escapeJcsString(k)}:${canonicalizeJson(record[k])}`);
    return `{${entries.join(",")}}`;
  }
  throw new TypeError(`Unsupported JSON value of type ${typeof value}`);
}

export async function sha256Hex(canonicalUtf8: string): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalUtf8);
  const digestBuffer = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digestBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashCanonicalPayload(payload: unknown): Promise<{
  canonicalJson: string;
  sha256: string;
}> {
  const canonicalJson = canonicalizeJson(payload);
  const sha256 = await sha256Hex(canonicalJson);
  return { canonicalJson, sha256 };
}
