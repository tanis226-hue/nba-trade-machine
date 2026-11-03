import { getTrade } from '@/lib/data/queries';
import { selectValidation } from '@/lib/store/selectValidation';
import { gradeTrade } from '@/lib/cba/grade';
import { ValidationFeed } from '@/components/ValidationFeed';
import { TradeComments } from '@/components/TradeComments';
import { EditTradeButton } from '@/components/EditTradeButton';
import { PlayerHeadshot } from '@/components/PlayerHeadshot';
import { CashUsageNotes } from '@/components/CashUsageNotes';
import { PickDetails } from '@/components/PickDetails';
import { defaultTradeDate } from '@/lib/data/freshness';
import { formatCash as cash } from '@/lib/cba/cash';
import { exactMoney, signedExactMoney } from '@/lib/trades/presentation';
import { formatScenarioDate } from '@/lib/trades/scenario';
import type { TradeAsset, TradeTeamInput, TradeMethod } from '@/lib/cba/types';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const ESPN: Record<string, string> = { GSW: 'gs', NOP: 'no', NYK: 'ny', SAS: 'sa', UTA: 'utah', WAS: 'wsh' };
const teamLogo = (abbr: string) => `https://a.espncdn.com/i/teamlogos/nba/500/${(ESPN[abbr] ?? abbr).toLowerCase()}.png`;

