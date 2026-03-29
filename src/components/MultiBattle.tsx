import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PokemonCard, InventoryItem } from '../types';
import { Sword, Shield, Zap, Heart, Briefcase, X, Loader2, Sparkles, RefreshCw, Users } from 'lucide-react';
import { ITEMS } from '../constants/items';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';

interface MultiBattleProps {
  playerTeam: PokemonCard[];
  opponentTeam?: PokemonCard[];
  onEnd: (winner: 'player' | 'opponent') => void;
  inventory: InventoryItem[];
  onUseItem: (itemId: string) => void;
}

type EnergyType = 'Fire' | 'Water' | 'Grass' | 'Lightning' | 'Psychic' | 'Fighting' | 'Darkness' | 'Metal' | 'Colorless';

const ENERGY_COLORS: Record<EnergyType, string> = {
  Fire: 'bg-red-500',
  Water: 'bg-blue-500',
  Grass: 'bg-green-500',
  Lightning: 'bg-yellow-400',
  Psychic: 'bg-purple-500',
  Fighting: 'bg-orange-700',
  Darkness: 'bg-zinc-800',
  Metal: 'bg-slate-400',
  Colorless: 'bg-white/20'
};

export function MultiBattle({ playerTeam, opponentTeam: initialOpponentTeam, onEnd, inventory, onUseItem }: MultiBattleProps) {
  // Battle State
  const [playerActiveIdx, setPlayerActiveIdx] = useState(0);
  const [opponentActiveIdx, setOpponentActiveIdx] = useState(0);
  const [playerHps, setPlayerHps] = useState<number[]>(playerTeam.map(() => 100));
  const [opponentHps, setOpponentHps] = useState<number[]>([]);
  const [opponentTeam, setOpponentTeam] = useState<PokemonCard[]>([]);
  
  const [turn, setTurn] = useState<'player' | 'opponent'>('player');
  const [logs, setLogs] = useState<string[]>(['Multi-Battle started!']);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showBattleBackpack, setShowBattleBackpack] = useState(false);
  
  // Energy System
  const [playerEnergy, setPlayerEnergy] = useState<EnergyType[]>([]);
  const [energyPile, setEnergyPile] = useState<EnergyType[]>([]);
  const [canDrawEnergy, setCanDrawEnergy] = useState(true);

  const playerActive = playerTeam[playerActiveIdx];
  const opponentActive = opponentTeam[opponentActiveIdx];

  // Initialize Opponent Team
  useEffect(() => {
    const initOpponent = async () => {
      // For now, generate a random team of 5
      const response = await fetch('https://api.pokemontcg.io/v2/cards?pageSize=5&q=supertype:pokemon');
      const data = await response.json();
      const team = data.data.map((c: any) => ({
        id: c.id,
        name: c.name,
        hp: c.hp || '100',
        images: c.images,
        attacks: c.attacks || [{ name: 'Attack', damage: '20', cost: ['Colorless'] }],
        types: c.types || ['Colorless']
      }));
      setOpponentTeam(team);
      setOpponentHps(team.map(() => 100));
      
      // Initialize Energy Pile
      const types: EnergyType[] = ['Fire', 'Water', 'Grass', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Colorless'];
      const pile: EnergyType[] = [];
      for (let i = 0; i < 200; i++) {
        pile.push(types[Math.floor(Math.random() * types.length)]);
      }
      setEnergyPile(pile);
      setIsReady(true);
    };
    initOpponent();
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 8));
  };

  const drawEnergy = () => {
    if (!canDrawEnergy || turn !== 'player' || isAnimating) return;
    
    const newPile = [...energyPile];
    const drawn: EnergyType[] = [];
    for (let i = 0; i < 10; i++) {
      const card = newPile.pop();
      if (card) drawn.push(card);
    }

    if (drawn.length > 0) {
      setEnergyPile(newPile);
      setPlayerEnergy(prev => [...prev, ...drawn]);
      setCanDrawEnergy(false);
      addLog(`Drew ${drawn.length} Energy!`);
    }
  };

  const getEnergyCounts = (energy: EnergyType[]) => {
    return energy.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  const playerEnergyCounts = getEnergyCounts(playerEnergy);

  const handleSwitch = (idx: number) => {
    if (turn !== 'player' || isAnimating || idx === playerActiveIdx || playerHps[idx] <= 0) return;
    
    setIsAnimating(true);
    addLog(`Switched to ${playerTeam[idx].name}!`);
    setTimeout(() => {
      setPlayerActiveIdx(idx);
      setTurn('opponent');
      setCanDrawEnergy(true);
      setIsAnimating(false);
    }, 1000);
  };

  const handleAttack = (attackIdx: number) => {
    if (turn !== 'player' || isAnimating || !isReady) return;
    
    const attack = playerActive.attacks?.[attackIdx];
    if (!attack) return;

    // Check Energy Cost
    const cost = attack.cost || [];
    const tempEnergy = [...playerEnergy];
    let hasEnergy = true;

    // Simplified energy check: just count if we have enough total energy for now 
    // or do a proper type check if possible. 
    // Let's do a proper type check.
    const requiredTypes = [...cost];
    const availableEnergy = [...playerEnergy];
    const usedEnergyIndices: number[] = [];

    for (const reqType of requiredTypes) {
      let found = false;
      if (reqType === 'Colorless') {
        // Find any energy not already used
        for (let i = 0; i < availableEnergy.length; i++) {
          if (!usedEnergyIndices.includes(i)) {
            usedEnergyIndices.push(i);
            found = true;
            break;
          }
        }
      } else {
        // Find specific type
        for (let i = 0; i < availableEnergy.length; i++) {
          if (!usedEnergyIndices.includes(i) && availableEnergy[i] === reqType) {
            usedEnergyIndices.push(i);
            found = true;
            break;
          }
        }
      }

      if (!found) {
        hasEnergy = false;
        break;
      }
    }

    if (!hasEnergy) {
      addLog(`Not enough energy for ${attack.name}!`);
      return;
    }

    // Execute Attack
    setIsAnimating(true);
    // Remove used energy
    const nextEnergy = availableEnergy.filter((_, i) => !usedEnergyIndices.includes(i));
    setPlayerEnergy(nextEnergy);
    addLog(`${playerActive.name} used ${attack.name}!`);

    const damage = parseInt(attack.damage.replace(/[^0-9]/g, '')) || 20;
    const actualDamage = Math.floor(damage * (0.9 + Math.random() * 0.2));

    setOpponentHps(prev => {
      const next = [...prev];
      const maxHp = parseInt(opponentActive.hp || '100');
      next[opponentActiveIdx] = Math.max(0, next[opponentActiveIdx] - (actualDamage / maxHp) * 100);
      
      if (next[opponentActiveIdx] <= 0) {
        addLog(`${opponentActive.name} fainted!`);
        if (opponentActiveIdx < opponentTeam.length - 1) {
          setTimeout(() => {
            setOpponentActiveIdx(prev => prev + 1);
            addLog(`Opponent sent out ${opponentTeam[opponentActiveIdx + 1].name}!`);
          }, 1000);
        } else {
          setTimeout(() => {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            onEnd('player');
          }, 1500);
        }
      }
      return next;
    });

    setTimeout(() => {
      setTurn('opponent');
      setIsAnimating(false);
    }, 1500);
  };

  // AI Turn
  useEffect(() => {
    if (turn === 'opponent' && isAnimating === false && isReady) {
      const timer = setTimeout(() => {
        setIsAnimating(true);
        const attack = opponentActive.attacks?.[Math.floor(Math.random() * (opponentActive.attacks?.length || 1))] || { name: 'Attack', damage: '20' };
        
        addLog(`${opponentActive.name} used ${attack.name}!`);
        const damage = parseInt(attack.damage.replace(/[^0-9]/g, '')) || 20;
        const actualDamage = Math.floor(damage * (0.9 + Math.random() * 0.2));

        setPlayerHps(prev => {
          const next = [...prev];
          const maxHp = parseInt(playerActive.hp || '100');
          next[playerActiveIdx] = Math.max(0, next[playerActiveIdx] - (actualDamage / maxHp) * 100);

          if (next[playerActiveIdx] <= 0) {
            addLog(`${playerActive.name} fainted!`);
            if (playerActiveIdx < playerTeam.length - 1) {
              setTimeout(() => {
                setPlayerActiveIdx(prev => prev + 1);
                addLog(`You sent out ${playerTeam[playerActiveIdx + 1].name}!`);
              }, 1000);
            } else {
              setTimeout(() => onEnd('opponent'), 1500);
            }
          }
          return next;
        });

        setTimeout(() => {
          setTurn('player');
          setCanDrawEnergy(true);
          setIsAnimating(false);
        }, 1500);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [turn, isAnimating, isReady]);

  if (!isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 cyber-grid">
        <Loader2 className="w-16 h-16 text-yellow-400 animate-spin" />
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">Preparing Arena</h2>
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest animate-pulse">Summoning Opponent Team...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-start p-6 overflow-hidden bg-[#020202] font-sans">
      {/* Cinematic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(37,99,235,0.1),transparent_80%)]" />
        <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ 
          backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Top Navigation Bar */}
      <div className="relative z-10 w-full max-w-[1600px] flex justify-between items-center mb-8">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => onEnd('opponent')}
            className="group flex items-center gap-3 px-4 py-2 bg-white/5 hover:bg-red-500/10 border border-white/10 rounded-xl transition-all"
          >
            <X className="w-4 h-4 text-white/40 group-hover:text-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 group-hover:text-white">Exit Arena</span>
          </button>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400">Combat Protocol 5v5</span>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <h2 className="text-4xl md:text-6xl font-display uppercase italic tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            Team Battle <span className="text-blue-500">Arena</span>
          </h2>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/20 mb-1">Current Turn</div>
            <div className={cn(
              "px-6 py-2 rounded-xl font-display uppercase italic text-lg tracking-widest border transition-all",
              turn === 'player' 
                ? "bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.3)]" 
                : "bg-red-500/10 border-red-500/50 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.3)]"
            )}>
              {turn === 'player' ? 'Your Turn' : "Enemy Turn"}
            </div>
          </div>
        </div>
      </div>

      {/* Main Combat Stage */}
      <div className="relative z-10 w-full max-w-[1600px] grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 items-center flex-1">
        
        {/* Enemy Side */}
        <div className="flex flex-col gap-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap className="w-16 h-16 text-red-500" />
            </div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-red-500 mb-1 block">Enemy Active</span>
                <h3 className="text-2xl font-display uppercase italic tracking-tight text-white">{opponentActive.name}</h3>
              </div>
              <div className="text-right">
                <div className="text-3xl font-display italic text-white leading-none">{Math.round(opponentHps[opponentActiveIdx])}%</div>
                <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-1">Health</div>
              </div>
            </div>
            
            <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 p-[2px] mb-6">
              <motion.div 
                animate={{ width: `${opponentHps[opponentActiveIdx]}%` }}
                className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full"
              />
            </div>

            <div className="flex gap-2">
              {opponentTeam.map((p, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex-1 h-1 rounded-full transition-all duration-500",
                    i === opponentActiveIdx ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" : 
                    opponentHps[i] <= 0 ? "bg-white/5" : "bg-red-900/40"
                  )} 
                />
              ))}
            </div>
          </div>

          <motion.div
            animate={turn === 'opponent' && isAnimating ? { x: [-40, 0], scale: [1.05, 1], rotate: [-5, 0] } : {}}
            className="relative flex justify-center"
          >
            <div className="absolute -inset-20 bg-red-500/5 blur-[100px] rounded-full" />
            <div className="relative p-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-[32px] shadow-2xl group">
              <img 
                src={opponentActive.images.large} 
                alt={opponentActive.name} 
                className="w-64 h-[380px] object-cover rounded-[28px] shadow-2xl group-hover:scale-[1.02] transition-transform"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        </div>

        {/* Center Divider / Effects */}
        <div className="hidden lg:flex flex-col items-center gap-12">
          <div className="w-px h-24 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          <div className="relative">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
              className="w-32 h-32 rounded-full border border-white/5 flex items-center justify-center"
            >
              <div className="absolute inset-0 border-t border-blue-500/20 rounded-full" />
              <div className="absolute inset-2 border-b border-red-500/20 rounded-full" />
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-display italic text-white/5 tracking-[0.5em]">VS</span>
            </div>
          </div>
          <div className="w-px h-24 bg-gradient-to-b from-white/10 via-white/10 to-transparent" />
        </div>

        {/* Player Side */}
        <div className="flex flex-col gap-6">
          <motion.div
            animate={turn === 'player' && isAnimating ? { x: [40, 0], scale: [1.05, 1], rotate: [5, 0] } : {}}
            className="relative flex justify-center"
          >
            <div className="absolute -inset-20 bg-blue-500/5 blur-[100px] rounded-full" />
            <div className="relative p-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-[32px] shadow-2xl group">
              <img 
                src={playerActive.images.large} 
                alt={playerActive.name} 
                className="w-64 h-[380px] object-cover rounded-[28px] shadow-2xl group-hover:scale-[1.02] transition-transform"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Shield className="w-16 h-16 text-blue-500" />
            </div>
            <div className="flex justify-between items-start mb-6">
              <div className="text-left">
                <div className="text-3xl font-display italic text-white leading-none">{Math.round(playerHps[playerActiveIdx])}%</div>
                <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-1">Health</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-blue-500 mb-1 block">Your Active</span>
                <h3 className="text-2xl font-display uppercase italic tracking-tight text-white">{playerActive.name}</h3>
              </div>
            </div>

            <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 p-[2px] mb-6">
              <motion.div 
                animate={{ width: `${playerHps[playerActiveIdx]}%` }}
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
              />
            </div>

            <div className="flex gap-2">
              {playerTeam.map((p, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex-1 h-1 rounded-full transition-all duration-500",
                    i === playerActiveIdx ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" : 
                    playerHps[i] <= 0 ? "bg-white/5" : "bg-blue-900/40"
                  )} 
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Combat Controls */}
      <div className="relative z-10 w-full max-w-[1600px] mt-8 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr] gap-6">
        
        {/* Energy Reserve */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-blue-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Energy Reserve</h3>
            </div>
            <div className="text-[10px] font-mono text-white/20 uppercase tracking-widest">
              Pile: {energyPile.length}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(ENERGY_COLORS).map(([type, color]) => {
              const count = playerEnergyCounts[type] || 0;
              return (
                <div key={type} className={cn(
                  "flex items-center justify-between p-3 rounded-xl border border-white/5 transition-all",
                  count > 0 ? "bg-white/5 border-white/10" : "opacity-20 grayscale"
                )}>
                  <div className={cn("w-3 h-3 rounded-full shadow-sm", color)} />
                  <span className="text-lg font-display italic text-white">{count}</span>
                </div>
              );
            })}
          </div>

          <button
            onClick={drawEnergy}
            disabled={turn !== 'player' || isAnimating || !canDrawEnergy}
            className="w-full mt-6 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-20 disabled:grayscale transition-all rounded-xl font-display uppercase italic tracking-widest text-white shadow-xl shadow-blue-900/20"
          >
            {canDrawEnergy ? 'Draw 10 Energy (1/Turn)' : 'Energy Drawn'}
          </button>
        </div>

        {/* Attacks */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Sword className="w-4 h-4 text-white/40" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Combat Actions</h3>
          </div>
          <div className="space-y-3">
            {playerActive.attacks?.slice(0, 2).map((attack, idx) => (
              <button
                key={idx}
                disabled={turn !== 'player' || isAnimating}
                onClick={() => handleAttack(idx)}
                className="w-full group relative h-20 overflow-hidden transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-20 disabled:grayscale rounded-xl bg-white/5 border border-white/10"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 h-full flex items-center px-6 justify-between">
                  <div className="text-left">
                    <div className="font-display italic uppercase tracking-tight text-xl text-white leading-none mb-1">{attack.name}</div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">{attack.damage} Damage</div>
                  </div>
                  <div className="flex gap-1">
                    {attack.cost?.map((c, i) => (
                      <div key={i} className={cn("w-2 h-2 rounded-full", ENERGY_COLORS[c as EnergyType] || 'bg-white/20')} />
                    ))}
                  </div>
                </div>
              </button>
            ))}
            <button
              onClick={() => setShowBattleBackpack(true)}
              disabled={turn !== 'player' || isAnimating}
              className="w-full h-16 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-20 transition-all rounded-xl font-display uppercase italic tracking-widest text-black shadow-xl"
            >
              Backpack
            </button>
          </div>
        </div>

        {/* Squad */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-4 h-4 text-white/40" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Squad Deployment</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {playerTeam.map((p, i) => (
              <button
                key={i}
                disabled={turn !== 'player' || isAnimating || playerHps[i] <= 0 || i === playerActiveIdx}
                onClick={() => handleSwitch(i)}
                className={cn(
                  "relative h-20 overflow-hidden transition-all rounded-xl border border-white/5 group",
                  i === playerActiveIdx ? "bg-blue-600/20 border-blue-500/50" : "bg-white/5 hover:bg-white/10",
                  playerHps[i] <= 0 && "opacity-20 grayscale"
                )}
              >
                <img 
                  src={p.images.small} 
                  alt={p.name} 
                  className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:opacity-30 transition-opacity"
                  referrerPolicy="no-referrer"
                />
                <div className="relative z-10 h-full flex flex-col items-center justify-center p-2">
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-white truncate w-full text-center">{p.name}</span>
                  <div className="w-full h-1 bg-black/40 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${playerHps[i]}%` }} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Combat Log */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4">
        <div className="bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <AnimatePresence mode="popLayout">
            {logs.slice(0, 1).map((log, i) => (
              <motion.div
                key={`${log}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex items-center gap-4"
              >
                <div className="w-1 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                <span className="text-sm font-mono uppercase tracking-tight text-white">{log}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Battle Backpack Modal */}
      <AnimatePresence>
        {showBattleBackpack && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBattleBackpack(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
                    <Briefcase className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display uppercase italic tracking-tight text-white">Tactical Support</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Inventory & Consumables</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowBattleBackpack(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-white/40" />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inventory.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                      <p className="text-white/20 font-display uppercase italic tracking-widest">Backpack is Empty</p>
                    </div>
                  ) : (
                    inventory.map((invItem, idx) => {
                      const item = ITEMS.find(i => i.id === invItem.itemId);
                      if (!item) return null;
                      return (
                        <button
                          key={`${invItem.itemId}-${idx}`}
                          onClick={() => {
                            onUseItem(invItem.itemId);
                            setShowBattleBackpack(false);
                            addLog(`Used ${item.name}!`);
                          }}
                          className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group text-left"
                        >
                          <div className="w-16 h-16 bg-black/40 rounded-xl flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                            <img src={item.image} alt={item.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-display uppercase italic text-lg text-white leading-none mb-1">{item.name}</h4>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest leading-relaxed line-clamp-2">{item.description}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
