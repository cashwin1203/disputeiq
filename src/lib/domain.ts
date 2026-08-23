export const dispositions = ["accept", "challenge", "request_evidence", "escalate"] as const;
export type Disposition = (typeof dispositions)[number];

export const disputeReasons = ["fraud", "not_received", "duplicate", "not_as_described", "cancelled"] as const;
export type DisputeReason = (typeof disputeReasons)[number];

export type EvidenceType = "receipt" | "delivery" | "customer_history" | "device" | "communication" | "refund";

export interface Dispute {
  id: string;
  merchant: string;
  amount: number;
  currency: "USD";
  reason: DisputeReason;
  status: "open" | "reviewed" | "escalated";
  openedAt: string;
  dueAt: string;
  transactionAt: string;
  cardLast4: string;
  customerTenureMonths: number;
  priorDisputes: number;
  expectedDisposition: Disposition;
  expectedRiskFlags: string[];
}

export interface Evidence {
  id: string;
  disputeId: string;
  type: EvidenceType;
  label: string;
  summary: string;
  supports: "merchant" | "customer" | "neutral";
  complete: boolean;
}

export interface Recommendation {
  id: string;
  disputeId: string;
  disposition: Disposition;
  confidence: number;
  rationale: string;
  citedEvidenceIds: string[];
  missingEvidence: string[];
  riskFlags: string[];
  model: "deterministic" | "gemini";
  latencyMs: number;
  estimatedCostUsd: number;
  createdAt: string;
}

export interface Decision {
  id: string;
  disputeId: string;
  recommendationId: string;
  analystId: string;
  disposition: Disposition;
  overrideReason?: string;
  decidedAt: string;
  triageStartedAt?: string;
  estimatedLossPrevented?: number;
}

export interface FilterState {
  slaRisk: "all" | "at_risk" | "on_track";
  amountMin: number | null;
  amountMax: number | null;
  reason: DisputeReason | "all";
  confidence: "all" | "low" | "medium" | "high";
  escalationStatus: "all" | "escalated" | "not_escalated";
}

export interface OperationsMetrics {
  casesReviewed: number;
  averageTriageMinutes: number;
  acceptanceRate: number;
  overrideRate: number;
  slaBreaches: number;
  estimatedLossPrevented: number;
  averageModelLatencyMs: number;
  averageCostPerCaseUsd: number;
}
