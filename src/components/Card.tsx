import { motion } from 'motion/react';
import { PokemonCard } from '../types';
import { cn } from '../lib/utils';

interface CardProps {
  card: PokemonCard;
  className?: string;
  isRevealed?: boolean;
  onClick?: () => void;
}

export function Card({ card, className, isRevealed = true, onClick }: CardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, rotateY: isRevealed ? 0 : 180 }}
      animate={{ opacity: 1, rotateY: isRevealed ? 0 : 180 }}
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
      className={cn(
        "relative w-64 h-96 cursor-pointer group preserve-3d",
        className
      )}
      onClick={onClick}
    >
      <div className="w-full h-full relative rounded-xl overflow-hidden shadow-2xl border border-white/10 backface-hidden">
        {isRevealed ? (
          <>
            <img
              src={card.images.large}
              alt={card.name}
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
            
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full">
                <span className="text-white text-[10px] font-bold uppercase tracking-widest">View Details</span>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full bg-[#1e40af] flex flex-col items-center justify-center p-4 text-center border-[12px] border-[#3b82f6] rounded-xl relative overflow-hidden">
            {/* Swirl Effect */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_transparent_0%,_#000_100%)]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] border-[40px] border-white/10 rounded-full animate-spin-slow" />
            </div>
            
            {/* Pokéball Center */}
            <div className="relative z-10 w-32 h-32 rounded-full border-8 border-black flex flex-col overflow-hidden shadow-2xl">
              <div className="h-1/2 bg-[#ef4444]" />
              <div className="h-1/2 bg-white" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full border-8 border-black z-20" />
              <div className="absolute top-1/2 left-0 right-0 h-4 bg-black -translate-y-1/2 z-10" />
            </div>

            <div className="relative z-10 mt-6">
              <div className="text-white font-black italic text-4xl tracking-tighter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
                POKÉMON
              </div>
              <div className="text-yellow-400 font-bold text-[10px] uppercase tracking-[0.3em] drop-shadow-md mt-1">
                TRADING CARD GAME
              </div>
            </div>

            {/* Corner Details */}
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white/20" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white/20" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
