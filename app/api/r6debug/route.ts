import { NextResponse } from 'next/server';

import { getR6DataRawDebug } from '@/lib/r6data';
import type { Platform } from '@/lib/types';

// Temporary: dumps the raw R6Data responses so the exact field shapes can be
// mapped (avatar id, operators, seasonal history). Remove after wiring them up.
// Open: http://localhost:3000/api/r6debug?username=Z_Fighter1999

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username')?.trim();
  const platform = (searchParams.get('platform') ?? 'uplay') as Platform;
  if (!username) {
    return NextResponse.json({ error: 'username query param required' }, { status: 400 });
  }
  try {
    const raw = await getR6DataRawDebug(platform, username);
    return NextResponse.json(raw);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
