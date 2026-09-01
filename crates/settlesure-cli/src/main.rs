//! SettleSure CLI — argument parsing and orchestration only (no matching logic).

mod banner;
mod notify;

use clap::Parser;
use settlesure_data::{generate_and_write_with_opts, GenerateDatasetOpts};
use settlesure_engine::{
    load_corrections_with_fallback, reconcile, suggest_fuzzy_threshold, LlmPassResult,
};
use settlesure_ingest::load_csv_dataset;
use settlesure_llm::{llm_resolve, select_llm_provider, LlmSelectOptions};
use settlesure_scoring::{
    check_reconciliation_invariant, format_terminal, score_operational_with_banks, write_report,
    ReportPaths, ReconciliationInvariant, KNOWN_LIMITATIONS,
};
use settlesure_scoring::score_against_ground_truth;
use settlesure_types::{
    AmbiguityLevel, BankCredit, Correction, FullReport, GroundTruthLabel, GroundTruthLabelKind,
    LlmAblationRobustnessSummary, LlmAblationSide, LlmAblationSummary, LlmProviderChoice,
    MatchResult, MetricRange, Payment, ReconcileConfig, RobustnessSummary, ScoreReport, Secret,
    Settlement, DEFAULT_CONFIG,
};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use tracing::{info, warn};

#[derive(Debug, Parser)]
#[command(
    name = "settlesure",
    about = "Razorpay-style payment gateway settlement reconciliation\n(Payment → Settlement → Bank payout credit via UTR).",
    disable_help_subcommand = true
)]
struct Args {
    /// Seeded RNG (default: 42)
    #[arg(long, default_value_t = 42)]
    seed: u32,

    /// Write data/*.json and exit
    #[arg(long)]
    generate_only: bool,

    /// Force no LLM (same as --llm-provider none)
    #[arg(long)]
    skip_llm: bool,

    /// LLM provider: anthropic | openai | ollama | none
    #[arg(long, value_parser = parse_provider)]
    llm_provider: Option<LlmProviderChoice>,

    /// Ollama / OpenAI-compatible model name (Ollama default: llama3.2; OpenAI default: gpt-4o-mini)
    #[arg(long, default_value = "llama3.2")]
    llm_model: String,

    /// OpenAI-compatible API base URL (default https://api.openai.com/v1)
    #[arg(long, value_name = "URL")]
    llm_base_url: Option<String>,

    /// Apply corrections (output/ or data/demo_)
    #[arg(long)]
    apply_corrections: bool,

    /// Run seeds seed..seed+n-1; report mean±range
    #[arg(long, default_value_t = 1)]
    runs: u32,

    /// Ablate LLM on vs off for the same seed
    #[arg(long)]
    compare_llm: bool,

    /// Use output/llm-cache.json for LLM verdict caching (default on)
    #[arg(long, default_value_t = true)]
    llm_cache: bool,

    /// Disable LLM verdict cache (fresh model calls)
    #[arg(long)]
    no_llm_cache: bool,

    /// Skip the startup logo (also skipped when not a TTY)
    #[arg(long)]
    no_banner: bool,

    /// Write NDJSON match-list dump (payment/settlement/bank triples + sources)
    #[arg(long, value_name = "PATH", num_args = 0..=1, default_missing_value = "output/matches.ndjson")]
    dump_matches: Option<String>,

    /// Multiply adversarial class counts when generating data (default 1)
    #[arg(long, default_value_t = 1)]
    batch_scale: u32,

    /// Override data output directory (for --generate-only / benchmarks)
    #[arg(long, value_name = "DIR")]
    output_data_dir: Option<PathBuf>,

    /// Settlement CSV file (requires --bank-file and --payments-file)
    #[arg(long, value_name = "PATH")]
    settlement_file: Option<PathBuf>,

    /// Bank statement CSV file (requires --settlement-file and --payments-file)
    #[arg(long, value_name = "PATH")]
    bank_file: Option<PathBuf>,

    /// Payments CSV file (requires --settlement-file and --bank-file)
    #[arg(long, value_name = "PATH")]
    payments_file: Option<PathBuf>,

    /// Send Slack/email alert when exceptions are found (requires env vars)
    #[arg(long)]
    notify: bool,

    /// Workspace root (defaults to cwd)
    #[arg(long, hide = true)]
    root: Option<PathBuf>,
}

