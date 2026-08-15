import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, getDoc, getDocFromServer } from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';
import { Database } from './types';

// Self-contained configuration for Firebase multi-device real-time sync
const DEFAULT_FIREBASE_CONFIG = {
  projectId: "gen-lang-client-0985237405",
  appId: "1:912676369445:web:3674ac7e0e659740b8fbcc",
  apiKey: "AIzaSyBI_ze4WwXYrVzUiDQAYfrZH2DpK2hG3DY",
  authDomain: "gen-lang-client-0985237405.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-meeladunnabiresu-e5b70d84-17b0-4f4e-826b-e1130b0cef0f",
  storageBucket: "gen-lang-client-0985237405.firebasestorage.app",
  messagingSenderId: "912676369445"
};

const resolvedConfig = {
  ...DEFAULT_FIREBASE_CONFIG,
  ...(firebaseConfigJson || {})
};

const app = !getApps().length ? initializeApp(resolvedConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, resolvedConfig.firestoreDatabaseId || '(default)');

const APP_STATE_DOC = doc(db, 'appState', 'current');

export const FIRESTORE_UPGRADE_URL = `https://console.firebase.google.com/project/${resolvedConfig.projectId}/firestore/databases/${resolvedConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;

const QUOTA_STORAGE_KEY = 'firestore_quota_exhausted_day';

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

let isQuotaExhausted = (() => {
  try {
    const savedDay = localStorage.getItem(QUOTA_STORAGE_KEY);
    return savedDay === getTodayString();
  } catch (e) {
    return false;
  }
})();

const quotaListeners = new Set<(exhausted: boolean) => void>();

export function isFirestoreQuotaExhausted(): boolean {
  return isQuotaExhausted;
}

export function subscribeToQuotaStatus(listener: (exhausted: boolean) => void): () => void {
  quotaListeners.add(listener);
  listener(isQuotaExhausted);
  return () => quotaListeners.delete(listener);
}

function notifyQuotaListeners() {
  quotaListeners.forEach(fn => {
    try { fn(isQuotaExhausted); } catch (e) {}
  });
}

export function handleQuotaError(error: any): boolean {
  const code = error?.code || '';
  const msg = typeof error?.message === 'string' ? error.message : String(error || '');
  const isQuota = 
    code === 'resource-exhausted' || 
    msg.includes('Quota limit exceeded') || 
    msg.includes('resource-exhausted') || 
    msg.includes('Write stream exhausted') ||
    msg.includes('Quota exceeded') ||
    msg.includes('quota metric') ||
    msg.includes('Free daily write units') ||
    msg.includes('Free daily read units');

  if (isQuota) {
    if (!isQuotaExhausted) {
      isQuotaExhausted = true;
      try {
        localStorage.setItem(QUOTA_STORAGE_KEY, getTodayString());
      } catch (e) {}
      notifyQuotaListeners();
      console.warn('Firestore daily write quota reached (Spark Free Tier limit: 20k writes/day). The app is seamlessly switching to local storage, server sync, and Google Sheets fallback. Free tier resets at UTC midnight.');
    }
    return true;
  }
  return false;
}

// Validate connection to Firestore on boot with quota protection
async function testConnection() {
  if (isQuotaExhausted) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (handleQuotaError(error)) return;
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client appears offline or connecting...");
    }
  }
}
testConnection();

// Write deduplication and throttling
let lastWrittenHash = '';
let savePromise: Promise<boolean> | null = null;

export async function saveToFirestore(dbData: Database): Promise<boolean> {
  if (isQuotaExhausted) return false;
  if (!dbData || !Array.isArray(dbData.teams)) return false;

  try {
    // Quick hash to prevent duplicate writes of identical data
    const currentHash = `${dbData.lastModified}_${dbData.results?.length || 0}_${dbData.programs?.length || 0}_${dbData.participants?.length || 0}`;
    if (currentHash === lastWrittenHash) {
      return true;
    }

    if (savePromise) {
      await savePromise;
    }

    const sanitized = JSON.parse(JSON.stringify(dbData));
    savePromise = (async () => {
      try {
        await setDoc(APP_STATE_DOC, sanitized);
        lastWrittenHash = currentHash;
        console.log('✅ Synced to Cloud Firestore (/appState/current)');
        return true;
      } catch (error: any) {
        if (!handleQuotaError(error)) {
          console.warn('Failed to save to Firestore:', error);
        }
        return false;
      } finally {
        savePromise = null;
      }
    })();

    return await savePromise;
  } catch (error: any) {
    if (!handleQuotaError(error)) {
      console.warn('saveToFirestore error:', error);
    }
    return false;
  }
}

export async function resetFirestoreClean(cleanData: Database): Promise<boolean> {
  if (isQuotaExhausted) return false;
  try {
    const sanitized = JSON.parse(JSON.stringify(cleanData));
    await setDoc(APP_STATE_DOC, sanitized);
    return true;
  } catch (e: any) {
    if (!handleQuotaError(e)) {
      console.warn('Could not reset Firestore document:', e);
    }
    return false;
  }
}

export async function fetchFromFirestore(): Promise<Database | null> {
  if (isQuotaExhausted) return null;
  try {
    const snap = await getDoc(APP_STATE_DOC);
    if (snap.exists()) {
      const data = snap.data() as Database;
      if (data && Array.isArray(data.teams)) {
        return data;
      }
    }
    return null;
  } catch (error: any) {
    if (!handleQuotaError(error)) {
      console.warn('Failed to fetch from Firestore:', error);
    }
    return null;
  }
}

export function subscribeToFirestore(onUpdate: (data: Database) => void): () => void {
  if (isQuotaExhausted) return () => {};
  try {
    return onSnapshot(
      APP_STATE_DOC,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Database;
          if (data && Array.isArray(data.teams)) {
            onUpdate(data);
          }
        }
      },
      (error: any) => {
        if (!handleQuotaError(error)) {
          console.warn('Firestore snapshot error:', error);
        }
      }
    );
  } catch (error: any) {
    if (!handleQuotaError(error)) {
      console.warn('Failed to set up Firestore listener:', error);
    }
    return () => {};
  }
}


