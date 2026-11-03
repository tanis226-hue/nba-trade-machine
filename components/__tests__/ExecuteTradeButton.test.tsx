import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ExecuteTradeButton } from '../ExecuteTradeButton';
import { useTradeStore } from '@/lib/store/tradeStore';

beforeEach(() => {
  const store = useTradeStore.getState();
  store.reset();
  store.addTeam({ abbr: 'BOS', preTradeSalary: 180_000_000 });
  store.addTeam({ abbr: 'LAL', preTradeSalary: 180_000_000 });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); useTradeStore.getState().reset(); });
const success = () => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ slug: 'abcdefghij' }) });
const openReview = () => { render(<ExecuteTradeButton/>); fireEvent.click(screen.getByRole('button', { name: 'Review & Share' })); };

describe('proposal saving', () => {
  it('keeps review keyboard focus inside visible controls and returns to its trigger', () => {
    render(<ExecuteTradeButton/>);
    const trigger = screen.getByRole('button', { name: 'Review & Share' });
    trigger.focus(); fireEvent.click(trigger);
    const first = screen.getByRole('button', { name: 'Close review' });
    const last = screen.getByRole('button', { name: 'Save & Share' });
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    fireEvent.keyDown(document.activeElement!, {key:'Tab'});
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, {key:'Tab',shiftKey:true});
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, {key:'Tab'});
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, {key:'Escape'});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('retains structured pick conditions in review without requiring free-text notes', () => {
    useTradeStore.getState().addAsset({id:'pick',kind:'pick',salary:0,fromTeam:'BOS',toTeam:'LAL',label:'2028 pick',pickYear:2028,round:1,isSwap:true,protections:{type:'top',through:10}});
    openReview();
    expect(screen.getAllByText('Protected through pick 10.')).toHaveLength(2);
    expect(screen.getAllByText('Swap rights')).toHaveLength(2);
  });
  it('opens above a clipped workspace, locks background scrolling and restores focus', () => {
    const overflow = document.body.style.overflow;
    render(<div data-testid="workspace" style={{ overflow: 'auto', position: 'sticky' }}><ExecuteTradeButton/></div>);
    const trigger = screen.getByRole('button', { name: 'Review & Share' });
    trigger.focus(); fireEvent.click(trigger);
    expect(screen.getByTestId('workspace').contains(screen.getByRole('dialog'))).toBe(false);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.body.style.overflow).toBe(overflow);
    expect(document.activeElement).toBe(trigger);
  });

  it('retains the frozen review on failed saves and retries that same proposal', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Please try again later.' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ slug: 'abcdefghij' }) });
    vi.stubGlobal('fetch', fetch);
    openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Share' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Please try again later.');
    expect(screen.queryByText('Snapshot saved')).toBeNull();
    act(() => useTradeStore.getState().setSimulatedDate('2026-12-15'));
    fireEvent.click(screen.getByRole('button', { name: 'Save & Share' }));
    expect(await screen.findByText('Snapshot saved')).toBeTruthy();
    expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
  });

  it('freezes data version, effective date and routes before review, including during a slow save', async () => {
    const store = useTradeStore.getState();
    store.setDataVersion('launch-test');
    store.setSimulatedDate('2026-11-02');
    store.addAsset({ id: 'p', kind: 'player', salary: 50_000_000, fromTeam: 'BOS', toTeam: 'LAL', label: 'Target player' });
    let finish!: (response: unknown) => void;
    const fetch = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetch);
    openReview();
    act(() => { useTradeStore.getState().routeAsset('p', 'BOS'); useTradeStore.getState().setDataVersion('new-data'); });
    fireEvent.click(screen.getByRole('button', { name: 'Save & Share' }));
    act(() => useTradeStore.getState().setSimulatedDate('2026-12-15'));
    const sent = JSON.parse(fetch.mock.calls[0][1].body);
    expect(sent.dataVersion).toBe('launch-test');
    expect(sent.simulatedDate).toBe('2026-11-02');
    expect(sent.assets.p.toTeam).toBe('LAL');
    expect(sent.validation).toBeUndefined();
    expect(fetch.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
    await act(async () => finish({ ok: true, json: async () => ({ slug: 'abcdefghij' }) }));
    expect(await screen.findByText('Snapshot saved')).toBeTruthy();
    expect(useTradeStore.getState().assets.p.toTeam).toBe('BOS');
  });

  it('shares an invalid trade through the same review while keeping its blockers visible', async () => {
    useTradeStore.getState().addAsset({ id: 'p', kind: 'player', salary: 50_000_000, fromTeam: 'BOS', toTeam: 'LAL', label: 'Target player' });
    const fetch = success(); vi.stubGlobal('fetch', fetch);
    openReview();
    expect(screen.getByText('Trade needs changes')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save & Share' }).hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Save & Share' }));
    expect(await screen.findByText('Snapshot saved')).toBeTruthy();
  });

  it('keeps conditional assumptions visible and permits sharing', async () => {
    const store = useTradeStore.getState();
    store.addAsset({ id: 'cash', kind: 'cash', salary: 0, amount: 100, fromTeam: 'BOS', toTeam: 'LAL', label: 'Cash' });
    const fetch = success(); vi.stubGlobal('fetch', fetch);
    openReview();
    expect(screen.getByText('Review assumptions')).toBeTruthy();
    expect(screen.getAllByText(/prior cash assumptions: sent unknown; received unknown/)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Save & Share' }));
    expect(await screen.findByText('Snapshot saved')).toBeTruthy();
  });

  it('labels a no-move board as a draft rather than a passing trade', async () => {
    const fetch = success(); vi.stubGlobal('fetch', fetch);
    openReview();
    expect(screen.getByText('Draft: no assets included')).toBeTruthy();
    expect(screen.queryByText('Passes modeled checks')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Share' }));
    expect(await screen.findByText('Your starting board is saved as a draft with no assets included.')).toBeTruthy();
    expect(JSON.parse(fetch.mock.calls[0][1].body).assets).toEqual({});
  });

  it('explains the second-team requirement before a one-team save', () => {
    useTradeStore.getState().removeTeam('LAL');
    openReview();
    expect(screen.getByText('Add a second team to create a shareable draft.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save & Share' }).hasAttribute('disabled')).toBe(true);
  });

  it('provides the saved URL and manual-copy recovery when clipboard access fails', async () => {
    vi.stubGlobal('fetch', success());
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
    openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Share' }));
    await waitFor(() => expect(screen.queryByText('Snapshot saved')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    expect(await screen.findByText(/Copy is unavailable/)).toBeTruthy();
    expect((screen.getByLabelText('Saved proposal link') as HTMLInputElement).value).toContain('/trade/abcdefghij');
    expect(screen.queryByText('Link copied ✓')).toBeNull();
  });

  it('ignores a late clipboard result after opening a different review', async () => {
    vi.stubGlobal('fetch', success());
    let finishCopy!: () => void;
    vi.stubGlobal('navigator', {clipboard:{writeText:vi.fn().mockImplementation(() => new Promise<void>(resolve => {finishCopy=resolve;}))}});
    openReview();
    fireEvent.click(screen.getByRole('button', {name:'Save & Share'}));
    await screen.findByText('Snapshot saved');
    fireEvent.click(screen.getByRole('button', {name:'Copy share link'}));
    fireEvent.click(screen.getByRole('button', {name:'Keep editing'}));
    fireEvent.click(screen.getByRole('button', {name:'Review & Share'}));
    fireEvent.click(screen.getByRole('button', {name:'Save & Share'}));
    await screen.findByText('Snapshot saved');
    await act(async () => finishCopy());
    expect(screen.getByRole('button', {name:'Copy share link'})).toBeTruthy();
    expect(screen.queryByText('Link copied ✓')).toBeNull();
  });
});
