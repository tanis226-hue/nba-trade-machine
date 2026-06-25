import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { saveUserTrade } from '@/lib/data/queries';

// Save the current board under the signed-in user. The user id comes from the Clerk session on the
// server - never from the request body - so a caller can't save under someone else's account.
export async function POST(req: NextRequest) {
  if (!process.env.CLERK_SECRET_KEY) {
    return NextResponse.json({ error: 'auth_disabled' }, { status: 501 });
  }
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const slug = await saveUserTrade({
    userId,
    title: typeof body.title === 'string' ? body.title : 'Untitled trade',
    slug: typeof body.slug === 'string' ? body.slug : undefined,
    payload: {
      season: body.season,
      teams: body.teams,
      assets: body.assets,
      simulatedDate: body.simulatedDate,
      tradeMethod: body.tradeMethod,
    },
  });
  return NextResponse.json({ slug });
}
