import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';
import { Database } from './types';

// Self-contained fallback configuration so Vercel, Netlify, and GitHub Pages deployments work seamlessly out of the box
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

let isQuotaExhausted = false;

function handleQuotaError(error: any) {
  const code = error?.code || '';
  const msg = typeof error?.message === 'string' ? error.message : String(error || '');
  const isQuota = 
    code === 'resource-exhausted' || 
    msg.includes('Quota limit exceeded') || 
    msg.includes('resource-exhausted') ||
    msg.includes('Write stream exhausted') ||
    msg.includes('Quota exceeded') ||
    msg.includes('quota metric');

  if (isQuota) {
    if (!isQuotaExhausted) {
      isQuotaExhausted = true;
      console.warn('Firestore daily quota reached. Falling back gracefully to LocalStorage & external sync.');
    }
    return true;
  }
  return false;
}

export async function saveToFirestore(dbData: Database): Promise<boolean> {
  if (isQuotaExhausted) return false;
  try {
    // Sanitize undefined fields for Firestore compatibility
    const sanitized = JSON.parse(JSON.stringify(dbData));
    await setDoc(APP_STATE_DOC, sanitized);
    return true;
  } catch (error: any) {
    if (!handleQuotaError(error)) {
      console.warn('Failed to save to Firestore:', error);
    }
    return false;
  }
}

export async function resetFirestoreClean(cleanData: Database): Promise<boolean> {
  try {
    const sanitized = JSON.parse(JSON.stringify(cleanData));
    await setDoc(APP_STATE_DOC, sanitized);
    return true;
  } catch (e: any) {
    console.warn('Could not reset Firestore document:', e);
    return false;
  }
}

export async function fetchFromFirestore(): Promise<Database | null> {
  if (isQuotaExhausted) return null;
  try {
    const snap = await getDoc(APP_STATE_DOC);
    if (snap.exists()) {
      return snap.data() as Database;
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
          if (data && data.teams) {
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


