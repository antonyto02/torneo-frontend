import { useRef, useState } from 'react';
import { Plus, Rocket, Settings, Trash2, UserPlus } from 'lucide-react';
import { api } from '../api';
import { GroupRoulette } from '../anim';
import type { Rule, Tournament } from '../types';

interface Props {
  tournament: Tournament | null;
  rules: Rule[];
  onChange: () => void;
  missing: boolean;
}

export function Setup({ tournament, rules, onChange, missing }: Props) {
  if (missing || !tournament) {
    return <CreateForm onChange={onChange} />;
  }
  return (
    <ManagePanel tournament={tournament} rules={rules} onChange={onChange} />
  );
}

function CreateForm({ onChange }: { onChange: () => void }) {
  const [numGroups, setNumGroups] = useState(3);
  const [names, setNames] = useState<string[]>(['', '']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const playerNames = names.map((s) => s.trim()).filter(Boolean);

  const setNameAt = (i: number, val: string) =>
    setNames((arr) => arr.map((n, idx) => (idx === i ? val : n)));

  const addRow = () => {
    setNames((arr) => [...arr, '']);
    // Enfoca el nuevo campo en el siguiente render.
    setTimeout(() => {
      const last = inputsRef.current[names.length];
      last?.focus();
    }, 0);
  };

  const removeRow = (i: number) =>
    setNames((arr) =>
      arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i),
    );

  const submit = async () => {
    if (playerNames.length < 2) {
      setError('Agrega al menos 2 jugadores.');
      return;
    }
    const dup = playerNames.find(
      (n, i) =>
        playerNames.findIndex((m) => m.toLowerCase() === n.toLowerCase()) !== i,
    );
    if (dup) {
      setError(`Hay un jugador repetido: "${dup}".`);
      return;
    }
    if (numGroups > playerNames.length) {
      setError('Hay más grupos que jugadores.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.createTournament({ numGroups, playerNames });
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>
        <Settings size={20} /> Configurar torneo nuevo
      </h2>
      <p className="muted">
        Solo necesitas los nombres de los participantes y el número de grupos.
        Las jornadas no son fijas: la fase regular termina cuando todos hayan
        jugado contra todos.
      </p>

      <Field label="Número de grupos">
        <input
          type="number"
          min={1}
          value={numGroups}
          onChange={(e) => setNumGroups(Number(e.target.value))}
          style={{ width: 120 }}
        />
      </Field>

      <Field label={`Jugadores (${playerNames.length})`}>
        <div className="player-inputs">
          {names.map((n, i) => (
            <div key={i} className="player-input-row">
              <span className="num-badge">{i + 1}</span>
              <input
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                value={n}
                placeholder={`Jugador ${i + 1}`}
                onChange={(e) => setNameAt(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (i === names.length - 1) addRow();
                    else inputsRef.current[i + 1]?.focus();
                  }
                }}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn ghost sm"
                disabled={names.length <= 1}
                onClick={() => removeRow(i)}
                aria-label="Quitar jugador"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn ghost sm"
          onClick={addRow}
          style={{ marginTop: 10 }}
        >
          <UserPlus size={15} /> Agregar jugador
        </button>
      </Field>

      {error && <div className="error">{error}</div>}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" disabled={busy} onClick={submit}>
          <Plus size={16} /> Crear torneo
        </button>
        <span className="muted">
          Tras crearlo podrás girar la ruleta de grupos.
        </span>
      </div>
    </div>
  );
}

function ManagePanel({
  tournament,
  rules,
  onChange,
}: {
  tournament: Tournament;
  rules: Rule[];
  onChange: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const isSetup = tournament.status === 'SETUP';

  return (
    <>
      <div className="card bare">
        <div className="spread">
          <h2 style={{ margin: 0 }}>
            <Settings size={20} /> Administración
          </h2>
          {isSetup && (
            <button
              className="btn green"
              disabled={busy}
              onClick={() => run(() => api.startTournament())}
            >
              <Rocket size={16} /> Arrancar torneo
            </button>
          )}
        </div>
        {error && <div className="error">{error}</div>}
        <div className="grid-2" style={{ marginTop: 12 }}>
          <Info label="Estado" value={tournament.status} />
          <Info label="Jornada actual" value={tournament.currentRound} />
          <Info label="Grupos" value={tournament.numGroups} />
          <Info
            label="Puntaje (G/E/P)"
            value={`${tournament.pointsWin}/${tournament.pointsDraw}/${tournament.pointsLoss}`}
          />
          <Info
            label="Clasifican"
            value={`${tournament.classifyPerGroup}/grupo + ${tournament.wildcards} comodines`}
          />
          <Info
            label="Fase regular"
            value={tournament.regularComplete ? 'Completa' : 'En curso'}
          />
        </div>
      </div>

      {/* Reglas habilitadas para la ruleta de jornada */}
      <RulesPanel
        tournament={tournament}
        rules={rules}
        busy={busy}
        run={run}
      />

      {/* Ruleta de grupos (solo en configuración) */}
      {isSetup && (
        <GroupRoulette tournament={tournament} onChange={onChange} />
      )}

    </>
  );
}

function RulesPanel({
  tournament,
  rules,
  busy,
  run,
}: {
  tournament: Tournament;
  rules: Rule[];
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const enabled = new Set(tournament.rulePool);

  const toggle = (id: string) => {
    const next = enabled.has(id)
      ? tournament.rulePool.filter((x) => x !== id)
      : [...tournament.rulePool, id];
    run(() => api.updateTournament({ rulePool: next }));
  };

  return (
    <div className="card bare">
      <h3 style={{ margin: 0 }}>Reglas habilitadas para la ruleta</h3>
      <p className="muted" style={{ marginTop: 4 }}>
        Activa o desactiva qué reglas pueden caer en el sorteo de cada jornada.
        Las desactivadas nunca salen.
      </p>
      <div className="rules-grid">
        {rules.map((r) => {
          const on = enabled.has(r.id);
          return (
            <button
              key={r.id}
              type="button"
              className={`rule-toggle ${on ? 'on' : 'off'}`}
              disabled={busy}
              onClick={() => toggle(r.id)}
            >
              <span className="rt-emoji">{r.emoji}</span>
              <span className="rt-text">
                <strong>{r.label}</strong>
                <span className="muted">{r.description}</span>
              </span>
              <span className="rt-state">{on ? 'Activada' : 'Desactivada'}</span>
            </button>
          );
        })}

        {/* Jornada tranquila como opción activable (sin regla) */}
        {(() => {
          const on = enabled.has('QUIET');
          return (
            <button
              type="button"
              className={`rule-toggle ${on ? 'on' : 'off'}`}
              disabled={busy}
              onClick={() => toggle('QUIET')}
            >
              <span className="rt-emoji">😌</span>
              <span className="rt-text">
                <strong>Jornada tranquila</strong>
                <span className="muted">
                  Puede no caer ninguna regla esa jornada.
                </span>
              </span>
              <span className="rt-state">{on ? 'Activada' : 'Desactivada'}</span>
            </button>
          );
        })()}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block', marginTop: 12 }}>
      <div className="muted" style={{ marginBottom: 4, fontSize: '0.82rem' }}>
        {label}
      </div>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: '0.78rem' }}>
        {label}
      </div>
      <strong>{value}</strong>
    </div>
  );
}
