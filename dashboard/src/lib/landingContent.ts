export const REPO_URL = "https://github.com/Annieeeee11/SettleSure";
export const CLI_CMD = "cargo run -p settlesure-cli -- --seed 42 --skip-llm";

export const LOGO = {
  src: "/settlesure-logo.png",
  alt: "SettleSure",
} as const;

export const CLI_WINDOW = {
  title: "settlesure-cli",
} as const;

export const WORDMARK = [
  " ████ █████ █████ █████ █     █████  ████ █   █ ████  █████   ",
  "█ ░░░░█░░░░░ ░█░░░ ░█░░░█░    █░░░░░█ ░░░░█░  █░█░░░█ █░░░░░  ",
  " ███░░████░░░ █░░░░ █░░░█░░   ████░░░███░░█░░ █░████░░████░░░ ",
  "  ░░█ █░░░░   █░░   █░░ █░░   █░░░░   ░░█ █░░ █░█░░█░ █░░░░   ",
  "████░░█████░  █░░   █░░ █████ █████░████░░ ███ ░█░░░█░█████░  ",
  " ░░░░ ░░░░░░   ░░    ░░  ░░░░░ ░░░░░ ░░░░ ░ ░░░ ░░░  ░ ░░░░░  ",
  "  ░░░░  ░░░░░   ░     ░   ░░░░░ ░░░░░ ░░░░   ░░░  ░   ░ ░░░░░ ",
] as const;

/** Seed 42, --skip-llm — matches docs/cli.png */
export const CLI_PREVIEW = {
  runLabel: "generating + reconciling (seed=42)...",
  status: {
    seed: 42,
    payments: 77,
    settlements: 77,
    bank: 60,
    llm: "none",
  },
  metrics: {
    matchRate: "85.71%",
    precision: "100.00%",
    recall: "85.71%",
    fpRate: "0.00%",
    exceptionAcc: "71.43%",
    gtMatches: 49,
    predicted: 42,
    tp: 42,
    fp: 0,
    fn: 7,
    trueExceptions: 35,
    predExceptions: 49,
    correctlyFlagged: 35,
    runtimeMs: 15.0,
    throughput: 9112.68,
  },
  matchSources: {
    exact: 23,
    fuzzy: 17,
    split: 2,
    llm: 0,
    human: 0,
    timing: { exact: 1.1, fuzzy: 11.8, split: 0.3, llm: 0.6 },
  },
  difficulty: [
    { label: "Clear", match: "100.00%", prec: "100.00%", deferred: "—" },
    { label: "Boundary", match: "42.86%", prec: "100.00%", deferred: "—" },
    { label: "Decoy", match: "50.00%", prec: "100.00%", deferred: "100.00%" },
    { label: "Unresolvable", match: "—", prec: "—", deferred: "100.00%" },
  ],
  exceptions: {
    groups: 27,
    records: 49,
    preview: [
      {
        ids: "setl_0068",
        source: "settlement",
        reason:
          "fee/tax miscalculation: netAmount 4127.24 != gross(4192.03) - fee(80.05) - tax(14.41) = 4097.57",
      },
      {
        ids: "setl_0069",
        source: "settlement",
        reason:
          "fee/tax miscalculation: netAmount 361.74 != gross(317.58) - fee(5.04) - tax(0.91) = 311.63",
      },
      {
        ids: "setl_0070",
        source: "settlement",
        reason:
          "fee/tax miscalculation: netAmount 1521.51 != gross(1509.65) - fee(36.16) - tax(6.51) = 1466.98",
      },
      {
        ids: "bank_0052",
        source: "bank",
        reason: "currency mismatch, not auto-resolved",
      },
      {
        ids: "bank_0053",
        source: "bank",
        reason: "currency mismatch, not auto-resolved",
      },
      {
        ids: "setl_0074",
        source: "settlement",
        reason: "currency mismatch, not auto-resolved",
      },
      {
        ids: "setl_0075",
        source: "settlement",
        reason: "currency mismatch, not auto-resolved",
      },
      {
        ids: "bank_0058",
        source: "bank",
        reason: "duplicate bank credit — UTR already settled by bank_0057",
      },
      {
        ids: "bank_0060",
        source: "bank",
        reason: "duplicate bank credit — UTR already settled by bank_0059",
      },
      {
        ids: "bank_0036,setl_0036",
        source: "bank+settlement",
        reason: "ambiguous — LLM unavailable",
      },
      {
        ids: "bank_0037,setl_0037",
        source: "bank+settlement",
        reason: "ambiguous — LLM unavailable",
      },
      {
        ids: "bank_0038,setl_0038,...",
        source: "bank+settlement",
        reason: "ambiguous — LLM unavailable",
      },
    ],
    moreGroups: 7,
  },
  limitations:
    "bounded split · no FX · near-dups need LLM/human — full list in report.md",
  wrote: ["output/report.json", "output/report.md"],
} as const;

export const HERO = {
  eyebrow: "Razorpay AI Buildathon · Finance Controller",
  title: ["It tells you what it couldn't solve.", "It doesn't guess."],
  lead:
    "Upload settlement, bank, and payment CSVs. Reconcile in milliseconds, surface every exception with ₹ at risk, and review in the dashboard or CLI.",
} as const;

