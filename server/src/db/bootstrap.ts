import { db } from './index.js';
import { auras } from './schema.js';
import { AURAS_SEED } from './auras-data.js';

export function bootstrap() {
  const count = db.select().from(auras).all().length;
  if (count === 0) {
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
    console.log(`Seeded ${AURAS_SEED.length} auras.`);
  }
}
