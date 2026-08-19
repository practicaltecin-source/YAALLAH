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
export const BACKUP_STORAGE_KEY = 'fest_portal_db_backup_v1';
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
      noticePopupOnLoad: false,
      showLiveQuiz: true,
      notices: []
    },
    prevRanks: {},
    lastModified: 1,
    quizzes: []
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
      const validEnrolled = rawProgs.filter((id: string) => validProgIds.has(id));
      return {
        ...p,
        name: cleanText(p.name) || p.name,
        number: (p.number || '').toString().trim(),
        cls: p.cls !== undefined ? p.cls : (p.class !== undefined ? p.class : ''),
        division: cleanText(p.division || ''),
        teamId: p.teamId || null,
        gender: p.gender || 'Boys',
        age: p.age || 'Kids',
        programIds: validEnrolled
      };
    });

  const participantIds = new Set(rawParticipants.map((p: any) => p.id));

  const results = (parsed.results || [])
    .filter((r: any) => r && r.programId)
    .map((r: any) => {
      const filterValidWinners = (arr: any[]) => {
        if (!Array.isArray(arr)) return [];
        return arr.filter(w => {
          if (!w) return false;
          if (w.name && String(w.name).trim().length > 0) return true;
          if (w.candidateId && participantIds.has(w.candidateId)) return true;
          if (w.teamId && validTeamIds.has(w.teamId)) return true;
          return false;
        }).map(w => ({
          ...w,
          name: cleanText(w.name || ''),
          teamId: (w.teamId && validTeamIds.has(w.teamId)) ? w.teamId : null
        }));
      };

      return {
        id: r.id || generateId(),
        programId: r.programId,
        gender: r.gender || 'Boys',
        age: r.age || 'Junior',
        winners: {
          first: filterValidWinners(r.winners?.first),
          second: filterValidWinners(r.winners?.second),
          third: filterValidWinners(r.winners?.third)
        },
        grades: {
          gradeA: filterValidWinners(r.grades?.gradeA),
          gradeB: filterValidWinners(r.grades?.gradeB),
          gradeC: filterValidWinners(r.grades?.gradeC),
          participation: filterValidWinners(r.grades?.participation)
        },
        datetime: r.datetime || new Date().toISOString()
      };
    });

  return {
    teams,
    programs,
    participants: rawParticipants,
    results,
    settings: parsed.settings,
    prevRanks: parsed.prevRanks || {},
    lastModified: parsed.lastModified || 0,
    isExplicitReset: Boolean(parsed.isExplicitReset),
    quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : []
  };
}

export function loadDB(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const normalized = normalizeDB(parsed);
      if (normalized) {
        return calculatePoints(normalized);
      }
    }
  } catch (e) {
    console.error('Error loading DB from localStorage:', e);
  }

  // Initial seed fallback
  if (initialSeedData) {
    const seed = normalizeDB(initialSeedData);
    if (seed) {
      return calculatePoints(seed);
    }
  }

  return calculatePoints(defaultDB());
}

export function saveDBLocal(db: Database, preserveTimestamp: boolean = false): Database {
  const updated: Database = {
    ...db,
    lastModified: preserveTimestamp ? (db.lastModified || Date.now()) : Date.now()
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // Also save a backup copy
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving DB to localStorage:', e);
  }
  return updated;
}

