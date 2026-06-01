import { ImageResponse } from 'next/og';
import { getTrade } from '@/lib/data/queries';
import type { TradeTeamInput, TradeAsset } from '@/lib/cba/types';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';

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
          {teams.map((t) => (
            <div
              key={t.abbr}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #2a3350', borderRadius: 12, padding: 16 }}
            >
              <div style={{ fontSize: 40, fontWeight: 700 }}>{t.abbr}</div>
              {assets
                .filter((a) => a.toTeam === t.abbr && a.fromTeam !== t.abbr)
                .slice(0, 6)
                .map((a) => (
                  <div key={a.id} style={{ fontSize: 22, marginTop: 6 }}>
                    {`+ ${a.label}`}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
