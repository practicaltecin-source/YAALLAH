import { Database, Team, Program, Participant, Result, Settings } from './types';
import { saveToFirestore, fetchFromFirestore, resetFirestoreClean } from './firebase';
import { 
  getSavedSheetId, 
  getCachedToken, 
  isAutoSyncEnabled, 
  fetchDataFromGoogleSheet,
  fetchPublicGoogleSheetData,
  HARDCODED_GOOGLE_SHEET_ID
} from './googleSheets';
import initialSeedData from '../db.json';

export const GENDERS = ['Boys', 'Girls', 'General'] as const;
export const AGES = ['Kids', 'Sub Junior', 'Junior', 'Senior', 'Super Senior'] as const;
export const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export const DIVISIONS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export const AGE_ICONS: Record<string, string> = {
  'Kids': '🧒',
  'Sub Junior': '🎒',
  'Junior': '⭐',
  'Senior': '🔥',
  'Super Senior': '🎓',
  'All': '🌐'
};

export const GENDER_ICONS: Record<string, string> = {
  'Boys': '👦',
  'Girls': '👧',
  'General': '🌐'
};

export const STORAGE_KEY = 'fest_portal_db_v1';
export const FIREBASE_URL_KEY = 'mrms_firebase_url';
export const HARDCODED_FIREBASE_URL = '';

export const AGE_CLASS_MAP: Record<string, string> = {
  'Kids': 'Class 1, 2',
  'Sub Junior': 'Class 3, 4',
  'Junior': 'Class 5, 6',
  'Senior': 'Class 7, 8',
  'Super Senior': 'Class 9, 10, 11, 12',
  'All': 'All Classes (1-12)',
  'General': 'Class 5-12 (Open to Class 5 & Above)'
};

