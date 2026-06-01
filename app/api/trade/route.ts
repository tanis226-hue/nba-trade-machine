import { NextRequest, NextResponse } from 'next/server';
import { saveTrade } from '@/lib/data/queries';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const slug = await saveTrade({ season: body.season, teams: body.teams, assets: body.assets, contracts: body.contracts });
  return NextResponse.json({ slug });
}
