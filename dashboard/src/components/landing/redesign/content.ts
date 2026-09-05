export const repositoryUrl = "https://github.com/Annieeeee11/SettleSure";
export const twitterUrl =
  "https://x.com/intent/tweet?text=SettleSure%20%E2%80%94%20deterministic%20Razorpay%20settlement%20reconciliation&url=https%3A%2F%2Fgithub.com%2FAnnieeeee11%2FSettleSure";

export const operatorSignals = [
  {
    source: "r/smallbusiness",
    topic: "messy payouts",
    title: "Dealing with messy payment reconciliation — how do you close books?",
    quote:
      "Payment reconciliation is still a spreadsheet sport — UTRs, fees, and settlement files never quite line up the same way twice.",
    tag: "payment operations",
    href: "https://www.reddit.com/r/smallbusiness/comments/1sergd6/dealing_with_messy_payment_reconciliation_how_do/",
    votes: 847,
    comments: 126,
    age: "14d",
  },
  {
    source: "r/smallbusiness",
    topic: "multi-rail close",
    title: "How are people handling reconciliation across UPI, cards, and bank transfers?",
    quote:
      "Once you take UPI, cards, and bank transfers together, nobody agrees which ledger owns the mismatch.",
    tag: "cross-rail matching",
    href: "https://www.reddit.com/r/smallbusiness/comments/1tq42ul/how_are_people_handling_reconciliation_across/",
    votes: 412,
    comments: 89,
    age: "9d",
  },
  {
    source: "r/plaintextaccounting",
    topic: "settlement files",
    title: "Reconciliation when settlement reports and bank credits don't line up",
    quote:
      "Settlement reports look clean until the bank credit lands late, partial, or under a different reference.",
    tag: "settlement credits",
    href: "https://www.reddit.com/r/plaintextaccounting/comments/1n9bwp7/reconciliation_with_settlement/",
    votes: 203,
    comments: 54,
    age: "3mo",
  },
] as const;

export const controls = [
  {
    number: "01",
    tag: "DETERMINISTIC MATCHING / TIERS 1–3",
    title: "Deterministic tiers 1–3.",
    copy: "Exact UTR, fuzzy near-duplicate, and split-group matching handle clear cases without a model call.",
  },
  {
    number: "02",
    tag: "TIER 4 / LLM GOVERNANCE",
    title: "LLM only for ambiguity.",
    copy: "Tier 4 receives only unresolved candidates. Invalid or uncertain verdicts fall back to the exception queue.",
  },
  {
    number: "03",
    tag: "HUMAN REVIEW / RELEASE CONTROL",
    title: "Human-controlled release.",
    copy: "Reviewers see ₹ at risk and match evidence before accepting or rejecting a correction. Every override is logged.",
  },
] as const;

export const walkthrough = [
  {
    step: "Tiers 1–3",
    title: "Clear matches never touch a model",
    copy: "Exact UTR + amount + date matching, fuzzy near-duplicate resolution, and subset-sum split groups run in milliseconds. On seed 42 that's 42 of 49 matches with zero LLM calls.",
    visual: "deterministic",
  },
  {
    step: "Tier 4",
    title: "LLM only when rules can't decide",
    copy: "Ambiguous bank/settlement pairs defer until corroboration. Wrong LLM verdicts can't auto-release. Bring your own key or skip entirely with --skip-llm.",
    visual: "llm",
  },
  {
    step: "Tier 5",
    title: "Ops override with full audit trail",
    copy: "Human reviewers release gated exceptions with ₹ at risk in view. Every override is logged so finance controllers can trace who approved what and when.",
    visual: "human",
  },
] as const;
