-- Practice Grader: run this once in Supabase → SQL Editor → New query → Run.
-- The app talks to this table only from the server, with the secret key.
-- Row Level Security is on with no policies, so the public (anon) key can't read or write it.

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- Who filled in the form
  first_name    text not null,
  last_name     text,
  role          text,
  email         text not null,
  phone         text not null,
  consent_text  text not null,

  -- What they scanned
  practice_name text not null,
  city          text not null,
  practice_type text not null,
  place_id      text,

  -- Result (null if the scan failed; the lead is still saved)
  score         integer,
  report        jsonb,
  scan_error    text,

  -- Set when they click "Book my free audit call"
  wants_call_at timestamptz
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx on public.leads (lower(email));

alter table public.leads enable row level security;

-- Stage 6 (scan limits). Safe to run more than once.
-- Stores a one-way hash of the visitor's IP, never the IP itself.
alter table public.leads add column if not exists ip_hash text;
create index if not exists leads_ip_hash_created_idx on public.leads (ip_hash, created_at desc);
create index if not exists leads_place_reuse_idx on public.leads (place_id, practice_type, city, created_at desc);
