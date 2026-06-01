import { create } from 'zustand';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';

const MAX_TEAMS = 4; // v1 cap

interface TradeState {
  season: string;
  teams: TradeTeamInput[];
  assets: Record<string, TradeAsset>;
  setSeason: (s: string) => void;
  addTeam: (t: TradeTeamInput) => void;
  removeTeam: (abbr: string) => void;
  addAsset: (a: TradeAsset) => void;
  routeAsset: (id: string, toTeam: string) => void;
  reset: () => void;
}

export const useTradeStore = create<TradeState>((set) => ({
  season: '2025-26',
  teams: [],
  assets: {},
  setSeason: (season) => set({ season }),
  addTeam: (t) =>
    set((s) =>
      s.teams.length >= MAX_TEAMS || s.teams.some((x) => x.abbr === t.abbr) ? s : { teams: [...s.teams, t] },
    ),
  removeTeam: (abbr) =>
    set((s) => ({
      teams: s.teams.filter((t) => t.abbr !== abbr),
      assets: Object.fromEntries(Object.entries(s.assets).filter(([, a]) => a.fromTeam !== abbr && a.toTeam !== abbr)),
    })),
  addAsset: (a) => set((s) => ({ assets: { ...s.assets, [a.id]: a } })),
  routeAsset: (id, toTeam) => set((s) => ({ assets: { ...s.assets, [id]: { ...s.assets[id], toTeam } } })),
  reset: () => set({ season: '2025-26', teams: [], assets: {} }),
}));
