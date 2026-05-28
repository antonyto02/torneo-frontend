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
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="skel skel-box"
            style={{ height: 92 }}
          />
        ))}
      </div>
    );
  }

  const pool = new Set(tournament?.rulePool ?? []);
  const activeRules = rules.filter((r) => pool.has(r.id));
  const quietOn = pool.has('QUIET');
  const nothing = activeRules.length === 0 && !quietOn;

  return (
    <>
      <h2 style={{ marginTop: 24 }}>Reglas de la jornada</h2>
      <p className="muted" style={{ marginTop: 4 }}>
        Una de estas reglas puede caer en cada jornada (o ninguna, si tranquila
        está activa).
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
        {nothing && (
          <p className="muted">
            Todavía no hay reglas configuradas en este torneo.
          </p>
        )}
      </div>
    </>
  );
}
