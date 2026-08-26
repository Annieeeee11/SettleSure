//! Shared UTR / reference normalization and similarity.

/// Strip non-alphanumeric and uppercase — matches TS `normalizeReference`.
pub fn normalize_reference(ref_str: &str) -> String {
    ref_str
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

/// Classic Levenshtein distance (DP).
pub fn levenshtein(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let m = a.len();
    let n = b.len();
    if m == 0 {
        return n;
    }
    if n == 0 {
        return m;
    }

    let mut prev: Vec<usize> = (0..=n).collect();
    let mut curr = vec![0usize; n + 1];

    for i in 1..=m {
        curr[0] = i;
        for j in 1..=n {
            let cost = usize::from(a[i - 1] != b[j - 1]);
            curr[j] = (prev[j] + 1)
                .min(curr[j - 1] + 1)
                .min(prev[j - 1] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[n]
}

/// Reference similarity with truncated-UTR prefix floor 0.92 (≥6 chars).
pub fn reference_similarity(a: &str, b: &str) -> f64 {
    let na = normalize_reference(a);
    let nb = normalize_reference(b);
    if na == nb {
        return 1.0;
    }
    if na.is_empty() || nb.is_empty() {
        return 0.0;
    }
    let dist = levenshtein(&na, &nb);
    let max_len = na.len().max(nb.len());
    let lev = 1.0 - (dist as f64) / (max_len as f64);
    let (shorter, longer) = if na.len() <= nb.len() {
        (na.as_str(), nb.as_str())
    } else {
        (nb.as_str(), na.as_str())
    };
    if shorter.len() >= 6 && longer.starts_with(shorter) {
        return lev.max(0.92);
    }
    lev
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_punctuation_and_case() {
        assert_eq!(normalize_reference("utr-001 a"), "UTR001A");
        assert!((reference_similarity("UTR001A", "UTR-001A") - 1.0).abs() < 1e-12);
    }

    #[test]
    fn truncated_prefix_floor() {
        assert!(reference_similarity("UTRABC123456", "UTRABC123456XYZ") >= 0.92);
    }

    #[test]
    fn short_prefix_no_floor() {
        let sim = reference_similarity("UTRAB", "UTRABC123456");
        assert!(sim < 0.9);
    }

    #[test]
    fn non_prefix_mangle_no_floor() {
        let sim = reference_similarity("UTRABCDEFGHJKLM", "UTRABCDEFGHXXXX");
        assert!(sim > 0.5);
        assert!(sim < 0.75);
        assert!(sim < 0.9);
    }
}
