import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PokemonCard } from '../types';
import { fetchPokedex } from '../services/pokemonService';
import { Card } from './Card';
import { Loader2, ChevronLeft, ChevronRight, BookOpen, Search } from 'lucide-react';

export function Pokedex() {
  const [cards, setCards] = useState<PokemonCard[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const pageSize = 12;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const loadPokedex = useCallback(async () => {
    setIsLoading(true);
    const result = await fetchPokedex(page, pageSize, debouncedSearch);
    setCards(result.data);
    setTotalCount(result.totalCount);
    setIsLoading(false);
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadPokedex();
  }, [loadPokedex]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-8">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center lg:text-left">
          <h2 className="text-3xl font-bold uppercase tracking-tight text-white">
            Global <span className="text-yellow-500">Pokédex</span>
          </h2>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
            Discover all {totalCount.toLocaleString()} Pokémon
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4" />
            <input
              type="text"
              placeholder="Search Pokedex..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-white focus:outline-none focus:border-yellow-500/50 transition-all text-xs uppercase tracking-wider"
            />
          </div>

          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
            <button
              disabled={page === 1 || isLoading}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 text-white hover:bg-white/5 disabled:opacity-20 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 text-center min-w-[60px]">
              <span className="text-[10px] uppercase tracking-wider font-bold text-white/40">Page {page} / {totalPages || 1}</span>
            </div>
            <button
              disabled={page === totalPages || isLoading || totalPages === 0}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 text-white hover:bg-white/5 disabled:opacity-20 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
            <p className="text-white/20 uppercase tracking-widest font-bold text-[10px]">Loading Database...</p>
          </div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center"
          >
            {cards.map((card, i) => (
              <motion.div
                key={`${card.id}-${i}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-3 group w-full max-w-[240px]"
              >
                <Card card={card} />
                <div className="text-center">
                  <h4 className="text-md font-bold uppercase tracking-tight text-white group-hover:text-yellow-500 transition-colors">{card.name}</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{card.rarity || 'Common'}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {!isLoading && (
        <div className="flex justify-center gap-4 pt-8">
          <button
            disabled={page === 1}
            onClick={() => {
              setPage(p => p - 1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="px-6 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-bold uppercase tracking-wider text-[10px] hover:bg-white/10 disabled:opacity-20 transition-all"
          >
            Previous
          </button>
          <button
            disabled={page === totalPages}
            onClick={() => {
              setPage(p => p + 1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="px-6 py-2 bg-white text-black font-bold rounded-lg uppercase tracking-wider text-[10px] hover:bg-yellow-500 transition-all disabled:opacity-20"
          >
            Next Page
          </button>
        </div>
      )}
    </div>
  );
}
