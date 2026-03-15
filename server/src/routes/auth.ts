import { Router } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const router = Router();
const SALT_ROUNDS = 10;
const STARTING_GOLD = 100;

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }
  const trimmed = username.trim();
  if (trimmed.length < 2 || trimmed.length > 20) {
    res.status(400).json({ error: 'Username must be 2–20 characters' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }
  const existing = await db.select().from(users).where(eq(users.username, trimmed)).get();
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  await db.insert(users).values({
    id,
    username: trimmed,
    passwordHash,
    gold: STARTING_GOLD,
    hasAutoRoll: false,
    hasQuickRoll: false,
    createdAt,
  }).run();
  const token = signToken({ userId: id, username: trimmed });
  res.json({ token, user: { id, username: trimmed, gold: STARTING_GOLD, hasAutoRoll: false, hasQuickRoll: false } });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }
  const user = await db.select().from(users).where(eq(users.username, String(username).trim())).get();
  if (!user) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }
  const token = signToken({ userId: user.id, username: user.username });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      gold: user.gold,
      hasAutoRoll: user.hasAutoRoll,
      hasQuickRoll: user.hasQuickRoll,
    },
  });
});

export default router;
