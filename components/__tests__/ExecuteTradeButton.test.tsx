import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ExecuteTradeButton} from '../ExecuteTradeButton';
import {useTradeStore} from '@/lib/store/tradeStore';
afterEach(()=>{cleanup();vi.unstubAllGlobals();useTradeStore.getState().reset();});
describe('proposal saving',()=>{
  it('retains the review and reports a failed save instead of claiming success',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:false,json:async()=>({error:'Please try again later.'})});vi.stubGlobal('fetch',fetch);
    render(<ExecuteTradeButton valid />);
    fireEvent.click(screen.getByText('Review & Share'));
    fireEvent.click(screen.getByText('Save & Share'));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent','Please try again later.');
    expect(screen.queryByText('Proposal Saved')).toBeNull();
  });
  it('saves the data version with JSON and only shows success for a durable slug',async()=>{
    useTradeStore.getState().setDataVersion('launch-test');
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({slug:'abcdefghij'})});vi.stubGlobal('fetch',fetch);
    render(<ExecuteTradeButton valid />);
    fireEvent.click(screen.getByText('Review & Share'));fireEvent.click(screen.getByText('Save & Share'));
    await waitFor(()=>expect(screen.queryByText('Proposal Saved')).not.toBeNull());
    expect(fetch.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(fetch.mock.calls[0][1].body).dataVersion).toBe('launch-test');
  });
});
