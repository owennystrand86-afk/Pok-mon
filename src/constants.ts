import { PackConfig } from './types';

export const PACKS: PackConfig[] = [
  {
    id: 'base-set',
    name: 'Base Set Pack',
    price: 100,
    description: 'The original set that started it all.',
    image: 'https://images.pokemontcg.io/base1/logo.png',
    type: 'pokemon',
    setId: 'base1'
  },
  {
    id: 'jungle',
    name: 'Jungle Pack',
    price: 150,
    description: 'Explore the wild with Jungle set Pokémon.',
    image: 'https://images.pokemontcg.io/base2/logo.png',
    type: 'pokemon',
    setId: 'base2'
  },
  {
    id: 'fossil',
    name: 'Fossil Pack',
    price: 200,
    description: 'Unearth ancient Pokémon from the Fossil set.',
    image: 'https://images.pokemontcg.io/base3/logo.png',
    type: 'pokemon',
    setId: 'base3'
  },
  {
    id: 'team-rocket',
    name: 'Team Rocket Pack',
    price: 250,
    description: 'Dark Pokémon and the infamous Team Rocket.',
    image: 'https://images.pokemontcg.io/base4/logo.png',
    type: 'pokemon',
    setId: 'base4'
  },
  {
    id: 'gym-heroes',
    name: 'Gym Heroes Pack',
    price: 300,
    description: 'Pokémon from the Kanto Gym Leaders.',
    image: 'https://images.pokemontcg.io/gym1/logo.png',
    type: 'pokemon',
    setId: 'gym1'
  },
  {
    id: 'gym-challenge',
    name: 'Gym Challenge Pack',
    price: 350,
    description: 'Even more Gym Leader Pokémon!',
    image: 'https://images.pokemontcg.io/gym2/logo.png',
    type: 'pokemon',
    setId: 'gym2'
  },
  {
    id: 'neo-genesis',
    name: 'Neo Genesis Pack',
    price: 400,
    description: 'The first Johto region set.',
    image: 'https://images.pokemontcg.io/neo1/logo.png',
    type: 'pokemon',
    setId: 'neo1'
  },
  {
    id: 'neo-discovery',
    name: 'Neo Discovery Pack',
    price: 450,
    description: 'Discover mysterious Johto Pokémon.',
    image: 'https://images.pokemontcg.io/neo2/logo.png',
    type: 'pokemon',
    setId: 'neo2'
  },
  {
    id: 'neo-revelation',
    name: 'Neo Revelation Pack',
    price: 500,
    description: 'Legendary Pokémon revealed.',
    image: 'https://images.pokemontcg.io/neo3/logo.png',
    type: 'pokemon',
    setId: 'neo3'
  },
  {
    id: 'neo-destiny',
    name: 'Neo Destiny Pack',
    price: 600,
    description: 'Light and Dark Pokémon collide.',
    image: 'https://images.pokemontcg.io/neo4/logo.png',
    type: 'pokemon',
    setId: 'neo4'
  },
  {
    id: 'energy-basic',
    name: 'Basic Energy Pack',
    price: 50,
    description: 'Essential energy for your Pokémon.',
    image: 'https://images.pokemontcg.io/base1/97_symbol.png',
    type: 'energy'
  },
  {
    id: 'energy-special',
    name: 'Special Energy Pack',
    price: 150,
    description: 'Rare and powerful special energy cards.',
    image: 'https://images.pokemontcg.io/base1/96_symbol.png',
    type: 'energy'
  }
];

export const ENERGY_CARDS = [
  { id: 'fire', name: 'Fire Energy', type: 'Fire', image: 'https://images.pokemontcg.io/base1/98_large.png' },
  { id: 'water', name: 'Water Energy', type: 'Water', image: 'https://images.pokemontcg.io/base1/102_large.png' },
  { id: 'grass', name: 'Grass Energy', type: 'Grass', image: 'https://images.pokemontcg.io/base1/99_large.png' },
  { id: 'lightning', name: 'Lightning Energy', type: 'Lightning', image: 'https://images.pokemontcg.io/base1/100_large.png' },
  { id: 'psychic', name: 'Psychic Energy', type: 'Psychic', image: 'https://images.pokemontcg.io/base1/101_large.png' },
  { id: 'fighting', name: 'Fighting Energy', type: 'Fighting', image: 'https://images.pokemontcg.io/base1/97_large.png' },
];