fn parse_provider(s: &str) -> Result<LlmProviderChoice, String> {
    match s {
        "anthropic" => Ok(LlmProviderChoice::Anthropic),
        "openai" => Ok(LlmProviderChoice::OpenAi),
        "ollama" => Ok(LlmProviderChoice::Ollama),
        "none" => Ok(LlmProviderChoice::None),
        other => Err(format!(
            "--llm-provider must be anthropic|openai|ollama|none, got {other}"
        )),
    }
}

/// Single validated config built once at startup — no ad-hoc env reads elsewhere.
#[derive(Debug, Clone)]
struct AppConfig {
    root: PathBuf,
    seed: u32,
    generate_only: bool,
    skip_llm: bool,
    llm_provider: Option<LlmProviderChoice>,
    llm_model: String,
    llm_base_url: Option<String>,
    apply_corrections: bool,
    runs: u32,
    compare_llm: bool,
    llm_cache: bool,
    no_banner: bool,
    dump_matches: Option<String>,
    batch_scale: u32,
    output_data_dir: Option<PathBuf>,
    settlement_file: Option<PathBuf>,
    bank_file: Option<PathBuf>,
    payments_file: Option<PathBuf>,
    notify: bool,
    anthropic_api_key: Option<Secret<String>>,
    openai_api_key: Option<Secret<String>>,
}

impl AppConfig {
    fn from_args(args: Args) -> Self {
        let mut skip_llm = args.skip_llm;
        let mut llm_provider = args.llm_provider;
        if skip_llm {
            llm_provider = Some(LlmProviderChoice::None);
        }
        if llm_provider == Some(LlmProviderChoice::None) {
            skip_llm = true;
        }

        let anthropic_api_key = std::env::var("ANTHROPIC_API_KEY")
            .ok()
            .filter(|s| !s.is_empty())
            .map(Secret::new);
        let openai_api_key = std::env::var("OPENAI_API_KEY")
            .ok()
            .filter(|s| !s.is_empty())
            .map(Secret::new);

        Self {
            root: args.root.unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))),
            seed: args.seed,
            generate_only: args.generate_only,
            skip_llm,
            llm_provider,
            llm_model: args.llm_model,
            llm_base_url: args.llm_base_url,
            apply_corrections: args.apply_corrections,
            runs: args.runs.max(1),
            compare_llm: args.compare_llm,
            llm_cache: args.llm_cache && !args.no_llm_cache,
            no_banner: args.no_banner,
            dump_matches: args.dump_matches,
            batch_scale: args.batch_scale.max(1),
            output_data_dir: args.output_data_dir,
            settlement_file: args.settlement_file,
            bank_file: args.bank_file,
            payments_file: args.payments_file,
            notify: args.notify,
            anthropic_api_key,
            openai_api_key,
        }
    }

    fn data_dir(&self) -> PathBuf {
        self.root.join("data")
    }

    fn generate_target_dir(&self) -> PathBuf {
        self.output_data_dir
            .clone()
            .unwrap_or_else(|| self.data_dir())
    }

    fn generate_opts(&self) -> GenerateDatasetOpts {
        GenerateDatasetOpts {
            batch_scale: self.batch_scale,
            ..GenerateDatasetOpts::default()
        }
    }

    fn output_dir(&self) -> PathBuf {
        self.root.join("output")
    }

    fn reconcile_config(&self) -> ReconcileConfig {
        let mut cfg = DEFAULT_CONFIG.clone();
        cfg.skip_llm = self.skip_llm;
        cfg.llm_provider = self.llm_provider;
        cfg.llm_model = Some(self.llm_model.clone());
        cfg.seed = Some(self.seed);
        cfg.apply_corrections = Some(self.apply_corrections);
        cfg
    }

    fn llm_select(
        &self,
        skip: bool,
        provider: Option<LlmProviderChoice>,
        seed: u32,
    ) -> LlmSelectOptions {
        LlmSelectOptions {
            skip_llm: skip,
            llm_provider: provider,
            llm_model: Some(self.llm_model.clone()),
            seed,
            anthropic_api_key: self.anthropic_api_key.clone(),
            openai_api_key: self.openai_api_key.clone(),
            llm_base_url: self.llm_base_url.clone(),
            llm_cache: self.llm_cache,
            llm_cache_path: Some(self.output_dir().join("llm-cache.json")),
        }
    }
}