export const FEATURES_SECTION = {
  eyebrow: "Features",
  title: "Built for finance ops",
  desc: "Millisecond reconciliation, tiered matching, and alerts when exceptions need attention.",
} as const;

export const PREVIEW = {
  caption: "Same engine everywhere: terminal, dashboard, or HTTP API.",
  dashboardImage: "/dashboard-seed42.png",
  dashboardAlt:
    "SettleSure dashboard showing reconciliation metrics and exceptions",
} as const;

export const CTA = {
  title: "Ready to reconcile?",
  desc: "Upload CSVs in the dashboard or run the CLI against your batch.",
  primaryLabel: "Open Dashboard",
  secondaryLabel: "Read docs",
} as const;

export type FooterLink =
  | { label: string; href: string; external: true }
  | { label: string; href: "/dashboard"; external: false };

export const FOOTER = {
  tagline: "SettleSure · settlement reconciliation",
  links: [
    { label: "Dashboard", href: "/dashboard", external: false },
    { label: "GitHub", href: REPO_URL, external: true },
    {
      label: "Razorpay Buildathon",
      href: "https://razorpay.com/buildathon/",
      external: true,
    },
  ] satisfies ReadonlyArray<FooterLink>,
} as const;

export type SectionIconName =
  | "speed"
  | "layers"
  | "alert"
  | "code"
  | "local"
  | "shield";

export const FEATURES: ReadonlyArray<{
  icon: SectionIconName;
  title: string;
  body: string;
}> = [
  {
    icon: "speed",
    title: "Reconcile in milliseconds",
    body: "Rust engine runs exact, fuzzy, and split passes in ~13 ms on the synthetic benchmark. No model calls for clear matches.",
  },
  {
    icon: "layers",
    title: "LLM as tier 4, not tier 1",
    body: "Deterministic rules handle 42/49 matches. The model only sees the 7 genuinely ambiguous cases rules can't safely decide.",
  },
  {
    icon: "alert",
    title: "Alerts when it matters",
    body: "Slack or email the moment exceptions surface, with ₹ at risk and a link straight to the dashboard review queue.",
  },
] as const;

export type PipelineVisualKind = "deterministic" | "llm" | "human";

export type PipelineShowcase = {
  id: string;
  eyebrow: string;
  title: string;
  desc: string;
  visual: PipelineVisualKind;
};

export const PIPELINE = {
  showcases: [
    {
      id: "deterministic",
      eyebrow: "Tiers 1–3",
      title: "Clear matches never touch a model",
      desc: "Exact UTR + amount + date matching, fuzzy near-duplicate resolution, and subset-sum split groups run in milliseconds. On seed 42 that's 42 of 49 matches with zero LLM calls.",
      visual: "deterministic",
    },
    {
      id: "llm-gate",
      eyebrow: "Tier 4",
      title: "LLM only when rules can't decide",
      desc: "Ambiguous bank/settlement pairs defer until corroboration. Wrong LLM verdicts can't auto-release. Bring your own key or skip entirely with --skip-llm.",
      visual: "llm",
    },
    {
      id: "human-audit",
      eyebrow: "Tier 5",
      title: "Ops override with full audit trail",
      desc: "Human reviewers release gated exceptions with ₹ at risk in view. Every override is logged so finance controllers can trace who approved what and when.",
      visual: "human",
    },
  ] satisfies ReadonlyArray<PipelineShowcase>,
} as const;

export const FAQ_SECTION = {
  title: ["Frequently", "asked questions"],
} as const;

export const FAQS = [
  {
    q: "What does SettleSure reconcile?",
    a: "Razorpay-style 3-way settlement flow: payment exports, settlement files, and bank payout credits. It matches UTRs, amounts, and dates, then flags every exception with ₹ at risk.",
  },
  {
    q: "Do I need an LLM to run it?",
    a: "No. Deterministic exact, fuzzy, and split tiers handle clear matches in milliseconds. LLM is tier 4 only for the genuinely ambiguous cases rules cannot safely decide.",
  },
  {
    q: "How can I run a batch?",
    a: "Use the CLI with CSV flags, upload all three files in the dashboard, or POST to the Rust reconciliation API. Same engine, same report format everywhere.",
  },
  {
    q: "Can I use my own model or API keys?",
    a: "Yes. Bring your own OpenAI, Anthropic, Groq, OpenRouter, or local Ollama key. Under --skip-llm, no model calls are made at all.",
  },
  {
    q: "What CSV formats are supported?",
    a: "Standard Razorpay-style settlement, bank, and payment exports. Dates must be YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY. US MM/DD/YYYY is not supported.",
  },
  {
    q: "How fast is reconciliation?",
    a: "The Rust engine reconciles the seed-42 synthetic benchmark in about 13 ms with --skip-llm. Fuzzy matching dominates at larger batch scales.",
  },
  {
    q: "Is SettleSure open source?",
    a: "Full source is on GitHub. Inspect, audit, and run the engine locally. The deterministic core never invokes an LLM unless you opt in.",
  },
] as const;

export const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#pipeline", label: "Pipeline" },
  { href: "#faq", label: "FAQ" },
] as const;
