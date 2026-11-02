'use client';
import { useState } from 'react';

const ESPN: Record<string,string> = { GSW:'gs', NOP:'no', NYK:'ny', SAS:'sa', UTA:'utah', WAS:'wsh' };
export function TeamLogo({abbr, size=36}:{abbr:string;size?:number}) {
  const [failed,setFailed]=useState(false);
  return <span className="team-logo" style={{width:size,height:size}} aria-hidden="true">
    {failed ? <span>{abbr}</span> :
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`https://a.espncdn.com/i/teamlogos/nba/500/${(ESPN[abbr]??abbr).toLowerCase()}.png`} alt="" width={size} height={size} loading="lazy" onError={()=>setFailed(true)} />}
  </span>;
}
