-- 0004_player_value.sql — denormalized per-player value metric (Game Score) for trade grading.
create table if not exists player_value (
  player_id text primary key,
  season text not null,
  gp int,
  pts numeric,
  reb numeric,
  ast numeric,
  value numeric
);
