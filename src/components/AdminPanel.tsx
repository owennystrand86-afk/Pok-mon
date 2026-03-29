import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PokemonCard, UserProfile, Item } from '../types';
import { ADMIN_CARDS, fetchRandomCards } from '../services/pokemonService';
import { cn } from '../lib/utils';
import { Coins, Trash2, Plus, Sparkles, Sword, Heart, Package, ShieldAlert, X, Briefcase, Users, Ban, Clock, Search, UserPlus, Zap, Trophy, Globe, Lock, Unlock, Edit3, Image as ImageIcon, RefreshCcw, ShieldCheck } from 'lucide-react';
import { ITEMS } from '../constants/items';
import { getAllUsers, banUser, unbanUser, timeoutUser, untimeoutUser, giveCoinsToUser, giveCardToUser, giveItemToUser, updateUserProfile, kickUser } from '../services/userService';

interface AdminPanelProps {
  onClose: () => void;
  coins: number;
  setCoins: (coins: number | ((prev: number) => number)) => void;
  collection: PokemonCard[];
  setCollection: (collection: PokemonCard[] | ((prev: PokemonCard[]) => PokemonCard[])) => void;
  isGodMode: boolean;
  setIsGodMode: (val: boolean) => void;
  onInstantWin?: () => void;
  onHeal?: () => void;
  onSpawnPacks?: (count: number) => void;
  onAddItem?: (itemId: string, count: number) => void;
  onUnlockAllPlanets?: () => void;
  currentUserUid?: string;
}

