import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { saveUserTrade } from '@/lib/data/queries';
import { saveTradeSchema } from '@/lib/trades/schema';
import { snapshotTrade } from '@/lib/trades/snapshot';
import { readJson,RequestError,errorResponse } from '@/lib/http/request';
import { limitWrite } from '@/lib/http/rateLimit';

// Save the current board under the signed-in user. The user id comes from the Clerk session on the
// server - never from the request body - so a caller can't save under someone else's account.
export async function POST(req: NextRequest) {
  if (!process.env.CLERK_SECRET_KEY) {
    return NextResponse.json({ error: 'auth_disabled' }, { status: 501 });
  }
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
  await limitWrite(req,'account-save',40);
  const parsed=saveTradeSchema.safeParse(await readJson(req));
  if(!parsed.success) throw new RequestError(400,parsed.error.issues[0]?.message??'Invalid trade');
  const {title,slug:existingSlug,...payload}=parsed.data;
  const slug = await saveUserTrade({
    userId,
    title,slug:existingSlug,payload:snapshotTrade(payload),
  });
  return NextResponse.json({ slug });
  } catch(error) {return errorResponse(error);}
}
