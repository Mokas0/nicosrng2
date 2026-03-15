# Fame and Fortune

A browser-based RNG game inspired by Sol's RNG. Roll for auras, earn Gold, and chat with other players.

## Features

- **~150 Auras** across 6 rarity tiers (Common → Mythic)
- **Gold** as main currency: earn from each roll and passive income while online
- **Auto Roll** and **Quick Roll (10x)** — purchasable with Gold
- **GSAP-powered** roll reveal cutscenes (rarity-based)
- **Accounts**: register/login with username and password
- **Global chat** over WebSocket (real-time)

## Setup

### Prerequisites

- Node.js 18+
- npm or pnpm

### Backend

```bash
cd server
npm install
npm run dev
```

Runs on `http://localhost:3001`. Database (SQLite) and tables are created on first run; auras are seeded automatically if the table is empty.

### Frontend

```bash
cd client
npm install
npm run dev
```

Runs on `http://localhost:5173` with API and WebSocket proxied to the server.

### Production

1. Build client: `cd client && npm run build`
2. Serve `client/dist` with your static host
3. Run server with `NODE_ENV=production` and set `JWT_SECRET`
4. Point the client to your server URL (env or build-time)

## Tech Stack

- **Client**: React 18, Vite, TypeScript, Tailwind, GSAP, Socket.io-client
- **Server**: Node.js, Express, Socket.io, Drizzle ORM, SQLite (better-sqlite3), JWT, bcrypt

## Game Balance (defaults)

- Roll cost: 10 Gold  
- Gold per roll: 3  
- Passive gold: 5 every 30 seconds  
- Auto Roll: 5,000 Gold (one-time)  
- Quick Roll (10x): 2,500 Gold (one-time)
