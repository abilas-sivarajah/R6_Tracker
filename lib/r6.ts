import os from 'node:os';

import type R6APIClass from 'r6api.js';

import type {
  BoardStats,
  GeneralStats,
  OperatorBrief,
  PlayerData,
  Platform,
  RankInfo,
  SeasonRank,
} from './types';

// --- Configuration ----------------------------------------------------------

// Season range scanned for the rank history ("previous ranks"). r6api.js only
// ships season *names* up to season 27, but Ubisoft's API still returns data
// for newer season ids — we just fall back to "Season N" for the name.
const HISTORY_MIN_SEASON = Number(process.env.R6_HISTORY_MIN_SEASON ?? 16);
const HISTORY_MAX_SEASON = Number(process.env.R6_HISTORY_MAX_SEASON ?? 60);

type R6APICtor = typeof R6APIClass;

let api: InstanceType<R6APICtor> | null = null;

/**
 * Lazily build a single, reused R6API client.
 *
 * r6api.js is a CJS/ESM hybrid. Next's bundler (Turbopack) mangles both the
 * static `import` and any wrapped `require` of it — the module resolves to
 * undefined or an empty stub at runtime. The reliable fix is a *native*
 * dynamic import, kept untouched by the bundler via the `turbopackIgnore`
 * (and `webpackIgnore`) magic comments, which loads the real ESM entry whose
 * default export is the R6API class.
 */
async function getApi(): Promise<InstanceType<R6APICtor>> {
  if (api) return api;

  const email = process.env.UBI_EMAIL;
  const password = process.env.UBI_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Missing Ubisoft credentials. Set UBI_EMAIL and UBI_PASSWORD in .env.local',
    );
  }

  const mod = (await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ 'r6api.js'
  )) as { default: R6APICtor };
  const R6API = mod.default;

  api = new R6API({
    email,
    password,
    // Cache the auth ticket in a writable temp dir (avoids writing inside the
    // bundle / read-only deploy targets).
    authFileDirPath: os.tmpdir(),
    authFileName: 'r6-tracker-auth.json',
  });

  return api;
}

// --- Normalisation helpers --------------------------------------------------

type RawBoard = {
  current: RankInfo;
  max: RankInfo;
  mmr: number;
  wins: number;
  losses: number;
  abandons: number;
  matches: number;
  winRate: string;
  kills: number;
  deaths: number;
  kd: number;
  lastMatch: { result: string; mmrChange: number };
};

function toBoardStats(board: RawBoard): BoardStats {
  return {
    current: board.current,
    max: board.max,
    mmr: board.mmr,
    wins: board.wins,
    losses: board.losses,
    abandons: board.abandons,
    matches: board.matches,
    winRate: board.winRate,
    kills: board.kills,
    deaths: board.deaths,
    kd: board.kd,
    lastMatch: {
      result: board.lastMatch?.result ?? 'unknown',
      mmrChange: board.lastMatch?.mmrChange ?? 0,
    },
  };
}

function seasonDisplayName(seasonId: number, seasonName?: string): string {
  return seasonName ?? `Season ${seasonId}`;
}

/** From a season's regions, pick the board (by id) of the region with most matches. */
function pickActiveRegionBoard<T extends { matches: number }>(
  regions: Record<string, { regionName: string; boards: Record<string, T> }>,
  boardId: string,
): { region: string; board: T } | null {
  let best: { region: string; board: T } | null = null;
  for (const region of Object.values(regions ?? {})) {
    const board = region.boards?.[boardId];
    if (!board) continue;
    if (!best || board.matches > best.board.matches) {
      best = { region: region.regionName, board };
    }
  }
  return best;
}

// --- Public API -------------------------------------------------------------

