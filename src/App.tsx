import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PokemonCard, InventoryItem, Item } from './types';
import { EvolutionAnimation } from './components/EvolutionAnimation';
import { fetchPackCards, fetchRandomCards, fetchEvolution } from './services/pokemonService';
import { ITEMS } from './constants/items';
import { Pack } from './components/Pack';
import { Collection } from './components/Collection';
import { Battle } from './components/Battle';
import { Pokedex } from './components/Pokedex';
import { Shop } from './components/Shop';
import { AdminPanel } from './components/AdminPanel';
import { Backpack } from './components/Backpack';
import { World } from './components/World';
import { CatchScene } from './components/CatchScene';
import { MultiBattleSelection } from './components/MultiBattleSelection';
import { MultiBattle } from './components/MultiBattle';
import { Package, LayoutGrid, Sword, Trophy, Loader2, BookOpen, Coins, ShoppingCart, ShieldAlert, Key, Briefcase, Map as MapIcon, Sparkles, User, Ban, Clock, X } from 'lucide-react';
import confetti from 'canvas-confetti';

import { auth, db, googleProvider, signInWithPopup, signOut } from './firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Leaderboard } from './components/Leaderboard';

type View = 'home' | 'pack' | 'collection' | 'battle' | 'pokedex' | 'loading' | 'battle-select' | 'shop' | 'backpack' | 'world' | 'catch' | 'multi-battle-select' | 'multi-battle' | 'leaderboard';

