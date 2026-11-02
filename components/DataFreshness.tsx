'use client';
import { useState } from 'react';
type SnapshotStatus={rosterAsOf:string;pickAsOf:string;loadedFrom:'database'|'bundled';importedAt?:string};
const fmt=(iso:string)=>new Date(iso.length===10?iso+'T00:00:00':iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
export function DataFreshness({snapshot}:{snapshot?:SnapshotStatus}) {
  const [open,setOpen]=useState(false);
  return <div className="panel rounded-xl px-3.5 py-2.5 text-xs">
    <button onClick={()=>setOpen(v=>!v)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left">
      <span className="font-semibold text-[var(--text)]">Rosters &amp; contracts · {fmt(snapshot?.rosterAsOf??'2026-06-01')}</span>
      <span className="text-[var(--warn)]">Picks · {fmt(snapshot?.pickAsOf??'2026-06-01')}</span>
      <span className="ml-auto text-[var(--muted)]">{open?'▾':'▸'} Sources &amp; assumptions</span>
    </button>
    {open&&<div className="mt-2 space-y-2 border-t border-[var(--border)] pt-2 text-[11px] leading-relaxed text-[var(--muted)]">
      <p>{snapshot?'Current rosters, contract cap hits, payroll and apron figures come from public SalarySwish cap sheets, with ESPN roster biographies.':'Historical contract snapshot. Active roster counts and point-in-time ownership need independent verification.'}</p>
      <p>{snapshot?.loadedFrom==='database'&&snapshot.importedAt?`Database snapshot synced ${fmt(snapshot.importedAt)}.`:'Using the versioned bundled snapshot.'} Future options depend on player and team decisions. Reported source conflicts appear in the trade findings.</p>
      <p>Current draft rights include the source’s conditional ownership notes. Complex protections, swaps and rollover chains require review. Acquisition history, Bird rights, prior cash usage and repeater status may be incomplete; tax is an estimate.</p>
      <div className="flex flex-wrap gap-3 underline"><a href="https://www.salaryswish.com/" target="_blank" rel="noreferrer">Salary and cap sources</a><a href="https://www.espn.com/nba/teams" target="_blank" rel="noreferrer">Roster source</a><a href="https://nbpa.com/cba" target="_blank" rel="noreferrer">CBA</a></div>
    </div>}
  </div>;
}
