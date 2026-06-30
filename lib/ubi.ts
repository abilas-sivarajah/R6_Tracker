// Minimal, self-contained Ubisoft R6 client built on Node's global fetch.
// Uses the *current* Ubisoft endpoints (the r6api.js library targets 2022-era
// routes that now 404). Authentication mirrors what still works today:
//   - login with Basic auth -> session ticket ("key")
//   - a second login authenticated with that ticket -> "new" ticket, required
//     by some newer endpoints (full_profiles, rewards/level)
// A browser User-Agent + a `datadome` cookie (R6_DATADOME) are sent on every
// request to get past Ubisoft's DataDome anti-bot.

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { BoardStats, Platform, RankInfo } from './types';

const APP_ID = process.env.R6_UBI_APPID ?? 'e3d5ea9e-50bd-43b7-88bf-39794f4e3d40';
const XPLAY_SPACE = '0d2ae42d-4c27-4cb7-af6c-2099062302bb';
const UBISERVICES = 'https://public-ubiservices.ubi.com';

const BROWSER_UA =
  process.env.R6_USER_AGENT ??
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Ranked 2.0 (season 28 / Y7S4 onward). Index = rank id returned by the API.
const RANKS_V6 = [
  'Unranked',
  'Copper 5', 'Copper 4', 'Copper 3', 'Copper 2', 'Copper 1',
  'Bronze 5', 'Bronze 4', 'Bronze 3', 'Bronze 2', 'Bronze 1',
  'Silver 5', 'Silver 4', 'Silver 3', 'Silver 2', 'Silver 1',
  'Gold 5', 'Gold 4', 'Gold 3', 'Gold 2', 'Gold 1',
  'Platinum 5', 'Platinum 4', 'Platinum 3', 'Platinum 2', 'Platinum 1',
  'Emerald 5', 'Emerald 4', 'Emerald 3', 'Emerald 2', 'Emerald 1',
  'Diamond 5', 'Diamond 4', 'Diamond 3', 'Diamond 2', 'Diamond 1',
  'Champions',
];

const TIER_COLORS: Record<string, string> = {
  Unranked: '#6b7280',
  Copper: '#b4764a',
  Bronze: '#cd7f32',
  Silver: '#9aa7b5',
  Gold: '#e8b13a',
  Platinum: '#28aab4',
  Emerald: '#2fb56a',
  Diamond: '#5bc8ff',
  Champions: '#d14fd1',
};

