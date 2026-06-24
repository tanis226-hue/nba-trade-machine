-- 0005_player_bio.sql — player bio (position, height, weight, jersey) from the NBA player index.
create table if not exists player_bio (
  player_id text primary key,
  position text,
  height text,
  weight int,
  jersey text
);
