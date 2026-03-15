import type { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'fame-fortune-dev-secret-change-in-production';
const RATE_LIMIT_MS = 1000;
const MAX_MESSAGES_STORED = 100;

interface ChatMessage {
  username: string;
  text: string;
  timestamp: number;
}

const recentMessages: ChatMessage[] = [];

export function setupWebSocket(io: Server) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token ?? socket.handshake.query?.token;
    if (!token) {
      next(new Error('Auth required'));
      return;
    }
    try {
      const decoded = jwt.verify(token as string, JWT_SECRET) as { userId: string; username: string };
      const user = await db.select().from(users).where(eq(users.id, decoded.userId)).get();
      if (!user) {
        next(new Error('User not found'));
        return;
      }
      (socket as any).user = { userId: user.id, username: user.username };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { username } = (socket as any).user;
    socket.emit('chat:history', recentMessages);

    const lastMessageAt = new Map<string, number>();

    socket.on('chat:message', (text: string) => {
      const uid = (socket as any).user.userId;
      const now = Date.now();
      if (lastMessageAt.get(uid) && now - lastMessageAt.get(uid)! < RATE_LIMIT_MS) {
        socket.emit('chat:error', 'Please wait before sending another message.');
        return;
      }
      if (typeof text !== 'string' || (text = text.trim()).length === 0 || text.length > 500) {
        socket.emit('chat:error', 'Invalid message.');
        return;
      }
      lastMessageAt.set(uid, now);
      const msg: ChatMessage = { username, text, timestamp: now };
      recentMessages.push(msg);
      if (recentMessages.length > MAX_MESSAGES_STORED) recentMessages.shift();
      io.to('global').emit('chat:message', msg);
    });

    socket.join('global');
  });
}