export default async function SharedTrade({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const payload = await getTrade(slug);
  if (!payload) notFound();

  const methodNote='This older board used sign-and-trade as its matching method. Confirm the current matching method and player sign-and-trade flags before relying on the checks.';
  const teams = (payload.teams as TradeTeamInput[]).map(t=>payload.legacyMethodReview?{...t,dataNotes:[...(t.dataNotes??[]),methodNote]}:t);
  const assets = payload.assets as Record<string, TradeAsset>;
  const tradeMethod = payload.tradeMethod as TradeMethod | undefined;
  const hasMoves=teams.length>=2&&Object.values(assets).some(a=>a.fromTeam!==a.toTeam);
  // Keep versioned verdicts stable; only legacy or incomplete records use current checks.
  const usesSavedValidation = payload.schemaVersion === 1 && !!payload.validation && !payload.legacyMethodReview;
  const validation = usesSavedValidation
    ? payload.validation!
    : selectValidation({ season: payload.season, teams, assets, simulatedDate: payload.simulatedDate, tradeMethod });
  const grade = gradeTrade(teams, Object.values(assets));
  const list = Object.values(assets);

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          Shared {hasMoves?'proposal':'board'} · {payload.season}
        </div>
        <h1 className="mt-3 font-display text-5xl font-bold leading-tight text-[var(--text)]">
          {hasMoves?`${teams.map(t=>t.abbr).join(' / ')} proposal`:'Saved board'}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Trade date: {payload.simulatedDate ? formatScenarioDate(payload.simulatedDate) : hasMoves && !usesSavedValidation ? `Not recorded; current checks use ${formatScenarioDate(defaultTradeDate(payload.season))}` : 'Not recorded'} · {tradeMethod === 'non_simultaneous' ? 'Trade exception method' : 'Standard trade'}</p>
        {!hasMoves&&<p className="mt-2 text-sm font-semibold">Draft: no assets included</p>}
        <details className="mt-3 text-xs text-[var(--muted)]"><summary className="min-h-11 cursor-pointer py-3">Saved inputs &amp; assumptions</summary><p className="mt-2 max-w-prose leading-relaxed">
          {payload.rulesVersion ? `Roster data version: ${payload.dataVersion ?? 'not recorded'}. Saved rules version: ${payload.rulesVersion}. This snapshot preserves the supplied inputs and assumptions. ${hasMoves ? usesSavedValidation ? 'The saved verdict is preserved; opening in the editor runs current checks.' : 'The original verdict cannot be reused for this record. Displayed checks are recalculated using current rules and the inputs below.' : 'Open it in the builder to include assets and check a proposal.'}` : 'Legacy board: original data and rules versions were not recorded. Any displayed checks are recalculated using current rules.'}
        </p><p className="mt-2 max-w-prose leading-relaxed">Changes to the working board or current rosters do not update this saved link.</p>{!hasMoves&&teams.flatMap(t=>(t.dataNotes??[]).map((note,index)=><p key={`${t.abbr}-${index}`} className="mt-2">{t.abbr}: {note}</p>))}</details>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {teams.map((t) => {
          const incoming = list.filter((a) => a.toTeam === t.abbr && a.fromTeam !== t.abbr);
          const outgoing = list.filter((a) => a.fromTeam === t.abbr && a.toTeam !== t.abbr);
          const net = incoming.reduce((s, a) => s + (a.kind === 'player' ? a.salary : 0), 0) - outgoing.reduce((s, a) => s + (a.kind === 'player' ? a.salary : 0), 0);
          const cashSent = outgoing.reduce((s, a) => s + (a.kind === 'cash' ? a.amount ?? 0 : 0), 0);
          const cashReceived = incoming.reduce((s, a) => s + (a.kind === 'cash' ? a.amount ?? 0 : 0), 0);
          const netCash = cashReceived - cashSent;
          const hasCash = [...incoming, ...outgoing].some((a) => a.kind === 'cash');
          const tg = grade.teams.find((g) => g.abbr === t.abbr);
          const salaryAfter = validation.perTeam.find(result => result.abbr === t.abbr)?.postSalary ?? t.preTradeSalary + net;
          const row = (a: TradeAsset, dir: '+' | '−') => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
              {a.kind === 'player' ? (
                <PlayerHeadshot src={a.headshot} name={a.label} size={24}/>
              ) : (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[10px] text-[var(--faint)]">
                  {a.kind === 'pick' ? '◆' : a.kind === 'cash' ? '$' : ''}
                </span>
              )}
              <span className="min-w-0 flex-1 break-words text-[var(--text)]">{a.label}<span className="block text-xs text-[var(--muted)]">{dir === '+' ? `From ${a.fromTeam}` : `To ${a.toTeam}`}</span></span>
              {a.kind === 'cash' ? <span className="num ml-auto shrink-0 text-xs text-[var(--muted)]">{cash(a.amount ?? 0)}</span> : a.kind === 'player' && <span className="num ml-auto text-xs text-[var(--muted)]">{m(a.salary)}</span>}
              {a.kind === 'pick' && <details className="w-full text-xs text-[var(--muted)]"><summary className="min-h-11 cursor-pointer py-3">Pick rights &amp; conditions</summary><PickDetails asset={a}/></details>}
            </div>
          );
          return (
            <div key={t.abbr} className="panel rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={teamLogo(t.abbr)} alt={t.abbr} width={28} height={28} className="h-7 w-7 object-contain" />
                  <div className="font-display text-lg font-semibold uppercase tracking-wide text-[var(--text)]">{t.abbr}</div>
                </div>
                <div className="num text-xs font-semibold text-[var(--text)]">
                  Net salary {net > 0 ? '+' : net < 0 ? '−' : ''}
                  {m(Math.abs(net))}
                </div>
              </div>
              {incoming.length === 0 && outgoing.length === 0 ? (
                <div className="mt-2 text-sm text-[var(--faint)]">No assets exchanged</div>
              ) : (
                <div className="mt-2.5 space-y-1.5">
                  <h2 className="text-xs font-semibold text-[var(--muted)]">Receives</h2>
                  {incoming.length?incoming.map((a) => row(a, '+')):<p className="text-xs text-[var(--muted)]">Nothing included</p>}
                  <h2 className="border-t border-[var(--border-soft)] pt-3 text-xs font-semibold text-[var(--muted)]">Sends</h2>
                  {outgoing.length?outgoing.map((a) => row(a, '−')):<p className="text-xs text-[var(--muted)]">Nothing included</p>}
                </div>
              )}
              <details className="mt-2 text-xs text-[var(--muted)]"><summary className="min-h-11 cursor-pointer py-3">Exact salary amounts</summary><dl className="space-y-1"><div className="flex justify-between gap-2"><dt>Team salary before</dt><dd className="num">{exactMoney(t.preTradeSalary)}</dd></div><div className="flex justify-between gap-2"><dt>Team salary after</dt><dd className="num">{exactMoney(salaryAfter)}</dd></div><div className="flex justify-between gap-2"><dt>Salary change</dt><dd className="num">{signedExactMoney(salaryAfter-t.preTradeSalary)}</dd></div>{[...incoming,...outgoing].filter(a=>a.kind==='player').map(a=><div key={a.id} className="flex justify-between gap-2"><dt>{a.label}</dt><dd className="num">{exactMoney(a.salary)}</dd></div>)}</dl><p className="mt-2">Salary changes are separate from cash exchanged and do not represent a luxury-tax bill.</p></details>
              {hasCash && <dl className="mt-2 space-y-1 border-t border-[var(--border-soft)] pt-2 text-xs text-[var(--muted)]">
                <div className="flex justify-between gap-2"><dt>Cash sent</dt><dd className="num">{cash(cashSent)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Cash received</dt><dd className="num">{cash(cashReceived)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Net cash</dt><dd className="num">{netCash > 0 ? '+' : netCash < 0 ? '−' : ''}{cash(Math.abs(netCash))}</dd></div>
              </dl>}
              {hasCash && <CashUsageNotes team={t} season={payload.season}/>}
              {tg && (incoming.length > 0 || outgoing.length > 0) && (
                <details className="mt-2 border-t border-[var(--border-soft)] text-xs text-[var(--muted)]"><summary className="min-h-11 cursor-pointer py-3">Statistical value estimate</summary><p className="mb-2">A Game Score and pick-value heuristic. It does not judge team fit, incentives, injuries, or whether a team would accept.</p><p className="num">
                  On-court value change {tg.net > 0 ? '+' : ''}
                  {tg.net} · cap value {tg.surplusNet > 0 ? '+' : ''}
                  {tg.surplusNet}
                </p></details>
              )}
            </div>
          );
        })}
      </div>

      {hasMoves?<ValidationFeed validation={validation}/>:<div className="panel rounded-xl p-4 text-sm text-[var(--muted)]">No trade verdict yet. Add a second team if needed, then move an asset to run the checks.</div>}
      <div className="flex flex-wrap items-center gap-3">
        <EditTradeButton season={payload.season} teams={teams} assets={assets} simulatedDate={payload.simulatedDate} tradeMethod={tradeMethod} dataVersion={payload.dataVersion} />
        <Link href="/" className="ui-button">
          Build another trade
        </Link>
      </div>
      <TradeComments slug={slug} />
    </main>
  );
}
