import { beforeEach, describe, expect, it } from 'vitest';
import { getUndoLabel, partializeTradeState, useTradeStore, type PersistedTradeState } from '../tradeStore';
import { previewFix, workingStateKey } from '../reviewedFix';
import { selectValidation } from '../selectValidation';
import type { FixAction } from '@/lib/cba/autofix';

export const fixFixture = (): PersistedTradeState => ({
  season: '2026-27', dataVersion: 'snapshot-test', simulatedDate: '2026-11-02', tradeMethod: 'simultaneous', playerSort: 'salary_desc',
  teams: [{ abbr: 'AAA', preTradeSalary: 180_000_000 }, { abbr: 'BBB', preTradeSalary: 150_000_000 }],
  assets: {
    a: { id: 'a', label: 'Outgoing player', kind: 'player', salary: 20_000_000, fromTeam: 'AAA', toTeam: 'BBB', order: 0 },
    b: { id: 'b', label: 'Incoming player', kind: 'player', salary: 20_000_000, fromTeam: 'BBB', toTeam: 'AAA', order: 0, noTradeClause: true },
    c: { id: 'c', label: 'Target player', kind: 'player', salary: 60_000_000, fromTeam: 'BBB', toTeam: 'AAA', order: 1 },
    d: { id: 'd', label: 'Another player', kind: 'player', salary: 5_000_000, fromTeam: 'BBB', toTeam: 'AAA', order: 2 },
  },
});

const actions: FixAction[] = [
  { assetId: 'c', toTeam: 'BBB', label: 'Keep Target player' },
  { assetId: 'd', toTeam: 'BBB', label: 'Keep Another player' },
];

beforeEach(() => { useTradeStore.setState({ ...fixFixture(), undoEntry: null, compareIds: [] }); });

describe('reviewed adjustments', () => {
  it('previews exact lost acquisitions and reruns the whole validator without mutating the board', () => {
    const before = partializeTradeState(useTradeStore.getState());
    expect(selectValidation(before).valid).toBe(false);
    const preview = previewFix(before, actions)!;
    expect(preview.changes).toContainEqual({ assetId: 'c', label: 'Target player', origin: 'BBB', previousDestination: 'AAA', destination: 'BBB', removed: true });
    expect(preview.validation.valid).toBe(true);
    expect(preview.validation.findings?.some(finding => /consent|approve|no.trade/i.test(finding.message))).toBe(true);
    expect(useTradeStore.getState().assets.c.toTeam).toBe('AAA');
  });

  it('applies a reviewed multi-asset plan atomically and undoes it with assumptions and ordering intact', () => {
    const before = partializeTradeState(useTradeStore.getState());
    const transitions: string[][] = [];
    const unsubscribe = useTradeStore.subscribe(state => transitions.push([state.assets.c.toTeam, state.assets.d.toTeam]));
    expect(useTradeStore.getState().applyReviewedFix(actions, workingStateKey(before))).toBe(true);
    unsubscribe();
    expect(transitions).toEqual([['BBB', 'BBB']]);
    expect(selectValidation(useTradeStore.getState()).valid).toBe(true);
    expect(useTradeStore.getState().simulatedDate).toBe(before.simulatedDate);
    expect(useTradeStore.getState().assets.b.noTradeClause).toBe(true);
    expect(getUndoLabel(useTradeStore.getState())).toBe('Applied 2 suggested changes');
    expect(useTradeStore.getState().undoLastChange()).toBe(true);
    expect(partializeTradeState(useTradeStore.getState())).toEqual(before);
    expect(selectValidation(useTradeStore.getState()).valid).toBe(false);
  });

  it.each(['date', 'salary', 'team history', 'data version'] as const)('rejects a stale plan after a %s change', change => {
    const key = workingStateKey(useTradeStore.getState());
    const store = useTradeStore.getState();
    if (change === 'date') store.setSimulatedDate('2026-12-15');
    if (change === 'salary') store.setAssetSalary('c', 61_000_000);
    if (change === 'team history') store.setTeamFlags('AAA', { priorSecondApronSeasons: 1 });
    if (change === 'data version') store.setDataVersion('new-snapshot');
    const edited = partializeTradeState(useTradeStore.getState());
    expect(useTradeStore.getState().applyReviewedFix(actions, key)).toBe(false);
    expect(partializeTradeState(useTradeStore.getState())).toEqual(edited);
  });

  it('refuses incomplete, malformed, or still-failing adjustments', () => {
    const key = workingStateKey(useTradeStore.getState());
    expect(useTradeStore.getState().applyReviewedFix([actions[1]], key)).toBe(false);
    expect(previewFix(useTradeStore.getState(), [{ assetId: 'missing', toTeam: 'AAA', label: '' }])).toBeNull();
    expect(previewFix(useTradeStore.getState(), [actions[0], actions[0]])).toBeNull();
    expect(previewFix(useTradeStore.getState(), [{ ...actions[0], toTeam: 'CCC' }])).toBeNull();
    expect(previewFix(useTradeStore.getState(), Object.values(useTradeStore.getState().assets).map(asset => ({ assetId: asset.id, toTeam: asset.fromTeam, label: '' })))).toBeNull();
    expect(useTradeStore.getState().assets.c.toTeam).toBe('AAA');
  });

  it('identifies the exact cash leg being removed, including amounts from historical proposals', () => {
    const state = fixFixture();
    state.assets.cash = { id: 'cash', label: 'Cash', kind: 'cash', salary: 0,
      amount: 1_234_567.89, fromTeam: 'AAA', toTeam: 'BBB' };
    const preview = previewFix(state, [...actions, { assetId: 'cash', toTeam: 'AAA', label: 'Keep cash' }])!;
    expect(preview.changes.at(-1)).toMatchObject({ label: 'Cash ($1,234,567.89)', origin: 'AAA', previousDestination: 'BBB', removed: true });
    expect(preview.validation.valid).toBe(true);
    expect(state.assets.cash.toTeam).toBe('BBB');
  });
});

