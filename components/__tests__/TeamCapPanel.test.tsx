import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TeamCapPanel } from '../TeamCapPanel';
import { useTradeStore } from '@/lib/store/tradeStore';
import { SEASON_2026_27 } from '@/lib/cba/constants';
import { distanceToLine, exactMoney } from '@/lib/trades/presentation';

afterEach(() => { cleanup(); useTradeStore.getState().reset(); });
describe('readable team finances', () => {
  it('uses distinct cap/apron bases and exposes exact before/after figures', () => {
    const before = SEASON_2026_27.salaryCap + 5_000_000;
    const after = before + 12_345;
    const apron = after + 500_000;
    useTradeStore.getState().addTeam({ abbr: 'BOS', preTradeSalary: before });
    render(<TeamCapPanel result={{abbr:'BOS', outgoing:0, incoming:12_345, postSalary:after, apronPostSalary:apron, preTier:'over_cap', postTier:'over_cap', playersOut:0}}/>);
    expect(screen.getByText('Salary before').nextElementSibling?.textContent).toBe(exactMoney(before));
    expect(screen.getByText('Salary after').nextElementSibling?.textContent).toBe(exactMoney(after));
    expect(screen.getByText('Salary change').nextElementSibling?.textContent).toBe('+$12,345');
    expect(screen.getByText('Salary cap').nextElementSibling?.textContent).toBe('$5.0M over');
    expect(screen.getByText('1st apron').nextElementSibling?.textContent).toBe(distanceToLine(SEASON_2026_27.firstApron - apron));
    expect(screen.getByText(/These figures do not show a luxury-tax bill/)).toBeTruthy();
  });

  it('keeps a small remaining allowance readable rather than rounding it to zero millions', () => {
    expect(distanceToLine(10)).toBe('$10 under');
    expect(distanceToLine(-10)).toBe('$10 over');
    expect(distanceToLine(0)).toBe('At the line');
    expect(exactMoney(0.5)).toBe('$0.50');
  });
});
