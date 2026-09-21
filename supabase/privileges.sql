-- Least privilege for the public API roles. Apply LAST — after every other
-- supabase/*.sql file — so nothing later re-widens what this narrows.
--
-- Why: Supabase's default privileges hand `anon` and `authenticated` INSERT,
-- UPDATE, DELETE, TRUNCATE (plus REFERENCES/TRIGGER) on every new public table.
-- Row-level security has been the only thing stopping a browser holding the
-- public anon key from writing: every table has RLS on and a SELECT-only policy,
-- so writes are silently filtered to zero rows. That is safe until someone adds
-- one permissive policy — then the grant is already there. The site is read-only
-- for the public, so the grant is removed and RLS becomes a second lock, not the
-- only one. Every cron writes with the service_role key, which is untouched.
--
-- The one legitimate anon write is the newsletter signup form: INSERT of
-- (email, source) into subscribers via api/subscribe.js. Unsubscribe goes through
-- the SECURITY DEFINER RPC unsubscribe_subscriber(), which needs no table grant.
--
-- One statement batch = one transaction, so signup never sees the gap between
-- the revoke and the re-grant. Idempotent: safe to re-run.

-- 1. Existing tables and views: read-only for the public roles. (Revoking a
--    table-level privilege also drops any column-level grants, hence step 2.)
DO $$
DECLARE
  rel text;
BEGIN
  FOR rel IN
    SELECT format('%I.%I', n.nspname, c.relname)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v')
  LOOP
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON %s FROM anon, authenticated', rel);
  END LOOP;
END $$;

-- 2. The single exception: the signup form may supply email + source, nothing
--    else (not status, confirmed, id or timestamps).
GRANT INSERT (email, source) ON public.subscribers TO anon;

-- 3. Future tables created by `postgres` (migrations, SQL editor, MCP) start
--    read-only. The ensure_rls event trigger turns RLS on for them, so with no
--    policy yet they are unreadable until one is added deliberately.
--    Limitation: `supabase_admin` keeps its own default ACL for tables IT creates;
--    `postgres` cannot alter another role's defaults. Nothing here is created by it.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;
