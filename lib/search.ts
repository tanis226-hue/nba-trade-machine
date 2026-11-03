/** A stable, locale-independent key for fan-entered names. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[’'`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// Deliberate aliases only: broad fuzzy edits can match the wrong player.
const PLAYER_ALIASES: Record<string, readonly string[]> = {
  'karl anthony towns': ['kat'],
  'kevin durant': ['kd'],
  'anthony davis': ['ad'],
  'shai gilgeous alexander': ['sga'],
  'paul george': ['pg13'],
  'nicolas claxton': ['nic claxton'],
  'cameron johnson': ['cam johnson'],
  'cameron thomas': ['cam thomas'],
  'robert williams iii': ['rob williams'],
};

function matchesKey(name: string, query: string): boolean {
  if (name.includes(query)) return true;
  const words = name.split(' ');
  // First-name abbreviations and reordered full names ("Steph Curry", "Curry Steph").
  if (query.split(' ').every(part => words.some(word => word.startsWith(part)))) return true;
  // Initials are commonly written both "P.J." and "PJ".
  return name.replaceAll(' ', '').startsWith(query.replaceAll(' ', ''));
}

export function matchesPlayerName(name: string, query: string): boolean {
  if (!query.trim()) return true;
  const key = normalizeSearch(query);
  if (!key) return false;
  const normalizedName = normalizeSearch(name);
  if (matchesKey(normalizedName, key)) return true;
  return (PLAYER_ALIASES[normalizedName] ?? []).some(alias => alias.includes(' ') ? matchesKey(alias, key) : alias === key);
}
