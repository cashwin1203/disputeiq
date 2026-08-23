import { NextResponse } from "next/server";
import { evidence } from "@/data/disputes";
import { recommendDispute } from "@/lib/recommender";
import { recommendationRequestSchema, recommendationSchema } from "@/lib/schemas";

const MODEL = "gemini-3.6-flash";

export async function POST(request: Request) {
  const parsed = recommendationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid dispute or evidence request." }, { status: 400 });
  const { dispute, evidenceIds } = parsed.data;
  const caseEvidence = evidence.filter((item) => item.disputeId === dispute.id && evidenceIds.includes(item.id));
  if (!caseEvidence.length || caseEvidence.length !== new Set(evidenceIds).size) return NextResponse.json({ error: "Every evidence ID must belong to this dispute." }, { status: 400 });
  const fallback = recommendDispute(dispute, caseEvidence);
  const key = request.headers.get("x-gemini-key");
  if (!key) return NextResponse.json(fallback);

  const started = performance.now();
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        system_instruction: { parts: [{ text: "You support a payment dispute analyst. Return only valid JSON. Never invent evidence. The analyst makes the final decision." }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify({ task: "Recommend one disposition: accept, challenge, request_evidence, or escalate. Cite at least one provided evidence ID.", dispute, evidence: caseEvidence }) }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", required: ["disposition", "confidence", "rationale", "citedEvidenceIds", "missingEvidence", "riskFlags"], properties: { disposition: { type: "STRING", enum: ["accept", "challenge", "request_evidence", "escalate"] }, confidence: { type: "NUMBER", minimum: 0, maximum: 1 }, rationale: { type: "STRING" }, citedEvidenceIds: { type: "ARRAY", items: { type: "STRING" } }, missingEvidence: { type: "ARRAY", items: { type: "STRING" } }, riskFlags: { type: "ARRAY", items: { type: "STRING" } } } } },
      }),
    });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") throw new Error("Provider returned no recommendation");
    const output = JSON.parse(text);
    if (!output.citedEvidenceIds?.every((id: string) => evidenceIds.includes(id))) throw new Error("Provider cited evidence outside the case");
    return NextResponse.json(recommendationSchema.parse({ ...output, id: crypto.randomUUID(), disputeId: dispute.id, model: "gemini", latencyMs: Math.round(performance.now() - started), estimatedCostUsd: 0.0001, createdAt: new Date().toISOString() }));
  } catch {
    return NextResponse.json({ ...fallback, riskFlags: [...fallback.riskFlags, "model_fallback"], latencyMs: Math.round(performance.now() - started), createdAt: new Date().toISOString() }, { headers: { "x-disputeiq-fallback": "deterministic" } });
  }
}
