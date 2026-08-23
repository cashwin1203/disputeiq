import type { Decision, Dispute, OperationsMetrics, Recommendation } from "./domain";

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function calculateMetrics(disputes: Dispute[], recommendations: Recommendation[], decisions: Decision[], now = new Date()): OperationsMetrics {
  const recommendedById = new Map(recommendations.map((item) => [item.id, item]));
  const triageMinutes = decisions.flatMap((item) => item.triageStartedAt ? [(Date.parse(item.decidedAt) - Date.parse(item.triageStartedAt)) / 60_000] : []);
  const matched = decisions.filter((item) => recommendedById.has(item.recommendationId));
  const accepted = matched.filter((item) => recommendedById.get(item.recommendationId)?.disposition === item.disposition).length;
  return {
    casesReviewed: decisions.length,
    averageTriageMinutes: average(triageMinutes),
    acceptanceRate: matched.length ? accepted / matched.length : 0,
    overrideRate: matched.length ? (matched.length - accepted) / matched.length : 0,
    slaBreaches: disputes.filter((item) => item.status === "open" && Date.parse(item.dueAt) < now.getTime()).length,
    estimatedLossPrevented: decisions.reduce((sum, item) => sum + (item.estimatedLossPrevented ?? 0), 0),
    averageModelLatencyMs: average(recommendations.map((item) => item.latencyMs)),
    averageCostPerCaseUsd: average(recommendations.map((item) => item.estimatedCostUsd)),
  };
}
