from pathlib import Path

from parse import parse_contracts, slug

FIXTURE = Path(__file__).parent / "fixtures" / "bbref_contracts_sample.html"


def rows():
    return parse_contracts(FIXTURE.read_text(encoding="utf-8"))


def test_extracts_many_players_across_all_teams():
    r = rows()
    teams = {x["team_id"] for x in r}
    names = {x["name"] for x in r}
    assert len(r) > 400  # player-season rows across the league
    assert len(names) > 400  # distinct players
    assert len(teams) == 30  # every team represented
    assert "Tm" not in teams  # repeated header rows are skipped
    assert {"bkn", "cha", "phx"} <= teams  # legacy BBRef abbrevs mapped
    assert all(t == t.lower() and len(t) == 3 for t in teams)


def test_current_season_salary_and_shape():
    curry = next(x for x in rows() if x["name"] == "Stephen Curry" and x["season"] == "2025-26")
    assert curry["team_id"] == "gsw"
    assert curry["salary"] == 59606817  # exact dollars, from csk
    assert curry["option_type"] == "guaranteed"
    assert curry["guarantee_status"] == "full"
    assert curry["no_trade_clause"] is False
    assert curry["source"] == "scrape"
    assert curry["remain_gtd"] > 0  # player-level total, used for multi-team dedup


def test_captures_future_contract_years():
    curry = [x for x in rows() if x["name"] == "Stephen Curry"]
    seasons = {x["season"]: x["salary"] for x in curry}
    assert "2025-26" in seasons and "2026-27" in seasons
    assert seasons["2026-27"] == 62587158


def test_player_and_team_option_markers():
    r = rows()
    lebron = next(x for x in r if x["name"] == "LeBron James" and x["season"] == "2025-26")
    assert lebron["team_id"] == "lal"
    assert lebron["salary"] == 52627153
    assert lebron["option_type"] == "player"  # salary-pl
    assert any(x["option_type"] == "team" for x in r)  # salary-tm present in the league


def test_slug_normalizes_accents():
    assert slug("Nikola Jokić") == "nikola_jokic"
    assert slug("Shai Gilgeous-Alexander") == "shai_gilgeous_alexander"
