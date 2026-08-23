-- Public demo data has owner_id = null and is read-only under RLS.
-- Run with `supabase db reset`; production demo data should be loaded by an admin.
insert into public.disputes (id, external_id, amount_cents, reason, sla_due_at, transaction_context)
values ('00000000-0000-4000-8000-000000000001', 'DEMO-001', 12999, 'not_received', now() + interval '8 hours', '{"merchant":"Northstar Supply","card_last4":"4242"}');

insert into public.evidence (id, dispute_id, kind, summary)
values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'delivery', 'Carrier has no delivery scan.');

insert into public.recommendations (dispute_id, disposition, confidence, rationale, cited_evidence_ids, missing_evidence, risk_flags, mode, latency_ms)
values ('00000000-0000-4000-8000-000000000001', 'request_evidence', .82, 'No delivery scan supports requesting merchant evidence.', array['10000000-0000-4000-8000-000000000001'::uuid], array['proof_of_delivery'], array['sla_risk'], 'demo', 4);

