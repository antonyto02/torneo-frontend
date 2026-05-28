import { useEffect, useState } from 'react';
import { api } from '../api';
import { QUIET_RULE } from '../types';
import type { Rule, Tournament } from '../types';

export function Rules({ tournament }: { tournament: Tournament | null }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .getRules()
      .then(setRules)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <div className="skel-list">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skel skel-box" style={{ height: 92 }} />
        ))}
      </div>
    );
  }

  const pool = new Set(tournament?.rulePool ?? []);
  const activeRules = rules.filter((r) => pool.has(r.id));
  const quietOn = pool.has('QUIET');
  const perGroup = tournament?.classifyPerGroup ?? 2;
  const wildcards = tournament?.wildcards ?? 2;

  return (
    <>
      {/* Formato del torneo */}
      <section className="rules-section">
        <h3>Formato</h3>
        <p>
          Liga con <strong>sistema suizo</strong>: cada jornada los emparejamientos
          se generan automáticamente, los puntos similares juegan entre sí y
          <strong> nadie repite rival</strong>. La fase regular termina cuando
          todos jugaron contra todos.
        </p>
        <p>
          <strong>Puntaje:</strong> {tournament?.pointsWin ?? 3} pts por ganar ·{' '}
          {tournament?.pointsDraw ?? 1} por empatar · {tournament?.pointsLoss ?? 0}{' '}
          por perder.
        </p>
      </section>

      {/* Grupos y clasificación */}
      <section className="rules-section">
        <h3>Grupos y clasificación</h3>
        <p>
          Los jugadores se reparten en <strong>{tournament?.numGroups ?? 3} grupos</strong>{' '}
          por sorteo. Los grupos son solo para clasificar; el suizo los ignora al
          emparejar (puedes jugar contra alguien de otro grupo).
        </p>
        <p>
          Clasifican a liguilla los <strong>primeros {perGroup} de cada grupo</strong>{' '}
          (chip verde 🟢) más los <strong>{wildcards} mejores de la tabla general</strong>{' '}
          que no entraron por grupo (chip naranja 🟠 · "mejor general"). El formato
          es intencionalmente injusto: si tu grupo es muy fuerte, alguien con buenos
          puntos puede quedar fuera.
        </p>
      </section>

      {/* Liguilla */}
      <section className="rules-section">
        <h3>Liguilla</h3>
        <p>
          <strong>Eliminación directa a partido único</strong>. Se siembra
          mejor vs peor (1 vs N, 2 vs N-1…) y <strong>cada ronda se reacomoda</strong>:
          los que pasan se ordenan por siembra y se vuelve a emparejar mejor vs peor.
          Sin empates: alguien tiene que ganar.
        </p>
      </section>

      {/* Reglas especiales */}
      <section className="rules-section">
        <h3>Reglas especiales</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          En cada jornada puede caer una de estas reglas (o ninguna, si tranquila
          está activa). El sorteo es público y se proyecta al inicio de la jornada.
        </p>
        <div className="rules-list">
          {activeRules.map((r) => (
            <div className="rule-card" key={r.id}>
              <span className="rc-emoji">{r.emoji}</span>
              <div className="rc-text">
                <strong>{r.label}</strong>
                <span className="muted">{r.description}</span>
              </div>
            </div>
          ))}
          {quietOn && (
            <div className="rule-card">
              <span className="rc-emoji">{QUIET_RULE.emoji}</span>
              <div className="rc-text">
                <strong>{QUIET_RULE.label}</strong>
                <span className="muted">
                  Puede no caer ninguna regla esa jornada.
                </span>
              </div>
            </div>
          )}
          {activeRules.length === 0 && !quietOn && (
            <p className="muted">
              Todavía no hay reglas configuradas en este torneo.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
