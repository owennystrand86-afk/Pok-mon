import { PokemonCard } from '../types';

const API_URL = 'https://api.pokemontcg.io/v2/cards';

// Fan-made "Elite Custom" cards pool
export const ADMIN_CARDS: PokemonCard[] = [
  {
    id: 'admin-1',
    name: 'FUNK ONE',
    supertype: 'Pokémon',
    subtypes: ['VMAX', 'Gigantamax'],
    hp: '5000',
    types: ['Fighting'],
    attacks: [
      {
        name: 'funk blast',
        cost: ['Fighting', 'Water', 'Psychic', 'Lightning', 'Darkness'],
        convertedEnergyCost: 5,
        damage: '500',
        text: 'epic funk plays blasting your eardrums out killing you'
      },
      {
        name: 'die',
        cost: ['Grass', 'Fire', 'Psychic', 'Psychic', 'Fighting'],
        convertedEnergyCost: 5,
        damage: '10000000',
        text: 'what do you expect you just die Do you want a cookie or something pathetic infant'
      },
      {
        name: 'Elite Silence',
        cost: ['Psychic', 'Psychic'],
        convertedEnergyCost: 2,
        damage: '1000',
        text: 'The ultimate silence that deafens all who oppose the elite.'
      },
      {
        name: 'Admin Override',
        cost: ['Colorless'],
        convertedEnergyCost: 1,
        damage: '99999',
        text: "Instantly deletes the opponent's active Pokémon from existence."
      }
    ],
    weaknesses: [{ type: 'Metal', value: 'x2' }],
    resistances: [{ type: 'Darkness', value: '-30' }],
    retreatCost: ['Colorless', 'Colorless', 'Colorless', 'Colorless', 'Colorless'],
    images: {
      small: 'https://storage.googleapis.com/static.antigravity.dev/651f2423-5297-414c-a4a2-383b1ac35077/1743217852178.png',
      large: 'https://storage.googleapis.com/static.antigravity.dev/651f2423-5297-414c-a4a2-383b1ac35077/1743217852178.png'
    },
    rarity: 'Elite Custom',
    set: {
      id: 'admin',
      name: 'Admin Collection',
      series: 'Admin',
      printedTotal: 1,
      total: 1,
      images: {
        symbol: 'https://picsum.photos/seed/symbol/100/100',
        logo: 'https://picsum.photos/seed/logo/200/100'
      }
    }
  },
  {
    id: 'admin-2',
    name: 'WE CANT READ ONE',
    supertype: 'Pokémon',
    subtypes: ['Basic'],
    hp: '5000',
    types: ['Fighting'],
    attacks: [
      {
        name: 'Read the manga',
        cost: ['Fighting', 'Water', 'Psychic', 'Lightning', 'Darkness'],
        convertedEnergyCost: 5,
        damage: '500',
        text: 'this attack instantly makes you read the manga stunning your opponent for three rounds having all four of the cards make it do two times its damage It also ...'
      },
      {
        name: 'die',
        cost: ['Grass', 'Fire', 'Psychic', 'Psychic', 'Fighting'],
        convertedEnergyCost: 5,
        damage: '10000000',
        text: 'what do you expect you just die Do you want a cookie or something pathetic infant'
      },
      {
        name: 'Spoilers',
        cost: ['Darkness', 'Darkness'],
        convertedEnergyCost: 2,
        damage: '200',
        text: "Reveal the opponent's hand and discard all Trainer cards."
      },
      {
        name: 'Manga Knowledge',
        cost: ['Psychic'],
        convertedEnergyCost: 1,
        damage: '300',
        text: 'Draw cards until you have 10 in your hand.'
      }
    ],
    weaknesses: [{ type: 'Metal', value: 'x2' }],
    resistances: [{ type: 'Darkness', value: '-30' }],
    retreatCost: ['Colorless', 'Colorless', 'Colorless', 'Colorless', 'Colorless'],
    images: {
      small: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png',
      large: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png'
    },
    rarity: 'Elite Custom',
    set: {
      id: 'admin',
      name: 'Admin Collection',
      series: 'Admin',
      printedTotal: 1,
      total: 1,
      images: {
        symbol: 'https://picsum.photos/seed/symbol/100/100',
        logo: 'https://picsum.photos/seed/logo/200/100'
      }
    }
  },
  {
    id: 'admin-3',
    name: 'INFINITY MASTER',
    supertype: 'Pokémon',
    subtypes: ['Elite'],
    hp: '9999',
    types: ['Psychic', 'Darkness'],
    attacks: [
      { name: 'Snap', damage: '999999', cost: ['Psychic', 'Darkness'], convertedEnergyCost: 2, text: 'Deletes half of the universe.' },
      { name: 'Time Warp', damage: '0', cost: ['Psychic'], convertedEnergyCost: 1, text: 'Rewinds the battle to the start.' }
    ],
    images: { small: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/493.png', large: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/493.png' },
    rarity: 'Elite Custom',
    set: { id: 'admin', name: 'Admin Collection', series: 'Admin', printedTotal: 1, total: 1, images: { symbol: '', logo: '' } }
  },
  {
    id: 'admin-4',
    name: 'VOID WALKER',
    supertype: 'Pokémon',
    subtypes: ['Elite'],
    hp: '7777',
    types: ['Darkness'],
    attacks: [
      { name: 'Void Strike', damage: '5000', cost: ['Darkness'], convertedEnergyCost: 1, text: 'Strikes from the void.' },
      { name: 'Erase', damage: '10000', cost: ['Darkness', 'Darkness'], convertedEnergyCost: 2, text: 'Erases the target.' }
    ],
    images: { small: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/491.png', large: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/491.png' },
    rarity: 'Elite Custom',
    set: { id: 'admin', name: 'Admin Collection', series: 'Admin', printedTotal: 1, total: 1, images: { symbol: '', logo: '' } }
  },
  {
    id: 'admin-5',
    name: 'SOLAR DEITY',
    supertype: 'Pokémon',
    subtypes: ['Elite'],
    hp: '8888',
    types: ['Fire'],
    attacks: [
      { name: 'Solar Flare', damage: '8000', cost: ['Fire'], convertedEnergyCost: 1, text: 'The heat of a thousand suns.' },
      { name: 'Nova', damage: '20000', cost: ['Fire', 'Fire'], convertedEnergyCost: 2, text: 'Supernova explosion.' }
    ],
    images: { small: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/791.png', large: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/791.png' },
    rarity: 'Elite Custom',
    set: { id: 'admin', name: 'Admin Collection', series: 'Admin', printedTotal: 1, total: 1, images: { symbol: '', logo: '' } }
  },
  {
    id: 'admin-6',
    name: 'LUNAR EMPRESS',
    supertype: 'Pokémon',
    subtypes: ['Elite'],
    hp: '8888',
    types: ['Psychic'],
    attacks: [
      { name: 'Moonlight Shadow', damage: '7000', cost: ['Psychic'], convertedEnergyCost: 1, text: 'Shadows from the moon.' },
      { name: 'Eclipse', damage: '15000', cost: ['Psychic', 'Psychic'], convertedEnergyCost: 2, text: 'Total lunar eclipse.' }
    ],
    images: { small: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/792.png', large: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/792.png' },
    rarity: 'Elite Custom',
    set: { id: 'admin', name: 'Admin Collection', series: 'Admin', printedTotal: 1, total: 1, images: { symbol: '', logo: '' } }
  },
  {
    id: 'admin-7',
    name: 'CYBER DRAGON',
    supertype: 'Pokémon',
    subtypes: ['Elite'],
    hp: '6666',
    types: ['Metal', 'Lightning'],
    attacks: [
      { name: 'Data Stream', damage: '4000', cost: ['Metal'], convertedEnergyCost: 1, text: 'Overloads the system.' },
      { name: 'Giga Cannon', damage: '12000', cost: ['Metal', 'Lightning'], convertedEnergyCost: 2, text: 'Massive energy blast.' }
    ],
    images: { small: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/483.png', large: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/483.png' },
    rarity: 'Elite Custom',
    set: { id: 'admin', name: 'Admin Collection', series: 'Admin', printedTotal: 1, total: 1, images: { symbol: '', logo: '' } }
  },
  {
    id: 'admin-8',
    name: 'ANCIENT TITAN',
    supertype: 'Pokémon',
    subtypes: ['Elite'],
    hp: '12000',
    types: ['Fighting'],
    attacks: [
      { name: 'Earthquake', damage: '6000', cost: ['Fighting'], convertedEnergyCost: 1, text: 'Shakes the planet.' },
      { name: 'Mountain Crush', damage: '18000', cost: ['Fighting', 'Fighting'], convertedEnergyCost: 2, text: 'Crushes with the weight of a mountain.' }
    ],
    images: { small: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/486.png', large: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/486.png' },
    rarity: 'Elite Custom',
    set: { id: 'admin', name: 'Admin Collection', series: 'Admin', printedTotal: 1, total: 1, images: { symbol: '', logo: '' } }
  },
  {
    id: 'admin-9',
    name: 'GLITCH ENTITY',
    supertype: 'Pokémon',
    subtypes: ['Elite'],
    hp: '4040',
    types: ['Colorless'],
    attacks: [
      { name: 'Null Pointer', damage: '404', cost: ['Colorless'], convertedEnergyCost: 1, text: 'Error: Target not found.' },
      { name: 'System Crash', damage: '40400', cost: ['Colorless', 'Colorless'], convertedEnergyCost: 2, text: 'Fatal error.' }
    ],
    images: { small: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/474.png', large: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/474.png' },
    rarity: 'Elite Custom',
    set: { id: 'admin', name: 'Admin Collection', series: 'Admin', printedTotal: 1, total: 1, images: { symbol: '', logo: '' } }
  },
  {
    id: 'admin-10',
    name: 'OMEGA RAYQUAZA',
    supertype: 'Pokémon',
    subtypes: ['Elite'],
    hp: '9000',
    types: ['Dragon', 'Fire'],
    attacks: [
      { name: 'Omega Ascent', damage: '10000', cost: ['Dragon'], convertedEnergyCost: 1, text: 'Ascends to the heavens.' },
      { name: 'Dragon Pulse', damage: '25000', cost: ['Dragon', 'Fire'], convertedEnergyCost: 2, text: 'Ultimate dragon energy.' }
    ],
    images: { small: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/384.png', large: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/384.png' },
    rarity: 'Elite Custom',
    set: { id: 'admin', name: 'Admin Collection', series: 'Admin', printedTotal: 1, total: 1, images: { symbol: '', logo: '' } }
  },
  {
    id: 'admin-11',
    name: 'PRIMAL KYOGRE',
    supertype: 'Pokémon',
    subtypes: ['Elite'],
    hp: '9000',
    types: ['Water'],
    attacks: [
      { name: 'Origin Pulse', damage: '10000', cost: ['Water'], convertedEnergyCost: 1, text: 'The origin of all water.' },
      { name: 'Tsunami', damage: '25000', cost: ['Water', 'Water'], convertedEnergyCost: 2, text: 'World-ending wave.' }
    ],
    images: { small: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/382.png', large: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/382.png' },
    rarity: 'Elite Custom',
    set: { id: 'admin', name: 'Admin Collection', series: 'Admin', printedTotal: 1, total: 1, images: { symbol: '', logo: '' } }
  },
  {
    id: 'admin-12',
    name: 'PRIMAL GROUDON',
    supertype: 'Pokémon',
    subtypes: ['Elite'],
    hp: '9000',
    types: ['Fire', 'Fighting'],
    attacks: [
      { name: 'Precipice Blades', damage: '10000', cost: ['Fire'], convertedEnergyCost: 1, text: 'Blades from the earth.' },
      { name: 'Magma Storm', damage: '25000', cost: ['Fire', 'Fighting'], convertedEnergyCost: 2, text: 'Storm of liquid fire.' }
    ],
    images: { small: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/383.png', large: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/383.png' },
    rarity: 'Elite Custom',
    set: { id: 'admin', name: 'Admin Collection', series: 'Admin', printedTotal: 1, total: 1, images: { symbol: '', logo: '' } }
  }
];

