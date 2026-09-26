import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-20 text-center">
      <h1 className="text-4xl font-bold text-slate-900">Smart Queue &amp; Appointment Management</h1>
      <p className="mx-auto mt-4 max-w-2xl text-slate-600">
        Book appointments, get a digital token, and track your live queue position in real time — with an AI assistant to help along the way.
      </p>
      <div className="mt-8 flex justify-center gap-4">
        <Link to="/register" className="btn-primary">Get started</Link>
        <Link to="/login" className="btn-secondary">Log in</Link>
      </div>
    </div>
  );
}
