import type {
  Classified,
  DiceRoll,
  GroupTable,
  PlayoffMatch,
  Round,
  Rule,
  Standing,
  Tournament,
} from './types';

const BASE = (
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3000/api'
).replace(/\/+$/, ''); // sin barra final → evita //auth/login

const TOKEN_KEY = 'torneo_admin_token';

export const auth = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
  get isAdmin() {
    return !!localStorage.getItem(TOKEN_KEY);
  },
};

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const data = await res.json();
      message = Array.isArray(data.message)
        ? data.message.join(', ')
        : (data.message ?? message);
    } catch {
      /* ignore */
    }
    if (res.status === 401) auth.clear();
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  login: (password: string) =>
    request<{ token: string }>('POST', '/auth/login', { password }),

  // Tournament
  getTournament: () => request<Tournament>('GET', '/tournament'),
  getConfig: () => request<Tournament>('GET', '/tournament/config'),
  getRules: () => request<Rule[]>('GET', '/tournament/rules'),
  createTournament: (dto: unknown) =>
    request<Tournament>('POST', '/tournament', dto),
  updateTournament: (dto: unknown) =>
    request<Tournament>('PATCH', '/tournament', dto),
  reshuffleGroups: () =>
    request<Tournament>('POST', '/tournament/reshuffle-groups'),
  startTournament: () => request<Tournament>('POST', '/tournament/start'),

  // Players
  getPlayers: () => request<import('./types').Player[]>('GET', '/players'),
  addPlayer: (name: string, groupId?: string) =>
    request('POST', '/players', { name, groupId }),
  updatePlayer: (id: string, dto: unknown) =>
    request('PATCH', `/players/${id}`, dto),
  removePlayer: (id: string) => request('DELETE', `/players/${id}`),

  // Standings
  getStandings: () => request<Standing[]>('GET', '/standings'),
  getGroupTables: () => request<GroupTable[]>('GET', '/standings/groups'),

  // Rounds
  getRounds: () => request<Round[]>('GET', '/rounds'),
  getRound: (id: string) => request<Round>('GET', `/rounds/${id}`),
  createNextRound: () => request<Round>('POST', '/rounds/next'),
  pairRound: (id: string) => request<Round>('POST', `/rounds/${id}/pair`),
  enterResult: (matchId: string, homeScore: number, awayScore: number) =>
    request<Round>('PATCH', `/rounds/matches/${matchId}/result`, {
      homeScore,
      awayScore,
    }),
  closeRound: (id: string) => request<Round>('POST', `/rounds/${id}/close`),
  reopenRound: (id: string) => request<Round>('POST', `/rounds/${id}/reopen`),

  // Events
  drawEvent: (roundId: string) =>
    request<Round>('POST', `/events/rounds/${roundId}/draw`),
  setBet: (roundId: string, playerId: string, pointsBet: number) =>
    request('POST', `/events/rounds/${roundId}/bet`, { playerId, pointsBet }),
  drawAlliances: (roundId: string) =>
    request<Round>('POST', `/events/rounds/${roundId}/alliance/draw`),
  setDice: (roundId: string, playerId: string, value: number) =>
    request('POST', `/events/rounds/${roundId}/dice`, { playerId, value }),
  rollDice: (roundId: string, playerId: string) =>
    request<DiceRoll>('POST', `/events/rounds/${roundId}/dice/roll`, {
      playerId,
    }),

  // Playoff
  getPlayoff: () => request<PlayoffMatch[]>('GET', '/playoff'),
  getClassified: () => request<Classified[]>('GET', '/playoff/classified'),
  generatePlayoff: () => request<PlayoffMatch[]>('POST', '/playoff/generate'),
  enterPlayoffResult: (
    matchId: string,
    homeScore: number,
    awayScore: number,
  ) =>
    request<PlayoffMatch[]>('PATCH', `/playoff/matches/${matchId}/result`, {
      homeScore,
      awayScore,
    }),
  resetPlayoff: () => request('POST', '/playoff/reset'),
};