describe('working proposal undo', () => {
  it('restores a routed player and drag placement together while retaining comparison selections', () => {
    const before = partializeTradeState(useTradeStore.getState());
    useTradeStore.getState().routeAsset('c', 'BBB', 'a');
    useTradeStore.getState().toggleCompare('b');
    expect(Object.values(useTradeStore.getState().assets).filter(asset => asset.toTeam === 'BBB').sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).map(asset => asset.id)).toEqual(['c', 'a']);
    expect(useTradeStore.getState().undoLastChange()).toBe(true);
    expect(partializeTradeState(useTradeStore.getState())).toEqual(before);
    expect(useTradeStore.getState().compareIds).toEqual(['b']);
  });

  it('restores removed cash, a team, and a reset proposal using their respective last action', () => {
    useTradeStore.getState().addAsset({ id: 'cash', label: 'Cash', kind: 'cash', amount: 1234567, salary: 0, fromTeam: 'AAA', toTeam: 'BBB' });
    const before = partializeTradeState(useTradeStore.getState());
    useTradeStore.getState().removeAsset('cash');
    expect(useTradeStore.getState().undoLastChange()).toBe(true);
    expect(partializeTradeState(useTradeStore.getState())).toEqual(before);
    useTradeStore.getState().removeTeam('BBB');
    expect(useTradeStore.getState().undoLastChange()).toBe(true);
    expect(partializeTradeState(useTradeStore.getState())).toEqual(before);
    useTradeStore.getState().reset();
    expect(useTradeStore.getState().undoLastChange()).toBe(true);
    expect(partializeTradeState(useTradeStore.getState())).toEqual(before);
  });

  it('never restores an old snapshot over a later contract edit or loaded proposal', () => {
    useTradeStore.getState().routeAsset('c', 'BBB');
    useTradeStore.getState().setAssetSalary('b', 22_000_000);
    expect(getUndoLabel(useTradeStore.getState())).toBeNull();
    expect(useTradeStore.getState().undoLastChange()).toBe(false);
    expect(useTradeStore.getState().assets.b.salary).toBe(22_000_000);
    useTradeStore.getState().routeAsset('d', 'BBB');
    useTradeStore.setState({ dataVersion: 'loaded-other-proposal' });
    expect(useTradeStore.getState().undoLastChange()).toBe(false);
  });

  it('initializes a new roster year atomically and restores the complete previous scenario with Undo', () => {
    const before = partializeTradeState(useTradeStore.getState());
    const transitions: PersistedTradeState[] = [];
    const unsubscribe = useTradeStore.subscribe(state => transitions.push(partializeTradeState(state)));
    useTradeStore.getState().reset({ season: '2025-26', dataVersion: 'historical-dataset', simulatedDate: '2026-01-15' });
    unsubscribe();
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({ season: '2025-26', dataVersion: 'historical-dataset', simulatedDate: '2026-01-15', teams: [], assets: {} });
    expect(getUndoLabel(useTradeStore.getState())).toBe('Started a new trade');
    expect(useTradeStore.getState().undoLastChange()).toBe(true);
    expect(partializeTradeState(useTradeStore.getState())).toEqual(before);
  });

  it('keeps all recovery state out of persisted and shared payloads', () => {
    useTradeStore.getState().routeAsset('c', 'BBB');
    const state = partializeTradeState(useTradeStore.getState());
    expect(getUndoLabel(useTradeStore.getState())).not.toBeNull();
    expect(state).not.toHaveProperty('undoEntry');
    expect(state).not.toHaveProperty('undoLastChange');
    expect(state).not.toHaveProperty('applyReviewedFix');
  });
});
