import { NextResponse } from 'next/server';
import { db, hasDb } from '@/lib/data/db';
import { z } from 'zod';
import { validSlug } from '@/lib/trades/schema';
import { readJson,RequestError,errorResponse } from '@/lib/http/request';
import { limitWrite } from '@/lib/http/rateLimit';

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
  try {
  if(!validSlug(slug)) throw new RequestError(404,'Trade not found');
  if(!hasDb()) throw new RequestError(503,'Voting is unavailable in this demo');
  await limitWrite(req,'vote',60);
  const parsed=z.object({vote:z.union([z.literal(1),z.literal(-1)]),voter:z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/)}).strict().safeParse(await readJson(req,2000));
  if(!parsed.success) throw new RequestError(400,'Invalid vote');
  const {vote:v,voter:voterId}=parsed.data;
  if(!(await db()`SELECT 1 FROM trades WHERE slug=${slug}`)[0]) throw new RequestError(404,'Trade not found');

  // One vote per voter per trade; re-voting flips the existing row (requires the trade_votes
  // (slug, voter) unique index trade_votes_slug_voter_uq from migration 0009_vote_dedupe).
    await db()`
      INSERT INTO trade_votes (id, slug, vote, voter)
      VALUES (${crypto.randomUUID()}, ${slug}, ${v}, ${voterId})
      ON CONFLICT (slug, voter) DO UPDATE SET vote = ${v}`;
  return NextResponse.json(await tally(slug));
  } catch(error) {return errorResponse(error);}
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if(!validSlug(slug)) return NextResponse.json({error:'Trade not found'},{status:404});
  if (!hasDb()) return NextResponse.json({ up: 0, down: 0 } satisfies Tally);
  return NextResponse.json(await tally(slug));
}
