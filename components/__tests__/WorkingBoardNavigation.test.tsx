import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PrimaryNavigation } from '../PrimaryNavigation';
import { TradeBoard } from '../TradeBoard';
import { partializeTradeState, PERSIST_KEY, useTradeStore } from '@/lib/store/tradeStore';

const navigation=vi.hoisted(()=>({push:vi.fn(),replace:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>navigation,usePathname:()=>'/contracts'}));
vi.mock('next/link',()=>({default:({href,children,...rest}:AnchorHTMLAttributes<HTMLAnchorElement>)=><a href={href} {...rest}>{children}</a>}));
vi.mock('../TradeMatrix',()=>({TradeMatrix:()=> <div>Working roster</div>}));

function savedProposal() {
  return {
    season:'2025-26',dataVersion:'saved-archive',simulatedDate:'2026-02-01',
    teams:[{abbr:'AAA',preTradeSalary:100},{abbr:'BBB',preTradeSalary:100}],
    assets:{a1:{id:'a1',kind:'player' as const,salary:10,fromTeam:'AAA',toTeam:'BBB',label:'Saved move'}},
  };
}
const currentProps={
  teams:[{id:'bos',abbr:'BOS',name:'Boston Celtics',conference:'East',logo_url:null,primary_color:null,secondary_color:null}],
  rosters:{BOS:[{playerId:'example',name:'Current player',position:'G',age:25,salary:1_000_000,contract:[]}]},
  seasons:['2025-26','2026-27'],rosterSeason:'2026-27',dataVersion:'current-snapshot',defaultDate:'2026-11-02',picks:{},values:{},
};

beforeEach(async()=>{
  useTradeStore.getState().reset();
  localStorage.clear();
  await useTradeStore.persist.rehydrate();
  vi.clearAllMocks();
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});

describe('working board preservation across contracts navigation',()=>{
  it('hydrates a historical board on a direct contracts load before linking back to the builder',async()=>{
    const proposal=savedProposal();
    localStorage.setItem(PERSIST_KEY,JSON.stringify({state:{...partializeTradeState(useTradeStore.getState()),...proposal},version:1}));
    vi.spyOn(useTradeStore.persist,'hasHydrated').mockReturnValue(false);

    render(<PrimaryNavigation/>);

    await waitFor(()=>expect(screen.getByRole('link',{name:'Trade builder'}).getAttribute('href')).toBe('/?season=2025-26'));
    expect(screen.getByRole('link',{name:'How it works'}).getAttribute('href')).toBe('/?season=2025-26#how-it-works');
    expect(useTradeStore.getState().assets).toEqual(proposal.assets);
  });

  it('restores the saved year on an implicit home visit without clearing the proposal',async()=>{
    const proposal=savedProposal();useTradeStore.setState(proposal);

    render(<TradeBoard {...currentProps}/>);

    await waitFor(()=>expect(navigation.replace).toHaveBeenCalledWith('/?season=2025-26',{scroll:false}));
    expect(useTradeStore.getState()).toMatchObject(proposal);
  });

  it('keeps a historical proposal intact when server props change to a conflicting explicit year',async()=>{
    const proposal=savedProposal();useTradeStore.setState(proposal);
    const {rerender}=render(<TradeBoard {...currentProps} rosterSeason="2025-26" requestedSeason="2025-26" dataVersion="saved-archive"/>);
    await screen.findByText('Working roster');

    rerender(<TradeBoard {...currentProps} requestedSeason="2026-27"/>);

    fireEvent.click(await screen.findByRole('button',{name:'Resume 2025-26 board'}));
    expect(navigation.replace).toHaveBeenCalledWith('/?season=2025-26');
    expect(useTradeStore.getState()).toMatchObject(proposal);
  });

  it('starts the requested year only after the explicit replacement choice',async()=>{
    useTradeStore.setState(savedProposal());
    render(<TradeBoard {...currentProps} requestedSeason="2026-27"/>);
    const start=await screen.findByRole('button',{name:'Start a 2026-27 board'});
    expect(useTradeStore.getState().assets.a1).toBeDefined();

    fireEvent.click(start);

    expect(useTradeStore.getState()).toMatchObject({season:'2026-27',teams:[],assets:{},dataVersion:'current-snapshot',simulatedDate:'2026-11-02'});
  });

  it('uses current metadata when the last stale team is removed and a fresh roster is added',async()=>{
    useTradeStore.setState({season:'2026-27',teams:[{abbr:'AAA',preTradeSalary:100}],assets:{},dataVersion:'old-snapshot',simulatedDate:'2026-07-01'});
    render(<TradeBoard {...currentProps}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Remove AAA from trade'}));
    fireEvent.click(screen.getByRole('button',{name:'Remove team'}));
    expect(useTradeStore.getState().dataVersion).toBe('old-snapshot');

    fireEvent.click(await screen.findByRole('button',{name:'Add Boston Celtics'}));

    expect(useTradeStore.getState()).toMatchObject({dataVersion:'current-snapshot',simulatedDate:'2026-11-02'});
    expect(useTradeStore.getState().assets['BOS-example'].label).toBe('Current player');
    expect(screen.queryByText('You’re editing a saved roster snapshot.')).toBeNull();
  });
});
