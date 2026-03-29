import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowLeftRight, Coins, Package, Sparkles, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { PokemonCard, InventoryItem } from '../types';
import { ITEMS } from '../constants/items';

interface TradeSide {
  uid: string;
  displayName: string;
  cards: PokemonCard[];
  items: { itemId: string; count: number }[];
  coins: number;
  accepted: boolean;
}

interface TradeSystemProps {
  currentUser: {
    uid: string;
    displayName: string;
    collection: PokemonCard[];
    inventory: { itemId: string; count: number }[];
    coins: number;
  };
  otherUser: {
    uid: string;
    displayName: string;
  };
  onClose: () => void;
  onComplete: (trade: { p1: TradeSide; p2: TradeSide }) => void;
}

export function TradeSystem({ currentUser, otherUser, onClose, onComplete }: TradeSystemProps) {
  const [myOffer, setMyOffer] = useState<Omit<TradeSide, 'uid' | 'displayName' | 'accepted'>>({
    cards: [],
    items: [],
    coins: 0
  });
  
  const [otherOffer, setOtherOffer] = useState<Omit<TradeSide, 'uid' | 'displayName' | 'accepted'>>({
    cards: [],
    items: [],
    coins: 0
  });

  const [isAccepted, setIsAccepted] = useState(false);
  const [otherAccepted, setOtherAccepted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate "Value" for the meter
  // This is a simplified heuristic: Rarity + HP + Attack Power
  const calculateValue = (offer: typeof myOffer) => {
    let value = offer.coins;
    offer.cards.forEach(card => {
      const rarityMultiplier = card.rarity?.toLowerCase().includes('rare') ? 500 : 100;
      const hpValue = parseInt(card.hp) || 50;
      value += rarityMultiplier + hpValue;
    });
    offer.items.forEach(item => {
      const itemDef = ITEMS.find(i => i.id === item.itemId);
      value += (itemDef?.price || 50) * item.count;
    });
    return value;
  };

  const myValue = calculateValue(myOffer);
  const otherValue = calculateValue(otherOffer);
  const valueDiff = Math.abs(myValue - otherValue);
  const maxValue = Math.max(myValue, otherValue, 1);
  const fairness = 1 - (valueDiff / maxValue);

  const handleAddCard = (card: PokemonCard) => {
    if (myOffer.cards.find(c => c.id === card.id)) return;
    setMyOffer(prev => ({ ...prev, cards: [...prev.cards, card] }));
    setIsAccepted(false);
  };

  const handleRemoveCard = (cardId: string) => {
    setMyOffer(prev => ({ ...prev, cards: prev.cards.filter(c => c.id !== cardId) }));
    setIsAccepted(false);
  };

  const handleAddItem = (itemId: string) => {
    const existing = myOffer.items.find(i => i.itemId === itemId);
    const inventoryItem = currentUser.inventory.find(i => i.itemId === itemId);
    if (!inventoryItem) return;

    if (existing) {
      if (existing.count < inventoryItem.count) {
        setMyOffer(prev => ({
          ...prev,
          items: prev.items.map(i => i.itemId === itemId ? { ...i, count: i.count + 1 } : i)
        }));
      }
    } else {
      setMyOffer(prev => ({
        ...prev,
        items: [...prev.items, { itemId, count: 1 }]
      }));
    }
    setIsAccepted(false);
  };

  const handleRemoveItem = (itemId: string) => {
    setMyOffer(prev => ({
      ...prev,
      items: prev.items.map(i => i.itemId === itemId ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0)
    }));
    setIsAccepted(false);
  };

  const handleConfirm = () => {
    setIsAccepted(true);
    // In a real app, this would update Firestore
    // For now, we'll simulate the other user accepting after a delay
    setTimeout(() => {
      setOtherAccepted(true);
    }, 2000);
  };

  useEffect(() => {
    if (isAccepted && otherAccepted) {
      setIsProcessing(true);
      setTimeout(() => {
        onComplete({
          p1: { ...myOffer, uid: currentUser.uid, displayName: currentUser.displayName, accepted: true },
          p2: { ...otherOffer, uid: otherUser.uid, displayName: otherUser.displayName, accepted: true }
        });
      }, 2000);
    }
  }, [isAccepted, otherAccepted]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
    >
      <div className="bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.3)]">
              <ArrowLeftRight className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">Secure Trade</h2>
              <p className="text-xs text-white/40 uppercase tracking-[0.2em] font-bold">Trading with {otherUser.displayName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white">
            <X className="w-8 h-8" />
          </button>
        </div>

        {/* Value Meter */}
        <div className="px-8 py-4 bg-black/20 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Trade Fairness Meter</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${fairness > 0.8 ? 'text-green-400' : fairness > 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
              {fairness > 0.8 ? 'Fair Trade' : fairness > 0.5 ? 'Slightly Unbalanced' : 'Highly Unfair'}
            </span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden flex">
            <motion.div 
              animate={{ width: `${(myValue / (myValue + otherValue || 1)) * 100}%` }}
              className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
            />
            <motion.div 
              animate={{ width: `${(otherValue / (myValue + otherValue || 1)) * 100}%` }}
              className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" 
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">Your Value: {myValue}</span>
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-tighter">{otherUser.displayName}'s Value: {otherValue}</span>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Side: Your Inventory */}
          <div className="w-1/3 border-r border-white/10 flex flex-col bg-white/[0.02]">
            <div className="p-6 border-b border-white/5">
              <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-400" />
                Your Collection
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Cards</h4>
                <div className="grid grid-cols-2 gap-3">
                  {currentUser.collection.map(card => (
                    <motion.div
                      key={card.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleAddCard(card)}
                      className={`aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${myOffer.cards.find(c => c.id === card.id) ? 'border-blue-500 opacity-50 grayscale' : 'border-white/10 hover:border-white/30'}`}
                    >
                      <img src={card.images.small} alt={card.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Items</h4>
                <div className="grid grid-cols-2 gap-3">
                  {currentUser.inventory.map(invItem => {
                    const itemDef = ITEMS.find(i => i.id === invItem.itemId);
                    if (!itemDef) return null;
                    const offerCount = myOffer.items.find(i => i.itemId === invItem.itemId)?.count || 0;
                    return (
                      <motion.div
                        key={invItem.itemId}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAddItem(invItem.itemId)}
                        className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center gap-1 ${offerCount >= invItem.count ? 'border-blue-500 opacity-50 grayscale' : 'border-white/10 hover:border-white/30 bg-white/5'}`}
                      >
                        <img src={itemDef.image} alt={itemDef.name} className="w-8 h-8 object-contain" />
                        <span className="text-[10px] font-bold text-white text-center leading-tight">{itemDef.name}</span>
                        <span className="text-[8px] font-black text-yellow-500 uppercase">x{invItem.count - offerCount}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Middle: The Trade Table */}
          <div className="flex-1 flex flex-col p-8 gap-8 bg-black/40">
            <div className="flex-1 grid grid-cols-2 gap-8">
              {/* Your Offer */}
              <div className={`rounded-3xl border-2 p-6 flex flex-col gap-4 transition-all ${isAccepted ? 'border-green-500 bg-green-500/5 shadow-[0_0_30px_rgba(74,222,128,0.1)]' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">Your Offer</h4>
                  {isAccepted && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                </div>
                <div className="flex-1 overflow-y-auto flex flex-col gap-2 custom-scrollbar">
                  <div className="grid grid-cols-2 gap-2">
                    {myOffer.cards.map(card => (
                      <div key={card.id} className="relative group aspect-[2/3]">
                        <img src={card.images.small} alt={card.name} className="w-full h-full object-contain rounded-lg" referrerPolicy="no-referrer" />
                        <button 
                          onClick={() => handleRemoveCard(card.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {myOffer.items.map(item => {
                      const itemDef = ITEMS.find(i => i.id === item.itemId);
                      if (!itemDef) return null;
                      return (
                        <div key={item.itemId} className="relative group p-2 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center">
                          <img src={itemDef.image} alt={itemDef.name} className="w-6 h-6 object-contain" />
                          <span className="text-[8px] font-black text-yellow-500">x{item.count}</span>
                          <button 
                            onClick={() => handleRemoveItem(item.itemId)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {myOffer.cards.length === 0 && myOffer.items.length === 0 && (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/10 rounded-2xl text-[10px] font-bold text-white/20 uppercase tracking-widest text-center px-4 py-8">
                      Select cards or items from your collection
                    </div>
                  )}
                </div>
                <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <Coins className="w-4 h-4 text-yellow-400" />
                     <input 
                       type="number" 
                       value={myOffer.coins}
                       onChange={(e) => setMyOffer(prev => ({ ...prev, coins: Math.min(currentUser.coins, parseInt(e.target.value) || 0) }))}
                       className="bg-transparent border-none text-white font-black w-20 focus:ring-0 p-0"
                     />
                   </div>
                   <span className="text-[10px] text-white/20 font-bold uppercase">Max: {currentUser.coins}</span>
                </div>
              </div>

              {/* Other Offer */}
              <div className={`rounded-3xl border-2 p-6 flex flex-col gap-4 transition-all ${otherAccepted ? 'border-green-500 bg-green-500/5 shadow-[0_0_30px_rgba(74,222,128,0.1)]' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">{otherUser.displayName}'s Offer</h4>
                  {otherAccepted && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                </div>
                <div className="flex-1 overflow-y-auto flex flex-col gap-2 custom-scrollbar">
                  <div className="grid grid-cols-2 gap-2">
                    {otherOffer.cards.map(card => (
                      <div key={card.id} className="aspect-[2/3]">
                        <img src={card.images.small} alt={card.name} className="w-full h-full object-contain rounded-lg" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {otherOffer.items.map(item => {
                      const itemDef = ITEMS.find(i => i.id === item.itemId);
                      if (!itemDef) return null;
                      return (
                        <div key={item.itemId} className="p-2 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center">
                          <img src={itemDef.image} alt={itemDef.name} className="w-6 h-6 object-contain" />
                          <span className="text-[8px] font-black text-yellow-500">x{item.count}</span>
                        </div>
                      );
                    })}
                  </div>
                  {otherOffer.cards.length === 0 && otherOffer.items.length === 0 && (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/10 rounded-2xl text-[10px] font-bold text-white/20 uppercase tracking-widest text-center px-4 py-8">
                      Waiting for {otherUser.displayName} to add items...
                    </div>
                  )}
                </div>
                <div className="pt-4 border-t border-white/10 flex items-center gap-2">
                   <Coins className="w-4 h-4 text-yellow-400" />
                   <span className="text-white font-black">{otherOffer.coins}</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex gap-4">
              <button
                disabled={isAccepted || isProcessing}
                onClick={handleConfirm}
                className={`flex-1 py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all active:scale-95 flex items-center justify-center gap-3 ${isAccepted ? 'bg-green-500/20 text-green-400 cursor-default' : 'bg-yellow-400 hover:bg-yellow-500 text-black shadow-[0_10px_30px_rgba(250,204,21,0.2)]'}`}
              >
                {isAccepted ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Waiting for {otherUser.displayName}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Accept Trade
                  </>
                )}
              </button>
              <button 
                onClick={onClose}
                className="px-8 bg-white/10 hover:bg-white/20 text-white font-black rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[120] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center gap-6"
          >
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-32 h-32 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full"
              />
              <Sparkles className="w-12 h-12 text-yellow-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <div className="text-center">
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Finalizing Trade</h3>
              <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Synchronizing with Global Trade Network...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
