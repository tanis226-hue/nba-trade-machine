'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { useTradeStore } from '@/lib/store/tradeStore';
import type { TradeAsset, TradeTeamInput, TradeMethod } from '@/lib/cba/types';

// "Open in editor" for a saved/shared trade. Seeds the store from the saved payload, then routes
// home. Because the store persists synchronously, the edited board is in localStorage before the
// board mounts and rehydrates - so it loads the right trade with no race against rehydration.
export function EditTradeButton({
  season,
  teams,
  assets,
  simulatedDate,
  tradeMethod,
  dataVersion,
}: {
  season: string;
  teams: TradeTeamInput[];
  assets: Record<string, TradeAsset>;
  simulatedDate?: string;
  tradeMethod?: TradeMethod;
  dataVersion?:string;
}) {
  const router = useRouter();
  const [confirmOpen,setConfirmOpen]=useState(false);

  function applySavedProposal() {
    useTradeStore.setState({
      season,
      teams,
      assets,
      simulatedDate,
      dataVersion,
      tradeMethod: tradeMethod ?? 'simultaneous',
      compareIds: [],
    });
    router.push(`/?season=${season}`);
    setConfirmOpen(false);
  }

  function edit() {
    const current=useTradeStore.getState();
    const same=current.season===season&&current.dataVersion===dataVersion&&current.simulatedDate===simulatedDate&&current.tradeMethod===(tradeMethod??'simultaneous')&&JSON.stringify(current.teams)===JSON.stringify(teams)&&JSON.stringify(current.assets)===JSON.stringify(assets);
    if(current.teams.length&&!same)setConfirmOpen(true);
    else applySavedProposal();
  }

  return (
    <>
    <button
      onClick={edit}
      className="ui-button primary"
    >
      Open in builder
    </button>
    {confirmOpen&&<ConfirmDialog title="Open this saved proposal?" description="This replaces the working board in this browser. Save a link first if you want to keep your current trade." action="Open proposal" onCancel={()=>setConfirmOpen(false)} onConfirm={applySavedProposal}/>}
    </>
  );
}
