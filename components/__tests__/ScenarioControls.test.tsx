import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ScenarioControls } from '../ScenarioControls';
import { formatScenarioDate, isDateInRosterSeason, isScenarioDate } from '@/lib/trades/scenario';

afterEach(cleanup);

describe('explicit trade scenario changes', () => {
  it('shows the active year and date before editing and only commits an intentional date change', () => {
    const change = vi.fn();
    render(<ScenarioControls season="2026-27" date="2026-11-02" onDateChange={change}/>);
    expect(screen.getByText('2026-27 rosters')).toBeTruthy();
    expect(screen.getByText('Nov 2, 2026')).toBeTruthy();
    fireEvent.click(screen.getByText('Change trade date'));
    fireEvent.change(screen.getByLabelText('Trade date'), { target: { value: '2026-12-15' } });
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Update date' }));
    expect(change).toHaveBeenCalledWith('2026-12-15');
  });

  it('keeps the current date when the edited value is incomplete', () => {
    const change = vi.fn();
    render(<ScenarioControls season="2026-27" date="2026-11-02" onDateChange={change}/>);
    fireEvent.click(screen.getByText('Change trade date'));
    const input = screen.getByLabelText('Trade date');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.submit(input.closest('form')!);
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('current check date is unchanged');
  });

  it('discloses that a future date does not substitute future rosters or salaries', () => {
    render(<ScenarioControls season="2026-27" date="2027-07-15" onDateChange={vi.fn()}/>);
    expect(screen.getByText(/outside the 2026-27 roster year/)).toBeTruthy();
    expect(isDateInRosterSeason('2027-06-30', '2026-27')).toBe(true);
    expect(isDateInRosterSeason('2027-07-01', '2026-27')).toBe(false);
  });

  it('rejects impossible calendar dates and formats calendar days without a timezone shift', () => {
    expect(isScenarioDate('2027-02-29')).toBe(false);
    expect(isScenarioDate('2028-02-29')).toBe(true);
    expect(isScenarioDate('2026-13-01')).toBe(false);
    expect(formatScenarioDate('2026-11-02')).toBe('Nov 2, 2026');
  });
});
