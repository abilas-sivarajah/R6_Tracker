// R6Data provider (https://r6data.com) — a hosted service that fetches the
// official Rainbow Six Siege data server-side and exposes it behind a simple
// API key. This sidesteps the Ubisoft login entirely (no DataDome, no 2FA, no
// per-IP login rate limit), so it works from any network and when deployed.
//
// Get a free key at https://r6data.com and set R6DATA_API_KEY in .env.local.

import { OPERATOR_ICONS } from './operatorIcons';
import { parseFullProfiles, type FullProfilesData } from './ubi';
import type {
  BoardStats,
  GeneralStats,
  OperatorBrief,
  PlayerData,
  Platform,
  RecentMatch,
} from './types';

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

/** Defensively read a ban flag from R6Data's isBanned response. */
function pickBanned(res: unknown): boolean {
  if (!res || typeof res !== 'object') return false;
  const r = res as Record<string, unknown>;
  for (const k of ['isBanned', 'banned', 'is_banned']) {
    if (typeof r[k] === 'boolean') return r[k] as boolean;
  }
  // Some APIs return a list of bans.
  const bans = (r.bans ?? r.sanctions) as unknown;
  if (Array.isArray(bans)) return bans.length > 0;
  return false;
}

function pickAvatar(account: unknown, username: string): string {
  const a = (account ?? {}) as Record<string, unknown>;
  // R6Data returns a ready-to-use avatar URL.
  const pic = a.profilePicture as string | undefined;
  if (pic) return pic.replace('_146_146', '_256_256');
  const uid = (a.profileId as string) ?? (a.userId as string) ?? '';
  if (uid) return `https://ubisoft-avatars.akamaized.net/${uid}/default_256_256.png`;
  const letter = (username[0] ?? 'R').toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="76">` +
    `<rect width="76" height="76" rx="12" fill="#4d8bf0"/>` +
    `<text x="38" y="50" font-family="Arial" font-size="34" font-weight="bold" fill="#fff" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** R6Data hosts rank tier images, e.g. .../bronze-5.webp. */
function rankImageUrl(name: string): string | null {
  if (!name || name === 'Unranked') return null;
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  return `https://r6data.com/assets/img/r6_ranks_img/${slug}.webp`;
}

/** Swap the generated SVG rank icons for R6Data's real tier images. */
function withRealRankIcons(board: BoardStats | null): BoardStats | null {
  if (!board) return board;
  board.current.icon = rankImageUrl(board.current.name) ?? board.current.icon;
  board.max.icon = rankImageUrl(board.max.name) ?? board.max.icon;
  return board;
}

/** Small side-coloured operator badge (no external icon hosting needed). */
function operatorIcon(name: string, side: string): string {
  const color = side === 'Attacker' ? '#e8732a' : '#3b82f6';
  const label = name.trim().slice(0, 3);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">` +
    `<rect width="48" height="48" rx="8" fill="${color}"/>` +
    `<text x="24" y="30" font-family="Arial" font-size="15" font-weight="bold" fill="#0b0e14" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface RawOperator {
  operator: string;
  side: string;
  kd: number;
  winPercent: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  headshots: number;
  roundsPlayed: number;
  matchesPlayed: number;
  timePlayedMs: number;
}

function normalizeOpName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function mapOperators(ops: RawOperator[]): OperatorBrief[] {
  return ops.slice(0, 8).map((o) => ({
    name: o.operator.trim(),
    icon: OPERATOR_ICONS[normalizeOpName(o.operator)] ?? operatorIcon(o.operator, o.side),
    kills: o.kills,
    deaths: o.deaths,
    kd: o.kd,
    winRate: `${o.winPercent}%`,
    matches: o.matchesPlayed,
    playtime: Math.round((o.timePlayedMs / 3_600_000) * 10) / 10,
  }));
}

/** Aggregate per-operator (ranked) stats into a career overview. */
function aggregateGeneral(ops: RawOperator[]): GeneralStats | null {
  if (ops.length === 0) return null;
  let kills = 0, deaths = 0, headshots = 0, wins = 0, losses = 0, rounds = 0, ms = 0;
  for (const o of ops) {
    kills += o.kills;
    deaths += o.deaths;
    headshots += o.headshots;
    wins += o.wins;
    losses += o.losses;
    rounds += o.roundsPlayed;
    ms += o.timePlayedMs;
  }
  return {
    kills,
    deaths,
    kd: deaths > 0 ? Math.round((kills / deaths) * 100) / 100 : kills,
    wins,
    losses,
    winRate: wins + losses > 0 ? `${((wins / (wins + losses)) * 100).toFixed(1)}%` : '0%',
    matches: rounds,
    headshots,
    headshotPercent: kills > 0 ? `${((headshots / kills) * 100).toFixed(1)}%` : '0%',
    playtimeHours: Math.round((ms / 3_600_000) * 10) / 10,
  };
}

interface RawHistoryPoint {
  0: string; // timestamp
  1: { value: number; metadata?: { rank?: string; color?: string; imageUrl?: string } };
}

function historyArray(seasonal: unknown): RawHistoryPoint[] {
  const data = (seasonal as { data?: { history?: { data?: RawHistoryPoint[] } } })
    ?.data?.history?.data;
  return Array.isArray(data) ? data : [];
}

/**
 * Derive recent ranked matches from the RP timeline: each consecutive pair of
 * points is one match — RP up = win, RP down = loss. (R6Data has no per-match
 * endpoint; this mirrors how trackers show "recent matches".)
 */
function parseRecentMatches(seasonal: unknown): RecentMatch[] {
  const data = historyArray(seasonal); // newest first
  const out: RecentMatch[] = [];
  for (let i = 0; i < data.length - 1 && out.length < 20; i++) {
    const cur = data[i];
    const prev = data[i + 1];
    const rp = cur[1]?.value ?? 0;
    const rpChange = rp - (prev[1]?.value ?? 0);
    if (rpChange === 0) continue;
    const meta = cur[1]?.metadata ?? {};
    out.push({
      date: cur[0],
      result: rpChange > 0 ? 'win' : 'loss',
      rpChange,
      rp,
      rank: meta.rank ?? '',
      rankImage: meta.imageUrl ?? '',
    });
  }
  return out;
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
  const ranked = withRealRankIcons(profiles.ranked);
  const casual = withRealRankIcons(profiles.casual);

  const grab = async <T>(params: Record<string, string>, label: string): Promise<T | null> => {
    try {
      return await r6dataGet<T>(params);
    } catch (err) {
      console.error(
        `[r6-tracker] R6Data ${label} failed (continuing):`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  };

  // Fetch the remaining pieces in parallel (all best-effort).
  const [account, operatorsRes, seasonal, banRes] = await Promise.all([
    grab<unknown>({ type: 'accountInfo', nameOnPlatform: username, platformType: platform }, 'accountInfo'),
    grab<{ operators?: RawOperator[] }>(
      { type: 'operatorStats', nameOnPlatform: username, platformType: platform, modes: 'ranked' },
      'operatorStats',
    ),
    grab<unknown>({ type: 'seasonalStats', nameOnPlatform: username, platformType: platform }, 'seasonalStats'),
    grab<unknown>({ type: 'isBanned', nameOnPlatform: username, platformType: platform }, 'isBanned'),
  ]);

  const { level, xp } = pickLevel(account ?? {});
  const operators = operatorsRes?.operators ?? [];

  // Inactivity: how many seasons behind the current one is the player's data.
  const currentSeason = Number(process.env.R6_CURRENT_SEASON ?? 42);
  const inactiveSeasons =
    profiles.seasonId > 0 && profiles.seasonId < currentSeason
      ? currentSeason - profiles.seasonId
      : 0;

  // Make the current ranked rank authoritative: use R6Data's own rank name +
  // image from the latest seasonalStats point. This stays correct across rank
  // system changes (e.g. Ranked 3.0 / v7) without hardcoding the rank table.
  const latest = historyArray(seasonal)[0];
  const latestMeta = latest?.[1]?.metadata;
  if (ranked && latestMeta?.rank) {
    ranked.current = {
      ...ranked.current,
      name: latestMeta.rank,
      mmr: latest[1]?.value ?? ranked.current.mmr,
      icon: latestMeta.imageUrl || ranked.current.icon,
    };
  }

  return {
    id: username,
    username,
    platform,
    avatar: pickAvatar(account, username),
    level,
    xp,
    ranked,
    casual,
    currentSeasonName: profiles.seasonId > 0 ? `Season ${profiles.seasonId}` : '',
    currentRegion: '',
    banned: pickBanned(banRes),
    inactiveSeasons,
    history: [],
    recentMatches: parseRecentMatches(seasonal),
    general: aggregateGeneral(operators),
    topOperators: mapOperators(operators),
    matches: [],
  };
}
