import { NextResponse } from 'next/server';
import { db, hasDb } from '@/lib/data/db';

export const dynamic = 'force-dynamic';

export type TradeComment = {
  id: string;
  body: string;
  author: string | null;
  created_at: string;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!hasDb()) return NextResponse.json({ comments: [] as TradeComment[] });

  const rows = await db()`
    SELECT id, body, author, created_at
    FROM trade_comments WHERE slug = ${slug}
    ORDER BY created_at DESC`;
  return NextResponse.json({ comments: rows as TradeComment[] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!hasDb()) return NextResponse.json({ comment: null });

  const { body, author } = (await req.json().catch(() => ({}))) as {
    body?: string;
    author?: string;
  };
  const text = (body ?? '').trim();
  if (!text) return NextResponse.json({ comment: null }, { status: 400 });

  const id = crypto.randomUUID();
  const rows = await db()`
    INSERT INTO trade_comments (id, slug, body, author)
    VALUES (${id}, ${slug}, ${text}, ${author?.trim() || null})
    RETURNING id, body, author, created_at`;
  return NextResponse.json({ comment: rows[0] as TradeComment });
}