fn to_engine_llm(r: settlesure_llm::LlmResolveResult) -> LlmPassResult {
    LlmPassResult {
        matches: r.matches,
        exceptions: r.exceptions,
        enabled: r.enabled,
        provider_name: r.provider_name,
        call_stats: r.call_stats,
    }
}

fn copy_report_to_dashboard(root: &Path, json_path: &Path) {
    let dashboard = root.join("dashboard");
    if !dashboard.exists() {
        return;
    }
    let dest_dir = dashboard.join("public");
    if let Err(e) = fs::create_dir_all(&dest_dir) {
        warn!("could not create dashboard public dir: {e}");
        return;
    }
    let dest = dest_dir.join("report.json");
    if let Err(e) = fs::copy(json_path, &dest) {
        warn!("could not copy report to dashboard: {e}");
    }
}

fn metric_stats(values: &[f64]) -> MetricRange {
    let n = values.len() as f64;
    let mean = values.iter().sum::<f64>() / n;
    let variance = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n;
    let std_dev = variance.sqrt();
    MetricRange {
        mean: (mean * 10000.0).round() / 10000.0,
        min: values.iter().copied().fold(f64::INFINITY, f64::min),
        max: values.iter().copied().fold(f64::NEG_INFINITY, f64::max),
        std_dev: Some((std_dev * 10000.0).round() / 10000.0),
    }
}

fn validate_file_args(app: &AppConfig) -> Result<(), settlesure_types::SettleSureError> {
    let files = [
        ("--settlement-file", &app.settlement_file),
        ("--bank-file", &app.bank_file),
        ("--payments-file", &app.payments_file),
    ];
    let provided: Vec<_> = files.iter().filter(|(_, p)| p.is_some()).collect();
    if provided.is_empty() {
        return Ok(());
    }
    if provided.len() != 3 {
        let missing: Vec<_> = files
            .iter()
            .filter(|(_, p)| p.is_none())
            .map(|(name, _)| *name)
            .collect();
        return Err(settlesure_types::SettleSureError::Message(format!(
            "real CSV mode requires all three file flags; missing: {}",
            missing.join(", ")
        )));
    }
    for (name, path) in files {
        let path = path.as_ref().unwrap();
        if !path.exists() {
            return Err(settlesure_types::SettleSureError::Message(format!(
                "{name} not found: {}",
                path.display()
            )));
        }
    }
    Ok(())
}

fn is_csv_mode(app: &AppConfig) -> bool {
    app.settlement_file.is_some()
}

struct RunData {
    payments: Vec<Payment>,
    settlements: Vec<Settlement>,
    bank_credits: Vec<BankCredit>,
    ground_truth: Vec<GroundTruthLabel>,
}

fn load_run_data(
    app: &AppConfig,
    seed: u32,
) -> Result<RunData, settlesure_types::SettleSureError> {
    if is_csv_mode(app) {
        let csv = load_csv_dataset(
            app.settlement_file.as_ref().unwrap(),
            app.bank_file.as_ref().unwrap(),
            app.payments_file.as_ref().unwrap(),
        )?;
        eprintln!(
            "Loaded {} payments, {} settlements, {} bank credits from CSV.",
            csv.payments.len(),
            csv.settlements.len(),
            csv.bank_credits.len()
        );
        Ok(RunData {
            payments: csv.payments,
            settlements: csv.settlements,
            bank_credits: csv.bank_credits,
            ground_truth: Vec::new(),
        })
    } else {
        let dataset = generate_and_write_with_opts(seed, &app.data_dir(), app.generate_opts())?;
        Ok(RunData {
            payments: dataset.payments,
            settlements: dataset.settlements,
            bank_credits: dataset.bank_credits,
            ground_truth: dataset.ground_truth,
        })
    }
}

fn sorted_set_key(ids: &[String]) -> String {
    let mut v: Vec<&str> = ids.iter().map(String::as_str).collect();
    v.sort();
    v.join(",")
}

