import { describe, it, expect } from 'vitest';
import { selectValidation } from '@/lib/store/selectValidation';

describe('selectValidation', () => {
  it('validates a legal swap built from store shape', () => {
    const r = selectValidation({
      season: '2025-26',
      teams: [
        { abbr: 'AAA', preTradeSalary: 120_000_000 },
        { abbr: 'BBB', preTradeSalary: 120_000_000 },
      ],
      assets: {
        a1: { id: 'a1', kind: 'player', salary: 20_000_000, fromTeam: 'AAA', toTeam: 'BBB', label: 'A1' },
        b1: { id: 'b1', kind: 'player', salary: 20_000_000, fromTeam: 'BBB', toTeam: 'AAA', label: 'B1' },
      },
    });
    expect(r.valid).toBe(true);
  });
});
