import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const SIGNIN_TIMEOUT_MS = 20000;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Sign-in failed. Try again.';
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isSupabaseConfigured) {
        setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.');
        return;
      }
      setError('');
      setLoading(true);

      const timeoutId = setTimeout(() => {
        setError('Sign-in is taking too long. Check your connection and try again.');
        setLoading(false);
      }, SIGNIN_TIMEOUT_MS);

      try {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (err) {
          clearTimeout(timeoutId);
          setError(err.message || 'Invalid email or password.');
          return;
        }
        if (!data.session?.access_token) {
          clearTimeout(timeoutId);
          setError('Login failed. No session returned.');
          return;
        }

        const me = await login(data.session.access_token);
        clearTimeout(timeoutId);
        if (me) {
          navigate('/', { replace: true });
        } else {
          setError('Could not load your profile. Try again.');
        }
      } catch (err) {
        clearTimeout(timeoutId);
        const msg = getErrorMessage(err);
        // #region agent log
        fetch('http://127.0.0.1:7354/ingest/ab722707-ed6a-4616-87e2-df03126dbe77',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'246d6e'},body:JSON.stringify({sessionId:'246d6e',location:'client/src/pages/Login.tsx',message:'Login catch',data:{msg,raw:err instanceof Error ? err.message : String(err)},timestamp:Date.now(),hypothesisId:'H1-H5'})}).catch(()=>{});
        // #endregion
        if (msg === 'Profile not found' || msg.includes('profile')) {
          setError('Account not set up. Please register first.');
        } else if (
          msg.includes('fetch') ||
          msg.includes('network') ||
          msg.includes('Failed') ||
          msg.includes('Load')
        ) {
          setError("Can't reach server. If testing locally, run: npx netlify dev");
        } else {
          setError(msg);
        }
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    },
    [email, password, login, navigate]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-sm rounded-xl bg-slate-800/80 border border-slate-600 shadow-2xl p-8">
        <h1 className="font-display text-3xl font-bold text-amber-400 text-center mb-2">Fame and Fortune</h1>
        <p className="text-slate-400 text-center text-sm mb-6">Sign in to continue</p>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            required
            autoComplete="email"
            disabled={loading}
            aria-label="Email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            required
            autoComplete="current-password"
            disabled={loading}
            aria-label="Password"
          />
          {error && (
            <p className="text-red-400 text-sm" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:pointer-events-none text-slate-900 font-semibold transition"
            aria-busy={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-slate-400 text-sm">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-amber-400 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
