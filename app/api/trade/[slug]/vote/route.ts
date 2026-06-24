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

  const { vote } = (await req.json().catch(() => ({}))) as { vote?: number };
  const v = vote && vote < 0 ? -1 : 1;

  await db()`
    INSERT INTO trade_votes (id, slug, vote)
    VALUES (${crypto.randomUUID()}, ${slug}, ${v})`;

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
