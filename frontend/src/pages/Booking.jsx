import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client, { getErrorMessage } from '../api/client';
import ChatWidget from '../components/ChatWidget';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Booking() {
  const [organizations, setOrganizations] = useState([]);
  const [orgId, setOrgId] = useState('');
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    client.get('/organizations').then(({ data }) => setOrganizations(data.data)).catch((err) => setError(getErrorMessage(err)));
  }, []);

  useEffect(() => {
    if (!orgId) { setServices([]); return; }
    client.get('/services', { params: { organizationId: orgId } }).then(({ data }) => setServices(data.data)).catch((err) => setError(getErrorMessage(err)));
  }, [orgId]);

  useEffect(() => {
    if (!serviceId || !date) { setSlots([]); return; }
    setLoadingSlots(true);
    client
      .get('/slots', { params: { serviceId, date } })
      .then(({ data }) => setSlots(data.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoadingSlots(false));
  }, [serviceId, date]);

  const handleBook = async (slotId) => {
    setBooking(slotId);
    setError('');
    try {
      const { data } = await client.post('/appointments', { serviceId, slotId });
      setSuccess(data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBooking(null);
    }
  };

  if (success) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <div className="card">
          <h1 className="text-2xl font-semibold text-green-700">Appointment confirmed!</h1>
          <p className="mt-2 text-slate-600">Your token is</p>
          <p className="mt-1 text-4xl font-bold text-brand-700">{success.token}</p>
          <p className="mt-2 text-sm text-slate-500">Queue position: {success.position}</p>
          <button className="btn-primary mt-6 w-full" onClick={() => navigate('/dashboard')}>Go to my appointments</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Book an appointment</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="card space-y-4">
        <div>
          <label className="label">Organization</label>
          <select className="input" value={orgId} onChange={(e) => { setOrgId(e.target.value); setServiceId(''); }}>
            <option value="">Select an organization</option>
            {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        {orgId && (
          <div>
            <label className="label">Service</label>
            <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Select a service</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.durationMinutes} min)</option>)}
            </select>
          </div>
        )}

        {serviceId && (
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}
      </div>

      {serviceId && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Available time slots</h2>
          {loadingSlots && <p className="text-sm text-slate-500">Loading slots…</p>}
          {!loadingSlots && slots.length === 0 && <p className="text-sm text-slate-500">No slots available for this date. Try another date.</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {slots.map((slot) => (
              <button
                key={slot.id}
                disabled={slot.availableCapacity <= 0 || booking === slot.id}
                onClick={() => handleBook(slot.id)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm hover:border-brand-500 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <div className="font-medium">{new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="text-xs text-slate-400">
                  {booking === slot.id ? 'Booking…' : slot.availableCapacity > 0 ? `${slot.availableCapacity} open` : 'Full'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <ChatWidget />
    </div>
  );
}
