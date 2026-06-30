// Builds the normalised PlayerData we show in the UI, using the current
// Ubisoft endpoints in ./ubi (the old r6api.js routes are dead).

import { getPlayerDataViaR6Data, hasR6DataKey } from './r6data';
import { findPlayer, getFullProfiles, getLevel } from './ubi';
import type { PlayerData, Platform } from './types';

function seasonName(seasonId: number): string {
  return seasonId > 0 ? `Season ${seasonId}` : '';
}

/** Fetch and normalise everything we show for one player. */
export async function getPlayerData(
  platform: Platform,
  username: string,
): Promise<PlayerData | null> {
  // Prefer R6Data when a key is configured — it avoids the Ubisoft login
  // (DataDome / 2FA / per-IP rate limit) entirely.
  if (hasR6DataKey()) {
    return getPlayerDataViaR6Data(platform, username);
  }

  const profile = await findPlayer(platform, username);
  if (!profile) return null;

  // Best-effort: a failure in one piece shouldn't sink the whole profile.
  const settle = async <T>(p: Promise<T>, label: string): Promise<T | null> => {
    try {
      return await p;
    } catch (err) {
      console.error(
        `[r6-tracker] ${label} failed (continuing):`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  };

  const [profiles, progression] = await Promise.all([
    settle(getFullProfiles(profile.userId, platform), 'full_profiles'),
    settle(getLevel(profile.userId), 'level'),
  ]);

  return {
    id: profile.profileId,
    username: profile.nameOnPlatform,
    platform,
    avatar: profile.avatar,
    level: progression?.level ?? 0,
    xp: progression?.xp ?? 0,
    ranked: profiles?.ranked ?? null,
    casual: profiles?.casual ?? null,
    currentSeasonName: profiles ? seasonName(profiles.seasonId) : '',
    currentRegion: '',
    // Per-season history (Ranked 2.0) and aggregate stats are not yet wired to
    // the current endpoints — coming in a follow-up. UI degrades gracefully.
    history: [],
    general: null,
    topOperators: [],
    matches: [],
  };
}
