import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { TradeAsset, TradeTeamInput, TradeMethod } from '@/lib/cba/types';
import type { FixAction } from '@/lib/cba/autofix';
import { previewFix, workingStateKey } from './reviewedFix';

const MAX_TEAMS = 7; // up to 7-team trades (beats Fanspo's 5)

export type PlayerSort = 'salary_desc' | 'salary_asc' | 'position';

// Group guards < forwards < centers; unknown positions sink to the bottom.
const POS_RANK: Record<string, number> = { PG: 0, SG: 0, G: 0, SF: 1, PF: 1, F: 1, C: 2 };
function posRank(p?: string | null): number {
  if (!p) return 8;
  const k = p.trim().toUpperCase();
  return POS_RANK[k] ?? POS_RANK[k[0]] ?? 7;
}

/** Comparator for a team's player cards under the chosen sort mode (salary ties broken high→low). */
export function comparePlayers(mode: PlayerSort) {
  return (a: Pick<TradeAsset, 'salary' | 'position'>, b: Pick<TradeAsset, 'salary' | 'position'>) => {
    if (mode === 'position') return posRank(a.position) - posRank(b.position) || b.salary - a.salary;
    if (mode === 'salary_asc') return a.salary - b.salary;
    return b.salary - a.salary; // salary_desc (default)
  };
}

export interface FreeAgent {
  playerId: string;
  name: string;
  priorTeamId?: string | null; // the team that holds this player's cap hold until renounced
  priorSalary: number; // last (2025-26) cap hit, used as the default signing number
  restricted: boolean; // RFA (qualifying-offer / match rights) vs UFA
  value?: number;
  pts?: number;
  reb?: number;
  ast?: number;
  age?: number | null;
  position?: string | null;
  height?: string | null;
  weight?: number | null;
  jersey?: string | null;
  headshot?: string;
}

interface TradeState {
  season: string;
  dataVersion?:string;
  setDataVersion:(version:string)=>void;
  teams: TradeTeamInput[];
  assets: Record<string, TradeAsset>;
  simulatedDate?: string; // ISO; drives date-aware eligibility
  tradeMethod: TradeMethod;
  compareIds: string[]; // asset ids selected for the player-comparison tray
  playerSort: PlayerSort; // how each team's roster cards are ordered
  undoEntry: UndoEntry | null;
  undoLastChange: () => boolean;
  applyReviewedFix: (actions: FixAction[], expectedKey: string) => boolean;
  setSeason: (s: string) => void;
  setPlayerSort: (m: PlayerSort) => void;
  addTeam: (t: TradeTeamInput) => void;
  removeTeam: (abbr: string) => void;
  addAsset: (a: TradeAsset) => void;
  removeAsset: (id: string) => void;
  routeAsset: (id: string, toTeam: string, targetId?: string) => void;
  reorderAsset: (draggedId: string, targetId: string) => void;
  setAssetAmount: (id: string, amount: number) => void;
  setAssetSalary: (id: string, salary: number) => void;
  setAssetFlags: (id: string, flags: Partial<TradeAsset>) => void;
  setTeamFlags: (abbr: string, flags: Partial<TradeTeamInput>) => void;
  signFreeAgent: (teamAbbr: string, fa: FreeAgent, salary: number) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  setSimulatedDate: (d?: string) => void;
  setTradeMethod: (m: TradeMethod) => void;
  reset: (context?: { season: string; dataVersion?: string; simulatedDate?: string }) => void;
}

const MAX_COMPARE = 4;

// Adjust a team's cap- and apron-basis salary by a delta (used when a signed free
// agent is added, repriced, or removed so the cap sheet stays truthful).
function bumpTeamSalary(teams: TradeTeamInput[], abbr: string, delta: number): TradeTeamInput[] {
  return teams.map((t) =>
    t.abbr === abbr
      ? { ...t, preTradeSalary: t.preTradeSalary + delta, apronSalary: (t.apronSalary ?? t.preTradeSalary) + delta }
      : t,
  );
}

// localStorage snapshot of the working board so a refresh (or client navigation) never wipes a
// trade in progress. Bump the version suffix when the persisted shape changes incompatibly.
export const PERSIST_KEY = 'trade-machine:board:v1';

