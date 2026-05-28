import { useCallback, useEffect, useState } from 'react';
import { Flag, Swords } from 'lucide-react';
import { api } from '../api';
import type { Classified, PlayoffMatch, Tournament } from '../types';

interface Props {
  tournament: Tournament | null;
  isAdmin: boolean;
  onChange: () => void;
}

/** Bracket "fantasma" para la vista previa: 1ª ronda con la siembra actual,
 *  rondas siguientes en "Por definir". Mismo shape que PlayoffMatch. */
function buildPreviewBracket(classified: Classified[]): PlayoffMatch[] {
  const n = classified.length;
  if (n < 2 || (n & (n - 1)) !== 0) return [];
  const seeded = [...classified].sort((a, b) => a.playoffSeed - b.playoffSeed);
  const out: PlayoffMatch[] = [];
  let id = 0;
  const mk = (
    ri: number,
    slot: number,
    home: Classified | null,
    away: Classified | null,
  ): PlayoffMatch => ({
    id: `pv-${id++}`,
    bracket: 'WINNERS',
    roundIndex: ri,
    slotIndex: slot,
    label: null,
    homePlayerId: null,
    awayPlayerId: null,
    homeSeed: home?.playoffSeed ?? null,
    awaySeed: away?.playoffSeed ?? null,
    homeScore: null,
    awayScore: null,
    winnerId: null,
    status: 'SCHEDULED',
    homeName: home?.name ?? null,
    awayName: away?.name ?? null,
    winnerName: null,
  });

  const half = n / 2;
  for (let i = 0; i < half; i++) out.push(mk(0, i, seeded[i], seeded[n - 1 - i]));
  let count = half / 2;
  let ri = 1;
  while (count >= 1) {
    for (let i = 0; i < count; i++) out.push(mk(ri, i, null, null));
    count = count / 2;
    ri++;
  }
  return out;
}

