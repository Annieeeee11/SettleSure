//! Slack/email notifications after reconciliation.

use settlesure_types::{DataSource, FullReport, Result, SettleSureError};
use std::env;

pub struct NotifyOpts {
    pub dashboard_url: String,
    pub slack_webhook_url: Option<String>,
    pub resend_api_key: Option<String>,
    pub notify_email_to: Option<String>,
}

impl NotifyOpts {
    pub fn from_env() -> Self {
        Self {
            dashboard_url: env::var("DASHBOARD_URL")
                .unwrap_or_else(|_| "http://localhost:5173".to_string()),
            slack_webhook_url: env::var("SLACK_WEBHOOK_URL").ok().filter(|s| !s.is_empty()),
            resend_api_key: env::var("RESEND_API_KEY").ok().filter(|s| !s.is_empty()),
            notify_email_to: env::var("NOTIFY_EMAIL_TO").ok().filter(|s| !s.is_empty()),
        }
    }
}

fn format_message(report: &FullReport, dashboard_url: &str) -> String {
    let n = report.exceptions.len();
    let at_risk = report
        .metrics
        .amount_at_risk
        .map(|a| format!("₹{a:.2}"))
        .unwrap_or_else(|| "n/a".to_string());

    let metrics_line = match report.metrics.data_source {
        Some(DataSource::Csv) => format!("Match rate: {:.1}%", report.metrics.match_rate * 100.0),
        _ => format!(
            "Precision: {:.1}% | Recall: {:.1}%",
            report.metrics.precision * 100.0,
            report.metrics.recall * 100.0
        ),
    };

    format!(
        "SettleSure: {n} exception(s) ({at_risk} at risk)\n{metrics_line}\n→ {dashboard_url}"
    )
}

pub async fn notify_exceptions(report: &FullReport, opts: &NotifyOpts) -> Result<()> {
    if report.exceptions.is_empty() {
        return Ok(());
    }

    let message = format_message(report, &opts.dashboard_url);

    if let Some(ref webhook) = opts.slack_webhook_url {
        send_slack(webhook, &message).await?;
    }

    if let (Some(ref api_key), Some(ref to)) = (&opts.resend_api_key, &opts.notify_email_to) {
        send_resend_email(api_key, to, &message, report).await?;
    }

    if opts.slack_webhook_url.is_none()
        && (opts.resend_api_key.is_none() || opts.notify_email_to.is_none())
    {
        return Err(SettleSureError::Message(
            "--notify requires SLACK_WEBHOOK_URL and/or RESEND_API_KEY+NOTIFY_EMAIL_TO".into(),
        ));
    }

    Ok(())
}

async fn send_slack(webhook_url: &str, text: &str) -> Result<()> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({ "text": text });
    let resp = client.post(webhook_url).json(&body).send().await.map_err(|e| {
        SettleSureError::Message(format!("Slack webhook failed: {e}"))
    })?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(SettleSureError::Message(format!(
            "Slack webhook returned {status}: {body}"
        )));
    }
    Ok(())
}

async fn send_resend_email(
    api_key: &str,
    to: &str,
    message: &str,
    report: &FullReport,
) -> Result<()> {
    let client = reqwest::Client::new();
    let top_exceptions: String = report
        .exceptions
        .iter()
        .take(5)
        .map(|e| format!("- {}: {}", e.record_id, e.reason))
        .collect::<Vec<_>>()
        .join("\n");

    let html = format!(
        "<p>{message}</p><h3>Top exceptions</h3><pre>{top_exceptions}</pre>"
    );

    let body = serde_json::json!({
        "from": "SettleSure <onboarding@resend.dev>",
        "to": [to],
        "subject": format!("SettleSure: {} unresolved exception(s)", report.exceptions.len()),
        "html": html,
    });

    let resp = client
        .post("https://api.resend.com/emails")
        .header("Authorization", format!("Bearer {api_key}"))
        .json(&body)
        .send()
        .await
        .map_err(|e| SettleSureError::Message(format!("Resend email failed: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(SettleSureError::Message(format!(
            "Resend returned {status}: {body}"
        )));
    }
    Ok(())
}
