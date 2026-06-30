// Shared, serialisable shapes returned by /api/player and consumed by the UI.
// Kept free of any r6api.js types so they can be imported by client components.

export type Platform = 'uplay' | 'psn' | 'xbl';

export interface RankInfo {
  id: number;
  name: string;
  mmr: number;
  icon: string;
}

export interface BoardStats {
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
  lastMatch: {
    result: string;
    mmrChange: number;
  };
}

export interface SeasonRank {
  seasonId: number;
  seasonName: string;
  seasonColor?: string;
  region: string;
  rank: RankInfo;
  maxRank: RankInfo;
  mmr: number;
  wins: number;
  losses: number;
  abandons: number;
  matches: number;
  winRate: string;
  kd: number;
}

export interface OperatorBrief {
  name: string;
  icon: string;
  kills: number;
  deaths: number;
  kd: number;
  winRate: string;
  matches: number;
  playtime: number;
}

export interface GeneralStats {
  kills: number;
  deaths: number;
  kd: number;
  wins: number;
  losses: number;
  winRate: string;
  matches: number;
  headshots: number;
  headshotPercent: string;
  playtimeHours: number;
}

export interface RankHistoryPoint {
  date: string; // ISO timestamp
  rank: string;
  rankImage: string;
  color?: string;
  rp: number;
}

export interface PlayerData {
  id: string;
  username: string;
  platform: Platform;
  avatar: string;
  level: number;
  xp: number;
  ranked: BoardStats | null;
  casual: BoardStats | null;
  currentSeasonName: string;
  currentRegion: string;
  history: SeasonRank[];
  rankHistory?: RankHistoryPoint[];
  general: GeneralStats | null;
  topOperators: OperatorBrief[];
  // Match-by-match history is not exposed by Ubisoft's unofficial API.
  // Reserved so the UI/struct is ready when a match source is wired up later.
  matches: unknown[];
}

export interface ApiError {
  error: string;
}
