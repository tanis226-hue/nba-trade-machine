'use client';
import {createPortal} from 'react-dom';
import { useEffect, useId, useRef } from 'react';

export function ConfirmDialog({title,description,action,onCancel,onConfirm}:{title:string;description:string;action:string;onCancel:()=>void;onConfirm:()=>void}) {
  const id=useId();
  const dialog=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialog.current?.querySelector('button')?.focus();
    return ()=>{document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();else document.getElementById('teams-heading')?.focus();};
  },[]);
  return createPortal(<div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={e=>{if(e.target===e.currentTarget)onCancel();}}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={id} aria-describedby={`${id}-description`} className="panel max-h-[calc(100dvh-32px)] w-full max-w-md overflow-y-auto rounded-2xl p-6" onKeyDown={e=>{
      if(e.key==='Escape'){e.stopPropagation();onCancel();}
      if(e.key==='Tab'){
        const buttons=dialog.current?.querySelectorAll('button');if(!buttons?.length)return;
        const first=buttons[0],last=buttons[buttons.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    }}>
      <h2 id={id} className="text-xl font-bold">{title}</h2>
      <p id={`${id}-description`} className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
      <div className="mt-6 flex justify-end gap-2"><button className="ui-button" onClick={onCancel}>Keep editing</button><button className="ui-button primary" onClick={onConfirm}>{action}</button></div>
    </div>
  </div>,document.body);
}
