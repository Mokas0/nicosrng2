import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient, type User } from '@supabase/supabase-js';

function getEnv() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, anon, serviceRole };
}

const GOLD_PER_ROLL = 5;
const ANNOUNCE_RARITIES = ['epic', 'legendary', 'mythic'];
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

async function getUserFromToken(token: string | null, url: string, anon: string): Promise<User | null> {
  if (!token?.startsWith('Bearer ') || !url || !anon) return null;
  try {
    const accessToken = token.slice(7);
    const supabase = createClient(url, anon);
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    return user;
  } catch {
    return null;
  }
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
  try {
    const { url: SUPABASE_URL, anon: SUPABASE_ANON, serviceRole: SUPABASE_SERVICE_ROLE } = getEnv();

    if (!SUPABASE_URL || !SUPABASE_ANON || !SUPABASE_SERVICE_ROLE) {
      return json(
        { error: 'Server misconfigured: missing Supabase env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).' },
        503
      );
    }

    const rawPath = (event.headers['x-netlify-original-pathname'] as string) || event.path || '';
    const path = rawPath.replace(/^\/api/, '').replace(/^\.netlify\/functions\/api/, '') || '/';
    const method = event.httpMethod;
    const tokenRaw = event.headers.authorization || event.headers.Authorization;
    const token = tokenRaw == null ? null : typeof tokenRaw === 'string' ? tokenRaw : tokenRaw[0] ?? null;
    const user = await getUserFromToken(token, SUPABASE_URL, SUPABASE_ANON);
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const requireAuth = () => {
      if (!user) return { response: err('Unauthorized', 401) };
      return null;
    };

  // POST /api/auth/register – handled by Supabase Auth on client
  // POST /api/auth/login – handled by Supabase Auth on client

  // GET /api/user/me – get profile; create one if missing (e.g. email confirmation signup)
  if (path === '/user/me' && method === 'GET') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    if (!user) return json({ error: 'Unauthorized' }, 401);
    let { data: profile } = await supabaseAdmin.from('profiles').select('id, username, gold, has_auto_roll, has_quick_roll').eq('id', user.id).single();
    if (!profile) {
      const base = (user.user_metadata?.username as string) || user.email?.split('@')[0] || 'player';
      const username = base.slice(0, 18) + (user.id.slice(0, 2)); // ensure unique
      const { error: insertErr } = await supabaseAdmin.from('profiles').insert({
        id: user.id,
        username,
        gold: 100,
        has_auto_roll: false,
        has_quick_roll: false,
        created_at: new Date().toISOString(),
      });
      if (insertErr) return json({ error: 'Profile not found' }, 404);
      profile = { id: user.id, username, gold: 100, has_auto_roll: false, has_quick_roll: false };
    }
    const { data: inv } = await supabaseAdmin.from('user_auras').select('aura_id, obtained_at').eq('user_id', user.id);
    const { data: aurasCatalog } = await supabaseAdmin.from('auras').select('id, name, rarity, chance, visual_id, description');
    const aurasMap = new Map((aurasCatalog || []).map((a) => [a.id, a]));
    const auras = (inv || []).map((r) => {
      const aura = aurasMap.get(r.aura_id);
      return {
        auraId: r.aura_id,
        obtainedAt: r.obtained_at,
        name: aura?.name ?? 'Unknown',
        rarity: aura?.rarity ?? 'common',
        chance: aura?.chance ?? 0,
        visualId: aura?.visual_id ?? '',
        description: aura?.description ?? '',
      };
    });
    return json({
      id: profile.id,
      username: profile.username,
      gold: profile.gold,
      hasAutoRoll: profile.has_auto_roll,
      hasQuickRoll: profile.has_quick_roll,
      auras,
    });
  }

  // POST /api/user/passive-gold
  if (path === '/user/passive-gold' && method === 'POST') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    if (!user) return json({ error: 'Unauthorized' }, 401);
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

  // POST /api/roll – single roll (free; earn gold per roll)
  if (path === '/roll' && method === 'POST') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { data: auras } = await supabaseAdmin.from('auras').select('id, name, rarity, chance, visual_id, description');
    const aura = performRoll(auras || []);
    if (!aura) return json({ error: 'No auras configured' }, 500);
    const { data: u } = await supabaseAdmin.from('profiles').select('gold, username').eq('id', user.id).single();
    if (!u) return json({ error: 'Profile not found' }, 404);
    const newGold = u.gold + GOLD_PER_ROLL;
    await supabaseAdmin.from('profiles').update({ gold: newGold }).eq('id', user.id);
    const { data: existing } = await supabaseAdmin.from('user_auras').select('user_id').eq('user_id', user.id).eq('aura_id', aura.id).maybeSingle();
    const obtainedAt = new Date().toISOString();
    if (!existing) {
      await supabaseAdmin.from('user_auras').insert({ user_id: user.id, aura_id: aura.id, obtained_at: obtainedAt });
    }
    if (ANNOUNCE_RARITIES.includes(aura.rarity)) {
      const { error: announceErr } = await supabaseAdmin.from('chat_messages').insert({
        username: '★',
        text: `${u.username || 'Someone'} rolled [${aura.rarity}] ${aura.name}!`,
        is_announcement: true,
      });
      if (announceErr) {
        // Ignore if announcement insert fails (e.g. is_announcement column not migrated yet)
      }
    }
    return json({ aura, newBalance: newGold, goldEarned: GOLD_PER_ROLL, firstTime: !existing });
  }

  // POST /api/roll/batch (free; earn gold per roll)
  if (path === '/roll/batch' && method === 'POST') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    if (!user) return json({ error: 'Unauthorized' }, 401);
    let body: { count?: number } = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return err('Invalid JSON');
    }
    const count = Math.min(Number(body.count) || 10, 10);
    if (count < 1) return err('Count must be 1–10');
    const { data: auras } = await supabaseAdmin.from('auras').select('id, name, rarity, chance, visual_id, description');
    const { data: u } = await supabaseAdmin.from('profiles').select('gold, username').eq('id', user.id).single();
    if (!u) return json({ error: 'Profile not found' }, 404);
    const results: { id: string; name: string; rarity: string; chance: number; visualId: string; description: string }[] = [];
    let newGold = u.gold;
    for (let i = 0; i < count; i++) {
      const aura = performRoll(auras || []);
      if (aura) {
        results.push(aura);
        newGold += GOLD_PER_ROLL;
        const { data: ex } = await supabaseAdmin.from('user_auras').select('user_id').eq('user_id', user.id).eq('aura_id', aura.id).maybeSingle();
        if (!ex) {
          await supabaseAdmin.from('user_auras').insert({ user_id: user.id, aura_id: aura.id, obtained_at: new Date().toISOString() });
        }
        if (ANNOUNCE_RARITIES.includes(aura.rarity)) {
          await supabaseAdmin.from('chat_messages').insert({
            username: '★',
            text: `${u.username || 'Someone'} rolled [${aura.rarity}] ${aura.name}!`,
            is_announcement: true,
          });
          // Ignore insert error (e.g. is_announcement column not migrated yet)
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
    if (!user) return json({ error: 'Unauthorized' }, 401);
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
    if (!user) return json({ error: 'Unauthorized' }, 401);
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
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return json({ error: message }, 500);
  }
};
