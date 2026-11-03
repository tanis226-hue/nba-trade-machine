import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { TeamColumn } from '../TeamColumn';
import { PickDetails } from '../PickDetails';
import { PlayerCard } from '../PlayerCard';
import { SignFreeAgentPanel } from '../SignFreeAgentPanel';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { TradeAsset } from '@/lib/cba/types';
import type { DbDraftPick } from '@/lib/data/types';

vi.mock('../TeamCapPanel',()=>({TeamCapPanel:()=>null}));
vi.mock('../TradeSummary',()=>({TradeSummary:()=>null}));
vi.mock('../CashBudget',()=>({CashBudget:()=>null}));

const teams=[{abbr:'GSW',preTradeSalary:190_000_000},{abbr:'MIL',preTradeSalary:180_000_000}];
const player=(id:string,label:string):TradeAsset=>({id,label,kind:'player',salary:20_000_000,fromTeam:'GSW',toTeam:'GSW'});
const pick:DbDraftPick={id:'gsw-2030',owning_team_id:'gsw',original_team_id:'gsw',season:'2030',round:1,is_swap:true,is_frozen:false,needsReview:true,source:'https://www.salaryswish.com/teams/warriors',protections:{note:'Top-4 protected; then converts to 2031 and 2032 seconds.'}};

beforeEach(()=>{
  useTradeStore.getState().reset();
  useTradeStore.setState({teams,assets:{porzingis:player('porzingis','Kristaps Porziņģis'),curry:player('curry','Stephen Curry')}});
});
afterEach(()=>{cleanup();useTradeStore.getState().reset();});

function board() { return render(<DndContext><TeamColumn abbr="GSW" contracts={{}} picks={[pick]}/></DndContext>); }
function openPicks() {
  fireEvent.click(screen.getByText('Picks & exceptions'));
  fireEvent.click(screen.getByText('2030 GSW 1st · Swap'));
}

