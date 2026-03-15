import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { supabase, usernameToEmail } from '../lib/supabase';

export default function Register() {
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
      const trimmed = username.trim();
      if (trimmed.length < 2 || trimmed.length > 20) {
        setError('Username must be 2–20 characters');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      const { data, error: err } = await supabase.auth.signUp({
        email: usernameToEmail(trimmed),
        password,
        options: { data: { username: trimmed } },
      });
      if (err) throw err;
      if (!data.user) {
        setError('Registration failed');
        return;
      }
      const { error: profileErr } = await supabase.from('profiles').insert({
        id: data.user.id,
        username: trimmed,
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
        login(data.session.access_token);
        navigate('/');
      } else {
        setError('Check your inbox to confirm your account, then sign in.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
            type="text"
            placeholder="Username (2–20 characters)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            required
            minLength={2}
            maxLength={20}
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            required
            minLength={6}
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
