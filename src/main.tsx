import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { defaultDB, saveDBLocal, pushToServer } from './db';
import { resetFirestoreClean } from './firebase';

// Clear any cached obsolete storage keys from previous builds and ensure fresh database state
try {
  const currentCleanVersion = 'fest_clean_slate_v2026_reset';
  if (localStorage.getItem('mrms_clean_flag') !== currentCleanVersion) {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('mrms_clean_flag', currentCleanVersion);

    const fresh = defaultDB();
    fresh.lastModified = Date.now() + 5000000000;
    saveDBLocal(fresh, true);
    resetFirestoreClean(fresh).catch(() => {});
    pushToServer(fresh).catch(() => {});
  }
} catch (e) {}

// Unregister old Service Workers and clear obsolete browser cache
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch((err) => {
    console.error('Error unregistering service worker:', err);
  });
}

if ('caches' in window) {
  caches.keys().then((names) => {
    for (const name of names) {
      caches.delete(name);
    }
  }).catch((err) => {
    console.error('Error clearing caches:', err);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

