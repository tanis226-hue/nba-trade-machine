import { getTrade } from '@/lib/data/queries';
import { selectValidation } from '@/lib/store/selectValidation';
import { gradeTrade } from '@/lib/cba/grade';
import { ValidationFeed } from '@/components/ValidationFeed';
import { TradeComments } from '@/components/TradeComments';
import { EditTradeButton } from '@/components/EditTradeButton';
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
  // Re-validate with the author's date + method so the verdict matches what they saw when sharing.
  const validation = payload.schemaVersion === 1 && payload.validation && !payload.legacyMethodReview
    ? payload.validation
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
        {hasMoves&&<p className="mt-2 text-[13px] text-[var(--muted)]">{grade.verdict}</p>}
        <details className="mt-3 text-xs text-[var(--muted)]"><summary className="min-h-10">Saved inputs &amp; assumptions</summary><p className="mt-2 max-w-prose leading-relaxed">
          {!hasMoves?'This older link contains a saved board with no assets exchanged. Open it in the editor to build a proposal.':payload.rulesVersion ? `Saved with rules ${payload.rulesVersion} · data ${payload.dataVersion} · trade date ${payload.simulatedDate}. The saved verdict is preserved; opening in the editor runs the current checks.` : 'Legacy proposal: recalculated with current rules. Its original data version was not recorded.'}
        </p></details>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {teams.map((t) => {
          const incoming = list.filter((a) => a.toTeam === t.abbr && a.fromTeam !== t.abbr);
          const outgoing = list.filter((a) => a.fromTeam === t.abbr && a.toTeam !== t.abbr);
          const net = incoming.reduce((s, a) => s + a.salary, 0) - outgoing.reduce((s, a) => s + a.salary, 0);
          const tg = grade.teams.find((g) => g.abbr === t.abbr);
          const row = (a: TradeAsset, dir: '+' | '−') => (
            <div key={a.id} className="flex items-center gap-2 text-sm">
              {a.kind === 'player' && a.headshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.headshot} alt="" width={24} height={24} className="h-6 w-6 shrink-0 rounded-full bg-[var(--surface-2)] object-cover object-top ring-1 ring-[var(--border)]" />
              ) : (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[10px] text-[var(--faint)]">
                  {a.kind === 'pick' ? '◆' : a.kind === 'cash' ? '$' : ''}
                </span>
              )}
              <span style={{ color: dir === '+' ? 'var(--legal)' : 'var(--illegal)' }}>
                {dir} {a.label}
              </span>
              {a.kind === 'player' && <span className="num ml-auto text-xs text-[var(--muted)]">{m(a.salary)}</span>}
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
                <div className={`num text-xs font-semibold ${net >= 0 ? 'text-[var(--legal)]' : 'text-[var(--illegal)]'}`}>
                  Net {net >= 0 ? '+' : '−'}
                  {m(Math.abs(net))}
                </div>
              </div>
              {incoming.length === 0 && outgoing.length === 0 ? (
                <div className="mt-2 text-sm text-[var(--faint)]">No assets exchanged</div>
              ) : (
                <div className="mt-2.5 space-y-1.5">
                  {incoming.map((a) => row(a, '+'))}
                  {outgoing.map((a) => row(a, '−'))}
                </div>
              )}
              {tg && (incoming.length > 0 || outgoing.length > 0) && (
                <div className="mt-2 border-t border-[var(--border-soft)] pt-1.5 num text-[11px] text-[var(--faint)]">
                  Talent net {tg.net > 0 ? '+' : ''}
                  {tg.net} · cap value {tg.surplusNet > 0 ? '+' : ''}
                  {tg.surplusNet}
                </div>
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
