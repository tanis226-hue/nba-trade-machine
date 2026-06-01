"""Fetch the single contracts page, parse, and write normalized players.json +
contracts.json to scripts/scraper/out/ (the 'scrape' layer consumed by scripts/import.ts).

ids match the import merge scheme so override rows replace scraped rows by id:
  player  -> p_<name_slug>          (e.g. p_nikola_jokic)
  contract-> c_<name_slug>_<season> (e.g. c_nikola_jokic_2025-26)
"""

import collections
import json
import pathlib

from fetch import fetch_html
from parse import parse_contracts, slug

SOURCE_URL = "https://www.basketball-reference.com/contracts/players.html"


def build(rows: list[dict]) -> tuple[list[dict], list[dict], list[tuple]]:
    by_player: dict[str, list[dict]] = collections.defaultdict(list)
    for row in rows:
        by_player[slug(row["name"])].append(row)

    players: list[dict] = []
    contracts: list[dict] = []
    multi_team: list[tuple] = []

    for s, prows in by_player.items():
        teams = {r["team_id"] for r in prows}
        if len(teams) > 1:
            # Waived player listed under two teams: keep the current team, i.e. the one with
            # the smallest remaining guarantee (the former team carries stretched dead money).
            primary = min(prows, key=lambda r: r["remain_gtd"])["team_id"]
            multi_team.append((prows[0]["name"], sorted(teams), primary))
        else:
            primary = next(iter(teams))

        pid = f"p_{s}"
        players.append(
            {"id": pid, "name": prows[0]["name"], "position": None, "team_id": primary, "age": None, "years_of_service": None}
        )
        seen: set[str] = set()
        for r in prows:
            if r["team_id"] != primary or r["season"] in seen:
                continue
            seen.add(r["season"])
            contracts.append(
                {
                    "id": f"c_{s}_{r['season']}",
                    "player_id": pid,
                    "season": r["season"],
                    "salary": r["salary"],
                    "option_type": r["option_type"],
                    "guarantee_status": r["guarantee_status"],
                    "no_trade_clause": r["no_trade_clause"],
                    "source": r["source"],
                }
            )
    return players, contracts, multi_team


def main() -> None:
    rows = parse_contracts(fetch_html(SOURCE_URL))
    players, contracts, multi_team = build(rows)
    out = pathlib.Path(__file__).parent / "out"
    out.mkdir(exist_ok=True)
    (out / "players.json").write_text(json.dumps(players, indent=2, ensure_ascii=False), encoding="utf-8")
    (out / "contracts.json").write_text(json.dumps(contracts, indent=2, ensure_ascii=False), encoding="utf-8")
    teams = {p["team_id"] for p in players}
    print(f"wrote {len(players)} players, {len(contracts)} contracts across {len(teams)} teams")
    if multi_team:
        print(f"\nresolved {len(multi_team)} multi-team (waived) players to current team:")
        for name, seen_teams, primary in sorted(multi_team):
            print(f"  {name}: {'/'.join(seen_teams)} -> {primary}")


if __name__ == "__main__":
    main()
