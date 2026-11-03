import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuggestedFixReview } from '../SuggestedFixReview';
import { ValidationFeed } from '../ValidationFeed';
import { getUndoLabel, useTradeStore } from '@/lib/store/tradeStore';
import { selectValidation } from '@/lib/store/selectValidation';

const actions = [{ assetId: 'target', toTeam: 'BBB', label: 'Keep Target player' }];

beforeEach(() => {
  useTradeStore.setState({
    season: '2026-27', simulatedDate: '2026-11-02', tradeMethod: 'simultaneous', playerSort: 'salary_desc', undoEntry: null,
    teams: [{ abbr: 'AAA', preTradeSalary: 180_000_000 }, { abbr: 'BBB', preTradeSalary: 150_000_000 }],
    assets: {
      a: { id: 'a', label: 'Outgoing', kind: 'player', salary: 20_000_000, fromTeam: 'AAA', toTeam: 'BBB' },
      b: { id: 'b', label: 'Incoming', kind: 'player', salary: 20_000_000, fromTeam: 'BBB', toTeam: 'AAA', noTradeClause: true },
      target: { id: 'target', label: 'Target player', kind: 'player', salary: 60_000_000, fromTeam: 'BBB', toTeam: 'AAA' },
    },
  });
});
afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Preview</button>{open && <SuggestedFixReview actions={actions} onClose={() => setOpen(false)} />}</>;
}

describe('suggested-fix review', () => {
  it('shows the lost acquisition and remaining assumptions before changing anything; cancel preserves the trade', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Preview' });
    trigger.focus(); fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toHaveProperty('textContent', expect.stringContaining('AAA will no longer receive this asset; it stays with BBB.'));
    expect(screen.getByText('Review assumptions')).toBeTruthy();
    expect(useTradeStore.getState().assets.target.toTeam).toBe('AAA');
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(useTradeStore.getState().assets.target.toTeam).toBe('AAA');
  });

  it('restores focus without scrolling the board when the preview closes', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Preview' });
    trigger.focus();
    const focus = vi.spyOn(trigger, 'focus');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    focus.mockRestore();
  });

  it('applies only the reviewed routes and exposes Undo', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply 1 change' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useTradeStore.getState().assets.target.toTeam).toBe('BBB');
    expect(useTradeStore.getState().assets.b.noTradeClause).toBe(true);
    expect(getUndoLabel(useTradeStore.getState())).toBe('Applied 1 suggested change');
    act(() => { useTradeStore.getState().undoLastChange(); });
    expect(useTradeStore.getState().assets.target.toTeam).toBe('AAA');
  });

  it('freezes the displayed plan and disables application after the working proposal changes', () => {
    render(<SuggestedFixReview actions={actions} onClose={vi.fn()} />);
    act(() => { useTradeStore.getState().setAssetSalary('target', 61_000_000); });
    expect(screen.getByRole('alert').textContent).toContain('Your proposal changed');
    expect(screen.getByRole('button', { name: 'Apply 1 change' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Apply 1 change' }));
    expect(useTradeStore.getState().assets.target.toTeam).toBe('AAA');
  });

  it('keeps keyboard focus in the dialog and closes on Escape', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    const dialog = screen.getByRole('dialog');
    const apply = screen.getByRole('button', { name: 'Apply 1 change' });
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(apply);
    fireEvent.keyDown(apply, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

it('offers an explicit date recheck without claiming the whole trade becomes legal', () => {
  const onUseDate = vi.fn();
  const validation = selectValidation(useTradeStore.getState());
  validation.findings = [{ ...(validation.findings ?? validation.errors)[0], legalOnDate: '2026-12-15' }];
  render(<ValidationFeed validation={validation} onUseDate={onUseDate} />);
  expect(screen.getByText('This restriction ends 2026-12-15.')).toBeTruthy();
  expect(onUseDate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Check on 2026-12-15' }));
  expect(onUseDate).toHaveBeenCalledWith('2026-12-15');
});
