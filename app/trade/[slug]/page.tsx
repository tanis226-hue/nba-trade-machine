import { getTrade } from '@/lib/data/queries';
import { selectValidation } from '@/lib/store/selectValidation';
import { ValidationFeed } from '@/components/ValidationFeed';
import type { TradeAsset, TradeTeamInput } from '@/lib/cba/types';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const m = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

export default async function SharedTrade({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const payload = await getTrade(slug);
  if (!payload) notFound();

  const teams = payload.teams as TradeTeamInput[];
  const assets = payload.assets as Record<string, TradeAsset>;
  const validation = selectValidation({ season: payload.season, teams, assets });
  const list = Object.values(assets);

  return (
    <main className="rise space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--faint)]">Shared proposal · {payload.season}</div>
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-[var(--text)]">Proposed Trade</h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {teams.map((t) => {
          const receives = list.filter((a) => a.toTeam === t.abbr && a.fromTeam !== t.abbr);
          return (
            <div key={t.abbr} className="panel rounded-xl p-4">
              <div className="font-display text-lg font-semibold uppercase tracking-wide text-[var(--text)]">{t.abbr}</div>
              {receives.length === 0 && <div className="mt-1 text-sm text-[var(--faint)]">No incoming assets</div>}
              <div className="mt-2 space-y-1">
                {receives.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm text-[var(--text)]">
                    <span className="text-[var(--legal)]">+ {a.label}</span>
                    {a.salary > 0 && <span className="num text-xs text-[var(--muted)]">{m(a.salary)}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <ValidationFeed validation={validation} />
      <a href="/" className="inline-block font-display text-sm font-semibold uppercase tracking-wide text-[var(--accent)] hover:brightness-110">
        Build your own trade →
      </a>
    </main>
  );
}
