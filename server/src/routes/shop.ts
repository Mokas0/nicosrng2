import { Router, type Request } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();
router.use(authMiddleware);

const AUTO_ROLL_PRICE = 5000;
const QUICK_ROLL_PRICE = 2500;

router.post('/buy-auto-roll', async (req, res) => {
  const { user } = req as Request & { user: { userId: string } };
  const u = await db.select().from(users).where(eq(users.id, user.userId)).get();
  if (!u) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (u.hasAutoRoll) {
    res.status(400).json({ error: 'Already owned' });
    return;
  }
  if (u.gold < AUTO_ROLL_PRICE) {
    res.status(400).json({ error: 'Not enough Gold', required: AUTO_ROLL_PRICE, gold: u.gold });
    return;
  }
  await db.update(users).set({ gold: u.gold - AUTO_ROLL_PRICE, hasAutoRoll: true }).where(eq(users.id, user.userId)).run();
  res.json({ success: true, newBalance: u.gold - AUTO_ROLL_PRICE, hasAutoRoll: true });
});

router.post('/buy-quick-roll', async (req, res) => {
  const { user } = req as Request & { user: { userId: string } };
  const u = await db.select().from(users).where(eq(users.id, user.userId)).get();
  if (!u) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (u.hasQuickRoll) {
    res.status(400).json({ error: 'Already owned' });
    return;
  }
  if (u.gold < QUICK_ROLL_PRICE) {
    res.status(400).json({ error: 'Not enough Gold', required: QUICK_ROLL_PRICE, gold: u.gold });
    return;
  }
  await db.update(users).set({ gold: u.gold - QUICK_ROLL_PRICE, hasQuickRoll: true }).where(eq(users.id, user.userId)).run();
  res.json({ success: true, newBalance: u.gold - QUICK_ROLL_PRICE, hasQuickRoll: true });
});

export default router;
