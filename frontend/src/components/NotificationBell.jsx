import { useEffect, useRef, useState } from 'react';
import client, { getErrorMessage } from '../api/client';
import { getSocket } from '../store/socketStore';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    let mounted = true;
    client
      .get('/notifications')
      .then(({ data }) => mounted && setNotifications(data.data))
      .catch((err) => mounted && setError(getErrorMessage(err)));

    const socket = getSocket();
    const handleNew = (notification) => setNotifications((prev) => [notification, ...prev]);
    socket?.on('notification:new', handleNew);

    return () => {
      mounted = false;
      socket?.off('notification:new', handleNew);
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.readStatus).length;

  const markRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readStatus: true } : n)));
    try {
      await client.patch(`/notifications/${id}/read`);
    } catch {
      // non-critical; leave UI optimistic
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-full p-2 hover:bg-slate-100" aria-label="Notifications">
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold">Notifications</div>
          {error && <p className="p-4 text-sm text-red-600">{error}</p>}
          {!error && notifications.length === 0 && <p className="p-4 text-sm text-slate-500">No notifications yet.</p>}
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`block w-full border-b border-slate-50 px-4 py-3 text-left text-sm hover:bg-slate-50 ${n.readStatus ? 'text-slate-500' : 'font-medium text-slate-800'}`}
            >
              {n.message}
              <div className="mt-1 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
