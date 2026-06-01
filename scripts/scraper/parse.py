"""Parse a team salary page into normalized contract rows.

The selectors below match the representative fixture in fixtures/team_sample.html and
are TDD'd in test_parse.py, so the logic is verified offline. When wiring a real public
source (Spotrac/HoopsHype), recapture a fixture from that source and adjust the three
selectors to match its markup; the row shape and tests stay the same.
"""

from selectolax.parser import HTMLParser

CURRENT_SEASON = "2025-26"

ROW_SELECTOR = "table.roster tbody tr"
NAME_SELECTOR = "td.player a"
SALARY_SELECTOR = "td.salary"


def _to_int(text: str) -> int:
    return int("".join(ch for ch in text if ch.isdigit()) or "0")


def parse_team(html: str, team_id: str) -> list[dict]:
    tree = HTMLParser(html)
    out: list[dict] = []
    for r in tree.css(ROW_SELECTOR):
        name_node = r.css_first(NAME_SELECTOR)
        salary_node = r.css_first(SALARY_SELECTOR)
        if name_node is None or salary_node is None:
            continue
        salary = _to_int(salary_node.text())
        if salary == 0:
            continue
        out.append(
            {
                "name": name_node.text(strip=True),
                "team_id": team_id,
                "season": CURRENT_SEASON,
                "salary": salary,
                "option_type": "guaranteed",
                "guarantee_status": "full",
                "no_trade_clause": False,
                "source": "scrape",
            }
        )
    return out
