export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface Aura {
  id: string;
  name: string;
  rarity: Rarity;
  chance: number; // denominator e.g. 2 = 1/2
  visualId: string;
  description: string;
}

export interface UserPublic {
  id: string;
  username: string;
  gold: number;
  hasAutoRoll: boolean;
  hasQuickRoll: boolean;
  auras: { auraId: string; obtainedAt: string }[];
}
