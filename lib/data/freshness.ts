// Data-currency surface. The override layer (data/overrides/*) is curated by hand during the
// offseason trade/FA surge; this records how current that curation is and which recent moves are
// (or are not yet) reflected in the rosters, so the UI can be honest about freshness - something no
// competitor does. Update DATA_AS_OF and prepend to RECENT_TRANSACTIONS whenever overrides change.

export const DATA_AS_OF = '2026-06-24';

export type TxnStatus = 'final' | 'pending';

export interface Transaction {
  date: string; // ISO, when it was reported/agreed
  status: TxnStatus; // 'final' = agreed/official; 'pending' = reported but not yet official
  reflected: boolean; // whether our rosters already show the player moves
  summary: string;
}

// Newest first. `reflected` must be honest: only true once the override data actually moves the players.
// Verified Jun 24 2026 via ESPN / NBA.com / Yahoo / Spotrac offseason trackers.
export const RECENT_TRANSACTIONS: Transaction[] = [
  {
    date: '2026-06-23',
    status: 'final',
    reflected: true,
    summary:
      'Heat acquire Giannis Antetokounmpo and Bobby Portis; Bucks acquire Tyler Herro, Jaime Jaquez Jr., Kel’el Ware, Kasparas Jakucionis, plus four first-round picks and a swap. Player moves reflected; pick-ownership update pending.',
  },
  {
    date: '2026-06-22',
    status: 'pending',
    reflected: true,
    summary:
      'Three-team deal: Timberwolves send Julius Randle to the Nets; Nets send Nic Claxton to the Bulls (Wolves get a 2nd-rounder and a non-guaranteed contract likely to be waived). Agreed; formally processes at the new league year (~Jul 6).',
  },
  {
    date: '2026-06-21',
    status: 'final',
    reflected: true,
    summary: 'Thunder trade Aaron Wiggins to the Hawks for two future second-round picks (a luxury-tax move for OKC).',
  },
];
