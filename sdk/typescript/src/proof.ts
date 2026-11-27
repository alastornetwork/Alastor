import { hashCanonicalPayload } from "./canonical.js";

export type ErrorVerdict =
  | "contradicted"
  | "calculation_error"
  | "invalid_reference"
  | "unsupported_by_cited_source";

export interface ProofEvidenceItem {
  evidenceId: string;
  toolName: string;
  sourceLocator: string;
  observedOutcome: string;
  capturedAt: string;
}

export interface ProofOfErrorPayload {
  schema: "alastor.proof-of-error";
  version: "1.0.0";
  proofId: string;
  taskId: string;
  claimId: string;
  findingId: string;
  category: "onchain" | "numerical" | "doi" | "general";
  claimText: string;
  verdict: ErrorVerdict;
  severity: "low" | "medium" | "high" | "critical";
  judgeSummary: string;
  hunterInstanceId: string;
  judgeInstanceId: string;
  evidenceSummary: ProofEvidenceItem[];
  limitations: string[];
  publishedAt: string;
}

export interface ProofOfErrorDocument {
  payload: ProofOfErrorPayload;
  digest: {
    algorithm: "SHA-256";
    canonicalization: "RFC8785-JCS";
    value: string;
  };
}

export interface ProofVerificationResult {
  selfConsistent: boolean;
  matchesTrustedDigest: boolean | null;
  embeddedDigest: string;
  recomputedDigest: string;
  canonicalByteLength: number;
  errors: string[];
}

export async function buildProofDocument(payload: ProofOfErrorPayload): Promise<ProofOfErrorDocument> {
  if (payload.evidenceSummary.length === 0) {
    throw new Error("Cannot mint Proof of Error without primary tool evidence");
  }
  const { sha256 } = await hashCanonicalPayload(payload);
  return {
    payload,
    digest: {
      algorithm: "SHA-256",
      canonicalization: "RFC8785-JCS",
      value: sha256,
    },
  };
}

export async function verifyProofDocument(
  doc: ProofOfErrorDocument,
  trustedRegistryDigest?: string,
): Promise<ProofVerificationResult> {
  const errors: string[] = [];

  if (doc.payload?.schema !== "alastor.proof-of-error") {
    errors.push(`Unexpected schema: ${String(doc.payload?.schema)}`);
  }
  if (!Array.isArray(doc.payload?.evidenceSummary) || doc.payload.evidenceSummary.length === 0) {
    errors.push("Proof payload must contain at least one primary evidence item");
  }
  if (doc.digest?.algorithm !== "SHA-256" || doc.digest?.canonicalization !== "RFC8785-JCS") {
    errors.push("Unsupported digest envelope algorithm or canonicalization scheme");
  }

  const { canonicalJson, sha256 } = await hashCanonicalPayload(doc.payload);
  const embedded = (doc.digest?.value ?? "").toLowerCase();
  const selfConsistent = errors.length === 0 && embedded === sha256;

  if (embedded !== sha256) {
    errors.push(`Digest mismatch: embedded=${embedded} recomputed=${sha256}`);
  }

  const matchesTrustedDigest =
    trustedRegistryDigest !== undefined ? sha256 === trustedRegistryDigest.toLowerCase() : null;

  if (matchesTrustedDigest === false) {
    errors.push("Recomputed digest does not match trusted registry reference");
  }

  return {
    selfConsistent,
    matchesTrustedDigest,
    embeddedDigest: embedded,
    recomputedDigest: sha256,
    canonicalByteLength: new TextEncoder().encode(canonicalJson).byteLength,
    errors,
  };
}