// Only the meaningful working state is persisted. Actions are never serialized, and `compareIds`
// (the transient player-comparison tray) is intentionally dropped so a reload starts it empty.
export type PersistedTradeState = Pick<
  TradeState,
  'season' | 'teams' | 'assets' | 'simulatedDate' | 'tradeMethod' | 'playerSort' | 'dataVersion'
>;

export function partializeTradeState(s: TradeState): PersistedTradeState {
  return {
    season: s.season,
    dataVersion:s.dataVersion,
    teams: s.teams,
    assets: s.assets,
    simulatedDate: s.simulatedDate,
    tradeMethod: s.tradeMethod,
    playerSort: s.playerSort,
  };
}

interface UndoEntry {
  label: string;
  before: PersistedTradeState;
  afterKey: string;
}

/** One recoverable action, scoped to the exact state it produced. Never restores over later edits. */
function rememberChange(state: TradeState, patch: Partial<TradeState>, label: string): Partial<TradeState> {
  const before = partializeTradeState(state);
  const afterKey = workingStateKey({ ...state, ...patch });
  if (workingStateKey(before) === afterKey) return patch;
  return { ...patch, undoEntry: { label, before, afterKey } };
}

export function getUndoLabel(state: TradeState): string | null {
  return state.undoEntry?.afterKey === workingStateKey(state) ? state.undoEntry.label : null;
}

// On the server there is no localStorage; hand persist a no-op so module load never throws.
const noopStorage: StateStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const boardStorage = createJSONStorage<PersistedTradeState>(() =>
  typeof window !== 'undefined' ? window.localStorage : noopStorage,
);

