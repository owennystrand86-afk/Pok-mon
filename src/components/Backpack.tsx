import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem, Item, PokemonCard } from '../types';
import { ITEMS } from '../constants/items';
import { Package, X } from 'lucide-react';

interface BackpackProps {
  inventory: InventoryItem[];
  collection: PokemonCard[];
  onUseItem: (itemId: string, pokemonId?: string) => void;
  onClose: () => void;
}

export function Backpack({ inventory, collection, onUseItem, onClose }: BackpackProps) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const getItemDetails = (itemId: string): Item | undefined => {
    return ITEMS.find(i => i.id === itemId);
  };

  const handleUseItem = (itemId: string, pokemonId?: string) => {
    onUseItem(itemId, pokemonId);
    setSelectedItem(null);
  };

  const usableTypes = ['healing', 'evolution', 'special', 'elite', 'battle'];

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white/5 border border-white/10 rounded-3xl shadow-2xl min-h-[70vh] flex flex-col relative">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
            <Package className="w-8 h-8 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-3xl font-bold uppercase tracking-tight text-white">Backpack</h2>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Your items and materials</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/5 rounded-full transition-all text-white/40 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto no-scrollbar flex-1 p-2">
        {inventory.length === 0 ? (
          <div className="col-span-full py-32 text-center flex flex-col items-center justify-center opacity-20">
            <Package className="w-16 h-16 mb-4" />
            <p className="text-xl font-bold uppercase tracking-widest">Empty Backpack</p>
          </div>
        ) : (
          inventory.map((invItem) => {
            const item = getItemDetails(invItem.itemId);
            if (!item) return null;

            const isUsable = usableTypes.includes(item.type);

            return (
              <motion.div
                key={invItem.itemId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col items-center text-center gap-3 relative group hover:border-yellow-500/30 transition-all"
              >
                <div className="absolute top-2 right-2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-lg z-10">
                  x{invItem.count}
                </div>
                <div className="w-20 h-20 bg-white/5 rounded-xl flex items-center justify-center p-4">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-contain group-hover:scale-110 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-tight text-white group-hover:text-yellow-500 transition-colors">{item.name}</h3>
                  <p className="text-[9px] text-white/40 leading-tight line-clamp-2 min-h-[1.5rem]">{item.description}</p>
                </div>
                
                {isUsable && (
                  <button
                    onClick={() => setSelectedItem(item)}
                    className="mt-2 w-full py-2 bg-yellow-500 text-black text-[10px] font-bold uppercase rounded-lg hover:bg-yellow-400 transition-all active:scale-95"
                  >
                    Use Item
                  </button>
                )}

                <div className="mt-auto pt-2 w-full">
                  <span className="text-[8px] uppercase tracking-widest font-bold text-white/20 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                    {item.type}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Item Usage Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 p-8 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] relative"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center p-4 border border-white/10">
                    <img src={selectedItem.image} alt={selectedItem.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold uppercase tracking-tight text-white">Use {selectedItem.name}</h2>
                    <p className="text-white/40 text-[10px] font-bold tracking-widest uppercase mt-1">{selectedItem.description}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="p-2 hover:bg-white/5 rounded-full transition-all text-white/40 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-2">
                {collection.length === 0 ? (
                  <div className="col-span-full py-32 text-center opacity-20">
                    <p className="text-xl font-bold uppercase tracking-widest">No Pokémon Available</p>
                  </div>
                ) : (
                  collection.map((pokemon, idx) => (
                    <button
                      key={`${pokemon.id}-${idx}`}
                      onClick={() => handleUseItem(selectedItem.id, pokemon.id)}
                      className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col items-center text-center gap-3 hover:bg-white/10 hover:border-yellow-500/30 transition-all group"
                    >
                      <img 
                        src={pokemon.images.small} 
                        alt={pokemon.name} 
                        className="w-24 h-32 object-cover rounded-xl group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold uppercase tracking-tight text-white group-hover:text-yellow-500 transition-colors">{pokemon.name}</h3>
                        <div className="flex flex-wrap justify-center gap-1">
                          {pokemon.boosts && Object.entries(pokemon.boosts).map(([stat, val]) => (
                            <span key={stat} className="text-[7px] font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-md uppercase border border-blue-500/10">
                              {stat}: +{val}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
