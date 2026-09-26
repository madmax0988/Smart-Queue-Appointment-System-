import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client, { getErrorMessage } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { connectSocket } from '../store/socketStore';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await client.post('/auth/register', form);
      const { user, accessToken, refreshToken } = data.data;
      setSession(user, accessToken, refreshToken);
      connectSocket(accessToken);
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-md">
      <div className="card">
        <h1 className="mb-1 text-2xl font-semibold">Create your account</h1>
        <p className="mb-6 text-sm text-slate-500">Book appointments and track queues in real time.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" required minLength={2} value={form.name} onChange={update('name')} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" required value={form.email} onChange={update('email')} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" required minLength={8} value={form.password} onChange={update('password')} />
            <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-500">
          Already have an account? <Link to="/login" className="text-brand-600 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
