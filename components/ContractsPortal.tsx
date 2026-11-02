'use client';

import { Fragment, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ContractYear } from '@/lib/data/types';
import { filterContracts, formatCompactCapHit, guaranteeLabel, listedCommitments, listedSeasons, salaryFor } from '@/lib/data/contractsPortal';
import type { ContractFilters, ContractPortalRow } from '@/lib/data/contractsPortal';
import { TeamLogo } from './TeamLogo';
import { PlayerHeadshot } from './PlayerHeadshot';
import styles from '@/app/contracts/ContractsPortal.module.css';

const dollars = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const FEATURES = [
  ['player_option','Player option'],['team_option','Team option'],['partial','Partial guarantee'],
  ['non_guaranteed','Non-guaranteed year'],['two_way','Two-way'],['no_trade','No-trade clause'],
] as const;

function PlayerPhoto({row}:{row:ContractPortalRow}) {
  return <PlayerHeadshot src={row.headshot} name={row.name} size={44}/>;
}

function Flags({year,twoWay=false}:{year?:ContractYear;twoWay?:boolean}) {
  if (twoWay) return <span className={`${styles.flag} ${styles.neutral}`} title="Two-way contract: listed figures are NBA team cap charges, not cash earnings">2W</span>;
  if (!year) return null;
  return <span className={styles.flags}>
    {year.option_type==='player'&&<span className={`${styles.flag} ${styles.playerOption}`} title="Player option">PO</span>}
    {year.option_type==='team'&&<span className={`${styles.flag} ${styles.teamOption}`} title="Team option">TO</span>}
    {year.option_type==='eto'&&<span className={`${styles.flag} ${styles.playerOption}`} title="Early termination option">ETO</span>}
    {(year.guarantee_status==='partial'||year.guarantee_status==='partially_guaranteed')&&<span className={`${styles.flag} ${styles.partial}`} title="Partially guaranteed; guaranteed dollar amount is not supplied">Partial</span>}
    {year.guarantee_status==='non_guaranteed'&&<span className={`${styles.flag} ${styles.neutral}`} title="Non-guaranteed">NG</span>}
    {year.no_trade_clause&&<span className={`${styles.flag} ${styles.neutral}`} title="Reported no-trade clause">NTC</span>}
  </span>;
}