const FAN_MADE_CARDS: PokemonCard[] = [
  {
    id: 'fan-charizard-1',
    name: 'Cosmic Charizard GX',
    supertype: 'Pokémon',
    subtypes: ['Stage 2', 'GX'],
    hp: '300',
    types: ['Fire', 'Psychic'],
    rarity: 'Elite Custom',
    images: {
      small: 'https://images.pokemontcg.io/sm12/75.png', // Using a placeholder but with custom stats
      large: 'https://images.pokemontcg.io/sm12/75_hires.png'
    },
    attacks: [{ name: 'Supernova Blast', damage: '250', cost: ['Fire', 'Fire', 'Psychic'], convertedEnergyCost: 3, text: 'Discard all energy attached to this Pokémon.' }],
    set: { id: 'fan', name: 'Fan Made Elite', series: 'Custom', printedTotal: 100, total: 100, images: { symbol: '', logo: '' } },
    number: '001',
    artist: 'Elite Fan Artist'
  },
  {
    id: 'fan-charizard-2',
    name: 'Shadow Charizard VMAX',
    supertype: 'Pokémon',
    subtypes: ['VMAX'],
    hp: '340',
    types: ['Fire', 'Darkness'],
    rarity: 'Elite Custom',
    images: {
      small: 'https://images.pokemontcg.io/swsh4/25.png',
      large: 'https://images.pokemontcg.io/swsh4/25_hires.png'
    },
    attacks: [{ name: 'Shadow Flare', damage: '180+', cost: ['Fire', 'Darkness'], convertedEnergyCost: 2, text: 'Does 30 more damage for each Darkness energy in your discard pile.' }],
    set: { id: 'fan', name: 'Fan Made Elite', series: 'Custom', printedTotal: 100, total: 100, images: { symbol: '', logo: '' } },
    number: '002',
    artist: 'Elite Fan Artist'
  },
  // We can generate more programmatically or just add a few high-quality ones
];

