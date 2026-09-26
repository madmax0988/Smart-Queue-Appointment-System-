import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client, { getErrorMessage } from '../api/client';
import ChatWidget from '../components/ChatWidget';

const STATUS_STYLES = {
  CONFIRMED: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-red-100 text-red-700',
  RESCHEDULED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-slate-100 text-slate-600',
  NO_SHOW: 'bg-slate-100 text-slate-500',
};

export default function CustomerDashboard() {
  const [appointments, setAppointments] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    client
      .get('/appointments/me')
      .then(({ data }) => setAppointments(data.data))
      .catch((err) => setError(getErrorMessage(err)));
  };

  useEffect(load, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this appointment? This cannot be undone.')) return;
    setBusyId(id);
    setActionError('');
    try {
      await client.delete(`/appointments/${id}`);
      load();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const active = appointments?.filter((a) => ['CONFIRMED', 'PENDING'].includes(a.status)) || [];
  const past = appointments?.filter((a) => !['CONFIRMED', 'PENDING'].includes(a.status)) || [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My appointments</h1>
        <Link to="/book" className="btn-primary">Book new appointment</Link>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}

      {appointments === null && !error && <p className="text-sm text-slate-500">Loading your appointments…</p>}

      {appointments && active.length === 0 && (
        <div className="card mb-8 text-center text-slate-500">
          No upcoming appointments yet. <Link to="/book" className="text-brand-600 hover:underline">Book one now</Link>.
        </div>
      )}

      <div className="space-y-4">
        {active.map((a) => (
          <div key={a.id} className="card flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-medium">{a.service.name}</h2>
                <span className={`badge ${STATUS_STYLES[a.status]}`}>{a.status}</span>
              </div>
              <p className="text-sm text-slate-500">{a.service.organization.name}</p>
              <p className="text-sm text-slate-500">{new Date(a.slot.startTime).toLocaleString()}</p>
              {a.queueEntry && <p className="mt-1 text-sm font-medium text-brand-700">Token {a.queueEntry.tokenLabel}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Link to={`/queue/${a.id}`} className="btn-secondary">Track queue</Link>
              <button className="btn-danger" disabled={busyId === a.id} onClick={() => handleCancel(a.id)}>
                {busyId === a.id ? 'Cancelling…' : 'Cancel'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {past.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-slate-700">History</h2>
          <div className="space-y-2">
            {past.map((a) => (
              <div key={a.id} className="card flex items-center justify-between py-3">
                <div>
                  <span className="font-medium">{a.service.name}</span>
                  <span className="ml-2 text-sm text-slate-500">{new Date(a.slot.startTime).toLocaleDateString()}</span>
                </div>
                <span className={`badge ${STATUS_STYLES[a.status]}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ChatWidget />
    </div>
  );
}
