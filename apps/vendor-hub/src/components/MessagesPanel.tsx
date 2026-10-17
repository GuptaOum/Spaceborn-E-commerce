'use client';

import { useEffect, useState } from 'react';
import { useDraft } from '@spaceborn/web-core/use-draft';
import { api } from '@spaceborn/web-core/api';
import { formatDateTime } from '@spaceborn/web-core/format';

interface Note {
  id: number;
  senderRole: 'admin' | 'vendor';
  body: string;
  createdAt: string;
}

/** One thread with the Spaceborn admins. Polls; there is no live socket. */
export function MessagesPanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [after, setAfter] = useState(0);
  const [text, setText] = useDraft('vendor:messages:text', '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const load = () => {
      api<{ messages: Note[] }>(`/vendor/messages?after=${after}`)
        .then((res) => {
          if (stop || res.messages.length === 0) return;
          setNotes((prev) => [...prev, ...res.messages]);
          setAfter(res.messages[res.messages.length - 1]!.id);
        })
        .catch((err: Error) => {
          if (!stop) setError(err.message);
        });
    };
    load();
    const timer = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [after]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError(null);
    try {
      const res = await api<{ message: Note }>('/vendor/messages', { method: 'POST', body: { body } });
      setNotes((prev) => (prev.some((n) => n.id === res.message.id) ? prev : [...prev, res.message]));
      setAfter(res.message.id);
      setText('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold">Messages with Spaceborn</h2>
        <p className="text-xs text-slate-500">This thread is only for your store. Customers are not on it.</p>
      </div>
      <ul className="max-h-96 space-y-2 overflow-y-auto px-4 py-3">
        {notes.length === 0 && <li className="text-sm text-slate-500">No messages yet. Ask about a listing, an order, or a rejection.</li>}
        {notes.map((note) => (
          <li key={note.id} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${note.senderRole === 'vendor' ? 'ml-auto bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}>
            <p>{note.body}</p>
            <p className={`mt-1 text-[10px] ${note.senderRole === 'vendor' ? 'text-slate-300' : 'text-slate-500'}`}>
              {note.senderRole === 'vendor' ? 'You' : 'Spaceborn'} · {formatDateTime(note.createdAt)}
            </p>
          </li>
        ))}
      </ul>
      {error && <p className="px-4 text-xs text-red-700">{error}</p>}
      <form onSubmit={(e) => void send(e)} className="flex gap-2 border-t border-slate-100 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder="Write a message"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
          Send
        </button>
      </form>
    </section>
  );
}
