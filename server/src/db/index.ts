import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import * as schema from './schema.js';
import { runMigrationsOn } from './migrate.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');
const dbPath = path.join(dataDir, 'fame.db');

let _db: ReturnType<typeof drizzle>;
let _sqlite: InstanceType<SqlJsStatic['Database']>;
const PERSIST_INTERVAL_MS = 30_000;
let _persistTimer: ReturnType<typeof setInterval> | null = null;

export function saveToFile() {
  if (!_sqlite) return;
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const data = _sqlite.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (e) {
    console.error('Failed to persist database:', e);
  }
}

export async function initDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  const SQL = await initSqlJs();
  let buffer: Uint8Array | undefined;
  if (fs.existsSync(dbPath)) {
    buffer = new Uint8Array(fs.readFileSync(dbPath));
  }
  _sqlite = new SQL.Database(buffer);
  runMigrationsOn(_sqlite);
  _db = drizzle(_sqlite, { schema });

  _persistTimer = setInterval(saveToFile, PERSIST_INTERVAL_MS);
  process.on('beforeExit', () => {
    if (_persistTimer) clearInterval(_persistTimer);
    saveToFile();
  });

  return _db;
}

export function getDb() {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return (getDb() as any)[prop];
  },
});

export * from './schema.js';