export function classToAge(cls: string | number): typeof AGES[number] {
  const parsed = parseInt(String(cls), 10);
  if (parsed === 1 || parsed === 2) return 'Kids';
  if (parsed === 3 || parsed === 4) return 'Sub Junior';
  if (parsed === 5 || parsed === 6) return 'Junior';
  if (parsed === 7 || parsed === 8) return 'Senior';
  if (parsed >= 9 && parsed <= 12) return 'Super Senior';
  return 'Kids';
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export const DEFAULT_TEAMS: Team[] = [
  {
    id: 'team_a',
    name: 'Team A',
    symbol: '🟢',
    color: '#10b981',
    points: 0,
    captain: '',
    viceCaptain: ''
  },
  {
    id: 'team_b',
    name: 'Team B',
    symbol: '🔵',
    color: '#3b82f6',
    points: 0,
    captain: '',
    viceCaptain: ''
  },
  {
    id: 'team_c',
    name: 'Team C',
    symbol: '🔴',
    color: '#ef4444',
    points: 0,
    captain: '',
    viceCaptain: ''
  },
  {
    id: 'team_d',
    name: 'Team D',
    symbol: '🟡',
    color: '#f59e0b',
    points: 0,
    captain: '',
    viceCaptain: ''
  }
];

export function defaultDB(): Database {
  return {
    teams: DEFAULT_TEAMS,
    programs: [],
    participants: [],
    results: [],
    settings: {
      points: {
        first: 10,
        second: 7,
        third: 5,
        generalFirst: 15,
        generalSecond: 10,
        generalThird: 7,
        participation: 1,
        gradeA: 5,
        gradeB: 3,
        gradeC: 1
      },
      adminPassword: 'admin',
      adminPin: '1234',
      eventName: 'ARTS FEST 2026',
      boardName: 'LIVE SCOREBOARD',
      subtitle: 'Live Competition Results, Scoring Points & Schedules',
      showFinalWinner: false,
      showScoreboard: true,
      showDetailedScoreboard: true,
      isPublicSiteOffline: false,
      notices: []
    },
    prevRanks: {},
    lastModified: 1
  };
}

function cleanText(str: string): string {
  if (!str) return '';
  let cleaned = str.replace(/\(\s*\)/g, '').replace(/\/\s*$/, '').replace(/^\s*\//, '').trim();
  return cleaned;
}

export function normalizeDB(parsed: any): Database | null {
  if (!parsed || !parsed.settings) return null;
  if (!parsed.teams) parsed.teams = [];
  if (!parsed.settings.points) {
    parsed.settings.points = { first: 10, second: 7, third: 5, generalFirst: 15, generalSecond: 10, generalThird: 7, participation: 1, gradeA: 5, gradeB: 3, gradeC: 1 };
  } else {
    if (parsed.settings.points.generalFirst === undefined) parsed.settings.points.generalFirst = 15;
    if (parsed.settings.points.generalSecond === undefined) parsed.settings.points.generalSecond = 10;
    if (parsed.settings.points.generalThird === undefined) parsed.settings.points.generalThird = 7;
  }
  if (!parsed.settings.adminPin) parsed.settings.adminPin = '1234';

  const DEFAULT_EVENT_NAME = 'ARTS FEST 2026';
  if (!parsed.settings.eventName) {
    parsed.settings.eventName = DEFAULT_EVENT_NAME;
  }
  if (!parsed.settings.boardName) {
    parsed.settings.boardName = 'LIVE SCOREBOARD';
  }
  if (!parsed.settings.subtitle) parsed.settings.subtitle = 'Live Competition Results, Scoring Points & Schedules';
  
  parsed.settings.eventName = cleanText(parsed.settings.eventName) || DEFAULT_EVENT_NAME;
  parsed.settings.boardName = cleanText(parsed.settings.boardName) || 'LIVE SCOREBOARD';
  parsed.settings.subtitle = cleanText(parsed.settings.subtitle) || 'Live Competition Results, Scoring Points & Schedules';

  if (parsed.settings.showFinalWinner === undefined) parsed.settings.showFinalWinner = false;
  if (parsed.settings.isLiveCelebrationActive === undefined) parsed.settings.isLiveCelebrationActive = false;
  if (parsed.settings.isPublicSiteOffline === undefined) parsed.settings.isPublicSiteOffline = false;
  else parsed.settings.isPublicSiteOffline = Boolean(parsed.settings.isPublicSiteOffline);
  if (parsed.settings.showScoreboard === undefined) parsed.settings.showScoreboard = true;
  if (parsed.settings.showDetailedScoreboard === undefined) parsed.settings.showDetailedScoreboard = true;
  if (parsed.settings.eventLogo === undefined) parsed.settings.eventLogo = '';
  if (!parsed.settings.colorTheme) parsed.settings.colorTheme = 'natural';
  
  if (parsed.settings.notices && Array.isArray(parsed.settings.notices)) {
    parsed.settings.notices = parsed.settings.notices.map((n: any) => ({
      ...n,
      title: cleanText(n.title) || n.title,
      text: cleanText(n.text) || n.text,
      sponsorName: cleanText(n.sponsorName || '')
    }));
  } else if (!parsed.settings.notices || !Array.isArray(parsed.settings.notices)) {
    if (parsed.settings.noticeText) {
      parsed.settings.notices = [{
        id: 'notice_1',
        title: cleanText(parsed.settings.noticeTitle || '') || '📢 NOTICE BOARD',
        text: cleanText(parsed.settings.noticeText || ''),
        type: 'urgent',
        active: true,
        date: new Date().toLocaleDateString()
      }];
    } else {
      parsed.settings.notices = [];
    }
  }
  if (!parsed.settings.googleSheetId) parsed.settings.googleSheetId = HARDCODED_GOOGLE_SHEET_ID;
  if (!parsed.settings.appsScriptUrl) parsed.settings.appsScriptUrl = HARDCODED_APPS_SCRIPT_URL;
  if (!parsed.settings.sheetWebhookUrl) parsed.settings.sheetWebhookUrl = HARDCODED_APPS_SCRIPT_URL;

  if (!parsed.lastModified) parsed.lastModified = 0;

  let parsedTeams = (parsed.teams || []).map((t: any) => ({
    ...t,
    name: cleanText(t.name) || t.name,
    captain: cleanText(t.captain || '')
  }));

  if (parsedTeams.length === 0) {
    parsedTeams = [...DEFAULT_TEAMS];
  }

  const teams = parsedTeams;
  const validTeamIds = new Set(teams.map((t: any) => t.id));

  const programs = (parsed.programs || [])
    .map((p: any) => {
      let st = (p.startTime || '').toString().trim();
      let et = (p.endTime || '').toString().trim();
      // Sanitize corrupted time fields containing gender keywords
      if (st.toLowerCase().includes('boy') || st.toLowerCase().includes('girl') || st.toLowerCase().includes('general')) st = '';
      if (et.toLowerCase().includes('boy') || et.toLowerCase().includes('girl') || et.toLowerCase().includes('general')) et = '';
      return {
        ...p,
        name: cleanText(p.name || ''),
        venue: cleanText(p.venue || ''),
        startTime: st,
        endTime: et
      };
    })
    .filter((p: any) => {
      if (!p) return false;
      const name = (p.name || '').toString().trim();
      const code = (p.code || '').toString().trim();
      if (!name || name === 'undefined' || name === 'null' || name.toUpperCase() === 'PROGRAM NAME' || name.toUpperCase() === 'NAME') return false;
      if (!code || code === 'undefined' || code === 'null' || code.toUpperCase() === 'CODE' || code === '-') return false;
      return true;
    });

  const validProgIds = new Set(programs.map((p: any) => p.id));

  const rawParticipants = (parsed.participants || [])
    .filter((p: any) => p && (p.name || p.number))
    .map((p: any) => {
      const rawProgs = Array.isArray(p.programIds) ? p.programIds : (p.programId ? [p.programId] : []);
      // Filter out non-existent program IDs from participant enrolments
      const validEnrolled = rawProgs.filter((id: string) => validProgIds.has(id));
      return {
        ...p,
        name: cleanText(p.name) || p.name,
        number: (p.number || '').toString().trim(),
        programIds: validEnrolled,
        teamId: validTeamIds.has(p.teamId) ? p.teamId : (teams[0]?.id || p.teamId),
        cls: p.cls ?? '',
        division: p.division ?? '',
        age: p.cls ? classToAge(p.cls) : (p.age || 'Kids')
      };
    });

  // Auto-deduplicate candidates to prevent duplicate rows in sheets & UI
  const seenParticipantKeys = new Map<string, Participant>();
  rawParticipants.forEach((pa: any) => {
    const cNum = (pa.number || '').trim().toLowerCase();
    const cName = (pa.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const key = cNum && cNum !== '-' ? `chest_${cNum}` : `name_${cName}`;

    if (key && seenParticipantKeys.has(key)) {
      const existing = seenParticipantKeys.get(key)!;
      existing.programIds = Array.from(new Set([...(existing.programIds || []), ...(pa.programIds || [])]));
      if (!existing.cls && pa.cls) existing.cls = pa.cls;
      if (!existing.division && pa.division) existing.division = pa.division;
      if (!existing.teamId && pa.teamId) existing.teamId = pa.teamId;
    } else {
      seenParticipantKeys.set(key, { ...pa });
    }
  });

  const participants = Array.from(seenParticipantKeys.values());

  // Clean up and deduplicate results (remove orphaned results pointing to deleted programs)
  const resultsByProgram = new Map<string, any>();
  (parsed.results || []).forEach((r: any) => {
    if (!r || !r.programId || !validProgIds.has(r.programId)) return; // Purge orphaned result

    const winners = r.winners || {};
    const grades = r.grades || { gradeA: [], gradeB: [], gradeC: [], participation: [] };

    const cleanedResult = {
      ...r,
      winners: {
        first: (Array.isArray(winners.first) ? winners.first : (winners.first ? [winners.first] : [])).filter(Boolean),
        second: (Array.isArray(winners.second) ? winners.second : (winners.second ? [winners.second] : [])).filter(Boolean),
        third: (Array.isArray(winners.third) ? winners.third : (winners.third ? [winners.third] : [])).filter(Boolean)
      },
      grades: {
        gradeA: (Array.isArray(grades.gradeA) ? grades.gradeA : []).filter(Boolean),
        gradeB: (Array.isArray(grades.gradeB) ? grades.gradeB : []).filter(Boolean),
        gradeC: (Array.isArray(grades.gradeC) ? grades.gradeC : []).filter(Boolean),
        participation: (Array.isArray(grades.participation) ? grades.participation : []).filter(Boolean)
      }
    };

    // Keep the latest result if duplicates exist
    if (!resultsByProgram.has(r.programId) || (r.datetime && new Date(r.datetime) > new Date(resultsByProgram.get(r.programId).datetime))) {
      resultsByProgram.set(r.programId, cleanedResult);
    }
  });

  const results = Array.from(resultsByProgram.values());

  return {
    ...parsed,
    participants,
    results
  };
}

export const BACKUP_STORAGE_KEY = 'fest_portal_db_backup_v1';

export function loadDB(): Database {
  try {
    ['mrms_db_v1', 'mrms_db_v2', 'mrms_db_v3', 'mrms_db_v4', 'mrms_db_v5', 'mrms_db_v10_reset', 'mrms_db_v100_clean', 'mrms_db_v105_english_pro'].forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const normalized = normalizeDB(parsed);
      if (normalized) {
        const hasData = (normalized.programs?.length || 0) > 0 || (normalized.participants?.length || 0) > 0 || (normalized.results?.length || 0) > 0;
        if (hasData) return normalized;
      }
    }

    // Secondary recovery check: immutable backup key
    const rawBackup = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (rawBackup) {
      const parsedBackup = JSON.parse(rawBackup);
      const normalizedBackup = normalizeDB(parsedBackup);
      if (normalizedBackup) {
        const hasBackupData = (normalizedBackup.programs?.length || 0) > 0 || (normalizedBackup.participants?.length || 0) > 0 || (normalizedBackup.results?.length || 0) > 0;
        if (hasBackupData) return normalizedBackup;
      }
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeDB(parsed) || defaultDB();
    }
    return defaultDB();
  } catch (e) {
    return defaultDB();
  }
}

export function saveDBLocal(db: Database, preserveTimestamp: boolean = false): Database {
  const updated: Database = {
    ...db,
    lastModified: preserveTimestamp ? (db.lastModified || Date.now()) : Math.max(Date.now(), (db.lastModified || 0) + 1)
  };
  try {
    const serialized = JSON.stringify(updated);
    localStorage.setItem(STORAGE_KEY, serialized);
    
    // Save backup if non-empty
    const hasData = (updated.programs?.length || 0) > 0 || (updated.participants?.length || 0) > 0 || (updated.results?.length || 0) > 0;
    if (hasData) {
      localStorage.setItem(BACKUP_STORAGE_KEY, serialized);
    }

    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('mrms_db_channel');
      channel.postMessage({ type: 'DB_UPDATED', lastModified: updated.lastModified });
      channel.close();
    }
  } catch (e) {
    console.error('Failed to update local storage:', e);
  }
  return updated;
}

export function getFirebaseUrl(): string {
  const saved = localStorage.getItem(FIREBASE_URL_KEY);
  return saved !== null ? saved : HARDCODED_FIREBASE_URL;
}

export function setFirebaseUrl(url: string) {
  const sanitized = url.trim().replace(/\/+$/, '');
  if (sanitized) {
    localStorage.setItem(FIREBASE_URL_KEY, sanitized);
  } else {
    localStorage.removeItem(FIREBASE_URL_KEY);
  }
}

export async function pushToFirebase(db: Database): Promise<boolean> {
  const updated = { ...db, lastModified: Date.now() };
  saveDBLocal(updated, true);

  // Push to Firestore Cloud Database for instant multi-device real-time sync across Netlify / GitHub Pages
  const firestoreOk = await saveToFirestore(updated).catch(() => false);

  // Also push to local server endpoint
  pushToServer(updated).catch(() => {});

  // Also push to Google Sheet via Apps Script
  pushToAppsScriptDirect(updated).catch(() => {});

  return firestoreOk || true;
}


export function mergeSettings(localSettings: Settings, remoteSettings: Settings, preferRemote: boolean = false): Settings {
  if (!localSettings) return remoteSettings || defaultDB().settings;
  if (!remoteSettings) return localSettings;

  const base = preferRemote 
    ? { ...defaultDB().settings, ...localSettings, ...remoteSettings }
    : { ...defaultDB().settings, ...remoteSettings, ...localSettings };

  // When preferRemote is true (newer remote data), accept remote offline status; otherwise keep local offline status
  const isPublicSiteOffline = preferRemote
    ? (remoteSettings.isPublicSiteOffline !== undefined ? Boolean(remoteSettings.isPublicSiteOffline) : Boolean(localSettings.isPublicSiteOffline))
    : (localSettings.isPublicSiteOffline !== undefined ? Boolean(localSettings.isPublicSiteOffline) : Boolean(remoteSettings.isPublicSiteOffline));

  return {
    ...base,
    isPublicSiteOffline,
    offlineMessage: preferRemote ? (remoteSettings.offlineMessage || localSettings.offlineMessage || base.offlineMessage) : (localSettings.offlineMessage || remoteSettings.offlineMessage || base.offlineMessage),
    showNotice: preferRemote ? (remoteSettings.showNotice !== undefined ? remoteSettings.showNotice : localSettings.showNotice) : (localSettings.showNotice !== undefined ? localSettings.showNotice : remoteSettings.showNotice),
    isLiveCelebrationActive: preferRemote ? (remoteSettings.isLiveCelebrationActive !== undefined ? remoteSettings.isLiveCelebrationActive : localSettings.isLiveCelebrationActive) : (localSettings.isLiveCelebrationActive !== undefined ? localSettings.isLiveCelebrationActive : remoteSettings.isLiveCelebrationActive),
  };
}

export function mergeDatabase(localDb: Database, remoteDb: Database, forcePreferRemote: boolean = false): Database {
  if (!localDb) return remoteDb;
  if (!remoteDb) return localDb;

  const localHasData = (localDb.programs?.length || 0) > 0 || (localDb.participants?.length || 0) > 0 || (localDb.results?.length || 0) > 0;
  const remoteHasData = (remoteDb.programs?.length || 0) > 0 || (remoteDb.participants?.length || 0) > 0 || (remoteDb.results?.length || 0) > 0;

  // SAFETY 1: Never wipe existing data with an empty remote snapshot
  if (localHasData && !remoteHasData && !remoteDb.isExplicitReset) {
    return localDb;
  }

  // SAFETY 2: If local device is completely empty (e.g. freshly opened device/browser), adopt remote immediately
  if (!localHasData && remoteHasData) {
    return remoteDb;
  }

  if (forcePreferRemote && (remoteHasData || remoteDb.isExplicitReset)) {
    return remoteDb;
  }

  const localTime = Number(localDb.lastModified || 0);
  const remoteTime = Number(remoteDb.lastModified || 0);

  // If remote is explicit reset
  if (remoteDb.isExplicitReset && remoteTime >= localTime) {
    return remoteDb;
  }

  // If both have data, merge union of programs, participants, and results intelligently
  // 1. Teams: Merge
  const teamMap = new Map<string, Team>();
  (localDb.teams || []).forEach(t => teamMap.set(t.id, t));
  (remoteDb.teams || []).forEach(t => {
    if (!teamMap.has(t.id)) {
      teamMap.set(t.id, t);
    } else {
      const existing = teamMap.get(t.id)!;
      teamMap.set(t.id, {
        ...existing,
        name: t.name || existing.name,
        symbol: t.symbol || existing.symbol,
        color: t.color || existing.color,
        captain: t.captain || existing.captain,
        boysCaptain: t.boysCaptain || existing.boysCaptain,
        boysCaptain2: t.boysCaptain2 || existing.boysCaptain2,
        girlsCaptain: t.girlsCaptain || existing.girlsCaptain,
        girlsCaptain2: t.girlsCaptain2 || existing.girlsCaptain2,
        points: (remoteTime >= localTime && t.points !== undefined) ? t.points : existing.points
      });
    }
  });

  // 2. Programs: Merge union
  const progMap = new Map<string, Program>();
  (localDb.programs || []).forEach(p => progMap.set(p.id, p));
  (remoteDb.programs || []).forEach(p => {
    if (!progMap.has(p.id)) {
      progMap.set(p.id, p);
    } else if (remoteTime >= localTime) {
      progMap.set(p.id, p);
    }
  });

  // 3. Participants: Merge union
  const partMap = new Map<string, Participant>();
  (localDb.participants || []).forEach(pa => partMap.set(pa.id, pa));
  (remoteDb.participants || []).forEach(pa => {
    if (!partMap.has(pa.id)) {
      partMap.set(pa.id, pa);
    } else if (remoteTime >= localTime) {
      partMap.set(pa.id, pa);
    }
  });

  // 4. Results: Merge union
  const resMap = new Map<string, Result>();
  (localDb.results || []).forEach(r => {
    const key = `${r.programId}_${r.gender || 'All'}_${r.age || 'All'}`;
    resMap.set(key, r);
  });
  (remoteDb.results || []).forEach(r => {
    const key = `${r.programId}_${r.gender || 'All'}_${r.age || 'All'}`;
    if (!resMap.has(key)) {
      resMap.set(key, r);
    } else if (remoteTime >= localTime) {
      resMap.set(key, r);
    }
  });

  const mergedSettings = mergeSettings(localDb?.settings, remoteDb?.settings, remoteTime >= localTime);

  return {
    ...localDb,
    teams: Array.from(teamMap.values()),
    programs: Array.from(progMap.values()),
    participants: Array.from(partMap.values()),
    results: Array.from(resMap.values()),
    settings: mergedSettings,
    prevRanks: { ...(localDb.prevRanks || {}), ...(remoteDb.prevRanks || {}) },
    lastModified: Math.max(localTime, remoteTime)
  };
}

export async function resetEntireDatabase(): Promise<Database> {
  const fresh = defaultDB();
  fresh.isExplicitReset = true;
  fresh.lastModified = Date.now() + 2000000000;
  try {
    localStorage.removeItem(BACKUP_STORAGE_KEY);
  } catch (e) {}
  saveDBLocal(fresh, true);
  await Promise.all([
    pushToServer(fresh).catch(() => {}),
    resetFirestoreClean(fresh).catch(() => {})
  ]);
  return fresh;
}

export async function fetchFromCloudSheet(): Promise<Database | null> {
  const sheetId = getSavedSheetId();
  const token = getCachedToken();
  if (sheetId && token) {
    return await fetchDataFromGoogleSheet(sheetId, token);
  }
  return null;
}

export const HARDCODED_APPS_SCRIPT_URL = '';

export async function fetchFromAppsScriptDirect(customUrl?: string): Promise<Database | null> {
  const url = customUrl || HARDCODED_APPS_SCRIPT_URL;
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { 
        'Accept': 'application/json, text/plain, */*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const text = await res.text();
      if (text && !text.includes('Script function not found') && !text.includes('<!DOCTYPE html>')) {
        try {
          const parsed = JSON.parse(text);
          const dbObj = parsed.db || parsed.data || parsed.result || parsed;
          if (dbObj && typeof dbObj === 'object' && Array.isArray(dbObj.teams)) {
            return normalizeDB(dbObj);
          }
        } catch (e) {}
      } else {
        // If response is HTML or Script function not found, abort early
        return null;
      }
    }

    // Secondary attempt: POST with { action: 'read' }
    const postController = new AbortController();
    const postTimeout = setTimeout(() => postController.abort(), 8000);

    const postRes = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: { 
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({ action: 'read' }),
      redirect: 'follow',
      signal: postController.signal
    });
    clearTimeout(postTimeout);

    if (postRes.ok) {
      const postText = await postRes.text();
      if (postText && !postText.includes('Script function not found') && !postText.includes('<!DOCTYPE html>')) {
        try {
          const parsed = JSON.parse(postText);
          const dbObj = parsed.db || parsed.data || parsed.result || parsed;
          if (dbObj && typeof dbObj === 'object' && Array.isArray(dbObj.teams)) {
            return normalizeDB(dbObj);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
  return null;
}

export async function pushToAppsScriptDirect(db: Database): Promise<boolean> {
  const targetUrl = db.settings?.sheetWebhookUrl || db.settings?.appsScriptUrl || HARDCODED_APPS_SCRIPT_URL;
  if (!targetUrl) return false;

  const updated = {
    ...db,
    lastModified: db.lastModified || Date.now()
  };
  const jsonPayload = JSON.stringify({ action: 'write', db: updated });

  // 1. Try via server proxy if running with Express server
  try {
    const proxyRes = await fetch('/api/webhook-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl,
        payload: { action: 'write', db: updated, lastModified: updated.lastModified },
        db: updated
      })
    });
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.success) return true;
    }
  } catch (proxyErr) {
    // Proxy not available in static/Vercel deployment, continue to direct client push
  }

  // 2. Direct push to Google Apps Script Web App using no-cors (bypasses browser CORS & redirects)
  try {
    await fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      headers: { 
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: jsonPayload,
    });
    return true;
  } catch (e) {
    console.warn('pushToAppsScriptDirect no-cors push warning:', e);
    return false;
  }
}