export default function App() {
  const [view, setView] = useState<View>('home');
  const [collection, setCollection] = useState<PokemonCard[]>([]);
  const [coins, setCoins] = useState<number>(500); // Start with some coins
  const [wins, setWins] = useState<number>(0);
  const [losses, setLosses] = useState<number>(0);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [evolvingPokemon, setEvolvingPokemon] = useState<{ from: PokemonCard, to: PokemonCard } | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([
    { itemId: 'poke-ball', count: 5 },
    { itemId: 'potion', count: 2 }
  ]);
  const [currentPackCards, setCurrentPackCards] = useState<PokemonCard[]>([]);
  const [selectedPlayerCard, setSelectedPlayerCard] = useState<PokemonCard | null>(null);
  const [opponentCard, setOpponentCard] = useState<PokemonCard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [battleMode, setBattleMode] = useState<'ai' | 'multiplayer'>('ai');
  const [roomId, setRoomId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [healTrigger, setHealTrigger] = useState(0);
  const [isGodMode, setIsGodMode] = useState(false);
  const [unlockedPlanets, setUnlockedPlanets] = useState<string[]>(['earth-grasslands']);
  const [currentPlanetId, setCurrentPlanetId] = useState<string>('earth-grasslands');
  const [selectedTeam, setSelectedTeam] = useState<PokemonCard[]>([]);
  const [isBanned, setIsBanned] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [timeoutUntil, setTimeoutUntil] = useState<string | null>(null);
  const [kickTrigger, setKickTrigger] = useState<number | null>(null);
  const [showMaxScrollMenu, setShowMaxScrollMenu] = useState(false);
  const [maxScrollPokemon, setMaxScrollPokemon] = useState<PokemonCard | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Load collection and coins from localStorage
  useEffect(() => {
    const savedCollection = localStorage.getItem('poke-collection');
    const savedCoins = localStorage.getItem('poke-coins');
    const savedIsAdmin = localStorage.getItem('poke-is-admin');
    const savedInventory = localStorage.getItem('poke-inventory');
    const savedUnlockedPlanets = localStorage.getItem('poke-unlocked-planets');
    const savedCurrentPlanetId = localStorage.getItem('poke-current-planet-id');
    const savedWins = localStorage.getItem('poke-wins');
    const savedLosses = localStorage.getItem('poke-losses');

    if (savedCollection) {
      try {
        setCollection(JSON.parse(savedCollection));
      } catch (e) {
        console.error('Failed to load collection', e);
      }
    }
    if (savedCoins) {
      setCoins(parseInt(savedCoins));
    }
    if (savedIsAdmin === 'true') {
      setIsAdmin(true);
    }
    if (savedInventory) {
      try {
        setInventory(JSON.parse(savedInventory));
      } catch (e) {
        console.error('Failed to load inventory', e);
      }
    }
    if (savedUnlockedPlanets) {
      try {
        setUnlockedPlanets(JSON.parse(savedUnlockedPlanets));
      } catch (e) {
        console.error('Failed to load unlocked planets', e);
      }
    }
    if (savedCurrentPlanetId) {
      setCurrentPlanetId(savedCurrentPlanetId);
    }
    if (savedWins) {
      setWins(parseInt(savedWins));
    }
    if (savedLosses) {
      setLosses(parseInt(savedLosses));
    }
  }, []);

  // Auth Listener
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        console.log('User logged in:', firebaseUser.displayName);
        loadFromFirestore(firebaseUser.uid);
        
        // Real-time listener for ban/timeout/kick status
        const userRef = doc(db, 'users_public', firebaseUser.uid);
        const unsubUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setIsBanned(!!data.isBanned);
            setIsTimedOut(!!data.isTimedOut);
            setTimeoutUntil(data.timeoutUntil || null);
            
            // Handle Kick
            if (data.kickTrigger && (!kickTrigger || data.kickTrigger > kickTrigger)) {
              setKickTrigger(data.kickTrigger);
              signOut(auth);
              alert('You have been kicked by an administrator.');
            }

            // Check if timeout has expired
            if (data.isTimedOut && data.timeoutUntil) {
              const until = new Date(data.timeoutUntil).getTime();
              const now = Date.now();
              if (now > until) {
                // Auto-untimeout if expired (client-side check, but admin panel handles it too)
                setIsTimedOut(false);
              }
            }
          }
        });
        return () => unsubUser();
      } else {
        setIsBanned(false);
        setIsTimedOut(false);
        setTimeoutUntil(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Timer for timeout screen
  useEffect(() => {
    if (!isTimedOut || !timeoutUntil) return;

    const interval = setInterval(() => {
      const until = new Date(timeoutUntil).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((until - now) / 1000));
      setTimeLeft(diff);
      
      if (diff <= 0) {
        setIsTimedOut(false);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimedOut, timeoutUntil]);

  const loadFromFirestore = async (userId: string) => {
    if (!db) return;
    try {
      const docRef = doc(db, 'users_private', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCollection(data.collection || []);
        setCoins(data.coins || 500);
        setInventory(data.inventory || []);
        setUnlockedPlanets(data.unlockedPlanets || ['earth-grasslands']);
        setCurrentPlanetId(data.currentPlanetId || 'earth-grasslands');
        
        // Load public data too
        const publicDocRef = doc(db, 'users_public', userId);
        const publicDocSnap = await getDoc(publicDocRef);
        if (publicDocSnap.exists()) {
          const publicData = publicDocSnap.data();
          setWins(publicData.wins || 0);
          setLosses(publicData.losses || 0);
        }
      }
    } catch (e) {
      console.error('Error loading from Firestore:', e);
    }
  };

  const handleTradeComplete = (trade: any) => {
    // trade.p1 is current user, trade.p2 is other user
    const myOffer = trade.p1;
    const otherOffer = trade.p2;

    // Remove items from my collection/inventory
    setCollection(prev => prev.filter(card => !myOffer.cards.find((c: any) => c.id === card.id)));
    setInventory(prev => {
      let newInv = [...prev];
      myOffer.items.forEach((item: any) => {
        const idx = newInv.findIndex(i => i.itemId === item.itemId);
        if (idx !== -1) {
          newInv[idx].count -= item.count;
          if (newInv[idx].count <= 0) newInv.splice(idx, 1);
        }
      });
      return newInv;
    });
    setCoins(prev => prev - myOffer.coins);

    // Add items from other user
    setCollection(prev => [...prev, ...otherOffer.cards]);
    setInventory(prev => {
      let newInv = [...prev];
      otherOffer.items.forEach((item: any) => {
        const idx = newInv.findIndex(i => i.itemId === item.itemId);
        if (idx !== -1) {
          newInv[idx].count += item.count;
        } else {
          newInv.push({ itemId: item.itemId, count: item.count });
        }
      });
      return newInv;
    });
    setCoins(prev => prev + otherOffer.coins);

    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#fbbf24', '#3b82f6', '#ef4444']
    });
    
    alert(`Trade with ${otherOffer.displayName} completed successfully!`);
  };

  const handleSave = async () => {
    if (!user || !db) {
      if (!user) alert('Please login to save your progress!');
      return;
    }

    setIsSaving(true);
    try {
      // Save private data
      await setDoc(doc(db, 'users_private', user.uid), {
        email: user.email,
        coins,
        collection,
        inventory,
        unlockedPlanets,
        currentPlanetId,
        lastSaved: new Date().toISOString()
      });

      // Save public data for leaderboard and inspection
      await setDoc(doc(db, 'users_public', user.uid), {
        displayName: user.displayName || 'Anonymous Trainer',
        photoURL: user.photoURL,
        wins,
        losses,
        coins,
        collection: collection.slice(0, 50), // Store first 50 cards for inspection to avoid document size limits
        cardsCollected: collection.length
      });

      console.log('Progress saved to Cloud');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4ade80', '#ffffff']
      });
    } catch (e) {
      console.error('Error saving to Firestore:', e);
      alert('Failed to save progress. Please check your connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogin = async () => {
    if (!auth || !googleProvider) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error('Login error:', e);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setView('home');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  // Save collection and coins to localStorage
  useEffect(() => {
    localStorage.setItem('poke-collection', JSON.stringify(collection));
    localStorage.setItem('poke-coins', coins.toString());
    localStorage.setItem('poke-is-admin', isAdmin.toString());
    localStorage.setItem('poke-inventory', JSON.stringify(inventory));
    localStorage.setItem('poke-unlocked-planets', JSON.stringify(unlockedPlanets));
    localStorage.setItem('poke-current-planet-id', currentPlanetId);
    localStorage.setItem('poke-wins', wins.toString());
    localStorage.setItem('poke-losses', losses.toString());
  }, [collection, coins, isAdmin, inventory, unlockedPlanets, currentPlanetId, wins, losses]);

  // Auto-save every 20 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      localStorage.setItem('poke-collection', JSON.stringify(collection));
      localStorage.setItem('poke-coins', coins.toString());
      localStorage.setItem('poke-inventory', JSON.stringify(inventory));
      console.log('Auto-saved progress');
    }, 20000);
    return () => clearInterval(interval);
  }, [collection, coins, inventory]);

  const handleOpenPack = async (packId: string, price: number, setId?: string, type: 'pokemon' | 'energy' = 'pokemon') => {
    if (coins < price) {
      alert("Not enough coins!");
      return;
    }

    setCoins(prev => prev - price);
    setIsLoading(true);
    setView('loading');
    
    let cards: PokemonCard[] = [];
    if (type === 'energy') {
      // Logic for energy packs - we can fetch random energy cards or use our constants
      // For now, let's fetch random energy cards from the API if possible, or mock them
      const energyData = await fetchRandomCards(5, 'supertype:Energy');
      cards = energyData;
    } else {
      cards = await fetchPackCards(setId);
    }
    
    setCurrentPackCards(cards);
    setIsLoading(false);
    setView('pack');
  };

  const handleBuyItem = (itemId: string, price: number) => {
    if (coins < price) {
      alert("Not enough coins!");
      return;
    }

    setCoins(prev => prev - price);
    addToInventory(itemId, 1);
    
    // Visual feedback
    confetti({
      particleCount: 50,
      spread: 40,
      origin: { y: 0.8 },
      colors: ['#FFD700', '#FFFFFF']
    });
  };

  const handleUnlockPlanet = (planetId: string, cost: number) => {
    if (coins < cost) {
      alert("Not enough coins!");
      return;
    }
    setCoins(prev => prev - cost);
    setUnlockedPlanets(prev => [...prev, planetId]);
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#00FFFF', '#FF00FF', '#FFFFFF']
    });
  };

  const onPackFinish = async (newCards: PokemonCard[]) => {
    if (newCards.length > 0) {
      setCollection(prev => {
        const updatedCollection = [...prev, ...newCards];
        
        // Immediate localStorage save to be absolutely sure
        localStorage.setItem('poke-collection', JSON.stringify(updatedCollection));
        
        // Auto-save to Firestore if logged in
        if (user && db) {
          setDoc(doc(db, 'users_private', user.uid), {
            coins,
            collection: updatedCollection,
            inventory,
            unlockedPlanets,
            currentPlanetId,
            lastSaved: new Date().toISOString()
          }, { merge: true }).catch(e => console.error('Error auto-saving pack results:', e));

          setDoc(doc(db, 'users_public', user.uid), {
            displayName: user.displayName || 'Anonymous Trainer',
            photoURL: user.photoURL,
            wins,
            losses,
            coins,
            cardsCollected: updatedCollection.length
          }, { merge: true }).catch(e => console.error('Error auto-saving public stats:', e));
        }
        
        return updatedCollection;
      });
    }
    
    setView('collection');
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const startBattle = async (card: PokemonCard) => {
    setSelectedPlayerCard(card);
    setIsLoading(true);
    setView('loading');
    
    // Fetch a few cards and pick one that matches the player's level (HP)
    const opponents = await fetchRandomCards(10);
    const playerHp = parseInt(card.hp || '100');
    
    // Find the card with the closest HP
    const bestOpponent = opponents.reduce((prev, curr) => {
      const prevDiff = Math.abs(parseInt(prev.hp || '100') - playerHp);
      const currDiff = Math.abs(parseInt(curr.hp || '100') - playerHp);
      return currDiff < prevDiff ? curr : prev;
    });

    setOpponentCard(bestOpponent);
    setIsLoading(false);
    setView('battle');
  };

  const addToInventory = (itemId: string, count: number = 1) => {
    setInventory(prev => {
      const existing = prev.find(i => i.itemId === itemId);
      if (existing) {
        return prev.map(i => i.itemId === itemId ? { ...i, count: i.count + count } : i);
      }
      return [...prev, { itemId, count }];
    });
  };

  const onBattleEnd = (winner: 'player' | 'opponent') => {
    if (winner === 'player') {
      setWins(prev => prev + 1);
      const reward = 50 + Math.floor(Math.random() * 50);
      setCoins(prev => prev + reward);
      
      // Random item drops
      const dropChance = Math.random();
      if (dropChance < 0.4) { // 40% chance for a drop
        const possibleDrops = ITEMS.filter(i => i.type === 'material' || i.type === 'ball');
        const drop = possibleDrops[Math.floor(Math.random() * possibleDrops.length)];
        addToInventory(drop.id, 1);
        console.log(`Dropped item: ${drop.name}`);
      }

      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFFFFF']
      });
    } else {
      setLosses(prev => prev + 1);
    }
    setTimeout(() => {
      setView('home');
      setSelectedPlayerCard(null);
      setOpponentCard(null);
    }, 3000);
  };

  const handleRedeemCode = () => {
    if (codeValue.toLowerCase() === 'pokémon master') {
      setIsAdmin(true);
      setShowAdminPanel(true);
      setShowCodeModal(false);
      setCodeValue('');
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#FFD700', '#FF0000', '#0000FF']
      });
    } else {
      alert('Invalid Code');
    }
  };

  const handleUseItem = async (itemId: string, pokemonId?: string) => {
    const item = ITEMS.find(i => i.id === itemId);
    if (!item) return;

    // Evolution Logic
    if (item.type === 'evolution' && pokemonId) {
      const pokemon = collection.find(p => p.id === pokemonId);
      if (pokemon) {
        setIsLoading(true);
        try {
          // Determine evolution target
          let evolved: PokemonCard | null = null;
          
          if (item.id === 'mega-stone') {
            // Search for Mega version
            const url = `https://api.pokemontcg.io/v2/cards?q=name:"Mega ${encodeURIComponent(pokemon.name)}"&pageSize=1`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.data && data.data.length > 0) {
              evolved = data.data[0];
            }
          } else {
            evolved = await fetchEvolution(pokemon.name);
          }

          if (evolved && evolved.name !== pokemon.name) {
            setEvolvingPokemon({ from: pokemon, to: evolved });
            
            // Update collection: replace old with new
            setCollection(prev => prev.map(p => p.id === pokemonId ? { ...evolved, id: pokemonId } : p));
            
            // Consume item
            setInventory(prev => {
              const existing = prev.find(i => i.itemId === itemId);
              if (existing && existing.count > 1) {
                return prev.map(i => i.itemId === itemId ? { ...i, count: i.count - 1 } : i);
              }
              return prev.filter(i => i.itemId !== itemId);
            });
            
            setIsLoading(false);
            return; // Exit early as evolution is handled
          } else {
            alert(`${pokemon.name} cannot evolve with this item!`);
          }
        } catch (e) {
          console.error('Evolution error:', e);
        } finally {
          setIsLoading(false);
        }
      }
    }

    // Maximum Scroll Logic
    if (item.id === 'master-scroll' && pokemonId) {
      const pokemon = collection.find(p => p.id === pokemonId);
      if (pokemon) {
        setMaxScrollPokemon(pokemon);
        setShowMaxScrollMenu(true);
        // Item consumption will happen after move selection
        return;
      }
    }

    // Apply effects to Pokemon if pokemonId is provided
    if (pokemonId) {
      setCollection(prev => prev.map(p => {
        if (p.id === pokemonId) {
          const newBoosts = { ...(p.boosts || {}) };
          
          if (item.statBoost) {
            const statName = item.statBoost.stat;
            const amount = item.statBoost.amount;
            newBoosts[statName] = (newBoosts[statName] || 0) + amount;
          }

          return { ...p, boosts: newBoosts };
        }
        return p;
      }));
    }

    // Consume item
    setInventory(prev => {
      const existing = prev.find(i => i.itemId === itemId);
      if (existing && existing.count > 1) {
        return prev.map(i => i.itemId === itemId ? { ...i, count: i.count - 1 } : i);
      }
      return prev.filter(i => i.itemId !== itemId);
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-yellow-400 selection:text-black">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-slate-900/90 backdrop-blur-xl border-b border-white/10 px-6 py-4 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 min-w-max">
          <div 
            onClick={() => setView('home')}
            className="flex items-center gap-2 cursor-pointer group shrink-0"
          >
            <div className="w-10 h-10 bg-red-600 rounded-full border-2 border-white flex items-center justify-center group-hover:rotate-180 transition-transform duration-500">
              <div className="w-full h-1 bg-white absolute" />
              <div className="w-3 h-3 bg-white border-2 border-black rounded-full z-10" />
            </div>
            <div className="flex flex-col -gap-1">
              <span className="font-black italic text-2xl tracking-tighter uppercase leading-none">PokéPack</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-white/40 group-hover:text-yellow-400 transition-colors">Main Menu</span>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            {isAdmin && (
              <button 
                onClick={() => setShowAdminPanel(true)}
                className="flex items-center gap-2 px-3 py-1 bg-yellow-400 text-black rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-yellow-300 transition-all shadow-[0_0_15px_rgba(250,204,21,0.3)] active:scale-95"
              >
                <ShieldAlert className="w-4 h-4" />
                <span className="hidden lg:inline">Admin Panel</span>
              </button>
            )}
            <div className="flex items-center gap-2 px-3 py-1 bg-yellow-400/10 border border-yellow-400/20 rounded-full">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-black text-yellow-400">{coins.toLocaleString()}</span>
            </div>
            
            {user ? (
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-blue-400 transition-all disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span className="hidden lg:inline">Save Progress</span>
                </button>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/20">
                        {user.displayName?.charAt(0) || 'U'}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-4 py-1 bg-white text-black rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                <User className="w-4 h-4" />
                <span>Login</span>
              </button>
            )}

            <button 
              onClick={() => setShowCodeModal(true)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"
              title="Redeem Code"
            >
              <Key className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setView('home')}
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${view === 'home' ? 'text-yellow-400' : 'text-white/60 hover:text-white'}`}
            >
              <LayoutGrid className="w-4 h-4" /> <span className="hidden md:inline">Menu</span>
            </button>
            <button 
              onClick={() => setView('shop')}
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${view === 'shop' ? 'text-yellow-400' : 'text-white/60 hover:text-white'}`}
            >
              <ShoppingCart className="w-4 h-4" /> <span className="hidden md:inline">Shop</span>
            </button>
            <button 
              onClick={() => setView('collection')}
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${view === 'collection' ? 'text-yellow-400' : 'text-white/60 hover:text-white'}`}
            >
              <Trophy className="w-4 h-4" /> <span className="hidden md:inline">Collection</span>
            </button>
            <button 
              onClick={() => {
                if (collection.length === 0) {
                  alert("Open some packs first to get Pokémon for battle!");
                  setView('shop');
                } else {
                  setView('battle-select');
                }
              }}
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${view === 'battle-select' || view === 'battle' ? 'text-yellow-400' : 'text-white/60 hover:text-white'}`}
            >
              <Sword className="w-4 h-4" /> <span className="hidden md:inline">Battle</span>
            </button>
            <button 
              onClick={() => setView('pokedex')}
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${view === 'pokedex' ? 'text-yellow-400' : 'text-white/60 hover:text-white'}`}
            >
              <BookOpen className="w-4 h-4" /> <span className="hidden md:inline">Pokédex</span>
            </button>
            <button 
              onClick={() => setView('backpack')}
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${view === 'backpack' ? 'text-yellow-400' : 'text-white/60 hover:text-white'}`}
            >
              <Briefcase className="w-4 h-4" /> <span className="hidden md:inline">Backpack</span>
            </button>
            <button 
              onClick={() => setView('world')}
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${view === 'world' ? 'text-yellow-400' : 'text-white/60 hover:text-white'}`}
            >
              <MapIcon className="w-4 h-4" /> <span className="hidden md:inline">Travel</span>
            </button>
            <button 
              onClick={() => setView('leaderboard')}
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${view === 'leaderboard' ? 'text-yellow-400' : 'text-white/60 hover:text-white'}`}
            >
              <Trophy className="w-4 h-4" /> <span className="hidden md:inline">Rankings</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-4">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto flex flex-col items-center text-center gap-16"
            >
              <div className="space-y-6">
                <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-white">
                  Collect. Battle. <br /> 
                  <span className="text-blue-500">Master the TCG.</span>
                </h1>
                
                <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto">
                  Build your ultimate collection, battle opponents, and explore new worlds in this definitive Pokémon TCG experience.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
                {/* Shop Card */}
                <button
                  onClick={() => setView('shop')}
                  className="group relative h-64 overflow-hidden bg-slate-800 rounded-3xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg border border-white/5"
                >
                  <div className="absolute inset-0 bg-blue-600/10 group-hover:bg-blue-600/20 transition-colors" />
                  <div className="relative h-full p-8 flex flex-col justify-between items-center">
                    <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ShoppingCart className="w-10 h-10 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-bold text-white mb-1">Shop</h3>
                      <p className="text-blue-400 text-sm font-medium uppercase tracking-wider">Get New Packs</p>
                    </div>
                  </div>
                </button>

                {/* Collection Card */}
                <button
                  onClick={() => setView('collection')}
                  className="group relative h-64 overflow-hidden bg-slate-800 rounded-3xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg border border-white/5"
                >
                  <div className="absolute inset-0 bg-slate-600/10 group-hover:bg-slate-600/20 transition-colors" />
                  <div className="relative h-full p-8 flex flex-col justify-between items-center">
                    <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <LayoutGrid className="w-10 h-10 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-bold text-white mb-1">Collection</h3>
                      <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">{collection.length} Cards Owned</p>
                    </div>
                  </div>
                </button>

                {/* Battle Card */}
                <button
                  onClick={() => {
                    if (collection.length === 0) {
                      alert("Open some packs first to get Pokémon for battle!");
                      setView('shop');
                    } else {
                      setView('battle-select');
                    }
                  }}
                  className="group relative h-64 overflow-hidden bg-slate-800 rounded-3xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg border border-white/5"
                >
                  <div className="absolute inset-0 bg-red-600/10 group-hover:bg-red-600/20 transition-colors" />
                  <div className="relative h-full p-8 flex flex-col justify-between items-center">
                    <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Sword className="w-10 h-10 text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-bold text-white mb-1">Battle</h3>
                      <p className="text-red-500 text-sm font-medium uppercase tracking-wider">Enter the Arena</p>
                    </div>
                  </div>
                </button>

                {/* Travel Card */}
                <button
                  onClick={() => setView('world')}
                  className="group relative h-64 overflow-hidden bg-blue-600 rounded-3xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg lg:col-span-2"
                >
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
                  <div className="relative h-full p-8 flex items-center gap-8">
                    <div className="w-24 h-24 bg-white/10 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                      <MapIcon className="w-12 h-12 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-4xl font-bold text-white mb-2">Explore World</h3>
                      <p className="text-white/80 text-lg">Travel to different planets and find rare Pokémon.</p>
                    </div>
                  </div>
                </button>

                {/* Secondary Actions */}
                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => setView('pokedex')}
                    className="group relative h-[120px] overflow-hidden bg-slate-800 border border-white/5 rounded-2xl flex items-center p-6 gap-6 transition-all hover:bg-slate-700"
                  >
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-xl font-bold text-white">Pokédex</h4>
                      <p className="text-slate-500 text-xs">Card Archive</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setView('backpack')}
                    className="group relative h-[120px] overflow-hidden bg-slate-800 border border-white/5 rounded-2xl flex items-center p-6 gap-6 transition-all hover:bg-slate-700"
                  >
                    <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-xl font-bold text-white">Backpack</h4>
                      <p className="text-slate-500 text-xs">Your Items</p>
                    </div>
                  </button>
                </div>
              </div>

              {collection.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="w-full bg-slate-800 p-8 rounded-3xl flex flex-col lg:flex-row items-center justify-between gap-8 border border-white/5 shadow-xl"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-xl font-bold text-white">Ready for Battle?</h4>
                      <p className="text-slate-400">Test your skills in the Multiple Battle Arena.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setView('multi-battle-select')}
                    className="px-8 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-all shadow-lg active:scale-95"
                  >
                    Enter Arena
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {view === 'battle-select' && (
            <motion.div
              key="battle-select"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-4xl mx-auto flex flex-col items-center gap-8 py-12"
            >
              <div className="text-center">
                <h2 className="text-4xl font-bold text-white">Choose Your Battle</h2>
                <p className="text-slate-400 mt-2">Select a mode to start fighting</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                <button
                  onClick={() => {
                    setBattleMode('ai');
                    setView('collection');
                  }}
                  className="group relative bg-slate-800 p-8 rounded-2xl flex flex-col items-center gap-4 transition-all hover:bg-slate-700 border border-white/5"
                >
                  <div className="w-16 h-16 bg-blue-500/10 rounded-xl flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-blue-500" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white">AI Battle</h3>
                    <p className="text-slate-400 text-sm mt-1">Single Duel vs AI</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (collection.length < 5) {
                      alert("You need at least 5 Pokémon for a Multiple Battle!");
                      return;
                    }
                    setView('multi-battle-select');
                  }}
                  className="group relative bg-blue-600 p-8 rounded-2xl flex flex-col items-center gap-4 transition-all hover:bg-blue-700 shadow-lg"
                >
                  <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white">Multi Battle</h3>
                    <p className="text-white/70 text-sm mt-1">5v5 Team Arena</p>
                  </div>
                </button>

                <div className="group relative bg-slate-800 p-8 rounded-2xl flex flex-col items-center gap-4 transition-all border border-white/5">
                  <div className="w-16 h-16 bg-purple-500/10 rounded-xl flex items-center justify-center">
                    <Sword className="w-8 h-8 text-purple-500" />
                  </div>
                  <div className="text-center w-full space-y-4">
                    <h3 className="text-xl font-bold text-white">Multiplayer</h3>
                    <p className="text-slate-400 text-sm mt-1">Global PvP Arena</p>
                    
                    <div className="flex flex-col gap-2">
                      <input 
                        type="text" 
                        placeholder="ROOM CODE"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                        className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-center text-white focus:outline-none focus:border-purple-500 font-mono"
                      />
                      <button
                        onClick={() => {
                          if (!roomId) {
                            alert("Please enter a room code!");
                            return;
                          }
                          setBattleMode('multiplayer');
                          setView('collection');
                        }}
                        className="w-full py-2 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 transition-colors"
                      >
                        Join Room
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setView('home')}
                className="text-slate-500 hover:text-white transition-colors"
              >
                ← Back to Home
              </button>
            </motion.div>
          )}

          {view === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-40 gap-6"
            >
              <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
              <p className="text-white/40 uppercase tracking-widest font-bold animate-pulse">Contacting PokéCenter...</p>
            </motion.div>
          )}

          {view === 'shop' && (
            <motion.div
              key="shop-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Shop onBuyPack={handleOpenPack} onBuyItem={handleBuyItem} coins={coins} />
            </motion.div>
          )}

          {view === 'pack' && (
            <motion.div
              key="pack-view"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
            >
              <Pack cards={currentPackCards} onOpen={onPackFinish} />
            </motion.div>
          )}

          {view === 'collection' && (
            <motion.div
              key="collection-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Collection cards={collection} onSelectForBattle={startBattle} />
            </motion.div>
          )}

          {view === 'pokedex' && (
            <motion.div
              key="pokedex-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Pokedex />
            </motion.div>
          )}

          {view === 'battle' && selectedPlayerCard && (
            <motion.div
              key="battle-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Battle 
                playerCard={selectedPlayerCard} 
                opponentCard={opponentCard || undefined} 
                mode={battleMode}
                roomId={roomId}
                inventory={inventory}
                onUseItem={handleUseItem}
                onEnd={onBattleEnd}
                healTrigger={healTrigger}
                isGodMode={isGodMode}
              />
            </motion.div>
          )}

          {view === 'multi-battle-select' && (
            <motion.div
              key="multi-battle-select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <MultiBattleSelection 
                collection={collection}
                onBack={() => setView('battle-select')}
                onStart={(team) => {
                  setSelectedTeam(team);
                  setView('multi-battle');
                }}
              />
            </motion.div>
          )}

          {view === 'multi-battle' && (
            <motion.div
              key="multi-battle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <MultiBattle 
                playerTeam={selectedTeam}
                inventory={inventory}
                onUseItem={handleUseItem}
                onEnd={onBattleEnd}
              />
            </motion.div>
          )}

          {view === 'backpack' && (
            <motion.div
              key="backpack-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Backpack 
                inventory={inventory} 
                collection={collection}
                onUseItem={handleUseItem}
                onClose={() => setView('home')} 
              />
            </motion.div>
          )}

          {view === 'world' && (
            <motion.div
              key="world-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <World 
                currentPlanetId={currentPlanetId}
                unlockedPlanets={unlockedPlanets}
                onEncounter={() => setView('catch')} 
                onClose={() => setView('home')} 
                onUnlockPlanet={handleUnlockPlanet}
                onSelectPlanet={setCurrentPlanetId}
                coins={coins}
              />
            </motion.div>
          )}

          {view === 'catch' && (
            <motion.div
              key="catch-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CatchScene 
                inventory={inventory} 
                currentPlanetId={currentPlanetId}
                onCatch={async (card) => {
                  setCollection(prev => {
                    const updatedCollection = [...prev, card];
                    
                    // Immediate localStorage save
                    localStorage.setItem('poke-collection', JSON.stringify(updatedCollection));
                    
                    // Auto-save catch to Firestore
                    if (user && db) {
                      setDoc(doc(db, 'users_private', user.uid), {
                        collection: updatedCollection,
                        lastSaved: new Date().toISOString()
                      }, { merge: true }).catch(e => console.error('Error auto-saving catch:', e));
                      
                      setDoc(doc(db, 'users_public', user.uid), {
                        cardsCollected: updatedCollection.length
                      }, { merge: true }).catch(e => console.error('Error auto-saving public catch stats:', e));
                    }
                    
                    return updatedCollection;
                  });
                }} 
                onUseBall={(itemId) => {
                  setInventory(prev => prev.map(i => i.itemId === itemId ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0));
                }}
                onClose={() => setView('world')} 
              />
            </motion.div>
          )}

          {view === 'leaderboard' && (
            <motion.div
              key="leaderboard-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Leaderboard 
                currentUser={user ? {
                  uid: user.uid,
                  displayName: user.displayName || 'Anonymous',
                  collection,
                  inventory,
                  coins
                } : null}
                onTradeComplete={handleTradeComplete}
              />
            </motion.div>
          )}

          {evolvingPokemon && (
            <EvolutionAnimation 
              from={evolvingPokemon.from} 
              to={evolvingPokemon.to} 
              onComplete={() => setEvolvingPokemon(null)} 
            />
          )}
        </AnimatePresence>
      {/* Banned Screen */}
      {isBanned && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md space-y-6"
          >
            <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(220,38,38,0.5)]">
              <Ban className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-red-600">Account Banned</h1>
            <p className="text-slate-400">Your account has been permanently suspended for violating our terms of service. This action is irreversible.</p>
            <button 
              onClick={handleLogout}
              className="px-8 py-3 bg-white text-black rounded-full font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Logout
            </button>
          </motion.div>
        </div>
      )}

      {/* Timed Out Screen */}
      {isTimedOut && !isBanned && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="max-w-md space-y-8"
          >
            <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(250,204,21,0.3)]">
              <Clock className="w-12 h-12 text-black" />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-black uppercase tracking-tighter text-yellow-400">Timed Out</h1>
              <p className="text-slate-400">You have been temporarily restricted from accessing the game. Please wait for the timer to expire.</p>
            </div>
            
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-8">
              <div className="text-5xl font-mono font-black text-white tabular-nums">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mt-2">Time Remaining</div>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">You cannot click off until the timer ends</p>
          </motion.div>
        </div>
      )}

      {/* Maximum Scroll Menu */}
      <AnimatePresence>
        {showMaxScrollMenu && maxScrollPokemon && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter">Maximum Scroll</h2>
                  <p className="text-slate-400 text-sm">Choose a new move for {maxScrollPokemon.name}</p>
                </div>
                <button 
                  onClick={() => {
                    setShowMaxScrollMenu(false);
                    setMaxScrollPokemon(null);
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center gap-6 bg-white/5 p-4 rounded-2xl">
                  <img src={maxScrollPokemon.images.small} alt={maxScrollPokemon.name} className="w-20 h-28 object-contain" />
                  <div>
                    <div className="text-xl font-bold">{maxScrollPokemon.name}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-widest">Current Moves:</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {maxScrollPokemon.attacks?.map((atk, i) => (
                        <span key={i} className="px-2 py-1 bg-slate-800 rounded text-[10px] font-bold">{atk.name}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40">Enter Custom Move Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Ultimate Destruction"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors"
                    id="custom-move-name"
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40">Damage</label>
                      <input 
                        type="text"
                        placeholder="e.g. 250"
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors"
                        id="custom-move-damage"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40">Description</label>
                      <input 
                        type="text"
                        placeholder="e.g. Deals massive damage"
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors"
                        id="custom-move-desc"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    const name = (document.getElementById('custom-move-name') as HTMLInputElement).value;
                    const damage = (document.getElementById('custom-move-damage') as HTMLInputElement).value;
                    const desc = (document.getElementById('custom-move-desc') as HTMLInputElement).value;

                    if (!name) {
                      alert("Please enter a move name!");
                      return;
                    }

                    // Update the pokemon in collection
                    setCollection(prev => prev.map(p => {
                      if (p.id === maxScrollPokemon.id) {
                        const newAttacks = [...(p.attacks || [])];
                        newAttacks.push({
                          name,
                          damage,
                          text: desc,
                          cost: ['Colorless', 'Colorless', 'Colorless'],
                          convertedEnergyCost: 3
                        });
                        return { ...p, attacks: newAttacks };
                      }
                      return p;
                    }));

                    // Consume the scroll
                    setInventory(prev => {
                      const existing = prev.find(i => i.itemId === 'master-scroll');
                      if (existing && existing.count > 1) {
                        return prev.map(i => i.itemId === 'master-scroll' ? { ...i, count: i.count - 1 } : i);
                      }
                      return prev.filter(i => i.itemId !== 'master-scroll');
                    });

                    setShowMaxScrollMenu(false);
                    setMaxScrollPokemon(null);
                    
                    confetti({
                      particleCount: 150,
                      spread: 100,
                      origin: { y: 0.5 },
                      colors: ['#fbbf24', '#ffffff']
                    });
                  }}
                  className="w-full py-4 bg-yellow-400 text-black rounded-2xl font-black uppercase tracking-widest hover:bg-yellow-300 transition-all shadow-[0_0_30px_rgba(250,204,21,0.3)] active:scale-95"
                >
                  Grant Move
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </main>

      {/* Footer Stats */}
      <footer className="fixed bottom-0 left-0 w-full bg-black/50 backdrop-blur-md border-t border-white/5 px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-white/20 flex justify-between items-center">
        <div>© 2026 PokéPack Elite Simulator</div>
        <div className="flex gap-6">
          <span>Cards: {collection.length}</span>
          <span>Wins: {wins}</span>
          <span>Losses: {losses}</span>
          <span>Status: Online</span>
          {isAdmin && <span className="text-yellow-400/50">Admin Mode</span>}
        </div>
      </footer>

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {showAdminPanel && (
          <AdminPanel 
            onClose={() => setShowAdminPanel(false)}
            coins={coins}
            setCoins={setCoins}
            collection={collection}
            setCollection={setCollection}
            isGodMode={isGodMode}
            setIsGodMode={setIsGodMode}
            onInstantWin={view === 'battle' ? () => onBattleEnd('player') : undefined}
            onHeal={view === 'battle' ? () => setHealTrigger(prev => prev + 1) : undefined}
            onSpawnPacks={(count) => {
              // Logic to spawn packs - maybe just add random cards
              handleOpenPack('admin-pack', 0, undefined, 'pokemon');
            }}
            onAddItem={addToInventory}
            currentUserUid={user?.uid}
          />
        )}
      </AnimatePresence>

      {/* Code Modal */}
      <AnimatePresence>
        {showCodeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl"
            >
              <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Redeem Code</h2>
              <p className="text-xs text-white/40 uppercase tracking-widest mb-6">Enter your secret master code</p>
              
              <input 
                type="text"
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value)}
                placeholder="Enter code..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono mb-6 focus:outline-none focus:border-yellow-400 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleRedeemCode()}
              />

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCodeModal(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRedeemCode}
                  className="flex-1 py-3 bg-yellow-400 text-black hover:bg-yellow-300 rounded-xl font-black uppercase tracking-widest text-xs transition-all active:scale-95"
                >
                  Redeem
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
