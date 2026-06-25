import { describe, it, expect } from 'vitest';
import { parseProtection, parseProtectionNote } from '@/lib/cba/protections';

describe('parseProtectionNote', () => {
  it('parses top-N protections (the conveyance-driving case)', () => {
    expect(parseProtectionNote('top-4')).toMatchObject({ type: 'top', through: 4, note: 'top-4' });
    expect(parseProtectionNote('top-14')).toMatchObject({ type: 'top', through: 14 });
    expect(parseProtectionNote('top-1')).toMatchObject({ type: 'top', through: 1 });
    expect(parseProtectionNote('top-20')).toMatchObject({ type: 'top', through: 20 });
  });

  it('keeps the trailing parenthetical in the note but still extracts the number', () => {
    expect(parseProtectionNote('top-16 (else to OKC)')).toMatchObject({
      type: 'top',
      through: 16,
      note: 'top-16 (else to OKC)',
    });
    // "else to OKC" is a conveyance to another team, not a second-round rollover
    expect(parseProtectionNote('top-16 (else to OKC)').rolloverToSecond).toBeUndefined();
    expect(parseProtectionNote('top-1 (swap, 2-30)')).toMatchObject({ type: 'top', through: 1 });
  });

  it('parses numeric pick-slot ranges', () => {
    expect(parseProtectionNote('31-55')).toMatchObject({ type: 'range', range: [31, 55] });
    expect(parseProtectionNote('15-30')).toMatchObject({ type: 'range', range: [15, 30] });
    expect(parseProtectionNote('56-60')).toMatchObject({ type: 'range', range: [56, 60] });
  });

  it('marks unprotected explicitly', () => {
    expect(parseProtectionNote('unprotected')).toMatchObject({ type: 'unprotected' });
  });

  it('flags a second-round rollover', () => {
    expect(parseProtectionNote('top-10 then 2nds')).toMatchObject({ type: 'top', through: 10, rolloverToSecond: true });
  });

  it('leaves swap/favorable language as note-only (not a top/range protection)', () => {
    for (const s of ['most favorable', 'least favorable', '2nd-most favorable', 'swap with CLE', 'SAS holds swap rights', 'less favorable of IND/WAS']) {
      const p = parseProtectionNote(s);
      expect(p.type).toBeUndefined();
      expect(p.note).toBe(s);
    }
  });
});

describe('parseProtection (raw DB value)', () => {
  it('returns null for absent protection', () => {
    expect(parseProtection(null)).toBeNull();
    expect(parseProtection(undefined)).toBeNull();
    expect(parseProtection('')).toBeNull();
    expect(parseProtection({})).toBeNull();
  });

  it('parses the stored {note} jsonb shape into structured fields', () => {
    expect(parseProtection({ note: 'top-4' })).toMatchObject({ type: 'top', through: 4, note: 'top-4' });
    expect(parseProtection({ note: '31-55' })).toMatchObject({ type: 'range', range: [31, 55] });
  });

  it('accepts a bare string', () => {
    expect(parseProtection('top-2')).toMatchObject({ type: 'top', through: 2 });
  });

  it('preserves pre-structured fields when present', () => {
    expect(parseProtection({ type: 'top', through: 7, note: 'custom' })).toMatchObject({ type: 'top', through: 7, note: 'custom' });
  });
});