export function ContractsPortal({rows,teams,season,seasons,asOf,sourceVersion}:{
  rows:ContractPortalRow[];
  teams:{abbr:string;name:string}[];
  season:string;
  seasons:string[];
  asOf?:string;
  sourceVersion?:string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending,startTransition] = useTransition();
  const tableScroll = useRef<HTMLDivElement>(null);
  const resultHeading = useRef<HTMLDivElement>(null);
  const years = useMemo(()=>listedSeasons(rows,season),[rows,season]);
  const query = (searchParams.get('q')??'').slice(0,80);
  const team = teams.some(candidate=>candidate.abbr===searchParams.get('team')) ? searchParams.get('team')! : '';
  const position = ['PG','SG','SF','PF','C'].includes(searchParams.get('position')??'') ? searchParams.get('position')! : '';
  const feature = FEATURES.some(([value])=>value===searchParams.get('feature')) ? searchParams.get('feature')! : '';
  const [advancedOpen,setAdvancedOpen]=useState(!!(position||feature));
  const rawSort = searchParams.get('sort');
  const sort:ContractFilters['sort'] = rawSort==='name'||rawSort==='team'||rawSort==='commitments'?rawSort:'salary';
  const year = years.includes(searchParams.get('year')??'') ? searchParams.get('year')! : season;
  const direction = searchParams.get('dir')==='asc'?'asc':'desc';
  const pageSize = searchParams.get('size')==='50'?50:25;
  const expanded = searchParams.get('player');
  const filtered = useMemo(()=>filterContracts(rows,{query,team,position,feature,sort,year,direction},season),[rows,query,team,position,feature,sort,year,direction,season]);
  const pages = Math.max(1,Math.ceil(filtered.length/pageSize));
  const requestedPage = Number(searchParams.get('page'));
  const page = Number.isSafeInteger(requestedPage)&&requestedPage>0?Math.min(requestedPage,pages):1;
  const first = (page-1)*pageSize;
  const visible = filtered.slice(first,first+pageSize);
  const filteredOn = !!(query||team||position||feature);
  const date = asOf ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${asOf.slice(0,10)}T12:00:00Z`)) : null;

  function update(changes:Record<string,string|null>,keepPage=false) {
    const params = new URLSearchParams(searchParams.toString());
    if (!keepPage) params.delete('page');
    for (const [key,value] of Object.entries(changes)) {
      if(value===null||value==='')params.delete(key);else params.set(key,value);
    }
    const queryString = params.toString();
    window.history.replaceState(null,'',`/contracts${queryString?`?${queryString}`:''}`);
  }

  function changeSeason(next:string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('season',next);params.delete('year');params.delete('page');params.delete('player');
    startTransition(()=>router.push(`/contracts?${params.toString()}`,{scroll:false}));
  }

  function sortBy(nextSort:ContractFilters['sort'],nextYear=year) {
    const active=sort===nextSort&&(nextSort!=='salary'||year===nextYear);
    update({sort:nextSort,year:nextSort==='salary'?nextYear:null,dir:active?(direction==='desc'?'asc':'desc'):nextSort==='name'||nextSort==='team'?'asc':'desc'});
  }

  function reset() { update({q:null,team:null,position:null,feature:null,page:null,player:null}); }
  function changePage(next:number) {
    update({page:String(next),player:null},true);
    tableScroll.current?.scrollTo({top:0});
    resultHeading.current?.scrollIntoView({block:'start'});
    resultHeading.current?.focus({preventScroll:true});
  }
  function togglePlayer(id:string) { update({player:expanded===id?null:id},true); }
  function sortedHeader(label:string,field:ContractFilters['sort'],columnYear?:string) {
    const active = sort===field&&(field!=='salary'||year===columnYear);
    return <th scope="col" aria-sort={active?(direction==='asc'?'ascending':'descending'):undefined} className={field==='name'?styles.playerHeading:undefined}>
      <button onClick={()=>sortBy(field,columnYear)} className={`${styles.sortButton} ${active?styles.activeSort:''}`} aria-label={`Sort by ${label}${active?`, currently ${direction==='asc'?'ascending':'descending'}`:''}`}>
        {label}<span aria-hidden="true">{active?(direction==='desc'?'↓':'↑'):'↕'}</span>
      </button>
    </th>;
  }

  function details(row:ContractPortalRow) {
    const contract = row.contract.filter(item=>item.season>=season);
    return <div className={styles.contractDetail}>
      <div className={styles.detailHeading}><strong>{row.name}’s listed contract</strong>{row.source&&<a href={row.source} target="_blank" rel="noreferrer">View cap-sheet source ↗</a>}</div>
      {row.isTwoWay&&<p className={styles.detailNote}>Two-way contract. The $0 figures below are NBA team cap charges; this dataset does not supply the player’s cash salary.</p>}
      <dl className={styles.yearList}>{contract.map(item=><div key={item.season}>
        <dt>{item.season}</dt><dd><strong>{dollars.format(item.salary)}</strong><span>{row.isTwoWay?'No NBA team cap charge':guaranteeLabel(item.guarantee_status)}</span><span>{item.option_type==='player'?'Player option':item.option_type==='team'?'Team option':item.option_type==='eto'?'Early termination option':''}{item.no_trade_clause?' · No-trade clause':''}</span></dd>
      </div>)}</dl>
      {contract.length===0&&<p className={styles.detailNote}>Contract-year detail is not supplied for this entry.</p>}
      {row.notes.length>0&&<ul className={styles.sourceNotes}>{row.notes.map((note,index)=><li key={index}>{note}</li>)}</ul>}
      <p className={styles.detailNote}>Last listed season: {contract.at(-1)?.season??'Not reported'}. This does not establish free-agency status. Listed commitments include options and are not guaranteed money.</p>
      <div className={styles.detailLinks}><Link href={`/team/${row.teamAbbr.toLowerCase()}`}>View current {row.teamAbbr} roster</Link><Link href="/">Open trade builder</Link></div>
    </div>;
  }

  return <main className={styles.portal}>
    <header className={styles.intro}>
      <div><p className={styles.sectionLabel}>Player contracts</p><h1>The money behind the moves.</h1><p>Explore NBA salaries year by year. Find the options, compare the commitments, and take your next idea to the trade builder.</p></div>
      <Link className="ui-button" href="/">Build a trade</Link>
    </header>

    <section className={`panel ${styles.explorer}`} aria-labelledby="contracts-heading">
      <div className={styles.explorerHeading}><div><h2 id="contracts-heading">Contracts portal</h2><p>{rows.length.toLocaleString('en-US')} rostered players across {new Set(rows.map(row=>row.teamAbbr)).size} teams</p></div>
        <label className={styles.snapshotLabel}>Roster snapshot<select name="season" value={season} disabled={isPending} aria-busy={isPending} onChange={event=>changeSeason(event.target.value)}>{seasons.map(item=><option value={item} key={item}>{item}{item==='2025-26'?' archive':''}</option>)}</select></label>
      </div>
      {isPending&&<p className={styles.pending} role="status">Loading the selected roster snapshot…</p>}
      <div className={styles.filters}>
        <label className={styles.playerSearch}>Find a player<input type="search" name="player-search" autoComplete="off" placeholder="Search a player, e.g. Curry…" maxLength={80} value={query} onChange={event=>update({q:event.target.value,player:null})}/></label>
        <label>Team<select name="team" value={team} onChange={event=>update({team:event.target.value,player:null})}><option value="">All teams</option>{teams.map(item=><option key={item.abbr} value={item.abbr}>{item.name}</option>)}</select></label>
        <button className={styles.moreFilters} aria-expanded={advancedOpen} aria-controls="contract-advanced-filters" onClick={()=>setAdvancedOpen(v=>!v)}>More filters{position||feature?` (${Number(!!position)+Number(!!feature)} active)`:''}<span aria-hidden="true">{advancedOpen?'−':'+'}</span></button>
        <div id="contract-advanced-filters" className={styles.advancedControls} data-open={advancedOpen}>
        <label>Position<select name="position" value={position} onChange={event=>update({position:event.target.value,player:null})}><option value="">All positions</option>{['PG','SG','SF','PF','C'].map(item=><option key={item} value={item}>{item}</option>)}</select></label>
        <label>Contract feature<select name="feature" value={feature} onChange={event=>update({feature:event.target.value,player:null})}><option value="">All contracts</option>{FEATURES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        </div>
      </div>
      <div className={styles.filterFootnote}><span>Contract features match any listed year from {season} onward.</span>{filteredOn&&<button className={styles.textButton} onClick={reset}>Clear filters</button>}</div>
      <div className={styles.coverage}>
        <span className={styles.coverageDot} aria-hidden="true"/>
        <span>{date?`Contracts as of ${date}`:'Archived 2025–26 contract snapshot'}</span>
        <span>{season==='2025-26'?'Historical ownership is incomplete.':'Rostered contracts only; excludes dead money and unrostered free agents.'}</span>
      </div>
    </section>

    <div className={styles.resultsToolbar} ref={resultHeading} tabIndex={-1}>
      <p role="status"><strong>{filtered.length.toLocaleString('en-US')}</strong> {filtered.length===1?'player':'players'}{filtered.length>0?` · Showing ${first+1}–${Math.min(first+pageSize,filtered.length)}`:''}</p>
      <label>Sort by<select name="sort" value={sort==='salary'?`salary:${year}`:sort} onChange={event=>{
        const [field,sortYear] = event.target.value.split(':');
        update({sort:field,year:sortYear??null,dir:field==='name'||field==='team'?'asc':'desc'});
      }}><optgroup label="Yearly cap hit">{years.map(item=><option key={item} value={`salary:${item}`}>{item} cap hit</option>)}</optgroup><option value="commitments">Listed commitments</option><option value="name">Player name</option><option value="team">Team name</option></select></label>
      <button className={styles.directionButton} onClick={()=>update({dir:direction==='desc'?'asc':'desc'})} aria-label={`Sort ${direction==='desc'?'ascending':'descending'}`}>{sort==='name'||sort==='team'?(direction==='asc'?'A to Z ↑':'Z to A ↓'):(direction==='desc'?'High to low ↓':'Low to high ↑')}</button>
    </div>

    {filtered.length===0?<section className={`panel ${styles.empty}`}><h2>No matching contracts</h2><p>Try another player name, team or contract feature.</p><button className="ui-button primary" onClick={reset}>Clear filters</button></section>:<>
      <div className={`panel ${styles.tableShell}`}>
        <p className={styles.tableHint}>Select a player for contract details. Scroll across for later seasons. Amounts are listed cap hits.</p>
        <div className={styles.tableScroll} ref={tableScroll} tabIndex={0} role="region" aria-label="Player contracts comparison table">
          <table className={styles.table}>
            <caption className="sr-only">Rostered player contracts from the {season} snapshot. Future columns retain this snapshot’s team ownership. Listed commitments include options and are not guaranteed money.</caption>
            <thead><tr>{sortedHeader('Player','name')}{sortedHeader('Team','team')}{years.map(item=><Fragment key={item}>{sortedHeader(item,'salary',item)}</Fragment>)}{sortedHeader('Listed commitments','commitments')}</tr></thead>
            <tbody>{visible.map((row,index)=><Fragment key={row.id}>
              <tr className={expanded===row.id?styles.selectedRow:undefined}>
                <th scope="row" className={styles.playerCell}><button onClick={()=>togglePlayer(row.id)} aria-expanded={expanded===row.id} aria-controls={`contract-desktop-${row.id}`} className={styles.playerButton}><span className={styles.rank}>{first+index+1}</span><PlayerPhoto row={row}/><span><strong>{row.name}</strong><small>{row.position??'Position not reported'}{row.isTwoWay?' · Two-way':''}</small></span><span className={styles.expandIcon} aria-hidden="true">{expanded===row.id?'−':'+'}</span></button></th>
                <td><span className={styles.teamCell}><TeamLogo abbr={row.teamAbbr} size={24}/><span title={row.teamName}>{row.teamAbbr}</span></span></td>
                {years.map(item=>{const value=salaryFor(row,item,season),contract=row.contract.find(contract=>contract.season===item);return <td key={item} className={styles.salaryCell}><span className={value===null?styles.notListed:undefined}>{value===null?'—':dollars.format(value)}</span><Flags year={contract} twoWay={row.isTwoWay&&value!==null}/></td>;})}
                <td className={`${styles.salaryCell} ${styles.commitmentCell}`}>{dollars.format(listedCommitments(row,season))}<small>Includes options</small></td>
              </tr>
              {expanded===row.id&&<tr id={`contract-desktop-${row.id}`}><td colSpan={years.length+3} className={styles.detailCell}>{details(row)}</td></tr>}
            </Fragment>)}</tbody>
          </table>
        </div>
      </div>

      <div className={styles.mobileList}>{visible.map(row=>{
        const value=salaryFor(row,year,season),contract=row.contract.find(contract=>contract.season===year);
        return <article className={`panel ${styles.mobileCard}`} key={row.id}>
          <div className={styles.mobilePlayer}><PlayerPhoto row={row}/><div><h3>{row.name}</h3><p><TeamLogo abbr={row.teamAbbr} size={20}/>{row.teamAbbr} <span>{row.position}</span>{row.isTwoWay&&<span>Two-way</span>}</p></div></div>
          <div className={styles.mobileAmounts}><div><span>{year} cap hit</span><strong title={value===null?'Not listed':dollars.format(value)}>{value===null?'Not listed':formatCompactCapHit(value)}</strong><Flags year={contract} twoWay={row.isTwoWay&&value!==null}/></div><div><span>Listed commitments</span><strong title={dollars.format(listedCommitments(row,season))}>{formatCompactCapHit(listedCommitments(row,season))}</strong><small>Includes options</small></div></div>
          <button className={styles.mobileDetailButton} aria-expanded={expanded===row.id} aria-controls={`contract-mobile-${row.id}`} onClick={()=>togglePlayer(row.id)}>Contract details <span aria-hidden="true">{expanded===row.id?'−':'+'}</span></button>
          {expanded===row.id&&<div id={`contract-mobile-${row.id}`}>{details(row)}</div>}
        </article>;
      })}</div>
      <nav className={styles.pagination} aria-label="Contract results pages"><label>Per page<select name="page-size" value={pageSize} onChange={event=>update({size:event.target.value})}><option value={25}>25 players</option><option value={50}>50 players</option></select></label><span>Page {page} of {pages}</span><div><button className="ui-button" disabled={page===1} onClick={()=>changePage(page-1)}>Previous</button><button className="ui-button" disabled={page===pages} onClick={()=>changePage(page+1)}>Next</button></div></nav>
    </>}

    <details className={`panel ${styles.legend}`}><summary>Options, guarantees &amp; sources</summary><div>
      <dl className={styles.legendList}><div><dt>PO</dt><dd>Player option</dd></div><div><dt>TO</dt><dd>Team option</dd></div><div><dt>Partial</dt><dd>Partial guarantee; amount not supplied</dd></div><div><dt>NG</dt><dd>Non-guaranteed year</dd></div><div><dt>NTC</dt><dd>Reported no-trade clause</dd></div><div><dt>2W</dt><dd>Two-way; $0 is the NBA team cap charge, not the player’s pay</dd></div></dl>
      <p>Listed commitments add the cap hits shown from the roster-snapshot season onward, including player and team options. They are not a guaranteed-money total. A blank future year means no figure is listed, rather than a $0 contract. Contract details show guarantee status only where reported.</p>
      <p>{season==='2025-26'?'The 2025–26 archive is an older contract snapshot with incomplete point-in-time ownership.':'Current contracts come from public SalarySwish cap sheets with ESPN roster biographies.'} This portal covers rostered players. Waived-player dead money, cap holds, unrostered free agents and cash earnings for two-way deals are outside its scope. Future salary columns do not establish future team ownership or free-agency status.</p>
      <div className={styles.sourceLinks}><a href="https://www.salaryswish.com/" target="_blank" rel="noreferrer">SalarySwish cap sheets ↗</a><a href="https://www.espn.com/nba/teams" target="_blank" rel="noreferrer">ESPN rosters ↗</a><a href="https://www.basketball-reference.com/contracts/players.html" target="_blank" rel="noreferrer">Basketball-Reference contract reference ↗</a></div>
      {sourceVersion&&<p className={styles.version}>Source snapshot {sourceVersion}. Contract facts may change after the stated retrieval date.</p>}
    </div></details>
  </main>;
}
