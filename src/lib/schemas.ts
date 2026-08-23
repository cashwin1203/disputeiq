import { z } from "zod";
import { dispositions, disputeReasons } from "./domain";

export const evidenceSchema = z.object({
  id: z.string().min(1),
  disputeId: z.string().min(1),
  type: z.enum(["receipt", "delivery", "customer_history", "device", "communication", "refund"]),
  label: z.string().min(1),
  summary: z.string().min(1),
  supports: z.enum(["merchant", "customer", "neutral"]),
  complete: z.boolean(),
});

export const disputeSchema = z.object({
  id: z.string().min(1), merchant: z.string().min(1), amount: z.number().positive(), currency: z.literal("USD"),
  reason: z.enum(disputeReasons), status: z.enum(["open", "reviewed", "escalated"]),
  openedAt: z.iso.datetime(), dueAt: z.iso.datetime(), transactionAt: z.iso.datetime(), cardLast4: z.string().regex(/^\d{4}$/),
  customerTenureMonths: z.number().int().nonnegative(), priorDisputes: z.number().int().nonnegative(),
  expectedDisposition: z.enum(dispositions), expectedRiskFlags: z.array(z.string()),
});

export const recommendationSchema = z.object({
  id: z.string().min(1), disputeId: z.string().min(1), disposition: z.enum(dispositions), confidence: z.number().min(0).max(1),
  rationale: z.string().min(1), citedEvidenceIds: z.array(z.string()).min(1), missingEvidence: z.array(z.string()), riskFlags: z.array(z.string()),
  model: z.enum(["deterministic", "gemini"]), latencyMs: z.number().nonnegative(), estimatedCostUsd: z.number().nonnegative(), createdAt: z.iso.datetime(),
}).superRefine((value, context) => {
  if (new Set(value.citedEvidenceIds).size !== value.citedEvidenceIds.length) context.addIssue({ code: "custom", path: ["citedEvidenceIds"], message: "Evidence citations must be unique" });
});

export const decisionSchema = z.object({
  id: z.string().min(1), disputeId: z.string().min(1), recommendationId: z.string().min(1), analystId: z.string().min(1),
  disposition: z.enum(dispositions), overrideReason: z.string().trim().min(3).optional(), decidedAt: z.iso.datetime(),
  triageStartedAt: z.iso.datetime().optional(), estimatedLossPrevented: z.number().nonnegative().optional(),
});

export const recommendationRequestSchema = z.object({ dispute: disputeSchema, evidenceIds: z.array(z.string()).min(1) });

export function validateDecision(decision: unknown, recommendedDisposition: string) {
  const parsed = decisionSchema.parse(decision);
  if (parsed.disposition !== recommendedDisposition && !parsed.overrideReason) throw new Error("Override reason is required");
  return parsed;
}
