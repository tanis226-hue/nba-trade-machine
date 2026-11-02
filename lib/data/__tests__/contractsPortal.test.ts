import { describe, expect, it } from 'vitest';
import { filterContracts, formatCompactCapHit, guaranteeLabel, listedCommitments, listedSeasons, salaryFor } from '../contractsPortal';
import type { ContractFilters, ContractPortalRow } from '../contractsPortal';

const filters:ContractFilters = {query:'',team:'',position:'',feature:'',sort:'salary',year:'2027-28',direction:'desc'};
const row = (name:string,years:ContractPortalRow['contract'],extras:Partial<ContractPortalRow>={}):ContractPortalRow => ({
  id:name,playerId:name,name,teamId:'bos',teamAbbr:'BOS',teamName:'Boston Celtics',position:'PG, SG',salary:10,
  contract:years,isTwoWay:false,notes:[],...extras,
});
const year = (season:string,salary:number,extras:Partial<ContractPortalRow['contract'][number]>={}) => ({
  season,salary,option_type:'guaranteed',guarantee_status:'full',no_trade_clause:false,...extras,
});

describe('contracts portal data boundaries',()=>{
  it.each([
    [59_033_114,'$59M'],
    [62_587_158,'$62.6M'],
    [0,'$0'],
  ])('renders compact cap hit %s as %s across server and client runtimes',(salary,expected)=>{
    expect(formatCompactCapHit(salary as number)).toBe(expected);
  });
  it('keeps an unlisted future year separate from a reported $0 cap charge in both sort directions',()=>{
    const rows = [row('Unlisted',[year('2026-27',10)]),row('Zero',[year('2027-28',0)],{isTwoWay:true}),row('Paid',[year('2027-28',20)])];
    expect(filterContracts(rows,filters,'2026-27').map(item=>item.name)).toEqual(['Paid','Zero','Unlisted']);
    expect(filterContracts(rows,{...filters,direction:'asc'},'2026-27').map(item=>item.name)).toEqual(['Zero','Paid','Unlisted']);
    expect(salaryFor(rows[0],'2027-28','2026-27')).toBeNull();
  });
  it('includes options in listed commitments without interpreting an option flag as guaranteed money',()=>{
    const player = row('Option',[year('2025-26',5),year('2026-27',10),year('2027-28',20,{option_type:'player',guarantee_status:'non_guaranteed'})]);
    expect(listedCommitments(player,'2026-27')).toBe(30);
    expect(guaranteeLabel(player.contract[2].guarantee_status)).toBe('Non-guaranteed');
    expect(guaranteeLabel('unexpected')).toBe('Guarantee not reported');
    expect(guaranteeLabel(undefined)).toBe('Guarantee not reported');
  });
  it('includes a known base cap hit when the annual contract detail is absent',()=>{
    const player = row('Fallback',[year('2027-28',12)],{salary:10});
    expect(salaryFor(player,'2026-27','2026-27')).toBe(10);
    expect(listedCommitments(player,'2026-27')).toBe(22);
    expect(listedCommitments(row('Complete',[year('2026-27',10),year('2027-28',12)]),'2026-27')).toBe(22);
  });
  it('filters features only in years shown by the selected roster snapshot',()=>{
    const player = row('Past option',[year('2025-26',5,{option_type:'player'}),year('2026-27',10)]);
    expect(filterContracts([player],{...filters,feature:'player_option'},'2026-27')).toHaveLength(0);
    expect(filterContracts([player],{...filters,feature:'player_option'},'2025-26')).toHaveLength(1);
    expect(listedSeasons([player],'2026-27')).toEqual(['2026-27']);
  });
  it('combines accent-insensitive names, roster team, position and option filters',()=>{
    const player = row('Luka Dončić',[year('2027-28',20,{option_type:'player'})],{teamAbbr:'LAL',position:'PG, SG'});
    expect(filterContracts([player],{...filters,query:'doncic',team:'LAL',position:'SG',feature:'player_option'},'2026-27')).toHaveLength(1);
    expect(filterContracts([player],{...filters,team:'BOS'},'2026-27')).toHaveLength(0);
  });
});
