import type { Dispute, Disposition, Evidence, EvidenceType } from "../lib/domain";

const merchants = ["Northstar Goods", "Juniper Travel", "Harbor Market", "Atlas Digital", "Mosaic Home"];
const reasons: Dispute["reason"][] = ["fraud", "not_received", "duplicate", "not_as_described", "cancelled"];
const evidenceTypes: Record<Dispute["reason"], EvidenceType[]> = {
  fraud: ["device", "customer_history"], not_received: ["delivery"], duplicate: ["receipt"],
  not_as_described: ["communication", "receipt"], cancelled: ["communication", "refund"],
};

function outcome(index: number): { disposition: Disposition; flags: string[] } {
  switch (index % 5) {
    case 0: return { disposition: "challenge", flags: [] };
    case 1: return { disposition: "accept", flags: [] };
    case 2: return { disposition: "request_evidence", flags: ["incomplete_evidence"] };
    case 3: return { disposition: "escalate", flags: ["contradictory_evidence"] };
    default: return { disposition: "escalate", flags: ["high_value"] };
  }
}

export const disputes: Dispute[] = Array.from({ length: 50 }, (_, index) => {
  const number = index + 1;
  const reason = reasons[index % reasons.length];
  const expected = outcome(index);
  const opened = new Date(Date.UTC(2026, 7, 22 - (index % 3), 9));
  return {
    id: `DSP-${String(number).padStart(4, "0")}`,
    merchant: merchants[index % merchants.length],
    amount: index % 5 === 4 ? 2500 + number * 10 : 25 + number * 17,
    currency: "USD",
    reason,
    status: index % 7 === 0 ? "escalated" : "open",
    openedAt: opened.toISOString(),
    dueAt: new Date(opened.getTime() + (24 + (index % 4) * 24) * 3_600_000).toISOString(),
    transactionAt: new Date(opened.getTime() - (2 + index % 12) * 86_400_000).toISOString(),
    cardLast4: String(1000 + number).slice(-4),
    customerTenureMonths: 2 + (index * 7) % 72,
    priorDisputes: index % 9 === 0 ? 3 : index % 3,
    expectedDisposition: expected.disposition,
    expectedRiskFlags: [...expected.flags, ...(index % 9 === 0 ? ["repeat_claimant"] : [])],
  };
});

export const evidence: Evidence[] = disputes.flatMap((dispute, index) => {
  const types = evidenceTypes[dispute.reason];
  const variant = index % 5;
  return types.map((type, evidenceIndex) => ({
    id: `EVD-${String(index + 1).padStart(4, "0")}-${evidenceIndex + 1}`,
    disputeId: dispute.id,
    type,
    label: `${type.replaceAll("_", " ")} record`,
    summary: variant === 3 && evidenceIndex === 1
      ? "Customer account conflicts with the merchant record."
      : variant === 1 ? "Record supports the customer claim." : "Record supports the merchant response.",
    supports: variant === 1 ? "customer" as const : variant === 3 && evidenceIndex === 1 ? "customer" as const : "merchant" as const,
    complete: variant !== 2,
  }));
});

export const benchmarkCases = disputes.map((dispute) => ({
  dispute,
  evidence: evidence.filter((item) => item.disputeId === dispute.id),
  expectedDisposition: dispute.expectedDisposition,
  expectedRiskFlags: dispute.expectedRiskFlags,
}));