fn find_ambiguity_level(
    bank_credit_id: &str,
    settlement_ids: &[String],
    ground_truth: &[GroundTruthLabel],
) -> Option<AmbiguityLevel> {
    let key = sorted_set_key(settlement_ids);
    for g in ground_truth {
        if g.label != GroundTruthLabelKind::Match {
            continue;
        }
        if g.bank_credit_id.as_deref() != Some(bank_credit_id) {
            continue;
        }
        if let Some(ref ids) = g.settlement_ids {
            if ids.len() > 1 && sorted_set_key(ids) == key {
                return Some(g.ambiguity_level);
            }
        } else if settlement_ids.len() == 1
            && g.settlement_id.as_deref() == Some(settlement_ids[0].as_str())
        {
            return Some(g.ambiguity_level);
        }
    }
    None
}

fn dump_matches_ndjson(
    path: &Path,
    matches: &[MatchResult],
    settlements: &[Settlement],
    ground_truth: &[GroundTruthLabel],
) -> Result<(), settlesure_types::SettleSureError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut file = fs::File::create(path)?;
    let by_setl: HashMap<&str, &Settlement> = settlements
        .iter()
        .map(|s| (s.settlement_id.as_str(), s))
        .collect();
    for m in matches {
        let component_ids: Vec<String> = m
            .components
            .clone()
            .unwrap_or_else(|| vec![m.settlement_id.clone()]);
        let ambiguity = find_ambiguity_level(&m.bank_credit_id, &component_ids, ground_truth);
        let amb_str = ambiguity.map(|a| a.as_str());
        let source_str = match m.matched_by {
            settlesure_types::MatchSource::Exact => "exact",
            settlesure_types::MatchSource::Fuzzy => "fuzzy",
            settlesure_types::MatchSource::Split => "split",
            settlesure_types::MatchSource::Llm => "llm",
            settlesure_types::MatchSource::Human => "human",
        };
        for setl_id in &component_ids {
            let payment_id = by_setl
                .get(setl_id.as_str())
                .map(|s| s.payment_id.as_str());
            let line = serde_json::json!({
                "payment_id": payment_id,
                "settlement_id": setl_id,
                "bank_credit_id": m.bank_credit_id,
                "match_source": source_str,
                "ambiguity_level": amb_str,
            });
            writeln!(file, "{line}")?;
        }
    }
    Ok(())
}

async fn run_once(
    app: &AppConfig,
    seed: u32,
    skip_llm: bool,
    llm_provider: Option<LlmProviderChoice>,
    corrections: &[Correction],
) -> Result<
    (
        ScoreReport,
        FullReport,
        String,
        Option<settlesure_types::LlmCallStats>,
        ReconciliationInvariant,
        Vec<BankCredit>,
    ),
    settlesure_types::SettleSureError,
> {
    let data = load_run_data(app, seed)?;
    let mut cfg = app.reconcile_config();
    cfg.seed = Some(seed);
    cfg.skip_llm = skip_llm;
    cfg.llm_provider = llm_provider;
    cfg.llm_model = Some(app.llm_model.clone());

    let select_opts = app.llm_select(skip_llm, llm_provider, seed);
    let selected_name = select_llm_provider(&select_opts).await.name;

    let mut llm_call_stats = None;
    let result = reconcile(
        &data.payments,
        &data.settlements,
        &data.bank_credits,
        &cfg,
        corrections,
        |ambiguous| {
            // Bridge async LLM into sync engine callback via current runtime.
            let opts = app.llm_select(skip_llm, llm_provider, seed);
            let ambiguous = ambiguous.to_vec();
            let rt_result = tokio::task::block_in_place(|| {
                tokio::runtime::Handle::current()
                    .block_on(async { llm_resolve(&ambiguous, &opts).await })
            });
            llm_call_stats = rt_result.call_stats.clone();
            to_engine_llm(rt_result)
        },
    );

    let invariant = check_reconciliation_invariant(&result)
        .map_err(settlesure_types::SettleSureError::Message)?;

    let llm_enabled = selected_name != "none" && !skip_llm;
    let metrics = if is_csv_mode(app) {
        score_operational_with_banks(
            &result,
            &data.bank_credits,
            seed,
            llm_enabled,
            selected_name.as_str(),
        )
    } else {
        score_against_ground_truth(
            &result,
            &data.ground_truth,
            seed,
            llm_enabled,
            selected_name.as_str(),
        )
    };

    let full = FullReport {
        metrics: metrics.clone(),
        matches: result.matches.clone(),
        exceptions: result.exceptions,
        known_limitations: KNOWN_LIMITATIONS.iter().map(|s| (*s).to_string()).collect(),
    };

    if let Some(ref dump_rel) = app.dump_matches {
        if !is_csv_mode(app) {
            let path = PathBuf::from(dump_rel);
            let path = if path.is_absolute() {
                path
            } else {
                app.root.join(path)
            };
            dump_matches_ndjson(
                &path,
                &result.matches,
                &data.settlements,
                &data.ground_truth,
            )?;
            eprintln!("Wrote match dump to {}", path.display());
        }
    }

    Ok((
        metrics,
        full,
        selected_name,
        llm_call_stats,
        invariant,
        data.bank_credits,
    ))
}

