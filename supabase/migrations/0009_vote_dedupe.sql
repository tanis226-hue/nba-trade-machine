-- 0009_vote_dedupe.sql — one vote per voter per trade (a stable per-browser id), upsertable.
alter table trade_votes add column if not exists voter text;
create unique index if not exists trade_votes_slug_voter_uq on trade_votes (slug, voter);
