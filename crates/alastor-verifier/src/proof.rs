use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::jcs::serialize_jcs;

#[derive(Debug, Error)]
pub enum VerifierError {
    #[error("invalid JSON document: {0}")]
    InvalidJson(#[from] serde_json::Error),
    #[error("canonicalization error: {0}")]
    Canonicalization(String),
    #[error("missing required field: {0}")]
    MissingField(&'static str),
    #[error("unsupported proof schema '{0}'")]
    UnsupportedSchema(String),
    #[error("proof contains empty primary evidence summary")]
    EmptyEvidence,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DigestEnvelope {
    pub algorithm: String,
    pub canonicalization: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationReport {
    pub self_consistent: bool,
    pub matches_trusted_digest: Option<bool>,
    pub embedded_digest: String,
    pub recomputed_digest: String,
    pub canonical_bytes: usize,
}

pub fn verify_proof_json(
    raw_json: &str,
    trusted_registry_digest: Option<&str>,
) -> Result<VerificationReport, VerifierError> {
    let root: Value = serde_json::from_str(raw_json)?;
    let payload = root
        .get("payload")
        .ok_or(VerifierError::MissingField("payload"))?;
    let digest_obj = root
        .get("digest")
        .ok_or(VerifierError::MissingField("digest"))?;

    let schema = payload
        .get("schema")
        .and_then(Value::as_str)
        .ok_or(VerifierError::MissingField("payload.schema"))?;
    if schema != "alastor.proof-of-error" {
        return Err(VerifierError::UnsupportedSchema(schema.to_string()));
    }

    let evidence = payload
        .get("evidenceSummary")
        .and_then(Value::as_array)
        .ok_or(VerifierError::MissingField("payload.evidenceSummary"))?;
    if evidence.is_empty() {
        return Err(VerifierError::EmptyEvidence);
    }

    let envelope: DigestEnvelope = serde_json::from_value(digest_obj.clone())?;
    let canonical = serialize_jcs(payload).map_err(VerifierError::Canonicalization)?;

    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    let recomputed = hex::encode(hasher.finalize());
    let embedded = envelope.value.to_ascii_lowercase();

    let header_ok = envelope.algorithm == "SHA-256" && envelope.canonicalization == "RFC8785-JCS";
    let self_consistent = header_ok && recomputed == embedded;
    let matches_trusted_digest = trusted_registry_digest.map(|t| recomputed == t.to_ascii_lowercase());

    Ok(VerificationReport {
        self_consistent,
        matches_trusted_digest,
        embedded_digest: embedded,
        recomputed_digest: recomputed,
        canonical_bytes: canonical.len(),
    })
}
