import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient, type User } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ROLL_COST = 10;
const GOLD_PER_ROLL = 3;
const AUTO_ROLL_PRICE = 5000;
const QUICK_ROLL_PRICE = 2500;
const PASSIVE_GOLD_INTERVAL_MS = 30_000;
const PASSIVE_GOLD_AMOUNT = 5;

function json(body: unknown, status = 200) {
  return { statusCode: status, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } };
}

function err(message: string, status = 400) {
  return json({ error: message }, status);
}

async function getUserFromToken(token: string | null): Promise<User | null> {
  if (!token?.startsWith('Bearer ')) return null;
  const accessToken = token.slice(7);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data: { user } } = await supabase.auth.getUser(accessToken);
  return user;
}

function performRoll(auras: { id: string; name: string; rarity: string; chance: number; visual_id: string; description: string }[]) {
  if (auras.length === 0) return null;
  const weights = auras.map((a) => 1 / a.chance);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < auras.length; i++) {
    r -= weights[i]!;
    if (r <= 0) {
      const a = auras[i]!;
      return { id: a.id, name: a.name, rarity: a.rarity, chance: a.chance, visualId: a.visual_id, description: a.description };
    }
  }
  const a = auras[auras.length - 1]!;
  return { id: a.id, name: a.name, rarity: a.rarity, chance: a.chance, visualId: a.visual_id, description: a.description };
}

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  const rawPath = (event.headers['x-netlify-original-pathname'] as string) || event.path || '';
  const path = rawPath.replace(/^\/api/, '') || '/';
  const method = event.httpMethod;
  const token = event.headers.authorization || event.headers.Authorization;
  const user = await getUserFromToken(typeof token === 'string' ? token : token?.[0]);
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  const requireAuth = () => {
    if (!user) return { response: err('Unauthorized', 401) };
    return null;
  };

  // POST /api/auth/register – handled by Supabase Auth on client
  // POST /api/auth/login – handled by Supabase Auth on client

  // GET /api/user/me – get profile (client can also use Supabase directly; this is for compatibility)
  if (path === '/user/me' && method === 'GET') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    const { data: profile } = await supabaseAdmin.from('profiles').select('id, username, gold, has_auto_roll, has_quick_roll').eq('id', user.id).single();
    if (!profile) return json({ error: 'Profile not found' }, 404);
    const { data: inv } = await supabaseAdmin.from('user_auras').select('aura_id, obtained_at').eq('user_id', user.id);
    return json({
      id: profile.id,
      username: profile.username,
      gold: profile.gold,
      hasAutoRoll: profile.has_auto_roll,
      hasQuickRoll: profile.has_quick_roll,
      auras: (inv || []).map((r) => ({ auraId: r.aura_id, obtainedAt: r.obtained_at })),
    });
  }

  // POST /api/user/passive-gold
  if (path === '/user/passive-gold' && method === 'POST') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    const { data: u } = await supabaseAdmin.from('profiles').select('gold, last_passive_gold_at').eq('id', user.id).single();
    if (!u) return json({ error: 'Profile not found' }, 404);
    const now = Date.now();
    const last = u.last_passive_gold_at ? new Date(u.last_passive_gold_at).getTime() : 0;
    if (now - last < PASSIVE_GOLD_INTERVAL_MS) {
      return json({ gold: u.gold, granted: 0 });
    }
    const newGold = u.gold + PASSIVE_GOLD_AMOUNT;
    await supabaseAdmin.from('profiles').update({ gold: newGold, last_passive_gold_at: new Date(now).toISOString() }).eq('id', user.id);
    return json({ gold: newGold, granted: PASSIVE_GOLD_AMOUNT });
  }

  // POST /api/roll – single roll
  if (path === '/roll' && method === 'POST') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    const { data: auras } = await supabaseAdmin.from('auras').select('id, name, rarity, chance, visual_id, description');
    const aura = performRoll(auras || []);
    if (!aura) return json({ error: 'No auras configured' }, 500);
    const { data: u } = await supabaseAdmin.from('profiles').select('gold').eq('id', user.id).single();
    if (!u || u.gold < ROLL_COST) return err('Not enough Gold', 400);
    const newGold = u.gold - ROLL_COST + GOLD_PER_ROLL;
    await supabaseAdmin.from('profiles').update({ gold: newGold }).eq('id', user.id);
    const { data: existing } = await supabaseAdmin.from('user_auras').select('user_id').eq('user_id', user.id).eq('aura_id', aura.id).maybeSingle();
    const obtainedAt = new Date().toISOString();
    if (!existing) {
      await supabaseAdmin.from('user_auras').insert({ user_id: user.id, aura_id: aura.id, obtained_at: obtainedAt });
    }
    return json({ aura, newBalance: newGold, goldEarned: GOLD_PER_ROLL, firstTime: !existing });
  }

  // POST /api/roll/batch
  if (path === '/roll/batch' && method === 'POST') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    let body: { count?: number } = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return err('Invalid JSON');
    }
    const count = Math.min(Number(body.count) || 10, 10);
    if (count < 1) return err('Count must be 1–10');
    const { data: auras } = await supabaseAdmin.from('auras').select('id, name, rarity, chance, visual_id, description');
    const { data: u } = await supabaseAdmin.from('profiles').select('gold').eq('id', user.id).single();
    if (!u) return json({ error: 'Profile not found' }, 404);
    const totalCost = ROLL_COST * count;
    if (u.gold < totalCost) return err('Not enough Gold', 400);
    const results: { id: string; name: string; rarity: string; chance: number; visualId: string; description: string }[] = [];
    let newGold = u.gold - totalCost;
    for (let i = 0; i < count; i++) {
      const aura = performRoll(auras || []);
      if (aura) {
        results.push(aura);
        newGold += GOLD_PER_ROLL;
        const { data: ex } = await supabaseAdmin.from('user_auras').select('user_id').eq('user_id', user.id).eq('aura_id', aura.id).maybeSingle();
        if (!ex) {
          await supabaseAdmin.from('user_auras').insert({ user_id: user.id, aura_id: aura.id, obtained_at: new Date().toISOString() });
        }
      }
    }
    await supabaseAdmin.from('profiles').update({ gold: newGold }).eq('id', user.id);
    return json({ results, newBalance: newGold, goldEarned: GOLD_PER_ROLL * results.length });
  }

  // POST /api/shop/buy-auto-roll
  if (path === '/shop/buy-auto-roll' && method === 'POST') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    const { data: u } = await supabaseAdmin.from('profiles').select('gold, has_auto_roll').eq('id', user.id).single();
    if (!u) return json({ error: 'Profile not found' }, 404);
    if (u.has_auto_roll) return err('Already owned');
    if (u.gold < AUTO_ROLL_PRICE) return err('Not enough Gold', 400);
    await supabaseAdmin.from('profiles').update({ gold: u.gold - AUTO_ROLL_PRICE, has_auto_roll: true }).eq('id', user.id);
    return json({ success: true, newBalance: u.gold - AUTO_ROLL_PRICE, hasAutoRoll: true });
  }

  // POST /api/shop/buy-quick-roll
  if (path === '/shop/buy-quick-roll' && method === 'POST') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    const { data: u } = await supabaseAdmin.from('profiles').select('gold, has_quick_roll').eq('id', user.id).single();
    if (!u) return json({ error: 'Profile not found' }, 404);
    if (u.has_quick_roll) return err('Already owned');
    if (u.gold < QUICK_ROLL_PRICE) return err('Not enough Gold', 400);
    await supabaseAdmin.from('profiles').update({ gold: u.gold - QUICK_ROLL_PRICE, has_quick_roll: true }).eq('id', user.id);
    return json({ success: true, newBalance: u.gold - QUICK_ROLL_PRICE, hasQuickRoll: true });
  }

  // GET /api/health
  if (path === '/health' && method === 'GET') {
    return json({ ok: true });
  }

  return json({ error: 'Not found' }, 404);
};
