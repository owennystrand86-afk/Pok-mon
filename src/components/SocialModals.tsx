import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, ArrowLeftRight, Gift, TrendingUp, TrendingDown, Coins, Package, ShieldCheck, Heart, Zap, Shield } from 'lucide-react';
import { PokemonCard, InventoryItem } from '../types';
import { ITEMS } from '../constants/items';

interface InspectModalProps {
  trainerName: string;
  trainerId: string;
  onClose: () => void;
  trainerCards: PokemonCard[];
}

export function InspectModal({ trainerName, trainerCards, onClose }: InspectModalProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Inspecting {trainerName}</h3>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Viewing collection of {trainerCards.length} cards</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 no-scrollbar">
          {trainerCards.map((card, idx) => (
            <motion.div
              key={`${card.id}-${idx}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="relative group aspect-[2/3] bg-slate-800 rounded-xl overflow-hidden border border-white/5 hover:border-yellow-400/50 transition-all shadow-lg"
            >
              <img 
                src={card.images.small} 
                alt={card.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <p className="text-white font-black text-xs uppercase italic">{card.name}</p>
                <div className="flex gap-2 mt-1">
                  <div className="flex items-center gap-1 text-[8px] text-red-400 font-bold uppercase">
                    <Heart className="w-2 h-2" /> {card.hp}
                  </div>
                  {card.types?.map(type => (
                    <div key={type} className="text-[8px] text-blue-400 font-bold uppercase">{type}</div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

interface TradeModalProps {
  trainerName: string;
  trainerId: string;
  myCards: PokemonCard[];
  trainerCards: PokemonCard[];
  onClose: () => void;
  onTrade: (mySelected: PokemonCard[], theirSelected: PokemonCard[]) => void;
}

export function TradeModal({ trainerName, myCards, trainerCards, onClose, onTrade }: TradeModalProps) {
  const [mySelected, setMySelected] = useState<PokemonCard[]>([]);
  const [theirSelected, setTheirSelected] = useState<PokemonCard[]>([]);

  const calculateValue = (cards: PokemonCard[]) => {
    return cards.reduce((acc, card) => {
      const hpVal = parseInt(card.hp) || 0;
      const attackVal = card.attacks?.reduce((sum, a) => sum + (parseInt(a.damage) || 20), 0) || 0;
      const rarityVal = card.rarity === 'Rare Holo' ? 100 : card.rarity === 'Rare' ? 50 : 20;
      return acc + hpVal + attackVal + rarityVal;
    }, 0);
  };

  const myValue = calculateValue(mySelected);
  const theirValue = calculateValue(theirSelected);
  const diff = myValue - theirValue;
  const isFair = Math.abs(diff) < (Math.max(myValue, theirValue) * 0.2) || (myValue === 0 && theirValue === 0);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-2xl">
              <ArrowLeftRight className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Trading with {trainerName}</h3>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest italic">Ensure the trade is fair using the value meter</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_300px_1fr] gap-4 p-6">
          {/* My Cards */}
          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-white font-black uppercase italic text-sm tracking-widest">Your Cards</h4>
              <span className="text-blue-400 font-black text-xs italic">Value: {myValue}</span>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 pr-2 no-scrollbar">
              {myCards.map((card, idx) => {
                const isSelected = mySelected.find(c => c.id === card.id);
                return (
                  <button
                    key={`${card.id}-${idx}`}
                    onClick={() => {
                      if (isSelected) setMySelected(prev => prev.filter(c => c.id !== card.id));
                      else setMySelected(prev => [...prev, card]);
                    }}
                    className={`relative aspect-[2/3] rounded-xl overflow-hidden border-2 transition-all ${isSelected ? 'border-blue-500 scale-95 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-white/5 hover:border-white/20'}`}
                  >
                    <img src={card.images.small} alt={card.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                        <ShieldCheck className="w-8 h-8 text-white drop-shadow-lg" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Value Meter */}
          <div className="flex flex-col items-center justify-center gap-8 bg-white/5 rounded-3xl p-6 border border-white/5 self-center">
            <div className="text-center">
              <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Fairness Meter</p>
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                  <motion.circle 
                    cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="8" 
                    className={isFair ? "text-green-500" : diff > 0 ? "text-red-500" : "text-yellow-500"}
                    strokeDasharray={440}
                    animate={{ strokeDashoffset: 440 - (Math.min(Math.abs(diff) / 200, 1) * 440) }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {isFair ? (
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  ) : diff > 0 ? (
                    <TrendingDown className="w-8 h-8 text-red-500" />
                  ) : (
                    <TrendingUp className="w-8 h-8 text-yellow-500" />
                  )}
                  <span className={`text-xl font-black italic ${isFair ? 'text-green-500' : 'text-white'}`}>
                    {isFair ? 'FAIR' : Math.abs(diff)}
                  </span>
                </div>
              </div>
            </div>

            <button
              disabled={mySelected.length === 0 || theirSelected.length === 0}
              onClick={() => onTrade(mySelected, theirSelected)}
              className="w-full py-4 bg-blue-500 hover:bg-blue-400 disabled:bg-zinc-800 disabled:text-white/20 text-white font-black uppercase italic tracking-widest rounded-2xl transition-all shadow-xl active:scale-95"
            >
              Propose Trade
            </button>
          </div>

          {/* Their Cards */}
          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-white font-black uppercase italic text-sm tracking-widest">{trainerName}'s Cards</h4>
              <span className="text-yellow-400 font-black text-xs italic">Value: {theirValue}</span>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 pr-2 no-scrollbar">
              {trainerCards.map((card, idx) => {
                const isSelected = theirSelected.find(c => c.id === card.id);
                return (
                  <button
                    key={`${card.id}-${idx}`}
                    onClick={() => {
                      if (isSelected) setTheirSelected(prev => prev.filter(c => c.id !== card.id));
                      else setTheirSelected(prev => [...prev, card]);
                    }}
                    className={`relative aspect-[2/3] rounded-xl overflow-hidden border-2 transition-all ${isSelected ? 'border-yellow-500 scale-95 shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'border-white/5 hover:border-white/20'}`}
                  >
                    <img src={card.images.small} alt={card.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-yellow-500/20 flex items-center justify-center">
                        <ShieldCheck className="w-8 h-8 text-white drop-shadow-lg" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface GiftModalProps {
  trainerName: string;
  trainerId: string;
  inventory: InventoryItem[];
  collection: PokemonCard[];
  coins: number;
  onClose: () => void;
  onGift: (type: 'item' | 'card' | 'coins', amount: number, id?: string) => void;
}

export function GiftModal({ trainerName, inventory, collection, coins, onClose, onGift }: GiftModalProps) {
  const [tab, setTab] = useState<'items' | 'cards' | 'coins'>('items');
  const [coinAmount, setCoinAmount] = useState(0);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-400/20 rounded-2xl">
              <Gift className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Send Gift to {trainerName}</h3>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest italic">Spread the joy of being a trainer</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="flex border-b border-white/5">
          {[
            { id: 'items', icon: Package, label: 'Items' },
            { id: 'cards', icon: Shield, label: 'Cards' },
            { id: 'coins', icon: Coins, label: 'Coins' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex-1 py-4 flex items-center justify-center gap-2 font-black uppercase italic text-xs tracking-widest transition-all ${tab === t.id ? 'bg-white/10 text-yellow-400' : 'text-white/40 hover:text-white/60'}`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          {tab === 'items' && (
            <div className="grid grid-cols-2 gap-3">
              {inventory.map((invItem, idx) => {
                const item = ITEMS.find(i => i.id === invItem.itemId);
                if (!item) return null;
                return (
                  <button
                    key={`${invItem.itemId}-${idx}`}
                    onClick={() => onGift('item', 1, invItem.itemId)}
                    className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-yellow-400/50 transition-all flex items-center gap-4 group"
                  >
                    <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                      <img src={item.image} alt={item.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-black uppercase italic text-xs">{item.name}</p>
                      <p className="text-white/40 text-[8px] font-bold uppercase">Owned: {invItem.count}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'cards' && (
            <div className="grid grid-cols-3 gap-3">
              {collection.map((card, idx) => (
                <button
                  key={`${card.id}-${idx}`}
                  onClick={() => onGift('card', 1, card.id)}
                  className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/5 hover:border-yellow-400/50 transition-all group"
                >
                  <img src={card.images.small} alt={card.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Gift className="w-8 h-8 text-yellow-400" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {tab === 'coins' && (
            <div className="flex flex-col items-center justify-center py-12 gap-8">
              <div className="text-center">
                <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Available Coins</p>
                <div className="flex items-center gap-3 text-4xl font-black text-yellow-400 italic">
                  <Coins className="w-10 h-10" />
                  {coins}
                </div>
              </div>

              <div className="flex flex-col gap-4 w-full max-w-xs">
                <input 
                  type="range" 
                  min="0" 
                  max={coins} 
                  value={coinAmount}
                  onChange={(e) => setCoinAmount(parseInt(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                />
                <div className="flex justify-between text-[10px] font-black text-white/40 uppercase tracking-widest">
                  <span>0</span>
                  <span className="text-yellow-400 text-lg">{coinAmount}</span>
                  <span>{coins}</span>
                </div>
                <button
                  disabled={coinAmount <= 0}
                  onClick={() => onGift('coins', coinAmount)}
                  className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 disabled:bg-zinc-800 disabled:text-white/20 text-black font-black uppercase italic tracking-widest rounded-2xl transition-all shadow-xl active:scale-95"
                >
                  Send Coins
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