export function calculatePoints(db: Database): Database {
  const ptsConfig = db.settings?.points || {
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
  };

  const teamPoints: Record<string, number> = {};
  (db.teams || []).forEach(t => {
    teamPoints[t.id] = 0;
  });

  (db.results || []).forEach(res => {
    const prog = (db.programs || []).find(p => p.id === res.programId);
    const isGeneral = res.gender === 'General' || (res.age as string) === 'General' || res.age === 'All' || Boolean(prog && prog.group);

    const firstVal = isGeneral ? (ptsConfig.generalFirst ?? 15) : (ptsConfig.first ?? 10);
    const secondVal = isGeneral ? (ptsConfig.generalSecond ?? 10) : (ptsConfig.second ?? 7);
    const thirdVal = isGeneral ? (ptsConfig.generalThird ?? 7) : (ptsConfig.third ?? 5);

    const addWinnersPoints = (winnersList: any[], pointsValue: number) => {
      (winnersList || []).forEach(w => {
        if (w && w.teamId && teamPoints[w.teamId] !== undefined) {
          teamPoints[w.teamId] += pointsValue;
        }
      });
    };

    addWinnersPoints(res.winners?.first, firstVal);
    addWinnersPoints(res.winners?.second, secondVal);
    addWinnersPoints(res.winners?.third, thirdVal);

    if (res.grades) {
      addWinnersPoints(res.grades.gradeA, ptsConfig.gradeA ?? 5);
      addWinnersPoints(res.grades.gradeB, ptsConfig.gradeB ?? 3);
      addWinnersPoints(res.grades.gradeC, ptsConfig.gradeC ?? 1);
      addWinnersPoints(res.grades.participation, ptsConfig.participation ?? 1);
    }
  });

  const updatedTeams = (db.teams || []).map(t => ({
    ...t,
    points: teamPoints[t.id] || 0
  }));

  return {
    ...db,
    teams: updatedTeams
  };
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

  // Push to Firestore Cloud Database for instant multi-device real-time sync across all phones
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

  const defaultSettings = defaultDB().settings;
  const primary = preferRemote ? remoteSettings : localSettings;
  const secondary = preferRemote ? localSettings : remoteSettings;

  return {
    ...defaultSettings,
    ...secondary,
    ...primary,
    points: {
      ...defaultSettings.points,
      ...(secondary.points || {}),
      ...(primary.points || {})
    },
    notices: (primary.notices && primary.notices.length > 0) 
      ? primary.notices 
      : (secondary.notices && secondary.notices.length > 0 ? secondary.notices : defaultSettings.notices),
    colorTheme: primary.colorTheme || secondary.colorTheme || defaultSettings.colorTheme,
    isPublicSiteOffline: primary.isPublicSiteOffline !== undefined ? Boolean(primary.isPublicSiteOffline) : (secondary.isPublicSiteOffline !== undefined ? Boolean(secondary.isPublicSiteOffline) : false),
    offlineMessage: primary.offlineMessage || secondary.offlineMessage || defaultSettings.offlineMessage,
    showNotice: primary.showNotice !== undefined ? primary.showNotice : (secondary.showNotice !== undefined ? secondary.showNotice : true),
    isLiveCelebrationActive: primary.isLiveCelebrationActive !== undefined ? primary.isLiveCelebrationActive : (secondary.isLiveCelebrationActive !== undefined ? secondary.isLiveCelebrationActive : false),
    showFinalWinner: primary.showFinalWinner !== undefined ? primary.showFinalWinner : (secondary.showFinalWinner !== undefined ? secondary.showFinalWinner : false),
    googleSheetId: primary.googleSheetId || secondary.googleSheetId || '',
    appsScriptUrl: primary.appsScriptUrl || secondary.appsScriptUrl || '',
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

  const localTime = Number(localDb.lastModified || 0);
  const remoteTime = Number(remoteDb.lastModified || 0);

  if (forcePreferRemote && (remoteHasData || remoteDb.isExplicitReset)) {
    return remoteDb;
  }

  // If remote has strictly newer timestamp, prefer remote updates completely
  if (remoteTime > localTime && remoteHasData) {
    return remoteDb;
  }

  // If remote is explicit reset
  if (remoteDb.isExplicitReset && remoteTime >= localTime) {
    return remoteDb;
  }

  // Merge union of programs, participants, and results intelligently
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

  // Merge Quizzes
  const quizMap = new Map<string, any>();
  (localDb.quizzes || []).forEach(q => quizMap.set(q.id, q));
  (remoteDb.quizzes || []).forEach(q => {
    if (!quizMap.has(q.id) || remoteTime >= localTime) {
      quizMap.set(q.id, q);
    }
  });

  return {
    ...localDb,
    teams: Array.from(teamMap.values()),
    programs: Array.from(progMap.values()),
    participants: Array.from(partMap.values()),
    results: Array.from(resMap.values()),
    settings: mergedSettings,
    prevRanks: { ...(localDb.prevRanks || {}), ...(remoteDb.prevRanks || {}) },
    lastModified: Math.max(localTime, remoteTime),
    quizzes: Array.from(quizMap.values())
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
        return null;
      }
    }

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
  } catch (proxyErr) {}

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
    if (data.db) {
      return normalizeDB(data.db);
    }
  } catch (e) {}
  return null;
}

export async function syncDatabase(currentDB: Database): Promise<{ db: Database; updated: boolean }> {
  try {
    // 1. Primary: Real-time Cloud Firestore
    const firestoreData = await fetchFromFirestore().catch(() => null);
    if (firestoreData && Array.isArray(firestoreData.teams)) {
      const normalized = normalizeDB(firestoreData);
      if (normalized) {
        const localTime = Number(currentDB.lastModified || 0);
        const remoteTime = Number(normalized.lastModified || 0);
        const localHasData = (currentDB.programs?.length || 0) > 0 || (currentDB.participants?.length || 0) > 0 || (currentDB.results?.length || 0) > 0;
        const remoteHasData = (normalized.programs?.length || 0) > 0 || (normalized.participants?.length || 0) > 0 || (normalized.results?.length || 0) > 0;

        if (remoteHasData && (remoteTime > localTime || !localHasData)) {
          const merged = mergeDatabase(currentDB, normalized, true);
          const calculated = calculatePoints(merged);
          saveDBLocal(calculated, true);
          return { db: calculated, updated: true };
        }
      }
    }

    // 2. Secondary: Express backend server
    const serverDb = await fetchFromServer().catch(() => null);
    if (serverDb && Array.isArray(serverDb.teams)) {
      const localTime = Number(currentDB.lastModified || 0);
      const remoteTime = Number(serverDb.lastModified || 0);
      const localHasData = (currentDB.programs?.length || 0) > 0 || (currentDB.participants?.length || 0) > 0 || (currentDB.results?.length || 0) > 0;
      const remoteHasData = (serverDb.programs?.length || 0) > 0 || (serverDb.participants?.length || 0) > 0 || (serverDb.results?.length || 0) > 0;

      if (remoteHasData && (remoteTime > localTime || !localHasData)) {
        const merged = mergeDatabase(currentDB, serverDb, true);
        const calculated = calculatePoints(merged);
        saveDBLocal(calculated, true);
        return { db: calculated, updated: true };
      }
    }
  } catch (err) {
    console.warn('syncDatabase error:', err);
  }

  return { db: currentDB, updated: false };
}