// Generate 50+ Fan-made Charizards with variety
const CHARIZARD_IMAGES = [
  { s: 'https://images.pokemontcg.io/base1/4.png', l: 'https://images.pokemontcg.io/base1/4_hires.png' },
  { s: 'https://images.pokemontcg.io/swsh4/25.png', l: 'https://images.pokemontcg.io/swsh4/25_hires.png' },
  { s: 'https://images.pokemontcg.io/sm12/75.png', l: 'https://images.pokemontcg.io/sm12/75_hires.png' },
  { s: 'https://images.pokemontcg.io/xy12/11.png', l: 'https://images.pokemontcg.io/xy12/11_hires.png' },
  { s: 'https://images.pokemontcg.io/g1/11.png', l: 'https://images.pokemontcg.io/g1/11_hires.png' },
  { s: 'https://images.pokemontcg.io/dp6/103.png', l: 'https://images.pokemontcg.io/dp6/103_hires.png' },
  { s: 'https://images.pokemontcg.io/bw7/20.png', l: 'https://images.pokemontcg.io/bw7/20_hires.png' },
  { s: 'https://images.pokemontcg.io/xy2/13.png', l: 'https://images.pokemontcg.io/xy2/13_hires.png' },
  { s: 'https://images.pokemontcg.io/sm3/20.png', l: 'https://images.pokemontcg.io/sm3/20_hires.png' },
  { s: 'https://images.pokemontcg.io/swsh9/18.png', l: 'https://images.pokemontcg.io/swsh9/18_hires.png' },
];

