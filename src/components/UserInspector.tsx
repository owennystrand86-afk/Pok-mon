import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Trophy, Coins, BookOpen, ExternalLink, Sparkles, Gift, ArrowLeftRight } from 'lucide-react';
import { PokemonCard, InventoryItem } from '../types';
import { GiftModal } from './GiftModal';

interface UserInspectorProps {
  currentUser: {
    uid: string;
    displayName: string;
    collection: PokemonCard[];
    inventory: InventoryItem[];
    coins: number;
  } | null;
  user: {
    id: string;
    displayName: string;
    photoURL?: string;
    wins: number;
    losses: number;
    coins: number;
    collection: PokemonCard[];
    cardsCollected: number;
  };
  onClose: () => void;
  onTrade: () => void;
  onGift: (gift: any) => void;
}

export function UserInspector({ currentUser, user, onClose, onTrade, onGift }: UserInspectorProps) {
  const [showGiftModal, setShowGiftModal] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center shadow-lg">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-white/20" />
              )}
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">{user.displayName}</h3>
              <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Trainer Profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-white/5">
          <div className="bg-slate-900 p-4 flex flex-col items-center justify-center gap-1">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-xl font-black text-white">{user.wins}</span>
            <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Wins</span>
          </div>
          <div className="bg-slate-900 p-4 flex flex-col items-center justify-center gap-1 border-x border-white/5">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className="text-xl font-black text-white">{user.coins}</span>
            <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Coins</span>
          </div>
          <div className="bg-slate-900 p-4 flex flex-col items-center justify-center gap-1">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <span className="text-xl font-black text-white">{user.cardsCollected}</span>
            <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Cards</span>
          </div>
        </div>

        {/* Collection Preview */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              Featured Collection
            </h4>
            <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Showing top {user.collection.length} cards</span>
          </div>

          <div className="flex overflow-x-auto gap-4 pb-6 snap-x custom-scrollbar">
            {user.collection.map((card, idx) => (
              <motion.div
                key={`${card.id}-${idx}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.02 }}
                className="flex-shrink-0 w-32 aspect-[2/3] relative group cursor-pointer snap-center"
              >
                <img
                  src={card.images.small}
                  alt={card.name}
                  className="w-full h-full object-contain rounded-lg shadow-lg group-hover:scale-110 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                  <span className="text-[10px] font-black text-white uppercase text-center px-2">{card.name}</span>
                </div>
              </motion.div>
            ))}
            {user.collection.length === 0 && (
              <div className="w-full py-12 text-center text-white/20 uppercase tracking-widest font-bold text-xs">
                No cards in featured collection
              </div>
            )}
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-6 border-t border-white/10 bg-white/5 flex gap-4">
          <button 
            onClick={onTrade}
            className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-black py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Send Trade Request
          </button>
          <button 
            onClick={() => setShowGiftModal(true)}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-black py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
          >
            <Gift className="w-4 h-4 text-pink-400" />
            Gift Item
          </button>
        </div>

        <AnimatePresence>
          {showGiftModal && currentUser && (
            <GiftModal
              currentUser={currentUser}
              targetUser={{ displayName: user.displayName }}
              onClose={() => setShowGiftModal(false)}
              onGift={onGift}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
