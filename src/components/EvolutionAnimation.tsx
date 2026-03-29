import { motion, AnimatePresence } from 'motion/react';
import { PokemonCard } from '../types';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

interface EvolutionAnimationProps {
  from: PokemonCard;
  to: PokemonCard;
  onComplete: () => void;
}

export function EvolutionAnimation({ from, to, onComplete }: EvolutionAnimationProps) {
  const [phase, setPhase] = useState<'start' | 'glow' | 'transform' | 'reveal'>('start');

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase('glow'), 1000);
    const timer2 = setTimeout(() => setPhase('transform'), 3000);
    const timer3 = setTimeout(() => {
      setPhase('reveal');
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#FFFFFF', '#FFD700', '#00FFFF']
      });
    }, 5000);
    const timer4 = setTimeout(onComplete, 8000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vw] bg-blue-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-white/5 rounded-full blur-[80px]" />
      </div>

      <div className="relative flex flex-col items-center gap-12">
        <div className="relative">
          {/* Main Pokemon Container */}
          <motion.div
            animate={{
              scale: phase === 'glow' ? [1, 1.1, 1] : phase === 'transform' ? [1, 1.5, 0] : 1,
              opacity: phase === 'transform' ? 0 : 1,
              filter: phase === 'glow' ? 'brightness(2) blur(2px)' : 'brightness(1) blur(0px)',
            }}
            transition={{ duration: phase === 'transform' ? 2 : 0.5, repeat: phase === 'glow' ? Infinity : 0 }}
            className="w-64 h-80 relative"
          >
            <img 
              src={from.images.large} 
              alt={from.name} 
              className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              referrerPolicy="no-referrer"
            />
          </motion.div>

          {/* Evolved Pokemon Container */}
          <AnimatePresence>
            {phase === 'reveal' && (
              <motion.div
                initial={{ scale: 0, opacity: 0, filter: 'brightness(5)' }}
                animate={{ scale: 1, opacity: 1, filter: 'brightness(1)' }}
                className="absolute inset-0 w-64 h-80"
              >
                <img 
                  src={to.images.large} 
                  alt={to.name} 
                  className="w-full h-full object-contain drop-shadow-[0_0_50px_rgba(255,215,0,0.5)]"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Glowing Orb during transformation */}
          {phase === 'transform' && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 2, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 2 }}
              className="absolute inset-0 bg-white rounded-full blur-3xl"
            />
          )}
        </div>

        {/* Text Overlay */}
        <div className="text-center space-y-4 z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-yellow-400 animate-spin-slow" />
              <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">
                {phase === 'reveal' ? 'Evolution Complete!' : 'What?'}
              </h2>
              <Sparkles className="w-6 h-6 text-yellow-400 animate-spin-slow" />
            </div>
            <p className="text-white/40 font-bold uppercase tracking-[0.3em] text-xs">
              {phase === 'reveal' 
                ? `${from.name} evolved into ${to.name}!` 
                : `${from.name} is evolving...`}
            </p>
          </motion.div>

          {phase === 'reveal' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="pt-8"
            >
              <div className="flex gap-8 justify-center">
                <div className="text-center">
                  <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Before</p>
                  <p className="text-xl font-black text-white/60">{from.hp} HP</p>
                </div>
                <div className="w-px h-12 bg-white/10" />
                <div className="text-center">
                  <p className="text-[10px] text-yellow-400 uppercase font-bold tracking-widest mb-1">After</p>
                  <p className="text-xl font-black text-yellow-400">{to.hp} HP</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
