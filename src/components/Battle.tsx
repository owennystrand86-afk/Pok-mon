import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PokemonCard, InventoryItem, Item } from '../types';
import { Sword, Shield, Zap, Heart, Briefcase, X, LayoutGrid } from 'lucide-react';
import { ITEMS } from '../constants/items';
import { cn } from '../lib/utils';

interface BattleProps {
  playerCard: PokemonCard;
  opponentCard?: PokemonCard;
  mode: 'ai' | 'multiplayer';
  roomId?: string;
  onEnd: (winner: 'player' | 'opponent') => void;
  healTrigger?: number;
  isGodMode?: boolean;
  inventory: InventoryItem[];
  onUseItem: (itemId: string) => void;
}

export function Battle({ playerCard, opponentCard: initialOpponentCard, mode, roomId, onEnd, healTrigger = 0, isGodMode = false, inventory, onUseItem }: BattleProps) {
  const playerMaxHp = parseInt(playerCard.hp || '100') + (playerCard.boosts?.hp || 0);
  const opponentMaxHp = parseInt(initialOpponentCard?.hp || '100');
  
  const [playerHp, setPlayerHp] = useState(100);
  const [opponentHp, setOpponentHp] = useState(100);
  const [opponentCard, setOpponentCard] = useState<PokemonCard | null>(initialOpponentCard || null);
  const [turn, setTurn] = useState<'player' | 'opponent'>('player');
  const [logs, setLogs] = useState<string[]>(['Battle started!']);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hitEffect, setHitEffect] = useState<'player' | 'opponent' | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isReady, setIsReady] = useState(mode === 'ai');
  const [playerRole, setPlayerRole] = useState<'p1' | 'p2' | null>(null);
  const [showBattleBackpack, setShowBattleBackpack] = useState(false);
  const [battleBoosts, setBattleBoosts] = useState({ attack: 0, defense: 0, speed: 0 });

  // Admin Heal
  useEffect(() => {
    if (healTrigger > 0) {
      setPlayerHp(100);
      addLog('ADMIN: Pokémon fully healed!');
    }
  }, [healTrigger]);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 5));
  };

  const handleUseItemInBattle = (itemId: string) => {
    if (turn !== 'player' || isAnimating || !isReady) return;

    const item = ITEMS.find(i => i.id === itemId);
    if (!item) return;

    onUseItem(itemId);
    setShowBattleBackpack(false);
    setIsAnimating(true);
    addLog(`You used ${item.name}!`);

    if (item.healAmount) {
      setPlayerHp(prev => Math.min(100, prev + (item.healAmount! / playerMaxHp) * 100));
      addLog(`${playerCard.name} recovered HP!`);
    }

    if (item.statBoost) {
      addLog(`${playerCard.name}'s ${item.statBoost.stat} increased!`);
      setBattleBoosts(prev => ({
        ...prev,
        [item.statBoost!.stat]: (prev[item.statBoost!.stat as keyof typeof prev] || 0) + item.statBoost!.amount
      }));
    }

    setTimeout(() => {
      setTurn('opponent');
      setIsAnimating(false);
    }, 1000);
  };

  // WebSocket Setup
  useEffect(() => {
    if (mode === 'multiplayer' && roomId) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}`);
      
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'join',
          roomId,
          card: playerCard
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'game_start':
            setOpponentCard(data.opponentCard);
            setPlayerRole(data.role);
            setTurn(data.role === 'p1' ? 'player' : 'opponent');
            setIsReady(true);
            addLog(`Opponent joined! Battle start!`);
            break;
          case 'action':
            if (data.from !== playerRole) {
              handleOpponentAction(data.actionType, data.damage);
            }
            break;
          case 'opponent_left':
            addLog('Opponent disconnected.');
            setTimeout(() => onEnd('player'), 2000);
            break;
        }
      };

      setSocket(ws);
      return () => ws.close();
    }
  }, [mode, roomId, playerCard]);

  const handleOpponentAction = (type: 'attack' | 'special', damage: number) => {
    setIsAnimating(true);
    setHitEffect('player');
    setTimeout(() => setHitEffect(null), 500);
    addLog(`${opponentCard?.name} used ${type === 'attack' ? 'Quick Attack' : 'Special Move'}!`);
    
    setPlayerHp(prev => {
      const defenseMultiplier = 1 - (battleBoosts.defense * 0.1); // 10% reduction per point
      const reducedDamage = Math.max(1, damage * defenseMultiplier);
      const next = Math.max(0, prev - (reducedDamage / playerMaxHp) * 100);
      if (next <= 0) {
        addLog(`${playerCard.name} fainted!`);
        setTimeout(() => onEnd('opponent'), 1000);
      }
      return next;
    });

    setTimeout(() => {
      setTurn('player');
      setIsAnimating(false);
    }, 1000);
  };

  const handleAttack = async (attackIndex: number) => {
    if (turn !== 'player' || isAnimating || !isReady) return;

    const attacks = playerCard.attacks || [
      { name: 'Quick Strike', damage: '25' },
      { name: 'Burst Mode', damage: '45' }
    ];
    const attack = attacks[attackIndex] || attacks[0];

    setIsAnimating(true);
    setHitEffect('opponent');
    setTimeout(() => setHitEffect(null), 500);
    
    // Parse damage string
    const damageValue = parseInt(attack.damage.replace(/[^0-9]/g, '')) || 20;
    const hasInfinityGauntlet = inventory.some(i => i.itemId === 'infinity-gauntlet');
    const gauntletMultiplier = hasInfinityGauntlet ? 4 : 1;
    const boostMultiplier = (1 + (battleBoosts.attack * 0.1)) * gauntletMultiplier;
    const actualDamage = Math.floor(damageValue * (0.9 + Math.random() * 0.2) * boostMultiplier);
    
    if (hasInfinityGauntlet) {
      addLog('INFINITY GAUNTLET: Power of the Stones unleashed!');
    }
    addLog(`${playerCard.name} used ${attack.name}!`);
    
    setOpponentHp(prev => {
      const next = Math.max(0, prev - (actualDamage / opponentMaxHp) * 100);
      if (next <= 0) {
        addLog(`${opponentCard?.name} fainted!`);
        setTimeout(() => onEnd('player'), 1000);
      }
      return next;
    });

    if (socket && mode === 'multiplayer') {
      socket.send(JSON.stringify({
        type: 'action',
        roomId,
        actionType: 'attack',
        attackName: attack.name,
        damage: actualDamage,
        from: playerRole
      }));
    }

    await new Promise(r => setTimeout(r, 1000));
    
    if (opponentHp - (actualDamage / opponentMaxHp) * 100 > 0) {
      setTurn('opponent');
      setIsAnimating(false);
    }
  };

  // AI Turn Logic
  useEffect(() => {
    if (mode === 'ai' && turn === 'opponent' && !isAnimating && opponentCard) {
      const timer = setTimeout(() => {
        setIsAnimating(true);
        setHitEffect('player');
        setTimeout(() => setHitEffect(null), 500);
        
        const attacks = opponentCard.attacks || [{ name: 'Attack', damage: '20' }];
        const attack = attacks[Math.floor(Math.random() * attacks.length)];
        
        const damageValue = parseInt(attack.damage.replace(/[^0-9]/g, '')) || 20;
        const actualDamage = Math.floor(damageValue * (0.9 + Math.random() * 0.2));
        
        addLog(`${opponentCard.name} used ${attack.name}!`);
        setPlayerHp(prev => {
          if (isGodMode) {
            addLog('GOD MODE: Damage negated!');
            return prev;
          }
          const defenseMultiplier = 1 - (battleBoosts.defense * 0.1); // 10% reduction per point
          const reducedDamage = Math.max(1, actualDamage * defenseMultiplier);
          const next = Math.max(0, prev - (reducedDamage / playerMaxHp) * 100);
          if (next <= 0) {
            addLog(`${playerCard.name} fainted!`);
            setTimeout(() => onEnd('opponent'), 1000);
          }
          return next;
        });
        
        setTimeout(() => {
          setTurn('player');
          setIsAnimating(false);
        }, 1000);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [turn, isAnimating, mode, opponentCard]);

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-6">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold uppercase italic">Waiting for Opponent...</h2>
          <p className="text-white/40 text-sm">Room Code: <span className="text-purple-400 font-mono font-bold">{roomId}</span></p>
        </div>
        <button 
          onClick={() => onEnd('opponent')}
          className="mt-8 px-8 py-3 bg-white/5 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
        >
          Cancel & Exit
        </button>
      </div>
    );
  }

  if (!opponentCard) return null;

  return (
    <div className="relative w-full min-h-[80vh] flex flex-col items-center justify-center p-4 bg-zinc-900 rounded-2xl border border-white/10 shadow-lg overflow-hidden">
      {/* Simple Background */}
      <div className="absolute inset-0 z-0 bg-zinc-800 opacity-50" />

      {/* Top Bar */}
      <div className="relative z-10 w-full max-w-6xl flex justify-between items-center mb-8">
        <button 
          onClick={() => onEnd('opponent')}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
        >
          <X className="w-4 h-4 text-white/60" />
          <span className="text-xs font-bold uppercase tracking-wider text-white/60">Surrender</span>
        </button>
        
        <div className="text-center">
          <h2 className="text-xl font-bold uppercase tracking-tight text-white">Battle Arena</h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className={cn("w-2 h-2 rounded-full", turn === 'player' ? "bg-blue-500" : "bg-red-500")} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              {turn === 'player' ? 'Your Turn' : "Opponent's Turn"}
            </span>
          </div>
        </div>

        <div className="w-24" /> {/* Spacer */}
      </div>

      {/* Main Battle Stage */}
      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 items-center">
        
        {/* Opponent Side */}
        <div className="flex flex-col items-center gap-6">
          <div className="w-full max-w-xs bg-black/20 p-4 rounded-xl border border-white/5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-white uppercase">{opponentCard.name}</span>
              <span className="text-xs font-mono text-white/60">{Math.round((opponentHp / 100) * opponentMaxHp)} / {opponentMaxHp} HP</span>
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${opponentHp}%` }}
                className={cn("h-full transition-all duration-500", opponentHp > 50 ? 'bg-red-500' : opponentHp > 20 ? 'bg-orange-500' : 'bg-red-700')}
              />
            </div>
          </div>

          <motion.div
            animate={turn === 'opponent' && isAnimating ? { x: [0, -10, 0] } : {}}
            className="relative"
          >
            <AnimatePresence>
              {hitEffect === 'opponent' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1.2 }}
                  exit={{ opacity: 0, scale: 1.5 }}
                  className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
                >
                  <div className="w-32 h-32 bg-yellow-400/40 rounded-full blur-2xl animate-pulse" />
                  <Zap className="w-16 h-16 text-yellow-400 absolute animate-bounce" />
                </motion.div>
              )}
            </AnimatePresence>
            <img 
              src={opponentCard.spriteUrl || opponentCard.images.large} 
              alt={opponentCard.name} 
              className="w-48 h-48 object-contain pixelated drop-shadow-2xl"
              style={{ imageRendering: 'pixelated' }}
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>

        {/* VS Divider */}
        <div className="hidden lg:flex flex-col items-center justify-center h-full px-4">
          <div className="text-xl font-black italic text-white/10">VS</div>
        </div>

        {/* Player Side */}
        <div className="flex flex-col items-center gap-6">
          <motion.div
            animate={turn === 'player' && isAnimating ? { x: [0, 10, 0] } : {}}
            className="relative"
          >
            <AnimatePresence>
              {hitEffect === 'player' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1.2 }}
                  exit={{ opacity: 0, scale: 1.5 }}
                  className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
                >
                  <div className="w-32 h-32 bg-red-500/40 rounded-full blur-2xl animate-pulse" />
                  <Shield className="w-16 h-16 text-red-500 absolute animate-bounce" />
                </motion.div>
              )}
            </AnimatePresence>
            <img 
              src={playerCard.spriteUrl || playerCard.images.large} 
              alt={playerCard.name} 
              className="w-48 h-48 object-contain pixelated drop-shadow-2xl"
              style={{ imageRendering: 'pixelated' }}
              referrerPolicy="no-referrer"
            />
          </motion.div>

          <div className="w-full max-w-xs bg-black/20 p-4 rounded-xl border border-white/5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-white uppercase">{playerCard.name}</span>
              <span className="text-xs font-mono text-white/60">{Math.round((playerHp / 100) * playerMaxHp)} / {playerMaxHp} HP</span>
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${playerHp}%` }}
                className={cn("h-full transition-all duration-500", playerHp > 50 ? 'bg-green-500' : playerHp > 20 ? 'bg-yellow-500' : 'bg-red-500')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Interface */}
      <div className="relative z-10 w-full max-w-6xl mt-12 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
        {/* Action Panel */}
        <div className="bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(playerCard.attacks?.slice(0, 4) || [
              { name: 'Quick Strike', damage: '25' },
              { name: 'Burst Mode', damage: '45' }
            ]).map((attack, idx) => (
              <button
                key={idx}
                disabled={turn !== 'player' || isAnimating}
                onClick={() => handleAttack(idx)}
                className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 disabled:opacity-50 rounded-lg border border-white/10 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Sword className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-bold text-white uppercase">{attack.name}</span>
                </div>
                <span className="text-xs font-mono text-white/40">{attack.damage} DMG</span>
              </button>
            ))}
            
            <button
              disabled={turn !== 'player' || isAnimating}
              onClick={() => setShowBattleBackpack(true)}
              className="sm:col-span-2 flex items-center justify-center gap-3 p-4 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 rounded-lg text-black font-bold uppercase text-sm transition-all"
            >
              <Briefcase className="w-4 h-4" />
              Inventory
            </button>
          </div>
        </div>

        {/* Log Panel */}
        <div className="bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col gap-4 max-h-[200px] overflow-y-auto no-scrollbar">
          <div className="flex items-center gap-2 mb-2">
            <LayoutGrid className="w-4 h-4 text-white/20" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Battle Log</span>
          </div>
          <div className="flex flex-col gap-2">
            <AnimatePresence mode="popLayout">
              {logs.map((log, i) => (
                <motion.div
                  key={`${log}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 - i * 0.2 }}
                  className="text-xs font-medium text-white/60 uppercase italic"
                >
                  {log}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Battle Backpack Modal */}
      <AnimatePresence>
        {showBattleBackpack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 p-8 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-yellow-400/10 rounded-xl">
                    <Briefcase className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold uppercase italic tracking-tight">Battle Inventory</h2>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Choose an item to use</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowBattleBackpack(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-white/40" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-2 sm:grid-cols-3 gap-4">
                {inventory.filter(inv => {
                  const item = ITEMS.find(i => i.id === inv.itemId);
                  return item && (item.type === 'healing' || item.type === 'battle');
                }).length === 0 ? (
                  <div className="col-span-full py-20 text-center">
                    <p className="text-white/20 uppercase tracking-widest font-bold">No usable items found</p>
                  </div>
                ) : (
                  inventory.filter(inv => {
                    const item = ITEMS.find(i => i.id === inv.itemId);
                    return item && (item.type === 'healing' || item.type === 'battle');
                  }).map((invItem) => {
                    const item = ITEMS.find(i => i.id === invItem.itemId);
                    if (!item) return null;

                    return (
                      <button
                        key={invItem.itemId}
                        onClick={() => handleUseItemInBattle(item.id)}
                        className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col items-center text-center gap-3 hover:bg-white/10 transition-all group"
                      >
                        <div className="relative">
                          <img 
                            src={item.image} 
                            alt={item.name} 
                            className="w-12 h-12 object-contain group-hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                            x{invItem.count}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xs font-bold uppercase tracking-tight">{item.name}</h3>
                          <p className="text-[10px] text-white/40 leading-tight line-clamp-2">{item.description}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
