# Users + Save Progress - Design

Date: 2026-06-25
Status: approved (phased build)

## Problem

The trade board lives entirely in an in-memory Zustand store (`lib/store/tradeStore.ts`).
A page refresh or any client navigation wipes the working trade. Users also want real
accounts so saved trades follow them across devices.

## Decisions (locked)

- **Phased.** Ship local refresh-safety first; add accounts second.
- **Phase 1 scope:** restore the *current* board only. No named local library.
- **Phase 2 auth:** Clerk (hosted identity).
- **Database stays on Neon.** Clerk owns identity and the login UI; saved trades live in
  Neon, stamped with the Clerk `userId`. No second app database, no data migration.

## Phase 1 - Refresh is safe (local, ships first)

Goal: the working board survives a hard refresh and client-side navigation. No backend.

### Approach

Wrap `useTradeStore` with Zustand's `persist` middleware backed by `localStorage`.

- Storage key: `trade-machine:board:v1`. `version: 1` for future migrations.
- `partialize` persists only the meaningful working state:
  `season, teams, assets, simulatedDate, tradeMethod, playerSort`.
  Actions are not serialized. `compareIds` is ephemeral UI and is intentionally not persisted.
- `skipHydration: true`. The board triggers `rehydrate()` on mount and gates its render on a
  `hasHydrated` flag so the server-rendered empty store never causes a React hydration mismatch.

### Two integration fixes this requires (found in code review)

1. **Remove the auto-reset on unmount.** `TradeBoard.tsx` runs
   `useEffect(() => () => useTradeStore.getState().reset(), [])`. With persistence that would
   write an empty board to `localStorage` on every navigation away, defeating the feature.
   Replace it with an explicit **"New trade / Clear"** button wired to the existing `reset()`.
   The user clears intentionally, not implicitly.

2. **Rebuild the `contracts` map on restore.** `TradeBoard` keeps `contracts` in local component
   state, populated only inside `add()` when a team is added. After a refresh the persisted
   *teams* return but `contracts` is empty, so cap sheets render wrong. Add a mount effect that
   rebuilds `contracts` from the server `rosters` prop for every team already in the restored
   store. The data is identical to what `add()` sets (`cmap[id] = r.contract`), so this is a
   pure recompute, not a behavior change.

### Components touched

- `lib/store/tradeStore.ts` - add `persist`; export the `partialize` projection for testing.
- `components/TradeBoard.tsx` - hydration gate, contracts-rebuild effect, drop auto-reset.
- `components/TradeMatrix.tsx` (toolbar) - add the "New trade / Clear" button.

### Tests

- `partialize` returns exactly the persisted keys and omits actions / `compareIds`.
- Round-trip: seed `localStorage`, `rehydrate()`, assert `teams`/`assets` restored.

## Phase 2 - Accounts (Clerk) + saved trades (Neon)

### Auth

- Add `@clerk/nextjs`: `<ClerkProvider>` in the root layout, `clerkMiddleware()`, hosted
  sign-in / sign-up, a `<UserButton />` in the header. Clerk yields `userId`.
- Env: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (and sign-in/up URL vars).
  These are user-provided secrets; the app degrades gracefully (auth UI hidden) when unset so
  Phase 1 keeps working without keys.

### Saved trades schema (Neon, additive)

Reuse the existing `trades` table rather than a new one:

```sql
alter table trades add column if not exists user_id text;
alter table trades add column if not exists title text;
alter table trades add column if not exists updated_at timestamptz not null default now();
create index if not exists trades_user_id_idx on trades (user_id);
```

Existing anonymous shares keep `user_id = NULL` and are fully backward compatible.

### Features

- **Save to my account.** Signed-in users get a button next to "Generate Trade Link" that
  upserts a titled row under their `userId` (server route reads the Clerk session; the client
  never sends the user id).
- **My Trades library.** `/my-trades` server component lists
  `SELECT ... FROM trades WHERE user_id = <clerkUserId> ORDER BY updated_at DESC`.
- **Open in editor.** Add an "Edit / Duplicate" path that seeds the store from a saved payload
  and routes to `/` (today `/trade/[slug]` is read-only).
- **Local -> cloud hand-off.** On first sign-in, offer to save the current local board to the
  account. No bulk auto-sync (Phase 1 holds a single board).

## Out of scope (YAGNI)

- Named local library in Phase 1.
- Supabase at runtime; any second database; data migration.
- Replacing the existing anonymous share / comment / vote system. It keeps working untouched.
