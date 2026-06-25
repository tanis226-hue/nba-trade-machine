import { NextResponse } from 'next/server';
import { db, hasDb } from '@/lib/data/db';

export const dynamic = 'force-dynamic';

type Tally = { up: number; down: number };

async function tally(slug: string): Promise<Tally> {
  const rows = await db()`
    SELECT
      COALESCE(SUM(CASE WHEN vote > 0 THEN 1 ELSE 0 END), 0)::int AS up,
      COALESCE(SUM(CASE WHEN vote < 0 THEN 1 ELSE 0 END), 0)::int AS down
    FROM trade_votes WHERE slug = ${slug}`;
  return { up: rows[0]?.up ?? 0, down: rows[0]?.down ?? 0 };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!hasDb()) return NextResponse.json({ up: 0, down: 0 } satisfies Tally);

  const { vote, voter } = (await req.json().catch(() => ({}))) as { vote?: number; voter?: string };
  const v = vote && vote < 0 ? -1 : 1;
  const voterId = typeof voter === 'string' && voter ? voter.slice(0, 64) : crypto.randomUUID();

  // One vote per voter per trade; re-voting flips the existing row (requires the 0009 unique index).
  try {
    await db()`
      INSERT INTO trade_votes (id, slug, vote, voter)
      VALUES (${crypto.randomUUID()}, ${slug}, ${v}, ${voterId})
      ON CONFLICT (slug, voter) DO UPDATE SET vote = ${v}`;
  } catch {
    await db()`INSERT INTO trade_votes (id, slug, vote) VALUES (${crypto.randomUUID()}, ${slug}, ${v})`;
  }

  return NextResponse.json(await tally(slug));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!hasDb()) return NextResponse.json({ up: 0, down: 0 } satisfies Tally);
  return NextResponse.json(await tally(slug));
}
