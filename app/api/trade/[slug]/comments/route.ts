import { NextResponse } from 'next/server';
import { db, hasDb } from '@/lib/data/db';
import { z } from 'zod';
import { validSlug } from '@/lib/trades/schema';
import { readJson,RequestError,errorResponse } from '@/lib/http/request';
import { limitWrite } from '@/lib/http/rateLimit';

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
  if(!validSlug(slug)) return NextResponse.json({error:'Trade not found'},{status:404});
  if (!hasDb()) return NextResponse.json({ comments: [] as TradeComment[] });

  const rows = await db()`
    SELECT id, body, author, created_at
    FROM trade_comments WHERE slug = ${slug}
    ORDER BY created_at DESC LIMIT 50`;
  return NextResponse.json({ comments: rows as TradeComment[] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
  if(!validSlug(slug)) throw new RequestError(404,'Trade not found');
  if(!hasDb()) throw new RequestError(503,'Comments are unavailable in this demo');
  await limitWrite(req,'comment',30);
  const parsed=z.object({body:z.string().trim().min(1).max(1000),author:z.string().trim().max(80).optional()}).strict().safeParse(await readJson(req,8000));
  if(!parsed.success) throw new RequestError(400,'Use 1–1,000 characters for a comment and at most 80 for a name');
  const {body:text,author}=parsed.data;
  if(!(await db()`SELECT 1 FROM trades WHERE slug=${slug}`)[0]) throw new RequestError(404,'Trade not found');

  const id = crypto.randomUUID();
  const rows = await db()`
    INSERT INTO trade_comments (id, slug, body, author)
    VALUES (${id}, ${slug}, ${text}, ${author?.trim() || null})
    RETURNING id, body, author, created_at`;
  return NextResponse.json({ comment: rows[0] as TradeComment },{status:201});
  } catch(error) {return errorResponse(error);}
}
