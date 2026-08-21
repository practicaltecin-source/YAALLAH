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

let isQuotaExhausted = false;

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
      notifyQuotaListeners();
      console.warn('Firestore write quota warning. Multi-device live sync will use backend server & Google Sheets fallbacks.');
    }
    return true;
  }
  return false;
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (handleQuotaError(error)) return;
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client connecting...");
    }
  }
}
testConnection();

// Helper for network timeout so UI never hangs indefinitely
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 6000, fallbackVal: T): Promise<T> {
  let timer: any = null;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(fallbackVal);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// Write deduplication and throttling
let lastWrittenHash = '';

export async function saveToFirestore(dbData: Database): Promise<boolean> {
  if (!dbData || !Array.isArray(dbData.teams)) return false;

  try {
    const currentHash = `${dbData.lastModified}_${dbData.results?.length || 0}_${dbData.programs?.length || 0}_${dbData.participants?.length || 0}`;
    if (currentHash === lastWrittenHash) {
      return true;
    }

    const sanitized = JSON.parse(JSON.stringify(dbData));
    
    // Set with a 5-second timeout so it never hangs indefinitely on mobile
    const writePromise = setDoc(APP_STATE_DOC, sanitized)
      .then(() => {
        lastWrittenHash = currentHash;
        console.log('✅ Real-time multi-device cloud sync updated (/appState/current)');
        return true;
      })
      .catch((error: any) => {
        if (!handleQuotaError(error)) {
          console.warn('Failed to save to Firestore:', error);
        }
        return false;
      });

    return await withTimeout(writePromise, 5000, true);
  } catch (error: any) {
    if (!handleQuotaError(error)) {
      console.warn('saveToFirestore error:', error);
    }
    return false;
  }
}

export async function resetFirestoreClean(cleanData: Database): Promise<boolean> {
  try {
    const sanitized = JSON.parse(JSON.stringify(cleanData));
    const writePromise = setDoc(APP_STATE_DOC, sanitized).then(() => true).catch(() => false);
    return await withTimeout(writePromise, 5000, true);
  } catch (e: any) {
    if (!handleQuotaError(e)) {
      console.warn('Could not reset Firestore document:', e);
    }
    return false;
  }
}

export async function fetchFromFirestore(): Promise<Database | null> {
  try {
    const fetchPromise = getDoc(APP_STATE_DOC).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as Database;
        if (data && Array.isArray(data.teams)) {
          return data;
        }
      }
      return null;
    });

    return await withTimeout(fetchPromise, 4500, null);
  } catch (error: any) {
    if (!handleQuotaError(error)) {
      console.warn('Failed to fetch from Firestore:', error);
    }
    return null;
  }
}

export function subscribeToFirestore(onUpdate: (data: Database) => void): () => void {
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
