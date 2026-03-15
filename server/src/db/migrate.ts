import initSqlJs from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');
const dbPath = path.join(dataDir, 'fame.db');

export const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    gold INTEGER NOT NULL DEFAULT 100,
    has_auto_roll INTEGER NOT NULL DEFAULT 0,
    has_quick_roll INTEGER NOT NULL DEFAULT 0,
    last_passive_gold_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auras (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rarity TEXT NOT NULL,
    chance INTEGER NOT NULL,
    visual_id TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_auras (
    user_id TEXT NOT NULL,
    aura_id TEXT NOT NULL,
    obtained_at TEXT NOT NULL,
    PRIMARY KEY (user_id, aura_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (aura_id) REFERENCES auras(id)
  );
`;

export function runMigrationsOn(db: { exec: (sql: string) => void }) {
  db.exec(MIGRATION_SQL);
}

export async function runMigrations() {
  fs.mkdirSync(dataDir, { recursive: true });
  const SQLMod = await initSqlJs();
  let buffer: Uint8Array | undefined;
  if (fs.existsSync(dbPath)) {
    buffer = new Uint8Array(fs.readFileSync(dbPath));
  }
  const sqlite = new SQLMod.Database(buffer);
  runMigrationsOn(sqlite);
  const data = sqlite.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  sqlite.close();
}

async function main() {
  await runMigrations();
  console.log('Migration complete.');
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  main().catch(console.error);
}
