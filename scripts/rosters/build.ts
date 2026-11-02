// Promote reviewed cap-sheet facts into a versioned dataset. No database writes.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { normalizePlayerId,slugify } from '../../lib/slug';
import { SEASON_2026_27 as cap } from '../../lib/cba/constants';
import type { RosterEntry,ContractYear,RosterSnapshot } from '../../lib/data/types';

const root=process.cwd();
const read=(file:string)=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const text=fs.readFileSync(path.join(root,'scripts/rosters/out/capsheets.json'),'utf8');
const source=JSON.parse(text);
const espn=read('scripts/rosters/out/rosters.json').players;
const known=new Map<string,string>();
for(const layer of ['data/seed','data/overrides']) {
  const file=path.join(root,layer,'players.json');
  if(fs.existsSync(file)) for(const p of JSON.parse(fs.readFileSync(file,'utf8'))) known.set(normalizePlayerId(p.id),p.id);
}
const curated=read('data/overrides/contracts.json');
const numeric=(v:string)=>Number(v?.replace(/[^\d.-]/g,''));
const teams:RosterSnapshot['teams']={};const allIds=new Set<string>();
const teamList=read('data/overrides/teams.json');
for(const team of source.teams) {
  const rows:RosterEntry[]=[];
  for(const section of team.sections) for(const row of section.players) {
    if(!section.section.startsWith('Standard')&&!section.section.startsWith('Two-Way')) continue;
    const normalized=normalizePlayerId(slugify(row.name));
    const meta=espn.find((p:{player_id:string})=>normalizePlayerId(p.player_id)===normalized);
    const playerId=known.get(normalized)??meta?.player_id??slugify(row.name);
    if(allIds.has(playerId)) throw new Error(`Player appears on multiple rosters: ${playerId}`);
    allIds.add(playerId);
    const twoWay=section.section.startsWith('Two-Way');
    const contract:ContractYear[]=row.contract.map((year:{season:string;salary:number;guaranteed:number;option_type:string})=>{
      const flags=curated.find((c:{player_id:string;season:string})=>c.player_id===playerId&&c.season===year.season);
      return {season:year.season,salary:twoWay?0:year.salary,option_type:year.option_type,
        guarantee_status:year.guaranteed>=year.salary?'full':year.guaranteed>0?'partial':'non_guaranteed',
        no_trade_clause:row.terms.includes('NTC')||row.flags.some((f:string)=>/No Trade/i.test(f))||flags?.no_trade_clause===true,
        trade_bonus_pct:flags?.trade_bonus_pct??0,trade_bonus_earned:flags?.trade_bonus_earned??false};
    });
    const current=contract.find(c=>c.season===cap.season);
    if(!current||!Number.isFinite(current.salary)||current.salary<0) throw new Error('Invalid active salary for '+playerId);
    const notes:string[]=[];
    if(row.flags.includes('Unconfirmed Information'))notes.push('The source marks some contract information as unconfirmed.');
    if(row.terms.includes('10-Day'))notes.push('Temporary 10-day contract: confirm hardship status and eligibility for the chosen trade date.');
    rows.push({playerId,name:row.name,position:row.position,age:row.age,salary:current.salary,contract,isTwoWay:twoWay,
      maxSalary:row.terms.includes('Max')?current.salary:undefined,
      headshot:meta?.headshot??null,height:meta?.height??null,weight:meta?.weight??null,jersey:meta?.jersey??null,
      dataNotes:notes,source:row.source});
  }
  const preTradeSalary=numeric(team.totals['CAP HIT']);
  const apronSalary=cap.firstApron-numeric(team.totals['1ST APRON ROOM']);
  if(!Number.isFinite(preTradeSalary)||!Number.isFinite(apronSalary))throw new Error('Missing team payroll: '+team.abbr);
  const reported=team.totals['HARD CAPPED'];
  let hardCapLine=reported==='1st Apron'?cap.firstApron:reported==='2nd Apron'?cap.secondApron:null;
  const notes:string[]=[];
  if(hardCapLine!=null&&apronSalary>hardCapLine) {
    notes.push('The source hard-cap label conflicts with its current payroll. Confirm hard-cap history before relying on this proposal.');
    hardCapLine=null;
  }
  const rosterCount=rows.filter(r=>!r.isTwoWay).length;
  if(rosterCount>15)notes.push('The source reports more than 15 standard players, including a temporary contract. Confirm the roster exception.');
  teams[team.teamId]={roster:rows,preTradeSalary,apronSalary,capSpace:Math.max(0,numeric(team.totals['CAP ROOM'])),
    hardCapLine,rosterCount,twoWayCount:rows.filter(r=>r.isTwoWay).length,
    exceptions:team.exceptions.filter((e:{amount:number;expires:string})=>e.amount>0&&(!e.expires||e.expires>=source.checkedAt.slice(0,10))).map((e:{kind:'tpe';amount:number;expires:string|null;sourcePlayer:string})=>({...e,expires:e.expires??undefined})),
    picks:team.picks.map((p:{year:string;round:number;originalName:string;note:string;isSwap:boolean;needsReview:boolean},index:number)=>{
      const original=teamList.find((t:{name:string})=>t.name===p.originalName||t.name.replace('Los Angeles','LA')===p.originalName);
      if(!original)throw new Error('Unknown original pick team: '+p.originalName);
      return {id:`${team.teamId}-${p.year}-${p.round}-${original.id}-${index}`,owning_team_id:team.teamId,original_team_id:original.id,
        season:p.year,round:p.round,protections:p.note?{note:p.note}:null,is_swap:p.isSwap,is_frozen:/frozen/i.test(p.note),needsReview:p.needsReview,source:team.url};
    }),dataNotes:notes,source:team.url};
}
if(Object.keys(teams).length!==30||allIds.size<500)throw new Error('Incomplete roster snapshot');
const result:RosterSnapshot={season:cap.season,version:createHash('sha256').update(JSON.stringify(teams)).digest('hex').slice(0,16),
  checkedAt:source.checkedAt,rosterAsOf:source.checkedAt.slice(0,10),pickAsOf:source.checkedAt.slice(0,10),
  source:'Public SalarySwish cap sheets; ESPN roster biographies',teams};
fs.writeFileSync(path.join(root,'data/seed/roster_snapshot_2026_27.json'),JSON.stringify(result,null,2)+'\n');
const freshness=path.join(root,'lib/data/freshness.ts');
fs.writeFileSync(freshness,fs.readFileSync(freshness,'utf8').replace(/export const DATA_AS_OF = '[^']+';/,`export const DATA_AS_OF = '${result.rosterAsOf}';`));
console.log(`Built ${allIds.size} roster entries for 30 teams. Source conflicts remain explicit in per-team notes.`);
