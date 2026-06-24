import { describe, it, expect, beforeEach } from 'vitest';
import { useTradeStore, comparePlayers } from '@/lib/store/tradeStore';

describe('tradeStore', () => {
  beforeEach(() => useTradeStore.getState().reset());

  it('adds teams, caps at 5, routes and removes assets', () => {
    const s = useTradeStore.getState();
    s.addTeam({ abbr: 'AAA', preTradeSalary: 120 });
    s.addTeam({ abbr: 'BBB', preTradeSalary: 120 });
    s.addAsset({ id: 'a1', kind: 'player', salary: 20, fromTeam: 'AAA', toTeam: 'AAA', label: 'A1' });
    s.routeAsset('a1', 'BBB');
    expect(useTradeStore.getState().assets['a1'].toTeam).toBe('BBB');
    s.removeAsset('a1');
    expect(useTradeStore.getState().assets['a1']).toBeUndefined();
    ['C', 'D', 'E', 'F'].forEach((x) => s.addTeam({ abbr: x, preTradeSalary: 100 }));
    expect(useTradeStore.getState().teams.length).toBe(5);
  });

  it('setSeason updates season', () => {
    useTradeStore.getState().setSeason('2026-27');
    expect(useTradeStore.getState().season).toBe('2026-27');
  });

  it('reorders with direction-correct arrayMove semantics (down lands after the target)', () => {
    const s = useTradeStore.getState();
    s.addTeam({ abbr: 'AAA', preTradeSalary: 120 });
    ['p1', 'p2', 'p3'].forEach((id) =>
      s.addAsset({ id, kind: 'player', salary: 10, fromTeam: 'AAA', toTeam: 'AAA', label: id }),
    );
    const order = () =>
      Object.values(useTradeStore.getState().assets)
        .filter((a) => a.fromTeam === 'AAA' && a.kind === 'player')
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((a) => a.id);
    expect(order()).toEqual(['p1', 'p2', 'p3']);
    // drag p1 DOWN onto p3 → lands AFTER p3 (the off-by-one fix; was landing before)
    useTradeStore.getState().reorderAsset('p1', 'p3');
    expect(order()).toEqual(['p2', 'p3', 'p1']);
    // drag p1 (now last) UP onto p2 → lands at p2's slot
    useTradeStore.getState().reorderAsset('p1', 'p2');
    expect(order()).toEqual(['p1', 'p2', 'p3']);
    // adjacent down: drag p1 onto p2 → p1 lands just after p2
    useTradeStore.getState().reorderAsset('p1', 'p2');
    expect(order()).toEqual(['p2', 'p1', 'p3']);
  });

  it('reorders an acquired card within its new team (ordering keyed by display column)', () => {
    const s = useTradeStore.getState();
    s.addTeam({ abbr: 'AAA', preTradeSalary: 100 });
    s.addTeam({ abbr: 'BBB', preTradeSalary: 100 });
    s.addAsset({ id: 'b1', kind: 'player', salary: 10, fromTeam: 'BBB', toTeam: 'BBB', label: 'b1' });
    s.addAsset({ id: 'b2', kind: 'player', salary: 10, fromTeam: 'BBB', toTeam: 'BBB', label: 'b2' });
    s.addAsset({ id: 'a1', kind: 'player', salary: 10, fromTeam: 'AAA', toTeam: 'AAA', label: 'a1' });
    const colOrder = (team: string) =>
      Object.values(useTradeStore.getState().assets)
        .filter((a) => a.toTeam === team && a.kind === 'player')
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((a) => a.id);
    useTradeStore.getState().routeAsset('a1', 'BBB'); // acquire a1 into BBB → appended at bottom
    expect(colOrder('BBB')).toEqual(['b1', 'b2', 'a1']);
    // drag the acquired card up onto b1 → it rearranges within BBB even though it came from AAA
    useTradeStore.getState().reorderAsset('a1', 'b1');
    expect(colOrder('BBB')).toEqual(['a1', 'b1', 'b2']);
  });

  it('comparePlayers + setPlayerSort order rosters by salary and position', () => {
    expect([{ salary: 5 }, { salary: 30 }, { salary: 15 }].sort(comparePlayers('salary_desc')).map((p) => p.salary)).toEqual([30, 15, 5]);
    expect([{ salary: 5 }, { salary: 30 }, { salary: 15 }].sort(comparePlayers('salary_asc')).map((p) => p.salary)).toEqual([5, 15, 30]);
    const s = useTradeStore.getState();
    s.addTeam({ abbr: 'AAA', preTradeSalary: 100 });
    s.addAsset({ id: 'lo', kind: 'player', salary: 5_000_000, fromTeam: 'AAA', toTeam: 'AAA', label: 'lo', position: 'C' });
    s.addAsset({ id: 'hi', kind: 'player', salary: 30_000_000, fromTeam: 'AAA', toTeam: 'AAA', label: 'hi', position: 'G' });
    s.addAsset({ id: 'mid', kind: 'player', salary: 15_000_000, fromTeam: 'AAA', toTeam: 'AAA', label: 'mid', position: 'F' });
    const order = () =>
      Object.values(useTradeStore.getState().assets)
        .filter((a) => a.fromTeam === 'AAA' && a.kind === 'player')
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((a) => a.id);
    useTradeStore.getState().setPlayerSort('salary_desc');
    expect(order()).toEqual(['hi', 'mid', 'lo']);
    useTradeStore.getState().setPlayerSort('salary_asc');
    expect(order()).toEqual(['lo', 'mid', 'hi']);
    useTradeStore.getState().setPlayerSort('position'); // G < F < C
    expect(order()).toEqual(['hi', 'mid', 'lo']);
  });

  it('does not reorder across different teams (cross-team is a route, not a reorder)', () => {
    const s = useTradeStore.getState();
    s.addTeam({ abbr: 'AAA', preTradeSalary: 120 });
    s.addTeam({ abbr: 'BBB', preTradeSalary: 120 });
    s.addAsset({ id: 'a1', kind: 'player', salary: 10, fromTeam: 'AAA', toTeam: 'AAA', label: 'a1' });
    s.addAsset({ id: 'b1', kind: 'player', salary: 10, fromTeam: 'BBB', toTeam: 'BBB', label: 'b1' });
    const before = useTradeStore.getState().assets['a1'].order;
    useTradeStore.getState().reorderAsset('a1', 'b1'); // different group → no-op
    expect(useTradeStore.getState().assets['a1'].order).toBe(before);
  });
});
