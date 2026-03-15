import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import rollRoutes from './routes/roll.js';
import shopRoutes from './routes/shop.js';
import { setupWebSocket } from './ws/chat.js';
import { initDb } from './db/index.js';
import { bootstrap } from './db/bootstrap.js';

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/roll', rollRoutes);
app.use('/api/shop', shopRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const io = new Server(httpServer, {
  cors: { origin: true },
  path: '/socket.io',
});
setupWebSocket(io);

const PORT = process.env.PORT || 3001;

async function start() {
  await initDb();
  bootstrap();
  httpServer.listen(PORT, () => {
    console.log(`Fame and Fortune server running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
