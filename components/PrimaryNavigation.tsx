'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTradeStore } from '@/lib/store/tradeStore';

export function PrimaryNavigation({mobile=false}:{mobile?:boolean}) {
  const pathname=usePathname();
  const season=useTradeStore(s=>s.season);
  const [hydrated,setHydrated]=useState(false);
  useEffect(()=>{
    const finish=()=>setHydrated(true);
    const unsubscribe=useTradeStore.persist.onFinishHydration(finish);
    if(useTradeStore.persist.hasHydrated())finish();
    else void useTradeStore.persist.rehydrate();
    return unsubscribe;
  },[]);
  const builderHref=hydrated&&/^\d{4}-\d{2}$/.test(season)?`/?season=${encodeURIComponent(season)}`:'/';
  return <nav aria-label={mobile?'Mobile navigation':'Main navigation'} className={mobile?'mobile-navigation':'desktop-navigation items-center gap-6 pr-5 text-sm font-semibold'}>
    <Link href={builderHref} aria-current={pathname==='/'?'page':undefined}>Trade builder</Link>
    <Link href="/contracts" aria-current={pathname.startsWith('/contracts')?'page':undefined}>Contracts</Link>
    {!mobile&&<Link href={`${builderHref}#how-it-works`} className="text-[var(--muted)]">How it works</Link>}
  </nav>;
}
