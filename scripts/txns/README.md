# Transaction curation loop

Keeps rosters + the freshness feed current between structured-data refreshes. This is the
**daily-churn** stream (trades/signings); salaries/value/age refresh separately via the
Basketball-Reference scrape and `scripts/stats/pull.ts`.

## Commands

```
npm run txns:apply    # scripts/txns/pending.json -> players.json overrides + freshness.ts feed
npm run txns:check    # pre-seed verification (dup ids, phantom players, feed counts)
```

Then `npm run seed` publishes to the live Neon DB (the local filesystem fallback reflects it
immediately with no seed).

## pending.json schema

Overwrite this file each run with the latest batch, then `npm run txns:apply`.

```jsonc
{
  "as_of": "2026-07-13",            // becomes DATA_AS_OF
  "deals": [
    {
      "date": "2026-07-01",         // ISO, when reported/agreed
      "status": "final",            // "final" (agreed/official) | "pending" (reported, not official)
      "reflected": true,            // feed badge: are the rosters updated? true only for reflectable trades
      "summary": "Celtics trade Jaylen Brown to the 76ers for Paul George ...",
      "moves": [
        { "player": "Jaylen Brown", "team": "phi" },
        { "player": "Paul George",  "team": "bos" },
        { "player": "Khris Middleton", "team": "was", "reflect": false }
      ]
    }
  ],
  "extensions": [                   // re-signings / extensions - feed only, no roster move
    { "date": "2026-07-01", "status": "final", "reflected": false,
      "summary": "Victor Wembanyama signs a 5-yr, $252M extension with the Spurs." }
  ]
}
```

### Rules `apply.ts` enforces

- A move writes a `players.json` override **only if** the player already has a `2026-27`
  contract row. Otherwise it's reported as PENDING and skipped - moving a player with no cap
  number would misattribute the free-agent pool and they wouldn't render anyway.
- Mark **free-agent signings and sign-and-trades** `"reflect": false` (their new contract isn't
  in our data yet). They land in the feed as `pending`; the Basketball-Reference scrape backfills
  the salary, after which they render automatically.
- Player names are matched case/punctuation/accent-insensitively. UNRESOLVED names fail the run -
  fix the spelling in `pending.json` and re-run.
- Idempotent: re-running dedupes moves by player id and feed entries by exact summary.

### Authoring rules (for the summaries)

- Never fabricate salary figures. If a contract number isn't confirmed, leave it out.
- Do not reflect deals reported "on hold" / pending league approval - `status: "pending"`,
  `reflected: false`, empty `moves`.
- No em-dashes in summaries (use " - ").

See `ROUTINE.md` for the prompt that drives this on a schedule.
