-- 0003_community.sql — community layer on shared trades (vote + comment).
-- Additive and idempotent (CREATE TABLE IF NOT EXISTS) so it is safe to re-run. Applied by
-- scripts/migrate.ts which splits on ';' — keep one statement per ';' and no ';' inside comments.

create table if not exists trade_votes (
  id text primary key,
  slug text not null,
  vote int not null,
  voter text,
  created_at timestamptz not null default now()
);

create table if not exists trade_comments (
  id text primary key,
  slug text not null,
  body text not null,
  author text,
  created_at timestamptz not null default now()
);

create index if not exists trade_votes_slug_idx on trade_votes (slug);
create index if not exists trade_comments_slug_idx on trade_comments (slug);
