import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  ListOrdered,
  LogOut,
  Settings,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { api, auth } from './api';
import type { Rule, Tournament } from './types';
import { Standings } from './views/Standings';
import { Rounds } from './views/Rounds';
import { Playoff } from './views/Playoff';
import { Setup } from './views/Setup';
import { AdminLogin } from './views/AdminLogin';

type Tab = 'standings' | 'rounds' | 'playoff' | 'admin';

/** Ruteo mínimo basado en la URL, sin librerías. */
function usePath(): [string, (to: string) => void] {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((to: string) => {
    window.history.pushState({}, '', to);
    setPath(to);
  }, []);
  return [path, navigate];
}

export default function App() {
  const [path, navigate] = usePath();
  const onAdminRoute = path.startsWith('/admin');

  const [tab, setTab] = useState<Tab>('standings');
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [missing, setMissing] = useState(false);
  const [authed, setAuthed] = useState(auth.isAdmin);

  const refresh = useCallback(async () => {
    try {
      const t = await api.getTournament();
      setTournament(t);
      setMissing(false);
    } catch {
      setMissing(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    api.getRules().then(setRules).catch(() => setRules([]));
  }, [refresh]);

  // El modo admin solo aplica dentro de la ruta /admin
  const adminMode = onAdminRoute && authed;

  const onLogin = () => {
    setAuthed(true);
    setTab('admin');
  };
  const onLogout = () => {
    auth.clear();
    setAuthed(false);
    navigate('/');
    setTab('standings');
  };

  // En la ruta /admin sin sesión → pantalla de login dedicada
  if (onAdminRoute && !authed) {
    return (
      <>
        <Header adminMode={false} />
        <main className="container">
          <AdminLogin onLogin={onLogin} onCancel={() => navigate('/')} />
        </main>
      </>
    );
  }

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: 'standings', label: 'Tabla', icon: ListOrdered },
    { id: 'rounds', label: 'Partidos', icon: CalendarDays },
    { id: 'playoff', label: 'Liguilla', icon: Trophy },
  ];
  if (adminMode) tabs.push({ id: 'admin', label: 'Admin', icon: Settings });

  return (
    <>
      <Header
        adminMode={adminMode}
        tabs={tabs}
        tab={tab}
        setTab={setTab}
        onLogout={onLogout}
      />

      <main className="container">
        {!tournament && tab !== 'admin' ? (
          <div className="empty">
            <Trophy size={48} color="var(--border)" />
            <h2 style={{ justifyContent: 'center' }}>Aún no hay torneo</h2>
            <p>El torneo todavía no ha sido configurado. ¡Vuelve pronto! ⚽</p>
          </div>
        ) : (
          <>
            {tab === 'standings' && <Standings />}
            {tab === 'rounds' && (
              <Rounds
                tournament={tournament}
                rules={rules}
                isAdmin={adminMode}
                onChange={refresh}
              />
            )}
            {tab === 'playoff' && (
              <Playoff
                tournament={tournament}
                isAdmin={adminMode}
                onChange={refresh}
              />
            )}
            {tab === 'admin' && adminMode && (
              <Setup
                tournament={tournament}
                rules={rules}
                onChange={refresh}
                missing={missing}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}

function Header({
  adminMode,
  tabs,
  tab,
  setTab,
  onLogout,
}: {
  adminMode: boolean;
  tabs?: { id: Tab; label: string; icon: LucideIcon }[];
  tab?: Tab;
  setTab?: (t: Tab) => void;
  onLogout?: () => void;
}) {
  return (
    <header className="app-header">
      <div className="header-inner">
        {tabs && tabs.length > 0 && (
          <nav className="tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? 'active' : ''}
                onClick={() => setTab?.(t.id)}
              >
                <t.icon size={16} />
                {t.label}
              </button>
            ))}
          </nav>
        )}

        {adminMode && (
          <button
            className="logout-btn"
            onClick={onLogout}
            title="Salir del modo admin"
          >
            <LogOut size={16} /> Salir
          </button>
        )}
      </div>
    </header>
  );
}
