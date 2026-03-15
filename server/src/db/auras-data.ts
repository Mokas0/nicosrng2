import type { Rarity } from '../../../shared/types.js';

const COMMON_NAMES = [
  'Ember', 'Frost', 'Breeze', 'Spark', 'Shade', 'Glow', 'Mist', 'Flame', 'Dust', 'Leaf',
  'Stone', 'Wave', 'Star', 'Moon', 'Sun', 'Dawn', 'Dusk', 'Storm', 'Rain', 'Snow',
  'Coral', 'Ivy', 'Moss', 'Petal', 'Thorn', 'Seed', 'Root', 'Bark', 'Pine', 'Oak',
  'Ash', 'Birch', 'Willow', 'Maple', 'Cedar', 'Elm', 'Bloom', 'Fern', 'Clover', 'Lotus',
  'Blaze', 'Flicker', 'Glimmer', 'Shimmer', 'Dazzle', 'Prism', 'Crystal', 'Pearl', 'Opal', 'Jade',
];
const UNCOMMON_NAMES = [
  'Silver Veil', 'Golden Dust', 'Crimson Pulse', 'Azure Glow', 'Violet Haze', 'Emerald Shine',
  'Sapphire Mist', 'Ruby Flame', 'Amber Light', 'Onyx Shadow', 'Ivory Dawn', 'Obsidian Night',
  'Copper Blaze', 'Bronze Aura', 'Platinum Gleam', 'Jade Whisper', 'Coral Tide', 'Lavender Dream',
  'Peach Sunset', 'Mint Breeze', 'Indigo Storm', 'Teal Wave', 'Rose Quartz', 'Turquoise Glow',
  'Honeycomb', 'Thunder Strike', 'Lightning Vein', 'Solar Flare', 'Lunar Beam', 'Stardust',
];
const RARE_NAMES = [
  'Phoenix Ember', 'Dragon Scale', 'Griffin Feather', 'Unicorn Horn', 'Basilisk Gaze',
  'Kraken Ink', 'Thunderbird Wing', 'Frost Giant Breath', 'Void Walker', 'Celestial Spark',
  'Infernal Crown', 'Abyssal Whisper', 'Ethereal Form', 'Phantom Veil', 'Spirit Flame',
  'Ancient Oak', 'Eternal Frost', 'Infinite Star', 'Cosmic Dust', 'Void Tear',
  'Seraphim Light', 'Demon Fire', 'Titan Bone', 'Hydra Venom', 'Chimera Roar',
  'Sphinx Riddle', 'Minotaur Fury', 'Medusa Stone', 'Cerberus Fang', 'Pegasus Wind',
];
const EPIC_NAMES = [
  'Chrono Shift', 'Reality Bend', 'Dimension Tear', 'Time Dilation', 'Space Fold',
  'Infinity Edge', 'Zero Point', 'Singularity', 'Event Horizon', 'Black Hole Heart',
  'Supernova Soul', 'Nebula Veil', 'Galaxy Core', 'Quantum Flux', 'Antimatter Glow',
  'Celestial Dominion', 'Infernal Majesty', 'Abyssal Lord', 'Divine Judgment', 'Primordial Chaos',
  'Eternal Winter', 'Infinite Summer', 'Void Emperor', 'Light Sovereign', 'Shadow King',
];
const LEGENDARY_NAMES = [
  'Genesis Flame', 'Apocalypse Ash', 'Eternity Ring', 'Omnipotence', 'Creation Spark',
  'Destruction Void', 'Balance Scale', 'Fate Weaver', 'Destiny Thread', 'Reality Anchor',
  'Dream Eater', 'Nightmare King', 'Hope Eternal', 'Despair Absolute', 'Chaos Incarnate',
  'Order Supreme', 'First Light', 'Last Shadow', 'Alpha Omega', 'Beginning End',
];
const MYTHIC_NAMES = [
  'The Infinite', 'The Eternal', 'The Absolute', 'The Primordial', 'The Transcendent',
  'Fame and Fortune', 'Cosmic Sovereign', 'Reality Architect', 'Universe Heart', 'Existence Core',
];

export interface AuraSeed {
  id: string;
  name: string;
  rarity: Rarity;
  chance: number;
  visualId: string;
  description: string;
}

export function generateAuras(): AuraSeed[] {
  const list: AuraSeed[] = [];
  let id = 1;

  // Common: 35 auras, chance 2–12
  const commonNames = [...COMMON_NAMES];
  for (let i = 0; i < 35; i++) {
    const name = commonNames[i % commonNames.length]! + (i >= commonNames.length ? ` ${Math.floor(i / commonNames.length) + 1}` : '');
    list.push({
      id: `aura-${id++}`,
      name,
      rarity: 'common',
      chance: 2 + (i % 11),
      visualId: `common-${(i % 5) + 1}`,
      description: `A common aura of ${name}.`,
    });
  }

  // Uncommon: 35 auras, chance 15–60
  const uncommonNames = [...UNCOMMON_NAMES];
  for (let i = 0; i < 35; i++) {
    const name = uncommonNames[i % uncommonNames.length]!;
    list.push({
      id: `aura-${id++}`,
      name,
      rarity: 'uncommon',
      chance: 15 + (i % 46),
      visualId: `uncommon-${(i % 5) + 1}`,
      description: `An uncommon aura: ${name}.`,
    });
  }

  // Rare: 30 auras, chance 100–800
  const rareNames = [...RARE_NAMES];
  for (let i = 0; i < 30; i++) {
    const name = rareNames[i % rareNames.length]!;
    list.push({
      id: `aura-${id++}`,
      name,
      rarity: 'rare',
      chance: 100 + (i % 701),
      visualId: `rare-${(i % 5) + 1}`,
      description: `A rare aura: ${name}.`,
    });
  }

  // Epic: 25 auras, chance 1000–15000
  const epicNames = [...EPIC_NAMES];
  for (let i = 0; i < 25; i++) {
    const name = epicNames[i % epicNames.length]!;
    list.push({
      id: `aura-${id++}`,
      name,
      rarity: 'epic',
      chance: 1000 + (i % 14001),
      visualId: `epic-${(i % 5) + 1}`,
      description: `An epic aura: ${name}.`,
    });
  }

  // Legendary: 15 auras, chance 20000–120000
  const legNames = [...LEGENDARY_NAMES];
  for (let i = 0; i < 15; i++) {
    const name = legNames[i % legNames.length]!;
    list.push({
      id: `aura-${id++}`,
      name,
      rarity: 'legendary',
      chance: 20000 + (i % 100001),
      visualId: `legendary-${(i % 5) + 1}`,
      description: `A legendary aura: ${name}.`,
    });
  }

  // Mythic: 10 auras, chance 150000–500000
  const mythNames = [...MYTHIC_NAMES];
  for (let i = 0; i < 10; i++) {
    const name = mythNames[i % mythNames.length]!;
    list.push({
      id: `aura-${id++}`,
      name,
      rarity: 'mythic',
      chance: 150000 + (i % 350001),
      visualId: `mythic-${(i % 5) + 1}`,
      description: `A mythic aura: ${name}.`,
    });
  }

  return list;
}

export const AURAS_SEED = generateAuras();
