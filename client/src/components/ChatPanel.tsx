import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../store/AuthContext';
import { supabase } from '../lib/supabase';

interface ChatMessage {
  id?: string;
  username: string;
  text: string;
  timestamp: number;
  isAnnouncement?: boolean;
}

const MAX_MESSAGES = 100;
const RATE_LIMIT_MS = 1000;

export default function ChatPanel() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [tab, setTab] = useState<'chat' | 'announcements'>('chat');
  const lastMessageAt = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const loadHistory = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, username, text, created_at, is_announcement')
        .order('created_at', { ascending: true })
        .limit(MAX_MESSAGES);
      if (error) {
        const fallback = await supabase
          .from('chat_messages')
          .select('id, username, text, created_at')
          .order('created_at', { ascending: true })
          .limit(MAX_MESSAGES);
        if (fallback.data) {
          setMessages(
            fallback.data.map((r) => ({
              id: (r as { id?: string }).id,
              username: r.username,
              text: r.text,
              timestamp: new Date(r.created_at).getTime(),
              isAnnouncement: false,
            }))
          );
        }
        return;
      }
      if (data) {
        setMessages(
          data.map((r) => ({
            id: (r as { id?: string }).id,
            username: r.username,
            text: r.text,
            timestamp: new Date(r.created_at).getTime(),
            isAnnouncement: (r as { is_announcement?: boolean }).is_announcement ?? false,
          }))
        );
      }
    };
    loadHistory();
    setConnected(true);

    const channel = supabase
      .channel('global-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const row = payload.new as { id?: string; username: string; text: string; created_at: string; is_announcement?: boolean };
          setMessages((prev) =>
            [
              ...prev.slice(-(MAX_MESSAGES - 1)),
              {
                id: row.id,
                username: row.username,
                text: row.text,
                timestamp: new Date(row.created_at).getTime(),
                isAnnouncement: row.is_announcement ?? false,
              },
            ]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      setConnected(false);
    };
  }, [user]);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  async function send() {
    const t = input.trim();
    if (!t || !user) return;
    const now = Date.now();
    if (now - lastMessageAt.current < RATE_LIMIT_MS) {
      setError('Please wait before sending another message.');
      return;
    }
    if (t.length > 500) {
      setError('Message too long.');
      return;
    }
    setError('');
    lastMessageAt.current = now;
    const { error: err } = await supabase.from('chat_messages').insert({
      username: user.username,
      text: t,
    });
    if (err) setError(err.message);
    else setInput('');
  }

  const displayMessages = tab === 'announcements' ? messages.filter((m) => m.isAnnouncement) : messages;

  return (
    <div className="flex flex-col h-[400px] rounded-xl bg-slate-800/80 border border-slate-600 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-700/50 border-b border-slate-600">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('chat')}
            className={`px-2 py-1 rounded text-sm font-medium transition ${tab === 'chat' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white'}`}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => setTab('announcements')}
            className={`px-2 py-1 rounded text-sm font-medium transition ${tab === 'announcements' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white'}`}
          >
            Announcements
          </button>
        </div>
        <span className={`text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
          {connected ? 'Online' : 'Offline'}
        </span>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {tab === 'announcements' && displayMessages.length === 0 && (
          <p className="text-slate-500 text-sm">No legendary+ rolls yet. Roll to see announcements here!</p>
        )}
        {tab === 'chat' && messages.length === 0 && (
          <p className="text-slate-500 text-sm">No messages yet. Say hello!</p>
        )}
        {displayMessages.map((msg, i) => (
          <div
            key={msg.id ?? `msg-${i}-${msg.timestamp}`}
            className={`text-sm ${msg.isAnnouncement ? 'rounded-lg bg-amber-500/10 border border-amber-500/30 px-2 py-1.5' : ''}`}
          >
            <span className={msg.isAnnouncement ? 'text-amber-400 font-semibold' : 'text-amber-400 font-medium'}>
              {msg.username}:
            </span>{' '}
            <span className={msg.isAnnouncement ? 'text-amber-200/90' : 'text-slate-300'}>{msg.text}</span>
          </div>
        ))}
      </div>
      {error && <p className="text-red-400 text-xs px-3 py-1">{error}</p>}
      {tab === 'chat' && (
        <div className="p-2 flex gap-2 border-t border-slate-600">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Type a message..."
            maxLength={500}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 text-sm focus:ring-2 focus:ring-amber-500"
          />
          <button
            onClick={send}
            disabled={!connected || !input.trim()}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-semibold text-sm"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
