import { create } from 'zustand';
import type { TradeAsset, TradeTeamInput, TradeMethod } from '@/lib/cba/types';

const MAX_TEAMS = 5; // Fanspo parity

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
  teams: TradeTeamInput[];
  assets: Record<string, TradeAsset>;
  simulatedDate?: string; // ISO; drives date-aware eligibility
  tradeMethod: TradeMethod;
  compareIds: string[]; // asset ids selected for the player-comparison tray
  playerSort: PlayerSort; // how each team's roster cards are ordered
  setSeason: (s: string) => void;
  setPlayerSort: (m: PlayerSort) => void;
  addTeam: (t: TradeTeamInput) => void;
  removeTeam: (abbr: string) => void;
  addAsset: (a: TradeAsset) => void;
  removeAsset: (id: string) => void;
  routeAsset: (id: string, toTeam: string) => void;
  reorderAsset: (draggedId: string, targetId: string) => void;
  setAssetAmount: (id: string, amount: number) => void;
  setAssetSalary: (id: string, salary: number) => void;
  signFreeAgent: (teamAbbr: string, fa: FreeAgent, salary: number) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  setSimulatedDate: (d?: string) => void;
  setTradeMethod: (m: TradeMethod) => void;
  reset: () => void;
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

export const useTradeStore = create<TradeState>((set) => ({
  season: '2026-27',
  teams: [],
  assets: {},
  simulatedDate: undefined,
  tradeMethod: 'simultaneous',
  compareIds: [],
  playerSort: 'salary_desc',
  setSeason: (season) => set({ season }),
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
    set((s) => ({
      teams: s.teams.filter((t) => t.abbr !== abbr),
      assets: Object.fromEntries(Object.entries(s.assets).filter(([, a]) => a.fromTeam !== abbr && a.toTeam !== abbr)),
      compareIds: s.compareIds.filter((id) => s.assets[id] && s.assets[id].fromTeam !== abbr),
    })),
  addAsset: (a) =>
    set((s) => ({ assets: { ...s.assets, [a.id]: { order: Object.keys(s.assets).length, ...a } } })),
  removeAsset: (id) =>
    set((s) => {
      const asset = s.assets[id];
      const assets = { ...s.assets };
      delete assets[id];
      // A signed free agent carries real payroll; removing it must give that cap room back.
      const teams = asset?.signed ? bumpTeamSalary(s.teams, asset.fromTeam, -asset.salary) : s.teams;
      return { assets, teams, compareIds: s.compareIds.filter((c) => c !== id) };
    }),
  // Move an asset to a team's column. Append it to the bottom of that column's (toTeam, kind) order
  // sequence so display order stays a single consistent list the user can then rearrange.
  routeAsset: (id, toTeam) =>
    set((s) => {
      const asset = s.assets[id];
      if (!asset || asset.toTeam === toTeam) return s;
      const destOrders = Object.values(s.assets)
        .filter((a) => a.id !== id && a.toTeam === toTeam && a.kind === asset.kind)
        .map((a) => a.order ?? 0);
      const order = destOrders.length ? Math.max(...destOrders) + 1 : 0;
      return { assets: { ...s.assets, [id]: { ...asset, toTeam, order } } };
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
      return { assets };
    }),
  setAssetAmount: (id, amount) =>
    set((s) => ({ assets: { ...s.assets, [id]: { ...s.assets[id], amount, salary: 0 } } })),
  setAssetSalary: (id, salary) =>
    set((s) => {
      const asset = s.assets[id];
      if (!asset) return s;
      // Repricing a signed FA shifts the team's payroll by the delta.
      const teams = asset.signed ? bumpTeamSalary(s.teams, asset.fromTeam, salary - asset.salary) : s.teams;
      return { assets: { ...s.assets, [id]: { ...asset, salary } }, teams };
    }),
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
  reset: () =>
    set({ season: '2026-27', teams: [], assets: {}, simulatedDate: undefined, tradeMethod: 'simultaneous', compareIds: [], playerSort: 'salary_desc' }),
}));

export const MAX_TRADE_TEAMS = MAX_TEAMS;
export const MAX_COMPARE_PLAYERS = MAX_COMPARE;
