import { describe, expect, it } from 'vitest';
import { matchesPlayerName, normalizeSearch } from '../search';

describe('fan-entered player searches', () => {
  it.each([
    ['Kristaps Porziņģis', 'porzingis'], ['Nikola Jokić', 'JOKIC'],
    ['De’Aaron Fox', 'deaaron'], ['D’Angelo Russell', 'd angelo russell'],
    ['P.J. Washington', 'pj washington'], ['PJ Washington', 'P. J. Washington'],
    ['Karl-Anthony Towns', 'karl anthony'], ['Karl-Anthony Towns', 'KAT'],
    ['Stephen Curry', 'Steph Curry'], ['Stephen Curry', 'Curry Steph'],
    ['Shai Gilgeous-Alexander', 'SGA'], ['Kevin Durant', 'KD'],
    ['Nicolas Claxton', 'Nic Claxton'], ['Cameron Johnson', 'Cam Johnson'],
  ])('finds %s from %s', (name, query) => expect(matchesPlayerName(name, query)).toBe(true));

  it.each([
    ['Seth Curry', 'Steph Curry'], ['Stephen Curry', 'Seth'], ['Anthony Edwards', 'AD'],
    ['Karl-Anthony Towns', 'cat'], ['Kevin Durant', 'SGA'], ['Nikola Jokic', '---'],
  ])('does not guess %s from %s', (name, query) => expect(matchesPlayerName(name, query)).toBe(false));

  it('treats whitespace as an empty search and keeps multiword queries normalized', () => {
    expect(matchesPlayerName('Stephen Curry', '   ')).toBe(true);
    expect(normalizeSearch('  Shai—Gilgeous  Alexander  ')).toBe('shai gilgeous alexander');
  });
});
