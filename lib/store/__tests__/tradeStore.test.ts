import { describe, it, expect, beforeEach } from 'vitest';
import { useTradeStore, comparePlayers, partializeTradeState, PERSIST_KEY } from '@/lib/store/tradeStore';

describe('tradeStore', () => {
  beforeEach(() => useTradeStore.getState().reset());

  it('adds teams, caps at 7, routes and removes assets', () => {
    const s = useTradeStore.getState();
    s.addTeam({ abbr: 'AAA', preTradeSalary: 120 });
    s.addTeam({ abbr: 'BBB', preTradeSalary: 120 });
    s.addAsset({ id: 'a1', kind: 'player', salary: 20, fromTeam: 'AAA', toTeam: 'AAA', label: 'A1' });
    s.routeAsset('a1', 'BBB');
    expect(useTradeStore.getState().assets['a1'].toTeam).toBe('BBB');
    s.removeAsset('a1');
    expect(useTradeStore.getState().assets['a1']).toBeUndefined();
    ['C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach((x) => s.addTeam({ abbr: x, preTradeSalary: 100 }));
    expect(useTradeStore.getState().teams.length).toBe(7);
  });

  it('setSeason updates season', () => {
    useTradeStore.getState().setSeason('2026-27');
    expect(useTradeStore.getState().season).toBe('2026-27');
  });

  it('edits exact whole-dollar cash without creating malformed assets or changing payroll', () => {
    const s = useTradeStore.getState();
    s.addTeam({ abbr: 'AAA', preTradeSalary: 120_000_000 });
    s.addAsset({ id: 'cash', kind: 'cash', salary: 0, amount: 1_000_000, fromTeam: 'AAA', toTeam: 'AAA', label: 'Cash' });
    s.setAssetAmount('cash', 1_234_567);
    expect(useTradeStore.getState().assets.cash.amount).toBe(1_234_567);
    for (const invalid of [NaN, Infinity, -1, 0.5, 2_000_000_001]) s.setAssetAmount('cash', invalid);
    s.setAssetAmount('missing', 1);
    expect(Object.keys(useTradeStore.getState().assets)).toEqual(['cash']);
    expect(useTradeStore.getState().assets.cash).toMatchObject({ amount: 1_234_567, salary: 0 });
    expect(useTradeStore.getState().teams[0].preTradeSalary).toBe(120_000_000);
    s.setAssetAmount('cash', 0);
    expect(useTradeStore.getState().assets.cash.amount).toBe(0);
  });

  it('removing a team returns incoming assets to their owners and preserves the other teams', () => {
    const s = useTradeStore.getState();
    ['AAA', 'BBB', 'CCC'].forEach((abbr) => s.addTeam({ abbr, preTradeSalary: 100 }));
    s.addAsset({ id: 'a1', kind: 'player', salary: 20, fromTeam: 'AAA', toTeam: 'CCC', label: 'Removed team player' });
    s.addAsset({ id: 'b0', kind: 'player', salary: 10, fromTeam: 'BBB', toTeam: 'BBB', label: 'Kept player', order: 3 });
    s.addAsset({ id: 'b1', kind: 'player', salary: 15, fromTeam: 'BBB', toTeam: 'AAA', label: 'Returning player', order: 2 });
    s.addAsset({ id: 'b2', kind: 'player', salary: 12, fromTeam: 'BBB', toTeam: 'AAA', label: 'Second returning player', order: 5 });
    s.addAsset({ id: 'bp', kind: 'pick', salary: 0, fromTeam: 'BBB', toTeam: 'AAA', label: 'Returning pick', order: 1 });
    s.addAsset({ id: 'c1', kind: 'player', salary: 8, fromTeam: 'CCC', toTeam: 'BBB', label: 'Unrelated move', order: 8 });
    useTradeStore.setState({ compareIds: ['a1', 'b1', 'c1', 'missing'] });
    const untouched = useTradeStore.getState().assets.c1;

    s.removeTeam('AAA');

    const state = useTradeStore.getState();
    expect(state.teams).toEqual([{ abbr: 'BBB', preTradeSalary: 100 }, { abbr: 'CCC', preTradeSalary: 100 }]);
    expect(Object.keys(state.assets).sort()).toEqual(['b0', 'b1', 'b2', 'bp', 'c1']);
    expect(state.assets.b1.toTeam).toBe('BBB');
    expect(state.assets.b2.toTeam).toBe('BBB');
    expect(state.assets.bp.toTeam).toBe('BBB');
    expect(state.assets.c1).toBe(untouched);
    expect(state.compareIds).toEqual(['b1', 'c1']);
    const playerOrder = Object.values(state.assets)
      .filter((a) => a.toTeam === 'BBB' && a.kind === 'player')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    expect(playerOrder.map((a) => a.id)).toEqual(['b0', 'c1', 'b1', 'b2']);
    expect(new Set(playerOrder.map((a) => a.order)).size).toBe(playerOrder.length);
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

describe('tradeStore persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    useTradeStore.getState().reset();
  });

  it('partialize persists only working state - no actions, no ephemeral selection', () => {
    const persisted = partializeTradeState(useTradeStore.getState());
    expect(Object.keys(persisted).sort()).toEqual(
        ['assets', 'playerSort', 'season', 'simulatedDate', 'teams', 'tradeMethod','dataVersion'].sort(),
    );
    // never serialize functions or the transient compare tray
    expect(Object.values(persisted).some((v) => typeof v === 'function')).toBe(false);
    expect('compareIds' in persisted).toBe(false);
  });

  it('rehydrate restores teams and assets from a localStorage snapshot', async () => {
    const snapshot = {
      state: {
        season: '2026-27',
        teams: [{ abbr: 'AAA', preTradeSalary: 100 }],
        assets: { a1: { id: 'a1', kind: 'player', salary: 10, fromTeam: 'AAA', toTeam: 'AAA', label: 'A1' } },
        simulatedDate: undefined,
        tradeMethod: 'simultaneous',
        playerSort: 'salary_desc',
      },
      version: 1,
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot));
    await useTradeStore.persist.rehydrate();
    expect(useTradeStore.getState().teams.map((t) => t.abbr)).toContain('AAA');
    expect(useTradeStore.getState().assets['a1']?.label).toBe('A1');
  });
});
