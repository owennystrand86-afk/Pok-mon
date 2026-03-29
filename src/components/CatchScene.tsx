import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PokemonCard, InventoryItem, Item, Planet } from '../types';
import { ITEMS } from '../constants/items';
import { PLANETS } from '../constants/planets';
import { fetchRandomCards } from '../services/pokemonService';
import { Loader2, X, Package, ShieldAlert, Sparkles, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CatchSceneProps {
  inventory: InventoryItem[];
  currentPlanetId: string;
  onCatch: (card: PokemonCard) => void;
  onUseBall: (itemId: string) => void;
  onClose: () => void;
}

const ULTRA_MEWTWO: PokemonCard = {
  id: 'ultra-mewtwo',
  name: 'Legendary Ultra Mewtwo',
  hp: '999',
  supertype: 'Pokémon',
  subtypes: ['Elite'],
  types: ['Psychic', 'Darkness'],
  attacks: [
    { name: 'Omega Blast', damage: '500', cost: ['Psychic', 'Psychic', 'Psychic'], convertedEnergyCost: 3, text: 'The ultimate psychic attack.' },
    { name: 'Reality Warp', damage: '???', cost: ['Psychic', 'Darkness'], convertedEnergyCost: 2, text: 'Warps the fabric of reality.' }
  ],
  images: {
    small: 'https://images.pokemontcg.io/sm12/75_hir.png',
    large: 'https://images.pokemontcg.io/sm12/75_hir.png'
  },
  rarity: 'Legendary Ultra',
  set: { 
    id: 'omega',
    name: 'Omega Point', 
    series: 'Elite',
    printedTotal: 1,
    total: 1,
    images: { symbol: '', logo: '' }
  }
};

const BABY_MEW: PokemonCard = {
  id: 'baby-mew',
  name: 'Baby Mew',
  hp: '50',
  supertype: 'Pokémon',
  subtypes: ['Basic'],
  types: ['Psychic'],
  attacks: [
    { name: 'Tiny Sparkle', damage: '10', cost: ['Psychic'], convertedEnergyCost: 1, text: 'A cute but surprisingly strong sparkle.' }
  ],
  images: {
    small: 'https://images.pokemontcg.io/mcd19/11_hir.png',
    large: 'https://images.pokemontcg.io/mcd19/11_hir.png'
  },
  rarity: 'Mythical Baby',
  set: { 
    id: 'genesis',
    name: 'Genesis', 
    series: 'Elite',
    printedTotal: 1,
    total: 1,
    images: { symbol: '', logo: '' }
  }
};

export function CatchScene({ inventory, currentPlanetId, onCatch, onUseBall, onClose }: CatchSceneProps) {
  const [wildPokemon, setWildPokemon] = useState<PokemonCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string>('A wild Pokémon appeared!');
  const [isCatching, setIsCatching] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);
  const [showBall, setShowBall] = useState<Item | null>(null);
  
  const currentPlanet = PLANETS.find(p => p.id === currentPlanetId) || PLANETS[0];

  useEffect(() => {
    const loadPokemon = async () => {
      // Special planet logic
      if (currentPlanetId === 'mewtwo-planet') {
        const rand = Math.random();
        if (rand < 0.001) { // 0.1% for Ultra Mewtwo
          setWildPokemon(ULTRA_MEWTWO);
          setStatus('A LEGENDARY ULTRA MEWTWO APPEARED!!!');
          setIsLoading(false);
          return;
        }
      } else if (currentPlanetId === 'baby-mew-nest') {
        const rand = Math.random();
        if (rand < 0.0005) { // 0.05% for Baby Mew (even rarer)
          setWildPokemon(BABY_MEW);
          setStatus('A MYTHICAL BABY MEW APPEARED!!!');
          setIsLoading(false);
          return;
        }
      }

      // Default logic: fetch random cards based on planet rarity
      const cards = await fetchRandomCards(1);
      setWildPokemon(cards[0]);
      setIsLoading(false);
    };
    loadPokemon();
  }, [currentPlanetId]);

  const handleCatch = async (ball: Item) => {
    if (isCatching) return;
    
    setIsCatching(true);
    setShowBall(ball);
    onUseBall(ball.id);
    setStatus(`Go! ${ball.name}!`);

    // Catch logic: Base catch rate * ball multiplier
    const catchRate = ball.catchRate || 1.0;
    let successChance = Math.min(0.95, 0.3 * catchRate); // Max 95% chance
    
    // Adjust success chance for legendaries
    if (wildPokemon?.rarity?.includes('Legendary') || wildPokemon?.rarity?.includes('Mythical')) {
      successChance *= 0.1; // 10x harder to catch
    }

    // Shake animation
    for (let i = 1; i <= 3; i++) {
      await new Promise(r => setTimeout(r, 800));
      setShakeCount(i);
      setStatus('Shake...');
    }

    await new Promise(r => setTimeout(r, 800));

    if (Math.random() < successChance || ball.id === 'master-ball') {
      setStatus(`Gotcha! ${wildPokemon?.name} was caught!`);
      confetti({
        particleCount: 250,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFFFFF', '#FF00FF']
      });
      if (wildPokemon) onCatch(wildPokemon);
      setTimeout(onClose, 3000);
    } else {
      setStatus(`Oh no! The Pokémon broke free!`);
      setShakeCount(0);
      setShowBall(null);
      setIsCatching(false);
      
      // 20% chance to flee
      if (Math.random() < 0.2) {
        setStatus(`${wildPokemon?.name} fled!`);
        setTimeout(onClose, 2000);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-6 bg-black/95 backdrop-blur-3xl rounded-[48px] border border-white/10 max-w-4xl mx-auto w-full">
        <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
        <p className="text-white/40 uppercase tracking-widest font-bold animate-pulse">Searching in {currentPlanet.name}...</p>
      </div>
    );
  }

  const balls = inventory.filter(i => {
    const item = ITEMS.find(item => item.id === i.itemId);
    return item?.type === 'ball';
  }).map(i => ({
    ...i,
    details: ITEMS.find(item => item.id === i.itemId)!
  }));

  return (
    <div className="flex flex-col items-center gap-8 p-8 bg-zinc-900 border border-white/10 rounded-3xl relative overflow-hidden max-w-5xl mx-auto w-full">
      {/* Simplified Background */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 50%, ${currentPlanet.color}, transparent 70%)` }}
      />

      {/* Header Section */}
      <div className="relative z-10 w-full flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-white/5 border border-white/10 rounded-full w-fit">
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/40">Planet: {currentPlanet.name}</span>
          </div>
          <h2 className="text-2xl font-bold uppercase tracking-tight text-white">Wild Encounter</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-2 bg-white/5 hover:bg-red-500/20 rounded-lg transition-all border border-white/10"
        >
          <X className="w-5 h-5 text-white/40" />
        </button>
      </div>

      {/* Battle Stage Arena */}
      <div className={`relative w-full aspect-video lg:aspect-[21/9] bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden group shadow-2xl shadow-blue-500/5`}>
        {/* Dynamic Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/10 blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 blur-[100px] animate-pulse delay-1000" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent" />
        </div>

        {/* Wild Pokémon (Centered) */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <AnimatePresence mode="wait">
            {wildPokemon && (
              <motion.div
                key={wildPokemon.id}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ 
                  opacity: isCatching ? 0.3 : 1, 
                  scale: isCatching ? 0.8 : 1, 
                  y: 0,
                  filter: isCatching ? 'blur(4px)' : 'blur(0px)'
                }}
                exit={{ opacity: 0, scale: 1.1, y: -20 }}
                className="relative flex flex-col items-center gap-6"
              >
                <div className="relative">
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-black/40 blur-xl rounded-full" />
                  <motion.img 
                    src={wildPokemon.spriteUrl || wildPokemon.images.large} 
                    alt={wildPokemon.name} 
                    animate={{
                      y: [0, -15, 0],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="w-48 h-48 lg:w-64 lg:h-64 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                    referrerPolicy="no-referrer"
                  />
                </div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex flex-col items-center shadow-2xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl lg:text-2xl font-black uppercase tracking-tighter text-white">
                      {wildPokemon.name}
                    </span>
                    <div className="px-2 py-0.5 bg-yellow-400/10 border border-yellow-400/20 rounded text-[10px] font-black text-yellow-400 uppercase tracking-widest">
                      {wildPokemon.rarity}
                    </div>
                  </div>
                  <div className="w-32 lg:w-48 h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      className="h-full bg-green-400"
                    />
                  </div>
                  <div className="flex justify-between w-full mt-1">
                     <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">HP: {wildPokemon.hp}</span>
                     <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">LV. {Math.floor(Math.random() * 20) + 10}</span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Poké Ball Animation (Center) */}
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <AnimatePresence>
            {isCatching && showBall && (
               <motion.div
                initial={{ scale: 0, y: 100, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  y: 0,
                  opacity: 1,
                  rotate: shakeCount > 0 ? [0, -15, 15, -15, 15, 0] : 0
                }}
                transition={{ 
                  rotate: { repeat: Infinity, duration: 0.4 },
                  y: { type: 'spring', damping: 15 }
                }}
                className="relative"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full animate-pulse" />
                  <img 
                    src={showBall.image} 
                    alt="Poké Ball" 
                    className="w-20 h-20 lg:w-24 lg:h-24 object-contain drop-shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Status Bar */}
      <div className="w-full bg-white/5 border border-white/10 p-6 rounded-2xl flex items-center gap-4">
        <p className="text-xl font-bold uppercase tracking-tight text-white/80">
          {status}
        </p>
      </div>

      {/* Action Interface */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-8">
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/20 flex items-center gap-2">
            <Package className="w-3 h-3" />
            Select Poké Ball
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {balls.length === 0 ? (
              <div className="col-span-full p-8 bg-white/5 rounded-2xl border border-dashed border-white/10 text-center flex flex-col items-center gap-2">
                <p className="text-[10px] text-white/20 uppercase font-bold tracking-widest">No Poké Balls</p>
              </div>
            ) : (
              balls.map((ball) => (
                <button
                  key={ball.itemId}
                  disabled={isCatching}
                  onClick={() => handleCatch(ball.details)}
                  className="group relative flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-2xl border border-white/10 transition-all"
                >
                  <img 
                    src={ball.details.image} 
                    alt={ball.details.name} 
                    className="w-10 h-10 object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-left">
                    <p className="text-xs font-bold uppercase tracking-tight text-white">{ball.details.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-500 text-[10px] font-bold">x{ball.count}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col justify-end">
           <button
            disabled={isCatching}
            onClick={onClose}
            className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 disabled:opacity-30 rounded-2xl border border-red-500/20 text-[10px] font-bold uppercase tracking-widest transition-all"
          >
            Flee
          </button>
        </div>
      </div>
    </div>
  );
}