export const useTradeStore = create<TradeState>()(
  persist(
    (set) => ({
  season: '2026-27',
  dataVersion:undefined,
  setDataVersion:(dataVersion)=>set({dataVersion}),
  teams: [],
  assets: {},
  simulatedDate: undefined,
  tradeMethod: 'simultaneous',
  compareIds: [],
  playerSort: 'salary_desc',
  undoEntry: null,
  undoLastChange: () => {
    let restored = false;
    set(state => {
      const entry = state.undoEntry;
      if (!entry || entry.afterKey !== workingStateKey(state)) return { undoEntry: null };
      restored = true;
      return { ...entry.before, undoEntry: null, compareIds: state.compareIds.filter(id => entry.before.assets[id]) };
    });
    return restored;
  },
  applyReviewedFix: (actions, expectedKey) => {
    let applied = false;
    set(state => {
      if (workingStateKey(state) !== expectedKey) return state;
      const preview = previewFix(state, actions);
      if (!preview || !preview.validation.valid) return state;
      applied = true;
      return rememberChange(state, { assets: preview.assets }, `Applied ${preview.changes.length} suggested ${preview.changes.length === 1 ? 'change' : 'changes'}`);
    });
    return applied;
  },
  setSeason: (season) => set(s=>s.season===season?s:{season,teams:[],assets:{},simulatedDate:undefined,dataVersion:undefined,compareIds:[]}),
  // Re-order each roster column's player cards by the chosen mode. Grouped by the column the cards are
  // displayed in (toTeam) so a team's kept + acquired players sort together as one roster.
  setPlayerSort: (mode) =>
    set((s) => {
      const assets = { ...s.assets };
      const players = Object.values(assets).filter((a) => a.kind === 'player');
      const cols = [...new Set(players.map((a) => a.toTeam))];
      for (const col of cols) {
        players
          .filter((a) => a.toTeam === col)
          .sort(comparePlayers(mode))
          .forEach((a, i) => (assets[a.id] = { ...assets[a.id], order: i }));
      }
      return { playerSort: mode, assets };
    }),
  addTeam: (t) =>
    set((s) =>
      s.teams.length >= MAX_TEAMS || s.teams.some((x) => x.abbr === t.abbr) ? s : { teams: [...s.teams, t] },
    ),
  removeTeam: (abbr) =>
    set((s) => {
      // Cancel the removed team's legs without deleting assets another team owns.
      const assets = Object.fromEntries(Object.entries(s.assets).filter(([, a]) => a.fromTeam !== abbr));
      const nextOrder = new Map<string, number>();
      for (const asset of Object.values(assets)) {
        if (asset.toTeam === abbr) continue;
        const group = `${asset.toTeam}:${asset.kind}`;
        nextOrder.set(group, Math.max(nextOrder.get(group) ?? 0, (asset.order ?? 0) + 1));
      }
      for (const asset of Object.values(assets).filter((a) => a.toTeam === abbr).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
        const group = `${asset.fromTeam}:${asset.kind}`;
        const order = nextOrder.get(group) ?? 0;
        assets[asset.id] = { ...asset, toTeam: asset.fromTeam, order };
        nextOrder.set(group, order + 1);
      }
      return rememberChange(s, {
        teams: s.teams.filter((t) => t.abbr !== abbr),
        assets,
        compareIds: s.compareIds.filter((id) => assets[id]),
      }, `Removed ${abbr} and its moves`);
    }),
  addAsset: (a) =>
    set((s) => {
      const patch = { assets: { ...s.assets, [a.id]: { order: Object.keys(s.assets).length, ...a } } };
      return a.kind === 'player' ? patch : rememberChange(s, patch, `Added ${a.label} to ${a.toTeam}`);
    }),
  removeAsset: (id) =>
    set((s) => {
      const asset = s.assets[id];
      const assets = { ...s.assets };
      delete assets[id];
      // A signed free agent carries real payroll; removing it must give that cap room back.
      const teams = asset?.signed ? bumpTeamSalary(s.teams, asset.fromTeam, -asset.salary) : s.teams;
      return rememberChange(s, { assets, teams, compareIds: s.compareIds.filter((c) => c !== id) }, `Removed ${asset?.label ?? 'asset'}`);
    }),
  // Move an asset to a team's column. Append it to the bottom of that column's (toTeam, kind) order
  // sequence so display order stays a single consistent list the user can then rearrange.
  routeAsset: (id, toTeam, targetId) =>
    set((s) => {
      const asset = s.assets[id];
      if (!asset || asset.toTeam === toTeam || !s.teams.some(team => team.abbr === toTeam)) return s;
      const destOrders = Object.values(s.assets)
        .filter((a) => a.id !== id && a.toTeam === toTeam && a.kind === asset.kind)
        .map((a) => a.order ?? 0);
      const order = destOrders.length ? Math.max(...destOrders) + 1 : 0;
      const assets = { ...s.assets, [id]: { ...asset, toTeam, order } };
      const target = targetId ? assets[targetId] : undefined;
      if (target && target.id !== id && target.toTeam === toTeam && target.kind === asset.kind) {
        const group = Object.values(assets).filter(a => a.toTeam === toTeam && a.kind === asset.kind && a.id !== id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(a => a.id);
        group.splice(group.indexOf(target.id), 0, id);
        group.forEach((assetId, i) => { assets[assetId] = { ...assets[assetId], order: i }; });
      }
      return rememberChange(s, { assets }, `${toTeam === asset.fromTeam ? 'Returned' : 'Moved'} ${asset.label} to ${toTeam}`);
    }),
  // Move the dragged asset to the target's slot within the column it is DISPLAYED in (toTeam) + kind
  // group, then renumber the group. Keying on toTeam (not origin) lets cards acquired from other teams
  // be rearranged within their new roster. Uses dnd-kit arrayMove semantics (remove from old index,
  // insert at the target index) so a downward drop lands AFTER the target, matching the live preview.
  // Cross-column moves go through routeAsset instead.
  reorderAsset: (draggedId, targetId) =>
    set((s) => {
      const dragged = s.assets[draggedId];
      const target = s.assets[targetId];
      if (!dragged || !target || draggedId === targetId) return s;
      const groupIds = Object.values(s.assets)
        .filter((a) => a.toTeam === dragged.toTeam && a.kind === dragged.kind)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((a) => a.id);
      const oldIndex = groupIds.indexOf(draggedId);
      const newIndex = groupIds.indexOf(targetId);
      if (oldIndex === -1 || newIndex === -1) return s; // target is in a different column → not a reorder
      groupIds.splice(newIndex, 0, groupIds.splice(oldIndex, 1)[0]);
      const assets = { ...s.assets };
      groupIds.forEach((id, i) => (assets[id] = { ...assets[id], order: i }));
      return rememberChange(s, { assets }, `Reordered ${dragged.label}`);
    }),
  setAssetAmount: (id, amount) =>
    set((s) => s.assets[id] && Number.isSafeInteger(amount) && amount >= 0 && amount <= 2_000_000_000
      ? { assets: { ...s.assets, [id]: { ...s.assets[id], amount, salary: 0 } } }
      : s),
  setAssetSalary: (id, salary) =>
    set((s) => {
      const asset = s.assets[id];
      if (!asset) return s;
      // Repricing a signed FA shifts the team's payroll by the delta.
      const teams = asset.signed ? bumpTeamSalary(s.teams, asset.fromTeam, salary - asset.salary) : s.teams;
      return { assets: { ...s.assets, [id]: { ...asset, salary } }, teams };
    }),
  // Set CBA attribute flags on an asset (two-way, base-year comp, poison-pill, over-38, kicker, etc.).
  setAssetFlags: (id, flags) =>
    set((s) => (s.assets[id] ? { assets: { ...s.assets, [id]: { ...s.assets[id], ...flags } } } : s)),
  // Set per-team CBA inputs (tools used this deal, prior-apron/taxpayer history) that drive hard-cap/repeater rules.
  setTeamFlags: (abbr, flags) =>
    set((s) => ({ teams: s.teams.map((t) => (t.abbr === abbr ? { ...t, ...flags } : t)) })),
  signFreeAgent: (teamAbbr, fa, salary) =>
    set((s) => {
      const id = `${teamAbbr}-${fa.playerId}-fa`;
      if (s.assets[id]) return s; // already signed in this session
      const asset: TradeAsset = {
        id,
        kind: 'player',
        salary,
        origSalary: salary,
        fromTeam: teamAbbr,
        toTeam: teamAbbr,
        label: fa.name,
        signed: true,
        restrictedFa: fa.restricted,
        futureSalaries: [{ season: '2026-27', salary }],
        value: fa.value,
        pts: fa.pts,
        reb: fa.reb,
        ast: fa.ast,
        age: fa.age ?? undefined,
        position: fa.position ?? undefined,
        height: fa.height ?? undefined,
        weight: fa.weight ?? undefined,
        jersey: fa.jersey ?? undefined,
        headshot: fa.headshot,
        order: Object.keys(s.assets).length,
      };
      return {
        assets: { ...s.assets, [id]: asset },
        teams: bumpTeamSalary(s.teams, teamAbbr, salary),
      };
    }),
  toggleCompare: (id) =>
    set((s) => ({
      compareIds: s.compareIds.includes(id)
        ? s.compareIds.filter((c) => c !== id)
        : s.compareIds.length >= MAX_COMPARE
          ? s.compareIds
          : [...s.compareIds, id],
    })),
  clearCompare: () => set({ compareIds: [] }),
  setSimulatedDate: (simulatedDate) => set({ simulatedDate }),
  setTradeMethod: (tradeMethod) => set({ tradeMethod }),
  reset: (context) =>
    // Initialize the new scenario in the same transition, so Undo can recover the
    // previous proposal without a follow-up date/version setter invalidating it.
    set(state => rememberChange(state, { season: context?.season ?? '2026-27', teams: [], assets: {}, simulatedDate: context?.simulatedDate, dataVersion: context?.dataVersion, tradeMethod: 'simultaneous', compareIds: [], playerSort: 'salary_desc' }, 'Started a new trade')),
    }),
    {
      name: PERSIST_KEY,
      version: 1,
      storage: boardStorage,
      partialize: partializeTradeState,
      // Skip auto-hydration so the server-rendered empty store can't cause a React hydration
      // mismatch; TradeBoard calls persist.rehydrate() on mount and gates render on hasHydrated.
      skipHydration: true,
    },
  ),
);

export const MAX_TRADE_TEAMS = MAX_TEAMS;
export const MAX_COMPARE_PLAYERS = MAX_COMPARE;
