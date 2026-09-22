-- DialTone waitlist/contact form schema
-- Run this in Supabase SQL Editor for your target project.

begin;

create table if not exists public.waitlist_submissions (
  id bigint generated always as identity primary key,
  email text not null,
  name text not null,
  restaurant_name text,
  campaign text not null default 'launch',
  comment text,
  created_at timestamptz not null default now()
);

alter table public.waitlist_submissions
  add column if not exists restaurant_name text;

alter table public.waitlist_submissions
  add column if not exists campaign text;

update public.waitlist_submissions
set restaurant_name = name
where restaurant_name is null;

update public.waitlist_submissions
set campaign = 'launch'
where campaign is null;

alter table public.waitlist_submissions
  alter column restaurant_name set not null;

alter table public.waitlist_submissions
  alter column campaign set default 'launch';

alter table public.waitlist_submissions
  alter column campaign set not null;

-- Helpful indexes for filtering and audit review.
create index if not exists idx_waitlist_submissions_created_at
  on public.waitlist_submissions (created_at desc);

create index if not exists idx_waitlist_submissions_email
  on public.waitlist_submissions (email);

alter table public.waitlist_submissions enable row level security;

grant usage on schema public to anon, authenticated;
grant insert on public.waitlist_submissions to anon, authenticated;
grant usage, select on sequence public.waitlist_submissions_id_seq to anon, authenticated;

-- Allow public/anon inserts from the marketing form.
drop policy if exists "waitlist_insert_anon" on public.waitlist_submissions;
create policy "waitlist_insert_anon"
  on public.waitlist_submissions
  for insert
  to anon
  with check (true);

drop policy if exists "waitlist_insert_authenticated" on public.waitlist_submissions;
create policy "waitlist_insert_authenticated"
  on public.waitlist_submissions
  for insert
  to authenticated
  with check (true);

-- REMOVED 2026-09-22 — see 02_waitlist_lock_select.sql.
-- This was "Optional: allow authenticated reads for operators in dashboard
-- contexts", and the dashboard was never built. What it actually did was grant
-- every account on the project a full read of every name, email, restaurant
-- name and comment ever submitted. If a dashboard is built later, scope its
-- policy to that dashboard's identity rather than restoring `using (true)`.
--
-- drop policy if exists "waitlist_select_authenticated" on public.waitlist_submissions;
-- create policy "waitlist_select_authenticated"
--   on public.waitlist_submissions
--   for select
--   to authenticated
--   using (true);

commit;
