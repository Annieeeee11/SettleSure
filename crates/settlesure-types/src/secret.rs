//! Redacting wrapper so credentials never leak via Debug/Display.

use serde::{Deserialize, Serialize};
use std::fmt;

/// Thin wrapper that redacts on `Debug`/`Display`. Serde still serializes the
/// inner value when needed for private config — never put this in report JSON.
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Secret<T>(T);

impl<T> Secret<T> {
    pub fn new(value: T) -> Self {
        Self(value)
    }

    pub fn expose(&self) -> &T {
        &self.0
    }

    pub fn into_inner(self) -> T {
        self.0
    }
}

impl<T> fmt::Debug for Secret<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Secret([REDACTED])")
    }
}

impl<T> fmt::Display for Secret<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("[REDACTED]")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_debug_and_display() {
        let s = Secret::new("sk-secret-key".to_string());
        assert!(!format!("{s:?}").contains("sk-secret"));
        assert_eq!(format!("{s}"), "[REDACTED]");
        assert_eq!(s.expose(), "sk-secret-key");
    }
}
