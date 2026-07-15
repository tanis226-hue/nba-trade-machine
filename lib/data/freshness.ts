// Data-currency surface. The override layer (data/overrides/*) is curated by hand during the
// offseason trade/FA surge; this records how current that curation is and which recent moves are
// (or are not yet) reflected in the rosters, so the UI can be honest about freshness - something no
// competitor does. Update DATA_AS_OF and prepend to RECENT_TRANSACTIONS whenever overrides change.

export const DATA_AS_OF = '2026-07-13';

export type TxnStatus = 'final' | 'pending';

export interface Transaction {
  date: string; // ISO, when it was reported/agreed
  status: TxnStatus; // 'final' = agreed/official; 'pending' = reported but not yet official
  reflected: boolean; // whether our rosters already show the player moves
  summary: string;
}

// Newest first. `reflected` must be honest: only true once the override data actually moves the players.
// Verified Jul 13 2026 via ESPN / NBA.com / Yahoo / Hoops Rumors / Wikipedia offseason trackers.
export const RECENT_TRANSACTIONS: Transaction[] = [
  {
    date: '2026-07-08',
    status: 'final',
    reflected: true,
    summary:
      'Six-team trade: Wizards land Khris Middleton (sign-and-trade), Bucks get Caris LeVert, Pistons add Gary Harris, Taurean Prince and John Collins (S&T), Grizzlies get D’Angelo Russell, Mavericks get Santi Aldama and Marcus Sasser. Traded players reflected; the Middleton and Collins sign-and-trade legs await new-contract data.',
  },
  {
    date: '2026-07-03',
    status: 'final',
    reflected: true,
    summary: 'Lakers trade DeAndre Ayton to the Wizards for Jaden Hardy and two second-round picks.',
  },
  {
    date: '2026-07-03',
    status: 'final',
    reflected: true,
    summary: 'Rockets trade Dorian Finney-Smith and three second-round picks to the Hornets for a trade exception.',
  },
  {
    date: '2026-07-01',
    status: 'final',
    reflected: true,
    summary:
      'Celtics trade Jaylen Brown to the 76ers for Paul George, two first-round picks and two second-rounders. Player moves reflected; pick-ownership update pending.',
  },
  {
    date: '2026-07-01',
    status: 'final',
    reflected: false,
    summary:
      'Lakers acquire Walker Kessler from the Jazz in a sign-and-trade (two firsts, two swaps). Cap reflection pending new-contract data.',
  },
  {
    date: '2026-07-01',
    status: 'final',
    reflected: false,
    summary:
      'Free-agency wave (reported; new contracts not yet in the cap sheets): Norman Powell (CHI), Mitchell Robinson (BOS), Andre Drummond (NYK), Quentin Grimes and Collin Sexton (LAL), Rui Hachimura (LAC), Luke Kennard (PHX), Kelly Oubre Jr. (IND), Tim Hardaway Jr. (MIA), Anfernee Simons (PHI), Kyle Anderson (TOR) and others change teams.',
  },
  {
    date: '2026-06-30',
    status: 'pending',
    reflected: false,
    summary:
      'Reported Raptors acquisition of Kawhi Leonard from the Clippers (for Brandon Ingram, Gradey Dick and picks) is on hold pending an NBA investigation - not yet reflected.',
  },
  {
    date: '2026-06-29',
    status: 'final',
    reflected: true,
    summary: 'Trail Blazers acquire Ja Morant from the Grizzlies for Jerami Grant and Kris Murray.',
  },
  {
    date: '2026-06-29',
    status: 'final',
    reflected: true,
    summary: 'Hawks acquire Devin Carter from the Kings for a 2033 second-round pick.',
  },
  {
    date: '2026-06-28',
    status: 'final',
    reflected: true,
    summary:
      'Suns acquire Miles Bridges from the Hornets for Grayson Allen, Royce O’Neale and draft compensation.',
  },
  {
    date: '2026-06-26',
    status: 'final',
    reflected: true,
    summary: 'Thunder trade Isaiah Joe to the Pistons for two future second-round picks.',
  },
  {
    date: '2026-06-25',
    status: 'pending',
    reflected: true,
    summary:
      'Timberwolves acquire LaMelo Ball and Josh Green; Hornets acquire Naz Reid plus a 2033 first-round pick, three first-round swaps (2028/29/30) and three second-rounders. Player moves reflected; pick-ownership update pending. Agreed; formally processes at the new league year (~Jul 6).',
  },
  {
    date: '2026-06-25',
    status: 'final',
    reflected: true,
    summary: 'Draft-night swap: Bulls acquire guard Kam Jones from the Pacers (Chicago sends the No. 38 pick, Braden Smith).',
  },
  {
    date: '2026-06-24',
    status: 'final',
    reflected: true,
    summary: 'Draft-day deal: Grizzlies acquire Isaiah Stewart from the Pistons for three future second-round picks.',
  },
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
