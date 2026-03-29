import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PokemonCard } from '../types';
import { Sparkles, Zap, Flame, Droplets, Leaf } from 'lucide-react';
import confetti from 'canvas-confetti';

interface EvolutionSceneProps {
  fromCard: PokemonCard;
  toCard: PokemonCard;
  itemType: string;
  onComplete: () => void;
}

export function EvolutionScene({ fromCard, toCard, itemType, onComplete }: EvolutionSceneProps) {
  const [phase, setPhase] = useState<'start' | 'glowing' | 'transforming' | 'reveal'>('start');

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase('glowing'), 1000);
    const timer2 = setTimeout(() => setPhase('transforming'), 3000);
    const timer3 = setTimeout(() => {
      setPhase('reveal');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFFFFF', '#00E5FF']
      });
    }, 6000);
    const timer4 = setTimeout(() => onComplete(), 10000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onComplete]);

  const getIcon = () => {
    if (itemType.includes('fire')) return <Flame className="w-12 h-12 text-orange-500 animate-pulse" />;
    if (itemType.includes('water')) return <Droplets className="w-12 h-12 text-blue-500 animate-pulse" />;
    if (itemType.includes('thunder')) return <Zap className="w-12 h-12 text-yellow-400 animate-pulse" />;
    if (itemType.includes('leaf')) return <Leaf className="w-12 h-12 text-green-500 animate-pulse" />;
    return <Sparkles className="w-12 h-12 text-white animate-pulse" />;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      <AnimatePresence mode="wait">
        {phase !== 'reveal' ? (
          <motion.div
            key="evolving"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="relative flex flex-col items-center"
          >
            <div className="mb-8">{getIcon()}</div>
            
            <div className="relative">
              <motion.img
                src={fromCard.images.large}
                alt={fromCard.name}
                className={`w-64 h-auto rounded-xl shadow-2xl transition-all duration-1000 ${
                  phase === 'glowing' ? 'brightness-[5] blur-sm' : 
                  phase === 'transforming' ? 'brightness-[10] blur-md scale-110' : ''
                }`}
                animate={phase === 'transforming' ? {
                  scale: [1, 1.1, 0.9, 1.2, 0.8, 1.3],
                  rotate: [0, 5, -5, 10, -10, 0],
                } : {}}
                transition={{ duration: 3, repeat: Infinity }}
              />
              
              {phase === 'transforming' && (
                <motion.div 
                  className="absolute inset-0 bg-white rounded-xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.5, 0.2, 0.8, 0.4, 1] }}
                />
              )}
            </div>

            <motion.h2 
              className="mt-12 text-4xl font-black italic uppercase tracking-tighter text-white text-center"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              What? {fromCard.name} is evolving!
            </motion.h2>
          </motion.div>
        ) : (
          <motion.div
            key="revealed"
            initial={{ scale: 0.5, opacity: 0, rotateY: 180 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            className="flex flex-col items-center"
          >
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-yellow-400 via-white to-blue-400 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity animate-pulse" />
              <img
                src={toCard.images.large}
                alt={toCard.name}
                className="relative w-80 h-auto rounded-xl shadow-[0_0_50px_rgba(255,255,255,0.3)]"
              />
            </div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-12 text-center"
            >
              <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white">
                Congratulations!
              </h2>
              <p className="text-xl font-bold text-yellow-400 mt-2 uppercase tracking-widest">
                Your {fromCard.name} evolved into {toCard.name}!
              </p>
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              onClick={onComplete}
              className="mt-12 px-8 py-4 bg-white text-black font-black uppercase tracking-widest rounded-full hover:bg-yellow-400 transition-colors"
            >
              Awesome!
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Particle Effects */}
      {phase === 'transforming' && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full"
              initial={{ 
                x: '50%', 
                y: '50%',
                scale: 0
              }}
              animate={{ 
                x: `${50 + (Math.random() - 0.5) * 100}%`,
                y: `${50 + (Math.random() - 0.5) * 100}%`,
                scale: [0, 1, 0],
                opacity: [0, 1, 0]
              }}
              transition={{ 
                duration: 1 + Math.random(),
                repeat: Infinity,
                delay: Math.random()
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
