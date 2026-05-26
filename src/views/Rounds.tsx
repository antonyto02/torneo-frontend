import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dices,
  Moon,
  Play,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { api } from '../api';
import { QUIET_RULE } from '../types';
import {
  DicePresentation,
  RoundDrawPresentation,
  ScoreStepper,
} from '../anim';
import type { Match, Player, Round, Rule, Tournament } from '../types';

interface Props {
  tournament: Tournament | null;
  rules: Rule[];
  isAdmin: boolean;
  onChange: () => void;
}

/** Metadatos (emoji/label/desc) de la regla de una jornada. */
function ruleMeta(ruleId: string | null, rules: Rule[]) {
  if (!ruleId) return QUIET_RULE;
  const r = rules.find((x) => x.id === ruleId);
  return r
    ? { label: r.label, emoji: r.emoji, description: r.description }
    : QUIET_RULE;
}

export function Rounds({ tournament, rules, isAdmin, onChange }: Props) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRounds(await api.getRounds());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // La jornada actual = la última. Al crear una nueva, salta a ella.
  useEffect(() => {
    setIdx(Math.max(0, rounds.length - 1));
  }, [rounds.length]);

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

  const players = tournament?.players ?? [];
  const ordered = [...rounds].sort((a, b) => a.number - b.number);
  const total = ordered.length;
  const lastClosed =
    total === 0 || ordered[total - 1].status === 'COMPLETED';

  // Hay un "slot" virtual al final (Jornada N+1) para crear la siguiente,
  // solo alcanzable si la última jornada ya se cerró.
  const canCreateNext =
    isAdmin &&
    tournament?.status === 'REGULAR' &&
    !tournament.regularComplete &&
    lastClosed;
  const maxIdx = canCreateNext ? total : Math.max(0, total - 1);

  const safeIdx = Math.min(idx, maxIdx);
  const isVirtual = safeIdx >= total; // estás en el slot "Crear siguiente"
  const current = isVirtual ? null : ordered[safeIdx];
  const displayNumber = isVirtual ? total + 1 : current!.number;

  // Sin jornadas y sin poder crear (p. ej. en SETUP): estado vacío.
  if (total === 0 && !canCreateNext) {
    return (
      <div className="empty" style={{ marginTop: 24 }}>
        {tournament?.status === 'SETUP'
          ? 'Arranca el torneo desde el panel Admin para crear jornadas.'
          : 'Todavía no hay jornadas.'}
      </div>
    );
  }

  return (
    <>
      <div className="round-nav">
        <button
          className="nav-arrow"
          disabled={safeIdx <= 0}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          aria-label="Jornada anterior"
        >
          <ChevronLeft size={22} />
        </button>
        <h2>Jornada {displayNumber}</h2>
        <button
          className="nav-arrow"
          disabled={safeIdx >= maxIdx}
          onClick={() => setIdx((i) => Math.min(maxIdx, i + 1))}
          aria-label="Jornada siguiente"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {tournament?.regularComplete && tournament.status === 'REGULAR' && (
        <div className="event-banner">
          <span className="emoji">🏁</span>
          <div>
            <strong>Fase regular completa</strong>
            <div className="muted">
              Todos jugaron contra todos. Ve a la pestaña Liguilla para
              generarla.
            </div>
          </div>
        </div>
      )}

      {isVirtual ? (
        <div className="empty" style={{ marginTop: 20 }}>
          <p>La jornada {displayNumber} aún no existe.</p>
          <button
            className="btn"
            disabled={busy}
            onClick={() => run(() => api.createNextRound())}
          >
            <Plus size={16} /> Crear jornada {displayNumber}
          </button>
        </div>
      ) : (
        current && (
          <RoundCard
            key={current.id}
            round={current}
            rules={rules}
            players={players}
            tournament={tournament}
            isAdmin={isAdmin}
            busy={busy}
            run={run}
          />
        )
      )}
    </>
  );
}

