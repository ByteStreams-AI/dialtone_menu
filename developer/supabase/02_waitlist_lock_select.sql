-- Lock the waitlist table's SELECT. Run in the marketing project
-- (hltmzafywzqajjzjpqva), the one this Worker's SUPABASE_URL points at.
--
-- 01_waitlist_schema.sql creates three policies. Two are right and stay; the
-- third is a read of everyone who ever filled in the form:
--
--   waitlist_insert_anon           INSERT to anon           KEEP
--   waitlist_insert_authenticated  INSERT to authenticated  KEEP
--   waitlist_select_authenticated  SELECT to authenticated using (true)  DROP
--
-- Its own comment in 01 called it "Optional: allow authenticated reads for
-- operators in dashboard contexts". No such dashboard exists: nothing in any
-- repo reads waitlist_submissions with an anon or user session, and the only
-- writer is this Worker's saveToSupabase(). So it grants a full read of names,
-- emails, restaurant names and comments to every account on the project, for
-- a consumer that was never built. If signup is enabled there, that is anyone
-- who registers.
--
-- THE INSERT POLICIES STAY, deliberately. `supabaseDbKey` in worker.js is
-- `SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY`, and SUPABASE_KEY is documented
-- as "an anon-key or service-role key" — which of the two is actually set is
-- not visible from the repo. Dropping the anon INSERT would therefore risk
-- breaking the live contact form to close nothing: an INSERT-only policy
-- cannot read a single row. The worst it permits is spam, which is a rate-limit
-- problem, not a disclosure one.
--
-- When an operator dashboard does get built, give it a policy scoped to that
-- dashboard's identity rather than restoring `using (true)`.

begin;

drop policy if exists "waitlist_select_authenticated" on public.waitlist_submissions;

commit;

-- Verify — expect only the two INSERT policies:
--   select policyname, cmd, roles::text, qual, with_check
--   from pg_policies
--   where schemaname = 'public' and tablename = 'waitlist_submissions';
