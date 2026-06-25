// Single source of truth for whether Clerk auth is wired. Reads the public key, which Next inlines
// at build for both server and client. With no key the app runs in Phase-1 local-only mode: no
// ClerkProvider, no middleware, and the Save / My Trades affordances stay hidden, so the trade
// machine works exactly as before. Drop in NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY to
// turn accounts on (see docs/superpowers/specs/2026-06-25-users-and-save-progress-design.md).
export const authEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
