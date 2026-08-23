import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/recommendations/route";
import { disputes, evidence } from "@/data/disputes";

const dispute = disputes[0];
const evidenceIds = evidence.filter((item) => item.disputeId === dispute.id).map((item) => item.id);
const request = (body: unknown, key?: string) => new Request("http://localhost/api/recommendations", { method: "POST", headers: { "content-type": "application/json", ...(key ? { "x-gemini-key": key } : {}) }, body: JSON.stringify(body) });

afterEach(() => vi.unstubAllGlobals());

describe("recommendations API", () => {
  it("returns a validated deterministic result without a key", async () => {
    const response = await POST(request({ dispute, evidenceIds }));
    expect(response.status).toBe(200);
    expect((await response.json()).model).toBe("deterministic");
  });

  it("rejects evidence from another dispute", async () => {
    const foreign = evidence.find((item) => item.disputeId !== dispute.id)!;
    const response = await POST(request({ dispute, evidenceIds: [foreign.id] }));
    expect(response.status).toBe(400);
  });

  it("accepts cited structured Gemini output", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ disposition: "challenge", confidence: .84, rationale: "Complete merchant evidence supports a challenge.", citedEvidenceIds: [evidenceIds[0]], missingEvidence: [], riskFlags: [] }) }] } }] }), { status: 200 })));
    const response = await POST(request({ dispute, evidenceIds }, "session-key"));
    expect((await response.json()).model).toBe("gemini");
  });

  it.each(["timeout", "rate limit", "unsafe output", "invalid JSON", "low confidence"])("falls back safely for %s", async (scenario) => {
    const fetchMock = scenario === "timeout" ? vi.fn().mockRejectedValue(new Error("timeout"))
      : scenario === "rate limit" ? vi.fn().mockResolvedValue(new Response("limited", { status: 429 }))
      : scenario === "invalid JSON" ? vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }), { status: 200 }))
      : scenario === "unsafe output" ? vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ disposition: "challenge", confidence: .8, rationale: "Invented.", citedEvidenceIds: ["unknown"], missingEvidence: [], riskFlags: [] }) }] } }] }), { status: 200 }))
      : vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ disposition: "challenge", confidence: -1, rationale: "Invalid confidence.", citedEvidenceIds: [evidenceIds[0]], missingEvidence: [], riskFlags: [] }) }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request({ dispute, evidenceIds }, "session-key"));
    const payload = await response.json();
    expect(payload.model).toBe("deterministic");
    expect(payload.riskFlags).toContain("model_fallback");
  });
});
