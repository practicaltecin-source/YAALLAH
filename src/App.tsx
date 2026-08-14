import { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  ViewName, 
  Team, 
  ProgramCategory, 
  NoticeItem
} from './types';
import { 
  loadDB, 
  saveDBLocal, 
  pushToFirebase, 
  pushToServer,
  pushToAppsScriptDirect,
  syncDatabase,
  fetchFromAppsScriptDirect,
  calculatePoints, 
  normalizeDB,
  defaultDB, 
  setFirebaseUrl, 
  classToAge,
  generateId,
  mergeDatabase
} from './db';
import { 
  getSavedSheetId, 
  getCachedToken, 
  isAutoSyncEnabled, 
  syncDataToGoogleSheet, 
  queueAutoSyncToGoogleSheet 
} from './googleSheets';
import { subscribeToFirestore, resetFirestoreClean, fetchFromFirestore } from './firebase';
import { WifiOff, Lock, ShieldAlert } from 'lucide-react';
import Splash from './components/Splash';
import Header from './components/Header';
import Home from './components/Home';
import Results from './components/Results';
import Scoreboard from './components/Scoreboard';
import Programs from './components/Programs';
import CandidateSearch from './components/CandidateSearch';
import CategoriesGuide from './components/CategoriesGuide';
import About from './components/About';
import Settings from './components/Settings';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentView, setCurrentView] = useState<ViewName>('home');
  const [db, setDb] = useState<Database>(() => loadDB());
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('mrms_admin') === '1');
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [reminderActive, setReminderActive] = useState<any>(null);

  // Apply theme on document root whenever settings change
  useEffect(() => {
    const theme = db.settings?.colorTheme || 'natural';
    document.documentElement.setAttribute('data-theme', theme);
  }, [db.settings?.colorTheme]);

  // Keep Google Sheet ID synchronized in localStorage across all connected systems
  useEffect(() => {
    if (db.settings?.googleSheetId) {
      localStorage.setItem('mrms_google_sheet_id', db.settings.googleSheetId);
    }
  }, [db.settings?.googleSheetId]);

  const dbRef = useRef(db);
  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  // Always scroll to top when changing views
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentView]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Optional fallback Apps Script URL
  const APPS_SCRIPT_WEB_APP_URL = '';

  const fetchAppsScriptDataDirectly = async (): Promise<boolean> => {
    try {
      const normalized = await fetchFromAppsScriptDirect();
      if (normalized && Array.isArray(normalized.teams)) {
        const currentLocal = dbRef.current || loadDB();
        const localTime = currentLocal.lastModified || 0;
        const remoteTime = normalized.lastModified || 0;

        // Apply if remote has newer modifications or local has no data
        if (remoteTime > localTime || (!currentLocal.results?.length && normalized.results?.length)) {
          const merged = mergeDatabase(currentLocal, normalized, true);
          const calculated = calculatePoints(merged);
          saveDBLocal(calculated, true);
          dbRef.current = calculated;
          setDb(calculated);
          return true;
        }
      }
    } catch (e) {
      console.warn('Direct Apps Script fetch warning:', e);
    }
    return false;
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 1. First attempt instant Firestore fetch
      const cloudData = await fetchFromFirestore().catch(() => null);
      if (cloudData && Array.isArray(cloudData.teams)) {
        const normalized = normalizeDB(cloudData);
        if (normalized) {
          const currentLocal = dbRef.current || loadDB();
          const hasLocalData = (currentLocal.programs?.length || 0) > 0 || (currentLocal.participants?.length || 0) > 0 || (currentLocal.results?.length || 0) > 0;
          const hasRemoteData = (normalized.programs?.length || 0) > 0 || (normalized.participants?.length || 0) > 0 || (normalized.results?.length || 0) > 0;
          const preferRemote = (!hasLocalData && hasRemoteData) || (Number(normalized.lastModified || 0) >= Number(currentLocal.lastModified || 0));

          const merged = mergeDatabase(currentLocal, normalized, preferRemote);
          const calculated = calculatePoints(merged);
          saveDBLocal(calculated, true);
          dbRef.current = calculated;
          setDb(calculated);
        }
      }

      // 2. Perform general sync
      const res = await syncDatabase(dbRef.current);
      if (res.updated) {
        const calculated = calculatePoints(res.db);
        dbRef.current = calculated;
        setDb(calculated);
      } else {
        await fetchAppsScriptDataDirectly();
      }
    } catch (e) {
      console.error('Manual refresh error:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Sync state once on page load, periodically every 4 seconds, and on cross-tab storage changes
  useEffect(() => {
    let isSyncing = false;
    const syncData = async () => {
      if (isSyncing) return;
      isSyncing = true;
      try {
        const res = await syncDatabase(dbRef.current);
        if (res.updated) {
          const calculated = calculatePoints(res.db);
          dbRef.current = calculated;
          setDb(calculated);
        } else {
          await fetchAppsScriptDataDirectly();
        }
      } finally {
        isSyncing = false;
      }
    };

    // Initial immediate fetch from Firestore on page load
    fetchFromFirestore().then((cloudData) => {
      if (cloudData && Array.isArray(cloudData.teams)) {
        const normalized = normalizeDB(cloudData);
        if (normalized) {
          const currentLocal = dbRef.current || loadDB();
          const hasLocalData = (currentLocal.programs?.length || 0) > 0 || (currentLocal.participants?.length || 0) > 0 || (currentLocal.results?.length || 0) > 0;
          const hasRemoteData = (normalized.programs?.length || 0) > 0 || (normalized.participants?.length || 0) > 0 || (normalized.results?.length || 0) > 0;
          const preferRemote = (!hasLocalData && hasRemoteData) || (Number(normalized.lastModified || 0) >= Number(currentLocal.lastModified || 0));

          const merged = mergeDatabase(currentLocal, normalized, preferRemote);
          const calculated = calculatePoints(merged);
          saveDBLocal(calculated, true);
          dbRef.current = calculated;
          setDb(calculated);
        }
      }
    }).catch(() => {});

    // Initial sync on page load
    syncData();

    // Live Real-Time Multi-Device Sync via Firestore (Instant updates across all phones/laptops on Netlify/Vercel)
    const unsubscribeFirestore = subscribeToFirestore((firestoreData) => {
      if (firestoreData && Array.isArray(firestoreData.teams)) {
        const normalized = normalizeDB(firestoreData);
        if (normalized) {
          const currentLocal = dbRef.current || loadDB();
          const hasLocalData = (currentLocal.programs?.length || 0) > 0 || (currentLocal.participants?.length || 0) > 0 || (currentLocal.results?.length || 0) > 0;
          const hasRemoteData = (normalized.programs?.length || 0) > 0 || (normalized.participants?.length || 0) > 0 || (normalized.results?.length || 0) > 0;
          const preferRemote = (!hasLocalData && hasRemoteData) || (Number(normalized.lastModified || 0) >= Number(currentLocal.lastModified || 0));

          const merged = mergeDatabase(currentLocal, normalized, preferRemote);
          const calculated = calculatePoints(merged);
          saveDBLocal(calculated, true);
          dbRef.current = calculated;
          setDb(calculated);
        }
      }
    });

    // Fast multi-device background sync every 4 seconds (fetches latest Google Sheet & Firestore data)
    const pollInterval = setInterval(syncData, 4000);

    // Sync across tabs in the same browser
    let channel: any = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const BC = (window as any).BroadcastChannel; 
      channel = new BC('mrms_db_channel');
      channel.onmessage = () => {
        const fresh = loadDB();
        setDb(calculatePoints(fresh));
      };
    }

    const handleStorageEvent = (e: any) => {
      if (e.key === 'mrms_database_v2' || e.key === 'mrms_db_v1') {
        const fresh = loadDB();
        setDb(calculatePoints(fresh));
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      unsubscribeFirestore();
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorageEvent);
      if (channel) channel.close();
    };
  }, []);

  // Clock for reminders
  useEffect(() => {
    const shownReminders = new Set<string>();

    const checkReminders = () => {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();

      db.programs.filter(p => p.startTime).forEach(p => {
        const [sh, sm] = p.startTime.split(':').map(Number);
        const diff = (sh * 60 + sm) - nowMins;

        if (diff === 5 && !shownReminders.has(`${p.id}_5`)) {
          shownReminders.add(`${p.id}_5`);
          setReminderActive({
            title: '⏰ 5 Minutes to Go!',
            body: `${p.code} — ${p.name} starts in 5 minutes at ${p.startTime}. Please queue up candidates.`
          });
        } else if (diff === 0 && !shownReminders.has(`${p.id}_0`)) {
          shownReminders.add(`${p.id}_0`);
          setReminderActive({
            title: '🎤 Competition Starting!',
            body: `${p.code} — ${p.name} is starting now! Proceed to stage: ${p.venue || 'Assigned stage'}.`
          });
        }
      });
    };

    const interval = setInterval(checkReminders, 20000);
    return () => clearInterval(interval);
  }, [db.programs]);

  const handleUpdateDb = (newDb: Database) => {
    const updatedWithTimestamp: Database = {
      ...newDb,
      lastModified: Math.max(Date.now(), (dbRef.current?.lastModified || 0) + 1)
    };
    const pointsCalculated = calculatePoints(updatedWithTimestamp);
    const saved = saveDBLocal(pointsCalculated);
    dbRef.current = saved;
    setDb(saved);

    pushToServer(saved).then(res => {
      if (res && res.success && res.serverDb) {
        const normalized = normalizeDB(res.serverDb) || res.serverDb;
        if ((normalized.lastModified || 0) > (dbRef.current?.lastModified || 0)) {
          const merged = mergeDatabase(dbRef.current, normalized);
          const calculated = calculatePoints(merged);
          saveDBLocal(calculated, true);
          dbRef.current = calculated;
          setDb(calculated);
        }
      }
    });
    pushToFirebase(saved);
    pushToAppsScriptDirect(saved).catch(() => {});

    // Auto sync to Google Sheets (via OAuth API or Apps Script Direct)
    const sheetId = getSavedSheetId(saved);
    const token = getCachedToken();
    queueAutoSyncToGoogleSheet(saved, sheetId, token, 1000);

    // Instant BroadcastChannel signal for local browser windows/tabs
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const BC = (window as any).BroadcastChannel;
        const channel = new BC('mrms_db_channel');
        channel.postMessage({ type: 'SYNC_NOW', time: Date.now() });
        channel.close();
      } catch (e) {}
    }
  };

  const handleSavePoints = (points: Database['settings']['points']) => {
    handleUpdateDb({
      ...db,
      settings: {
        ...db.settings,
        points
      }
    });
  };

  const handleSaveEventInfo = (info: { 
    eventName: string; 
    boardName: string; 
    subtitle: string; 
    eventLogo?: string;
    showFinalWinner?: boolean; 
    showScoreboard?: boolean; 
    showCandidatePoints?: boolean;
    showDetailedScoreboard?: boolean;
    showIndividualChampions?: boolean;
    showNotice?: boolean;
    noticeTitle?: string;
    noticeText?: string;
    notices?: NoticeItem[];
    noticeDurationSecs?: number;
    colorTheme?: 'natural' | 'outdoor-light' | 'outdoor-dark' | 'solar-high-contrast' | 'royal-gold' | 'emerald-luxury' | 'crimson-ruby' | 'ocean-breeze';
    isPublicSiteOffline?: boolean;
    offlineMessage?: string;
  }) => {
    handleUpdateDb({
      ...db,
      settings: {
        ...db.settings,
        eventName: info.eventName,
        boardName: info.boardName,
        subtitle: info.subtitle,
        eventLogo: info.eventLogo,
        showFinalWinner: info.showFinalWinner !== undefined ? info.showFinalWinner : db.settings.showFinalWinner,
        showScoreboard: info.showScoreboard !== undefined ? info.showScoreboard : true,
        showCandidatePoints: info.showCandidatePoints !== undefined ? info.showCandidatePoints : true,
        showDetailedScoreboard: info.showDetailedScoreboard !== undefined ? info.showDetailedScoreboard : true,
        showIndividualChampions: info.showIndividualChampions !== undefined ? info.showIndividualChampions : true,
        showNotice: info.showNotice,
        noticeTitle: info.noticeTitle,
        noticeText: info.noticeText,
        notices: info.notices || db.settings.notices,
        noticeDurationSecs: info.noticeDurationSecs,
        colorTheme: info.colorTheme || db.settings.colorTheme || 'natural',
        isPublicSiteOffline: info.isPublicSiteOffline !== undefined ? info.isPublicSiteOffline : db.settings.isPublicSiteOffline,
        offlineMessage: info.offlineMessage !== undefined ? info.offlineMessage : db.settings.offlineMessage
      }
    });
  };

  const handleUpdatePassword = (current: string, next: string): boolean => {
    if (current !== db.settings.adminPassword) return false;
    handleUpdateDb({
      ...db,
      settings: {
        ...db.settings,
        adminPassword: next
      }
    });
    return true;
  };

  const handleUpdatePin = (current: string, next: string): boolean => {
    if (current !== db.settings.adminPin) return false;
    handleUpdateDb({
      ...db,
      settings: {
        ...db.settings,
        adminPin: next
      }
    });
    return true;
  };

  const handleFirebaseUrlChange = (url: string) => {
    setFirebaseUrl(url);
    handleUpdateDb({ ...db }); // trigger save to push offline backup
  };

  const handleImportBackup = (imported: Database) => {
    handleUpdateDb(imported);
  };

  const handleSaveTeams = (updatedTeams: Team[]) => {
    handleUpdateDb({
      ...db,
      teams: updatedTeams,
      lastModified: Date.now()
    });
  };

  const handleClearAllData = async () => {
    const clean = defaultDB();
    const clearedDb: Database = {
      ...clean,
      settings: {
        ...clean.settings,
        adminPassword: db.settings?.adminPassword || 'admin',
        adminPin: db.settings?.adminPin || '1234'
      },
      lastModified: Date.now() + 5000000000
    };
    saveDBLocal(clearedDb, true);
    setDb(clearedDb);
    dbRef.current = clearedDb;

    // 1. Sync to local server memory & file
    await pushToServer(clearedDb).catch(() => {});

    // 2. Overwrite Firestore persistent state completely without merging old docs
    await resetFirestoreClean(clearedDb).catch(() => {});
  };

  const handleBulkImportParticipants = (list: any[]) => {
    const newParticipants = [...db.participants];

    list.forEach(entry => {
      // Find or create participant
      const programIds: string[] = [];
      entry.codes.forEach((code: string) => {
        const prog = db.programs.find(p => p.code.toLowerCase() === code.toLowerCase());
        if (prog) programIds.push(prog.id);
      });

      const age = classToAge(entry.cls);

      newParticipants.push({
        id: generateId(),
        number: entry.number || '',
        name: entry.name,
        cls: entry.cls,
        division: entry.division,
        teamId: entry.teamId,
        gender: entry.gender,
        age: age,
        programIds: programIds
      });
    });

    handleUpdateDb({
      ...db,
      participants: newParticipants
    });
  };

  const handleBulkImportPrograms = (programList: Array<{
    code: string;
    name: string;
    stageType?: 'Main Stage' | 'Offstage';
    gender?: 'Boys' | 'Girls' | 'General';
    age?: 'Kids' | 'Sub Junior' | 'Junior' | 'Senior' | 'Super Senior' | 'All';
    single?: boolean;
    group?: boolean;
    day?: string;
    startTime?: string;
    endTime?: string;
    venue?: string;
    schedule?: string;
  }>) => {
    const updatedPrograms = [...db.programs];

    programList.forEach(entry => {
      const existingIndex = updatedPrograms.findIndex(p => p.code.toLowerCase() === entry.code.toLowerCase());
      
      const categoryObj: ProgramCategory = {
        gender: entry.gender || 'Boys',
        age: entry.age || 'Junior'
      };

      if (existingIndex >= 0) {
        const existing = updatedPrograms[existingIndex];
        const hasCat = existing.categories.some(c => c.gender === categoryObj.gender && c.age === categoryObj.age);
        const newCats = hasCat ? existing.categories : [...existing.categories, categoryObj];

        updatedPrograms[existingIndex] = {
          ...existing,
          name: entry.name || existing.name,
          stageType: entry.stageType || existing.stageType || 'Main Stage',
          day: entry.day || existing.day || 'Day 1',
          startTime: entry.startTime || existing.startTime || '',
          endTime: entry.endTime || existing.endTime || '',
          venue: entry.venue !== undefined ? entry.venue : existing.venue,
          schedule: entry.schedule !== undefined ? entry.schedule : existing.schedule,
          single: entry.single !== undefined ? entry.single : existing.single,
          group: entry.group !== undefined ? entry.group : existing.group,
          categories: newCats
        };
      } else {
        updatedPrograms.push({
          id: generateId(),
          code: entry.code,
          name: entry.name,
          day: entry.day || 'Day 1',
          venue: entry.venue || '',
          startTime: entry.startTime || '',
          endTime: entry.endTime || '',
          duration: '10 min',
          description: '',
          maxParticipants: null,
          single: entry.single !== undefined ? entry.single : true,
          group: entry.group !== undefined ? entry.group : false,
          stageType: entry.stageType || 'Main Stage',
          schedule: entry.schedule || '',
          categories: [categoryObj]
        });
      }
    });

    handleUpdateDb({
      ...db,
      programs: updatedPrograms
    });
  };

  const handleForceSync = async () => {
    const ok = await pushToFirebase(db);
    if (ok) {
      alert('✅ Force Push Successful! Mapped points and stats synced across all platforms.');
    } else {
      alert('⚠️ Connection failed. Please check the Firebase Endpoint URL or internet connection.');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem('mrms_admin');
    setCurrentView('home');
  };

  const handleGenerateReport = (filename: string, title: string, bodyHTML: string) => {
    const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #152c20; padding: 24px; margin: 0; background: #fff; }
    h1 { color: #0b3a2a; font-size: 22px; margin: 0 0 4px; font-family: serif; border-bottom: 2px solid #e3dcc6; padding-bottom: 8px; }
    h2 { font-size: 16px; background: #0f4a36; color: #fff; padding: 8px 12px; border-radius: 6px; margin: 24px 0 10px; }
    h3 { font-size: 14px; color: #9a6f0f; border-bottom: 1.5px solid #cf9d2e; padding-bottom: 4px; margin: 16px 0 8px; }
    p.meta { font-size: 11px; color: #666; margin: 0 0 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
    th { background: #e3f1e7; font-weight: bold; color: #0b3a2a; }
    tr:nth-child(even) { background-color: #fcfcf9; }
    .cat-block { page-break-inside: avoid; margin-bottom: 24px; }
    .team-block { margin-bottom: 24px; }
    .team-block.new-page { page-break-before: always; }
    .print-hint { background: #fbf0d4; border: 1px solid #cf9d2e; color: #9a6f0f; padding: 12px 16px; border-radius: 10px; font-size: 12px; margin-bottom: 20px; font-weight: 500; }
    @media print { .print-hint { display: none !important; } body { padding: 10px; } }
  </style>
</head>
<body>
  <div class="print-hint">📲 To save as PDF or Print: Tap the browser options (⋮ or ⋯ or Share) and choose "Print".</div>
  ${bodyHTML}
</body>
</html>`;

    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleAddResultDirectly = (programId: string) => {
    setCurrentView('dashboard');
    // We can let the dashboard know or let it handle directly
  };

  const handleTogglePublicSite = (isOffline: boolean) => {
    handleUpdateDb({
      ...db,
      settings: {
        ...db.settings,
        isPublicSiteOffline: isOffline
      },
      lastModified: Date.now()
    });
  };

  // If Public Link is turned OFF by Admin, render 404 Error screen for non-admin devices
  if (db.settings?.isPublicSiteOffline && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
        {/* Background ambient glow */}
        <div className="absolute w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -top-20 -left-20" />
        <div className="absolute w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20" />

        <div className="max-w-md w-full bg-slate-800/90 backdrop-blur-md border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10 animate-scaleIn">
          {/* 404 Badge & Visual */}
          <div className="w-20 h-20 bg-red-500/15 border-2 border-red-500/40 rounded-3xl flex items-center justify-center text-red-400 mx-auto shadow-inner">
            <WifiOff className="w-10 h-10 animate-pulse" />
          </div>

          <div>
            <span className="inline-block px-3.5 py-1 bg-red-500/20 text-red-300 font-mono font-black text-xs rounded-full border border-red-500/30 mb-3 tracking-widest uppercase">
              HTTP 404 &bull; PAGE NOT FOUND
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold font-display text-white tracking-tight">
              Page Not Found (Public Link Offline)
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-3 leading-relaxed">
              {db.settings.offlineMessage || 'This public link is currently switched off by the Event Administrator. It will be turned back ON when results and updates are published.'}
            </p>
          </div>

          <div className="p-4 bg-slate-900/70 rounded-2xl border border-slate-700/60 text-left space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Admin Notice:</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Public visitors cannot access event details right now. Admins can log in using their password to manage the event and enable the link.
            </p>
          </div>

          {/* Admin Login Toggle on 404 Page */}
          {showAdminLoginModal ? (
            <div className="text-left pt-2 border-t border-slate-700">
              <button
                onClick={() => setShowAdminLoginModal(false)}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold underline mb-3 inline-flex items-center gap-1 cursor-pointer"
              >
                ← Back to 404 Offline Message
              </button>
              <AdminLogin 
                settings={db.settings} 
                onLoginSuccess={() => {
                  setIsAdmin(true);
                  sessionStorage.setItem('mrms_admin', '1');
                  setShowAdminLoginModal(false);
                }} 
              />
            </div>
          ) : (
            <button
              onClick={() => setShowAdminLoginModal(true)}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs md:text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 border border-amber-400/40"
            >
              <Lock className="w-4 h-4" />
              <span>🔐 Admin Portal Login</span>
            </button>
          )}
        </div>

        <p className="text-[11px] text-slate-500 mt-6 font-mono">
          {db.settings.eventName || 'KALIMA 2k26 MEELAD FEST'} &bull; Managed by Abdul Haseeb PC
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Top Banner when Public Link is OFF & Admin is logged in */}
      {isAdmin && db.settings?.isPublicSiteOffline && (
        <div className="bg-gradient-to-r from-red-600 via-rose-700 to-red-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md z-50 no-print">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
            <span>🔴 PUBLIC LINK IS OFF (404 Mode Active) - Public devices see 404. Only logged-in Admins can view this app.</span>
          </div>
          <button
            onClick={() => handleTogglePublicSite(false)}
            className="px-3 py-1 bg-white text-red-700 hover:bg-red-50 font-black rounded-lg shadow-xs transition-transform active:scale-95 cursor-pointer text-[11px] shrink-0"
          >
            ⚡ Turn Link ON for Everyone
          </button>
        </div>
      )}

      {showSplash && (
        <Splash db={db} onExplore={() => setShowSplash(false)} />
      )}

      {/* Main Container */}
      <div className="min-h-screen pb-10 relative flex flex-col">
        <div className="bg-motif" />

        <Header 
          currentView={currentView} 
          onNavigate={(view) => setCurrentView(view)} 
          isAdmin={isAdmin}
          onLogout={handleLogout}
          db={db}
          onTogglePublicSite={handleTogglePublicSite}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
        />

        {/* View Router Routing */}
        <main className="flex-1 px-4 py-4 max-w-3xl mx-auto w-full no-print">
          {currentView === 'home' && (
            <Home 
              db={db} 
              onNavigateToResults={() => setCurrentView('results')} 
              onUpdateDb={handleUpdateDb}
            />
          )}

          {currentView === 'results' && (
            <Results 
              db={db} 
            />
          )}

          {currentView === 'scoreboard' && (
            <Scoreboard db={db} onUpdateDb={handleUpdateDb} />
          )}

          {currentView === 'programs' && (
            <Programs db={db} onGenerateReport={handleGenerateReport} />
          )}

          {currentView === 'candidateSearch' && (
            <CandidateSearch db={db} />
          )}

          {currentView === 'categories' && (
            <CategoriesGuide db={db} />
          )}

          {currentView === 'about' && (
            <About db={db} />
          )}

          {currentView === 'settings' && (
            isAdmin ? (
              <Settings 
                db={db} 
                onSavePoints={handleSavePoints}
                onSaveEventInfo={handleSaveEventInfo}
                onUpdatePassword={handleUpdatePassword}
                onUpdatePin={handleUpdatePin}
                onFirebaseUrlChange={handleFirebaseUrlChange}
                onImportBackup={handleImportBackup}
                onBulkImportParticipants={handleBulkImportParticipants}
                onBulkImportPrograms={handleBulkImportPrograms}
                onSaveTeams={handleSaveTeams}
                onClearAllData={handleClearAllData}
                onLogout={handleLogout}
                isAdmin={isAdmin}
                onForceSync={handleForceSync}
                onGenerateReport={handleGenerateReport}
              />
            ) : (
              <AdminLogin 
                settings={db.settings} 
                onLoginSuccess={() => {
                  setIsAdmin(true);
                  sessionStorage.setItem('mrms_admin', '1');
                  setCurrentView('settings');
                }} 
              />
            )
          )}

          {currentView === 'adminGate' && (
            <AdminLogin 
              settings={db.settings} 
              onLoginSuccess={() => {
                setIsAdmin(true);
                sessionStorage.setItem('mrms_admin', '1');
                setCurrentView('dashboard');
              }} 
            />
          )}

          {currentView === 'dashboard' && (
            isAdmin ? (
              <AdminDashboard 
                db={db} 
                onUpdateDb={handleUpdateDb} 
                onAddResultDirectly={(pid) => handleAddResultDirectly(pid)}
                onBulkImportPrograms={handleBulkImportPrograms}
              />
            ) : (
              <AdminLogin 
                settings={db.settings} 
                onLoginSuccess={() => {
                  setIsAdmin(true);
                  sessionStorage.setItem('mrms_admin', '1');
                  setCurrentView('dashboard');
                }} 
              />
            )
          )}
        </main>
      </div>

      {/* Alarm Alerts Reminder overlay */}
      {reminderActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
          <div className="bg-brand-panel border border-brand-line max-w-sm w-full rounded-2xl p-6 text-center space-y-4 shadow-2xl animate-scaleIn">
            <div className="w-14 h-14 bg-brand-gold-100 text-brand-gold-700 rounded-full flex items-center justify-center text-2xl mx-auto shadow-inner">
              ⏰
            </div>
            <div className="space-y-1.5 select-none">
              <h3 className="font-display font-extrabold text-brand-green-950 text-sm md:text-base leading-tight">
                {reminderActive.title}
              </h3>
              <p className="text-xs text-brand-ink-soft leading-relaxed">
                {reminderActive.body}
              </p>
            </div>
            <button
              onClick={() => setReminderActive(null)}
              className="w-full py-3 bg-brand-green-800 hover:bg-brand-green-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-colors"
            >
              Okay, Understood
            </button>
          </div>
        </div>
      )}
    </>
  );
}
