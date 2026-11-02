import { describe,it,expect } from 'vitest';
import { bundledRosterSnapshot } from '../rosterSnapshot';
import { localRoster } from '../local';
describe('launch roster data',()=>{
  it('covers 30 teams with unique players and explicit standard/two-way counts',()=>{
    const snapshot=bundledRosterSnapshot('2026-27')!;
    expect(Object.keys(snapshot.teams)).toHaveLength(30);
    const entries=Object.values(snapshot.teams).flatMap(t=>t.roster);
    expect(entries).toHaveLength(523);
    expect(new Set(entries.map(r=>r.playerId)).size).toBe(entries.length);
    for(const t of Object.values(snapshot.teams)) {
      expect(t.roster.filter(r=>!r.isTwoWay)).toHaveLength(t.rosterCount);
      expect(t.roster.filter(r=>r.isTwoWay)).toHaveLength(t.twoWayCount);
      expect(t.roster.filter(r=>r.isTwoWay).every(r=>r.salary===0)).toBe(true);
      expect(Number.isFinite(t.apronSalary)).toBe(true);
    }
  });
  it('separates active Bradley Beal salary from Phoenix dead money',()=>{
    const roster=bundledRosterSnapshot('2026-27')!.teams.lac.roster;
    const beal=roster.find(r=>r.playerId==='p_bradley_beal')!;
    expect(beal.salary).toBe(6_424_800);
    expect(beal.contract.find(c=>c.season==='2026-27')?.salary).toBe(6_424_800);
  });
  it('uses actual Boston payroll and retains max-salary and two-way inputs',()=>{
    const team=bundledRosterSnapshot('2026-27')!.teams.bos;
    expect(team.preTradeSalary).toBe(198_722_406);
    expect(team.rosterCount).toBe(14);expect(team.twoWayCount).toBe(3);
    const tatum=team.roster.find(r=>r.playerId==='p_jayson_tatum')!;
    expect(tatum.maxSalary).toBe(tatum.salary);
  });
  it('retains source conflicts as explicit assumptions',()=>{
    const team=bundledRosterSnapshot('2026-27')!.teams.min;
    expect(team.hardCapLine).toBeNull();
    expect(team.dataNotes.join(' ')).toContain('conflicts');
  });
  it('uses the historical seed ownership for 2025-26 rather than July 2026 overrides',()=>{
    expect(localRoster('bos','2025-26',true).some(p=>p.playerId==='p_jaylen_brown')).toBe(true);
    expect(localRoster('phi','2025-26',true).some(p=>p.playerId==='p_paul_george')).toBe(true);
  });
  it('keeps current conditional draft rights and excludes traded-away picks',()=>{
    const snapshot=bundledRosterSnapshot('2026-27')!;
    expect(snapshot.pickAsOf).toBe('2026-11-02');
    const picks=snapshot.teams.bos.picks;
    expect(picks.some(p=>p.season==='2029'&&p.original_team_id==='bos'&&p.round===1)).toBe(false);
    expect(picks.some(p=>p.season==='2031'&&p.original_team_id==='phi'&&p.round===1)).toBe(true);
    expect(picks.find(p=>p.season==='2028'&&p.original_team_id==='lac'&&p.round===1)?.needsReview).toBe(true);
  });
});
