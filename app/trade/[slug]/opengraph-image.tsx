import { ImageResponse } from 'next/og';
import { getTrade } from '@/lib/data/queries';
import type { TradeTeamInput, TradeAsset } from '@/lib/cba/types';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';
const salary = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const cash = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const payload = await getTrade(slug);
  const teams = (payload?.teams as TradeTeamInput[] | undefined) ?? [];
  const assets = Object.values((payload?.assets as Record<string, TradeAsset> | undefined) ?? {});

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0b1020', color: 'white', padding: 48 }}>
        <div style={{ fontSize: 34, opacity: 0.7 }}>NBA Trade Machine</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 24, flex: 1 }}>
          {teams.map((t) => {
            const incoming = assets.filter((a) => a.toTeam === t.abbr && a.fromTeam !== t.abbr);
            const outgoing = assets.filter((a) => a.fromTeam === t.abbr && a.toTeam !== t.abbr);
            const salaryNet = incoming.reduce((s, a) => s + (a.kind === 'player' ? a.salary : 0), 0) - outgoing.reduce((s, a) => s + (a.kind === 'player' ? a.salary : 0), 0);
            const cashReceived = incoming.reduce((s, a) => s + (a.kind === 'cash' ? a.amount ?? 0 : 0), 0);
            const cashSent = outgoing.reduce((s, a) => s + (a.kind === 'cash' ? a.amount ?? 0 : 0), 0);
            const cashNet = cashReceived - cashSent;
            const hasCash = [...incoming, ...outgoing].some((a) => a.kind === 'cash');
            return (
            <div
              key={t.abbr}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #2a3350', borderRadius: 12, padding: 16 }}
            >
              <div style={{ fontSize: 40, fontWeight: 700 }}>{t.abbr}</div>
              <div style={{ fontSize: teams.length > 4 ? 13 : 18, marginTop: 4, opacity: 0.8 }}>{`Net salary ${salaryNet > 0 ? '+' : salaryNet < 0 ? '−' : ''}${salary(Math.abs(salaryNet))}`}</div>
              {incoming
                .slice(0, 7)
                .map((a) => (
                  <div key={a.id} style={{ fontSize: teams.length > 4 ? 14 : 22, marginTop: 6 }}>
                    {`+ ${a.label}${a.kind === 'cash' ? ` ${cash(a.amount ?? 0)}` : ''}`}
                  </div>
                ))}
              {hasCash && <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', paddingTop: 16, fontSize: teams.length > 4 ? 12 : 17, opacity: 0.9 }}>
                <div>{`Cash sent ${cash(cashSent)}`}</div>
                <div style={{ marginTop: 4 }}>{`Cash received ${cash(cashReceived)}`}</div>
                <div style={{ marginTop: 4 }}>{`Net cash ${cashNet > 0 ? '+' : cashNet < 0 ? '−' : ''}${cash(Math.abs(cashNet))}`}</div>
              </div>}
            </div>
          );})}
        </div>
      </div>
    ),
    size,
  );
}
