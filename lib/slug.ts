// Shared player-id slugging so every data source (BBRef scrape, stats.nba.com pull, overrides)
// produces the SAME id for the same player. Diacritics are folded to ASCII (Doncic, Sengun)
// so cross-source joins line up. Use slugify() at ingest; use normalizePlayerId() as a tolerant
// join key for legacy data whose ids predate consistent slugging.

const SUFFIX = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
const COMBINING_MARKS = /[̀-ͯ]/g; // diacritics after NFD decomposition

/** Canonical player id from a display name: `p_` + ASCII-folded, underscore-joined lowercase. */
export function slugify(name: string): string {
  const body = name
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `p_${body}`;
}

/**
 * Tolerant join key for matching ids across sources that slugged inconsistently: folds diacritics,
 * drops generational suffixes (Jr/Sr/II-V), and removes separators. Exact-equality only - never used
 * for fuzzy/prefix matching, which risks attaching one player's stats to another.
 */
export function normalizePlayerId(id: string): string {
  return id
    .replace(/^p_/, '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .split('_')
    .filter((t) => t && !SUFFIX.has(t))
    .join('');
}
