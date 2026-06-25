-- 0008_team_exception_source.sql — provenance for a trade exception (e.g. the player whose outgoing
-- salary created a TPE), for display in the trade-exception list.
alter table team_exceptions add column if not exists source_player text;
