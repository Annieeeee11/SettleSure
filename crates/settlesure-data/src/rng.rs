//! Mulberry32 PRNG — bit-identical to the TypeScript `createRng` in `generate.ts`.
//!
//! Uses `wrapping_add` / `wrapping_mul` to mirror JS `>>> 0` and `Math.imul`.

/// Stateful Mulberry32 generator. Each `next_f64` advances the internal `u32` state.
#[derive(Debug, Clone)]
pub struct Mulberry32 {
    t: u32,
}

impl Mulberry32 {
    /// Create a generator from a `u32` seed (`seed >>> 0` in TS).
    pub fn new(seed: u32) -> Self {
        Self { t: seed }
    }

    /// Next uniform float in `[0, 1)`, matching:
    /// `((r ^ (r >>> 14)) >>> 0) / 4294967296`.
    pub fn next_f64(&mut self) -> f64 {
        self.t = self.t.wrapping_add(0x6d2b79f5);
        let mut r = (self.t ^ (self.t >> 15)).wrapping_mul(1 | self.t);
        r ^= r.wrapping_add((r ^ (r >> 7)).wrapping_mul(61 | r));
        f64::from(r ^ (r >> 14)) / 4_294_967_296.0
    }
}

/// Create a Mulberry32 RNG (TS `createRng`).
pub fn create_rng(seed: u32) -> Mulberry32 {
    Mulberry32::new(seed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_values_seed_42() {
        let mut rng = create_rng(42);
        // Captured from TypeScript createRng(42) — bit-identical requirement.
        let expected: [f64; 10] = [
            0.6011037519201636,
            0.44829055899754167,
            0.8524657934904099,
            0.6697340414393693,
            0.17481389874592423,
            0.5265925421845168,
            0.2732279943302274,
            0.6247446539346129,
            0.8654746483080089,
            0.4723170551005751,
        ];
        for e in expected {
            assert_eq!(rng.next_f64().to_bits(), e.to_bits());
        }
    }
}
