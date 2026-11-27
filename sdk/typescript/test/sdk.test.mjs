import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vectorPath = path.resolve(__dirname, "../../../vectors/sample-proof-v1.json");

test("sample-proof-v1.json envelope has 64-hex SHA-256 digest", () => {
  const doc = JSON.parse(fs.readFileSync(vectorPath, "utf8"));
  assert.equal(doc.payload.schema, "alastor.proof-of-error");
  assert.equal(doc.digest.algorithm, "SHA-256");
  assert.equal(doc.digest.canonicalization, "RFC8785-JCS");
  assert.match(doc.digest.value, /^[0-9a-f]{64}$/);
});
