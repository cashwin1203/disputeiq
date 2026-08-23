import { describe, expect, it } from "vitest";
import { benchmarkCases, disputes, evidence } from "../../src/data/disputes";
import type { Decision, Recommendation } from "../../src/lib/domain";
import { evaluateBenchmark } from "../../src/lib/evaluation";
import { calculateMetrics } from "../../src/lib/metrics";
import { recommendDispute } from "../../src/lib/recommender";
import { recommendationSchema, validateDecision } from "../../src/lib/schemas";

describe("synthetic benchmark", () => {
  it("contains 50 deterministic, internally linked cases", () => {
    expect(disputes).toHaveLength(50);
    expect(new Set(disputes.map((item) => item.id)).size).toBe(50);
    expect(evidence.every((item) => disputes.some((dispute) => dispute.id === item.disputeId))).toBe(true);
  });

  it("matches every expected deterministic outcome and risk flag", () => {
    for (const benchmark of benchmarkCases) {
      const result = recommendDispute(benchmark.dispute, benchmark.evidence);
      expect(result.disposition, benchmark.dispute.id).toBe(benchmark.expectedDisposition);
      expect(result.riskFlags.sort(), benchmark.dispute.id).toEqual(benchmark.expectedRiskFlags.sort());
    }
  });

  it("reports reproducible aggregate evaluation results", () => {
    expect(evaluateBenchmark(disputes, evidence)).toEqual({
      totalCases: 50, correctDispositions: 50, dispositionAccuracy: 1, riskFlagRecall: 1,
    });
  });
});

describe("recommendation evidence handling", () => {
  const dispute = disputes[0];

  it("rejects missing evidence rather than returning an uncited recommendation", () => {
    expect(() => recommendDispute(dispute, [])).toThrow("At least one cited evidence item is required");
  });

  it("requests missing required evidence when records are incomplete", () => {
    const incomplete = evidence.filter((item) => item.disputeId === disputes[2].id);
    const result = recommendDispute(disputes[2], incomplete);
    expect(result.disposition).toBe("request_evidence");
    expect(result.missingEvidence).toContain("receipt");
    expect(result.riskFlags).toContain("incomplete_evidence");
  });

  it("escalates contradictory complete evidence", () => {
    const contradictory = evidence.filter((item) => item.disputeId === disputes[3].id);
    const result = recommendDispute(disputes[3], contradictory);
    expect(result.disposition).toBe("escalate");
    expect(result.riskFlags).toContain("contradictory_evidence");
  });

  it("rejects malformed and uncited model responses", () => {
    const candidate = recommendDispute(dispute, evidence.filter((item) => item.disputeId === dispute.id));
    expect(() => recommendationSchema.parse({ ...candidate, disposition: "refund" })).toThrow();
    expect(() => recommendationSchema.parse({ ...candidate, citedEvidenceIds: [] })).toThrow();
  });
});

describe("human decisions and metrics", () => {
  const recommendation = recommendDispute(disputes[0], evidence.filter((item) => item.disputeId === disputes[0].id));
  const baseDecision: Decision = {
    id: "decision-1", disputeId: disputes[0].id, recommendationId: recommendation.id, analystId: "analyst-1",
    disposition: recommendation.disposition, decidedAt: "2026-08-01T09:10:00.000Z", triageStartedAt: "2026-08-01T09:00:00.000Z",
    estimatedLossPrevented: 42,
  };

  it("requires a reason when an analyst overrides the recommendation", () => {
    expect(validateDecision(baseDecision, recommendation.disposition)).toEqual(expect.anything());
    expect(() => validateDecision({ ...baseDecision, disposition: "escalate" }, recommendation.disposition)).toThrow("Override reason is required");
    expect(validateDecision({ ...baseDecision, disposition: "escalate", overrideReason: "Conflicting customer statement" }, recommendation.disposition).overrideReason).toBeTruthy();
  });

  it("calculates operational metrics without dividing by zero", () => {
    const recommendations: Recommendation[] = [recommendation, { ...recommendation, id: "rec-2", latencyMs: 3, estimatedCostUsd: 0.02 }];
    const metrics = calculateMetrics(disputes.slice(0, 2), recommendations, [baseDecision], new Date("2026-08-10T00:00:00.000Z"));
    expect(metrics).toMatchObject({ casesReviewed: 1, averageTriageMinutes: 10, acceptanceRate: 1, overrideRate: 0, estimatedLossPrevented: 42, averageModelLatencyMs: 2, averageCostPerCaseUsd: 0.01 });
    expect(calculateMetrics([], [], [])).toMatchObject({ casesReviewed: 0, acceptanceRate: 0, overrideRate: 0, averageModelLatencyMs: 0 });
  });
});
