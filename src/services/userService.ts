import { collection, getDocs, doc, updateDoc, query, orderBy, limit, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, PokemonCard, InventoryItem } from '../types';

export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'users_public'), orderBy('wins', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>) {
  try {
    const privateRef = doc(db, 'users_private', uid);
    const publicRef = doc(db, 'users_public', uid);
    
    // Split data between private and public
    const privateData: any = {};
    const publicData: any = {};
    
    if ('coins' in data) { privateData.coins = data.coins; publicData.coins = data.coins; }
    if ('isBanned' in data) privateData.isBanned = data.isBanned;
    if ('isTimedOut' in data) privateData.isTimedOut = data.isTimedOut;
    if ('timeoutUntil' in data) privateData.timeoutUntil = data.timeoutUntil;
    if ('wins' in data) publicData.wins = data.wins;
    if ('losses' in data) publicData.losses = data.losses;
    if ('role' in data) privateData.role = data.role;
    if ('kickTrigger' in data) publicData.kickTrigger = data.kickTrigger;
    if ('collection' in data) {
      privateData.collection = data.collection;
      publicData.collection = data.collection?.slice(0, 50);
      publicData.cardsCollected = data.collection?.length || 0;
    }
    if ('inventory' in data) privateData.inventory = data.inventory;

    if (Object.keys(privateData).length > 0) await updateDoc(privateRef, privateData);
    if (Object.keys(publicData).length > 0) await updateDoc(publicRef, publicData);
  } catch (error) {
    console.error('Error updating user profile:', error);
  }
}

export async function giveCoinsToUser(uid: string, amount: number) {
  try {
    const privateRef = doc(db, 'users_private', uid);
    const privateSnap = await getDoc(privateRef);
    if (privateSnap.exists()) {
      const currentCoins = privateSnap.data().coins || 0;
      const newCoins = currentCoins + amount;
      await updateUserProfile(uid, { coins: newCoins });
    }
  } catch (error) {
    console.error('Error giving coins to user:', error);
  }
}

export async function giveCardToUser(uid: string, card: PokemonCard) {
  try {
    const privateRef = doc(db, 'users_private', uid);
    const privateSnap = await getDoc(privateRef);
    if (privateSnap.exists()) {
      const currentCollection = privateSnap.data().collection || [];
      const newCollection = [...currentCollection, { ...card, id: card.id + '_' + Date.now() }];
      await updateDoc(privateRef, { 
        collection: newCollection,
        lastSaved: new Date().toISOString()
      });
      
      // Update public count
      const publicRef = doc(db, 'users_public', uid);
      await updateDoc(publicRef, { 
        cardsCollected: newCollection.length,
        collection: newCollection.slice(0, 50)
      });
    }
  } catch (error) {
    console.error('Error giving card to user:', error);
  }
}

export async function giveItemToUser(uid: string, itemId: string, count: number) {
  try {
    const privateRef = doc(db, 'users_private', uid);
    const privateSnap = await getDoc(privateRef);
    if (privateSnap.exists()) {
      const currentInventory: InventoryItem[] = privateSnap.data().inventory || [];
      const existing = currentInventory.find(i => i.itemId === itemId);
      let newInventory: InventoryItem[];
      
      if (existing) {
        newInventory = currentInventory.map(i => i.itemId === itemId ? { ...i, count: i.count + count } : i);
      } else {
        newInventory = [...currentInventory, { itemId, count }];
      }
      
      await updateDoc(privateRef, { 
        inventory: newInventory,
        lastSaved: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error giving item to user:', error);
  }
}

export async function banUser(uid: string) {
  await updateUserProfile(uid, { isBanned: true });
}

export async function unbanUser(uid: string) {
  await updateUserProfile(uid, { isBanned: false });
}

export async function timeoutUser(uid: string, minutes: number) {
  const until = new Date(Date.now() + minutes * 60000).toISOString();
  await updateUserProfile(uid, { isTimedOut: true, timeoutUntil: until });
}

export async function untimeoutUser(uid: string) {
  await updateUserProfile(uid, { isTimedOut: false, timeoutUntil: undefined });
}

export async function kickUser(uid: string) {
  await updateUserProfile(uid, { kickTrigger: Date.now() });
}
