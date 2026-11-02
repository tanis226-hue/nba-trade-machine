import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { AssetRow } from '../AssetRow';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { TradeAsset } from '@/lib/cba/types';

const teams = [{ abbr: 'GSW', preTradeSalary: 190_000_000 }, { abbr: 'MIL', preTradeSalary: 180_000_000 }];
const initial: TradeAsset = { id: 'cash-test', kind: 'cash', label: 'Cash', salary: 0, amount: 13_500_000, fromTeam: 'GSW', toTeam: 'MIL' };
function ConnectedCashRow() {
  const asset = useTradeStore(state => state.assets[initial.id]);
  return <DndContext><SortableContext items={[initial.id]}>{asset && <AssetRow asset={asset} teams={teams}/>}</SortableContext></DndContext>;
}
beforeEach(() => {
  useTradeStore.getState().reset();
  localStorage.clear();
  useTradeStore.setState({ teams, assets: { [initial.id]: { ...initial } } });
});
afterEach(() => { cleanup(); useTradeStore.getState().reset(); });

describe('cash row exact whole-dollar editing', () => {
  it('retains the exact dollar amount without rounding or adding matching salary', () => {
    render(<ConnectedCashRow/>);
    const input = screen.getByRole('spinbutton', { name: 'Cash amount from GSW to MIL' }) as HTMLInputElement;
    expect(input.value).toBe('13500000');
    fireEvent.change(input, { target: { value: '1234567' } });
    expect(input.value).toBe('1234567');
    expect(useTradeStore.getState().assets[initial.id]).toMatchObject({ amount: 1_234_567, salary: 0 });
    expect(useTradeStore.getState().teams).toEqual(teams);
    expect(screen.getByText('GSW pays MIL. No salary or cap relief.')).toBeTruthy();
  });

  it('retains exact cash when parked, routed and returned to its sender', () => {
    useTradeStore.setState({ assets: { [initial.id]: { ...initial, amount: 999_999, toTeam: 'GSW' } } });
    render(<ConnectedCashRow/>);
    expect(screen.getByText('Choose a destination to include this cash in the deal.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Send to MIL: Cash' }));
    expect(screen.getByRole('spinbutton', { name: 'Cash amount from GSW to MIL' })).toBeTruthy();
    expect(useTradeStore.getState().assets[initial.id]).toMatchObject({ amount: 999_999, fromTeam: 'GSW', toTeam: 'MIL', salary: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Return to GSW: Cash' }));
    expect(screen.getByRole('spinbutton', { name: 'Cash amount from GSW to GSW' })).toBeTruthy();
    expect(useTradeStore.getState().assets[initial.id]).toMatchObject({ amount: 999_999, fromTeam: 'GSW', toTeam: 'GSW', salary: 0 });
  });

  it('clears to an explicit zero instead of an invalid numeric value', () => {
    render(<ConnectedCashRow/>);
    const input = screen.getByRole('spinbutton', { name: 'Cash amount from GSW to MIL' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('0');
    expect(useTradeStore.getState().assets[initial.id].amount).toBe(0);
  });

  it.each(['-1', '1.5', '2000000001'])('rejects invalid typed amount %s instead of silently clamping or rounding', value => {
    render(<ConnectedCashRow/>);
    const input = screen.getByRole('spinbutton', { name: 'Cash amount from GSW to MIL' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value } });
    expect(input.value).toBe('13500000');
    expect(useTradeStore.getState().assets[initial.id].amount).toBe(13_500_000);
  });

  it.each([NaN, Infinity, -Infinity, -1, 0.5, 2_000_000_001, Number.MAX_SAFE_INTEGER + 1])('guards invalid amount %s in the store as well as the editor', value => {
    act(() => useTradeStore.getState().setAssetAmount(initial.id, value));
    expect(useTradeStore.getState().assets[initial.id]).toEqual(initial);
  });
});