/** Build a self-contained SVG rank badge (no external icon hosting needed). */
function rankIcon(name: string): string {
  const tier = name.split(' ')[0];
  const color = TIER_COLORS[tier] ?? '#6b7280';
  const label =
    name === 'Unranked' || name === 'Champions'
      ? tier[0]
      : `${tier[0]}${name.split(' ')[1] ?? ''}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0b0e14"/>` +
    `</linearGradient></defs>` +
    `<path d="M32 4 L58 14 V34 C58 48 46 57 32 62 C18 57 6 48 6 34 V14 Z" fill="url(#g)" stroke="${color}" stroke-width="2"/>` +
    `<text x="32" y="40" font-family="Arial" font-size="20" font-weight="bold" fill="#fff" text-anchor="middle">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function rankInfo(id: number, points: number): RankInfo {
  const name = RANKS_V6[id] ?? 'Unranked';
  return { id, name, mmr: points, icon: rankIcon(name) };
}

// --- auth -------------------------------------------------------------------

interface Tickets {
  key: string;
  newKey: string;
  sessionId: string;
  keyExp: number;
  newKeyExp: number;
}

let tickets: Tickets | null = null;

// Persist tickets to disk so we don't re-login on every request or restart
// (Ubisoft rate-limits logins per IP: "Too many calls per IP address").
const TICKETS_FILE = path.join(os.tmpdir(), 'r6-tracker-tickets.json');

async function loadTicketsFromDisk(): Promise<Tickets | null> {
  try {
    const raw = await fs.readFile(TICKETS_FILE, 'utf8');
    return JSON.parse(raw) as Tickets;
  } catch {
    return null;
  }
}

async function saveTicketsToDisk(t: Tickets): Promise<void> {
  try {
    await fs.writeFile(TICKETS_FILE, JSON.stringify(t), 'utf8');
  } catch {
    /* best-effort cache */
  }
}

// Only the primary key is required to be valid; the "new" key is fetched
// lazily (and only if an endpoint actually rejects the primary key) to halve
// the number of login calls and stay under Ubisoft's per-IP login rate limit.
function isValid(t: Tickets | null, now: number): t is Tickets {
  return !!t && t.keyExp > now;
}

function dataDomeCookie(): string | null {
  const raw = process.env.R6_DATADOME?.trim();
  if (!raw) return null;
  return `datadome=${raw.replace(/^datadome=/i, '')}`;
}

function baseHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    'Ubi-AppId': APP_ID,
    'User-Agent': BROWSER_UA,
    'Content-Type': 'application/json; charset=UTF-8',
  };
  const cookie = dataDomeCookie();
  if (cookie) h.Cookie = cookie;
  return h;
}

interface SessionResponse {
  ticket?: string;
  expiration?: string;
  sessionId?: string;
  message?: string;
  httpCode?: number;
}

async function postSession(authHeader: string): Promise<SessionResponse> {
  const res = await fetch(`${UBISERVICES}/v3/profiles/sessions`, {
    method: 'POST',
    headers: { ...baseHeaders(), Authorization: authHeader },
    body: JSON.stringify({ rememberMe: true }),
  });
  const text = await res.text();
  let data: SessionResponse;
  try {
    data = JSON.parse(text) as SessionResponse;
  } catch {
    throw new Error(
      `Login blocked (HTTP ${res.status}). Likely DataDome — refresh R6_DATADOME. Body: ${text.slice(0, 120)}`,
    );
  }
  if (!data.ticket) {
    if ('twoFactorAuthenticationTicket' in (data as object)) {
      throw new Error('2FA is enabled on the Ubisoft account — disable it.');
    }
    throw new Error(
      data.message ? `Ubisoft login failed: ${data.message}` : 'Ubisoft login failed (no ticket).',
    );
  }
  return data;
}

// Self-imposed login cooldown: when Ubisoft replies "Too many calls per IP",
// stop attempting logins for a while so repeated requests don't extend the ban.
const COOLDOWN_FILE = path.join(os.tmpdir(), 'r6-tracker-cooldown.json');
const COOLDOWN_MS = Number(process.env.R6_LOGIN_COOLDOWN_MS ?? 20 * 60 * 1000);

async function getCooldownUntil(): Promise<number> {
  try {
    const raw = await fs.readFile(COOLDOWN_FILE, 'utf8');
    return (JSON.parse(raw) as { until?: number }).until ?? 0;
  } catch {
    return 0;
  }
}

async function setCooldown(until: number): Promise<void> {
  try {
    await fs.writeFile(COOLDOWN_FILE, JSON.stringify({ until }), 'utf8');
  } catch {
    /* best-effort */
  }
}

let inflight: Promise<Tickets> | null = null;

function getTickets(): Promise<Tickets> {
  const now = Date.now();
  if (isValid(tickets, now)) return Promise.resolve(tickets);
  // De-duplicate concurrent logins so we never double-hit the rate-limited
  // login endpoint.
  if (inflight) return inflight;
  inflight = resolveTickets(now).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function resolveTickets(now: number): Promise<Tickets> {
  // on-disk cache (survives restarts / dev hot-reloads)
  const onDisk = await loadTicketsFromDisk();
  if (isValid(onDisk, now)) {
    tickets = onDisk;
    return tickets;
  }

  // Respect a self-imposed cooldown after a rate-limit response.
  const cooldownUntil = await getCooldownUntil();
  if (cooldownUntil > now) {
    const mins = Math.ceil((cooldownUntil - now) / 60000);
    throw new Error(
      `Login pausiert wegen Ubisoft-Rate-Limit ("Too many calls per IP"). ` +
        `Bitte noch ca. ${mins} Min warten (kein erneuter Versuch nötig).`,
    );
  }

  const email = process.env.UBI_EMAIL;
  const password = process.env.UBI_PASSWORD;
  if (!email || !password) {
    throw new Error('Missing Ubisoft credentials. Set UBI_EMAIL and UBI_PASSWORD in .env.local');
  }

  const basic =
    'Basic ' + Buffer.from(`${email}:${password}`, 'utf8').toString('base64');

  let first: SessionResponse;
  try {
    first = await postSession(basic); // single login; "new" key is lazy
  } catch (err) {
    // On a rate-limit, start the cooldown so we stop hammering the endpoint.
    if (err instanceof Error && /too many calls/i.test(err.message)) {
      await setCooldown(Date.now() + COOLDOWN_MS);
    }
    throw err;
  }

  tickets = {
    key: first.ticket!,
    newKey: '',
    sessionId: first.sessionId ?? '',
    keyExp: first.expiration ? Date.parse(first.expiration) : now + 2 * 3600 * 1000,
    newKeyExp: 0,
  };
  await saveTicketsToDisk(tickets);
  return tickets;
}

let newKeyInflight: Promise<string> | null = null;

/** Lazily obtain the "new" key (a second session authenticated with the key). */
function ensureNewKey(): Promise<string> {
  const now = Date.now();
  if (tickets && tickets.newKey && tickets.newKeyExp > now) {
    return Promise.resolve(tickets.newKey);
  }
  if (newKeyInflight) return newKeyInflight;
  newKeyInflight = (async () => {
    const t = await getTickets();
    let second: SessionResponse;
    try {
      second = await postSession(`Ubi_v1 t=${t.key}`);
    } catch (err) {
      if (err instanceof Error && /too many calls/i.test(err.message)) {
        await setCooldown(Date.now() + COOLDOWN_MS);
      }
      throw err;
    }
    t.newKey = second.ticket!;
    t.newKeyExp = second.expiration
      ? Date.parse(second.expiration)
      : Date.now() + 2 * 3600 * 1000;
    tickets = t;
    await saveTicketsToDisk(t);
    return t.newKey;
  })().finally(() => {
    newKeyInflight = null;
  });
  return newKeyInflight;
}

async function ubiGet<T>(
  url: string,
  useNew = false,
  retried = false,
): Promise<T> {
  const t = await getTickets();
  // Prefer the "new" key for useNew endpoints, but fall back to the primary
  // key when we haven't fetched the new one yet (saves a login).
  const usingNew = useNew && !!t.newKey && t.newKeyExp > Date.now();
  const token = usingNew ? t.newKey : t.key;

  const res = await fetch(url, {
    headers: {
      ...baseHeaders(),
      Authorization: `Ubi_v1 t=${token}`,
      'Ubi-LocaleCode': 'en-us',
      'Ubi-SessionId': t.sessionId,
      Connection: 'keep-alive',
    },
  });
  if (res.status === 204) return {} as T;
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (HTTP ${res.status}) from ${url}: ${text.slice(0, 120)}`);
  }
  if (data && typeof data === 'object' && 'httpCode' in data) {
    const d = data as { httpCode: number; message?: string };
    if (d.httpCode === 401) {
      // If a useNew endpoint rejected the primary key, fetch the "new" key
      // once and retry before giving up.
      if (useNew && !usingNew && !retried) {
        await ensureNewKey();
        return ubiGet<T>(url, useNew, true);
      }
      // Ticket no longer valid — drop the cached one so we re-login next time.
      tickets = null;
      await fs.rm(TICKETS_FILE, { force: true }).catch(() => {});
    }
    throw new Error(`HTTP ${d.httpCode}: ${d.message ?? 'request failed'}`);
  }
  return data as T;
}

