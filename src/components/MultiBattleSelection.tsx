import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PokemonCard } from '../types';
import { Sword, X, Check, Shield, Zap, Heart } from 'lucide-react';
import { cn } from '../lib/utils';

interface MultiBattleSelectionProps {
  collection: PokemonCard[];
  onStart: (team: PokemonCard[]) => void;
  onBack: () => void;
}

export function MultiBattleSelection({ collection, onStart, onBack }: MultiBattleSelectionProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(i => i !== id));
    } else if (selectedIds.length < 5) {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const selectedTeam = selectedIds.map(id => collection.find(c => c.id === id)!);

  return (
    <div className="min-h-screen py-16 px-8 relative overflow-hidden bg-[#050505]">
      {/* Cinematic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(250,204,21,0.1),transparent_70%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-yellow-500/5 rounded-full blur-[150px]" />
        <div className="absolute inset-0 opacity-10 cyber-grid pointer-events-none" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-16">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-12">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
              <Zap className="w-3 h-3 text-yellow-400 animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-[0.4em] text-yellow-400">Strategic Deployment Phase</span>
            </div>
            <h1 className="text-7xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-yellow-200 to-slate-500">
              Team <span className="text-yellow-400">Formation</span>
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px] max-w-md leading-relaxed">
              Assemble your elite squad of 5 Pokémon to dominate the Multiple Battle Arena. Choose wisely, Trainer.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <button 
              onClick={onBack}
              className="group flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all backdrop-blur-md"
            >
              <X className="w-4 h-4 text-white/40 group-hover:text-red-500 transition-colors" />
              <span className="text-xs font-black uppercase tracking-widest text-white/40 group-hover:text-white">Abort</span>
            </button>
            <button 
              disabled={selectedIds.length !== 5}
              onClick={() => onStart(selectedTeam)}
              className="group relative px-12 py-5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:grayscale text-black font-black uppercase italic tracking-tighter rounded-2xl shadow-[0_0_40px_rgba(250,204,21,0.4)] transition-all flex items-center gap-4 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <Sword className="w-6 h-6" />
              <span className="text-lg">Enter Arena</span>
            </button>
          </div>
        </div>

        {/* Selected Team Visualizer */}
        <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/5 p-12 rounded-[48px] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Shield className="w-32 h-32 text-yellow-400" />
          </div>
          
          <div className="flex flex-wrap justify-center gap-8">
            {[...Array(5)].map((_, i) => {
              const card = selectedTeam[i];
              return (
                <div key={i} className="relative group">
                  <motion.div 
                    initial={false}
                    animate={card ? { scale: 1, rotateY: 0 } : { scale: 0.95 }}
                    className={cn(
                      "w-32 h-44 rounded-3xl border-2 transition-all flex items-center justify-center overflow-hidden relative",
                      card 
                        ? "border-yellow-400 bg-slate-800 shadow-[0_0_30px_rgba(250,204,21,0.2)]" 
                        : "border-white/5 bg-white/5 border-dashed"
                    )}
                  >
                    {card ? (
                      <>
                        <img 
                          src={card.images.small} 
                          alt={card.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-0 right-0 text-center">
                          <span className="text-[8px] font-black uppercase tracking-widest text-white/80">{card.name}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 opacity-20">
                        <div className="text-4xl font-black italic">0{i + 1}</div>
                        <span className="text-[8px] font-black uppercase tracking-widest">Empty Slot</span>
                      </div>
                    )}
                  </motion.div>
                  {card && (
                    <button 
                      onClick={() => toggleSelect(card.id)}
                      className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center shadow-xl hover:scale-110 active:scale-90 transition-all z-20 border-2 border-white/20"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Collection Grid Section */}
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">Available Combatants</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
            {collection.map((card, i) => {
              const isSelected = selectedIds.includes(card.id);
              const canSelect = selectedIds.length < 5 || isSelected;

              return (
                <motion.button
                  key={`${card.id}-${i}`}
                  whileHover={canSelect ? { y: -12, scale: 1.02 } : {}}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleSelect(card.id)}
                  disabled={!canSelect}
                  className={cn(
                    "relative group aspect-[3/4] rounded-[32px] overflow-hidden border-2 transition-all duration-500",
                    isSelected 
                      ? "border-yellow-400 ring-8 ring-yellow-400/10" 
                      : "border-white/5 hover:border-white/20 bg-slate-900",
                    !canSelect && "opacity-30 cursor-not-allowed grayscale"
                  )}
                >
                  <img 
                    src={card.images.small} 
                    alt={card.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Overlay Info */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
                  
                  {isSelected && (
                    <div className="absolute inset-0 bg-yellow-400/10 backdrop-blur-[2px] flex items-center justify-center">
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(250,204,21,0.6)]"
                      >
                        <Check className="w-8 h-8 text-black stroke-[3px]" />
                      </motion.div>
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                    <div className="text-sm font-black uppercase italic tracking-tight text-white mb-2">{card.name}</div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Heart className="w-3 h-3 text-red-500 fill-red-500/20" />
                        <span className="text-[10px] font-black text-white/80">{card.hp}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Sword className="w-3 h-3 text-blue-400 fill-blue-400/20" />
                        <span className="text-[10px] font-black text-white/80">{card.attacks?.[0]?.damage || '0'}</span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
