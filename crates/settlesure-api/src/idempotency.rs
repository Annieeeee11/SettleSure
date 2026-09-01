//! In-memory idempotency cache with TTL.

use dashmap::DashMap;
use std::time::{Duration, Instant};

pub struct IdempotencyStore {
    ttl: Duration,
    entries: DashMap<String, (Instant, Vec<u8>)>,
}

impl IdempotencyStore {
    pub fn new(ttl_secs: u64) -> Self {
        Self {
            ttl: Duration::from_secs(ttl_secs),
            entries: DashMap::new(),
        }
    }

    pub fn get(&self, key: &str) -> Option<Vec<u8>> {
        self.purge_expired();
        self.entries
            .get(key)
            .filter(|entry| entry.0.elapsed() < self.ttl)
            .map(|entry| entry.1.clone())
    }

    pub fn put(&self, key: String, body: Vec<u8>) {
        self.purge_expired();
        self.entries.insert(key, (Instant::now(), body));
    }

    fn purge_expired(&self) {
        self.entries
            .retain(|_, (ts, _)| ts.elapsed() < self.ttl);
    }
}
