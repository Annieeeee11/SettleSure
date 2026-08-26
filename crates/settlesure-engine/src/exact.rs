//! Pass 1: exact UTR + amount + currency + date.

use settlesure_types::{BankCredit, MatchResult, MatchSource, Settlement};
use std::collections::HashSet;

pub fn exact_match(
    bank_pool: &[BankCredit],
    settlement_pool: &[Settlement],
) -> (
    Vec<MatchResult>,
    Vec<BankCredit>,
    Vec<Settlement>,
) {
    let mut used_settlement: HashSet<String> = HashSet::new();
    let mut matched_bank: HashSet<String> = HashSet::new();
    let mut matches = Vec::new();

    for bank in bank_pool {
        let hit = settlement_pool.iter().find(|s| {
            !used_settlement.contains(&s.settlement_id)
                && s.utr == bank.utr
                && s.net_amount == bank.credited_amount
                && s.currency == bank.currency
                && s.settled_at == bank.credited_at
        });
        let Some(hit) = hit else {
            continue;
        };
        used_settlement.insert(hit.settlement_id.clone());
        matched_bank.insert(bank.id.clone());
        matches.push(MatchResult {
            bank_credit_id: bank.id.clone(),
            settlement_id: hit.settlement_id.clone(),
            components: None,
            confidence: 1.0,
            matched_by: MatchSource::Exact,
            reasoning: Some(
                "Exact UTR, net/credited amount, currency, and date match".into(),
            ),
        });
    }

    let remaining_bank: Vec<_> = bank_pool
        .iter()
        .filter(|b| !matched_bank.contains(&b.id))
        .cloned()
        .collect();
    let remaining_settlements: Vec<_> = settlement_pool
        .iter()
        .filter(|s| !used_settlement.contains(&s.settlement_id))
        .cloned()
        .collect();

    (matches, remaining_bank, remaining_settlements)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bank(id: &str) -> BankCredit {
        BankCredit {
            id: id.into(),
            utr: "UTR000001ABCDEF".into(),
            credited_amount: 1000.0,
            credited_at: "2025-01-15".into(),
            currency: "INR".into(),
        }
    }

    fn settlement(id: &str) -> Settlement {
        Settlement {
            settlement_id: id.into(),
            payment_id: "pay_0001".into(),
            gross_amount: 1050.0,
            fee: 40.0,
            tax: 10.0,
            net_amount: 1000.0,
            settled_at: "2025-01-15".into(),
            utr: "UTR000001ABCDEF".into(),
            currency: "INR".into(),
        }
    }

    #[test]
    fn matches_identical() {
        let (matches, _, _) = exact_match(&[bank("B1")], &[settlement("S1")]);
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].bank_credit_id, "B1");
        assert_eq!(matches[0].settlement_id, "S1");
        assert_eq!(matches[0].matched_by, MatchSource::Exact);
    }

    #[test]
    fn rejects_currency_diff() {
        let mut b = bank("B1");
        b.currency = "USD".into();
        let (matches, _, _) = exact_match(&[b], &[settlement("S1")]);
        assert!(matches.is_empty());
    }

    #[test]
    fn rejects_amount_diff() {
        let mut b = bank("B1");
        b.credited_amount = 100.0;
        let mut s = settlement("S1");
        s.net_amount = 100.5;
        let (matches, _, _) = exact_match(&[b], &[s]);
        assert!(matches.is_empty());
    }

    #[test]
    fn greedy_one_to_one() {
        let (matches, rem_bank, _) =
            exact_match(&[bank("B1"), bank("B2")], &[settlement("S1")]);
        assert_eq!(matches.len(), 1);
        assert_eq!(rem_bank.len(), 1);
    }
}
