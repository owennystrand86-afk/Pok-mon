import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence, useSpring, animate } from 'motion/react';
import { PokemonCard } from '../types';
import { cn } from '../lib/utils';
import { Card } from './Card';
import confetti from 'canvas-confetti';
import { Rotate3d, Move, FlipHorizontal, X, Zap, Sparkles } from 'lucide-react';

interface PackProps {
  onOpen: (cards: PokemonCard[]) => void;
  cards: PokemonCard[];
}

export function Pack({ onOpen, cards }: PackProps) {
  const [isRipped, setIsRipped] = useState(false);
  const [revealedCards, setRevealedCards] = useState<PokemonCard[]>([]);
  const [remainingCards, setRemainingCards] = useState<PokemonCard[]>([...cards]);
  const [currentRevealingCard, setCurrentRevealingCard] = useState<PokemonCard | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isPeeking, setIsPeeking] = useState(false);
  
  const [selectedCard, setSelectedCard] = useState<PokemonCard | null>(null);

  // Pack Rip Animation
  const ripY = useMotionValue(0);
  const ripOpacity = useTransform(ripY, [-100, 0], [0, 1]);
  const ripRotate = useTransform(ripY, [-100, 0], [-10, 0]);

  // Stack Rotation
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const rotateX = useSpring(useTransform(mouseY, [-300, 300], isPeeking ? [0, 0] : [15, -15]), { stiffness: 100, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-300, 300], isPeeking ? [-90, -90] : [-15, 15]), { stiffness: 100, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = clientX - (rect.left + rect.width / 2);
    const y = clientY - (rect.top + rect.height / 2);
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleRip = async () => {
    if (isRipped) return;
    
    // Animate the rip
    await animate(ripY, -100, { duration: 0.5, ease: "easeIn" });
    
    setIsRipped(true);
    
    // Ripple effect
    const ripple = document.createElement('div');
    ripple.className = 'absolute inset-0 z-50 pointer-events-none bg-white/20 rounded-full animate-ping';
    document.getElementById('rip-container')?.appendChild(ripple);
    setTimeout(() => ripple.remove(), 1000);

    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#ffffff', '#ef4444']
    });
  };

  const revealNextCard = () => {
    if (isRevealing || remainingCards.length === 0) return;
    
    // Auto-disable peeking when revealing
    if (isPeeking) setIsPeeking(false);

    const card = remainingCards[remainingCards.length - 1];
    setIsRevealing(true);
    setCurrentRevealingCard(card);

    // Animation sequence:
    // 1. Card slides out from stack
    // 2. Card flips
    // 3. Card moves to revealed area
    setTimeout(() => {
      setRevealedCards(prev => [card, ...prev]);
      setRemainingCards(prev => prev.slice(0, -1));
      setCurrentRevealingCard(null);
      setIsRevealing(false);
    }, 400); // Super snappy reveal
  };

  const revealAll = () => {
    if (isRevealing || remainingCards.length === 0) return;
    setIsRevealing(true);
    
    // Reveal all remaining cards with a staggered delay
    const cardsToReveal = [...remainingCards].reverse();
    cardsToReveal.forEach((card, i) => {
      setTimeout(() => {
        setRevealedCards(prev => [card, ...prev]);
        setRemainingCards(prev => prev.slice(0, -1));
        if (i === cardsToReveal.length - 1) {
          setIsRevealing(false);
        }
      }, i * 150);
    });
  };

  const getRarityColor = (rarity?: string) => {
    if (!rarity) return 'bg-white/10';
    const r = rarity.toLowerCase();
    if (r.includes('ultra') || r.includes('secret') || r.includes('vmax') || r.includes('vstar')) return 'bg-yellow-400/50';
    if (r.includes('rare')) return 'bg-blue-400/30';
    return 'bg-white/10';
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-[200] p-4 overflow-hidden" onMouseMove={handleMouseMove} onTouchMove={handleMouseMove}>
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <div className="relative z-10 w-full max-w-6xl flex flex-col items-center gap-12">
        <AnimatePresence mode="wait">
          {!isRipped ? (
            <motion.div
              key="pack-closed"
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="relative group cursor-pointer"
              onClick={handleRip}
              id="rip-container"
            >
              {/* Tear Lines Visual Effect */}
              <div className="absolute -top-8 left-0 right-0 h-16 pointer-events-none z-30 flex justify-around overflow-hidden">
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      height: [0, 20, 0],
                      opacity: [0, 1, 0],
                      y: [0, -10, 0]
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 1.5, 
                      delay: i * 0.2,
                      ease: "easeInOut"
                    }}
                    className="w-[1px] bg-white/30 blur-[1px]"
                  />
                ))}
              </div>

              {/* Pack Top Part */}
              <motion.div 
                style={{ y: ripY, rotate: ripRotate, opacity: ripOpacity }}
                className="absolute -top-4 left-0 right-0 h-12 bg-blue-700 rounded-t-2xl border-x-4 border-t-4 border-white z-20 flex items-center justify-center"
              >
                <div className="w-12 h-1 bg-white/30 rounded-full" />
              </motion.div>

              {/* Main Pack Body */}
              <div className="w-64 aspect-[3/4] bg-blue-600 rounded-xl border-4 border-white shadow-[0_0_50px_rgba(59,130,246,0.3)] overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-800 flex flex-col items-center justify-center p-6 text-center">
                  <motion.div 
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="text-white font-black italic text-4xl tracking-tighter mb-2 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]"
                  >
                    POKÉMON
                  </motion.div>
                  <div className="text-yellow-400 font-bold text-xs uppercase tracking-widest drop-shadow-md">
                    TRADING CARD GAME
                  </div>
                  
                  <div className="mt-8 flex flex-col items-center gap-2">
                    <Zap className="w-8 h-8 text-yellow-400 animate-pulse" />
                    <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Click to Rip</span>
                  </div>
                </div>
                
                {/* Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </div>

              {/* Shadow */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-48 h-4 bg-black/40 blur-xl rounded-full" />
            </motion.div>
          ) : (
            <div className="w-full flex flex-col lg:flex-row items-center justify-center gap-12">
              {/* Card Stack (The Pile) */}
              <div className="relative perspective-1000">
                <motion.div
                  style={{ rotateX, rotateY }}
                  whileTap={{ scale: 0.98 }}
                  className="relative w-64 h-96 preserve-3d cursor-pointer active:scale-95 transition-transform"
                  onClick={revealNextCard}
                >
                  <AnimatePresence>
                    {remainingCards.map((card, i) => (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ 
                          opacity: 1, 
                          y: -i * 2, 
                          x: i * 0.5,
                          z: -i * 2,
                          scale: 1
                        }}
                        exit={{ 
                          x: 500, 
                          y: -150, 
                          rotate: 60, 
                          opacity: 0,
                          scale: 0.5,
                          transition: { duration: 0.5, ease: "easeIn" }
                        }}
                        className={cn(
                          "absolute inset-0 rounded-xl border-2 border-white/20 shadow-2xl overflow-hidden",
                          getRarityColor(card.rarity)
                        )}
                        style={{ zIndex: remainingCards.length - i }}
                      >
                        {/* Card Back */}
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
                              TCG
                            </div>
                          </div>
                        </div>
                        
                        {/* Rarity Glow for "Good" cards */}
                        {(card.rarity?.toLowerCase().includes('rare') || card.rarity?.toLowerCase().includes('v')) && (
                          <div className="absolute inset-0 bg-gradient-to-tr from-yellow-400/0 via-yellow-400/10 to-transparent animate-pulse" />
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Reveal Info Overlay (Mobile Friendly) */}
                  {remainingCards.length > 0 && !isRevealing && (
                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
                      <div className="flex items-center gap-2 text-white/40 animate-bounce">
                        <Zap className="w-3 h-3 text-yellow-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Tap to Reveal</span>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Stack Info & Controls */}
                <div className="mt-12 flex flex-col items-center gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setIsPeeking(!isPeeking)}
                      className={cn(
                        "px-6 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                        isPeeking 
                          ? "bg-yellow-500 border-yellow-400 text-black" 
                          : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Rotate3d className="w-4 h-4" />
                      {isPeeking ? "Back to Opening" : "Rotate Stack"}
                    </button>
                    
                    {remainingCards.length > 1 && (
                      <button
                        onClick={revealAll}
                        className="px-6 py-2 rounded-full border border-white/10 bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
                      >
                        <Zap className="w-4 h-4" />
                        Reveal All
                      </button>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">
                      {remainingCards.length} Cards Remaining
                    </p>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-white/10 mt-2">
                      {isPeeking ? "Viewing stack side" : "Move mouse to rotate pile"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Revealed Cards Area */}
              <div className="flex-1 w-full max-w-4xl">
                <div className="flex flex-wrap justify-center gap-6">
                  <AnimatePresence>
                    {revealedCards.map((card, i) => (
                      <motion.div
                        key={`${card.id}-${i}`}
                        initial={{ opacity: 0, scale: 0.5, x: -100, rotateY: 180 }}
                        animate={{ opacity: 1, scale: 1, x: 0, rotateY: 0 }}
                        transition={{ 
                          type: "spring", 
                          stiffness: 100, 
                          damping: 15,
                          delay: 0.2
                        }}
                        className="relative group"
                      >
                        <Card 
                          card={card} 
                          className="w-48 h-72" 
                          onClick={() => setSelectedCard(card)}
                        />
                        
                        {/* Rarity Badge */}
                        <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-tighter shadow-lg z-10">
                          {card.rarity || 'Common'}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {remainingCards.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-12 flex flex-col items-center gap-6"
                  >
                    <div className="flex items-center gap-3 text-yellow-500">
                      <Sparkles className="w-6 h-6 animate-spin-slow" />
                      <span className="text-xl font-black italic uppercase tracking-tight">Pack Complete!</span>
                      <Sparkles className="w-6 h-6 animate-spin-slow" />
                    </div>
                    <button
                      onClick={() => onOpen(cards)}
                      className="px-12 py-4 bg-white text-black font-black rounded-xl uppercase tracking-widest text-sm hover:bg-yellow-500 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95"
                    >
                      Add to Collection
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Full Screen Card View */}
      <AnimatePresence>
        {selectedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => setSelectedCard(null)}
          >
            <motion.div
              initial={{ scale: 0.8, rotateY: 180 }}
              animate={{ scale: 1, rotateY: 0 }}
              exit={{ scale: 0.8, rotateY: -180 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="relative"
              onClick={(e) => e.stopPropagation()}
            >
              <Card card={selectedCard} className="w-[350px] h-[500px] md:w-[450px] md:h-[630px]" />
              
              <button
                onClick={() => setSelectedCard(null)}
                className="absolute -top-12 right-0 text-white/60 hover:text-white flex items-center gap-2 uppercase font-black text-xs tracking-widest"
              >
                <X className="w-6 h-6" />
                Close
              </button>

              <div className="absolute -bottom-16 left-0 right-0 text-center">
                <h3 className="text-white text-2xl font-black italic uppercase tracking-tighter">{selectedCard.name}</h3>
                <p className="text-yellow-500 font-bold uppercase tracking-widest text-xs mt-1">{selectedCard.rarity}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close Button (Only if not ripped or finished) */}
      {(!isRipped || remainingCards.length === 0) && (
        <button 
          onClick={() => onOpen(remainingCards.length === 0 ? cards : [])} 
          className="fixed top-8 right-8 p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white/40 hover:text-white z-[210]"
        >
          <X className="w-8 h-8" />
        </button>
      )}
    </div>
  );
}
