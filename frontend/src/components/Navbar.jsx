import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { disconnectSocket } from '../store/socketStore';
import client from '../api/client';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, refreshToken, clearSession } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      if (refreshToken) await client.post('/auth/logout', { refreshToken });
    } catch {
      // ignore network errors on logout
    }
    disconnectSocket();
    clearSession();
    navigate('/login');
  };

  const roleHome = { CUSTOMER: '/dashboard', STAFF: '/staff', ADMIN: '/admin' }[user?.role] || '/';

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to={user ? roleHome : '/'} className="text-lg font-semibold text-brand-700">
          Smart Queue
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 sm:gap-x-4">
          {user ? (
            <>
              {user.role === 'CUSTOMER' && (
                <>
                  <Link to="/dashboard" className="text-sm text-slate-600 hover:text-brand-600">Dashboard</Link>
                  <Link to="/book" className="text-sm text-slate-600 hover:text-brand-600">Book</Link>
                </>
              )}
              {user.role === 'STAFF' && <Link to="/staff" className="text-sm text-slate-600 hover:text-brand-600">Staff</Link>}
              {user.role === 'ADMIN' && <Link to="/admin" className="text-sm text-slate-600 hover:text-brand-600">Admin</Link>}
              <NotificationBell />
              <span className="hidden text-sm text-slate-500 sm:inline">{user.name}</span>
              <button onClick={handleLogout} className="btn-secondary">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-slate-600 hover:text-brand-600">Login</Link>
              <Link to="/register" className="btn-primary">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