export async function pushToServer(db: Database): Promise<{ success: boolean; serverDb?: Database }> {
  try {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(db)
    });
    if (!res.ok) return { success: false };
    const data = await res.json();
    if (data.db) {
      return { success: data.success, serverDb: normalizeDB(data.db) || undefined };
    }
    return { success: res.ok };
  } catch (e) {
    return { success: false };
  }
}

export async function fetchFromServer(): Promise<Database | null> {
  try {
    const res = await fetch(`/api/db?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data) return null;
    return normalizeDB(data);
  } catch (e) {
    return null;
  }
}

export async function syncDatabase(localDb: Database): Promise<{ db: Database; updated: boolean }> {
  try {
    const [remoteFirestore, remoteServer, remoteSheet, remoteAppsScript, remotePublicSheet] = await Promise.all([
      fetchFromFirestore().catch(() => null),
      fetchFromServer().catch(() => null),
      fetchFromCloudSheet().catch(() => null),
      fetchFromAppsScriptDirect().catch(() => null),
      fetchPublicGoogleSheetData().catch(() => null)
    ]);

    const localHasData = (localDb?.programs?.length || 0) > 0 || (localDb?.participants?.length || 0) > 0 || (localDb?.results?.length || 0) > 0;

    // Filter valid remotes, ignoring uninitialized or empty responses when local or firestore has data
    const validRemotes = [remoteFirestore, remotePublicSheet, remoteAppsScript, remoteSheet, remoteServer].filter((r): r is Database => {
      if (!r || !Array.isArray(r.teams)) return false;
      const remoteHasData = (r.programs?.length || 0) > 0 || (r.participants?.length || 0) > 0 || (r.results?.length || 0) > 0;
      
      // If local already has data and remote is empty, ignore this remote (unless it's an intentional reset)
      if (localHasData && !remoteHasData && !r.isExplicitReset) {
        return false;
      }
      return true;
    });

    if (validRemotes.length === 0) {
      return { db: localDb, updated: false };
    }

    // Sort valid remotes so older remotes merge first and the newest remote wins
    validRemotes.sort((a, b) => (a.lastModified || 0) - (b.lastModified || 0));

    // Merge all valid remote sources sequentially starting with localDb
    let accumulator = localDb || defaultDB();
    let hasRemoteUpdate = false;

    for (const remote of validRemotes) {
      if (remote) {
        const merged = mergeDatabase(accumulator, remote);
        if (JSON.stringify(merged.results) !== JSON.stringify(accumulator.results) || 
            JSON.stringify(merged.participants) !== JSON.stringify(accumulator.participants) ||
            (remote.lastModified || 0) > (accumulator.lastModified || 0)) {
          hasRemoteUpdate = true;
        }
        accumulator = merged;
      }
    }

    const calculated = calculatePoints(accumulator);
    if (hasRemoteUpdate) {
      saveDBLocal(calculated, true);
    }

    return { db: calculated, updated: hasRemoteUpdate };
  } catch (e) {
    console.error('syncDatabase error:', e);
    return { db: localDb, updated: false };
  }
}


export function calculatePoints(db: Database): Database {
  const pts = db.settings.points;
  const teamMap = new Map<string, number>();

  db.teams.forEach(t => teamMap.set(t.id, 0));

  const progMap = new Map(db.programs.map(p => [p.id, p]));

  db.results.forEach(r => {
    const prog = progMap.get(r.programId);
    const isGeneralProg = prog?.categories.some(c => (c.gender as string) === 'General' || (c.age as string) === 'All' || (c.age as string) === 'General') || (r.gender as string) === 'General' || (r.age as string) === 'General' || (r.age as string) === 'All';

    // Standard winners
    ['first', 'second', 'third'].forEach(pos => {
      const key = pos as 'first' | 'second' | 'third';
      let points = pts[key];
      if (isGeneralProg) {
        if (key === 'first') points = pts.generalFirst ?? pts.first;
        else if (key === 'second') points = pts.generalSecond ?? pts.second;
        else if (key === 'third') points = pts.generalThird ?? pts.third;
      }

      (r.winners[key] || []).forEach(w => {
        if (w.teamId && teamMap.has(w.teamId)) {
          teamMap.set(w.teamId, teamMap.get(w.teamId)! + points);
        }
      });
    });

    // Grade entries
    ['gradeA', 'gradeB', 'gradeC', 'participation'].forEach(gradeKey => {
      const key = gradeKey as 'gradeA' | 'gradeB' | 'gradeC' | 'participation';
      const points = pts[key];
      (r.grades[key] || []).forEach(e => {
        if (e.teamId && teamMap.has(e.teamId)) {
          teamMap.set(e.teamId, teamMap.get(e.teamId)! + points);
        }
      });
    });
  });

  const updatedTeams = db.teams.map(t => ({
    ...t,
    points: teamMap.get(t.id) || 0
  }));

  return {
    ...db,
    teams: updatedTeams
  };
}
