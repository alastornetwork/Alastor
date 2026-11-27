pub mod jcs;
pub mod math;
pub mod proof;

pub use jcs::serialize_jcs;
pub use math::{check_basis_points_delta, BasisPointsResult};
pub use proof::{verify_proof_json, DigestEnvelope, VerificationReport, VerifierError};

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn canonicalizes_keys_in_utf16_order() {
        let input = json!({
            "z": 1,
            "a": [true, false, null],
            "nested": { "beta": "two", "alpha": "one" }
        });
        let out = serialize_jcs(&input).expect("jcs");
        assert_eq!(out, r#"{"a":[true,false,null],"nested":{"alpha":"one","beta":"two"},"z":1}"#);
    }

    #[test]
    fn detects_percentage_burn_error_in_bps() {
        // 1,000,000 -> 750,000 is -2500 bps (-25.00%), whereas -3330 bps (-33.30%) was claimed
        let res = check_basis_points_delta(1_000_000, 750_000, -3330, 5).expect("bps");
        assert_eq!(res.computed_bps, -2500);
        assert!(!res.consistent);
    }
}
