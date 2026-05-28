import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
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
import { Rules } from './views/Rules';
import { Setup } from './views/Setup';
import { AdminLogin } from './views/AdminLogin';

type Tab = 'standings' | 'rounds' | 'playoff' | 'rules' | 'admin';

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

  // Si la tab actual no corresponde al modo (p. ej. 'admin' sin sesión, o
  // 'rules' siendo admin), regresa a Tabla.
  useEffect(() => {
    if (!adminMode && tab === 'admin') setTab('standings');
    if (adminMode && tab === 'rules') setTab('admin');
  }, [adminMode, tab]);

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
        <TopBar adminMode={false} />
        <main className="container">
          <AdminLogin onLogin={onLogin} onCancel={() => navigate('/')} />
        </main>
      </>
    );
  }

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = adminMode
    ? [
        { id: 'standings', label: 'Tabla', icon: ListOrdered },
        { id: 'rounds', label: 'Partidos', icon: CalendarDays },
        { id: 'playoff', label: 'Liguilla', icon: Trophy },
        { id: 'admin', label: 'Admin', icon: Settings },
      ]
    : [
        { id: 'standings', label: 'Tabla', icon: ListOrdered },
        { id: 'rounds', label: 'Partidos', icon: CalendarDays },
        { id: 'playoff', label: 'Liguilla', icon: Trophy },
        { id: 'rules', label: 'Reglas', icon: BookOpen },
      ];

  return (
    <>
      <TopBar adminMode={adminMode} onLogout={onLogout} />

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
            {tab === 'rules' && <Rules tournament={tournament} />}
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

      <BottomNav tabs={tabs} tab={tab} setTab={setTab} />
    </>
  );
}

function TopBar({
  adminMode,
  onLogout,
}: {
  adminMode: boolean;
  onLogout?: () => void;
}) {
  return (
    <header className="app-top">
      <h1>Torneo FC</h1>
      {adminMode && (
        <button
          className="logout-btn-top"
          onClick={onLogout}
          title="Salir del modo admin"
        >
          <LogOut size={18} />
        </button>
      )}
    </header>
  );
}

function BottomNav({
  tabs,
  tab,
  setTab,
}: {
  tabs: { id: Tab; label: string; icon: LucideIcon }[];
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  return (
    <nav className="bottom-nav">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={tab === t.id ? 'active' : ''}
          onClick={() => setTab(t.id)}
        >
          <t.icon size={22} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
