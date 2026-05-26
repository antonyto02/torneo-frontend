import { useEffect, useRef, useState } from 'react';
import { Dices, Maximize, Minus, Plus, RotateCcw, Shuffle, X } from 'lucide-react';
import { api } from './api';
import { QUIET_RULE } from './types';
import type { Match, Player, Rule, Tournament } from './types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const WHEEL_COLORS = [
  '#f5a623',
  '#3fb950',
  '#58a6ff',
  '#f85149',
  '#a371f7',
  '#e3b341',
  '#ec6cb9',
  '#56d4dd',
];

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Opción visible en una ruleta de regla (regla real o "tranquila"). */
interface RuleSlot {
  id: string | null;
  emoji: string;
  label: string;
}

function ruleSlot(rule: Rule | undefined): RuleSlot {
  if (!rule) return { id: null, emoji: QUIET_RULE.emoji, label: QUIET_RULE.label };
  return { id: rule.id, emoji: rule.emoji, label: rule.label };
}

// ──────────────────────────────────────────────────────────────
// Ruleta de grupos — gira y reparte a los jugadores 1º→A, 2º→B…
// ──────────────────────────────────────────────────────────────

interface Placed {
  player: Player;
  groupId: string;
}

export function GroupRoulette({
  tournament,
  onChange,
}: {
  tournament: Tournament;
  onChange: () => void;
}) {
  const groups = [...tournament.groups].sort((a, b) => a.order - b.order);
  const active = tournament.players.filter((p) => p.active);

  // Sesión de sorteo en curso: quiénes faltan por salir y quiénes ya cayeron.
  const [remaining, setRemaining] = useState<Player[] | null>(null);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [presenting, setPresenting] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const started = remaining !== null;
  const done = started && remaining!.length === 0;

  // Salir del modo presentación si el usuario abandona la pantalla completa.
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Deja la ruleta lista al montar: el primer giro ya saca jugador.
  useEffect(() => {
    setRemaining((r) => (r === null ? shuffleArr(active) : r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterPresent = () => {
    setPresenting(true);
    requestAnimationFrame(() => {
      const el = overlayRef.current;
      if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    });
  };
  const exitPresent = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    setPresenting(false);
  };

  const startDraw = () => {
    setRemaining(shuffleArr(active));
    setPlaced([]);
    setRotation(0);
    setWinner(null);
    setError('');
  };

  const spinOne = async () => {
    if (!remaining || spinning || remaining.length === 0) return;
    setSpinning(true);
    setWinner(null);
    setError('');

    const n = remaining.length;
    const winIdx = Math.floor(Math.random() * n);
    const seg = 360 / n;
    // Llevar el centro del gajo ganador arriba (puntero a 0°), girando hacia
    // adelante varias vueltas para que se sienta una ruleta.
    const center = winIdx * seg + seg / 2;
    const desiredMod = (360 - center) % 360;
    let next = rotation - (rotation % 360) + desiredMod + 360 * 5;
    if (next <= rotation) next += 360;
    setRotation(next);

    await sleep(3900); // dura lo que la transición CSS

    const chosen = remaining[winIdx];
    const groupId = groups[placed.length % groups.length].id;
    try {
      await api.updatePlayer(chosen.id, { groupId });
      const rest = remaining.filter((_, i) => i !== winIdx);
      setPlaced((p) => [...p, { player: chosen, groupId }]);
      setRemaining(rest);
      setWinner(chosen.name);
      setSpinning(false);
      if (rest.length === 0) onChange();
    } catch (e) {
      setSpinning(false);
      setError((e as Error).message);
    }
  };

  const wheelPlayers = remaining ?? active;
  const n = wheelPlayers.length;
  const seg = n > 0 ? 360 / n : 360;
  // Fondo de gajos con conic-gradient.
  const stops = wheelPlayers
    .map((_, i) => {
      const c = WHEEL_COLORS[i % WHEEL_COLORS.length];
      return `${c} ${i * seg}deg ${(i + 1) * seg}deg`;
    })
    .join(', ');

  const lastPlaced = placed[placed.length - 1];
  const lastGroupName = lastPlaced
    ? (groups.find((g) => g.id === lastPlaced.groupId)?.name ?? '')
    : '';
  const remainingCount = remaining?.length ?? 0;

  // Solo info dinámica: quién acaba de caer, o el cierre. Sin instrucciones.
  const statusNode = done
    ? '¡Sorteo completo! 🎉'
    : spinning
      ? 'Girando…'
      : winner && lastPlaced
        ? `${winner} → ${lastGroupName}`
        : '';

  // Un solo botón: saca al siguiente jugador (o reinicia al terminar).
  const spinAction = () => {
    if (done) startDraw();
    else void spinOne();
  };
  const spinLabel = spinning
    ? 'Girando…'
    : done
      ? 'Reiniciar sorteo'
      : `Sacar jugador · faltan ${remainingCount}`;
  const SpinIcon = done ? RotateCcw : Shuffle;

  const wheelEl =
    n > 0 ? (
      <div className="fortune-wrap">
        <div className="fortune-pointer" />
        <div
          className="fortune"
          style={{
            transform: `rotate(${rotation}deg)`,
            background: `conic-gradient(${stops})`,
          }}
        >
          {wheelPlayers.map((p, i) => (
            <div key={p.id} className="seg-label">
              <span
                style={{
                  transform: `rotate(${i * seg + seg / 2 - 90}deg) translateX(var(--label-r, 46px))`,
                }}
              >
                {p.name}
              </span>
            </div>
          ))}
        </div>
        <div className="fortune-hub" />
      </div>
    ) : null;

  const groupCols = (
    <div className="group-board">
      {groups.map((g, gi) => {
        const members = placed.filter((p) => p.groupId === g.id);
        // Casillas previstas para este grupo (reparto round-robin 1→A, 2→B…).
        const cap = Math.max(
          members.length,
          Math.ceil((active.length - gi) / groups.length),
        );
        return (
          <div key={g.id} className="fifa-group">
            <div className="fifa-group-head">{g.name}</div>
            <div className="fifa-slots">
              {Array.from({ length: cap }).map((_, idx) => {
                const m = members[idx];
                return (
                  <div
                    key={idx}
                    className={`fifa-slot ${m ? 'filled' : 'empty'}`}
                  >
                    <span className="fifa-pos">{idx + 1}</span>
                    <span className="fifa-name">
                      {m ? m.player.name : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="card bare">
        <div className="spread">
          <h3 style={{ margin: 0 }}>
            <Shuffle size={18} /> Sorteo de grupos
          </h3>
          <button className="btn" onClick={enterPresent}>
            <Maximize size={16} /> Proyectar sorteo
          </button>
        </div>

        {statusNode && (
          <p className="muted" style={{ marginTop: 6 }}>
            {statusNode}
          </p>
        )}

        {error && <div className="error">{error}</div>}
        {wheelEl}
        {groupCols}
      </div>

      {presenting && (
        <div className="present-overlay" ref={overlayRef}>
          <button className="present-close" onClick={exitPresent}>
            <X size={18} /> Cerrar
          </button>
          <h2 className="present-title">🎲 Sorteo de grupos</h2>
          {wheelEl}
          {statusNode && <p className="present-status">{statusNode}</p>}
          {error && <div className="error">{error}</div>}
          <button
            className={done ? 'btn ghost lg' : 'btn lg'}
            disabled={spinning}
            onClick={spinAction}
          >
            <SpinIcon size={22} /> {spinLabel}
          </button>
          {groupCols}
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Presentación de emparejamientos — reveal de los cruces del suizo
// (no es ruleta: el algoritmo ya decidió; esto solo lo presenta)
// ──────────────────────────────────────────────────────────────

/** Contenido del reveal de cruces (sin overlay ni pantalla completa). */
function PairingReveal({
  roundNumber,
  matches,
  byePlayer,
}: {
  roundNumber: number;
  matches: Match[];
  byePlayer: Player | null;
}) {
  const [revealed, setRevealed] = useState(0);
  const total = matches.length + (byePlayer ? 1 : 0);

  // Reveal automático y escalonado de cada cruce (efecto presentación).
  useEffect(() => {
    if (revealed >= total) return;
    const delay = revealed === 0 ? 500 : 950;
    const t = setTimeout(() => setRevealed((r) => r + 1), delay);
    return () => clearTimeout(t);
  }, [revealed, total]);

  return (
    <>
      <h2 className="present-title">🆚 Jornada {roundNumber} · Emparejamientos</h2>

      <div className="vs-list">
        {matches.map((m, i) => (
          <div key={m.id} className={`vs-card ${i < revealed ? 'show' : ''}`}>
            <span className="vs-home">{m.homePlayer.name}</span>
            <span className="vs-badge">VS</span>
            <span className="vs-away">{m.awayPlayer.name}</span>
          </div>
        ))}
        {byePlayer && (
          <div
            className={`vs-card bye ${matches.length < revealed ? 'show' : ''}`}
          >
            <span className="vs-home">{byePlayer.name}</span>
            <span className="vs-badge">descansa</span>
          </div>
        )}
      </div>
    </>
  );
}

export function PairingPresentation({
  roundNumber,
  matches,
  byePlayer,
  onClose,
}: {
  roundNumber: number;
  matches: Match[];
  byePlayer: Player | null;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = overlayRef.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    const onFs = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [onClose]);

  const close = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
  };

  return (
    <div className="present-overlay pairing" ref={overlayRef}>
      <button className="present-close" onClick={close}>
        <X size={18} /> Cerrar
      </button>
      <PairingReveal
        roundNumber={roundNumber}
        matches={matches}
        byePlayer={byePlayer}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Presentación de dados — un dado 3D que se lanza por jugador
// ──────────────────────────────────────────────────────────────

// Orientación final del cubo para que cada cara quede al frente.
const FACE_ROT: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 0, y: 180 },
};
// Posición de los puntos (índices de una rejilla 3×3) por valor.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function DieFace({ n }: { n: number }) {
  return (
    <div className={`die-face f${n}`}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="die-cell">
          {PIPS[n].includes(i) && <span className="pip" />}
        </span>
      ))}
    </div>
  );
}

export function DicePresentation({
  roundId,
  players,
  onClose,
  onRolled,
}: {
  roundId: string;
  players: Player[];
  onClose: () => void;
  onRolled: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const active = players.filter((p) => p.active);

  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [rot, setRot] = useState({ x: -24, y: 18 });
  const [error, setError] = useState('');

  const player = active[idx];
  const done = idx >= active.length;

  useEffect(() => {
    const el = overlayRef.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    const onFs = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [onClose]);

  const roll = async () => {
    if (rolling || !player) return;
    setRolling(true);
    setValue(null);
    setError('');
    try {
      const dr = await api.rollDice(roundId, player.id);
      const target = FACE_ROT[dr.value];
      // Gira SIEMPRE hacia adelante (≥4 vueltas) desde donde quedó y cae
      // en la cara correcta. Así es un solo tumbo por jugador, nunca atrás.
      const fwd = (cur: number, mod: number) => {
        const base = cur + 360 * 4;
        const delta = (((mod - base) % 360) + 360) % 360;
        return base + delta;
      };
      setRot((prev) => ({ x: fwd(prev.x, target.x), y: fwd(prev.y, target.y) }));
      // Espera a que termine el tumbo (la transición CSS) y revela.
      setTimeout(() => {
        setValue(dr.value);
        setRolling(false);
        onRolled();
      }, 1250);
    } catch (e) {
      setRolling(false);
      setError((e as Error).message);
    }
  };

  const next = () => {
    setIdx((i) => i + 1);
    setValue(null);
    // No se resetea la orientación: el siguiente tiro sigue hacia adelante.
  };

  const close = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
  };

  return (
    <div className="present-overlay dice" ref={overlayRef}>
      <button className="present-close" onClick={close}>
        <X size={18} /> Cerrar
      </button>
      <h2 className="present-title">🎲 Dados de puntos</h2>

      {done ? (
        <>
          <p className="present-status">¡Todos lanzaron su dado! 🎲</p>
          <button className="btn lg" onClick={close}>
            <X size={20} /> Cerrar
          </button>
        </>
      ) : (
        <>
          <p className="present-status">
            {player?.name} · {idx + 1} de {active.length}
          </p>

          <div className="die-stage">
            <div
              className="die"
              style={{
                transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <DieFace key={n} n={n} />
              ))}
            </div>
          </div>

          {value != null && (
            <div className="dice-result">{value} puntos</div>
          )}

          {error && <div className="error">{error}</div>}

          <div className="row">
            {value == null ? (
              <button className="btn lg" disabled={rolling} onClick={roll}>
                <Dices size={20} /> {rolling ? 'Lanzando…' : 'Lanzar dado'}
              </button>
            ) : (
              <button className="btn lg" onClick={next}>
                {idx + 1 < active.length ? (
                  <>Siguiente jugador →</>
                ) : (
                  <>Terminar</>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Ruleta de alianzas — los jugadores salen uno a uno y se van
// formando las duplas (el servidor decide el sorteo).
// ──────────────────────────────────────────────────────────────

function AllianceRoulette({
  roundId,
  players,
  busy,
  onPair,
}: {
  roundId: string;
  players: Player[];
  busy: boolean;
  onPair: () => void;
}) {
  const active = players.filter((p) => p.active);
  const nameById = new Map(active.map((p) => [p.id, p.name]));

  const [order, setOrder] = useState<string[] | null>(null); // orden de salida
  const [out, setOut] = useState(0); // cuántos han salido
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState('');

  // El servidor sortea las duplas; reconstruimos el orden de revelado.
  useEffect(() => {
    api
      .drawAlliances(roundId)
      .then((r) => {
        const seen = new Set<string>();
        const seq: string[] = [];
        (r.alliances ?? []).forEach((al) => {
          const key = [al.playerId, al.allyId].sort().join('|');
          if (seen.has(key)) return;
          seen.add(key);
          seq.push(al.playerId, al.allyId);
        });
        const allied = new Set(seq);
        const loner = active.find((p) => !allied.has(p.id));
        if (loner) seq.push(loner.id);
        setOrder(seq);
      })
      .catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  const revealed = new Set(order ? order.slice(0, out) : []);
  const remaining = active.filter((p) => !revealed.has(p.id));
  const done = order != null && out >= order.length;
  const oddTotal = active.length % 2 === 1;

  const spin = async () => {
    if (!order || spinning || done) return;
    setSpinning(true);
    const nextId = order[out];
    const idx = remaining.findIndex((p) => p.id === nextId);
    const nn = remaining.length;
    const seg = 360 / nn;
    const center = idx * seg + seg / 2;
    const desiredMod = (360 - center) % 360;
    let next = rotation - (rotation % 360) + desiredMod + 360 * 5;
    if (next <= rotation) next += 360;
    setRotation(next);
    await sleep(3900);
    setOut((o) => o + 1);
    setSpinning(false);
  };

  // Duplas ya formadas + jugador en espera / sin aliado.
  const pairs: [string, string][] = [];
  if (order) {
    for (let k = 0; k * 2 + 1 < out; k++) {
      pairs.push([order[k * 2], order[k * 2 + 1]]);
    }
  }
  const leftoverIdx = out % 2 === 1 ? out - 1 : -1;
  const leftoverId = order && leftoverIdx >= 0 ? order[leftoverIdx] : null;
  const leftoverIsLoner =
    leftoverId != null && oddTotal && leftoverIdx === (order?.length ?? 0) - 1;

  const nn = remaining.length;
  const seg = nn > 0 ? 360 / nn : 360;
  const stops = remaining
    .map((_, i) => {
      const c = WHEEL_COLORS[i % WHEEL_COLORS.length];
      return `${c} ${i * seg}deg ${(i + 1) * seg}deg`;
    })
    .join(', ');

  return (
    <>
      {!done && nn > 0 && (
        <div className="fortune-wrap">
          <div className="fortune-pointer" />
          <div
            className="fortune"
            style={{
              transform: `rotate(${rotation}deg)`,
              background: `conic-gradient(${stops})`,
            }}
          >
            {remaining.map((p, i) => {
              const a = i * seg + seg / 2 - 90;
              return (
                <div key={p.id} className="seg-label">
                  <span
                    style={{
                      transform: `rotate(${a}deg) translateX(var(--label-r, 46px))`,
                    }}
                  >
                    {p.name}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="fortune-hub" />
        </div>
      )}

      {(pairs.length > 0 || leftoverId) && (
        <div className="vs-list">
          {pairs.map((p, i) => (
            <div key={i} className="vs-card show">
              <span className="vs-home">{nameById.get(p[0])}</span>
              <span className="vs-badge">🤝</span>
              <span className="vs-away">{nameById.get(p[1])}</span>
            </div>
          ))}
          {leftoverId && (
            <div className="vs-card show">
              <span className="vs-home">{nameById.get(leftoverId)}</span>
              <span className="vs-badge">{leftoverIsLoner ? '—' : '…'}</span>
              <span className="vs-away muted">
                {leftoverIsLoner ? 'sin aliado' : 'espera aliado'}
              </span>
            </div>
          )}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {done ? (
        <button className="btn lg" disabled={busy} onClick={onPair}>
          {busy ? 'Emparejando…' : 'Pasar a enfrentamientos →'}
        </button>
      ) : (
        <button
          className="btn lg"
          disabled={spinning || !order}
          onClick={spin}
        >
          <Shuffle size={20} /> {spinning ? 'Girando…' : 'Sacar jugador'}
        </button>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Sorteo de jornada — orquesta 2 fases en un mismo overlay (sin
// salir de pantalla completa): 1) ruleta de regla, 2) enfrentamientos.
// Las reglas con captura (apuestas/alianzas) cortan tras la fase 1.
// ──────────────────────────────────────────────────────────────

type DrawPhase = 'rule' | 'alliances' | 'bets' | 'ready' | 'pairing';

export function RoundDrawPresentation({
  roundId,
  roundNumber,
  rules,
  pool,
  players,
  eventDrawn,
  ruleId: initialRuleId,
  onDrawn,
  onClose,
}: {
  roundId: string;
  roundNumber: number;
  rules: Rule[];
  pool: string[];
  players: Player[];
  eventDrawn: boolean;
  ruleId: string | null;
  onDrawn: () => void;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const rulesById = new Map(rules.map((r) => [r.id, r]));
  const realPool = pool.filter((id) => id !== 'QUIET');
  const options: RuleSlot[] = [
    ...realPool.map((id) => ruleSlot(rulesById.get(id))),
    ...(pool.includes('QUIET') ? [ruleSlot(undefined)] : []), // tranquila
  ];
  if (options.length === 0) options.push(ruleSlot(undefined));
  const active = players.filter((p) => p.active);

  // Qué fase sigue tras conocer la regla.
  const afterRule = (rid: string | null): DrawPhase =>
    rid === 'ALLIANCES' ? 'alliances' : rid === 'POINTS_BET' ? 'bets' : 'ready';

  const [ruleId, setRuleId] = useState<string | null>(initialRuleId);
  const [phase, setPhase] = useState<DrawPhase>(
    eventDrawn ? afterRule(initialRuleId) : 'rule',
  );
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<RuleSlot | null>(
    eventDrawn ? ruleSlot(rulesById.get(initialRuleId ?? '')) : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [matches, setMatches] = useState<Match[]>([]);
  const [byePlayer, setByePlayer] = useState<Player | null>(null);
  const [bets, setBets] = useState<Record<string, number>>({});
  const [pointsById, setPointsById] = useState<Map<string, number>>(new Map());

  // Puntos actuales de cada jugador (para apuestas: solo puedes apostar lo que tienes).
  useEffect(() => {
    api
      .getStandings()
      .then((s) => setPointsById(new Map(s.map((x) => [x.playerId, x.points]))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = overlayRef.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    const onFs = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [onClose]);

  const close = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
  };

  // ── Fase 1: ruleta de regla ──
  const n = options.length;
  const seg = 360 / n;
  const stops = options
    .map((_, i) => {
      const c = WHEEL_COLORS[i % WHEEL_COLORS.length];
      return `${c} ${i * seg}deg ${(i + 1) * seg}deg`;
    })
    .join(', ');

  const spin = async () => {
    if (spinning || landed) return;
    setSpinning(true);
    setError('');
    try {
      const round = await api.drawEvent(roundId);
      const winId = round.ruleId ?? null;
      const found = options.findIndex((o) => o.id === winId);
      const idx = found >= 0 ? found : options.length - 1;

      const center = idx * seg + seg / 2;
      const desiredMod = (360 - center) % 360;
      let next = rotation - (rotation % 360) + desiredMod + 360 * 5;
      if (next <= rotation) next += 360;
      setRotation(next);

      await sleep(3900); // dura lo que la transición CSS de la rueda
      setLanded(options[idx]);
      setRuleId(winId);
      setSpinning(false);
      onDrawn();
    } catch (e) {
      setSpinning(false);
      setError((e as Error).message);
    }
  };

  // ── Empareja (suizo) y pasa a enfrentamientos sin salir del overlay ──
  const pairNow = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const round = await api.pairRound(roundId);
      setMatches(round.matches);
      setByePlayer(round.byePlayer);
      onDrawn();
      setPhase('pairing');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  // ── Fase apuestas: guarda las apuestas y empareja ──
  const saveBetsAndPair = async () => {
    setBusy(true);
    setError('');
    try {
      await Promise.all(
        active.map((p) =>
          api.setBet(
            roundId,
            p.id,
            Math.min(bets[p.id] ?? 0, pointsById.get(p.id) ?? 0),
          ),
        ),
      );
      const round = await api.pairRound(roundId);
      setMatches(round.matches);
      setByePlayer(round.byePlayer);
      onDrawn();
      setPhase('pairing');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  // ── Render por fase ──
  if (phase === 'pairing') {
    return (
      <div className="present-overlay pairing" ref={overlayRef}>
        <button className="present-close" onClick={close}>
          <X size={18} /> Cerrar
        </button>
        <PairingReveal
          roundNumber={roundNumber}
          matches={matches}
          byePlayer={byePlayer}
        />
      </div>
    );
  }

  if (phase === 'alliances') {
    return (
      <div className="present-overlay rule" ref={overlayRef}>
        <button className="present-close" onClick={close}>
          <X size={18} /> Cerrar
        </button>
        <h2 className="present-title">🤝 Jornada {roundNumber} · Alianzas</h2>
        <AllianceRoulette
          roundId={roundId}
          players={players}
          busy={busy}
          onPair={pairNow}
        />
      </div>
    );
  }

  if (phase === 'bets') {
    return (
      <div className="present-overlay rule" ref={overlayRef}>
        <button className="present-close" onClick={close}>
          <X size={18} /> Cerrar
        </button>
        <h2 className="present-title">🎰 Jornada {roundNumber} · Apuestas</h2>
        <p className="present-status">
          Cada jugador apuesta puntos antes de conocer rival. Si no gana, los
          pierde.
        </p>
        <div className="bets-grid">
          {active.map((p) => {
            const pts = pointsById.get(p.id) ?? 0;
            const val = Math.min(bets[p.id] ?? 0, pts);
            return (
              <div key={p.id} className="bet-row">
                <span className="bet-player">
                  {p.name}
                  <span className="bet-pts">{pts} pts</span>
                </span>
                <ScoreStepper
                  value={val}
                  max={pts}
                  disabled={pts === 0}
                  onChange={(v) => setBets((b) => ({ ...b, [p.id]: v }))}
                />
              </div>
            );
          })}
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn lg" disabled={busy} onClick={saveBetsAndPair}>
          {busy ? 'Guardando…' : 'Pasar a enfrentamientos →'}
        </button>
      </div>
    );
  }

  // phase 'rule' o 'ready'
  return (
    <div className="present-overlay rule" ref={overlayRef}>
      <button className="present-close" onClick={close}>
        <X size={18} /> Cerrar
      </button>
      <h2 className="present-title">🎡 Jornada {roundNumber} · Regla</h2>

      <div className="fortune-wrap">
        <div className="fortune-pointer" />
        <div
          className="fortune"
          style={{
            transform: `rotate(${rotation}deg)`,
            background: `conic-gradient(${stops})`,
          }}
        >
          {options.map((o, i) => {
            const a = i * seg + seg / 2 - 90;
            return (
              <div key={i} className="seg-label">
                <span
                  style={{
                    transform: `rotate(${a}deg) translateX(var(--label-r, 46px))`,
                    fontSize: 'clamp(0.8rem, 1.7vh, 1.3rem)',
                  }}
                >
                  {o.emoji} {o.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="fortune-hub" />
      </div>

      {landed && (
        <div className="rule-landed">
          <span className="emoji">{landed.emoji}</span>
          <strong>{landed.label}</strong>
        </div>
      )}
      {error && <div className="error">{error}</div>}

      {!landed ? (
        <button className="btn lg" disabled={spinning} onClick={spin}>
          <Dices size={20} /> {spinning ? 'Girando…' : 'Girar ruleta'}
        </button>
      ) : ruleId === 'ALLIANCES' ? (
        <button className="btn lg" onClick={() => setPhase('alliances')}>
          Sortear alianzas →
        </button>
      ) : ruleId === 'POINTS_BET' ? (
        <button className="btn lg" onClick={() => setPhase('bets')}>
          Capturar apuestas →
        </button>
      ) : (
        <button className="btn lg" disabled={busy} onClick={pairNow}>
          {busy ? 'Emparejando…' : 'Pasar a enfrentamientos →'}
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Stepper de marcador — −/+ custom (sin flechas nativas del input)
// ──────────────────────────────────────────────────────────────

export function ScoreStepper({
  value,
  onChange,
  disabled,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  max?: number;
}) {
  const atMax = max != null && value >= max;
  return (
    <div className="stepper">
      <button
        type="button"
        className="stp-btn"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label="Menos"
      >
        <Minus size={18} />
      </button>
      <span className="stp-val">{value}</span>
      <button
        type="button"
        className="stp-btn"
        disabled={disabled || atMax}
        onClick={() => onChange(max != null ? Math.min(max, value + 1) : value + 1)}
        aria-label="Más"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
