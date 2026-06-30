// R6Data provider (https://r6data.com) — a hosted service that fetches the
// official Rainbow Six Siege data server-side and exposes it behind a simple
// API key. This sidesteps the Ubisoft login entirely (no DataDome, no 2FA, no
// per-IP login rate limit), so it works from any network and when deployed.
//
// Get a free key at https://r6data.com and set R6DATA_API_KEY in .env.local.

import { parseFullProfiles, type FullProfilesData } from './ubi';
import type { PlayerData, Platform } from './types';

const BASE = 'https://api.r6data.com/api';

export function hasR6DataKey(): boolean {
  return !!(process.env.R6DATA_API_KEY ?? process.env.R6_DATA_KEY);
}

function apiKey(): string {
  const k = process.env.R6DATA_API_KEY ?? process.env.R6_DATA_KEY;
  if (!k) throw new Error('Missing R6DATA_API_KEY in .env.local');
  return k;
}

async function r6dataGet<T>(params: Record<string, string>): Promise<T> {
  const url = `${BASE}/stats?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { headers: { 'api-key': apiKey() } });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`R6Data non-JSON response (HTTP ${res.status}): ${text.slice(0, 120)}`);
  }
  if (!res.ok) {
    if (res.status === 401) throw new Error('R6Data: invalid API key (401).');
    if (res.status === 404) return null as T;
    const msg = (data as { message?: string; error?: string })?.message ??
      (data as { error?: string })?.error ?? `HTTP ${res.status}`;
    throw new Error(`R6Data error: ${msg}`);
  }
  return data as T;
}

/** Read a level/xp from R6Data's accountInfo response defensively. */
function pickLevel(account: unknown): { level: number; xp: number } {
  const a = (account ?? {}) as Record<string, unknown>;
  const num = (...keys: string[]): number => {
    for (const k of keys) {
      const v = a[k];
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
        return Number(v);
      }
    }
    return 0;
  };
  return {
    level: num('level', 'clearance_level', 'clearanceLevel'),
    xp: num('xp', 'experience'),
  };
}

function pickAvatar(account: unknown, username: string): string {
  const a = (account ?? {}) as Record<string, unknown>;
  const uid =
    (a.profileId as string) ??
    (a.userId as string) ??
    (a.id as string) ??
    '';
  if (uid) return `https://ubisoft-avatars.akamaized.net/${uid}/default_256_256.png`;
  // Fallback: a simple generated avatar so the UI still looks complete.
  const letter = (username[0] ?? 'R').toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="76">` +
    `<rect width="76" height="76" rx="12" fill="#4d8bf0"/>` +
    `<text x="38" y="50" font-family="Arial" font-size="34" font-weight="bold" fill="#fff" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Temporary helper: fetch the raw R6Data responses we don't yet map, so their
 * exact shapes can be inspected (avatar id, operators, seasonal history).
 */
export async function getR6DataRawDebug(
  platform: Platform,
  username: string,
): Promise<Record<string, unknown>> {
  const family = platform === 'uplay' ? 'pc' : 'console';
  const grab = async (params: Record<string, string>) => {
    try {
      return await r6dataGet<unknown>(params);
    } catch (err) {
      return { __error: err instanceof Error ? err.message : String(err) };
    }
  };
  const [accountInfo, operatorStats, seasonalStats, stats] = await Promise.all([
    grab({ type: 'accountInfo', nameOnPlatform: username, platformType: platform }),
    grab({ type: 'operatorStats', nameOnPlatform: username, platformType: platform, modes: 'ranked' }),
    grab({ type: 'seasonalStats', nameOnPlatform: username, platformType: platform }),
    grab({ type: 'stats', nameOnPlatform: username, platformType: platform, platform_families: family }),
  ]);
  return { accountInfo, operatorStats, seasonalStats, stats };
}

export async function getPlayerDataViaR6Data(
  platform: Platform,
  username: string,
): Promise<PlayerData | null> {
  const family = platform === 'uplay' ? 'pc' : 'console';

  // Stats (current ranked + casual) — same payload shape as Ubisoft.
  const stats = await r6dataGet<FullProfilesData | null>({
    type: 'stats',
    nameOnPlatform: username,
    platformType: platform,
    platform_families: family,
  });
  // No profile structure => player not found.
  if (!stats || !stats.platform_families_full_profiles) return null;

  const profiles = parseFullProfiles(stats);

  // Account info (level/xp) — best-effort.
  let level = 0;
  let xp = 0;
  let avatar = pickAvatar(null, username);
  try {
    const account = await r6dataGet<unknown>({
      type: 'accountInfo',
      nameOnPlatform: username,
      platformType: platform,
    });
    const lv = pickLevel(account);
    level = lv.level;
    xp = lv.xp;
    avatar = pickAvatar(account, username);
  } catch (err) {
    console.error(
      '[r6-tracker] R6Data accountInfo failed (continuing):',
      err instanceof Error ? err.message : err,
    );
  }

  return {
    id: username,
    username,
    platform,
    avatar,
    level,
    xp,
    ranked: profiles.ranked,
    casual: profiles.casual,
    currentSeasonName: profiles.seasonId > 0 ? `Season ${profiles.seasonId}` : '',
    currentRegion: '',
    history: [],
    general: null,
    topOperators: [],
    matches: [],
  };
}
