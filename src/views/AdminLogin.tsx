import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api, auth } from '../api';

export function AdminLogin({
  onLogin,
  onCancel,
}: {
  onLogin: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token } = await api.login(password);
      auth.set(token);
      onLogin();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 380, margin: '40px auto' }}>
      <h2>
        <KeyRound size={20} /> Acceso de administrador
      </h2>
      <form onSubmit={submit}>
        <div className="row">
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" disabled={loading} type="submit">
            Entrar
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
