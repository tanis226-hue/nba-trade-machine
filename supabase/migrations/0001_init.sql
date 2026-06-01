create table teams (
  id text primary key, name text not null, abbr text not null unique,
  conference text not null, logo_url text, primary_color text, secondary_color text
);

create table players (
  id text primary key, name text not null, position text,
  team_id text references teams(id), age int, years_of_service int
);

create table contracts (
  id text primary key, player_id text references players(id), season text not null,
  salary bigint not null,
  option_type text not null default 'guaranteed',     -- team|player|eto|guaranteed|non_guaranteed|two_way
  guarantee_status text not null default 'full',       -- full|partial|non_guaranteed
  partial_guarantee_amount bigint,
  no_trade_clause boolean not null default false,
  source text not null default 'scrape'                -- scrape|override
);
create index contracts_player_season_idx on contracts(player_id, season);

create table trade_restrictions (
  id text primary key, player_id text references players(id),
  kind text not null,                                  -- recently_signed|recently_extended|base_year_comp|poison_pill|sign_and_trade
  eligible_date date, cannot_aggregate_until date, note text
);

create table season_cap (
  season text primary key, salary_cap bigint not null, tax_line bigint not null,
  first_apron bigint not null, second_apron bigint not null, min_team_salary bigint not null
);

create table team_exceptions (
  id text primary key, team_id text references teams(id), season text not null,
  kind text not null, amount bigint not null, expires_date date  -- tpe|mle|bae|room
);

create table cap_holds (
  id text primary key, team_id text references teams(id), season text not null,
  label text not null, amount bigint not null, renounceable boolean not null default true
);

create table draft_picks (
  id text primary key, owning_team_id text references teams(id),
  original_team_id text references teams(id), season text not null, round int not null,
  protections jsonb, is_swap boolean not null default false, is_frozen boolean not null default false
);

create table trades (
  id text primary key, slug text not null unique, payload jsonb not null,
  created_at timestamptz not null default now()
);
create index trades_slug_idx on trades(slug);
