'use client';

import { useState } from 'react';

import PlayerProfile from '@/components/PlayerProfile';
import type { ApiError, PlayerData, Platform } from '@/lib/types';

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'uplay', label: 'PC (Ubisoft)' },
  { value: 'psn', label: 'PlayStation' },
  { value: 'xbl', label: 'Xbox' },
];

export default function Home() {
  const [username, setUsername] = useState('');
  const [platform, setPlatform] = useState<Platform>('uplay');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlayerData | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const name = username.trim();
    if (!name) return;

    setLoading(true);
    setError(null);
    setData(null);
    setSearched(true);

    try {
      const params = new URLSearchParams({ username: name, platform });
      const res = await fetch(`/api/player?${params.toString()}`);
      const body: PlayerData | ApiError = await res.json();
      if (!res.ok) {
        setError((body as ApiError).error ?? 'Abruf fehlgeschlagen.');
        return;
      }
      setData(body as PlayerData);
    } catch {
      setError('Netzwerkfehler — bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <div className="hero">
        <h1>
          R6 <span className="accent">Tracker</span>
        </h1>
        <p>
          Gib einen Rainbow Six Siege Nutzernamen ein, um Ränge, den
          Saison-Verlauf und Statistiken abzurufen.
        </p>
      </div>

      <form className="search" onSubmit={handleSearch}>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          aria-label="Plattform"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Nutzername…"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={loading || !username.trim()}>
          {loading ? 'Lädt…' : 'Suchen'}
        </button>
      </form>

      {error ? <div className="message error">{error}</div> : null}

      {loading ? (
        <div className="message info">Daten werden von Ubisoft geladen…</div>
      ) : null}

      {!loading && !error && data ? <PlayerProfile data={data} /> : null}

      {!loading && !error && !data && searched ? (
        <div className="message info">Keine Daten.</div>
      ) : null}
    </main>
  );
}
