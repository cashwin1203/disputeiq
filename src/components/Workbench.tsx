"use client";

import { useMemo, useState } from "react";
import { Button, NumberInput, Select, SelectItem, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag, TextArea, TextInput } from "@carbon/react";
import { ChartLineUp, GithubLogo, Key, ShieldCheck } from "@phosphor-icons/react";
import { disputes, evidence } from "@/data/disputes";
import { calculateMetrics } from "@/lib/metrics";
import { recommendDispute } from "@/lib/recommender";
import type { Decision, Disposition, Recommendation } from "@/lib/domain";
import { signInWithGitHub } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

const dispositions: Disposition[] = ["accept", "challenge", "request_evidence", "escalate"];
const label = (value: string) => value.replaceAll("_", " ");
const money = (amount: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
const demoNow = new Date("2026-08-22T12:00:00.000Z");
const hoursLeft = (dueAt: string) => Math.round((new Date(dueAt).getTime() - demoNow.getTime()) / 3_600_000);

export function Workbench() {
  const [view, setView] = useState<"queue" | "case-study">("queue");
  const [selectedId, setSelectedId] = useState(disputes[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("all");
  const [sla, setSla] = useState("all");
  const [escalation, setEscalation] = useState("all");
  const [minAmount, setMinAmount] = useState(0);
  const [minConfidence, setMinConfidence] = useState(0);
  const [recommendations, setRecommendations] = useState<Recommendation[]>(() => disputes.map((d) => recommendDispute(d, evidence.filter((e) => e.disputeId === d.id))));
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [choice, setChoice] = useState<Disposition>("accept");
  const [overrideReason, setOverrideReason] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const authEnabled = Boolean(supabaseConfig());
  const selected = disputes.find((item) => item.id === selectedId) ?? disputes[0];
  const selectedEvidence = evidence.filter((item) => item.disputeId === selected?.id);
  const recommendation = recommendations.find((item) => item.disputeId === selected?.id);
  const metrics = calculateMetrics(disputes, recommendations, decisions, demoNow);
  const totalCost = metrics.averageCostPerCaseUsd * recommendations.length;
  const filtered = useMemo(() => disputes.filter((item) => {
    const rec = recommendations.find((entry) => entry.disputeId === item.id);
    const left = hoursLeft(item.dueAt);
    return (query === "" || item.merchant.toLowerCase().includes(query.toLowerCase()) || item.id.toLowerCase().includes(query.toLowerCase()))
      && (reason === "all" || item.reason === reason)
      && (sla === "all" || (sla === "critical" ? left <= 12 : sla === "at-risk" ? left > 12 && left <= 48 : left > 48))
      && (escalation === "all" || (escalation === "escalated" ? item.status === "escalated" : item.status !== "escalated"))
      && item.amount >= minAmount && (rec?.confidence ?? 0) >= minConfidence / 100;
  }), [query, reason, sla, escalation, minAmount, minConfidence, recommendations]);

  const selectCase = (id: string, disposition: Disposition = "escalate") => { setSelectedId(id); setChoice(disposition); setMessage(""); };
  const generate = async () => {
    if (!selected) return;
    setGenerating(true); setMessage("");
    try {
      const response = await fetch("/api/recommendations", { method: "POST", headers: { "content-type": "application/json", ...(apiKey ? { "x-gemini-key": apiKey } : {}) }, body: JSON.stringify({ dispute: selected, evidenceIds: selectedEvidence.map((item) => item.id), mode: apiKey ? "gemini" : "demo" }) });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error ?? "Recommendation failed");
      setRecommendations((current) => [...current.filter((item) => item.disputeId !== selected.id), next]);
      setChoice(next.disposition); setMessage(`${apiKey ? "Gemini" : "Demo"} recommendation generated and validated.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Recommendation failed"); }
    finally { setGenerating(false); }
  };
  const decide = () => {
    if (!selected || !recommendation) return;
    const overridden = choice !== recommendation.disposition;
    if (overridden && !overrideReason.trim()) { setMessage("Explain why you are overriding the recommendation."); return; }
    const decision: Decision = { id: crypto.randomUUID(), disputeId: selected.id, recommendationId: recommendation.id, analystId: "demo-analyst", disposition: choice, overrideReason: overridden ? overrideReason.trim() : undefined, decidedAt: new Date().toISOString() };
    setDecisions((current) => [...current.filter((item) => item.disputeId !== selected.id), decision]);
    setMessage(`Decision recorded: ${label(choice)}. Audit event appended.`); setOverrideReason("");
  };
  if (!selected) return <main className="empty">No synthetic cases are available.</main>;

  return <div className="shell"><a className="skip-link" href="#main">Skip to main content</a>
    <header className="topbar"><div className="brand">DisputeIQ <small>Human-led payment operations</small></div><div className="topbar-actions"><span className="demo-label">Synthetic demo data</span><span className="desktop-only">No financial data stored</span>{authEnabled && <button className="auth-button" onClick={() => void signInWithGitHub()}>Sign in with GitHub</button>}</div></header>
    <div className="layout"><aside className="sidebar" aria-label="Primary navigation"><div><h2>Workspace</h2><button className="nav-button" aria-current={view === "queue" ? "page" : undefined} onClick={() => setView("queue")}>Dispute queue</button><button className="nav-button" aria-current={view === "case-study" ? "page" : undefined} onClick={() => setView("case-study")}>Product case study</button></div><p className="sidebar-note"><ShieldCheck size={18} aria-hidden="true" /> Every AI output must cite case evidence. Analysts retain the final decision.</p></aside>
      <main className="main" id="main">{view === "case-study" ? <CaseStudy onBack={() => setView("queue")} /> : <>
        <div className="page-head"><div><h1>Disputes need judgment.</h1><p>Prioritize the queue, inspect cited evidence, and make the final call. All figures are simulated.</p></div><Button kind="tertiary" renderIcon={GithubLogo} href="https://github.com/cashwin1203/disputeiq" target="_blank" rel="noopener noreferrer">View source</Button></div>
        <div className="workspace"><div className="metric-grid" aria-label="Simulated operations metrics"><Metric label="Cases reviewed" value={`${metrics.casesReviewed}`} note="Synthetic session" /><Metric label="Recommendation acceptance" value={`${Math.round(metrics.acceptanceRate * 100)}%`} note="Analyst decisions" /><Metric label="SLA breaches" value={`${metrics.slaBreaches}`} note="Current queue" /><Metric label="Estimated loss prevented" value={money(metrics.estimatedLossPrevented)} note="Simulation only" /><Metric label="Average model latency" value={`${Math.round(metrics.averageModelLatencyMs)} ms`} note={`Est. ${money(totalCost)} cost`} /></div>
          <div className="filters" aria-label="Queue filters"><TextInput id="search" labelText="Search cases" placeholder="Merchant or case ID" value={query} onChange={(event) => setQuery(event.target.value)} /><Select id="reason" labelText="Reason" value={reason} onChange={(event) => setReason(event.target.value)}><SelectItem value="all" text="All reasons" />{[...new Set(disputes.map((d) => d.reason))].map((item) => <SelectItem key={item} value={item} text={label(item)} />)}</Select><Select id="sla" labelText="SLA risk" value={sla} onChange={(event) => setSla(event.target.value)}><SelectItem value="all" text="All windows" /><SelectItem value="critical" text="12 hours or less" /><SelectItem value="at-risk" text="13 to 48 hours" /><SelectItem value="healthy" text="More than 48 hours" /></Select><Select id="escalation" labelText="Escalation" value={escalation} onChange={(event) => setEscalation(event.target.value)}><SelectItem value="all" text="All cases" /><SelectItem value="escalated" text="Escalated" /><SelectItem value="standard" text="Not escalated" /></Select><NumberInput id="amount" label="Minimum amount" min={0} value={minAmount} onChange={(_, state) => setMinAmount(Number(state.value || 0))} /><NumberInput id="confidence" label="Minimum confidence %" min={0} max={100} value={minConfidence} onChange={(_, state) => setMinConfidence(Number(state.value || 0))} /></div>
          <div className="content-grid"><section className="queue" aria-labelledby="queue-title"><div className="queue-header"><h2 id="queue-title">Open cases</h2><span className="subtext">{filtered.length} of {disputes.length}</span></div><div className="table-wrap"><Table size="sm"><TableHead><TableRow><TableHeader>Case</TableHeader><TableHeader>Amount</TableHeader><TableHeader>Reason</TableHeader><TableHeader>SLA</TableHeader><TableHeader>AI confidence</TableHeader></TableRow></TableHead><TableBody>{filtered.map((item) => { const rec = recommendations.find((entry) => entry.disputeId === item.id); const left = hoursLeft(item.dueAt); return <TableRow key={item.id} className="case-row" data-selected={item.id === selected.id} tabIndex={0} onClick={() => selectCase(item.id, rec?.disposition)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectCase(item.id, rec?.disposition); } }}><TableCell><span className="merchant">{item.merchant}</span><span className="subtext mono">{item.id}</span></TableCell><TableCell className="money">{money(item.amount, item.currency)}</TableCell><TableCell>{label(item.reason)}</TableCell><TableCell><Tag size="sm" type={left <= 12 ? "red" : left <= 48 ? "magenta" : "gray"}>{left <= 0 ? "Breached" : `${left}h`}</Tag></TableCell><TableCell className="mono">{Math.round((rec?.confidence ?? 0) * 100)}%</TableCell></TableRow>; })}</TableBody></Table>{filtered.length === 0 && <div className="empty">No cases match these filters.</div>}</div></section>
            <aside className="detail" aria-labelledby="case-title"><section><div className="detail-top"><div><h2 id="case-title">{selected.merchant}</h2><p className="mono">{selected.id}</p></div><Tag type="blue">{label(selected.status)}</Tag></div><dl className="facts"><Fact label="Disputed amount" value={money(selected.amount, selected.currency)} /><Fact label="Card" value={`Ending ${selected.cardLast4}`} /><Fact label="Customer tenure" value={`${selected.customerTenureMonths} months`} /><Fact label="Prior disputes" value={`${selected.priorDisputes}`} /></dl></section>
              <section><h2>Evidence</h2><ul className="evidence-list">{selectedEvidence.map((item) => <li className="evidence-item" key={item.id}><div className="evidence-title"><span>{item.label}</span><Tag size="sm" type={item.complete ? "green" : "warm-gray"}>{item.complete ? "Complete" : "Missing detail"}</Tag></div><p>{item.summary}</p></li>)}</ul></section>
              {recommendation && <section className="recommendation"><div className="recommendation-head"><div><span className="subtext">Validated recommendation</span><h3>{label(recommendation.disposition)}</h3></div><strong className="mono">{Math.round(recommendation.confidence * 100)}%</strong></div><p>{recommendation.rationale}</p><strong className="subtext">Evidence cited</strong><ul className="cite-list">{recommendation.citedEvidenceIds.map((id) => <li key={id}>{selectedEvidence.find((item) => item.id === id)?.label ?? id}</li>)}</ul></section>}
              <section className="decision-grid"><h2>Analyst decision</h2><Select id="decision" labelText="Final disposition" value={choice} onChange={(event) => setChoice(event.target.value as Disposition)}>{dispositions.map((item) => <SelectItem key={item} value={item} text={label(item)} />)}</Select>{recommendation && choice !== recommendation.disposition && <TextArea id="override" labelText="Override reason" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Explain the evidence or policy reason" rows={3} />}<TextInput id="gemini-key" type="password" labelText="Optional Gemini API key" helperText="Held in this browser session only. Leave blank for deterministic demo mode." value={apiKey} onChange={(event) => setApiKey(event.target.value)} /><div className="decision-actions"><Button kind="secondary" renderIcon={Key} disabled={generating} onClick={generate}>{generating ? "Validating..." : "Generate recommendation"}</Button><Button onClick={decide} disabled={!recommendation}>Record decision</Button></div><div className="status-message" aria-live="polite">{message}</div></section>
              <section><h2>Audit timeline</h2><ul className="timeline"><li>Case opened from synthetic network feed<time>{new Date(selected.openedAt).toLocaleString()}</time></li><li>Evidence bundle normalized<time>{new Date(selected.openedAt).toLocaleString()}</time></li>{recommendation && <li>Recommendation generated with {recommendation.citedEvidenceIds.length} citations<time>{new Date(recommendation.createdAt).toLocaleString()}</time></li>}{decisions.filter((item) => item.disputeId === selected.id).map((item) => <li key={item.id}>Analyst recorded {label(item.disposition)}{item.overrideReason ? `: ${item.overrideReason}` : ""}<time>{new Date(item.decidedAt).toLocaleString()}</time></li>)}</ul></section>
            </aside></div></div></>}
      </main></div></div>;
}

function Metric({ label: name, value, note }: { label: string; value: string; note: string }) { return <div className="metric"><span className="metric-label">{name}</span><strong className="metric-value">{value}</strong><span className="metric-note">{note}</span></div>; }
function Fact({ label: name, value }: { label: string; value: string }) { return <div className="fact"><dt>{name}</dt><dd>{value}</dd></div>; }
function CaseStudy({ onBack }: { onBack: () => void }) { return <article className="case-study"><Button kind="ghost" onClick={onBack}>Back to queue</Button><h1>Designing AI for accountable decisions</h1><p>DisputeIQ explores a narrow question: where can AI reduce analyst effort without taking authority away from the analyst?</p><div className="study-grid"><div><h2>The product choice</h2><p>The model organizes evidence and recommends a disposition. It cannot finalize a case. Every recommendation must cite available evidence, and every override needs a reason.</p></div><div><h3>Success signals</h3><ul><li>Lower median triage time</li><li>Stable override quality</li><li>Fewer SLA breaches</li><li>Bounded latency and cost</li></ul></div></div><h2>What this demo proves</h2><p>Fifty synthetic cases create a repeatable benchmark for recommendation accuracy, missing-evidence behavior, latency, and estimated cost. The dashboard labels every figure as simulated because portfolio evidence should be honest.</p><h2>What comes next</h2><p>A production pilot would add policy versioning, reviewer calibration, red-team cases, provider-level monitoring, and customer-specific retention controls. Those are documented scale paths, not features hidden behind a demo.</p><Button renderIcon={ChartLineUp} href="https://github.com/cashwin1203/disputeiq/blob/main/docs/CASE_STUDY.md" target="_blank" rel="noopener noreferrer">Read the full case study</Button></article>; }
