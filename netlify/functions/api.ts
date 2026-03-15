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
const USERNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 24;
const SPECIAL_SHOP_DURATION_MS = 30 * 60 * 1000; // 30 min
const SPECIAL_SHOP_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 h
const SPECIAL_SHOP_CHANCE = 0.1; // 10%

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

const RARITY_LUCK_RANK: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

/** Extra gold when sacrificing a duplicate roll (rarity-based) */
const SACRIFICE_GOLD_BY_RARITY: Record<string, number> = {
  common: 2,
  uncommon: 5,
  rare: 15,
  epic: 40,
  legendary: 120,
  mythic: 400,
};
function getSacrificeGold(rarity: string): number {
  return GOLD_PER_ROLL + (SACRIFICE_GOLD_BY_RARITY[rarity] ?? SACRIFICE_GOLD_BY_RARITY.common);
}

/** Sol's RNG–style: luck multiplier boosts rarer auras more. weight_i = (1/chance_i) * (luckMult ** rarity_rank) */
function performRoll(
  auras: { id: string; name: string; rarity: string; chance: number; visual_id: string; description: string }[],
  luckMultiplier = 1
) {
  if (auras.length === 0) return null;
  const weights = auras.map((a) => {
    const rank = RARITY_LUCK_RANK[a.rarity] ?? 0;
    const base = 1 / Math.max(a.chance, 1);
    return base * Math.pow(luckMultiplier, rank);
  });
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
    let { data: profile } = await supabaseAdmin.from('profiles').select('id, username, gold, has_auto_roll, has_quick_roll, username_changed_at, roll_speed_percent, roll_speed_ends_at, special_shop_ends_at, special_shop_last_roll_at, duplicate_aura_behavior').eq('id', user.id).single();
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
      profile = { id: user.id, username, gold: 100, has_auto_roll: false, has_quick_roll: false, username_changed_at: null, roll_speed_percent: 0, roll_speed_ends_at: null, special_shop_ends_at: null, special_shop_last_roll_at: null, duplicate_aura_behavior: 'keep' };
    }
    const now = Date.now();
    let rollSpeedPercent = (profile as { roll_speed_percent?: number }).roll_speed_percent ?? 0;
    let rollSpeedEndsAt = (profile as { roll_speed_ends_at?: string | null }).roll_speed_ends_at ?? null;
    if (rollSpeedEndsAt && new Date(rollSpeedEndsAt).getTime() < now) {
      rollSpeedPercent = 0;
      rollSpeedEndsAt = null;
      await supabaseAdmin.from('profiles').update({ roll_speed_percent: 0, roll_speed_ends_at: null }).eq('id', user.id);
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
    const { data: up } = await supabaseAdmin.from('user_potions').select('potion_id, quantity').eq('user_id', user.id);
    const { data: potionsCatalog } = await supabaseAdmin.from('potions').select('id, name, description, luck_percent, gold_cost, duration_minutes, roll_speed_percent');
    const potionsMap = new Map((potionsCatalog || []).map((p) => [p.id, p]));
    const potionInventory = (up || []).map((r) => {
      const p = potionsMap.get(r.potion_id) as { duration_minutes?: number | null; roll_speed_percent?: number | null } | undefined;
      return {
        potionId: r.potion_id,
        quantity: r.quantity,
        name: p?.name ?? '',
        luckPercent: p?.luck_percent ?? 0,
        goldCost: p?.gold_cost ?? 0,
        durationMinutes: p?.duration_minutes ?? null,
        rollSpeedPercent: p?.roll_speed_percent ?? null,
      };
    });
    const usernameChangedAt = (profile as { username_changed_at?: string | null }).username_changed_at ?? null;
    const duplicateAuraBehavior = (profile as { duplicate_aura_behavior?: string }).duplicate_aura_behavior ?? 'keep';
    return json({
      id: profile.id,
      username: profile.username,
      gold: profile.gold,
      hasAutoRoll: profile.has_auto_roll,
      hasQuickRoll: profile.has_quick_roll,
      usernameChangedAt,
      rollSpeedPercent,
      rollSpeedEndsAt,
      duplicateAuraBehavior: duplicateAuraBehavior === 'sacrifice' || duplicateAuraBehavior === 'auto' ? duplicateAuraBehavior : 'keep',
      auras,
      potionInventory,
    });
  }

  // PATCH /api/user/duplicate-aura-behavior – body: { duplicateAuraBehavior: 'keep' | 'sacrifice' | 'auto' }
  if (path === '/user/duplicate-aura-behavior' && method === 'PATCH') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    if (!user) return json({ error: 'Unauthorized' }, 401);
    let body: { duplicateAuraBehavior?: string } = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return err('Invalid JSON');
    }
    const val = body.duplicateAuraBehavior;
    if (val !== 'keep' && val !== 'sacrifice' && val !== 'auto') return err('duplicateAuraBehavior must be keep, sacrifice, or auto');
    const { error: upErr } = await supabaseAdmin.from('profiles').update({ duplicate_aura_behavior: val }).eq('id', user.id);
    if (upErr) return json({ error: 'Update failed' }, 500);
    return json({ success: true, duplicateAuraBehavior: val });
  }

  // POST /api/user/use-potion – consume a roll-speed potion to activate buff (body: { potionId })
  if (path === '/user/use-potion' && method === 'POST') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    if (!user) return json({ error: 'Unauthorized' }, 401);
    let body: { potionId?: string } = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return err('Invalid JSON');
    }
    const potionId = body.potionId;
    if (!potionId || typeof potionId !== 'string') return err('potionId required', 400);
    const { data: pot } = await supabaseAdmin.from('potions').select('id, duration_minutes, roll_speed_percent').eq('id', potionId).single();
    if (!pot) return err('Potion not found', 404);
    const durationMin = (pot as { duration_minutes?: number | null }).duration_minutes;
    const speedPercent = (pot as { roll_speed_percent?: number | null }).roll_speed_percent;
    if (durationMin == null || durationMin < 1 || speedPercent == null || speedPercent < 1) return err('This potion cannot be used as a buff', 400);
    const { data: up } = await supabaseAdmin.from('user_potions').select('quantity').eq('user_id', user.id).eq('potion_id', potionId).single();
    if (!up || up.quantity < 1) return err('No potion available', 400);
    const endsAt = new Date(Date.now() + durationMin * 60 * 1000).toISOString();
    await supabaseAdmin.from('user_potions').update({ quantity: up.quantity - 1 }).eq('user_id', user.id).eq('potion_id', potionId);
    await supabaseAdmin.from('profiles').update({ roll_speed_percent: speedPercent, roll_speed_ends_at: endsAt }).eq('id', user.id);
    return json({ success: true, rollSpeedPercent: speedPercent, rollSpeedEndsAt: endsAt });
  }

  // POST /api/user/change-username – body: { username: string }, once per week, unique
  if (path === '/user/change-username' && method === 'POST') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    if (!user) return json({ error: 'Unauthorized' }, 401);
    let body: { username?: string } = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return err('Invalid JSON');
    }
    const raw = typeof body.username === 'string' ? body.username.trim() : '';
    if (raw.length < USERNAME_MIN_LENGTH || raw.length > USERNAME_MAX_LENGTH) {
      return err(`Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters`);
    }
    const username = raw.slice(0, USERNAME_MAX_LENGTH);
    const { data: profile } = await supabaseAdmin.from('profiles').select('username, username_changed_at').eq('id', user.id).single();
    if (!profile) return json({ error: 'Profile not found' }, 404);
    const changedAt = (profile as { username_changed_at?: string | null }).username_changed_at;
    if (changedAt) {
      const elapsed = Date.now() - new Date(changedAt).getTime();
      if (elapsed < USERNAME_CHANGE_COOLDOWN_MS) {
        const daysLeft = Math.ceil((USERNAME_CHANGE_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
        return err(`You can change your username again in ${daysLeft} day(s)`);
      }
    }
    const { data: taken } = await supabaseAdmin.from('profiles').select('id').eq('username', username).neq('id', user.id).maybeSingle();
    if (taken) return err('Username is already taken');
    const { error: updateErr } = await supabaseAdmin.from('profiles').update({ username, username_changed_at: new Date().toISOString() }).eq('id', user.id);
    if (updateErr) return json({ error: updateErr.message }, 400);
    return json({ username, success: true });
  }

  // GET /api/potions – catalog for normal shop (excludes special-shop-only)
  if (path === '/potions' && method === 'GET') {
    const { data: list } = await supabaseAdmin.from('potions').select('id, name, description, luck_percent, gold_cost, duration_minutes, roll_speed_percent').or('is_special_shop_only.is.null,is_special_shop_only.eq.false').order('sort_order', { ascending: true });
    return json(list ?? []);
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

  // POST /api/roll – single roll (free; earn gold per roll). Body: { usePotionId?: string }
  if (path === '/roll' && method === 'POST') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    if (!user) return json({ error: 'Unauthorized' }, 401);
    let usePotionId: string | undefined;
    try {
      const body = event.body ? JSON.parse(event.body) as { usePotionId?: string } : {};
      usePotionId = body.usePotionId;
    } catch {
      // no body or invalid JSON – no potion
    }
    let luckMultiplier = 1;
    if (usePotionId) {
      const { data: up } = await supabaseAdmin.from('user_potions').select('quantity').eq('user_id', user.id).eq('potion_id', usePotionId).single();
      if (!up || up.quantity < 1) return err('No potion available', 400);
      const { data: pot } = await supabaseAdmin.from('potions').select('luck_percent').eq('id', usePotionId).single();
      if (!pot) return err('Invalid potion', 400);
      luckMultiplier = 1 + pot.luck_percent / 100;
      await supabaseAdmin.from('user_potions').update({ quantity: up.quantity - 1 }).eq('user_id', user.id).eq('potion_id', usePotionId);
    }
    const { data: auras } = await supabaseAdmin.from('auras').select('id, name, rarity, chance, visual_id, description');
    const aura = performRoll(auras || [], luckMultiplier);
    if (!aura) return json({ error: 'No auras configured' }, 500);
    const { data: u } = await supabaseAdmin.from('profiles').select('gold, username, duplicate_aura_behavior').eq('id', user.id).single();
    if (!u) return json({ error: 'Profile not found' }, 404);
    const behavior = (u as { duplicate_aura_behavior?: string }).duplicate_aura_behavior ?? 'keep';
    const { data: existingRows } = await supabaseAdmin.from('user_auras').select('id').eq('user_id', user.id).eq('aura_id', aura.id).limit(1);
    const isDuplicate = existingRows && existingRows.length > 0;
    const doKeep = !isDuplicate || behavior === 'keep' || (behavior === 'auto' && Math.random() < 0.5);
    const obtainedAt = new Date().toISOString();
    let goldEarned = GOLD_PER_ROLL;
    if (isDuplicate && !doKeep) {
      goldEarned = getSacrificeGold(aura.rarity);
    }
    const newGold = u.gold + goldEarned;
    await supabaseAdmin.from('profiles').update({ gold: newGold }).eq('id', user.id);
    if (doKeep) {
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
    return json({ aura, newBalance: newGold, goldEarned, firstTime: !isDuplicate, sacrificed: isDuplicate && !doKeep });
  }

  // POST /api/roll/batch (free; earn gold per roll). Body: { count?: number, usePotionId?: string } – one potion applies to all rolls
  if (path === '/roll/batch' && method === 'POST') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    if (!user) return json({ error: 'Unauthorized' }, 401);
    let body: { count?: number; usePotionId?: string } = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return err('Invalid JSON');
    }
    const count = Math.min(Number(body.count) || 10, 10);
    if (count < 1) return err('Count must be 1–10');
    let luckMultiplier = 1;
    if (body.usePotionId) {
      const { data: up } = await supabaseAdmin.from('user_potions').select('quantity').eq('user_id', user.id).eq('potion_id', body.usePotionId).single();
      if (!up || up.quantity < 1) return err('No potion available', 400);
      const { data: pot } = await supabaseAdmin.from('potions').select('luck_percent').eq('id', body.usePotionId).single();
      if (!pot) return err('Invalid potion', 400);
      luckMultiplier = 1 + pot.luck_percent / 100;
      await supabaseAdmin.from('user_potions').update({ quantity: up.quantity - 1 }).eq('user_id', user.id).eq('potion_id', body.usePotionId);
    }
    const { data: auras } = await supabaseAdmin.from('auras').select('id, name, rarity, chance, visual_id, description');
    const { data: u } = await supabaseAdmin.from('profiles').select('gold, username, duplicate_aura_behavior').eq('id', user.id).single();
    if (!u) return json({ error: 'Profile not found' }, 404);
    const behavior = (u as { duplicate_aura_behavior?: string }).duplicate_aura_behavior ?? 'keep';
    const results: { id: string; name: string; rarity: string; chance: number; visualId: string; description: string }[] = [];
    let newGold = u.gold;
    let totalGoldEarned = 0;
    for (let i = 0; i < count; i++) {
      const aura = performRoll(auras || [], luckMultiplier);
      if (aura) {
        results.push(aura);
        const { data: ex } = await supabaseAdmin.from('user_auras').select('id').eq('user_id', user.id).eq('aura_id', aura.id).limit(1);
        const isDup = ex && ex.length > 0;
        const doKeep = !isDup || behavior === 'keep' || (behavior === 'auto' && Math.random() < 0.5);
        const goldThisRoll = doKeep ? GOLD_PER_ROLL : getSacrificeGold(aura.rarity);
        newGold += goldThisRoll;
        totalGoldEarned += goldThisRoll;
        if (doKeep) {
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
    return json({ results, newBalance: newGold, goldEarned: totalGoldEarned });
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

  // POST /api/shop/buy-potion – body: { potionId: string }
  if (path === '/shop/buy-potion' && method === 'POST') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    if (!user) return json({ error: 'Unauthorized' }, 401);
    let body: { potionId?: string } = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return err('Invalid JSON');
    }
    const potionId = body.potionId;
    if (!potionId || typeof potionId !== 'string') return err('potionId required', 400);
    const { data: pot } = await supabaseAdmin.from('potions').select('id, gold_cost, is_special_shop_only').eq('id', potionId).single();
    if (!pot) return err('Potion not found', 404);
    if ((pot as { is_special_shop_only?: boolean }).is_special_shop_only) return err('This potion is only available in the Special Shop', 400);
    const { data: u } = await supabaseAdmin.from('profiles').select('gold').eq('id', user.id).single();
    if (!u) return json({ error: 'Profile not found' }, 404);
    if (u.gold < pot.gold_cost) return err('Not enough Gold', 400);
    const newGold = u.gold - pot.gold_cost;
    await supabaseAdmin.from('profiles').update({ gold: newGold }).eq('id', user.id);
    const { data: existing } = await supabaseAdmin.from('user_potions').select('quantity').eq('user_id', user.id).eq('potion_id', potionId).maybeSingle();
    if (existing) {
      await supabaseAdmin.from('user_potions').update({ quantity: existing.quantity + 1 }).eq('user_id', user.id).eq('potion_id', potionId);
    } else {
      await supabaseAdmin.from('user_potions').insert({ user_id: user.id, potion_id: potionId, quantity: 1 });
    }
    return json({ success: true, newBalance: newGold, potionId });
  }

  // GET /api/shop/special-status – is the rare special shop open for this user? (auth required)
  if (path === '/shop/special-status' && method === 'GET') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { data: profile } = await supabaseAdmin.from('profiles').select('special_shop_ends_at, special_shop_last_roll_at').eq('id', user.id).single();
    if (!profile) return json({ open: false });
    const now = Date.now();
    const endsAt = (profile as { special_shop_ends_at?: string | null }).special_shop_ends_at;
    const lastRoll = (profile as { special_shop_last_roll_at?: string | null }).special_shop_last_roll_at;
    if (endsAt && new Date(endsAt).getTime() > now) return json({ open: true, endsAt });
    if (endsAt) await supabaseAdmin.from('profiles').update({ special_shop_ends_at: null }).eq('id', user.id);
    const lastRollTime = lastRoll ? new Date(lastRoll).getTime() : 0;
    if (now - lastRollTime < SPECIAL_SHOP_COOLDOWN_MS) return json({ open: false });
    const roll = Math.random();
    const open = roll < SPECIAL_SHOP_CHANCE;
    const newEndsAt = open ? new Date(now + SPECIAL_SHOP_DURATION_MS).toISOString() : null;
    await supabaseAdmin.from('profiles').update({ special_shop_last_roll_at: new Date(now).toISOString(), special_shop_ends_at: newEndsAt }).eq('id', user.id);
    return json(open ? { open: true, endsAt: newEndsAt } : { open: false });
  }

  // GET /api/shop/special-items – list special-shop potions (only when shop is open for user)
  if (path === '/shop/special-items' && method === 'GET') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { data: profile } = await supabaseAdmin.from('profiles').select('special_shop_ends_at').eq('id', user.id).single();
    const endsAt = profile && (profile as { special_shop_ends_at?: string | null }).special_shop_ends_at;
    if (!endsAt || new Date(endsAt).getTime() <= Date.now()) return json([]);
    const { data: list } = await supabaseAdmin.from('potions').select('id, name, description, luck_percent, gold_cost, duration_minutes, roll_speed_percent, special_shop_price').eq('is_special_shop_only', true).order('sort_order', { ascending: true });
    return json(list ?? []);
  }

  // POST /api/shop/buy-special-potion – body: { potionId } (only when special shop is open)
  if (path === '/shop/buy-special-potion' && method === 'POST') {
    const authErr = requireAuth();
    if (authErr) return authErr.response;
    if (!user) return json({ error: 'Unauthorized' }, 401);
    let body: { potionId?: string } = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return err('Invalid JSON');
    }
    const potionId = body.potionId;
    if (!potionId || typeof potionId !== 'string') return err('potionId required', 400);
    const { data: profile } = await supabaseAdmin.from('profiles').select('gold, special_shop_ends_at').eq('id', user.id).single();
    if (!profile) return json({ error: 'Profile not found' }, 404);
    const endsAt = (profile as { special_shop_ends_at?: string | null }).special_shop_ends_at;
    if (!endsAt || new Date(endsAt).getTime() <= Date.now()) return err('Special shop is not open', 400);
    const { data: pot } = await supabaseAdmin.from('potions').select('id, is_special_shop_only, special_shop_price').eq('id', potionId).single();
    if (!pot || !(pot as { is_special_shop_only?: boolean }).is_special_shop_only) return err('Not a special shop item', 404);
    const price = (pot as { special_shop_price?: number | null }).special_shop_price;
    if (price == null || price < 0) return err('Item not for sale', 400);
    if (profile.gold < price) return err('Not enough Gold', 400);
    const newGold = profile.gold - price;
    await supabaseAdmin.from('profiles').update({ gold: newGold }).eq('id', user.id);
    const { data: existing } = await supabaseAdmin.from('user_potions').select('quantity').eq('user_id', user.id).eq('potion_id', potionId).maybeSingle();
    if (existing) {
      await supabaseAdmin.from('user_potions').update({ quantity: existing.quantity + 1 }).eq('user_id', user.id).eq('potion_id', potionId);
    } else {
      await supabaseAdmin.from('user_potions').insert({ user_id: user.id, potion_id: potionId, quantity: 1 });
    }
    return json({ success: true, newBalance: newGold, potionId });
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
