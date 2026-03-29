export interface PokemonCard {
  id: string;
  name: string;
  supertype: string;
  subtypes: string[];
  hp?: string;
  types?: string[];
  attacks?: {
    name: string;
    cost: string[];
    convertedEnergyCost: number;
    damage: string;
    text: string;
  }[];
  weaknesses?: {
    type: string;
    value: string;
  }[];
  resistances?: {
    type: string;
    value: string;
  }[];
  retreatCost?: string[];
  convertedRetreatCost?: number;
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    images: {
      symbol: string;
      logo: string;
    };
  };
  number?: string;
  artist?: string;
  rarity?: string;
  flavorText?: string;
  nationalPokedexNumbers?: number[];
  images: {
    small: string;
    large: string;
  };
  spriteUrl?: string;
  boosts?: {
    hp?: number;
    attack?: number;
    defense?: number;
    speed?: number;
  };
}

export interface Pack {
  id: string;
  name: string;
  image: string;
  cards: PokemonCard[];
}

export interface PackConfig {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  type: 'pokemon' | 'energy' | 'special';
  setId?: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  image: string;
  type: 'ball' | 'healing' | 'material' | 'special' | 'battle' | 'evolution' | 'elite';
  price: number;
  catchRate?: number; // For balls
  healAmount?: number; // For healing items
  statBoost?: {
    stat: 'hp' | 'attack' | 'defense' | 'speed';
    amount: number;
    isPermanent?: boolean;
  };
}

export interface InventoryItem {
  itemId: string;
  count: number;
}

export interface Planet {
  id: string;
  name: string;
  description: string;
  image: string;
  color: string;
  unlockCost: number;
  rarityMultiplier: number; // Higher means rarer pokemon
  specialPokemon?: string[]; // Specific pokemon IDs for this planet
  backgroundClass: string;
  grassClass: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  wins: number;
  losses: number;
  coins: number;
  cardsCollected: number;
  isBanned?: boolean;
  isTimedOut?: boolean;
  timeoutUntil?: string;
  kickTrigger?: number;
  role?: 'admin' | 'user';
  collection?: PokemonCard[];
  inventory?: InventoryItem[];
}

export interface GameState {
  collection: PokemonCard[];
  packsOpened: number;
  coins: number;
  inventory: InventoryItem[];
  unlockedPlanets: string[];
  currentPlanetId: string;
  isBanned?: boolean;
  isTimedOut?: boolean;
  timeoutUntil?: string;
  kickTrigger?: number;
}