for (let i = 3; i <= 55; i++) {
  const themes = ['Mecha', 'Ancient', 'Cyber', 'Ghost', 'Primal', 'Radiant', 'Ethereal', 'Void', 'Solar', 'Lunar'];
  const theme = themes[i % themes.length];
  const imgIdx = i % CHARIZARD_IMAGES.length;
  
  FAN_MADE_CARDS.push({
    id: `fan-charizard-${i}`,
    name: `${theme} Charizard`,
    supertype: 'Pokémon',
    subtypes: ['Stage 2', 'Elite'],
    hp: (200 + Math.floor(Math.random() * 150)).toString(),
    types: ['Fire', theme === 'Mecha' ? 'Metal' : theme === 'Ghost' ? 'Psychic' : 'Fire'],
    rarity: 'Elite Custom',
    images: {
      small: CHARIZARD_IMAGES[imgIdx].s,
      large: CHARIZARD_IMAGES[imgIdx].l
    },
    attacks: [{ name: `${theme} Burn`, damage: (100 + Math.floor(Math.random() * 100)).toString(), cost: ['Fire'], convertedEnergyCost: 1, text: `A powerful ${theme} attack.` }],
    set: { id: 'fan', name: 'Fan Made Elite', series: 'Custom', printedTotal: 100, total: 100, images: { symbol: '', logo: '' } },
    number: i.toString().padStart(3, '0'),
    artist: 'Elite Fan Artist'
  });
}

