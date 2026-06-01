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
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">Proposed Trade · {payload.season}</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {teams.map((t) => {
          const receives = list.filter((a) => a.toTeam === t.abbr && a.fromTeam !== t.abbr);
          return (
            <div key={t.abbr} className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
              <div className="font-bold">{t.abbr}</div>
              {receives.length === 0 && <div className="text-sm text-neutral-400">No incoming assets</div>}
              {receives.map((a) => (
                <div key={a.id} className="flex justify-between text-sm">
                  <span>Receives: {a.label}</span>
                  {a.salary > 0 && <span className="tabular-nums text-neutral-500">{m(a.salary)}</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <ValidationFeed validation={validation} />
      <a href="/" className="inline-block text-sm text-sky-700 underline">
        Build your own trade →
      </a>
    </main>
  );
}