function RoundCard({
  round,
  rules,
  players,
  tournament,
  isAdmin,
  busy,
  run,
}: {
  round: Round;
  rules: Rule[];
  players: Player[];
  tournament: Tournament | null;
  isAdmin: boolean;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [ruleDraw, setRuleDraw] = useState(false);
  const [dice, setDice] = useState(false);
  const meta = ruleMeta(round.ruleId, rules);
  const hasMatches = round.matches.length > 0;
  const allPlayed =
    hasMatches && round.matches.every((m) => m.status === 'PLAYED');
  const pool = tournament?.rulePool ?? [];

  return (
    <div className="card bare">
      {round.eventDrawn && (
        <div className="rule-banner">
          <span className="rb-emoji">{meta.emoji}</span>
          <div className="rb-body">
            <span className="rb-tag">Regla de la jornada</span>
            <strong className="rb-title">{meta.label}</strong>
            <div className="rb-desc muted">{meta.description}</div>
          </div>
        </div>
      )}

      {/* Iniciar jornada: UNA sola presentación encadenada
          (regla → sorteo extra si aplica → enfrentamientos) */}
      {isAdmin && !hasMatches && round.status !== 'COMPLETED' && (
        <div
          className="row"
          style={{ justifyContent: 'center', marginTop: 48 }}
        >
          <button className="btn lg" onClick={() => setRuleDraw(true)}>
            <Play size={20} /> Iniciar jornada
          </button>
        </div>
      )}
      {ruleDraw && (
        <RoundDrawPresentation
          roundId={round.id}
          roundNumber={round.number}
          rules={rules}
          pool={pool}
          players={players}
          eventDrawn={round.eventDrawn}
          ruleId={round.ruleId}
          onDrawn={() => run(async () => {})}
          onClose={() => setRuleDraw(false)}
        />
      )}

      {/* Dados: se lanzan solo en presentación, tras cargar resultados */}
      {isAdmin &&
        round.ruleId === 'DICE' &&
        allPlayed &&
        (round.diceRolls?.length ?? 0) <
          players.filter((p) => p.active).length && (
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn ghost sm" onClick={() => setDice(true)}>
              <Dices size={14} /> Proyectar dados
            </button>
          </div>
        )}

      {dice && (
        <DicePresentation
          roundId={round.id}
          players={players}
          onClose={() => setDice(false)}
          onRolled={() => run(async () => {})}
        />
      )}

      {/* Partidos */}
      {hasMatches && (
        <div style={{ marginTop: 16 }}>
          {round.matches.map((m, i) => (
            <MatchRow
              key={m.id}
              match={m}
              index={i}
              editable={isAdmin && round.status !== 'COMPLETED'}
              busy={busy}
              run={run}
            />
          ))}
          {round.byePlayer && (
            <p className="muted row" style={{ marginTop: 10, gap: 6 }}>
              <Moon size={15} /> Descansa (bye):{' '}
              <strong>{round.byePlayer.name}</strong> — suma{' '}
              {tournament?.pointsWin ?? 3} pts.
            </p>
          )}
        </div>
      )}

      {/* Cerrar / reabrir */}
      {isAdmin && hasMatches && round.status !== 'COMPLETED' && (
        <div className="row" style={{ marginTop: 16 }}>
          <button
            className="btn"
            disabled={busy || !allPlayed}
            onClick={() => run(() => api.closeRound(round.id))}
          >
            <CheckCircle2 size={16} /> Cerrar jornada y aplicar puntos
          </button>
          {!allPlayed && (
            <span className="muted">Carga todos los resultados primero.</span>
          )}
        </div>
      )}
      {isAdmin && round.status === 'COMPLETED' && (
        <div className="row" style={{ marginTop: 16 }}>
          <button
            className="btn ghost sm"
            disabled={busy}
            onClick={() => run(() => api.reopenRound(round.id))}
          >
            <RotateCcw size={14} /> Reabrir para corregir
          </button>
        </div>
      )}
    </div>
  );
}

function MatchRow({
  match,
  index,
  editable,
  busy,
  run,
}: {
  match: Match;
  index: number;
  editable: boolean;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [home, setHome] = useState(match.homeScore ?? 0);
  const [away, setAway] = useState(match.awayScore ?? 0);

  const played =
    match.status === 'PLAYED' &&
    match.homeScore != null &&
    match.awayScore != null;
  const winner = played
    ? match.homeScore! > match.awayScore!
      ? 'home'
      : match.homeScore! < match.awayScore!
        ? 'away'
        : 'draw'
    : null;
  const sideCls = (s: 'home' | 'away') =>
    `fm-side ${s} ${winner === s ? 'win' : winner && winner !== 'draw' ? 'lose' : ''}`;

  // Revela con animación escalonada cuando los cruces se acaban de generar.
  const revealing = match.status === 'SCHEDULED';

  return (
    <div
      className={`fifa-match ${revealing ? 'revealing' : ''}`}
      style={revealing ? { animationDelay: `${index * 120}ms` } : undefined}
    >
      <div className={sideCls('home')}>
        <span className="fm-name">{match.homePlayer.name}</span>
      </div>

      <div className="fm-center">
        {editable ? (
          <div className="fm-score-edit">
            <ScoreStepper value={home} onChange={setHome} disabled={busy} />
            <span className="fm-dash">-</span>
            <ScoreStepper value={away} onChange={setAway} disabled={busy} />
            <button
              className="btn sm"
              disabled={busy}
              onClick={() => run(() => api.enterResult(match.id, home, away))}
            >
              {played ? <Check size={14} /> : 'Guardar'}
            </button>
          </div>
        ) : played ? (
          <div className="fm-score">
            <span className="fm-num">{match.homeScore}</span>
            <span className="fm-dash">-</span>
            <span className="fm-num">{match.awayScore}</span>
          </div>
        ) : (
          <span className="fm-vs">VS</span>
        )}
      </div>

      <div className={sideCls('away')}>
        <span className="fm-name">{match.awayPlayer.name}</span>
      </div>
    </div>
  );
}