export function AdminPanel({ 
  onClose, 
  coins, 
  setCoins, 
  collection, 
  setCollection,
  isGodMode,
  setIsGodMode,
  onInstantWin,
  onHeal,
  onSpawnPacks,
  onAddItem,
  onUnlockAllPlanets,
  currentUserUid
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'actions' | 'users'>('actions');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [targetUserUid, setTargetUserUid] = useState<string>(currentUserUid || '');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const loadUsers = async () => {
    setIsLoading(true);
    const fetchedUsers = await getAllUsers();
    setUsers(fetchedUsers);
    setIsLoading(false);
  };

  const addAdminCards = async () => {
    if (targetUserUid === currentUserUid) {
      setCollection(prev => [...prev, ...ADMIN_CARDS]);
    }
    if (targetUserUid) {
      for (const card of ADMIN_CARDS) {
        await giveCardToUser(targetUserUid, card);
      }
      alert('Admin cards granted persistently!');
    }
  };

  const addRandomSpecial = async (query: string) => {
    const cards = await fetchRandomCards(1, query);
    if (cards.length > 0) {
      if (targetUserUid === currentUserUid) {
        setCollection(prev => [...prev, ...cards]);
      }
      if (targetUserUid) {
        await giveCardToUser(targetUserUid, cards[0]);
        alert('Card granted persistently!');
      }
    }
  };

  const clearCollection = async () => {
    if (confirm('Are you sure you want to clear the entire collection?')) {
      if (targetUserUid === currentUserUid) {
        setCollection([]);
      }
      if (targetUserUid) {
        await updateUserProfile(targetUserUid, { collection: [] });
        alert('Collection cleared persistently!');
      }
    }
  };

  const handleSetCoins = async (amount: number) => {
    if (targetUserUid === currentUserUid) {
      setCoins(amount);
    }
    if (targetUserUid) {
      await updateUserProfile(targetUserUid, { coins: amount });
      alert(`Coins set to ${amount} persistently!`);
    }
  };

  const handleAddCoins = async (amount: number) => {
    if (targetUserUid === currentUserUid) {
      setCoins(prev => prev + amount);
    }
    if (targetUserUid) {
      await giveCoinsToUser(targetUserUid, amount);
      alert(`${amount} coins added persistently!`);
    }
  };

  const handleAddItems = async (itemId: string, count: number) => {
    if (targetUserUid === currentUserUid) {
      onAddItem?.(itemId, count);
    }
    if (targetUserUid) {
      await giveItemToUser(targetUserUid, itemId, count);
      alert(`Items granted persistently!`);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.uid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const adminActions = [
    {
      title: 'Currency',
      actions: [
        { label: '+1,000 Coins', icon: <Plus />, onClick: () => handleAddCoins(1000) },
        { label: '+10,000 Coins', icon: <Plus />, onClick: () => handleAddCoins(10000) },
        { label: '+100,000 Coins', icon: <Plus />, onClick: () => handleAddCoins(100000) },
        { label: 'Set Infinity', icon: <Sparkles />, onClick: () => handleSetCoins(9999999) },
        { label: 'Reset Coins', icon: <Trash2 />, onClick: () => handleSetCoins(0), variant: 'danger' },
      ]
    },
    {
      title: 'Collection',
      actions: [
        { label: 'Add All Admin Cards', icon: <ShieldAlert />, onClick: addAdminCards },
        { label: 'Add Random VMAX', icon: <Plus />, onClick: () => addRandomSpecial('subtypes:VMAX') },
        { label: 'Add Random GX', icon: <Plus />, onClick: () => addRandomSpecial('subtypes:GX') },
        { label: 'Add Random Shiny', icon: <Plus />, onClick: () => addRandomSpecial('rarity:Shiny') },
        { label: 'Add Random Energy', icon: <Plus />, onClick: () => addRandomSpecial('supertype:Energy') },
        { label: 'Delete Last Card', icon: <Trash2 />, onClick: () => setCollection(prev => prev.slice(0, -1)) },
        { label: 'Clear All', icon: <Trash2 />, onClick: clearCollection, variant: 'danger' },
      ]
    },
    {
      title: 'Gameplay & Stats',
      actions: [
        { label: isGodMode ? 'Disable God Mode' : 'Enable God Mode', icon: <ShieldAlert />, onClick: () => setIsGodMode(!isGodMode), variant: isGodMode ? 'danger' : undefined },
        { label: 'Instant Win', icon: <Sword />, onClick: onInstantWin, disabled: !onInstantWin },
        { label: 'Heal Pokémon', icon: <Heart />, onClick: onHeal, disabled: !onHeal },
        { label: 'Spawn 10 Packs', icon: <Package />, onClick: () => onSpawnPacks?.(10), disabled: !onSpawnPacks },
        { label: 'Unlock All Planets', icon: <Globe />, onClick: onUnlockAllPlanets, disabled: !onUnlockAllPlanets },
        { label: 'Set Wins: 1000', icon: <Trophy />, onClick: () => targetUserUid && updateUserProfile(targetUserUid, { wins: 1000 }) },
        { label: 'Set Losses: 0', icon: <Trash2 />, onClick: () => targetUserUid && updateUserProfile(targetUserUid, { losses: 0 }) },
      ]
    },
    {
      title: 'Items & Materials',
      actions: ITEMS.map(item => ({
        label: `Add 10 ${item.name}`,
        icon: <Plus />,
        onClick: () => handleAddItems(item.id, 10)
      }))
    }
  ];

  const handleUserAction = async (uid: string, action: string) => {
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    
    switch (action) {
      case 'ban': await banUser(uid); break;
      case 'unban': await unbanUser(uid); break;
      case 'timeout': await timeoutUser(uid, 10); break; // 10 min timeout
      case 'untimeout': await untimeoutUser(uid); break;
      case 'kick': await kickUser(uid); break;
      case 'give_coins': await giveCoinsToUser(uid, 10000); break;
      case 'give_admin_cards': 
        for (const card of ADMIN_CARDS) {
          await giveCardToUser(uid, card);
        }
        break;
      case 'give_all_items':
        for (const item of ITEMS) {
          await giveItemToUser(uid, item.id, 10);
        }
        break;
    }
    loadUsers();
  };

  return (
    <motion.div
      initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
      exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 cursor-pointer"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-slate-900/95 border border-white/10 rounded-[48px] w-full max-w-6xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] relative flex flex-col h-[90vh] cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cinematic Background Glow */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-yellow-400/5 rounded-full blur-[120px]" />
          <div className="absolute inset-0 cyber-grid opacity-5" />
        </div>

        <div className="flex items-center justify-between p-10 border-b border-white/10 bg-white/5 relative z-10 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-yellow-400 rounded-[24px] flex items-center justify-center shadow-[0_0_30px_rgba(250,204,21,0.3)]">
              <ShieldAlert className="w-8 h-8 text-black" />
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Master Override</h2>
              <div className="flex items-center gap-3 mt-1">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.4em]">Administrative Access Level 5</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
              <button 
                onClick={() => setActiveTab('actions')}
                className={cn(
                  "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'actions' ? "bg-yellow-400 text-black shadow-lg" : "text-white/40 hover:text-white"
                )}
              >
                System Actions
              </button>
              <button 
                onClick={() => setActiveTab('users')}
                className={cn(
                  "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'users' ? "bg-yellow-400 text-black shadow-lg" : "text-white/40 hover:text-white"
                )}
              >
                User Management
              </button>
            </div>
            <button 
              onClick={onClose}
              className="px-6 h-14 bg-white/5 hover:bg-red-500/20 hover:border-red-500/40 rounded-2xl transition-all border border-white/10 group flex items-center gap-3"
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40 group-hover:text-red-500 transition-colors">Close Panel</span>
              <X className="w-6 h-6 text-white/40 group-hover:text-red-500 transition-colors" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 p-10">
          {activeTab === 'actions' ? (
            <div className="grid gap-12">
              {/* Target User Selector */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-widest">Target User</h4>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">Actions will apply to this user persistently</p>
                  </div>
                </div>
                <select 
                  value={targetUserUid}
                  onChange={(e) => setTargetUserUid(e.target.value)}
                  className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-yellow-400 transition-all"
                >
                  <option value={currentUserUid}>Self (Admin)</option>
                  {users.map(u => (
                    <option key={u.uid} value={u.uid}>{u.displayName} ({u.uid.substring(0, 6)})</option>
                  ))}
                </select>
              </div>

              {adminActions.map((section, idx) => (
                <div key={idx} className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-white/5" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20 whitespace-nowrap">
                      {section.title}
                    </h3>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {section.actions.map((action, actionIdx) => (
                      <button
                        key={actionIdx}
                        disabled={action.disabled}
                        onClick={action.onClick}
                        className={cn(
                          "group relative flex items-center gap-4 px-6 py-4 rounded-[24px] text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 overflow-hidden backdrop-blur-md",
                          action.variant === 'danger'
                            ? "bg-red-500/5 border border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/40"
                            : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:border-white/30 hover:text-white",
                          action.disabled && "opacity-20 cursor-not-allowed grayscale"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                          action.variant === 'danger' ? "bg-red-500/10 group-hover:bg-red-500/20" : "bg-white/5 group-hover:bg-white/10"
                        )}>
                          {React.cloneElement(action.icon as React.ReactElement, { className: "w-4 h-4" })}
                        </div>
                        <span className="relative z-10">{action.label}</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                <input 
                  type="text"
                  placeholder="Search users by name or UID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-3xl py-6 pl-16 pr-8 text-white placeholder:text-white/20 focus:outline-none focus:border-yellow-400/50 transition-all font-black uppercase tracking-widest text-xs"
                />
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <RefreshCcw className="w-10 h-10 text-yellow-400 animate-spin" />
                  <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.4em]">Accessing Central Database...</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredUsers.map(user => (
                    <div 
                      key={user.uid}
                      className="bg-white/5 border border-white/10 rounded-[32px] p-6 flex items-center justify-between group hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center gap-6">
                        <div className="relative">
                          <img src={user.photoURL} alt={user.displayName} className="w-16 h-16 rounded-2xl object-cover border border-white/10" />
                          {user.isBanned && (
                            <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-lg shadow-lg">
                              <Ban className="w-3 h-3" />
                            </div>
                          )}
                          {user.isTimedOut && (
                            <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-white p-1.5 rounded-lg shadow-lg">
                              <Clock className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-white uppercase tracking-tighter">{user.displayName}</h4>
                          <p className="text-[10px] text-white/20 font-mono mt-1 uppercase tracking-widest">{user.uid}</p>
                          <div className="flex gap-4 mt-2">
                            <span className="text-[9px] text-yellow-400/60 font-black uppercase tracking-widest">Wins: {user.wins}</span>
                            <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">Coins: {user.coins}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleUserAction(user.uid, 'give_coins')}
                          className="p-3 bg-yellow-400/10 hover:bg-yellow-400 text-yellow-400 hover:text-black rounded-xl transition-all border border-yellow-400/20"
                          title="Give 10k Coins"
                        >
                          <Coins className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleUserAction(user.uid, 'give_admin_cards')}
                          className="p-3 bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white rounded-xl transition-all border border-purple-500/20"
                          title="Give Admin Cards"
                        >
                          <ShieldAlert className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleUserAction(user.uid, 'give_all_items')}
                          className="p-3 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white rounded-xl transition-all border border-blue-500/20"
                          title="Give All Items"
                        >
                          <Package className="w-4 h-4" />
                        </button>
                        <div className="w-px h-8 bg-white/10 mx-2" />
                        <button 
                          onClick={() => handleUserAction(user.uid, 'kick')}
                          className="p-3 bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-white rounded-xl transition-all border border-orange-500/20"
                          title="Kick User"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleUserAction(user.uid, user.isTimedOut ? 'untimeout' : 'timeout')}
                          className={cn(
                            "p-3 rounded-xl transition-all border",
                            user.isTimedOut 
                              ? "bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white border-green-500/20"
                              : "bg-yellow-500/10 hover:bg-yellow-500 text-yellow-400 hover:text-white border-yellow-500/20"
                          )}
                          title={user.isTimedOut ? "Untimeout" : "Timeout 10m"}
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleUserAction(user.uid, user.isBanned ? 'unban' : 'ban')}
                          className={cn(
                            "p-3 rounded-xl transition-all border",
                            user.isBanned 
                              ? "bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white border-green-500/20"
                              : "bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border-red-500/20"
                          )}
                          title={user.isBanned ? "Unban" : "Ban User"}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-8 bg-white/5 border-t border-white/10 flex justify-between items-center relative z-10 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            <div className="text-[10px] text-white/20 font-mono uppercase tracking-[0.3em]">
              ADMIN_SESSION: {Math.random().toString(36).substring(7).toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-yellow-400/5 rounded-full border border-yellow-400/20">
            <Sparkles className="w-3 h-3 text-yellow-400" />
            <div className="text-[10px] text-yellow-400 font-black uppercase tracking-[0.3em]">
              Protocol: {activeTab === 'actions' ? 'System Override' : 'User Authority'}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
