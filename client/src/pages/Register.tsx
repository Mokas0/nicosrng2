import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { supabase } from '../lib/supabase';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedUsername = username.trim();
      if (!isValidEmail(trimmedEmail)) {
        setError('Please enter a valid email address.');
        return;
      }
      if (trimmedUsername.length < 2 || trimmedUsername.length > 20) {
        setError('Username must be 2–20 characters');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      const { data, error: err } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { username: trimmedUsername } },
      });
      if (err) {
        const msg = err.message?.toLowerCase() ?? '';
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('already been registered')) {
          setError('This email is already registered. Sign in instead, or use a different email.');
          return;
        }
        throw err;
      }
      if (!data.user) {
        setError('Registration failed');
        return;
      }
      const { error: profileErr } = await supabase.from('profiles').insert({
        id: data.user.id,
        username: trimmedUsername,
        gold: 100,
        has_auto_roll: false,
        has_quick_roll: false,
        created_at: new Date().toISOString(),
      });
      if (profileErr) {
        if (profileErr.code !== '23505') throw profileErr;
        // unique violation = profile already exists (e.g. resend confirmation)
      }
      if (data.session?.access_token) {
        await login(data.session.access_token);
        navigate('/');
      } else {
        setError('Check your email to confirm your account, then sign in.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        setError('This email is already registered. Sign in instead.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-sm rounded-xl bg-slate-800/80 border border-slate-600 shadow-2xl p-8">
        <h1 className="font-display text-3xl font-bold text-amber-400 text-center mb-2">Fame and Fortune</h1>
        <p className="text-slate-400 text-center text-sm mb-6">Create your account</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            required
            autoComplete="email"
          />
          <input
            type="text"
            placeholder="Username (2–20 characters)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            required
            minLength={2}
            maxLength={20}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            required
            minLength={6}
            autoComplete="new-password"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold disabled:opacity-50 transition"
          >
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>
        <p className="mt-4 text-center text-slate-400 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-amber-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
