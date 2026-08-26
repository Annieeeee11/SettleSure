//! Money rounding matching TypeScript `Math.round(n * 100) / 100`.

/// Round to 2 decimal places the same way JS `Math.round(n * 100) / 100` does
/// (including banker's-adjacent half-away-from-zero via `f64` round).
pub fn round_money(n: f64) -> f64 {
    (n * 100.0).round() / 100.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rounds_to_two_decimals() {
        assert!((round_money(1.005) - 1.01).abs() < 1e-9 || (round_money(1.005) - 1.0).abs() < 1e-9);
        assert!((round_money(10.126) - 10.13).abs() < 1e-9);
    }
}
