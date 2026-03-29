import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Gift, Coins, Package, CheckCircle2 } from 'lucide-react';
import { PokemonCard, InventoryItem } from '../types';
import { ITEMS } from '../constants/items';

interface GiftModalProps {
  currentUser: {
    collection: PokemonCard[];
    inventory: InventoryItem[];
    coins: number;
  };
  targetUser: {
    displayName: string;
  };
  onClose: () => void;
  onGift: (gift: { cards: PokemonCard[], items: InventoryItem[], coins: number }) => void;
}

export function GiftModal({ currentUser, targetUser, onClose, onGift }: GiftModalProps) {
  const [selectedCards, setSelectedCards] = useState<PokemonCard[]>([]);
  const [selectedItems, setSelectedItems] = useState<InventoryItem[]>([]);
  const [giftCoins, setGiftCoins] = useState(0);

  const handleToggleCard = (card: PokemonCard) => {
    if (selectedCards.find(c => c.id === card.id)) {
      setSelectedCards(prev => prev.filter(c => c.id !== card.id));
    } else {
      setSelectedCards(prev => [...prev, card]);
    }
  };

  const handleGift = () => {
    onGift({ cards: selectedCards, items: selectedItems, coins: giftCoins });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-xl overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Gift className="w-6 h-6 text-pink-400" />
            <h3 className="text-xl font-black text-white">Send a Gift</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <p className="text-sm text-white/60">Choose what you'd like to give to <span className="text-white font-bold">{targetUser.displayName}</span>.</p>

          {/* Coins */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Coins</label>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
              <Coins className="w-6 h-6 text-yellow-400" />
              <input 
                type="number"
                value={giftCoins}
                onChange={(e) => setGiftCoins(Math.min(currentUser.coins, Math.max(0, parseInt(e.target.value) || 0)))}
                className="bg-transparent border-none text-xl font-black text-white focus:ring-0 flex-1"
              />
              <span className="text-xs font-bold text-white/20">/ {currentUser.coins}</span>
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Pokémon Cards</label>
            <div className="grid grid-cols-4 gap-2">
              {currentUser.collection.map(card => (
                <div 
                  key={card.id}
                  onClick={() => handleToggleCard(card)}
                  className={`aspect-[2/3] relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${selectedCards.find(c => c.id === card.id) ? 'border-pink-500 scale-95' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <img src={card.images.small} alt={card.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  {selectedCards.find(c => c.id === card.id) && (
                    <div className="absolute inset-0 bg-pink-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-pink-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 bg-white/5">
          <button
            onClick={handleGift}
            disabled={giftCoins === 0 && selectedCards.length === 0}
            className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-sm shadow-[0_10px_30px_rgba(236,72,153,0.3)]"
          >
            Confirm Gift
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
