import { NextRequest, NextResponse } from 'next/server';
import { saveTrade } from '@/lib/data/queries';
import { tradeSchema } from '@/lib/trades/schema';
import { snapshotTrade } from '@/lib/trades/snapshot';
import { readJson, RequestError, errorResponse } from '@/lib/http/request';
import { limitWrite } from '@/lib/http/rateLimit';

export async function POST(req: NextRequest) {
  try {
    await limitWrite(req,'share');
    const parsed=tradeSchema.safeParse(await readJson(req));
    if(!parsed.success) throw new RequestError(400,parsed.error.issues[0]?.message??'Invalid trade');
    const slug=await saveTrade(snapshotTrade(parsed.data));
    return NextResponse.json({slug},{status:201});
  } catch(error) {return errorResponse(error);}
}
