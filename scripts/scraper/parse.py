"""Parse Basketball-Reference's single contracts page into normalized contract rows.

One page (basketball-reference.com/contracts/players.html) lists every player with one
salary column per future season (data-stat y1..y6). We emit one row per (player, season)
so multi-year contracts become multiple rows, matching the `contracts` schema. Option
flags come from BBRef cell classes (legend: salary-pl=Player Option, salary-tm=Team
Option). TDD'd against fixtures/bbref_contracts_sample.html.
"""

import re
import unicodedata

from selectolax.parser import HTMLParser

TABLE_SELECTOR = "table#player-contracts"
YEAR_STATS = ["y1", "y2", "y3", "y4", "y5", "y6"]

# BBRef uses three legacy abbreviations that differ from our lowercase team ids.
BBREF_TEAM_FIX = {"brk": "bkn", "cho": "cha", "pho": "phx"}


def normalize_team(abbr: str) -> str:
    t = abbr.strip().lower()
    return BBREF_TEAM_FIX.get(t, t)


def slug(name: str) -> str:
    """Accent-normalized name slug, e.g. 'Nikola Jokić' -> 'nikola_jokic'."""
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_name = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "_", ascii_name.lower()).strip("_")


def _salary(cell) -> int:
    csk = cell.attributes.get("csk")
    if csk and csk.isdigit():
        return int(csk)
    return int("".join(ch for ch in cell.text() if ch.isdigit()) or "0")


def _option(cell) -> tuple[str, str]:
    """Return (option_type, guarantee_status) from a salary cell's class markers."""
    cls = cell.attributes.get("class") or ""
    if "salary-pl" in cls:
        return "player", "full"
    if "salary-tm" in cls:
        return "team", "full"
    if "salary-et" in cls:
        return "eto", "full"
    return "guaranteed", "full"


def _season_map(table) -> dict[str, str]:
    """Map yN data-stat -> season label ('2025-26') from the first header row."""
    out: dict[str, str] = {}
    head = table.css_first("thead")
    if head is None:
        return out
    for th in head.css("th[data-stat]"):
        stat = th.attributes.get("data-stat", "")
        if stat in YEAR_STATS:
            out[stat] = th.text(strip=True)
    return out


def parse_contracts(html: str) -> list[dict]:
    tree = HTMLParser(html)
    table = tree.css_first(TABLE_SELECTOR)
    if table is None:
        return []
    seasons = _season_map(table)
    out: list[dict] = []
    for tr in table.css("tbody tr"):
        cls = tr.attributes.get("class") or ""
        if "thead" in cls or "over_header" in cls:  # repeated mid-table header rows
            continue
        name_cell = tr.css_first('[data-stat="player"]')
        team_cell = tr.css_first('[data-stat="team_id"]')
        if name_cell is None or team_cell is None:
            continue
        name = name_cell.text(strip=True)
        team_raw = team_cell.text(strip=True)
        if not name or not team_raw or team_raw == "Tm":
            continue
        team_id = normalize_team(team_raw)
        gtd_cell = tr.css_first('[data-stat="remain_gtd"]')
        remain_gtd = _salary(gtd_cell) if gtd_cell is not None else 0
        for stat in YEAR_STATS:
            cell = tr.css_first(f'[data-stat="{stat}"]')
            if cell is None:
                continue
            salary = _salary(cell)
            if salary <= 0:
                continue
            season = seasons.get(stat)
            if not season:
                continue
            option_type, guarantee_status = _option(cell)
            out.append(
                {
                    "name": name,
                    "team_id": team_id,
                    "season": season,
                    "salary": salary,
                    "option_type": option_type,
                    "guarantee_status": guarantee_status,
                    "no_trade_clause": False,  # not on this page; override layer adds NTCs
                    "source": "scrape",
                    # Player-level total remaining guaranteed $. Used only to pick the current
                    # team when a waived player is listed under two teams (former team carries
                    # the larger stretched dead-money guarantee); dropped before output.
                    "remain_gtd": remain_gtd,
                }
            )
    return out
