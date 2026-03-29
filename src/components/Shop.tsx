import { useState } from 'react';
import { motion } from 'motion/react';
import { PACKS } from '../constants';
import { ITEMS } from '../constants/items';
import { PackConfig, Item } from '../types';
import { cn } from '../lib/utils';
import { Coins, Package, Zap, Star, ShoppingCart, Shield, Briefcase, Heart, Sparkles, Target, Trophy, LayoutGrid } from 'lucide-react';

interface ShopProps {
  onBuyPack: (packId: string, price: number, setId?: string, type?: 'pokemon' | 'energy') => void;
  onBuyItem: (itemId: string, price: number) => void;
  coins: number;
}

type ShopTab = 'packs' | 'ball' | 'healing' | 'battle' | 'evolution' | 'material' | 'special' | 'elite';

export function Shop({ onBuyPack, onBuyItem, coins }: ShopProps) {
  const [activeTab, setActiveTab] = useState<ShopTab>('packs');

  const filteredItems = ITEMS.filter(item => item.type === activeTab);

  const tabs: { id: ShopTab; label: string; icon: any }[] = [
    { id: 'packs', label: 'Packs', icon: Package },
    { id: 'ball', label: 'Balls', icon: Target },
    { id: 'healing', label: 'Healing', icon: Heart },
    { id: 'battle', label: 'Battle', icon: Zap },
    { id: 'evolution', label: 'Evolve', icon: Sparkles },
    { id: 'material', label: 'Loot', icon: Coins },
    { id: 'special', label: 'Special', icon: Star },
    { id: 'elite', label: 'Elite', icon: Trophy },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
      {/* Shop Header */}
      <div className="p-4 bg-slate-800 border-b border-white/10 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-yellow-500" />
            POKÉMART
          </h2>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Trainer Supplies & Packs</p>
        </div>
        <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
          <Coins className="w-4 h-4 text-yellow-500" />
          <span className="text-lg font-bold text-white tracking-tight">{coins.toLocaleString()}</span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex overflow-x-auto no-scrollbar bg-slate-800/50 border-b border-white/5 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 transition-all whitespace-nowrap relative ${
              activeTab === tab.id 
                ? 'text-yellow-500' 
                : 'text-white/40 hover:text-white'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div 
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500"
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeTab === 'packs' ? (
            PACKS.map((pack) => (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white/5 rounded-xl border border-white/10 overflow-hidden hover:border-white/20 transition-all"
              >
                <div className="aspect-video relative">
                  <img 
                    src={pack.image} 
                    alt={pack.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-2 right-2 bg-yellow-500 text-black px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest">
                    {pack.type}
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="text-md font-bold mb-1 uppercase tracking-tight">{pack.name}</h3>
                  <p className="text-white/40 text-[10px] mb-4 line-clamp-2">{pack.description}</p>
                  
                  <button
                    onClick={() => onBuyPack(pack.id, pack.price, pack.setId, pack.type === 'energy' ? 'energy' : 'pokemon')}
                    disabled={coins < pack.price}
                    className={`w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-[10px] uppercase tracking-widest ${
                      coins >= pack.price
                        ? 'bg-yellow-500 text-black hover:bg-yellow-400'
                        : 'bg-white/5 text-white/20 cursor-not-allowed'
                    }`}
                  >
                    <Coins className="w-3 h-3" />
                    {pack.price.toLocaleString()}
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            filteredItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white/5 rounded-xl border border-white/10 p-4 hover:border-white/20 transition-all"
              >
                <div className="flex gap-3 mb-4">
                  <div className="w-16 h-16 bg-white/5 rounded-lg flex items-center justify-center p-2">
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold uppercase tracking-tight">{item.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[8px] font-bold uppercase tracking-widest text-white/40 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                        {item.type}
                      </span>
                      {item.healAmount && (
                        <span className="text-[8px] font-bold uppercase tracking-widest text-green-500">
                          +{item.healAmount} HP
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-white/40 text-[10px] mb-4 line-clamp-2 h-8">{item.description}</p>
                
                <button
                  onClick={() => onBuyItem(item.id, item.price)}
                  disabled={coins < item.price}
                  className={`w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-[10px] uppercase tracking-widest ${
                    coins >= item.price
                      ? 'bg-white text-black hover:bg-yellow-500'
                      : 'bg-white/5 text-white/20 cursor-not-allowed'
                  }`}
                >
                  <Coins className="w-3 h-3" />
                  {item.price.toLocaleString()}
                </button>
              </motion.div>
            ))
          )}
        </div>

        {filteredItems.length === 0 && activeTab !== 'packs' && (
          <div className="flex flex-col items-center justify-center py-16 text-white/20">
            <Package className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-[10px] font-bold uppercase tracking-widest">No items available</p>
          </div>
        )}
      </div>
    </div>
  );
}
