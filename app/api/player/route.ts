import { NextResponse } from 'next/server';

import { getDemoPlayer } from '@/lib/demo';
import { getPlayerData } from '@/lib/r6';
import type { Platform } from '@/lib/types';

// r6api.js + node-fetch need the Node.js runtime (not Edge).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_PLATFORMS: Platform[] = ['uplay', 'psn', 'xbl'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username')?.trim();
  const platform = (searchParams.get('platform') ?? 'uplay') as Platform;

  if (!username) {
    return NextResponse.json(
      { error: 'Bitte einen Nutzernamen angeben.' },
      { status: 400 },
    );
  }

  if (!VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { error: `Ungültige Plattform: ${platform}` },
      { status: 400 },
    );
  }

  // Demo mode: serve mock data without Ubisoft credentials / network.
  if (process.env.R6_DEMO === '1') {
    return NextResponse.json(getDemoPlayer(platform, username));
  }

  try {
    const data = await getPlayerData(platform, username);
    if (!data) {
      return NextResponse.json(
        { error: `Kein Spieler "${username}" auf dieser Plattform gefunden.` },
        { status: 404 },
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unbekannter Fehler beim Abruf.';
    console.error('[r6-tracker] player lookup failed:', err);
    // Surface credential/config errors clearly, but don't leak internals otherwise.
    const isConfig = message.includes('Ubisoft credentials');
    return NextResponse.json(
      {
        error: isConfig
          ? message
          : 'Daten konnten nicht abgerufen werden. Eventuell ist die Ubisoft-API gerade nicht erreichbar oder die Zugangsdaten sind ungültig.',
      },
      { status: isConfig ? 500 : 502 },
    );
  }
}
