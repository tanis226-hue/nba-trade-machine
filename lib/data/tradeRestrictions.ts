// Per-player trade-timing inputs, curated alongside the trade/signing curation. These feed the
// date-aware eligibility rules (lib/cba/rules/eligibility.ts): a just-acquired player has a 2-month
// aggregation lock and a 1-year no-trade-back to the team that dealt him; a just-signed player is
// restricted ~3 months (or until Dec 15); a just-extended player is frozen ~6 months.
//
// `acquiredFrom` is the UPPERCASE team code (matching the in-app team abbreviations / toTeam values).
// Update this whenever a trade/signing is curated into the overrides.

export interface PlayerRestriction {
  acquiredDate?: string; // ISO; 2-month aggregation lock + 1-year no-trade-back
  acquiredFrom?: string; // team code (uppercase) the player was traded from
  signedDate?: string; // ISO; recently-signed 3-month / Dec-15 restriction
  extendedDate?: string; // ISO; 6-month extension freeze
}

export const PLAYER_RESTRICTIONS: Record<string, PlayerRestriction> = {
  // Giannis blockbuster (reported Jun 23, 2026): Heat <-> Bucks
  p_giannis_antetokounmpo: { acquiredDate: '2026-06-23', acquiredFrom: 'MIL' },
  p_bobby_portis: { acquiredDate: '2026-06-23', acquiredFrom: 'MIL' },
  p_tyler_herro: { acquiredDate: '2026-06-23', acquiredFrom: 'MIA' },
  p_kel_el_ware: { acquiredDate: '2026-06-23', acquiredFrom: 'MIA' },
  p_jaime_jaquez_jr: { acquiredDate: '2026-06-23', acquiredFrom: 'MIA' },
  p_kasparas_jakucionis: { acquiredDate: '2026-06-23', acquiredFrom: 'MIA' },
  // Aaron Wiggins (Jun 21, 2026): Thunder -> Hawks
  p_aaron_wiggins: { acquiredDate: '2026-06-21', acquiredFrom: 'OKC' },
  // Randle 3-team (Jun 22, 2026): Wolves -> Nets, Nets -> Bulls
  p_julius_randle: { acquiredDate: '2026-06-22', acquiredFrom: 'MIN' },
  p_nic_claxton: { acquiredDate: '2026-06-22', acquiredFrom: 'BKN' },
};

export function restrictionFor(playerId: string): PlayerRestriction | undefined {
  return PLAYER_RESTRICTIONS[playerId];
}
