-- 0002_engine.sql — schema hygiene + the entities the CBA engine and multi-source pipeline need.
-- Additive and idempotent (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS) so it is safe to
-- re-run. Applied by scripts/migrate.ts which splits on ';' — keep one statement per ';' and no ';'
-- inside comments.

-- ---------- contracts: split the overloaded option_type + add the missing CBA fields ----------
alter table contracts add column if not exists is_two_way boolean not null default false;
alter table contracts add column if not exists cap_hit bigint;
alter table contracts add column if not exists paid_salary bigint;
alter table contracts add column if not exists trade_bonus_pct numeric;
alter table contracts add column if not exists trade_bonus_earned boolean not null default false;
alter table contracts add column if not exists likely_incentives bigint not null default 0;
alter table contracts add column if not exists unlikely_incentives bigint not null default 0;
alter table contracts add column if not exists signed_via text;
alter table contracts add column if not exists bird_rights text;
alter table contracts add column if not exists signed_date date;
alter table contracts add column if not exists acquired_date date;
alter table contracts add column if not exists extended_date date;
alter table contracts add column if not exists is_rookie_scale_extension boolean not null default false;
alter table contracts add column if not exists guarantee_date date;
alter table contracts add column if not exists option_decision_date date;
alter table contracts add column if not exists verified_at timestamptz;
alter table contracts add column if not exists is_estimated boolean not null default false;

-- migrate legacy overloaded option_type values into the orthogonal flags
update contracts set is_two_way = true where option_type = 'two_way';
update contracts set guarantee_status = 'non_guaranteed' where option_type = 'non_guaranteed';
update contracts set option_type = 'guaranteed' where option_type in ('two_way', 'non_guaranteed');

-- ---------- players: bio + RFA + draft + display fields ----------
alter table players add column if not exists rfa_status text;            -- rfa|ufa|under_contract
alter table players add column if not exists qualifying_offer bigint;
alter table players add column if not exists draft_year int;
alter table players add column if not exists draft_team_id text;
alter table players add column if not exists draft_slot int;
alter table players add column if not exists headshot_url text;
alter table players add column if not exists jersey_number text;
alter table players add column if not exists injury_status text;

-- ---------- season cap rules out of hardcoded constants and into the DB ----------
create table if not exists apron_thresholds (
  season text not null, level text not null, amount bigint not null,
  primary key (season, level)
);

create table if not exists season_rules (
  season text primary key,
  matching jsonb not null,        -- { belowApron: [...], apronTakebackPct }
  cash_limit bigint,
  calendar jsonb,                 -- { tradeDeadline, decGuaranteeEligible, janFifteen, moratoriumEnd, aggregationCutoff }
  min_salary_by_yos jsonb
);

create table if not exists tax_brackets (
  season text not null, up_to bigint not null, rate numeric not null, repeater_rate numeric not null,
  primary key (season, up_to)
);

-- ---------- exceptions / picks: fields the engine reads ----------
alter table team_exceptions add column if not exists created_date date;
alter table team_exceptions add column if not exists used boolean not null default false;
alter table team_exceptions add column if not exists created_from_sign_and_trade boolean not null default false;

alter table draft_picks add column if not exists conveyed boolean not null default false;
alter table draft_picks add column if not exists swap_direction text;       -- favorable|unfavorable

-- ---------- new entities (superiority + currency) ----------
create table if not exists team_season_apron_history (
  team_id text references teams(id), season text not null, over_second_apron boolean not null default false,
  primary key (team_id, season)
);

create table if not exists player_metrics (
  player_id text references players(id), season text not null, source text not null, metric text not null,
  value numeric not null, primary key (player_id, season, source, metric)
);

create table if not exists pick_value_curve (
  slot int primary key, value numeric not null
);

create table if not exists team_projected_record (
  team_id text references teams(id), season text not null, wins int, losses int,
  primary key (team_id, season)
);

create table if not exists transactions (
  id text primary key, date timestamptz not null, type text not null, detail text, source text,
  player_id text, team_id text
);

create table if not exists player_status (
  player_id text primary key references players(id), status text, games_missed int, note text,
  updated_at timestamptz not null default now()
);

create table if not exists news_links (
  id text primary key, date timestamptz not null, source text not null, url text not null,
  news_window text,                 -- deadline|draft|free_agency
  player_id text, team_id text
);

-- the override layer is authoritative: any row here wins the import merge for its (table,row id)
create table if not exists overrides (
  id text primary key, target_table text not null, target_id text not null, patch jsonb not null,
  reason text, created_at timestamptz not null default now()
);

create table if not exists data_version (
  id int primary key default 1, refreshed_at timestamptz not null default now(), note text
);
