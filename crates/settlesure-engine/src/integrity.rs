//! Pre-pass: payment↔settlement integrity.

use settlesure_types::{
    round_money, DiscrepancyClass, Exception, ExceptionSource, Payment, Settlement,
};
use std::collections::{HashMap, HashSet};

pub fn integrity_check(
    payments: &[Payment],
    settlements: &[Settlement],
) -> (Vec<Exception>, HashSet<String>) {
    let by_payment: HashMap<&str, &Payment> = payments
        .iter()
        .map(|p| (p.payment_id.as_str(), p))
        .collect();
    let mut exceptions = Vec::new();
    let mut flagged = HashSet::new();

    for s in settlements {
        let expected_net = round_money(s.gross_amount - s.fee - s.tax);
        if (expected_net - s.net_amount).abs() > 0.01 {
            flagged.insert(s.settlement_id.clone());
            exceptions.push(Exception {
                record_id: s.settlement_id.clone(),
                source: ExceptionSource::Settlement,
                reason: format!(
                    "fee/tax miscalculation: netAmount {} ≠ gross({}) - fee({}) - tax({}) = {}",
                    s.net_amount, s.gross_amount, s.fee, s.tax, expected_net
                ),
                exception_type: Some(DiscrepancyClass::FeeTaxMismatch),
                related_ids: None,
            });
            continue;
        }

        let Some(pay) = by_payment.get(s.payment_id.as_str()) else {
            flagged.insert(s.settlement_id.clone());
            exceptions.push(Exception {
                record_id: s.settlement_id.clone(),
                source: ExceptionSource::Settlement,
                reason: format!(
                    "settlement paymentId {} has no payment record",
                    s.payment_id
                ),
                exception_type: None,
                related_ids: None,
            });
            continue;
        };

        if (pay.amount - s.gross_amount).abs() > 0.01 {
            flagged.insert(s.settlement_id.clone());
            exceptions.push(Exception {
                record_id: s.settlement_id.clone(),
                source: ExceptionSource::Settlement,
                reason: format!(
                    "grossAmount {} does not match payment amount {}",
                    s.gross_amount, pay.amount
                ),
                exception_type: None,
                related_ids: None,
            });
            continue;
        }

        if pay.currency != s.currency {
            flagged.insert(s.settlement_id.clone());
            exceptions.push(Exception {
                record_id: s.settlement_id.clone(),
                source: ExceptionSource::Settlement,
                reason: format!(
                    "currency mismatch between payment ({}) and settlement ({})",
                    pay.currency, s.currency
                ),
                exception_type: Some(DiscrepancyClass::CurrencyMismatch),
                related_ids: None,
            });
        }
    }

    (exceptions, flagged)
}

#[cfg(test)]
mod tests {
    use super::*;
    use settlesure_types::PaymentStatus;

    #[test]
    fn flags_fee_tax_mismatch() {
        let payments = vec![Payment {
            order_id: "o1".into(),
            payment_id: "pay_1".into(),
            amount: 1000.0,
            currency: "INR".into(),
            status: PaymentStatus::Captured,
            created_at: "2025-01-01".into(),
        }];
        let settlements = vec![Settlement {
            settlement_id: "s1".into(),
            payment_id: "pay_1".into(),
            gross_amount: 1000.0,
            fee: 20.0,
            tax: 4.0,
            net_amount: 900.0,
            settled_at: "2025-01-02".into(),
            utr: "UTR1".into(),
            currency: "INR".into(),
        }];
        let (ex, flagged) = integrity_check(&payments, &settlements);
        assert!(flagged.contains("s1"));
        assert_eq!(ex[0].exception_type, Some(DiscrepancyClass::FeeTaxMismatch));
    }
}
