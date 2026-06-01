"""Fetch every team page, parse, and write normalized players.json + contracts.json
to scripts/scraper/out/ (the 'scrape' layer consumed by scripts/import.ts).

Fill TEAM_URLS with the 30 source URLs once a source is chosen. ids match the import
merge scheme: p_<name_slug> and c_<name_slug>_<season>.
"""

import json
import pathlib
import re

from fetch import fetch_team_html
from parse import parse_team

# team_id -> source salary-page URL. Fill all 30 when a source is chosen.
TEAM_URLS: dict[str, str] = {
    # "okc": "https://example-source/team/okc",
}


def slug(name: str) -> str:
    return "p_" + re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def main() -> None:
    players: dict[str, dict] = {}
    contracts: list[dict] = []
    for team_id, url in TEAM_URLS.items():
        for row in parse_team(fetch_team_html(url), team_id):
            pid = slug(row["name"])
            players[pid] = {"id": pid, "name": row["name"], "position": None, "team_id": team_id}
            contracts.append(
                {
                    "id": f"c_{pid[2:]}_{row['season']}",
                    "player_id": pid,
                    "season": row["season"],
                    "salary": row["salary"],
                    "option_type": row["option_type"],
                    "guarantee_status": row["guarantee_status"],
                    "no_trade_clause": row["no_trade_clause"],
                    "source": row["source"],
                }
            )
    out = pathlib.Path(__file__).parent / "out"
    out.mkdir(exist_ok=True)
    (out / "players.json").write_text(json.dumps(list(players.values()), indent=2), encoding="utf-8")
    (out / "contracts.json").write_text(json.dumps(contracts, indent=2), encoding="utf-8")
    print(f"wrote {len(players)} players, {len(contracts)} contracts")


if __name__ == "__main__":
    main()