export function Playoff({ tournament, isAdmin, onChange }: Props) {
  const [bracket, setBracket] = useState<PlayoffMatch[]>([]);
  const [classified, setClassified] = useState<Classified[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, c] = await Promise.all([
        api.getPlayoff(),
        api.getClassified().catch(() => []),
      ]);
      setBracket(b);
      setClassified(c);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const generated = bracket.length > 0;
  const canGenerate =
    isAdmin && tournament?.status === 'REGULAR' && !generated;

  // Bracket de vista previa (con la clasificación actual) si aún no se genera.
  const previewBracket = !generated ? buildPreviewBracket(classified) : [];

  return (
    <>
      <div className="spread" style={{ marginTop: 20 }}>
        <h2 style={{ margin: 0 }}>
          <Swords size={20} /> Liguilla
        </h2>
        {canGenerate && (
          <button
            className="btn"
            disabled={busy}
            onClick={() => run(() => api.generatePlayoff())}
          >
            <Flag size={16} /> Generar liguilla
          </button>
        )}
        {isAdmin && generated && (
          <button
            className="btn danger sm"
            disabled={busy}
            onClick={() => run(() => api.resetPlayoff())}
          >
            Reiniciar liguilla
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {generated ? (
        <BracketView
          bracket={bracket}
          isAdmin={isAdmin}
          busy={busy}
          run={run}
        />
      ) : previewBracket.length > 0 ? (
        <BracketView
          bracket={previewBracket}
          isAdmin={false}
          busy={false}
          run={async () => {}}
        />
      ) : (
        <div className="empty">
          {tournament?.status === 'REGULAR'
            ? 'La liguilla se genera cuando terminan todas las jornadas.'
            : 'Todavía no hay liguilla.'}
        </div>
      )}
    </>
  );
}

function BracketView({
  bracket,
  isAdmin,
  busy,
  run,
}: {
  bracket: PlayoffMatch[];
  isAdmin: boolean;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const rounds = [...new Set(bracket.map((m) => m.roundIndex))].sort(
    (a, b) => a - b,
  );
  const maxRi = Math.max(...rounds);
  const finalMatch = bracket.find((m) => m.roundIndex === maxRi) ?? null;
  const champion = finalMatch?.winnerName ?? null;
  const sideRounds = rounds.filter((ri) => ri !== maxRi);

  const colFor = (ri: number, side: 'left' | 'right') => {
    const ms = bracket
      .filter((m) => m.roundIndex === ri)
      .sort((a, b) => a.slotIndex - b.slotIndex);
    const half = Math.ceil(ms.length / 2);
    return side === 'left' ? ms.slice(0, half) : ms.slice(half);
  };

  const renderSide = (side: 'left' | 'right') => (
    <div className={`br-side ${side}`}>
      {sideRounds.map((ri) => (
        <div className="br-col" key={ri}>
          {colFor(ri, side).map((m) => (
            <div className="br-cell" key={m.id}>
              <BracketBox m={m} isAdmin={isAdmin} busy={busy} run={run} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {champion && (
        <div className="champion-banner">
          <span className="emoji">🏆</span>
          <div>
            <span className="cb-tag">Campeón</span>
            <strong>{champion}</strong>
          </div>
        </div>
      )}
      {/* Desktop: bracket de dos lados con el trofeo al centro */}
      <div className="bracket-fifa">
        {renderSide('left')}
        <div className="br-center">
          <div className="br-trophy">🏆</div>
          {finalMatch && (
            <div className="br-cell">
              <BracketBox
                m={finalMatch}
                isAdmin={isAdmin}
                busy={busy}
                run={run}
              />
            </div>
          )}
          <div className="br-final-label">Final</div>
        </div>
        {renderSide('right')}
      </div>

      {/* Móvil: apilado por ronda (Cuartos → Semifinal → Final) */}
      <div className="bracket-rounds">
        {rounds.map((ri) => {
          const ms = bracket
            .filter((m) => m.roundIndex === ri)
            .sort((a, b) => a.slotIndex - b.slotIndex);
          return (
            <div className="brm-round" key={ri}>
              <h4>{roundTitle(ms.length)}</h4>
              {ms.map((m) => (
                <BracketBox
                  key={m.id}
                  m={m}
                  isAdmin={isAdmin}
                  busy={busy}
                  run={run}
                />
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

function roundTitle(matchCount: number): string {
  if (matchCount === 1) return 'Final';
  if (matchCount === 2) return 'Semifinal';
  if (matchCount === 4) return 'Cuartos de final';
  if (matchCount === 8) return 'Octavos de final';
  return `Ronda de ${matchCount * 2}`;
}

function BracketBox({
  m,
  isAdmin,
  busy,
  run,
}: {
  m: PlayoffMatch;
  isAdmin: boolean;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [home, setHome] = useState(m.homeScore ?? 0);
  const [away, setAway] = useState(m.awayScore ?? 0);
  const ready = m.homePlayerId && m.awayPlayerId;
  const editable = isAdmin && ready && m.status !== 'PLAYED';
  const winHome = m.winnerId != null && m.winnerId === m.homePlayerId;
  const winAway = m.winnerId != null && m.winnerId === m.awayPlayerId;

  return (
    <div className="box">
      <div className={`brteam ${winHome ? 'win' : ''} ${m.homeName ? '' : 'tbd'}`}>
        {m.homeSeed != null && <span className="brseed">{m.homeSeed}</span>}
        <span className="brname">{m.homeName ?? 'Por definir'}</span>
        {editable ? (
          <input
            className="brsc"
            type="number"
            min={0}
            value={home}
            onChange={(e) => setHome(Number(e.target.value))}
          />
        ) : (
          <span className="brsc-v">{m.homeScore ?? ''}</span>
        )}
      </div>
      <div className={`brteam ${winAway ? 'win' : ''} ${m.awayName ? '' : 'tbd'}`}>
        {m.awaySeed != null && <span className="brseed">{m.awaySeed}</span>}
        <span className="brname">{m.awayName ?? 'Por definir'}</span>
        {editable ? (
          <input
            className="brsc"
            type="number"
            min={0}
            value={away}
            onChange={(e) => setAway(Number(e.target.value))}
          />
        ) : (
          <span className="brsc-v">{m.awayScore ?? ''}</span>
        )}
      </div>
      {editable && (
        <button
          className="br-ok"
          disabled={busy}
          onClick={() => run(() => api.enterPlayoffResult(m.id, home, away))}
        >
          Guardar resultado
        </button>
      )}
    </div>
  );
}