/** Fetch and normalise everything we show for one player. */
export async function getPlayerData(
  platform: Platform,
  username: string,
): Promise<PlayerData | null> {
  const client = await getApi();

  const profiles = await client.findByUsername(platform, username);
  const profile = profiles[0];
  if (!profile) return null;

  const id = profile.id;

  // Fetch the independent pieces in parallel.
  const [progressionRes, statsRes, currentRanksRes] = await Promise.all([
    client.getProgression(platform, [id]),
    client.getStats(platform, [id]),
    client.getRanks(platform, [id]), // default season (-1) = current, all regions/boards
  ]);

  const progression = progressionRes[0];
  const stats = statsRes[0];
  const currentRanks = currentRanksRes[0];

  // --- current season: find the player's active region ----------------------
  let ranked: BoardStats | null = null;
  let casual: BoardStats | null = null;
  let currentSeasonName = '';
  let currentRegion = '';

  if (currentRanks) {
    const seasonEntries = Object.values(currentRanks.seasons ?? {});
    const season = seasonEntries[seasonEntries.length - 1]; // latest returned
    if (season) {
      currentSeasonName = seasonDisplayName(season.seasonId, season.seasonName);
      const rankedPick = pickActiveRegionBoard(
        season.regions as never,
        'pvp_ranked',
      );
      if (rankedPick) {
        ranked = toBoardStats(rankedPick.board as unknown as RawBoard);
        currentRegion = rankedPick.region;
      }
      const casualPick = pickActiveRegionBoard(
        season.regions as never,
        'pvp_casual',
      );
      if (casualPick) {
        casual = toBoardStats(casualPick.board as unknown as RawBoard);
        if (!currentRegion) currentRegion = casualPick.region;
      }
    }
  }

  // --- rank history ("previous ranks") --------------------------------------
  const seasonIds: number[] = [];
  for (let s = HISTORY_MIN_SEASON; s <= HISTORY_MAX_SEASON; s++) seasonIds.push(s);

  const history: SeasonRank[] = [];
  try {
    // r6api.js types seasonIds as a narrow union of known seasons (6-27), but
    // Ubisoft's API accepts newer season ids too — cast to satisfy the types.
    const historyRes = await client.getRanks(platform, [id], {
      seasonIds,
      boardIds: 'pvp_ranked',
    } as Parameters<typeof client.getRanks>[2]);
    const historyRanks = historyRes[0];
    if (historyRanks) {
      for (const season of Object.values(historyRanks.seasons ?? {})) {
        const pick = pickActiveRegionBoard(season.regions as never, 'pvp_ranked');
        if (!pick) continue;
        const b = pick.board as unknown as RawBoard;
        if (b.matches <= 0 && b.current.id <= 0) continue; // skip unplayed seasons
        history.push({
          seasonId: season.seasonId,
          seasonName: seasonDisplayName(season.seasonId, season.seasonName),
          seasonColor: season.seasonColor,
          region: pick.region,
          rank: b.current,
          maxRank: b.max,
          mmr: b.mmr,
          wins: b.wins,
          losses: b.losses,
          abandons: b.abandons,
          matches: b.matches,
          winRate: b.winRate,
          kd: b.kd,
        });
      }
    }
  } catch {
    // History is best-effort; a failure here should not break the profile.
  }
  history.sort((a, b) => a.seasonId - b.seasonId);

  // --- general stats + top operators ----------------------------------------
  let general: GeneralStats | null = null;
  let topOperators: OperatorBrief[] = [];

  if (stats?.pvp) {
    const g = stats.pvp.general;
    general = {
      kills: g.kills,
      deaths: g.deaths,
      kd: g.kd,
      wins: g.wins,
      losses: g.losses,
      winRate: g.winRate,
      matches: g.matches,
      headshots: g.headshots,
      headshotPercent:
        g.kills > 0 ? `${((g.headshots / g.kills) * 100).toFixed(1)}%` : '0%',
      playtimeHours: Math.round(((g.playtime ?? 0) / 3600) * 10) / 10,
    };

    topOperators = Object.values(stats.pvp.operators ?? {})
      .filter((op) => op && op.matches > 0)
      .sort((a, b) => b.playtime - a.playtime)
      .slice(0, 6)
      .map((op) => ({
        name: op.name,
        icon: op.icon,
        kills: op.kills,
        deaths: op.deaths,
        kd: op.kd,
        winRate: op.winRate,
        matches: op.matches,
        playtime: Math.round((op.playtime / 3600) * 10) / 10,
      }));
  }

  return {
    id,
    username: profile.username,
    platform,
    avatar: profile.avatar[256],
    level: progression?.level ?? 0,
    xp: progression?.xp ?? 0,
    ranked,
    casual,
    currentSeasonName,
    currentRegion,
    history,
    general,
    topOperators,
    matches: [],
  };
}
