'use client';
import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTradeStore } from '@/lib/store/tradeStore';
import { PlayerContractModal } from './PlayerContractModal';
import { PlayerHeadshot } from './PlayerHeadshot';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';
import type { ContractYear } from '@/lib/data/types';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const dollars = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});

const OPT: Record<string, string> = { team: 'TO', player: 'PO', eto: 'ETO', guaranteed: '', non_guaranteed: 'NG', two_way: '2W' };

export function PlayerCard({asset,contract,teams}:{asset:TradeAsset;contract?:ContractYear[];teams:TradeTeamInput[]}) {
  const routeAsset=useTradeStore(s=>s.routeAsset);
  const toggleCompare=useTradeStore(s=>s.toggleCompare);
  const compareIds=useTradeStore(s=>s.compareIds);
  const dests=teams.filter(t=>t.abbr!==asset.fromTeam);
  const routed=asset.toTeam!==asset.fromTeam;
  const inCompare=compareIds.includes(asset.id);
  const [showModal,setShowModal]=useState(false);
  const {attributes,listeners,setNodeRef,setActivatorNodeRef,transform,transition,isDragging}=useSortable({id:asset.id});
  function move(next:string,event:React.MouseEvent<HTMLButtonElement>) {
    const focusTarget=event.detail===0&&next!==asset.toTeam
      ? event.currentTarget.closest('.player-card')?.nextElementSibling?.querySelector('button')??document.getElementById(`roster-${asset.toTeam}`)
      : null;
    routeAsset(asset.id,next);
    focusTarget?.focus({preventScroll:true});
  }
  return <>
    <div ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition,opacity:isDragging?.4:1}} className={`player-card ${routed?'routed':''} ${inCompare?'ring-2 ring-[var(--accent)]':''}`}>
      <div className="player-card-head">
        <PlayerHeadshot src={asset.headshot} name={asset.label}/>
        <div className="min-w-0 flex-1"><button className="player-name" onClick={()=>setShowModal(true)} title="View or edit contract">{asset.label}</button><p className="player-bio">{[asset.position,asset.age!=null?`${asset.age} yrs`:null,asset.isTwoWay?'Two-way':null].filter(Boolean).join(' · ')}</p></div>
        <span className="player-salary">{m(asset.salary)}</span>
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Drag ${asset.label}`} className="drag-handle"><svg aria-hidden="true" width="14" height="22" viewBox="0 0 14 22" fill="currentColor"><circle cx="4" cy="5" r="1.5"/><circle cx="10" cy="5" r="1.5"/><circle cx="4" cy="11" r="1.5"/><circle cx="10" cy="11" r="1.5"/><circle cx="4" cy="17" r="1.5"/><circle cx="10" cy="17" r="1.5"/></svg></button>
      </div>
      <p className={`mt-2 text-xs ${routed?'font-semibold text-[var(--accent)]':'text-[var(--muted)]'}`}>{routed?`Included: ${asset.fromTeam} → ${asset.toTeam}`:asset.signed?`Signed to ${asset.fromTeam} · not sent in trade`:`Stays with ${asset.fromTeam} · not in trade`}</p>
      {asset.pts!=null&&<div className="player-stats"><span><b>{asset.pts}</b> PPG</span><span><b>{asset.reb}</b> RPG</span><span><b>{asset.ast}</b> APG</span></div>}
      <div className="player-routing">
        <button className="route-button" aria-label={routed?`Return to ${asset.fromTeam}: ${asset.label}`:`Keep: ${asset.label} at ${asset.fromTeam}`} aria-pressed={!routed} onClick={e=>move(asset.fromTeam,e)}>{routed?`Return to ${asset.fromTeam}`:'Keep'}</button>
        {dests.map(t=><button key={t.abbr} className="route-button" aria-label={`Send to ${t.abbr}: ${asset.label}`} aria-pressed={asset.toTeam===t.abbr} onClick={e=>move(t.abbr,e)}>Send to {t.abbr}</button>)}
        <button className="route-button ml-auto" aria-label={`Compare: ${asset.label}`} aria-pressed={inCompare} onClick={()=>toggleCompare(asset.id)}>Compare</button>
      </div>
      <details className="player-contract"><summary>Contract years &amp; exact salary</summary><p className="mt-2 text-xs text-[var(--muted)]">Current scenario salary: <span className="num font-semibold">{dollars.format(asset.salary)}</span></p>{contract&&contract.length>0?<><p className="mt-2 text-xs text-[var(--muted)]">Listed contract years (before scenario edits)</p><div className="mt-2 flex flex-wrap gap-1">{contract.map(c=><span key={c.season} className="num rounded bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[var(--muted)]">{c.season} {dollars.format(c.salary)}{OPT[c.option_type]?` ${OPT[c.option_type]}`:''}{c.no_trade_clause?' NTC':''}</span>)}</div></>:<p className="mt-2 text-xs text-[var(--muted)]">Contract-year details are not supplied for this player.</p>}</details>
    </div>
    {showModal&&<PlayerContractModal asset={asset} contract={contract} onClose={()=>setShowModal(false)}/>}
  </>;
}
