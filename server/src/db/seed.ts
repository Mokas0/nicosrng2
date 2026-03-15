import { initDb, db, saveToFile } from './index.js';
import { auras } from './schema.js';
import { AURAS_SEED } from './auras-data.js';

async function seed() {
  await initDb();
  for (const a of AURAS_SEED) {
    try {
      db.insert(auras).values({
        id: a.id,
        name: a.name,
        rarity: a.rarity,
        chance: a.chance,
        visualId: a.visualId,
        description: a.description,
      }).run();
    } catch {
      // ignore duplicate
    }
  }
  saveToFile();
  console.log(`Seeded ${AURAS_SEED.length} auras.`);
}

seed().catch(console.error);
