import { describe, it, expect, beforeEach } from 'vitest';
import { useTradeStore } from '@/lib/store/tradeStore';

describe('tradeStore', () => {
  beforeEach(() => useTradeStore.getState().reset());

  it('adds teams, caps at 4, routes assets', () => {
    const s = useTradeStore.getState();
    s.addTeam({ abbr: 'AAA', preTradeSalary: 120 });
    s.addTeam({ abbr: 'BBB', preTradeSalary: 120 });
    s.addAsset({ id: 'a1', kind: 'player', salary: 20, fromTeam: 'AAA', toTeam: 'AAA', label: 'A1' });
    s.routeAsset('a1', 'BBB');
    expect(useTradeStore.getState().assets['a1'].toTeam).toBe('BBB');
    ['C', 'D', 'E'].forEach((x) => s.addTeam({ abbr: x, preTradeSalary: 100 }));
    expect(useTradeStore.getState().teams.length).toBe(4);
  });

  it('setSeason updates season', () => {
    useTradeStore.getState().setSeason('2026-27');
    expect(useTradeStore.getState().season).toBe('2026-27');
  });
});
