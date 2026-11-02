import type {ReactNode} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import SharedTrade from '../page';
import Image from '../opengraph-image';

const mocks = vi.hoisted(() => ({getTrade:vi.fn(), validationFeed:vi.fn(), image:undefined as unknown}));
vi.mock('@/lib/data/queries', () => ({getTrade:mocks.getTrade}));
vi.mock('@/components/TradeComments', () => ({TradeComments:() => null}));
vi.mock('@/components/EditTradeButton', () => ({EditTradeButton:() => null}));
vi.mock('@/components/ValidationFeed', () => ({ValidationFeed:(props:unknown) => {mocks.validationFeed(props); return null;}}));
vi.mock('next/og', () => ({ImageResponse:class {constructor(element:unknown) {mocks.image=element;}}}));

const savedValidation = {valid:true, perTeam:[], errors:[], warnings:[], findings:[]};
beforeEach(() => {
  mocks.getTrade.mockResolvedValue({
    season:'2026-27', schemaVersion:1, validation:savedValidation,
    teams:[{abbr:'BOS', preTradeSalary:180_000_000}, {abbr:'LAL', preTradeSalary:180_000_000}],
    assets:{
      player:{id:'player', kind:'player', salary:10_000_000, fromTeam:'BOS', toTeam:'LAL', label:'Player'},
      sent:{id:'sent', kind:'cash', salary:0, amount:1_234_567, fromTeam:'BOS', toTeam:'LAL', label:'Cash'},
      received:{id:'received', kind:'cash', salary:0, amount:234_567, fromTeam:'LAL', toTeam:'BOS', label:'Cash'},
      parked:{id:'parked', kind:'cash', salary:0, amount:99_000_000, fromTeam:'BOS', toTeam:'BOS', label:'Cash'},
    },
  });
});
afterEach(() => {cleanup(); vi.clearAllMocks(); mocks.image=undefined;});

describe('shared cash presentation', () => {
  it('shows exact consideration and separate payroll while retaining the saved verdict', async () => {
    render(await SharedTrade({params:Promise.resolve({slug:'abcdefghij'})}));
    const card = screen.getByText('BOS').closest('.panel');
    expect(card).toBeTruthy();
    const summary = within(card! as HTMLElement);
    expect(summary.getByText('Net salary −$10.0M')).toBeTruthy();
    expect(summary.getByText('Cash sent').nextElementSibling?.textContent).toBe('$1,234,567');
    expect(summary.getByText('Cash received').nextElementSibling?.textContent).toBe('$234,567');
    expect(summary.getByText('Net cash').nextElementSibling?.textContent).toBe('−$1,000,000');
    expect(summary.getAllByText('$1,234,567')).toHaveLength(2);
    expect(screen.queryByText(/99,000,000/)).toBeNull();
    expect(mocks.validationFeed).toHaveBeenCalledWith({validation:savedValidation});
  });

  it('includes exact cash in the social image and excludes parked cash', async () => {
    await Image({params:Promise.resolve({slug:'abcdefghij'})});
    render(mocks.image as ReactNode);
    expect(screen.getByText('+ Cash $1,234,567')).toBeTruthy();
    expect(screen.getByText('Net salary −$10.0M')).toBeTruthy();
    expect(screen.getByText('Cash sent $1,234,567')).toBeTruthy();
    expect(screen.getByText('Cash received $234,567')).toBeTruthy();
    expect(screen.getByText('Net cash −$1,000,000')).toBeTruthy();
    expect(screen.queryByText(/99,000,000/)).toBeNull();
  });
});
