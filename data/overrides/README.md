# Data layers

The import (`scripts/import.ts`) merges three layers by row `id`. Later layers win:

1. **`data/seed/`** (base) - illustrative starter rosters so the app runs before the
   scraper is wired. These are NOT guaranteed current. Replace/remove once scraping is live.
2. **`scripts/scraper/out/`** (scrape) - full current contracts produced by the Python
   scraper (`scripts/scraper/normalize.py`). Overwrites seed rows with matching ids.
3. **`data/overrides/`** (override, authoritative) - hand-maintained corrections that win
   over everything. Put brand-new extensions and edge cases here.

Reference tables `teams.json` and `season_cap.json` live here because they are authoritative.

## Adding a correction

Add a row to the matching `data/overrides/<table>.json` with the same `id` scheme the
scraper uses (`p_<name_slug>` for players, `c_<name_slug>_<season>` for contracts) and
`"source": "override"`. Example: `contracts.json` carries Chet Holmgren's active 2026-27
extension salary so a stale scrape can never revert it - the exact failure mode this
product exists to beat.
