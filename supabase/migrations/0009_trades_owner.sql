-- 0009_trades_owner.sql — let a signed-in user own and re-find their saved trades.
-- Additive and idempotent (ADD COLUMN IF NOT EXISTS) so it is safe to re-run. Applied by
-- scripts/migrate.ts which splits on ';' — keep one statement per ';' and no ';' inside comments.
-- user_id holds the Clerk user id. Existing anonymous shares keep user_id NULL and are unchanged.

alter table trades add column if not exists user_id text;
alter table trades add column if not exists title text;
alter table trades add column if not exists updated_at timestamptz not null default now();
create index if not exists trades_user_id_idx on trades (user_id);
