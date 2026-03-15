import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY – using placeholder. Set in Netlify env for production.');
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder');

/** Map username to internal email for Supabase Auth (email-only). */
export const usernameToEmail = (username: string) => `${username.trim().toLowerCase()}@famefortune.game`;
export const emailToUsername = (email: string) => email.replace(/@famefortune\.game$/i, '');
