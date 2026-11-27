export interface RecordedToolEvidence {
  evidenceId: string;
  runId: string;
  claimId?: string;
  toolName: string;
  succeeded: boolean;
}

export interface CandidateFinding {
  findingId: string;
  runId: string;
  claimId: string;
  verdict:
    | "supported"
    | "contradicted"
    | "calculation_error"
    | "invalid_reference"
    | "unsupported_by_cited_source"
    | "insufficient_evidence";
  evidenceIds: string[];
}

export interface EvidenceGateReport {
  acceptedFindings: CandidateFinding[];
  strippedCitations: Array<{ findingId: string; evidenceId: string; reason: string }>;
  downgradedFindings: string[];
}

const ERROR_VERDICTS = new Set([
  "contradicted",
  "calculation_error",
  "invalid_reference",
  "unsupported_by_cited_source",
]);

/**
 * Deterministic Evidence Gate executed between HUNTER runs and JUDGE review.
 * Strips hallucinated, failed, or cross-claim evidence IDs and prevents unsupported error claims.
 */
export function enforceEvidenceGate(
  findings: CandidateFinding[],
  recordedEvidence: RecordedToolEvidence[],
): EvidenceGateReport {
  const byId = new Map<string, RecordedToolEvidence>();
  for (const ev of recordedEvidence) {
    byId.set(ev.evidenceId, ev);
  }

  const strippedCitations: EvidenceGateReport["strippedCitations"] = [];
  const downgradedFindings: string[] = [];
  const acceptedFindings: CandidateFinding[] = [];

  for (const finding of findings) {
    const validIds: string[] = [];
    for (const eid of finding.evidenceIds) {
      const ev = byId.get(eid);
      if (!ev) {
        strippedCitations.push({ findingId: finding.findingId, evidenceId: eid, reason: "missing_evidence_id" });
        continue;
      }
      if (ev.runId !== finding.runId) {
        strippedCitations.push({ findingId: finding.findingId, evidenceId: eid, reason: "cross_run_reference" });
        continue;
      }
      if (!ev.succeeded) {
        strippedCitations.push({ findingId: finding.findingId, evidenceId: eid, reason: "failed_tool_execution" });
        continue;
      }
      if (ev.claimId && ev.claimId !== finding.claimId) {
        strippedCitations.push({ findingId: finding.findingId, evidenceId: eid, reason: "cross_claim_reference" });
        continue;
      }
      if (!validIds.includes(eid)) {
        validIds.push(eid);
      }
    }

    if (ERROR_VERDICTS.has(finding.verdict) && validIds.length === 0) {
      downgradedFindings.push(finding.findingId);
      acceptedFindings.push({
        ...finding,
        verdict: "insufficient_evidence",
        evidenceIds: [],
      });
    } else {
      acceptedFindings.push({
        ...finding,
        evidenceIds: validIds,
      });
    }
  }

  return { acceptedFindings, strippedCitations, downgradedFindings };
}
