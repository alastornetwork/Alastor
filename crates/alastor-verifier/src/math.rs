#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BasisPointsResult {
    pub computed_bps: i128,
    pub claimed_bps: i128,
    pub delta_bps: i128,
    pub consistent: bool,
}

/// Exact integer basis-point (1 bps = 0.01%) discrepancy evaluator for supply & financial claims.
pub fn check_basis_points_delta(
    initial_units: i128,
    final_units: i128,
    claimed_bps: i128,
    tolerance_bps: i128,
) -> Result<BasisPointsResult, &'static str> {
    if initial_units == 0 {
        return Err("initial_units cannot be zero");
    }
    let diff = final_units - initial_units;
    let computed_bps = (diff * 10_000) / initial_units;
    let delta_bps = (computed_bps - claimed_bps).abs();

    Ok(BasisPointsResult {
        computed_bps,
        claimed_bps,
        delta_bps,
        consistent: delta_bps <= tolerance_bps,
    })
}
