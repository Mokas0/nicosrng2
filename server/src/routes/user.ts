import { Router, type Request } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users, userAuras } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();
router.use(authMiddleware);

router.get('/me', async (req, res) => {
  const { user } = req as Request & { user: { userId: string } };
  const u = await db.select().from(users).where(eq(users.id, user.userId)).get();
  if (!u) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const inventory = await db.select().from(userAuras).where(eq(userAuras.userId, u.id)).all();
  res.json({
    id: u.id,
    username: u.username,
    gold: u.gold,
    hasAutoRoll: u.hasAutoRoll,
    hasQuickRoll: u.hasQuickRoll,
    auras: inventory.map((a) => ({ auraId: a.auraId, obtainedAt: a.obtainedAt })),
  });
});

const PASSIVE_GOLD_INTERVAL_MS = 30_000;
const PASSIVE_GOLD_AMOUNT = 5;

router.post('/passive-gold', async (req, res) => {
  const { user } = req as Request & { user: { userId: string } };
  const u = await db.select().from(users).where(eq(users.id, user.userId)).get();
  if (!u) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const now = Date.now();
  const last = u.lastPassiveGoldAt ? new Date(u.lastPassiveGoldAt).getTime() : 0;
  if (now - last < PASSIVE_GOLD_INTERVAL_MS) {
    res.json({ gold: u.gold, granted: 0 });
    return;
  }
  const newGold = u.gold + PASSIVE_GOLD_AMOUNT;
  await db.update(users).set({ gold: newGold, lastPassiveGoldAt: new Date(now).toISOString() }).where(eq(users.id, user.userId)).run();
  res.json({ gold: newGold, granted: PASSIVE_GOLD_AMOUNT });
});

export default router;