// Helper to get retro sprite URL
function getSpriteUrl(card: PokemonCard): string {
  const id = card.nationalPokedexNumbers?.[0];
  if (id) {
    // Gen 3 Emerald style sprites
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/emerald/${id}.png`;
  }
  // Fallback to a generic sprite or the card image if no dex number
  return card.images.small;
}

export async function fetchRandomCards(count: number = 5, query: string = ''): Promise<PokemonCard[]> {
  try {
    const randomPage = Math.floor(Math.random() * 5) + 1;
    let url = `${API_URL}?pageSize=100&page=${randomPage}`;
    if (query) {
      url += `&q=${encodeURIComponent(query)}`;
    }
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      // Fallback if query returns nothing
      const fallbackResponse = await fetch(`${API_URL}?pageSize=${count}&page=1`);
      const fallbackData = await fallbackResponse.json();
      const cards = (fallbackData.data || []).map((c: PokemonCard) => ({
        ...c,
        spriteUrl: getSpriteUrl(c)
      }));
      return cards;
    }

    // Mix in some fan-made cards (10% chance) only if not querying for energy
    const combinedPool = [...data.data];
    if (!query.includes('Energy') && Math.random() > 0.8) {
      const fanCount = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < fanCount; i++) {
        combinedPool.push(FAN_MADE_CARDS[Math.floor(Math.random() * FAN_MADE_CARDS.length)]);
      }
    }

    const shuffled = combinedPool.sort(() => 0.5 - Math.random());
    const cards = shuffled.slice(0, count).map((c: PokemonCard) => ({
      ...c,
      spriteUrl: getSpriteUrl(c)
    }));
    return cards;
  } catch (error) {
    console.error('Error fetching cards:', error);
    return [];
  }
}

export async function fetchPackCards(setId?: string): Promise<PokemonCard[]> {
  if (setId) {
    return fetchRandomCards(5, `set.id:${setId}`);
  }
  return fetchRandomCards(5);
}

export async function fetchEvolution(pokemonName: string): Promise<PokemonCard | null> {
  try {
    // Search for cards that evolve from this pokemon
    const url = `${API_URL}?q=evolvesFrom:"${encodeURIComponent(pokemonName)}"&pageSize=1`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      const card = data.data[0];
      return {
        ...card,
        spriteUrl: getSpriteUrl(card)
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching evolution:', error);
    return null;
  }
}

export async function fetchPokedex(page: number = 1, pageSize: number = 20, search: string = ''): Promise<{ data: PokemonCard[], totalCount: number }> {
  try {
    // Filter fan-made cards based on search
    const filteredFanMade = search 
      ? FAN_MADE_CARDS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
      : FAN_MADE_CARDS;

    const fanCount = filteredFanMade.length;
    const startIdx = (page - 1) * pageSize;
    const endIdx = page * pageSize;

    let results: PokemonCard[] = [];
    let apiTotalCount = 0;

    // If we are within the range of fan-made cards
    if (startIdx < fanCount) {
      results = filteredFanMade.slice(startIdx, endIdx);
      
      // If we still need more cards to fill the page, fetch from API
      if (results.length < pageSize) {
        const remaining = pageSize - results.length;
        let url = `${API_URL}?pageSize=${remaining}&page=1`;
        if (search) {
          url += `&q=name:*${encodeURIComponent(search)}*`;
        }
        const response = await fetch(url);
        const data = await response.json();
        results = [...results, ...(data.data || [])];
        apiTotalCount = data.totalCount || 0;
      } else {
        // Just to get the total count from API for pagination
        let url = `${API_URL}?pageSize=1&page=1`;
        if (search) {
          url += `&q=name:*${encodeURIComponent(search)}*`;
        }
        const response = await fetch(url);
        const data = await response.json();
        apiTotalCount = data.totalCount || 0;
      }
    } else {
      // We are past fan-made cards, fetch only from API
      // Calculate which API page we need
      const officialOffset = startIdx - fanCount;
      const apiPage = Math.floor(officialOffset / pageSize) + 1;
      const apiPageSize = pageSize;
      
      let url = `${API_URL}?pageSize=${apiPageSize}&page=${apiPage}`;
      if (search) {
        url += `&q=name:*${encodeURIComponent(search)}*`;
      }
      const response = await fetch(url);
      const data = await response.json();
      results = data.data || [];
      apiTotalCount = data.totalCount || 0;
    }

    const cardsWithSprites = results.map(c => ({
      ...c,
      spriteUrl: getSpriteUrl(c)
    }));

    return {
      data: cardsWithSprites,
      totalCount: apiTotalCount + fanCount
    };
  } catch (error) {
    console.error('Error fetching pokedex:', error);
    return { data: [], totalCount: 0 };
  }
}
