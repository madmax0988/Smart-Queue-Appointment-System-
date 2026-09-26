import { useEffect, useState } from 'react';
import client, { getErrorMessage } from '../api/client';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('analytics');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Admin dashboard</h1>
      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {['analytics', 'organizations', 'services', 'staff', 'slots'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'analytics' && <Analytics />}
      {tab === 'organizations' && <Organizations />}
      {tab === 'services' && <Services />}
      {tab === 'staff' && <Staff />}
      {tab === 'slots' && <SlotGenerator />}
    </div>
  );
}

function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get('/admin/analytics').then((r) => setData(r.data.data)).catch((err) => setError(getErrorMessage(err)));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading analytics…</p>;

  const cards = [
    { label: 'Total appointments', value: data.totalAppointments },
    { label: 'Completed', value: data.completed },
    { label: 'Cancelled', value: data.cancelled },
    { label: 'Currently waiting', value: data.waiting },
    { label: 'Avg. wait (min)', value: data.avgWaitMinutes },
    { label: 'Services', value: data.serviceCount },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="card text-center">
          <p className="text-xs uppercase tracking-wide text-slate-400">{c.label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function Organizations() {
  const [orgs, setOrgs] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', address: '', operatingHours: '' });
  const [error, setError] = useState('');

  const load = () => client.get('/organizations').then((r) => setOrgs(r.data.data)).catch((err) => setError(getErrorMessage(err)));
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await client.post('/organizations', form);
      setForm({ name: '', description: '', address: '', operatingHours: '' });
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="card">
        <h2 className="mb-4 font-semibold">Create organization</h2>
        <form onSubmit={submit} className="space-y-3">
          <input className="input" placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="input" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className="input" placeholder="Operating hours" value={form.operatingHours} onChange={(e) => setForm({ ...form, operatingHours: e.target.value })} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" type="submit">Create</button>
        </form>
      </div>
      <div>
        <h2 className="mb-4 font-semibold">Organizations</h2>
        <div className="space-y-2">
          {orgs.map((o) => (
            <div key={o.id} className="card py-3">
              <p className="font-medium">{o.name}</p>
              <p className="text-sm text-slate-500">{o.services.length} service(s)</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Services() {
  const [orgs, setOrgs] = useState([]);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({ organizationId: '', name: '', description: '', durationMinutes: 15, capacityPerSlot: 1 });
  const [error, setError] = useState('');

  const load = () => {
    client.get('/organizations').then((r) => setOrgs(r.data.data));
    client.get('/services').then((r) => setServices(r.data.data)).catch((err) => setError(getErrorMessage(err)));
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await client.post('/services', { ...form, durationMinutes: Number(form.durationMinutes), capacityPerSlot: Number(form.capacityPerSlot) });
      setForm({ organizationId: '', name: '', description: '', durationMinutes: 15, capacityPerSlot: 1 });
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="card">
        <h2 className="mb-4 font-semibold">Create service</h2>
        <form onSubmit={submit} className="space-y-3">
          <select className="input" required value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}>
            <option value="">Select organization</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <input className="input" placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-3">
            <input className="input" type="number" min={5} placeholder="Duration (min)" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            <input className="input" type="number" min={1} placeholder="Capacity/slot" value={form.capacityPerSlot} onChange={(e) => setForm({ ...form, capacityPerSlot: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" type="submit">Create</button>
        </form>
      </div>
      <div>
        <h2 className="mb-4 font-semibold">Services</h2>
        <div className="space-y-2">
          {services.map((s) => (
            <div key={s.id} className="card py-3">
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-slate-500">{s.organization.name} · {s.durationMinutes} min · capacity {s.capacityPerSlot}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Staff() {
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', serviceIds: [] });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => {
    client.get('/services').then((r) => setServices(r.data.data));
    client.get('/admin/staff').then((r) => setStaff(r.data.data)).catch((err) => setError(getErrorMessage(err)));
  };
  useEffect(load, []);

  const toggleService = (id) => {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((s) => s !== id) : [...f.serviceIds, id],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await client.post('/admin/staff', form);
      setSuccess('Staff account created.');
      setForm({ name: '', email: '', password: '', serviceIds: [] });
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="card">
        <h2 className="mb-4 font-semibold">Create staff account</h2>
        <form onSubmit={submit} className="space-y-3">
          <input className="input" placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" type="password" placeholder="Password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <div>
            <p className="label">Assign services</p>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.serviceIds.includes(s.id)} onChange={() => toggleService(s.id)} />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <button className="btn-primary w-full" type="submit">Create staff</button>
        </form>
      </div>
      <div>
        <h2 className="mb-4 font-semibold">Staff</h2>
        <div className="space-y-2">
          {staff.map((s) => (
            <div key={s.id} className="card py-3">
              <p className="font-medium">{s.name} <span className="text-xs text-slate-400">{s.email}</span></p>
              <p className="text-sm text-slate-500">{s.staffAssignments.map((a) => a.service.name).join(', ') || 'No services assigned'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SlotGenerator() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({ serviceId: '', date: todayISO(), startHour: 9, endHour: 17 });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { client.get('/services').then((r) => setServices(r.data.data)); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const { data } = await client.post('/slots/generate', {
        ...form,
        startHour: Number(form.startHour),
        endHour: Number(form.endHour),
      });
      setMessage(`Created ${data.data.length} slot(s).`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="card max-w-md">
      <h2 className="mb-4 font-semibold">Generate slots for a day</h2>
      <form onSubmit={submit} className="space-y-3">
        <select className="input" required value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
          <option value="">Select service</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <div className="flex gap-3">
          <input className="input" type="number" min={0} max={23} value={form.startHour} onChange={(e) => setForm({ ...form, startHour: e.target.value })} />
          <input className="input" type="number" min={1} max={24} value={form.endHour} onChange={(e) => setForm({ ...form, endHour: e.target.value })} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}
        <button className="btn-primary w-full" type="submit">Generate</button>
      </form>
    </div>
  );
}
