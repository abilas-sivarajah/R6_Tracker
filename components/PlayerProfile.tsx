import type { BoardStats, PlayerData, RecentMatch } from '@/lib/types';

function RankCard({ title, board }: { title: string; board: BoardStats | null }) {
  if (!board) {
    return (
      <div className="card">
        <p className="section-title">{title}</p>
        <p className="message info" style={{ margin: 0, textAlign: 'left' }}>
          Keine Daten in dieser Saison.
        </p>
      </div>
    );
  }
  const wr = board.winRate;
  return (
    <div className="card">
      <p className="section-title">{title}</p>
      <div className="rank-card">
        {board.current.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="rank-icon" src={board.current.icon} alt={board.current.name} />
        ) : null}
        <div>
          <div className="rank-name">{board.current.name}</div>
          <div className="mmr">{board.mmr} MMR</div>
          <div className="sub">
            Höchster Rang: {board.max.name} ({board.max.mmr})
          </div>
        </div>
      </div>
      <div className="stat-row">
        <span>
          <span className="k">W/L: </span>
          <span className="win">{board.wins}</span> /{' '}
          <span className="loss">{board.losses}</span>
        </span>
        <span>
          <span className="k">Winrate: </span>
          {wr}
        </span>
        <span>
          <span className="k">K/D: </span>
          {board.kd}
        </span>
        <span>
          <span className="k">Spiele: </span>
          {board.matches}
        </span>
        {board.abandons > 0 ? (
          <span>
            <span className="k">Abandons: </span>
            {board.abandons}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Tile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="card tile">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

function RecentMatches({ matches }: { matches: RecentMatch[] }) {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
  };
  return (
    <div className="card table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Ergebnis</th>
            <th>RP</th>
            <th>Gesamt-RP</th>
            <th>Rang</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m, i) => (
            <tr key={`${m.date}-${i}`}>
              <td>{fmt(m.date)}</td>
              <td className={m.result === 'win' ? 'win' : 'loss'}>
                {m.result === 'win' ? 'Sieg' : 'Niederlage'}
              </td>
              <td className={m.rpChange >= 0 ? 'win' : 'loss'}>
                {m.rpChange > 0 ? `+${m.rpChange}` : m.rpChange}
              </td>
              <td>{m.rp}</td>
              <td>
                <span className="with-icon">
                  {m.rankImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.rankImage} alt={m.rank} />
                  ) : null}
                  {m.rank}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PlayerProfile({ data }: { data: PlayerData }) {
  return (
    <div>
      {/* Profile header */}
      <div className="card section profile">
        {data.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar" src={data.avatar} alt={data.username} />
        ) : null}
        <div>
          <h2 className="name">
            {data.username}
            <span className="badge">{data.platform.toUpperCase()}</span>
            {data.currentRegion ? (
              <span className="badge">{data.currentRegion}</span>
            ) : null}
            {data.banned ? <span className="badge badge-ban">GESPERRT</span> : null}
          </h2>
          <p className="meta">
            Level {data.level}
            {data.currentSeasonName ? ` · ${data.currentSeasonName}` : ''}
            {data.inactiveSeasons && data.inactiveSeasons > 0 ? (
              <span className="badge badge-warn">
                ⚠️ zuletzt aktiv · inaktiv seit {data.inactiveSeasons}{' '}
                {data.inactiveSeasons === 1 ? 'Saison' : 'Saisons'}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {/* Current ranks */}
      <div className="section">
        <p className="section-title">Aktuelle Ränge</p>
        <div className="grid cols-2">
          <RankCard title="Ranked" board={data.ranked} />
          <RankCard title="Casual" board={data.casual} />
        </div>
      </div>

      {/* General stats */}
      {data.general ? (
        <div className="section">
          <p className="section-title">Allgemeine Statistiken (Ranked, gesamt)</p>
          <div className="grid cols-3">
            <Tile value={data.general.kd} label="K/D" />
            <Tile value={data.general.winRate} label="Runden-Winrate" />
            <Tile value={data.general.matches} label="Runden" />
            <Tile value={data.general.kills} label="Kills" />
            <Tile value={data.general.headshotPercent} label="Headshot %" />
            <Tile value={`${data.general.playtimeHours} h`} label="Spielzeit" />
          </div>
        </div>
      ) : null}

      {/* Top operators */}
      {data.topOperators.length > 0 ? (
        <div className="section">
          <p className="section-title">Meistgespielte Operator</p>
          <div className="card">
            <div className="op-list">
              {data.topOperators.map((op) => (
                <div className="op" key={op.name}>
                  {op.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={op.icon} alt={op.name} />
                  ) : null}
                  <div>
                    <div className="op-name">{op.name}</div>
                    <div className="op-sub">
                      K/D {op.kd} · {op.winRate} · {op.playtime} h
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Recent ranked matches */}
      <div className="section">
        <p className="section-title">Letzte Ranked-Partien</p>
        {data.recentMatches && data.recentMatches.length > 0 ? (
          <RecentMatches matches={data.recentMatches} />
        ) : (
          <div className="card">
            <p className="message info" style={{ margin: 0, textAlign: 'left' }}>
              Keine Ranked-Partien in dieser Saison gefunden.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
