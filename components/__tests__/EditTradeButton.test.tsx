import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {EditTradeButton} from '../EditTradeButton';
import {useTradeStore} from '@/lib/store/tradeStore';

const {push}=vi.hoisted(()=>({push:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push})}));
const proposal={season:'2025-26',teams:[{abbr:'BOS',preTradeSalary:100}],assets:{},dataVersion:'saved-version'};
afterEach(()=>{cleanup();push.mockClear();useTradeStore.getState().reset();});

describe('opening a shared proposal',()=>{
  it('opens directly when there is no working board',()=>{
    render(<EditTradeButton {...proposal}/>);
    fireEvent.click(screen.getByRole('button',{name:'Open in builder'}));
    expect(useTradeStore.getState()).toMatchObject(proposal);
    expect(push).toHaveBeenCalledWith('/?season=2025-26');
  });
  it('preserves another working board until replacement is confirmed',()=>{
    useTradeStore.setState({season:'2026-27',teams:[{abbr:'DAL',preTradeSalary:200}],assets:{},dataVersion:'working-version'});
    render(<EditTradeButton {...proposal}/>);
    fireEvent.click(screen.getByRole('button',{name:'Open in builder'}));
    fireEvent.click(screen.getByRole('button',{name:'Keep editing'}));
    expect(useTradeStore.getState().dataVersion).toBe('working-version');
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Open in builder'}));
    fireEvent.click(screen.getByRole('button',{name:'Open proposal'}));
    expect(useTradeStore.getState()).toMatchObject(proposal);
    expect(push).toHaveBeenCalledWith('/?season=2025-26');
  });
});
