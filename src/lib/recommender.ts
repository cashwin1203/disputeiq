import type { Dispute, Evidence, Recommendation } from "./domain";
import { recommendationSchema } from "./schemas";

const requiredByReason: Record<Dispute["reason"], Evidence["type"][]> = {
  fraud: ["device", "customer_history"], not_received: ["delivery"], duplicate: ["receipt"],
  not_as_described: ["communication", "receipt"], cancelled: ["communication", "refund"],
};

export function recommendDispute(dispute: Dispute, caseEvidence: Evidence[]): Recommendation {
  const relevant = caseEvidence.filter((item) => item.disputeId === dispute.id);
  if (!relevant.length) throw new Error("At least one cited evidence item is required");
  const complete = relevant.filter((item) => item.complete);
  const missingEvidence = requiredByReason[dispute.reason]
    .filter((type) => !complete.some((item) => item.type === type))
    .map((type) => type.replaceAll("_", " "));
  const merchant = complete.filter((item) => item.supports === "merchant");
  const customer = complete.filter((item) => item.supports === "customer");
  const contradictory = merchant.length > 0 && customer.length > 0;
  const riskFlags = [
    ...(contradictory ? ["contradictory_evidence"] : []),
    ...(dispute.amount >= 1000 ? ["high_value"] : []),
    ...(dispute.priorDisputes >= 3 ? ["repeat_claimant"] : []),
    ...(missingEvidence.length ? ["incomplete_evidence"] : []),
  ];

  let disposition: Recommendation["disposition"] = "request_evidence";
  let confidence = 0.58;
  if (contradictory || dispute.amount >= 2500) { disposition = "escalate"; confidence = contradictory ? 0.72 : 0.68; }
  else if (!missingEvidence.length && merchant.length > customer.length) { disposition = "challenge"; confidence = 0.88; }
  else if (!missingEvidence.length && customer.length > merchant.length) { disposition = "accept"; confidence = 0.9; }

  return recommendationSchema.parse({
    id: `rec-${dispute.id}`, disputeId: dispute.id, disposition, confidence,
    rationale: disposition === "request_evidence" ? `Request ${missingEvidence.join(" and ")} before deciding.`
      : disposition === "escalate" ? "Manual review is required because the case has conflicting or high-risk signals."
      : disposition === "challenge" ? "Complete evidence supports the merchant response."
      : "Complete evidence supports the customer claim.",
    citedEvidenceIds: relevant.map((item) => item.id), missingEvidence, riskFlags,
    model: "deterministic", latencyMs: 1, estimatedCostUsd: 0, createdAt: dispute.openedAt,
  });
}
