import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Medal, User, Loader2, Eye, Handshake } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserInspector } from './UserInspector';
import { TradeSystem } from './TradeSystem';
import { PokemonCard, InventoryItem } from '../types';

interface LeaderboardEntry {
  id: string;
  displayName: string;
  photoURL?: string;
  wins: number;
  losses: number;
  coins: number;
  collection: PokemonCard[];
  cardsCollected: number;
}

interface LeaderboardProps {
  currentUser: {
    uid: string;
    displayName: string;
    collection: PokemonCard[];
    inventory: InventoryItem[];
    coins: number;
  } | null;
  onTradeComplete: (trade: any) => void;
}

export function Leaderboard({ currentUser, onTradeComplete }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspectingUser, setInspectingUser] = useState<LeaderboardEntry | null>(null);
  const [tradingUser, setTradingUser] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    if (!db) return;

    const q = query(
      collection(db, 'users_public'),
      orderBy('wins', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newEntries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeaderboardEntry[];
      setEntries(newEntries);
      setLoading(false);
    }, (error) => {
      console.error('Leaderboard error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
        <p className="text-white/40 uppercase tracking-widest text-xs font-bold">Loading Rankings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white flex items-center justify-center gap-4">
          <Trophy className="w-10 h-10 text-yellow-400" />
          Global Leaderboard
        </h2>
        <p className="text-slate-400 mt-2 uppercase tracking-widest text-xs font-bold">Real-time rankings of the world's best trainers</p>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <div className="grid grid-cols-[80px_1fr_100px_100px_100px_80px] p-6 border-b border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
          <div className="text-center">Rank</div>
          <div>Trainer</div>
          <div className="text-center">Wins</div>
          <div className="text-center">Losses</div>
          <div className="text-center">Cards</div>
          <div className="text-right">Actions</div>
        </div>

        <div className="divide-y divide-white/5">
          {entries.length === 0 ? (
            <div className="p-20 text-center text-white/20 uppercase tracking-widest font-bold">
              No trainers ranked yet
            </div>
          ) : (
            entries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="grid grid-cols-[80px_1fr_100px_100px_100px_80px] p-6 items-center hover:bg-white/5 transition-colors group"
              >
                <div className="flex justify-center">
                  {index === 0 ? (
                    <Medal className="w-6 h-6 text-yellow-400" />
                  ) : index === 1 ? (
                    <Medal className="w-6 h-6 text-slate-300" />
                  ) : index === 2 ? (
                    <Medal className="w-6 h-6 text-amber-600" />
                  ) : (
                    <span className="text-lg font-black text-white/20">#{index + 1}</span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center">
                    {entry.photoURL ? (
                      <img src={entry.photoURL} alt={entry.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-white/20" />
                    )}
                  </div>
                  <div className="font-bold text-white group-hover:text-yellow-400 transition-colors">
                    {entry.displayName}
                  </div>
                </div>

                <div className="text-center font-black text-yellow-400">{entry.wins}</div>
                <div className="text-center font-bold text-white/40">{entry.losses}</div>
                <div className="text-center font-bold text-blue-400">{entry.cardsCollected}</div>
                
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity pr-4">
                  <button
                    onClick={() => setTradingUser(entry)}
                    className="p-2 bg-yellow-400/10 hover:bg-yellow-400/20 rounded-lg transition-all active:scale-90 text-yellow-400/60 hover:text-yellow-400"
                    title="Trade with Trainer"
                  >
                    <Handshake className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setInspectingUser(entry)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all active:scale-90 text-white/60 hover:text-white"
                    title="Inspect Trainer"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {inspectingUser && (
          <UserInspector 
            currentUser={currentUser}
            user={inspectingUser} 
            onClose={() => setInspectingUser(null)} 
            onTrade={() => {
              setTradingUser(inspectingUser);
              setInspectingUser(null);
            }}
            onGift={(gift) => {
              onTradeComplete({ p1: gift, p2: { displayName: inspectingUser.displayName, cards: [], items: [], coins: 0 } });
              setInspectingUser(null);
            }}
          />
        )}
        {tradingUser && currentUser && (
          <TradeSystem
            currentUser={currentUser}
            otherUser={{ uid: tradingUser.id, displayName: tradingUser.displayName }}
            onClose={() => setTradingUser(null)}
            onComplete={(trade) => {
              onTradeComplete(trade);
              setTradingUser(null);
            }}
          />
        )}
      </AnimatePresence>

      <div className="mt-8 p-6 bg-yellow-400/5 border border-yellow-400/10 rounded-2xl flex items-center gap-4">
        <div className="w-10 h-10 bg-yellow-400/10 rounded-full flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
        </div>
        <div className="text-xs text-yellow-400/60 font-medium uppercase tracking-widest">
          Leaderboard refreshes automatically as stats change.
        </div>
      </div>
    </div>
  );
}
