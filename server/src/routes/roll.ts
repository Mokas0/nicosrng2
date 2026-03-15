import { Router, type Request } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users, userAuras } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { performRoll, type RollResult } from '../services/rollEngine.js';

const router = Router();
router.use(authMiddleware);

const ROLL_COST = 10;
const GOLD_PER_ROLL = 3;

router.post('/', async (req, res) => {
  const { user } = req as Request & { user: { userId: string } };
  const u = await db.select().from(users).where(eq(users.id, user.userId)).get();
  if (!u) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (u.gold < ROLL_COST) {
    res.status(400).json({ error: 'Not enough Gold', required: ROLL_COST, gold: u.gold });
    return;
  }
  const aura = performRoll();
  if (!aura) {
    res.status(500).json({ error: 'No auras configured' });
    return;
  }
  const newGold = u.gold - ROLL_COST + GOLD_PER_ROLL;
  await db.update(users).set({ gold: newGold }).where(eq(users.id, user.userId)).run();
  const existing = await db.select().from(userAuras).where(and(eq(userAuras.userId, user.userId), eq(userAuras.auraId, aura.id))).get();
  const obtainedAt = new Date().toISOString();
  if (!existing) {
    await db.insert(userAuras).values({ userId: user.userId, auraId: aura.id, obtainedAt }).run();
  }
  res.json({
    aura,
    newBalance: newGold,
    goldEarned: GOLD_PER_ROLL,
    firstTime: !existing,
  });
});

router.post('/batch', async (req, res) => {
  const { user } = req as Request & { user: { userId: string } };
  const count = Math.min(Number(req.body?.count) || 10, 10);
  if (count < 1) {
    res.status(400).json({ error: 'Count must be 1–10' });
    return;
  }
  const u = await db.select().from(users).where(eq(users.id, user.userId)).get();
  if (!u) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const totalCost = ROLL_COST * count;
  if (u.gold < totalCost) {
    res.status(400).json({ error: 'Not enough Gold', required: totalCost, gold: u.gold });
    return;
  }
  const results: RollResult[] = [];
  let newGold = u.gold - totalCost;
  for (let i = 0; i < count; i++) {
    const aura = performRoll();
    if (aura) {
      results.push(aura);
      newGold += GOLD_PER_ROLL;
      const existing = await db.select().from(userAuras).where(and(eq(userAuras.userId, user.userId), eq(userAuras.auraId, aura.id))).get();
      if (!existing) {
        await db.insert(userAuras).values({ userId: user.userId, auraId: aura.id, obtainedAt: new Date().toISOString() }).run();
      }
    }
  }
  await db.update(users).set({ gold: newGold }).where(eq(users.id, user.userId)).run();
  res.json({ results, newBalance: newGold, goldEarned: GOLD_PER_ROLL * results.length });
});

export default router;