#[tokio::main]
async fn main() -> ExitCode {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("warn")),
        )
        .with_writer(std::io::stderr)
        .init();

    let args = Args::parse();
    let app = AppConfig::from_args(args);

    if atty_stdout() && !app.no_banner {
        banner::print_banner();
    }

    match run(app).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("{e}");
            ExitCode::FAILURE
        }
    }
}

fn atty_stdout() -> bool {
    // Avoid extra dep: check isatty via libc-free heuristic using stderr for tracing
    std::io::IsTerminal::is_terminal(&std::io::stdout())
}

async fn run(app: AppConfig) -> Result<(), settlesure_types::SettleSureError> {
    validate_file_args(&app)?;

    if is_csv_mode(&app) && (app.runs > 1 || app.compare_llm) {
        return Err(settlesure_types::SettleSureError::Message(
            "CSV mode does not support --runs or --compare-llm (no ground truth)".into(),
        ));
    }
    if app.generate_only {
        eprintln!(
            "Generating synthetic settlement dataset (seed={})...",
            app.seed
        );
        let dataset =
            generate_and_write_with_opts(app.seed, &app.generate_target_dir(), app.generate_opts())?;
        eprintln!(
            "Wrote {} payments, {} settlements, {} bank credits, {} ground-truth labels, {} demo corrections.",
            dataset.payments.len(),
            dataset.settlements.len(),
            dataset.bank_credits.len(),
            dataset.ground_truth.len(),
            dataset.demo_corrections.len()
        );
        eprintln!("Done (--generate-only).");
        return Ok(());
    }

    let corrections = if app.apply_corrections {
        let loaded = load_corrections_with_fallback(
            &app.output_dir().join("corrections.json"),
            &app.data_dir().join("demo_corrections.json"),
        )?;
        eprintln!("Loaded {} human correction(s).", loaded.len());
        loaded
    } else {
        Vec::new()
    };

    if app.compare_llm && app.runs > 1 {
        eprintln!(
            "LLM ablation robustness: {} seeds starting at {}...",
            app.runs, app.seed
        );
        let provider_for_with = if app.llm_provider == Some(LlmProviderChoice::None) {
            None
        } else {
            app.llm_provider
        };
        let mut seeds = Vec::new();
        let mut recall_lifts = Vec::new();
        let mut with_recalls = Vec::new();
        let mut without_recalls = Vec::new();
        let mut llm_match_counts = Vec::new();
        let mut per_seed = Vec::new();
        let mut last_full: Option<FullReport> = None;
        let mut last_invariant: Option<ReconciliationInvariant> = None;

        for i in 0..app.runs {
            let s = app.seed + i;
            seeds.push(s);
            let corr = if i == 0 { corrections.as_slice() } else { &[] };
            let (with_metrics, mut with_full, with_name, with_call_stats, with_inv, _) = run_once(
                &app,
                s,
                false,
                provider_for_with,
                corr,
            )
            .await?;
            let (without_metrics, _, _, _, _, _) = run_once(
                &app,
                s,
                true,
                Some(LlmProviderChoice::None),
                corr,
            )
            .await?;
            let lift = with_metrics.recall - without_metrics.recall;
            recall_lifts.push(lift);
            with_recalls.push(with_metrics.recall);
            without_recalls.push(without_metrics.recall);
            llm_match_counts.push(with_metrics.match_source_breakdown.llm as f64);
            let ablation = LlmAblationSummary {
                provider_available: with_name != "none",
                with_llm: LlmAblationSide {
                    match_rate: with_metrics.match_rate,
                    precision: with_metrics.precision,
                    recall: with_metrics.recall,
                    false_positive_rate: with_metrics.false_positive_rate,
                    llm_matches: with_metrics.match_source_breakdown.llm,
                    provider: Some(with_name),
                },
                without_llm: LlmAblationSide {
                    match_rate: without_metrics.match_rate,
                    precision: without_metrics.precision,
                    recall: without_metrics.recall,
                    false_positive_rate: without_metrics.false_positive_rate,
                    llm_matches: without_metrics.match_source_breakdown.llm,
                    provider: None,
                },
                call_stats: with_call_stats,
            };
            per_seed.push(ablation);
            with_full.metrics.llm_ablation = Some(per_seed.last().unwrap().clone());
            last_full = Some(with_full);
            last_invariant = Some(with_inv);
            eprintln!(
                "  seed {s}: recall lift {:.1}% (with {:.1}% / without {:.1}%)",
                lift * 100.0,
                with_metrics.recall * 100.0,
                without_metrics.recall * 100.0
            );
        }

        let mut full = last_full.ok_or_else(|| {
            settlesure_types::SettleSureError::Message("no ablation runs".into())
        })?;
        full.metrics.llm_ablation_robustness = Some(LlmAblationRobustnessSummary {
            seeds: seeds.clone(),
            recall_lift: metric_stats(&recall_lifts),
            with_llm_recall: metric_stats(&with_recalls),
            without_llm_recall: metric_stats(&without_recalls),
            llm_matches: metric_stats(&llm_match_counts),
            per_seed: Some(per_seed),
        });
        let (json_path, md_path, _) = write_report(&full, &app.output_dir())?;
        copy_report_to_dashboard(&app.root, &json_path);
        let json_s = json_path.to_string_lossy();
        let md_s = md_path.to_string_lossy();
        println!(
            "{}",
            format_terminal(
                &full,
                Some(ReportPaths {
                    json_path: Some(json_s.as_ref()),
                    md_path: Some(md_s.as_ref()),
                }),
                last_invariant.as_ref(),
            )
        );
        return Ok(());
    }

    if app.runs > 1 {
        eprintln!(
            "Running robustness suite: {} seeds starting at {}...",
            app.runs, app.seed
        );
        let mut seeds = Vec::new();
        let mut match_rates = Vec::new();
        let mut precisions = Vec::new();
        let mut recalls = Vec::new();
        let mut fps = Vec::new();
        let mut last_full: Option<FullReport> = None;
        let mut last_invariant: Option<ReconciliationInvariant> = None;

        for i in 0..app.runs {
            let s = app.seed + i;
            seeds.push(s);
            let corr = if i == 0 { corrections.as_slice() } else { &[] };
            let (metrics, full, _, _, inv, _) = run_once(
                &app,
                s,
                app.skip_llm,
                app.llm_provider,
                corr,
            )
            .await?;
            match_rates.push(metrics.match_rate);
            precisions.push(metrics.precision);
            recalls.push(metrics.recall);
            fps.push(metrics.false_positive_rate);
            last_full = Some(full);
            last_invariant = Some(inv);
            eprintln!(
                "  seed {s}: match={:.1}% P={:.1}% R={:.1}% FP={:.1}%",
                metrics.match_rate * 100.0,
                metrics.precision * 100.0,
                metrics.recall * 100.0,
                metrics.false_positive_rate * 100.0
            );
        }

        let mut full = last_full.ok_or_else(|| {
            settlesure_types::SettleSureError::Message("no robustness runs".into())
        })?;
        full.metrics.robustness = Some(RobustnessSummary {
            seeds,
            match_rate: metric_stats(&match_rates),
            precision: metric_stats(&precisions),
            recall: metric_stats(&recalls),
            false_positive_rate: metric_stats(&fps),
        });
        let (json_path, md_path, _) = write_report(&full, &app.output_dir())?;
        copy_report_to_dashboard(&app.root, &json_path);
        let json_s = json_path.to_string_lossy();
        let md_s = md_path.to_string_lossy();
        println!(
            "{}",
            format_terminal(
                &full,
                Some(ReportPaths {
                    json_path: Some(json_s.as_ref()),
                    md_path: Some(md_s.as_ref()),
                }),
                last_invariant.as_ref(),
            )
        );
        return Ok(());
    }

    if app.compare_llm {
        eprintln!("LLM ablation for seed {}...", app.seed);
        let provider_for_with = if app.llm_provider == Some(LlmProviderChoice::None) {
            None
        } else {
            app.llm_provider
        };
        let (with_metrics, mut with_full, with_name, with_call_stats, with_inv, _) = run_once(
            &app,
            app.seed,
            false,
            provider_for_with,
            &corrections,
        )
        .await?;
        let (without_metrics, _, _, _, _, _) = run_once(
            &app,
            app.seed,
            true,
            Some(LlmProviderChoice::None),
            &corrections,
        )
        .await?;

        let ablation = LlmAblationSummary {
            provider_available: with_name != "none",
            with_llm: LlmAblationSide {
                match_rate: with_metrics.match_rate,
                precision: with_metrics.precision,
                recall: with_metrics.recall,
                false_positive_rate: with_metrics.false_positive_rate,
                llm_matches: with_metrics.match_source_breakdown.llm,
                provider: Some(with_name.clone()),
            },
            without_llm: LlmAblationSide {
                match_rate: without_metrics.match_rate,
                precision: without_metrics.precision,
                recall: without_metrics.recall,
                false_positive_rate: without_metrics.false_positive_rate,
                llm_matches: without_metrics.match_source_breakdown.llm,
                provider: None,
            },
            call_stats: with_call_stats,
        };
        with_full.metrics.llm_ablation = Some(ablation.clone());
        if let Some(ref stats) = ablation.call_stats {
            eprintln!(
                "LLM calls: {} (match {} / no_match {} / declined {} / provider errors {}) — latency min {:.0}ms mean {:.0}ms max {:.0}ms",
                stats.call_count,
                stats.verdict_match,
                stats.verdict_no_match,
                stats.verdict_unsure,
                stats.provider_errors,
                stats.latency_ms_min,
                stats.latency_ms_mean,
                stats.latency_ms_max,
            );
        }
        if let Some(suggested) = suggest_fuzzy_threshold(&corrections) {
            with_full.metrics.suggested_fuzzy_threshold = Some(suggested);
        }
        let (json_path, md_path, _) = write_report(&with_full, &app.output_dir())?;
        copy_report_to_dashboard(&app.root, &json_path);
        let json_s = json_path.to_string_lossy();
        let md_s = md_path.to_string_lossy();
        println!(
            "{}",
            format_terminal(
                &with_full,
                Some(ReportPaths {
                    json_path: Some(json_s.as_ref()),
                    md_path: Some(md_s.as_ref()),
                }),
                Some(&with_inv),
            )
        );
        return Ok(());
    }

    let label = if is_csv_mode(&app) {
        "reconciling CSV files"
    } else {
        "generating + reconciling"
    };
    eprintln!("{label} (seed={})...", app.seed);
    let (mut metrics, mut full, _, _, invariant, _) = run_once(
        &app,
        app.seed,
        app.skip_llm,
        app.llm_provider,
        &corrections,
    )
    .await?;

    if let Some(suggested) = suggest_fuzzy_threshold(&corrections) {
        metrics.suggested_fuzzy_threshold = Some(suggested);
        full.metrics.suggested_fuzzy_threshold = Some(suggested);
        eprintln!(
            "Suggested fuzzyAcceptThreshold={suggested} (from human accepts in 0.65–0.75; not auto-applied)"
        );
    }

    let (json_path, md_path, _) = write_report(&full, &app.output_dir())?;
    copy_report_to_dashboard(&app.root, &json_path);

    if app.notify && !full.exceptions.is_empty() {
        let opts = notify::NotifyOpts::from_env();
        notify::notify_exceptions(&full, &opts).await?;
        eprintln!(
            "Notification sent ({} exception(s)).",
            full.exceptions.len()
        );
    }

    info!(
        precision = metrics.precision,
        recall = metrics.recall,
        "reconcile complete"
    );
    let json_s = json_path.to_string_lossy();
    let md_s = md_path.to_string_lossy();
    println!(
        "{}",
        format_terminal(
            &full,
            Some(ReportPaths {
                json_path: Some(json_s.as_ref()),
                md_path: Some(md_s.as_ref()),
            }),
            Some(&invariant),
        )
    );

    Ok(())
}
