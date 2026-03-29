import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Move, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, Globe, Lock, Coins, Sparkles, Map as MapIcon, ShieldAlert } from 'lucide-react';
import { PLANETS } from '../constants/planets';
import { Planet } from '../types';

interface WorldProps {
  currentPlanetId: string;
  unlockedPlanets: string[];
  onEncounter: () => void;
  onClose: () => void;
  onUnlockPlanet: (id: string, cost: number) => void;
  onSelectPlanet: (id: string) => void;
  coins: number;
}

const TILE_SIZE = 48;
const WORLD_WIDTH = 12;
const WORLD_HEIGHT = 12;

export function World({ 
  currentPlanetId, 
  unlockedPlanets, 
  onEncounter, 
  onClose, 
  onUnlockPlanet, 
  onSelectPlanet,
  coins 
}: WorldProps) {
  const [playerPos, setPlayerPos] = useState({ x: 5, y: 5 });
  const [isMoving, setIsMoving] = useState(false);
  const [direction, setDirection] = useState<'up' | 'down' | 'left' | 'right'>('down');
  const [grassTiles, setGrassTiles] = useState<Set<string>>(new Set<string>());
  const [showPlanetSelector, setShowPlanetSelector] = useState(false);
  const moveInterval = useRef<NodeJS.Timeout | null>(null);
  
  const currentPlanet = PLANETS.find(p => p.id === currentPlanetId) || PLANETS[0];

  const move = useCallback((dx: number, dy: number, dir: 'up' | 'down' | 'left' | 'right') => {
    if (isMoving || showPlanetSelector) return;
    
    setDirection(dir);
    const newX = Math.max(0, Math.min(WORLD_WIDTH - 1, playerPos.x + dx));
    const newY = Math.max(0, Math.min(WORLD_HEIGHT - 1, playerPos.y + dy));

    if (newX === playerPos.x && newY === playerPos.y) return;

    setIsMoving(true);
    setPlayerPos({ x: newX, y: newY });

    // Check for encounter
    if (grassTiles.has(`${newX},${newY}`) && !isMoving) {
      const baseChance = 0.15;
      const chance = currentPlanet.rarityMultiplier > 5 ? baseChance * 1.5 : baseChance;
      if (Math.random() < chance) {
        // Stop all movement immediately
        stopMoving();
        setIsMoving(true); // Lock movement
        setTimeout(() => {
          onEncounter();
        }, 300);
        return; // Exit early to prevent further movement logic
      }
    }

    setTimeout(() => {
      setIsMoving(false);
    }, 150);
  }, [playerPos, isMoving, grassTiles, onEncounter, showPlanetSelector, currentPlanet.rarityMultiplier]);

  const stopMoving = useCallback(() => {
    if (moveInterval.current) {
      clearInterval(moveInterval.current);
      moveInterval.current = null;
    }
  }, []);

  const startMoving = useCallback((dx: number, dy: number, dir: 'up' | 'down' | 'left' | 'right') => {
    stopMoving();
    move(dx, dy, dir);
    moveInterval.current = setInterval(() => {
      move(dx, dy, dir);
    }, 200);
  }, [move, stopMoving]);

  useEffect(() => {
    return () => stopMoving();
  }, [stopMoving]);

  // Generate grass tiles
  useEffect(() => {
    const newGrass = new Set<string>();
    const grassCount = currentPlanetId === 'earth-core' ? 60 : 40;
    for (let i = 0; i < grassCount; i++) {
      const x = Math.floor(Math.random() * WORLD_WIDTH);
      const y = Math.floor(Math.random() * WORLD_HEIGHT);
      if (x !== 5 || y !== 5) {
        newGrass.add(`${x},${y}`);
      }
    }
    setGrassTiles(newGrass);
  }, [currentPlanetId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showPlanetSelector) return;
      switch (e.key.toLowerCase()) {
        case 'w': move(0, -1, 'up'); break;
        case 's': move(0, 1, 'down'); break;
        case 'a': move(-1, 0, 'left'); break;
        case 'd': move(1, 0, 'right'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move, showPlanetSelector]);

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-zinc-900 border border-white/10 rounded-2xl shadow-xl relative overflow-hidden max-w-6xl mx-auto min-h-[75vh]">
      <div className="w-full flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowPlanetSelector(true)}
            className="flex items-center gap-4 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all"
          >
            <Globe className="w-5 h-5 text-blue-400" />
            <div className="text-left">
              <span className="block text-[8px] font-bold uppercase tracking-wider text-white/40">Location</span>
              <span className="block text-lg font-bold text-white">{currentPlanet.name}</span>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 flex items-center gap-3">
            <Coins className="w-4 h-4 text-yellow-500" />
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-white/40 uppercase tracking-wider">Coins</span>
              <span className="text-sm font-bold text-yellow-500">{coins.toLocaleString()}</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-white/5 hover:bg-red-500/20 rounded-lg transition-all border border-white/10 flex items-center justify-center text-white/40 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative flex flex-col lg:flex-row gap-8 w-full items-center justify-center z-10 flex-1">
        {/* World Viewport */}
        <div className="relative bg-black p-2 rounded-3xl border border-white/10 shadow-2xl">
          <div 
            className={`relative ${currentPlanet.backgroundClass} rounded-2xl overflow-hidden`}
            style={{ 
              width: WORLD_WIDTH * TILE_SIZE, 
              height: WORLD_HEIGHT * TILE_SIZE 
            }}
          >
            {/* World Grid */}
            <div className="absolute inset-0 grid opacity-5 pointer-events-none" style={{ gridTemplateColumns: `repeat(${WORLD_WIDTH}, 1fr)`, gridTemplateRows: `repeat(${WORLD_HEIGHT}, 1fr)` }}>
              {Array.from({ length: WORLD_WIDTH * WORLD_HEIGHT }).map((_, i) => (
                <div key={i} className="border-[0.5px] border-white/20" />
              ))}
            </div>

            {/* Grass Tiles */}
            {Array.from(grassTiles).map((pos: string) => {
              const [x, y] = pos.split(',').map(Number);
              return (
                <div 
                  key={pos}
                  className={`absolute ${currentPlanet.grassClass} rounded-lg opacity-80`}
                  style={{ 
                    left: x * TILE_SIZE + 4, 
                    top: y * TILE_SIZE + 4, 
                    width: TILE_SIZE - 8, 
                    height: TILE_SIZE - 8 
                  }}
                />
              );
            })}

            {/* Player Sprite */}
            <motion.div
              animate={{ 
                left: playerPos.x * TILE_SIZE, 
                top: playerPos.y * TILE_SIZE 
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              className="absolute z-20 flex items-center justify-center"
              style={{ width: TILE_SIZE, height: TILE_SIZE }}
            >
              <div className="relative group">
                {/* Shadow */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-black/40 rounded-full blur-[2px]" />
                
                {/* Sprite (Robot Character) */}
                <motion.div
                  animate={{ 
                    y: isMoving ? [0, -4, 0] : [0, -2, 0],
                    scaleX: direction === 'left' ? -1 : 1,
                    rotate: isMoving ? [0, -5, 5, 0] : 0
                  }}
                  transition={{ 
                    y: { repeat: Infinity, duration: isMoving ? 0.2 : 1.5 },
                    scaleX: { duration: 0.1 },
                    rotate: { repeat: Infinity, duration: 0.4 }
                  }}
                  className="relative z-10 flex flex-col items-center"
                >
                  {/* Robot Head */}
                  <div className="w-6 h-5 bg-slate-700 rounded-lg border-2 border-slate-500 relative overflow-hidden shadow-lg">
                    <div className="absolute top-1 left-1 w-1 h-0.5 bg-cyan-400 animate-pulse" />
                    <div className="absolute top-1 right-1 w-1 h-0.5 bg-cyan-400 animate-pulse" />
                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-cyan-400/20" />
                  </div>
                  
                  {/* Robot Body */}
                  <div className="w-9 h-8 bg-slate-800 rounded-xl border-2 border-slate-600 -mt-0.5 relative shadow-lg">
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border border-cyan-400/30 flex items-center justify-center">
                      <div className="w-1 h-1 bg-cyan-400 rounded-full animate-ping" />
                    </div>
                    
                    {/* Jet Effect when moving */}
                    {isMoving && (
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        <div className="w-1 h-2 bg-cyan-400 rounded-full animate-bounce" />
                        <div className="w-1 h-3 bg-cyan-400/60 rounded-full animate-bounce delay-75" />
                        <div className="w-1 h-2 bg-cyan-400 rounded-full animate-bounce delay-150" />
                      </div>
                    )}
                  </div>

                  {/* Robot Arms */}
                  <div className="absolute -left-2 top-5 w-4 h-1 bg-slate-700 rounded-full rotate-[-30deg] border border-slate-500" />
                  <div className="absolute -right-2 top-5 w-4 h-1 bg-slate-700 rounded-full rotate-[30deg] border border-slate-500" />
                </motion.div>

                {/* Direction Indicator (Subtle) */}
                <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
                  direction === 'up' ? '-translate-y-2' : 
                  direction === 'down' ? 'translate-y-8' :
                  direction === 'left' ? '-translate-x-6' : 'translate-x-6'
                }`} />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="flex flex-col items-center gap-6 bg-white/5 p-6 rounded-3xl border border-white/10 select-none">
          <div className="flex flex-col items-center gap-2">
            <button 
              onPointerDown={() => startMoving(0, -1, 'up')}
              onPointerUp={stopMoving}
              onPointerLeave={stopMoving}
              className="w-16 h-16 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 active:scale-90 transition-all flex items-center justify-center text-white touch-none"
            >
              <ChevronUp className="w-8 h-8" />
            </button>
            <div className="flex gap-2">
              <button 
                onPointerDown={() => startMoving(-1, 0, 'left')}
                onPointerUp={stopMoving}
                onPointerLeave={stopMoving}
                className="w-16 h-16 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 active:scale-90 transition-all flex items-center justify-center text-white touch-none"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <div className="w-16 h-16 bg-blue-500/20 rounded-xl border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Move className="w-6 h-6" />
              </div>
              <button 
                onPointerDown={() => startMoving(1, 0, 'right')}
                onPointerUp={stopMoving}
                onPointerLeave={stopMoving}
                className="w-16 h-16 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 active:scale-90 transition-all flex items-center justify-center text-white touch-none"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>
            <button 
              onPointerDown={() => startMoving(0, 1, 'down')}
              onPointerUp={stopMoving}
              onPointerLeave={stopMoving}
              className="w-16 h-16 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 active:scale-90 transition-all flex items-center justify-center text-white touch-none"
            >
              <ChevronDown className="w-8 h-8" />
            </button>
          </div>
          
          <div className="text-center">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Hold to move</p>
          </div>
        </div>
      </div>

      {/* Planet Selector Modal */}
      <AnimatePresence>
        {showPlanetSelector && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/95 backdrop-blur-sm p-8 flex flex-col"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <MapIcon className="w-6 h-6 text-blue-400" />
                <h3 className="text-2xl font-bold text-white uppercase tracking-tight">Select Planet</h3>
              </div>
              <button 
                onClick={() => setShowPlanetSelector(false)}
                className="p-2 hover:bg-white/5 rounded-full transition-all text-white/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
                {PLANETS.map((planet) => {
                  const isUnlocked = unlockedPlanets.includes(planet.id);
                  const isCurrent = currentPlanetId === planet.id;
                  const canAfford = coins >= planet.unlockCost;

                  return (
                    <button
                      key={planet.id}
                      disabled={isCurrent}
                      onClick={() => {
                        if (isUnlocked) {
                          onSelectPlanet(planet.id);
                          setShowPlanetSelector(false);
                        } else if (canAfford) {
                          onUnlockPlanet(planet.id, planet.unlockCost);
                        }
                      }}
                      className={`relative p-6 rounded-2xl border transition-all text-left flex flex-col gap-4 ${
                        isCurrent ? 'bg-blue-500/10 border-blue-500' :
                        isUnlocked ? 'bg-white/5 border-white/10 hover:bg-white/10' :
                        'bg-white/5 border-white/5 opacity-40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center border border-white/10"
                          style={{ backgroundColor: planet.color }}
                        >
                          {isUnlocked ? <Globe className="w-6 h-6 text-white" /> : <Lock className="w-6 h-6 text-white/40" />}
                        </div>
                        {!isUnlocked && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                            <Coins className="w-3 h-3 text-yellow-500" />
                            <span className="text-sm font-bold text-yellow-500">{planet.unlockCost}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-bold text-lg text-white uppercase tracking-tight">
                          {planet.name}
                          {isCurrent && <span className="ml-2 text-[8px] bg-blue-500 text-white px-2 py-0.5 rounded-md align-middle">CURRENT</span>}
                        </h4>
                        <p className="text-[10px] text-white/40 line-clamp-2">{planet.description}</p>
                      </div>

                      {!isUnlocked && (
                        <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <div className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider ${canAfford ? 'bg-yellow-500 text-black' : 'bg-red-600 text-white'}`}>
                            {canAfford ? 'Unlock' : 'Locked'}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
