//! Deterministic seeded synthetic dataset generation for SettleSure.
//! Port of `src/data/generate.ts` — bit-identical Mulberry32 RNG and class plan.

mod generate;
mod rng;

pub use generate::{
    generate_and_write, generate_and_write_with_opts, generate_dataset, mangle_utr_to_similarity,
    write_dataset, GenerateDatasetOpts, GeneratedDataset,
};
pub use rng::{create_rng, Mulberry32};
