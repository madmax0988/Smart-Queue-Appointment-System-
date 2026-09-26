import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client, { getErrorMessage } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { connectSocket } from '../store/socketStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await client.post('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = data.data;
      setSession(user, accessToken, refreshToken);
      connectSocket(accessToken);
      const roleHome = { CUSTOMER: '/dashboard', STAFF: '/staff', ADMIN: '/admin' }[user.role] || '/';
      navigate(roleHome);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-md">
      <div className="card">
        <h1 className="mb-1 text-2xl font-semibold">Welcome back</h1>
        <p className="mb-6 text-sm text-slate-500">Log in to manage your appointments and queue.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-500">
          No account? <Link to="/register" className="text-brand-600 hover:underline">Sign up</Link>
        </p>
        <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          Demo accounts (after seeding): admin@smartqueue.dev · staff@smartqueue.dev · customer@smartqueue.dev — password: Password123!
        </div>
      </div>
    </div>
  );
}
