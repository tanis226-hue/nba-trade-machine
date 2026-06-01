from pathlib import Path

from parse import parse_team


def test_parse_team_extracts_player_contracts():
    html = Path(__file__).parent.joinpath("fixtures/team_sample.html").read_text(encoding="utf-8")
    players = parse_team(html, team_id="okc")

    # two real salaries; the "-" (two-way placeholder) row is skipped
    assert len(players) == 2
    p = players[0]
    assert set(p.keys()) >= {"name", "team_id", "season", "salary", "option_type"}
    assert p["team_id"] == "okc"
    assert p["name"] == "Shai Gilgeous-Alexander"
    assert isinstance(p["salary"], int) and p["salary"] == 38333050
    assert p["source"] == "scrape"
