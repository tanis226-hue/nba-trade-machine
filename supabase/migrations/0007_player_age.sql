-- 0007_player_age.sql — player age (from stats.nba.com leaguedashplayerbiostats) for card display.
alter table player_bio add column if not exists age int;
