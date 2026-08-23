# DisputeIQ product case study

## Executive summary

DisputeIQ asks whether AI can reduce payment-dispute triage effort without hiding evidence or removing analyst control. The MVP pairs a deterministic baseline with optional Gemini recommendations. Both produce the same structured, cited output. Analysts make the final decision, overrides require a reason, and actions appear in an append-only audit timeline.

All data, benchmark cases, and metrics are synthetic. They demonstrate an evaluation method, not commercial performance.

## Persona and job to be done

**Primary persona:** A dispute analyst responsible for reviewing a daily queue under service-level deadlines.

**Job to be done:** When a dispute arrives, help me identify urgency, understand the evidence, and record a defensible action quickly so I can protect customers and limit avoidable loss.

The analyst needs explainable prioritization, unified evidence, cited recommendations, fast human override, and a durable review record.

## Journey and opportunity

| Stage | Friction | Product response |
| --- | --- | --- |
| Prioritize | Deadlines, value, and risk compete | Filters and visible SLA status |
| Investigate | Evidence is fragmented or incomplete | Case context with evidence inventory |
| Decide | Policy interpretation can vary | Recommendation with rationale and confidence |
| Challenge | Model output can be unsupported | Required citations, validation, and fallback |
| Record | Decisions need later explanation | Override reason and audit timeline |
| Improve | Quality lacks a repeatable baseline | Synthetic benchmark and evaluation runs |

## Discovery assumptions

These require validation with analysts before production use:

1. Evidence gathering and interpretation consume more time than data entry.
2. SLA risk and missing evidence are stronger triage signals than confidence alone.
3. Visible rationale and citations improve appropriate recommendation use.
4. Required override reasons create useful feedback without unacceptable handling time.
5. A deterministic baseline helps demos, outages, regression testing, and policy transparency.
6. Leaders need quality, adoption, latency, and cost together to judge an AI workflow.

No user research or customer validation is claimed in this portfolio build.

## Prioritization

| Capability | Why now |
| --- | --- |
| Seeded queue and filters | Testable without integrations |
| Unified evidence review | Covers the central analyst task |
| Cited recommendation | Tests the AI value proposition |
| Confirmation and override | Preserves accountability |
| Audit timeline | Makes the workflow inspectable |
| Synthetic evaluation | Creates a repeatable quality baseline |
| Operations dashboard | Connects model and product outcomes |
| GitHub auth and RLS | Demonstrates workspace isolation |

Payment integrations, automatic resolution, policy builders, queues, streaming, microservices, and paid monitoring are deferred until the core workflow is validated.

## AI versus rules

Rules own predictable behavior: demo recommendations, allowed dispositions, required fields, citation checks, override validation, metric calculations, SLA labels, and fallback behavior.

AI is optional for summarizing context, weighing evidence, explaining a recommendation, and identifying missing evidence or risk flags.

The model never owns authorization, data isolation, schema validation, audit persistence, or the final decision. Low-confidence, malformed, unsupported, unsafe, timed-out, or rate-limited output falls back to deterministic behavior or analyst review.

## Governance

- Every disposition is confirmed by an analyst. Overrides require a reason.
- Recommendations must cite case evidence. Uncited output is rejected.
- The portfolio uses synthetic data only.
- An optional Gemini key stays in browser session memory and is not persisted or logged.
- Public exploration is read-only. Supabase row-level security isolates authenticated records.
- Actions append to an audit timeline rather than rewriting history.
- Deterministic mode remains available when an external model fails.
- Evaluation and dashboard results are labeled synthetic and simulated.

Production use would require legal and security review, retention policy, versioning, incident response, adversarial testing, accessibility validation, and monitoring based on real service objectives.

## Synthetic evaluation and launch metrics

The benchmark contains 50 generated cases with expected dispositions and risk flags. It makes evaluation reproducible but does not represent a real dispute distribution.

| Metric | Definition |
| --- | --- |
| Disposition agreement | Share matching the synthetic expected outcome |
| Risk-flag recall | Share of expected risk flags detected |
| Unsupported citation rate | Recommendations citing unavailable evidence |
| Analyst acceptance rate | Confirmed recommendations divided by reviewed cases |
| Override rate | Overrides divided by reviewed cases |
| Median triage time | Time from review start to decision |
| SLA breach rate | Cases decided after the synthetic deadline |
| Estimated loss prevented | Simulated protected amount from eligible outcomes |
| Model latency | Request duration for live recommendations |
| Estimated cost per case | Token-based synthetic cost estimate |

No displayed value should be described as observed customer impact. A responsible pilot would establish a baseline, run shadow evaluation, define quality and harm thresholds, and compare assisted with unassisted cohorts.

## Roadmap

### Now

- Complete the queue-to-decision workflow and deterministic fallback
- Ship 50 synthetic benchmark cases
- Verify row-level security and audit behavior
- Publish the demo, screenshots, and walkthrough

### Next

- Conduct five analyst interviews and two workflow observations
- Instrument recommendation views, acceptance, overrides, and time-to-decision
- Review override themes and benchmark failure clusters
- Add policy versioning only if multiple policies are actually needed

### Later

- Connect a sandbox payment provider and controlled evidence sources
- Add organization roles, retention controls, and audit exports
- Add queues or service separation only when measured volume requires them
- Consider automated low-risk actions only after governance approval and a successful shadow period

## Success criteria

The MVP succeeds when a reviewer can complete the workflow without credentials, understand each recommendation, see how failures preserve analyst control, inspect synthetic evaluation results, and verify that the project makes no real financial-outcome claims.