// --- endpoints --------------------------------------------------------------

export interface UbiProfile {
  profileId: string;
  userId: string;
  nameOnPlatform: string;
  avatar: string;
}

export async function findPlayer(
  platform: Platform,
  username: string,
): Promise<UbiProfile | null> {
  const url = `${UBISERVICES}/v3/profiles?nameOnPlatform=${encodeURIComponent(
    username,
  )}&platformType=${encodeURIComponent(platform)}`;
  const data = await ubiGet<{ profiles?: Array<Record<string, string>> }>(url);
  const p = (data.profiles ?? []).find((x) => x.platformType === platform);
  if (!p) return null;
  return {
    profileId: p.profileId,
    userId: p.userId,
    nameOnPlatform: p.nameOnPlatform,
    avatar: `https://ubisoft-avatars.akamaized.net/${p.userId}/default_256_256.png`,
  };
}

export interface RawFullProfile {
  season_id?: number;
  profile?: {
    board_id?: string;
    rank?: number;
    max_rank?: number;
    rank_points?: number;
    max_rank_points?: number;
    season_id?: number;
    top_rank_position?: number;
  };
  season_statistics?: {
    kills?: number;
    deaths?: number;
    match_outcomes?: { wins?: number; losses?: number; abandons?: number };
  };
}

