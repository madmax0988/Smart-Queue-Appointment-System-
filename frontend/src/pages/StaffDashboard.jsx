import { useEffect, useState } from 'react';
import client, { getErrorMessage } from '../api/client';
import { getSocket } from '../store/socketStore';

export default function StaffDashboard() {
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    client
      .get('/services')
      .then(({ data }) => setServices(data.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const refresh = (sid) => {
    if (!sid) return;
    client
      .get(`/queues/service/${sid}`)
      .then(({ data }) => setSnapshot(data.data))
      .catch((err) => setError(getErrorMessage(err)));
  };

  useEffect(() => { refresh(serviceId); }, [serviceId]);

  useEffect(() => {
    if (!serviceId) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit('queue:subscribe', serviceId);
    const onUpdate = (payload) => setSnapshot(payload);
    socket.on('queue:updated', onUpdate);
    return () => {
      socket.emit('queue:unsubscribe', serviceId);
      socket.off('queue:updated', onUpdate);
    };
  }, [serviceId]);

  const callNext = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await client.patch(`/queues/service/${serviceId}/next`);
      setSnapshot(data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const updateEntry = async (entryId, status) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await client.patch(`/queues/service/${serviceId}/entries/${entryId}`, { status });
      setSnapshot(data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Staff queue control</h1>

      <div className="card mb-6">
        <label className="label">Service</label>
        <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Select an assigned service</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {serviceId && snapshot && (
        <>
          <div className="card mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Now serving</p>
              <p className="text-3xl font-bold text-brand-700">{snapshot.nowServing || '—'}</p>
            </div>
            <button className="btn-primary" disabled={busy} onClick={callNext}>
              {busy ? 'Working…' : 'Call next'}
            </button>
          </div>

          <h2 className="mb-3 text-lg font-semibold">Waiting ({snapshot.waitingCount})</h2>
          <div className="space-y-2">
            {snapshot.entries.length === 0 && <p className="text-sm text-slate-500">No one waiting right now.</p>}
            {snapshot.entries.map((entry) => (
              <div key={entry.id} className="card flex items-center justify-between py-3">
                <div>
                  <span className="font-medium">{entry.tokenLabel}</span>
                  <span className="ml-2 text-sm text-slate-500">{entry.customerName}</span>
                  <span className="ml-2 text-xs text-slate-400">~{entry.estimatedWaitMinutes} min</span>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary" disabled={busy} onClick={() => updateEntry(entry.id, 'SKIPPED')}>Skip</button>
                  <button className="btn-danger" disabled={busy} onClick={() => updateEntry(entry.id, 'CANCELLED')}>Cancel</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
