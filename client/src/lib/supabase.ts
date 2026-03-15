import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured =
  Boolean(url && anonKey && url !== 'https://placeholder.supabase.co' && anonKey !== 'placeholder');

if (!isSupabaseConfigured) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set in .env (local) or Netlify env (deploy).');
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder');