// Shared shape of the "full_profiles" payload — returned both by Ubisoft's
// endpoint and by R6Data's /stats?type=stats endpoint.
export interface FullProfilesData {
  platform_families_full_profiles?: Array<{
    board_ids_full_profiles?: Array<{
      board_id?: string;
      full_profiles?: RawFullProfile[];
    }>;
  }>;
}

function toBoard(fp: RawFullProfile): BoardStats {
  const p = fp.profile ?? {};
  const s = fp.season_statistics ?? {};
  const mo = s.match_outcomes ?? {};
  const wins = mo.wins ?? 0;
  const losses = mo.losses ?? 0;
  const abandons = mo.abandons ?? 0;
  const kills = s.kills ?? 0;
  const deaths = s.deaths ?? 0;
  const matches = wins + losses + abandons;
  return {
    current: rankInfo(p.rank ?? 0, p.rank_points ?? 0),
    max: rankInfo(p.max_rank ?? 0, p.max_rank_points ?? 0),
    mmr: p.rank_points ?? 0,
    wins,
    losses,
    abandons,
    matches,
    winRate: wins + losses > 0 ? `${((wins / (wins + losses)) * 100).toFixed(1)}%` : '0%',
    kills,
    deaths,
    kd: deaths > 0 ? Math.round((kills / deaths) * 100) / 100 : kills,
    lastMatch: { result: 'unknown', mmrChange: 0 },
  };
}

export interface FullProfiles {
  ranked: BoardStats | null;
  casual: BoardStats | null;
  seasonId: number;
}

/** Pure parser for a full_profiles payload (shared with the R6Data provider). */
export function parseFullProfiles(data: FullProfilesData): FullProfiles {
  const boards =
    data.platform_families_full_profiles?.[0]?.board_ids_full_profiles ?? [];
  let ranked: BoardStats | null = null;
  let casual: BoardStats | null = null;
  let seasonId = 0;
  for (const b of boards) {
    const fp = b.full_profiles?.[0];
    if (!fp) continue;
    seasonId = fp.season_id ?? fp.profile?.season_id ?? seasonId;
    if (b.board_id === 'ranked') ranked = toBoard(fp);
    else if (b.board_id === 'casual') casual = toBoard(fp);
  }
  return { ranked, casual, seasonId };
}

export async function getFullProfiles(
  userId: string,
  platform: Platform,
): Promise<FullProfiles> {
  const family = platform === 'uplay' ? 'pc' : 'console';
  const url =
    `${UBISERVICES}/v2/spaces/${XPLAY_SPACE}/title/r6s/skill/full_profiles?` +
    `profile_ids=${userId}&platform_families=${family}`;
  const data = await ubiGet<FullProfilesData>(url, true);
  return parseFullProfiles(data);
}

export async function getLevel(
  userId: string,
): Promise<{ level: number; xp: number }> {
  const url =
    `${UBISERVICES}/v1/spaces/${XPLAY_SPACE}/title/r6s/rewards/public_profile?` +
    `profile_id=${userId}`;
  const data = await ubiGet<{ level?: number; xp?: number }>(url, true);
  return { level: Number(data.level ?? 0), xp: Number(data.xp ?? 0) };
}
