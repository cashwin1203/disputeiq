import type { Dispute, Evidence } from "./domain";
import { recommendDispute } from "./recommender";

export interface EvaluationResult {
  totalCases: number;
  correctDispositions: number;
  dispositionAccuracy: number;
  riskFlagRecall: number;
}

export function evaluateBenchmark(disputes: Dispute[], evidence: Evidence[]): EvaluationResult {
  let correctDispositions = 0;
  let expectedFlags = 0;
  let foundFlags = 0;
  for (const dispute of disputes) {
    const result = recommendDispute(dispute, evidence.filter((item) => item.disputeId === dispute.id));
    if (result.disposition === dispute.expectedDisposition) correctDispositions++;
    expectedFlags += dispute.expectedRiskFlags.length;
    foundFlags += dispute.expectedRiskFlags.filter((flag) => result.riskFlags.includes(flag)).length;
  }
  return {
    totalCases: disputes.length,
    correctDispositions,
    dispositionAccuracy: disputes.length ? correctDispositions / disputes.length : 0,
    riskFlagRecall: expectedFlags ? foundFlags / expectedFlags : 1,
  };
}
