import { describe, expect, it } from "vitest";
import type { MatchResult } from "../src/data/types.js";
import { mergeLlmMatches } from "../src/engine/reconcile.js";

function match(
  partial: Partial<MatchResult> &
    Pick<MatchResult, "bankCreditId" | "settlementId">,
): MatchResult {
  return {
    confidence: 1,
    matchedBy: "exact",
    reasoning: "test",
    ...partial,
  };
}

describe("mergeLlmMatches", () => {
  it("rejects an LLM match whose component was already claimed", () => {
    const prior = [
      match({
        bankCreditId: "bank_A",
        settlementId: "setl_1",
        matchedBy: "split",
        components: ["setl_1", "setl_2"],
      }),
    ];
    const llm = [
      match({
        bankCreditId: "bank_B",
        settlementId: "setl_2",
        matchedBy: "llm",
        components: ["setl_2", "setl_3"],
        reasoning: "LLM verdict: match (split)",
      }),
    ];

    const { accepted, exceptions } = mergeLlmMatches(prior, llm);

    expect(accepted).toHaveLength(0);
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]?.recordId).toBe("bank_B");
    expect(exceptions[0]?.source).toBe("bank");
    expect(exceptions[0]?.reason).toMatch(/already-claimed settlement/i);
    expect(exceptions[0]?.relatedIds).toContain("setl_2");
  });

  it("keeps order-stable first-claim wins among LLM matches", () => {
    const prior: MatchResult[] = [];
    const llm = [
      match({
        bankCreditId: "bank_1",
        settlementId: "setl_a",
        matchedBy: "llm",
        components: ["setl_a", "setl_b"],
      }),
      match({
        bankCreditId: "bank_2",
        settlementId: "setl_b",
        matchedBy: "llm",
        components: ["setl_b", "setl_c"],
      }),
    ];

    const { accepted, exceptions } = mergeLlmMatches(prior, llm);

    expect(accepted).toHaveLength(1);
    expect(accepted[0]?.bankCreditId).toBe("bank_1");
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]?.recordId).toBe("bank_2");
  });

  it("accepts an LLM match when settlements are free", () => {
    const prior = [match({ bankCreditId: "bank_A", settlementId: "setl_1" })];
    const llm = [
      match({
        bankCreditId: "bank_B",
        settlementId: "setl_9",
        matchedBy: "llm",
      }),
    ];

    const { accepted, exceptions } = mergeLlmMatches(prior, llm);
    expect(accepted).toHaveLength(1);
    expect(exceptions).toHaveLength(0);
  });
});
