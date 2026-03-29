import { PokemonCard } from '../types';
import { Card } from './Card';
import { motion } from 'motion/react';
import { Search, Filter, ArrowUpDown, Sparkles, Sword } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useMemo } from 'react';

interface CollectionProps {
  cards: PokemonCard[];
  onSelectForBattle: (card: PokemonCard) => void;
}

type SortOption = 'name' | 'hp' | 'rarity';

export function Collection({ cards, onSelectForBattle }: CollectionProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const sortedAndFilteredCards = useMemo(() => {
    let result = cards.filter(c => 
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
       c.types?.some(t => t.toLowerCase().includes(search.toLowerCase()))) &&
      (search.toLowerCase() === 'energy' ? c.supertype === 'Energy' : true)
    );

    // If searching for "energy", prioritize energy cards
    if (search.toLowerCase() === 'energy') {
      result = cards.filter(c => c.supertype === 'Energy');
    }

    const rarityPriority: Record<string, number> = {
      'Elite Custom': 100,
      'Amazing Rare': 90,
      'Rare Holo VMAX': 80,
      'Rare Holo V': 70,
      'Rare Holo GX': 65,
      'Rare Holo EX': 60,
      'Rare Holo': 50,
      'Rare Ultra': 45,
      'Rare Secret': 40,
      'Rare': 30,
      'Uncommon': 20,
      'Common': 10,
    };

    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'hp') {
        const hpA = parseInt(a.hp || '0') || 0;
        const hpB = parseInt(b.hp || '0') || 0;
        comparison = hpA - hpB;
      } else if (sortBy === 'rarity') {
        const priorityA = rarityPriority[a.rarity || ''] || 0;
        const priorityB = rarityPriority[b.rarity || ''] || 0;
        comparison = priorityA - priorityB;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [cards, search, sortBy, sortOrder]);

  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortOrder('asc');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-8">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center lg:text-left">
          <h2 className="text-3xl font-bold uppercase tracking-tight text-white">
            Your <span className="text-yellow-500">Collection</span>
          </h2>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
            {cards.length} Cards Collected
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4" />
            <input
              type="text"
              placeholder="Search cards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-white focus:outline-none focus:border-yellow-500/50 transition-all text-xs uppercase tracking-wider"
            />
          </div>

          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
            {(['name', 'hp', 'rarity'] as SortOption[]).map((option) => (
              <button
                key={option}
                onClick={() => toggleSort(option)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                  sortBy === option 
                    ? "bg-yellow-500 text-black" 
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
              >
                {option}
                {sortBy === option && (
                  <ArrowUpDown className={cn("w-3 h-3", sortOrder === 'desc' && "rotate-180")} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {sortedAndFilteredCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
          <Search className="w-10 h-10 text-white/10 mb-4" />
          <h3 className="text-lg font-bold text-white/20 uppercase tracking-wider">No cards found</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
          {sortedAndFilteredCards.map((card, i) => (
            <motion.div
              key={`${card.id}-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 group w-full max-w-[240px]"
            >
              <Card 
                card={card} 
                onClick={() => onSelectForBattle(card)}
              />

              <div className="flex flex-col items-center gap-2 w-full">
                <div className="text-center">
                  <h4 className="text-md font-bold uppercase tracking-tight text-white group-hover:text-yellow-500 transition-colors">{card.name}</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{card.rarity || 'Common'}</p>
                </div>
                
                <button
                  onClick={() => onSelectForBattle(card)}
                  className="w-full px-4 py-2 bg-white hover:bg-yellow-500 text-black font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <Sword className="w-3 h-3" />
                  Select for Battle
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
