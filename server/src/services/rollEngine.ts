import { db } from '../db/index.js';
import { auras } from '../db/schema.js';

export interface RollResult {
  id: string;
  name: string;
  rarity: string;
  chance: number;
  visualId: string;
  description: string;
}

export function performRoll(): RollResult | null {
  const all = db.select().from(auras).all();
  if (all.length === 0) return null;
  const weights = all.map((a) => 1 / a.chance);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < all.length; i++) {
    r -= weights[i]!;
    if (r <= 0) {
      const a = all[i]!;
      return {
        id: a.id,
        name: a.name,
        rarity: a.rarity,
        chance: a.chance,
        visualId: a.visualId,
        description: a.description,
      };
    }
  }
  const a = all[all.length - 1]!;
  return {
    id: a.id,
    name: a.name,
    rarity: a.rarity,
    chance: a.chance,
    visualId: a.visualId,
    description: a.description,
  };
}
