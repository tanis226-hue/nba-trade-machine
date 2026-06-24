-- 0006_player_headshot.sql — NBA person id for player headshot CDN lookups.
alter table player_bio add column if not exists nba_id int;
