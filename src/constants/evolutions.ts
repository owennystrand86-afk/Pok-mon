export interface EvolutionMapping {
  from: string; // National Pokedex Number or Name
  to: string;   // National Pokedex Number or Name
  item: string; // Item ID
}

export const EVOLUTION_MAPPINGS: EvolutionMapping[] = [
  // Fire Stone
  { from: 'Vulpix', to: 'Ninetales', item: 'fire-stone' },
  { from: 'Growlithe', to: 'Arcanine', item: 'fire-stone' },
  { from: 'Eevee', to: 'Flareon', item: 'fire-stone' },
  { from: 'Pansear', to: 'Simisear', item: 'fire-stone' },
  { from: 'Darumaka', to: 'Darmanitan', item: 'fire-stone' },
  
  // Water Stone
  { from: 'Poliwhirl', to: 'Poliwrath', item: 'water-stone' },
  { from: 'Shellder', to: 'Cloyster', item: 'water-stone' },
  { from: 'Staryu', to: 'Starmie', item: 'water-stone' },
  { from: 'Eevee', to: 'Vaporeon', item: 'water-stone' },
  { from: 'Lombre', to: 'Ludicolo', item: 'water-stone' },
  { from: 'Panpour', to: 'Simipour', item: 'water-stone' },
  
  // Thunder Stone
  { from: 'Pikachu', to: 'Raichu', item: 'thunder-stone' },
  { from: 'Eevee', to: 'Jolteon', item: 'thunder-stone' },
  { from: 'Eelektrik', to: 'Eelektross', item: 'thunder-stone' },
  { from: 'Pikachu', to: 'Raichu', item: 'thunder-stone' },
  { from: 'Magneton', to: 'Magnezone', item: 'thunder-stone' },
  
  // Leaf Stone
  { from: 'Gloom', to: 'Vileplume', item: 'leaf-stone' },
  { from: 'Weepinbell', to: 'Victreebel', item: 'leaf-stone' },
  { from: 'Exeggcute', to: 'Exeggutor', item: 'leaf-stone' },
  { from: 'Nuzleaf', to: 'Shiftry', item: 'leaf-stone' },
  { from: 'Pansage', to: 'Simisage', item: 'leaf-stone' },
  
  // Moon Stone
  { from: 'Nidorina', to: 'Nidoqueen', item: 'moon-stone' },
  { from: 'Nidorino', to: 'Nidoking', item: 'moon-stone' },
  { from: 'Clefairy', to: 'Clefable', item: 'moon-stone' },
  { from: 'Jigglypuff', to: 'Wigglytuff', item: 'moon-stone' },
  { from: 'Skitty', to: 'Delcatty', item: 'moon-stone' },
  { from: 'Munna', to: 'Musharna', item: 'moon-stone' },
  
  // Sun Stone
  { from: 'Gloom', to: 'Bellossom', item: 'sun-stone' },
  { from: 'Sunkern', to: 'Sunflora', item: 'sun-stone' },
  { from: 'Cottonee', to: 'Whimsicott', item: 'sun-stone' },
  { from: 'Petilil', to: 'Lilligant', item: 'sun-stone' },
  { from: 'Helioptile', to: 'Heliolisk', item: 'sun-stone' },
  
  // Shiny Stone
  { from: 'Togetic', to: 'Togekiss', item: 'shiny-stone' },
  { from: 'Roselia', to: 'Roserade', item: 'shiny-stone' },
  { from: 'Minccino', to: 'Cinccino', item: 'shiny-stone' },
  { from: 'Floette', to: 'Florges', item: 'shiny-stone' },
  
  // Dusk Stone
  { from: 'Murkrow', to: 'Honchkrow', item: 'dusk-stone' },
  { from: 'Misdreavus', to: 'Mismagius', item: 'dusk-stone' },
  { from: 'Lampent', to: 'Chandelure', item: 'dusk-stone' },
  { from: 'Doublade', to: 'Aegislash', item: 'dusk-stone' },
  
  // Dawn Stone
  { from: 'Kirlia', to: 'Gallade', item: 'dawn-stone' },
  { from: 'Snorunt', to: 'Froslass', item: 'dawn-stone' },
  
  // Ice Stone
  { from: 'Alolan Vulpix', to: 'Alolan Ninetales', item: 'ice-stone' },
  { from: 'Alolan Sandshrew', to: 'Alolan Sandslash', item: 'ice-stone' },
  { from: 'Eevee', to: 'Glaceon', item: 'ice-stone' },
  { from: 'Crabrawler', to: 'Crabominable', item: 'ice-stone' },
];

export function getEvolution(pokemonName: string, itemId: string): string | null {
  const mapping = EVOLUTION_MAPPINGS.find(m => 
    m.from.toLowerCase() === pokemonName.toLowerCase() && m.item === itemId
  );
  return mapping ? mapping.to : null;
}
