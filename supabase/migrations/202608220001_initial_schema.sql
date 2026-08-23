create extension if not exists pgcrypto;

create type public.disposition as enum ('accept', 'challenge', 'request_evidence', 'escalate');
create type public.dispute_reason as enum ('fraud', 'duplicate', 'not_received', 'not_as_described', 'subscription', 'other');

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  external_id text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  reason public.dispute_reason not null,
  status text not null default 'open' check (status in ('open', 'decided', 'escalated')),
  sla_due_at timestamptz not null,
  transaction_context jsonb not null default '{}'::jsonb check (jsonb_typeof(transaction_context) = 'object'),
  created_at timestamptz not null default now(),
  unique nulls not distinct (owner_id, external_id)
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  kind text not null,
  summary text not null check (length(trim(summary)) > 0),
  source_uri text,
  contradicts boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  disposition public.disposition not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  rationale text not null check (length(trim(rationale)) > 0),
  cited_evidence_ids uuid[] not null check (cardinality(cited_evidence_ids) > 0),
  missing_evidence text[] not null default '{}',
  risk_flags text[] not null default '{}',
  mode text not null check (mode in ('demo', 'gemini')),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  estimated_cost_usd numeric(10,6) not null default 0 check (estimated_cost_usd >= 0),
  created_at timestamptz not null default now()
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  recommendation_id uuid not null references public.recommendations(id) on delete restrict,
  disposition public.disposition not null,
  override_reason text,
  triage_seconds integer not null check (triage_seconds >= 0),
  estimated_loss_prevented_cents integer not null default 0 check (estimated_loss_prevented_cents >= 0),
  created_at timestamptz not null default now(),
  check (override_reason is null or length(trim(override_reason)) > 0)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete restrict,
  dispute_id uuid not null references public.disputes(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create table public.evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('demo', 'gemini')),
  total_cases integer not null check (total_cases > 0),
  correct_cases integer not null check (correct_cases between 0 and total_cases),
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object'),
  created_at timestamptz not null default now()
);

create or replace function public.enforce_decision_override()
returns trigger language plpgsql set search_path = '' as $$
declare recommended public.disposition;
begin
  select r.disposition into recommended
  from public.recommendations r
  where r.id = new.recommendation_id
    and r.dispute_id = new.dispute_id
    and (r.owner_id = new.owner_id or r.owner_id is null);
  if recommended is null then raise exception 'recommendation does not belong to dispute'; end if;
  if new.disposition <> recommended and coalesce(length(trim(new.override_reason)), 0) = 0 then
    raise exception 'override reason is required';
  end if;
  return new;
end $$;

create trigger decisions_require_override before insert or update on public.decisions
for each row execute function public.enforce_decision_override();

create or replace function public.reject_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit events are immutable';
end $$;

create trigger audit_events_immutable before update or delete on public.audit_events
for each row execute function public.reject_audit_mutation();

alter table public.disputes enable row level security;
alter table public.evidence enable row level security;
alter table public.recommendations enable row level security;
alter table public.decisions enable row level security;
alter table public.audit_events enable row level security;
alter table public.evaluation_runs enable row level security;

create policy "read demo or own disputes" on public.disputes for select using (owner_id is null or owner_id = auth.uid());
create policy "insert own disputes" on public.disputes for insert with check (owner_id = auth.uid());
create policy "update own disputes" on public.disputes for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own disputes" on public.disputes for delete using (owner_id = auth.uid());

create policy "read demo or own evidence" on public.evidence for select using (owner_id is null or owner_id = auth.uid());
create policy "insert own evidence" on public.evidence for insert with check (
  owner_id = auth.uid() and exists (select 1 from public.disputes d where d.id = dispute_id and d.owner_id = auth.uid())
);
create policy "update own evidence" on public.evidence for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own evidence" on public.evidence for delete using (owner_id = auth.uid());

create policy "read demo or own recommendations" on public.recommendations for select using (owner_id is null or owner_id = auth.uid());
create policy "insert own recommendations" on public.recommendations for insert with check (
  owner_id = auth.uid() and exists (select 1 from public.disputes d where d.id = dispute_id and d.owner_id = auth.uid())
);
create policy "delete own recommendations" on public.recommendations for delete using (owner_id = auth.uid());

create policy "read own decisions" on public.decisions for select using (owner_id = auth.uid());
create policy "insert own decisions" on public.decisions for insert with check (
  owner_id = auth.uid() and exists (select 1 from public.disputes d where d.id = dispute_id and d.owner_id = auth.uid())
);

create policy "read own audit events" on public.audit_events for select using (owner_id = auth.uid());
create policy "append own audit events" on public.audit_events for insert with check (
  owner_id = auth.uid() and actor_id = auth.uid()
  and exists (select 1 from public.disputes d where d.id = dispute_id and d.owner_id = auth.uid())
);

create policy "read own evaluation runs" on public.evaluation_runs for select using (owner_id = auth.uid());
create policy "insert own evaluation runs" on public.evaluation_runs for insert with check (owner_id = auth.uid());
create policy "delete own evaluation runs" on public.evaluation_runs for delete using (owner_id = auth.uid());

create index disputes_owner_created_idx on public.disputes(owner_id, created_at desc);
create index evidence_dispute_idx on public.evidence(dispute_id);
create index recommendations_dispute_idx on public.recommendations(dispute_id, created_at desc);
create index decisions_dispute_idx on public.decisions(dispute_id, created_at desc);
create index audit_events_dispute_idx on public.audit_events(dispute_id, created_at);
create index evaluation_runs_owner_idx on public.evaluation_runs(owner_id, created_at desc);
