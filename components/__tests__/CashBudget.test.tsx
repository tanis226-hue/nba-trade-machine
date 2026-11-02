import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CashBudget } from '../CashBudget';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { CashUsage, TradeAsset } from '@/lib/cba/types';

function cash(id: string, fromTeam = 'BOS', toTeam = 'MIL', amount = 1_000_000): TradeAsset {
  return { id, kind: 'cash', label: 'Cash', salary: 0, amount, fromTeam, toTeam };
}
function seed(assets: TradeAsset[], cashUsage?: CashUsage, season = '2026-27') {
  useTradeStore.setState({
    season,
    teams: [{ abbr: 'BOS', preTradeSalary: 150_000_000, cashUsage }],
    assets: Object.fromEntries(assets.map(asset => [asset.id, asset])),
  });
}
function input(direction: 'sent' | 'received') {
  return screen.getByLabelText(`BOS cash already ${direction}`) as HTMLInputElement;
}
function allowance(direction: 'sent' | 'received') {
  return within(input(direction).parentElement!);
}
beforeEach(() => { useTradeStore.getState().reset(); localStorage.clear(); });
afterEach(() => { cleanup(); useTradeStore.getState().reset(); });

describe('cash allowance assumptions', () => {
  it('appears only for a selected team touched by cash, including parked cash', () => {
    seed([cash('elsewhere', 'MIL', 'DAL')]);
    const { container, rerender } = render(<CashBudget abbr="BOS"/>);
    expect(container.textContent).toBe('');
    seed([cash('parked', 'BOS', 'BOS')]);
    rerender(<CashBudget abbr="BOS"/>);
    expect(screen.getByText('Cash allowances · 2026-27')).toBeTruthy();
    expect(allowance('sent').getByText('This deal: $0 · Remaining allowance unknown')).toBeTruthy();
    rerender(<CashBudget abbr="NYK"/>);
    expect(container.textContent).toBe('');
  });

  it('distinguishes an unknown prior total from an explicit zero and clearing it again', () => {
    seed([cash('out')]);
    render(<CashBudget abbr="BOS"/>);
    expect(input('sent').value).toBe('');
    expect(input('received').value).toBe('');
    expect(allowance('sent').getByText('This deal: $1,000,000 · Remaining allowance unknown')).toBeTruthy();

    fireEvent.change(input('sent'), { target: { value: '0' } });
    expect(useTradeStore.getState().teams[0].cashUsage).toEqual({ season: '2026-27', sent: 0 });
    expect(allowance('sent').getByText('This deal: $1,000,000 · $7,495,491 left after deal')).toBeTruthy();
    expect(allowance('received').getByText('This deal: $0 · Remaining allowance unknown')).toBeTruthy();

    fireEvent.change(input('sent'), { target: { value: '' } });
    expect(useTradeStore.getState().teams[0].cashUsage?.sent).toBeUndefined();
    expect(allowance('sent').getByText('This deal: $1,000,000 · Remaining allowance unknown')).toBeTruthy();
  });

  it('uses gross routed cash in each independent direction and excludes parked assets', () => {
    const outgoing = cash('out', 'BOS', 'MIL', 3_000_000);
    const incoming = cash('in', 'DAL', 'BOS', 2_000_000);
    const parked = cash('parked', 'BOS', 'BOS', 5_000_000);
    const player: TradeAsset = { id: 'player', kind: 'player', label: 'Player', salary: 20_000_000, fromTeam: 'BOS', toTeam: 'MIL' };
    seed([outgoing, incoming, parked, cash('unrelated', 'MIL', 'DAL', 7_000_000), player], { season: '2026-27', sent: 2_000_000, received: 1_000_000 });
    render(<CashBudget abbr="BOS"/>);
    expect(allowance('sent').getByText('This deal: $3,000,000 · $3,495,491 left after deal')).toBeTruthy();
    expect(allowance('received').getByText('This deal: $2,000,000 · $5,495,491 left after deal')).toBeTruthy();

    fireEvent.change(input('sent'), { target: { value: '6000000' } });
    expect(allowance('sent').getByText('This deal: $3,000,000 · $504,509 over allowance')).toBeTruthy();
    expect(input('received').value).toBe('1000000');
    expect(useTradeStore.getState().teams[0].cashUsage).toEqual({ season: '2026-27', sent: 6_000_000, received: 1_000_000 });

    fireEvent.change(input('received'), { target: { value: '2500000' } });
    expect(useTradeStore.getState().teams[0].cashUsage).toEqual({ season: '2026-27', sent: 6_000_000, received: 2_500_000 });
    expect(allowance('received').getByText('This deal: $2,000,000 · $3,995,491 left after deal')).toBeTruthy();
  });

  it('discards the prior cap year in both directions before editing a new year assumption', () => {
    seed([cash('out')], { season: '2025-26', sent: 7_000_000, received: 5_000_000 });
    render(<CashBudget abbr="BOS"/>);
    expect(input('sent').value).toBe('');
    expect(input('received').value).toBe('');
    expect(allowance('sent').getByText('This deal: $1,000,000 · Remaining allowance unknown')).toBeTruthy();
    fireEvent.change(input('sent'), { target: { value: '0' } });
    expect(useTradeStore.getState().teams[0].cashUsage).toEqual({ season: '2026-27', sent: 0 });
    expect(input('received').value).toBe('');
  });

  it('uses the historical cap year allowance for a historical proposal', () => {
    seed([cash('out')], { season: '2025-26', sent: 0 }, '2025-26');
    render(<CashBudget abbr="BOS"/>);
    expect(screen.getByText('Cash allowances · 2025-26')).toBeTruthy();
    expect(allowance('sent').getByText('This deal: $1,000,000 · $6,964,320 left after deal')).toBeTruthy();
  });

  it.each(['-1', '0.5', '2000000001'])('rejects invalid prior cash total %s without changing the other direction', value => {
    seed([cash('out')], { season: '2026-27', sent: 100, received: 200 });
    render(<CashBudget abbr="BOS"/>);
    fireEvent.change(input('sent'), { target: { value } });
    expect(input('sent').value).toBe('100');
    expect(useTradeStore.getState().teams[0].cashUsage).toEqual({ season: '2026-27', sent: 100, received: 200 });
  });
});
