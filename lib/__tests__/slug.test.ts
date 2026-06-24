import { describe, it, expect } from 'vitest';
import { slugify, normalizePlayerId } from '@/lib/slug';

describe('slugify', () => {
  it('folds diacritics to ASCII so sources agree', () => {
    expect(slugify('Nikola Jokić')).toBe('p_nikola_jokic');
    expect(slugify('Luka Dončić')).toBe('p_luka_doncic');
    expect(slugify('Alperen Şengün')).toBe('p_alperen_sengun');
    expect(slugify('Nikola Vučević')).toBe('p_nikola_vucevic');
  });

  it('squashes punctuation and spacing', () => {
    expect(slugify('Jimmy Butler III')).toBe('p_jimmy_butler_iii');
    expect(slugify("De'Aaron Fox")).toBe('p_de_aaron_fox');
    expect(slugify('  A.J.  Green ')).toBe('p_a_j_green');
  });
});

describe('normalizePlayerId', () => {
  it('drops generational suffixes so name-variants join', () => {
    expect(normalizePlayerId('p_jimmy_butler')).toBe('jimmybutler');
    expect(normalizePlayerId('p_jimmy_butler_iii')).toBe('jimmybutler');
    expect(normalizePlayerId('p_robert_williams_iii')).toBe('robertwilliams');
    expect(normalizePlayerId('p_xavier_tillman_sr')).toBe('xaviertillman');
    expect(normalizePlayerId('p_daron_holmes_ii')).toBe('daronholmes');
  });

  it('matches across suffix presence/absence (the orphan-join cases)', () => {
    expect(normalizePlayerId('p_jimmy_butler')).toBe(normalizePlayerId('p_jimmy_butler_iii'));
    expect(normalizePlayerId('p_gg_jackson_ii')).toBe(normalizePlayerId('p_gg_jackson'));
    expect(normalizePlayerId('p_a_j_green')).toBe(normalizePlayerId('p_aj_green'));
  });

  it('does NOT collapse genuinely different players', () => {
    expect(normalizePlayerId('p_jalen_williams')).not.toBe(normalizePlayerId('p_jalen_williamson'));
    expect(normalizePlayerId('p_luka_doncic')).not.toBe(normalizePlayerId('p_luka_garza'));
  });
});
