import { useEffect, useRef, useState } from 'react';
import client, { getErrorMessage } from '../api/client';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your appointment assistant. Ask me about services, bookings, or your queue status." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setSending(true);
    setError('');

    try {
      const payload = sessionId ? { message: text, sessionId } : { message: text };
      const { data } = await client.post('/chat', payload);
      setSessionId(data.data.sessionId);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.data.reply }]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-30">
      {open && (
        <div className="mb-3 flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between bg-brand-600 px-4 py-3 text-white">
            <span className="text-sm font-semibold">Smart Appointment Assistant</span>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-white/80 hover:text-white">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.map((m, idx) => (
              <div key={idx} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                {m.content}
              </div>
            ))}
            {sending && <div className="max-w-[85%] rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-400">Thinking…</div>}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about services, bookings, queue…"
              className="input"
              disabled={sending}
            />
            <button type="submit" className="btn-primary" disabled={sending || !input.trim()}>Send</button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700"
        aria-label="Toggle chat assistant"
      >
        <ChatIcon />
      </button>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
