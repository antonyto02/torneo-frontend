import { useEffect, useState } from 'react';
import { Trophy, Users } from 'lucide-react';
import { api } from '../api';
import type { GroupTable, Standing, Tournament } from '../types';

type View = 'general' | 'groups';

export function Standings() {
  const [rows, setRows] = useState<Standing[]>([]);
  const [groups, setGroups] = useState<GroupTable[]>([]);
  const [t, setT] = useState<Tournament | null>(null);
  const [view, setView] = useState<View>('general');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getStandings(),
      api.getGroupTables(),
      api.getTournament(),
    ])
      .then(([s, g, tt]) => {
        setRows(s);
        setGroups(g);
        setT(tt);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoaded(true));
  }, []);

  const perGroup = t?.classifyPerGroup ?? 2;
  const numWild = t?.wildcards ?? 2;

  // Clasificados momentáneos: top N de cada grupo (verde) + comodines (naranja).
  const groupQual = new Set<string>();
  groups.forEach((g) =>
    g.players.forEach((p) => {
      if (p.groupRank <= perGroup) groupQual.add(p.playerId);
    }),
  );
  const wildcardIds = new Set<string>();
  let wildLeft = numWild;
  for (const r of [...rows].sort((a, b) => a.rank - b.rank)) {
    if (!r.active || groupQual.has(r.playerId)) continue;
    if (wildLeft > 0) {
      wildcardIds.add(r.playerId);
      wildLeft--;
    }
  }

  return (
    <>
      <div className="lt-header">
        <h2 style={{ margin: 0 }}>
          {view === 'general' ? (
            <>
              <Trophy size={20} color="var(--accent)" /> Tabla general
            </>
          ) : (
            <>
              <Users size={20} color="var(--accent)" /> Por grupos
            </>
          )}
        </h2>
        <div className="lt-toggle">
          <button
            className={view === 'general' ? 'active' : ''}
            onClick={() => setView('general')}
          >
            <Trophy size={15} /> General
          </button>
          <button
            className={view === 'groups' ? 'active' : ''}
            onClick={() => setView('groups')}
          >
            <Users size={15} /> Por grupos
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {!loaded ? (
        <div className="skel-list">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skel skel-row" />
          ))}
        </div>
      ) : view === 'general' ? (
        rows.length === 0 ? (
          <div className="empty">Todavía no hay tabla general.</div>
        ) : (
          <>
          <div className="standings general">
            <div className="st-head">
              <span className="st-rank"></span>
              <span className="st-name">Jugador</span>
              <span>PJ</span>
              <span>G</span>
              <span>E</span>
              <span>P</span>
              <span>GF</span>
              <span>GC</span>
              <span>DG</span>
              <span className="st-pts">Pts</span>
            </div>
            {rows.map((r) => (
              <div
                key={r.playerId}
                className={`st-row ${r.active ? '' : 'inactive'} ${
                  groupQual.has(r.playerId)
                    ? 'qual'
                    : wildcardIds.has(r.playerId)
                      ? 'wild'
                      : ''
                }`}
              >
                <span className="st-rank">{r.rank}</span>
                <span className="st-name">
                  {r.name}
                  {r.groupName && <small className="muted">{r.groupName}</small>}
                </span>
                <span>{r.played}</span>
                <span>{r.wins}</span>
                <span>{r.draws}</span>
                <span>{r.losses}</span>
                <span>{r.goalsFor}</span>
                <span>{r.goalsAgainst}</span>
                <span>{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</span>
                <span className="st-pts">{r.points}</span>
              </div>
            ))}
          </div>
          <div className="legend">
            <span className="legend-item">
              <span className="sw sw-green" /> Clasificado directo
            </span>
            <span className="legend-item">
              <span className="sw sw-orange" /> Mejor general
            </span>
          </div>
          </>
        )
      ) : groups.length === 0 ? (
        <div className="empty">Aún no hay grupos.</div>
      ) : (
        <>
          <div className="group-tables">
            {groups.map((g) => (
              <div className="gt-card" key={g.groupId}>
                <h3>{g.name}</h3>
                <div className="standings">
                  <div className="st-head">
                    <span className="st-rank"></span>
                    <span className="st-name">Jugador</span>
                    <span>PJ</span>
                    <span>G</span>
                    <span>E</span>
                    <span>P</span>
                    <span>GF</span>
                    <span>GC</span>
                    <span>DG</span>
                    <span className="st-pts">Pts</span>
                  </div>
                  {g.players.map((p) => (
                    <div
                      key={p.playerId}
                      className={`st-row ${
                        p.groupRank <= perGroup
                          ? 'qual'
                          : wildcardIds.has(p.playerId)
                            ? 'wild'
                            : ''
                      }`}
                    >
                      <span className="st-rank">{p.groupRank}</span>
                      <span className="st-name">
                        {p.name}
                        <small className="muted">#{p.rank}</small>
                      </span>
                      <span>{p.played}</span>
                      <span>{p.wins}</span>
                      <span>{p.draws}</span>
                      <span>{p.losses}</span>
                      <span>{p.goalsFor}</span>
                      <span>{p.goalsAgainst}</span>
                      <span>{p.goalDiff > 0 ? `+${p.goalDiff}` : p.goalDiff}</span>
                      <span className="st-pts">{p.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="legend">
            <span className="legend-item">
              <span className="sw sw-green" /> Clasificado directo
            </span>
            <span className="legend-item">
              <span className="sw sw-orange" /> Mejor general
            </span>
          </div>
        </>
      )}
    </>
  );
}