describe('roster discovery and explicit inclusion',()=>{
  it('finds an unaccented name, explains its scope, and clears without losing focus',()=>{
    board();
    const search=screen.getByRole('searchbox',{name:'Search GSW roster'});
    fireEvent.change(search,{target:{value:'porzingis'}});
    expect(screen.getByRole('button',{name:'Kristaps Porziņģis'})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Stephen Curry'})).toBeNull();
    expect(screen.getByText('1 of 2 players match')).toBeTruthy();
    fireEvent.change(search,{target:{value:'no such player'}});
    expect(screen.getByText(/No GSW roster players match/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Clear GSW roster search'}));
    expect((search as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(search);
    expect(screen.getByRole('button',{name:'Stephen Curry'})).toBeTruthy();
  });

  it('does not add a pick while inspecting it, and routes only after an explicit destination',()=>{
    board();openPicks();
    expect(useTradeStore.getState().assets[pick.id]).toBeUndefined();
    expect(screen.getByText('Full reported terms')).toBeTruthy();
    expect(screen.getByText(/Conditional rights need verification/)).toBeTruthy();
    expect(screen.getByRole('link',{name:'Read draft-rights source'}).getAttribute('href')).toBe(pick.source);
    fireEvent.click(screen.getByRole('button',{name:'Send 2030 GSW 1st to MIL'}));
    expect(useTradeStore.getState().assets[pick.id]).toMatchObject({fromTeam:'GSW',toTeam:'MIL',isSwap:true,protections:{note:'Top-4 protected; then converts to 2031 and 2032 seconds.'}});
    expect(useTradeStore.getState().assets[pick.id].dataNotes?.[0]).toContain('Conditional draft rights');
    expect(useTradeStore.getState().assets[pick.id].source).toBe(pick.source);
    expect(screen.getByText('Included: GSW → MIL')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Return to GSW'}));
    expect(useTradeStore.getState().assets[pick.id].toTeam).toBe('GSW');
    expect(screen.getByText('Not included in trade · choose a destination')).toBeTruthy();
  });

  it('keeps saved pick conditions when reference metadata differs',()=>{
    render(<PickDetails pick={pick} asset={{id:pick.id,label:'2030 GSW 1st',kind:'pick',salary:0,fromTeam:'GSW',toTeam:'MIL',protections:null}}/>);
    expect(screen.getByText(/Protection terms not supplied/)).toBeTruthy();
    expect(screen.queryByText('Full reported terms')).toBeNull();
  });

  it('never renders unsafe source URLs as links',()=>{
    render(<PickDetails pick={{...pick,source:'javascript:alert(1)',protections:null}}/>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/Protection terms not supplied/)).toBeTruthy();
  });

  it('preserves a saved pick source without current lookup metadata',()=>{
    render(<PickDetails asset={{id:pick.id,label:'2030 GSW 1st',kind:'pick',salary:0,fromTeam:'GSW',toTeam:'MIL',protections:{type:'unprotected'},source:pick.source}}/>);
    expect(screen.getByRole('link',{name:'Read draft-rights source'}).getAttribute('href')).toBe(pick.source);
    expect(screen.getByText('Reported as unprotected.')).toBeTruthy();
    expect(screen.queryByText(/Conditional rights need verification/)).toBeNull();
  });

  it('does not replace an unsafe saved source with newer reference metadata',()=>{
    render(<PickDetails pick={pick} asset={{id:pick.id,label:'2030 GSW 1st',kind:'pick',salary:0,fromTeam:'GSW',toTeam:'MIL',source:'javascript:alert(1)'}}/>);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('returns focus to the roster after removing the last cash or pick row',()=>{
    useTradeStore.setState({assets:{cash:{id:'cash',label:'Cash',kind:'cash',salary:0,amount:1_000_000,fromTeam:'GSW',toTeam:'GSW'}}});
    board();
    const remove=screen.getByRole('button',{name:'Remove Cash'});
    remove.focus();
    fireEvent.click(remove);
    expect(useTradeStore.getState().assets.cash).toBeUndefined();
    expect(document.activeElement).toBe(screen.getByRole('heading',{name:'GSW'}));
  });

  it('distinguishes the scenario salary from original listed contract amounts',()=>{
    render(<DndContext><PlayerCard asset={{...player('edited','Edited Player'),salary:21_234_567}} contract={[{season:'2026-27',salary:20_000_000,option_type:'guaranteed',guarantee_status:'full',no_trade_clause:false}]} teams={teams}/></DndContext>);
    fireEvent.click(screen.getByText('Contract years & exact salary'));
    expect(screen.getByText('Current scenario salary:').textContent).toContain('$21,234,567');
    expect(screen.getByText('Listed contract years (before scenario edits)')).toBeTruthy();
    expect(screen.getByText('2026-27 $20,000,000')).toBeTruthy();
  });

  it('exposes exact scenario salary when contract-year metadata is missing',()=>{
    render(<DndContext><PlayerCard asset={{...player('missing','Player Without Years'),salary:21_234_567}} teams={teams}/></DndContext>);
    fireEvent.click(screen.getByText('Contract years & exact salary'));
    expect(screen.getByText('$21,234,567')).toBeTruthy();
    expect(screen.getByText('Contract-year details are not supplied for this player.')).toBeTruthy();
  });
});

describe('free-agent search',()=>{
  it('supports aliases, announces matches, clears and exposes keyboard-accessible selection',()=>{
    render(<SignFreeAgentPanel abbr="GSW" onClose={vi.fn()} freeAgents={[
      {playerId:'kd',name:'Kevin Durant',priorSalary:20_000_000,restricted:false},
      {playerId:'other',name:'Other Player',priorSalary:2_000_000,restricted:false},
    ]}/>);
    const dialog=screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);
    const search=screen.getByRole('searchbox',{name:'Search listed free agents across the league'});
    fireEvent.change(search,{target:{value:'KD'}});
    expect(within(dialog).getByText('1 match')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:/Kevin Durant/}));
    expect(screen.getByRole('spinbutton',{name:'Annual salary in millions of dollars'})).toBeTruthy();
    expect(screen.getByRole('combobox',{name:'Signing method'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Clear free-agent search'}));
    expect(document.activeElement).toBe(search);
    expect(screen.getByText('2 matches')).toBeTruthy();
  });

  it('contains keyboard focus and rejects an empty salary without substituting a signing amount',()=>{
    const onClose=vi.fn();
    render(<SignFreeAgentPanel abbr="GSW" onClose={onClose} freeAgents={[{playerId:'free-agent',name:'Available Player',priorSalary:2_000_000,restricted:false}]}/>);
    const dialog=screen.getByRole('dialog');
    fireEvent.keyDown(dialog,{key:'Tab'});
    expect(document.activeElement).toBe(screen.getByRole('button',{name:'Close'}));
    fireEvent.click(screen.getByRole('button',{name:/Available Player/}));
    fireEvent.change(screen.getByRole('spinbutton',{name:'Annual salary in millions of dollars'}),{target:{value:''}});
    const sign=screen.getByRole('button',{name:'Sign'});
    expect((sign as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('Enter an annual salary');
    fireEvent.click(sign);
    expect(useTradeStore.getState().assets['GSW-free-agent-fa']).toBeUndefined();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('spinbutton',{name:'Annual salary in millions of dollars'}),{target:{value:'1.234567'}});
    expect((sign as HTMLButtonElement).disabled).toBe(false);
    sign.focus();
    fireEvent.keyDown(sign,{key:'Tab'});
    expect(document.activeElement).toBe(screen.getByRole('button',{name:'Close'}));
  });
});
