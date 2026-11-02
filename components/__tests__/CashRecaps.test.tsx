import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {TradeSummary} from '../TradeSummary';
import {ExecuteTradeButton} from '../ExecuteTradeButton';
import {useTradeStore} from '@/lib/store/tradeStore';

beforeEach(() => {
  useTradeStore.getState().reset();
  const store = useTradeStore.getState();
  store.addTeam({abbr:'BOS', preTradeSalary:180_000_000});
  store.addTeam({abbr:'LAL', preTradeSalary:180_000_000});
  store.addAsset({id:'player', kind:'player', salary:10_000_000, fromTeam:'BOS', toTeam:'LAL', label:'Player'});
  store.addAsset({id:'sent', kind:'cash', salary:0, amount:1_234_567, fromTeam:'BOS', toTeam:'LAL', label:'Cash'});
  store.addAsset({id:'received', kind:'cash', salary:0, amount:234_567, fromTeam:'LAL', toTeam:'BOS', label:'Cash'});
  store.addAsset({id:'parked', kind:'cash', salary:0, amount:99_000_000, fromTeam:'BOS', toTeam:'BOS', label:'Cash'});
});
afterEach(() => {cleanup(); useTradeStore.getState().reset();});

describe('cash recaps', () => {
  it('keeps salary separate from exact cash sent, received and net in the builder', () => {
    render(<TradeSummary abbr="BOS"/>);
    expect(screen.getByText('Net salary').nextElementSibling?.textContent).toBe('-$10.0M');
    expect(screen.getByText('Cash sent').nextElementSibling?.textContent).toBe('$1,234,567');
    expect(screen.getByText('Cash received').nextElementSibling?.textContent).toBe('$234,567');
    expect(screen.getByText('Net cash').nextElementSibling?.textContent).toBe('−$1,000,000');
    expect(screen.getByText('Cash $1,234,567')).toBeTruthy();
    expect(screen.queryByText(/99,000,000/)).toBeNull();
    fireEvent.click(screen.getByRole('button', {name:'Undo move for Cash $1,234,567'}));
    expect(useTradeStore.getState().assets.sent.toTeam).toBe('BOS');
  });

  it('shows the same exact cash consideration when reviewing a proposal', () => {
    render(<ExecuteTradeButton valid/>);
    fireEvent.click(screen.getByRole('button', {name:'Review & Share'}));
    const card = screen.getByText('BOS').parentElement?.parentElement;
    expect(card).toBeTruthy();
    const summary = within(card!);
    expect(summary.getByText('Net salary −$10.0M')).toBeTruthy();
    expect(summary.getByText('Cash sent').nextElementSibling?.textContent).toBe('$1,234,567');
    expect(summary.getByText('Cash received').nextElementSibling?.textContent).toBe('$234,567');
    expect(summary.getByText('Net cash').nextElementSibling?.textContent).toBe('−$1,000,000');
    expect(summary.getAllByText('$1,234,567')).toHaveLength(2);
    expect(summary.getByText('Salary $10.0M')).toBeTruthy();
    expect(screen.queryByText(/99,000,000/)).toBeNull();
  });
});
