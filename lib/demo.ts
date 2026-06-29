import type { PlayerData, Platform } from './types';

// Self-contained mock data so the app can be demoed without Ubisoft credentials
// or outbound network access. Enabled via R6_DEMO=1. Icons are inline SVG data
// URIs so the UI renders fully offline.

function rankIcon(color: string, letter: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0b0e14"/></linearGradient></defs>` +
    `<path d="M32 4 L58 14 V34 C58 48 46 57 32 62 C18 57 6 48 6 34 V14 Z" fill="url(#g)" stroke="${color}" stroke-width="2"/>` +
    `<text x="32" y="40" font-family="Arial" font-size="26" font-weight="bold" fill="#fff" text-anchor="middle">${letter}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function opIcon(color: string, letter: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">` +
    `<rect width="48" height="48" rx="8" fill="${color}"/>` +
    `<text x="24" y="32" font-family="Arial" font-size="22" font-weight="bold" fill="#0b0e14" text-anchor="middle">${letter}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PLATINUM = '#28aab4';
const EMERALD = '#2fb56a';
const DIAMOND = '#5bc8ff';
const GOLD = '#e8b13a';
const SILVER = '#b9c2cf';

export function getDemoPlayer(
  platform: Platform,
  username: string,
): PlayerData {
  const name = username && username.toLowerCase() !== 'demo' ? username : 'DemoPlayer.GG';
  return {
    id: 'demo-0000-0000-0000-000000000000',
    username: name,
    platform,
    avatar:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="76"><rect width="76" height="76" rx="12" fill="#4d8bf0"/><text x="38" y="50" font-family="Arial" font-size="34" font-weight="bold" fill="#fff" text-anchor="middle">${name[0]?.toUpperCase() ?? 'R'}</text></svg>`,
      ),
    level: 217,
    xp: 845_320,
    currentSeasonName: 'Demo Season (Y9S3)',
    currentRegion: 'Europe, Middle East and Africa',
    ranked: {
      current: { id: 18, name: 'Emerald 3', mmr: 3987, icon: rankIcon(EMERALD, 'E') },
      max: { id: 20, name: 'Diamond 5', mmr: 4210, icon: rankIcon(DIAMOND, 'D') },
      mmr: 3987,
      wins: 142,
      losses: 118,
      abandons: 3,
      matches: 260,
      winRate: '54.6%',
      kills: 1873,
      deaths: 1654,
      kd: 1.13,
      lastMatch: { result: 'win', mmrChange: 28 },
    },
    casual: {
      current: { id: 14, name: 'Platinum 2', mmr: 3120, icon: rankIcon(PLATINUM, 'P') },
      max: { id: 15, name: 'Platinum 1', mmr: 3240, icon: rankIcon(PLATINUM, 'P') },
      mmr: 3120,
      wins: 310,
      losses: 268,
      abandons: 12,
      matches: 578,
      winRate: '53.6%',
      kills: 4120,
      deaths: 3880,
      kd: 1.06,
      lastMatch: { result: 'loss', mmrChange: -19 },
    },
    general: {
      kills: 12450,
      deaths: 10980,
      kd: 1.13,
      wins: 980,
      losses: 870,
      winRate: '53.0%',
      matches: 1850,
      headshots: 5230,
      headshotPercent: '42.0%',
      playtimeHours: 412.5,
    },
    topOperators: [
      { name: 'Ash', icon: opIcon('#e74c3c', 'A'), kills: 2310, deaths: 1890, kd: 1.22, winRate: '55.1%', matches: 420, playtime: 96.4 },
      { name: 'Jäger', icon: opIcon('#27ae60', 'J'), kills: 1980, deaths: 1720, kd: 1.15, winRate: '54.0%', matches: 388, playtime: 84.2 },
      { name: 'Thatcher', icon: opIcon('#2980b9', 'T'), kills: 1450, deaths: 1390, kd: 1.04, winRate: '52.3%', matches: 295, playtime: 61.0 },
      { name: 'Bandit', icon: opIcon('#f1c40f', 'B'), kills: 1320, deaths: 1180, kd: 1.12, winRate: '53.8%', matches: 270, playtime: 55.7 },
      { name: 'Smoke', icon: opIcon('#8e44ad', 'S'), kills: 1190, deaths: 1100, kd: 1.08, winRate: '51.9%', matches: 240, playtime: 48.3 },
      { name: 'Sledge', icon: opIcon('#e67e22', 'Sl'), kills: 980, deaths: 970, kd: 1.01, winRate: '50.4%', matches: 205, playtime: 39.1 },
    ],
    history: [
      mkSeason(33, 'Demo Y8S1', SILVER, SILVER, 'S', 'Silver 1', 2380, 64, 58, 1.02),
      mkSeason(34, 'Demo Y8S2', GOLD, GOLD, 'G', 'Gold 2', 2980, 88, 71, 1.07),
      mkSeason(35, 'Demo Y8S3', GOLD, GOLD, 'G', 'Gold 1', 3180, 102, 80, 1.09),
      mkSeason(36, 'Demo Y8S4', PLATINUM, PLATINUM, 'P', 'Platinum 3', 3520, 120, 95, 1.11),
      mkSeason(37, 'Demo Y9S1', PLATINUM, PLATINUM, 'P', 'Platinum 1', 3780, 134, 102, 1.14),
      mkSeason(38, 'Demo Y9S2', EMERALD, EMERALD, 'E', 'Emerald 4', 3910, 138, 110, 1.12),
      mkSeason(39, 'Demo Y9S3', EMERALD, DIAMOND, 'E', 'Emerald 3', 3987, 142, 118, 1.13),
    ],
    matches: [],
  };
}

function mkSeason(
  seasonId: number,
  seasonName: string,
  color: string,
  rankColor: string,
  letter: string,
  rankName: string,
  mmr: number,
  wins: number,
  losses: number,
  kd: number,
  maxColorOverride?: string,
): PlayerData['history'][number] {
  const matches = wins + losses;
  return {
    seasonId,
    seasonName,
    seasonColor: color.startsWith('#') ? color : undefined,
    region: 'EMEA',
    rank: { id: 1, name: rankName, mmr, icon: rankIcon(rankColor, letter) },
    maxRank: { id: 1, name: rankName, mmr: mmr + 120, icon: rankIcon(maxColorOverride ?? rankColor, letter) },
    mmr,
    wins,
    losses,
    abandons: 0,
    matches,
    winRate: `${((wins / matches) * 100).toFixed(1)}%`,
    kd,
  };
}
