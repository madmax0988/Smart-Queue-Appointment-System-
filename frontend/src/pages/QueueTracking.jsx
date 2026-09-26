import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client, { getErrorMessage } from '../api/client';
import { getSocket } from '../store/socketStore';

export default function QueueTracking() {
  const { appointmentId } = useParams();
  const [appointment, setAppointment] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    client
      .get('/appointments/me')
      .then(({ data }) => {
        if (!mounted) return;
        const found = data.data.find((a) => a.id === appointmentId);
        setAppointment(found || null);
      })
      .catch((err) => mounted && setError(getErrorMessage(err)));
    return () => { mounted = false; };
  }, [appointmentId]);

  const refresh = () => {
    client
      .get(`/queues/appointment/${appointmentId}`)
      .then(({ data }) => setStatus(data.data))
      .catch((err) => setError(getErrorMessage(err)));
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [appointmentId]);

  useEffect(() => {
    if (!appointment) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit('queue:subscribe', appointment.serviceId);
    const handleUpdate = () => refresh();
    socket.on('queue:updated', handleUpdate);
    socket.on('token:called', handleUpdate);
    return () => {
      socket.emit('queue:unsubscribe', appointment.serviceId);
      socket.off('queue:updated', handleUpdate);
      socket.off('token:called', handleUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment]);

  return (
    <div className="mx-auto mt-10 max-w-lg px-4">
      <Link to="/dashboard" className="text-sm text-brand-600 hover:underline">&larr; Back to dashboard</Link>
      <h1 className="mt-4 mb-6 text-2xl font-semibold">Live queue status</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!status && !error && <p className="text-sm text-slate-500">Loading queue status…</p>}

      {status && (
        <div className="card">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Now serving</p>
              <p className="mt-1 text-3xl font-bold text-slate-800">{status.nowServing || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Your token</p>
              <p className="mt-1 text-3xl font-bold text-brand-700">{status.tokenLabel}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6 text-center">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
              <p className="mt-1 font-medium">{status.status}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">People ahead</p>
              <p className="mt-1 font-medium">{status.position != null ? Math.max(status.position - 1, 0) : '—'}</p>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-brand-50 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-brand-600">Estimated wait</p>
            <p className="mt-1 text-2xl font-bold text-brand-700">{status.estimatedWaitMinutes} min</p>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">Estimate only — updates live as the queue moves.</p>
        </div>
      )}
    </div>
  );
}
