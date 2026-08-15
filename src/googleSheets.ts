import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, User } from 'firebase/auth';
import { auth } from './firebase';
import { Database, ProgramCategory } from './types';
import { normalizeDB, pushToAppsScriptDirect } from './db';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export const GOOGLE_SHEET_ID_KEY = 'mrms_google_sheet_id';
export const GOOGLE_SHEET_AUTOSYNC_KEY = 'mrms_google_sheet_autosync';
const GOOGLE_TOKEN_KEY = 'mrms_google_access_token';
const GOOGLE_TOKEN_EXPIRY_KEY = 'mrms_google_token_expiry';

let cachedAccessToken: string | null = null;
let googleUser: User | null = null;

export function saveCachedToken(token: string) {
  cachedAccessToken = token;
  try {
    localStorage.setItem(GOOGLE_TOKEN_KEY, token);
    // OAuth access tokens expire in 1 hour (3600s), set safety margin of 55 mins
    localStorage.setItem(GOOGLE_TOKEN_EXPIRY_KEY, String(Date.now() + 55 * 60 * 1000));
  } catch (e) {}
}

export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export function getCachedToken(): string | null {
  try {
    const expiry = localStorage.getItem(GOOGLE_TOKEN_EXPIRY_KEY);
    if (expiry && Date.now() >= Number(expiry)) {
      clearCachedToken();
      return null;
    }
    if (cachedAccessToken) return cachedAccessToken;
    const storedToken = localStorage.getItem(GOOGLE_TOKEN_KEY);
    if (storedToken) {
      cachedAccessToken = storedToken;
      return storedToken;
    }
  } catch (e) {}
  return null;
}

export function clearCachedToken() {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(GOOGLE_TOKEN_KEY);
    localStorage.removeItem(GOOGLE_TOKEN_EXPIRY_KEY);
  } catch (e) {}
}

export const HARDCODED_GOOGLE_SHEET_ID = '';

export function getSavedSheetId(db?: Database): string | null {
  let raw = db?.settings?.googleSheetId || localStorage.getItem(GOOGLE_SHEET_ID_KEY) || HARDCODED_GOOGLE_SHEET_ID;
  return raw ? extractSpreadsheetId(raw) : null;
}

export function saveSheetId(id: string) {
  const clean = extractSpreadsheetId(id);
  if (clean) {
    localStorage.setItem(GOOGLE_SHEET_ID_KEY, clean);
  } else {
    localStorage.removeItem(GOOGLE_SHEET_ID_KEY);
  }
}

export function isAutoSyncEnabled(): boolean {
  const saved = localStorage.getItem(GOOGLE_SHEET_AUTOSYNC_KEY);
  return saved === null ? true : saved === 'true';
}

export function setAutoSyncEnabled(enabled: boolean) {
  localStorage.setItem(GOOGLE_SHEET_AUTOSYNC_KEY, enabled ? 'true' : 'false');
}

export async function checkRedirectResult(): Promise<{ user: User; accessToken: string } | null> {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        saveCachedToken(credential.accessToken);
        googleUser = result.user;
        return { user: result.user, accessToken: credential.accessToken };
      }
    }
  } catch (e) {
    console.warn('Redirect result check error:', e);
  }
  return null;
}

export async function signInWithGoogleForSheets(): Promise<{ user: User; accessToken: string }> {
  const provider = new GoogleAuthProvider();
  provider.addScope(SHEETS_SCOPE);
  provider.addScope(DRIVE_SCOPE);

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential || !credential.accessToken) {
      throw new Error('Could not retrieve OAuth access token from Google sign-in');
    }

    saveCachedToken(credential.accessToken);
    googleUser = result.user;

    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Google Sheets auth error:', error);
    if (error?.code === 'auth/unauthorized-domain') {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
      throw new Error(`Firebase Auth: Domain '${currentHost}' is not authorized. Add '${currentHost}' in Firebase Console > Authentication > Settings > Authorized domains. OR use Google Apps Script Webhook directly without sign-in.`);
    }
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/popup-closed-by-user' || error?.message?.includes('popup')) {
      try {
        console.log('Popup blocked. Attempting signInWithRedirect...');
        await signInWithRedirect(auth, provider);
        return new Promise(() => {});
      } catch (redirectErr: any) {
        throw new Error('⚠️ Popup blocked! Please allow popups or open the app in a new browser tab to complete Google Sign-In.');
      }
    }
    throw error;
  }
}

export async function googleSignOut() {
  clearCachedToken();
  googleUser = null;
  await signOut(auth);
}

/**
 * Creates a new Google Spreadsheet with simplified, readable tabs
 */
export async function createGoogleSpreadsheet(title: string, token: string): Promise<{ id: string; url: string }> {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: title || 'Meeladunnabi Competition Database',
      },
      sheets: [
        { properties: { title: 'Scoreboard' } },
        { properties: { title: 'Winners List' } },
        { properties: { title: 'Programs List' } },
        { properties: { title: 'Program Results' } },
        { properties: { title: 'Participants' } },
        { properties: { title: 'System Backup' } },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || 'Failed to create Google Spreadsheet');
  }

  const data = await response.json();
  const id = data.spreadsheetId;
  const url = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${id}/edit`;

  saveSheetId(id);
  return { id, url };
}

function sanitizeRows(rows: any[][]): Array<Array<string | number>> {
  return rows.map(row =>
    row.map(cell => {
      if (cell === null || cell === undefined) return '';
      if (typeof cell === 'number') return cell;
      if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE';
      return String(cell);
    })
  );
}

/**
 * Ensures required tabs exist on an existing spreadsheet
 */
async function ensureSheetsExist(spreadsheetId: string, token: string) {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) throw new Error('Invalid Google Sheet ID.');

  try {
    const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (getRes.status === 401) {
      clearCachedToken();
      throw new Error('Google Sign-In token expired or invalid. Please click "Sign In with Google" again.');
    }
    if (getRes.status === 403) {
      throw new Error('Permission denied. Please ensure your Google account has edit access to this Google Sheet.');
    }
    if (!getRes.ok) {
      const errJson = await getRes.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || `Google Sheet not accessible (HTTP ${getRes.status}). Check Sheet ID.`);
    }

    const sheetData = await getRes.json();
    const existingTitles: string[] = (sheetData.sheets || []).map((s: any) => s.properties?.title);

    const required = ['Scoreboard', 'Winners List', 'Programs List', 'Program Results', 'Participants', 'System Backup'];
    const missing = required.filter(t => !existingTitles.includes(t));

    if (missing.length > 0) {
      const requests = missing.map(t => ({
        addSheet: { properties: { title: t } }
      }));

      const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests })
      });
      if (!addRes.ok) {
        const errJson = await addRes.json().catch(() => ({}));
        console.warn('Failed to add missing sheet tabs:', errJson);
      }
    }
  } catch (e: any) {
    console.warn('Could not verify/add sheet tabs:', e);
    throw e;
  }
}

/**
 * Transforms Database into simplified, ultra-clean format for Google Sheets
 */
export function buildSheetsData(db: Database) {
  const teamNameMap = new Map<string, string>();
  db.teams.forEach(t => teamNameMap.set(t.id, t.name));

  const participantNameMap = new Map<string, string>();
  db.participants.forEach(p => participantNameMap.set(p.id, p.name));

  const getWinnerNamesOnly = (items: any[]) => {
    if (!items || !items.length) return '-';
    return items.map(item => item.name || 'Unknown').join(', ');
  };

  // Tab 1: Teams Scoreboard
  const scoreboardRows: Array<Array<string | number>> = [
    ['TEAM CODE', 'TEAM NAME', 'CAPTAIN', 'TOTAL POINTS'],
    ...db.teams.map(t => [t.id || '', t.name || '', t.captain || '-', t.points || 0])
  ];

  // Tab 2: Clean Winners List (Separated by Gender & Category)
  const winnersListRows: Array<Array<string | number>> = [
    ['STUDENT NAME', 'PROGRAM NAME', 'GENDER SECTION', 'AGE CATEGORY', 'POSITION', 'TEAM NAME', 'POINTS']
  ];

  db.results.forEach(r => {
    const prog = db.programs.find(p => p.id === r.programId);
    const progTitle = prog ? (prog.code ? `${prog.code} - ${prog.name}` : prog.name) : 'Program';
    const genderSec = r.gender || 'Boys';
    const ageCat = r.age || 'General';
    const isGen = Boolean(genderSec === 'General' || ageCat === 'General' || ageCat === 'All' || prog?.group);
    const ptsConfig = db.settings?.points || { first: 10, second: 7, third: 5, generalFirst: 15, generalSecond: 10, generalThird: 7 };

    const w = r.winners || { first: [], second: [], third: [] };

    (w.first || []).forEach(item => {
      const name = item.name || 'Unknown';
      const team = item.teamId ? (teamNameMap.get(item.teamId) || item.teamId) : '-';
      const pts = isGen ? (ptsConfig.generalFirst ?? ptsConfig.first) : ptsConfig.first;
      winnersListRows.push([name, progTitle, genderSec, ageCat, '1st Place (First)', team, pts]);
    });

    (w.second || []).forEach(item => {
      const name = item.name || 'Unknown';
      const team = item.teamId ? (teamNameMap.get(item.teamId) || item.teamId) : '-';
      const pts = isGen ? (ptsConfig.generalSecond ?? ptsConfig.second) : ptsConfig.second;
      winnersListRows.push([name, progTitle, genderSec, ageCat, '2nd Place (Second)', team, pts]);
    });

    (w.third || []).forEach(item => {
      const name = item.name || 'Unknown';
      const team = item.teamId ? (teamNameMap.get(item.teamId) || item.teamId) : '-';
      const pts = isGen ? (ptsConfig.generalThird ?? ptsConfig.third) : ptsConfig.third;
      winnersListRows.push([name, progTitle, genderSec, ageCat, '3rd Place (Third)', team, pts]);
    });
  });

  // Tab 3: Programs List
  const programsListRows: Array<Array<string | number>> = [
    ['PROGRAM CODE', 'PROGRAM NAME', 'GENDER SECTION', 'AGE CATEGORY', 'PROGRAM TYPE', 'STAGE TYPE', 'VENUE', 'DAY', 'START TIME', 'END TIME', 'MAX PARTICIPANTS', 'ID'],
    ...db.programs.map(p => {
      const genders = (p.categories || []).map(c => c.gender).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'Boys';
      const ages = (p.categories || []).map(c => c.age).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'General';
      const typeStr = p.group ? 'Group' : 'Single';
      return [
        p.code || '',
        p.name || '',
        genders,
        ages,
        typeStr,
        p.stageType || 'Main Stage',
        p.venue || '',
        p.day || '',
        p.startTime || '',
        p.endTime || '',
        p.maxParticipants !== null && p.maxParticipants !== undefined ? String(p.maxParticipants) : '',
        p.id || ''
      ];
    })
  ];

  // Tab 4: Program Results Overview (Segregated by Gender & Category)
  const programOverviewRows: Array<Array<string | number>> = [
    ['PROGRAM CODE', 'PROGRAM NAME', 'GENDER SECTION', 'AGE CATEGORY', '1ST PLACE', '2ND PLACE', '3RD PLACE', 'PUBLISHED AT'],
    ...db.results.map(r => {
      const prog = db.programs.find(p => p.id === r.programId);
      const progCode = prog?.code || '-';
      const progTitle = prog?.name || 'Program';
      const w = r.winners || { first: [], second: [], third: [] };

      const formatWinnersWithTeam = (entries: any[]) => {
        if (!entries || !entries.length) return '-';
        return entries.map(item => {
          const tName = item.teamId ? teamNameMap.get(item.teamId) : null;
          return tName ? `${item.name || 'Unknown'} (${tName})` : (item.name || 'Unknown');
        }).join(', ');
      };

      return [
        progCode,
        progTitle,
        r.gender || 'Boys',
        r.age || 'General',
        formatWinnersWithTeam(w.first),
        formatWinnersWithTeam(w.second),
        formatWinnersWithTeam(w.third),
        r.datetime || new Date().toISOString()
      ];
    })
  ];

  // Tab 5: Participants List
  const participantRows: Array<Array<string | number>> = [
    ['CHEST NO', 'STUDENT NAME', 'TEAM NAME', 'CLASS / AGE', 'GENDER', 'PROGRAM CODES'],
    ...db.participants.map(p => {
      const teamName = p.teamId ? (teamNameMap.get(p.teamId) || p.teamId) : '-';
      const progCodes = (p.programIds || []).map(pid => {
        const prog = db.programs.find(pr => pr.id === pid);
        return prog ? (prog.code || prog.name) : pid;
      }).join(', ');

      return [
        p.number || '-', 
        p.name || '', 
        teamName, 
        p.cls ? `Class ${p.cls}` : (p.age || '-'),
        p.gender || 'Boys',
        progCodes
      ];
    })
  ];


  // Tab 6: System Backup (Chunked to prevent Google Sheets 50,000 char per cell limit)
  const jsonBackupString = JSON.stringify(db);
  const CHUNK_SIZE = 30000;
  const chunks: string[] = [];
  for (let i = 0; i < jsonBackupString.length; i += CHUNK_SIZE) {
    chunks.push(jsonBackupString.slice(i, i + CHUNK_SIZE));
  }

  const systemBackupRows = [
    ['SYSTEM_JSON_DATA_CHUNK', 'LAST_MODIFIED', 'UPDATED_AT'],
    ...chunks.map((chunk, idx) => [
      chunk,
      idx === 0 ? (db.lastModified || Date.now()) : '',
      idx === 0 ? new Date().toISOString() : ''
    ])
  ];

  return [
    { range: "'Scoreboard'!A1", values: sanitizeRows(scoreboardRows) },
    { range: "'Winners List'!A1", values: sanitizeRows(winnersListRows) },
    { range: "'Programs List'!A1", values: sanitizeRows(programsListRows) },
    { range: "'Program Results'!A1", values: sanitizeRows(programOverviewRows) },
    { range: "'Participants'!A1", values: sanitizeRows(participantRows) },
    { range: "'System Backup'!A1", values: sanitizeRows(systemBackupRows) },
  ];
}

/**
  * Debounced queue wrapper for Google Sheets auto-sync to avoid exceeding API write quota
  */
let autoSyncTimer: any = null;
export function queueAutoSyncToGoogleSheet(db: Database, rawSpreadsheetId?: string | null, token?: string | null, delayMs = 3000) {
  if (!isAutoSyncEnabled()) return;

  const spreadsheetId = rawSpreadsheetId ? extractSpreadsheetId(rawSpreadsheetId) : (getSavedSheetId(db) || '');
  if (autoSyncTimer) clearTimeout(autoSyncTimer);

  autoSyncTimer = setTimeout(async () => {
    const activeToken = token || getCachedToken();
    let apiSuccess = false;

    if (spreadsheetId && activeToken) {
      try {
        await syncDataToGoogleSheet(db, spreadsheetId, activeToken);
        apiSuccess = true;
      } catch (err: any) {
        console.warn('Google Sheets OAuth API auto-sync error, attempting Apps Script sync:', err);
      }
    }

    if (!apiSuccess) {
      // Direct push to Apps Script endpoint to guarantee Google Sheet update
      pushToAppsScriptDirect(db).catch(err => {
        console.warn('Direct Apps Script auto-push error:', err);
      });
    }
  }, delayMs);
}

/**
 * Pushes data to Google Spreadsheet - Both formatted tabs and System Backup chunked JSON
 */
export async function syncDataToGoogleSheet(db: Database, rawSpreadsheetId: string, token: string): Promise<boolean> {
  const spreadsheetId = extractSpreadsheetId(rawSpreadsheetId);
  if (!spreadsheetId) {
    throw new Error('Google Sheet ID is missing. Please enter or create a Google Sheet first.');
  }
  if (!token) {
    throw new Error('Google Sign-In required. Please click "Sign In with Google" first.');
  }

  // Safety check: Prevent overwriting spreadsheet with empty data
  const teamsCount = db.teams?.length || 0;
  const progsCount = db.programs?.length || 0;
  const partsCount = db.participants?.length || 0;
  const resultsCount = db.results?.length || 0;

  if (teamsCount === 0 && progsCount === 0 && partsCount === 0 && resultsCount === 0 && !db.isExplicitReset) {
    console.warn('Sync aborted: Safeguard prevented pushing empty database to Google Sheets.');
    return false;
  }

  await ensureSheetsExist(spreadsheetId, token);
  const sheetsData = buildSheetsData(db);

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: sheetsData,
    }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    console.error('Google Sheets sync error:', errorJson);
    if (response.status === 401) {
      clearCachedToken();
      throw new Error('Google Sign-In token expired. Please click "Sign In with Google" again.');
    }
    if (response.status === 403) {
      throw new Error('Permission denied. Please ensure your Google account has Edit access to this Sheet.');
    }
    throw new Error(errorJson?.error?.message || `Google Sheets push failed (HTTP ${response.status}).`);
  }

  return true;
}

/**
 * Fetches latest database state from Google Spreadsheet
 */
export function parseCategoriesFromInput(genderStr: string, ageStr: string): ProgramCategory[] {
  const gStr = (genderStr || '').trim().toLowerCase();
  const aStr = (ageStr || '').trim().toLowerCase();

  // 1. Detect Genders
  const detectedGenders: Array<'Boys' | 'Girls' | 'General'> = [];

  if (gStr.includes('boy') || gStr.includes('male') || gStr.includes('ആൺ') || gStr === 'b' || gStr === 'm') {
    detectedGenders.push('Boys');
  }
  if (gStr.includes('girl') || gStr.includes('female') || gStr.includes('പെൺ') || gStr === 'g' || gStr === 'f' || gStr.includes('lady') || gStr.includes('women')) {
    detectedGenders.push('Girls');
  }
  if (gStr.includes('gen') || gStr.includes('open') || gStr.includes('പൊതു') || (gStr.includes('all') && detectedGenders.length === 0)) {
    detectedGenders.push('General');
  }

  // 2. Detect Ages
  const detectedAges: Array<'Kids' | 'Sub Junior' | 'Junior' | 'Senior' | 'Super Senior' | 'General' | 'All'> = [];

  // Kids check: 'kid', '1-2', '1 - 2', '1,2', '1, 2', 'class 1', 'class 2', 'c1', 'c2'
  if (/kid|1\s*[-,\&/]\s*2|class\s*[12]\b|\bc1\b|\bc2\b/i.test(aStr)) {
    detectedAges.push('Kids');
  }

  // Sub Junior check: 'sub', '3-4', '3 - 4', '3,4', '3, 4', 'class 3', 'class 4', 'c3', 'c4', 'sub-jr', 'sub jr', 'subjr', 'sj'
  if (/sub|3\s*[-,\&/]\s*4|class\s*[34]\b|\bc3\b|\bc4\b|sub\s*[-_]?\s*jr|\bsj\b/i.test(aStr)) {
    detectedAges.push('Sub Junior');
  }

  // Super Senior check: 'super', '9-12', 'class 9', 'class 10', 'class 11', 'class 12', 'high school', 'secondary', 'super-sr', 'supersr', 'ss'
  if (/super|9\s*[-,\&/]\s*12|class\s*(9|10|11|12)\b|\bc(9|10|11|12)\b|super\s*[-_]?\s*sr|high\s*school|secondary|\bss\b/i.test(aStr)) {
    detectedAges.push('Super Senior');
  }

  // Senior check: remove 'super' terms first so "Senior, Super Senior" works cleanly
  const aStrWithoutSuper = aStr.replace(/super\s*[-_]?\s*sr|super\s*senior|supersr|super|\bss\b/gi, '');
  if (/senior|7\s*[-,\&/]\s*8|class\s*[78]\b|\bc[78]\b|\bsr\.?\b/i.test(aStrWithoutSuper)) {
    detectedAges.push('Senior');
  }

  // Junior check: remove 'sub' terms first so "Sub Junior, Junior" works cleanly
  const aStrWithoutSub = aStr.replace(/sub\s*[-_]?\s*jr|sub\s*junior|subjr|sub|\bsj\b/gi, '');
  if (/junior|5\s*[-,\&/]\s*6|class\s*[56]\b|\bc[56]\b|\bjr\.?\b/i.test(aStrWithoutSub)) {
    detectedAges.push('Junior');
  }

  // General check
  if (/gen|open|പൊതു|5\s*[-,\&/]\s*12|1\s*[-,\&/]\s*12/i.test(aStr)) {
    detectedAges.push('General');
  }

  // All check
  if (/\ball\b|all\s*cat/i.test(aStr) && detectedAges.length === 0) {
    detectedAges.push('All');
  }

  // Fallback defaults
  if (detectedGenders.length === 0) {
    if (detectedAges.includes('General') || detectedAges.includes('All')) {
      detectedGenders.push('General');
    } else {
      detectedGenders.push('Boys');
    }
  }

  if (detectedAges.length === 0) {
    detectedAges.push('General');
  }

  // Build combined ProgramCategory array
  const categories: ProgramCategory[] = [];
  const seenKey = new Set<string>();

  for (const g of detectedGenders) {
    for (const a of detectedAges) {
      const key = `${g}_${a}`;
      if (!seenKey.has(key)) {
        seenKey.add(key);
        categories.push({ gender: g, age: a });
      }
    }
  }

  return categories.length > 0 ? categories : [{ gender: 'General', age: 'General' }];
}

export async function fetchDataFromGoogleSheet(rawSpreadsheetId: string, token: string, existingLocalDb?: Database | null): Promise<Database | null> {
  const spreadsheetId = extractSpreadsheetId(rawSpreadsheetId);
  if (!spreadsheetId || !token) return null;

  try {
    let currentDb: Database | null = null;
    let hasBackupData = false;

    // 1. Fetch System Backup (All chunked rows in column A)
    const backupRange = encodeURIComponent("'System Backup'!A2:A1000");
    const backupRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${backupRange}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (backupRes.ok) {
      const backupData = await backupRes.json();
      const rows = backupData.values;
      if (rows && rows.length > 0) {
        try {
          const combinedJson = rows.map((r: string[]) => r[0] || '').join('');
          if (combinedJson.trim()) {
            currentDb = normalizeDB(JSON.parse(combinedJson));
            hasBackupData = true;
          }
        } catch (err) {
          console.warn('System Backup JSON parse error:', err);
        }
      }
    }

    if (!currentDb) {
      currentDb = normalizeDB({});
    }

    let importedProgramCount = 0;
    let importedParticipantCount = 0;

    // 2. Fetch Teams List directly from the Scoreboard tab (if user modified teams in Google Sheets)
    try {
      const teamsRange = encodeURIComponent("'Scoreboard'!A1:E500");
      const teamsRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${teamsRange}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        const tRows: Array<string[]> = teamsData.values || [];
        if (tRows.length > 1) {
          const existingTeamsMap = new Map<string, any>();
          (currentDb.teams || []).forEach(t => {
            if (t.id) existingTeamsMap.set(t.id, t);
            if (t.name) existingTeamsMap.set(t.name.toLowerCase(), t);
          });

          const updatedTeamsList: any[] = [];
          tRows.forEach((row, idx) => {
            if (idx === 0 || !row || row.length === 0) return;
            const code = (row[0] || '').trim();
            const name = (row[1] || '').trim();
            const captain = (row[2] || '').trim();
            const pointsRaw = (row[3] || '').trim();

            if (!name || name.toUpperCase() === 'TEAM NAME' || code.toUpperCase() === 'TEAM CODE') return;

            const existingTeam = (code && existingTeamsMap.get(code)) || existingTeamsMap.get(name.toLowerCase());
            const points = !isNaN(Number(pointsRaw)) && pointsRaw !== '' ? Number(pointsRaw) : (existingTeam?.points || 0);

            updatedTeamsList.push({
              id: existingTeam?.id || code || `team_sheet_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name,
              symbol: existingTeam?.symbol || '🚩',
              color: existingTeam?.color || '#1b8155',
              captain: captain !== '-' ? captain : (existingTeam?.captain || ''),
              boysCaptain: existingTeam?.boysCaptain || '',
              boysCaptain2: existingTeam?.boysCaptain2 || '',
              girlsCaptain: existingTeam?.girlsCaptain || '',
              girlsCaptain2: existingTeam?.girlsCaptain2 || '',
              points
            });
          });

          if (updatedTeamsList.length > 0) {
            currentDb.teams = updatedTeamsList;
          }
        }
      }
    } catch (sheetErr) {
      console.warn('Could not read Scoreboard tab:', sheetErr);
    }

    // 3. Fetch Programs List directly from the Programs List tab (if user added/modified programs in Google Sheets)
    try {
      const progsRange = encodeURIComponent("'Programs List'!A1:L1000");
      const progsRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${progsRange}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (progsRes.ok) {
        const progsData = await progsRes.json();
        const pRows: Array<string[]> = progsData.values || [];

        const existingProgramsMap = new Map<string, any>();
        (currentDb.programs || []).forEach((p: any) => {
          if (p.id) existingProgramsMap.set(p.id, p);
          if (p.code) existingProgramsMap.set(p.code.toLowerCase(), p);
          if (p.name) existingProgramsMap.set(p.name.toLowerCase(), p);
        });

        const updatedProgramsList: any[] = [];

        // Dynamic header row column detection
        const headerRow = (pRows[0] || []).map(h => (h || '').toString().trim().toUpperCase());
        let colCode = headerRow.findIndex(h => h.includes('CODE'));
        if (colCode === -1) colCode = 0;

        let colName = headerRow.findIndex(h => h.includes('NAME') && !h.includes('CODE') && !h.includes('TEAM'));
        if (colName === -1) colName = 1;

        const colCategory = headerRow.findIndex(h => h === 'CATEGORY');

        let colGender = headerRow.findIndex(h => h.includes('GENDER') || h.includes('SEX') || h === 'SECTION' || h.includes('GENDER SECTION'));
        if (colGender === -1 && colCategory !== -1) colGender = colCategory;
        if (colGender === -1) colGender = 2;

        let colAge = headerRow.findIndex(h => (h.includes('AGE') && !h.includes('STAGE')) || h.includes('CLASS') || h.includes('DIVISION'));
        if (colAge === -1 && colCategory !== -1) colAge = colCategory;
        if (colAge === -1) colAge = 3;

        let colType = headerRow.findIndex(h => h.includes('PROGRAM TYPE') || h.includes('SINGLE') || (h.includes('TYPE') && !h.includes('STAGE')));
        if (colType === -1) colType = 4;

        let colStage = headerRow.findIndex(h => h.includes('STAGE'));
        if (colStage === -1) colStage = 5;

        let colVenue = headerRow.findIndex(h => h.includes('VENUE') || h.includes('LOCATION') || h.includes('PLACE'));
        if (colVenue === -1) colVenue = 6;

        let colDay = headerRow.findIndex(h => h.includes('DAY') || h.includes('DATE'));
        if (colDay === -1) colDay = 7;

        let colStart = headerRow.findIndex(h => h.includes('START TIME') || h === 'START' || (h.includes('START') && !h.includes('END')));
        if (colStart === -1) colStart = 8;

        let colEnd = headerRow.findIndex(h => h.includes('END TIME') || h === 'END' || (h.includes('END') && !h.includes('GENDER') && !h.includes('ATTEND')));
        if (colEnd === -1) colEnd = 9;

        let colMax = headerRow.findIndex(h => h.includes('MAX') || h.includes('LIMIT') || h.includes('CAPACITY'));
        if (colMax === -1) colMax = 10;

        let colId = headerRow.findIndex(h => h === 'ID' || h === 'PROGRAM ID');
        if (colId === -1) colId = 11;

        pRows.forEach((row, rowIndex) => {
          if (!row || rowIndex === 0) return;
          const code = (row[colCode] || '').trim();
          const name = (row[colName] || '').trim();
          if (!name || !code || name.toUpperCase() === 'PROGRAM NAME' || name.toUpperCase() === 'NAME' || code.toUpperCase() === 'CODE' || code.toUpperCase() === 'PROGRAM CODE') return;

          importedProgramCount++;

          const genderStr = (row[colGender] || '').trim();
          const ageStr = (row[colAge] || '').trim();
          const typeStr = (row[colType] || '').trim().toLowerCase();
          const stageTypeStr = (row[colStage] || '').trim().toLowerCase();
          const venue = (row[colVenue] || '').trim();
          const day = (row[colDay] || '').trim();
          let startTime = (row[colStart] || '').trim();
          let endTime = (row[colEnd] || '').trim();
          const maxPartsRaw = (row[colMax] || '').trim();
          const givenId = (row[colId] || '').trim();

          // Sanitize time strings in case column misalignment accidentally picked up gender strings
          if (startTime.toLowerCase().includes('boy') || startTime.toLowerCase().includes('girl') || startTime.toLowerCase().includes('general')) {
            startTime = '';
          }
          if (endTime.toLowerCase().includes('boy') || endTime.toLowerCase().includes('girl') || endTime.toLowerCase().includes('general')) {
            endTime = '';
          }

          const stageType = stageTypeStr.includes('off') ? 'Offstage' : 'Main Stage';
          const maxParticipants = maxPartsRaw && !isNaN(Number(maxPartsRaw)) ? Number(maxPartsRaw) : null;
          const isGroup = typeStr.includes('group');

          const parsedCategories = parseCategoriesFromInput(genderStr, ageStr);
          const firstCat = parsedCategories[0] || { gender: 'Boys', age: 'General' };

          const existingProg = (givenId && existingProgramsMap.get(givenId)) ||
                               (code && existingProgramsMap.get(code.toLowerCase())) ||
                               (name && existingProgramsMap.get(name.toLowerCase()));

          updatedProgramsList.push({
            id: givenId || existingProg?.id || `prog_sheet_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            code: code || existingProg?.code || `P${updatedProgramsList.length + 1}`,
            name: name || existingProg?.name || 'Unnamed Program',
            gender: firstCat.gender,
            age: firstCat.age,
            day: colDay !== -1 ? day : (existingProg?.day || ''),
            venue: colVenue !== -1 ? venue : (existingProg?.venue || ''),
            startTime: colStart !== -1 ? startTime : (existingProg?.startTime || ''),
            endTime: colEnd !== -1 ? endTime : (existingProg?.endTime || ''),
            duration: existingProg?.duration || '15 min',
            description: existingProg?.description || '',
            maxParticipants,
            single: !isGroup,
            group: isGroup,
            categories: parsedCategories,
            stageType
          });
        });

        if (updatedProgramsList.length > 0) {
          currentDb = {
            ...currentDb,
            programs: updatedProgramsList
          };
        }
      }
    } catch (sheetErr) {
      console.warn('Could not read Programs List tab:', sheetErr);
    }

    // 4. Fetch Participants List directly from the Participants tab (supports Gender & Program Codes)
    try {
      const partsRange = encodeURIComponent("'Participants'!A1:F3000");
      const partsRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${partsRange}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (partsRes.ok) {
        const partsData = await partsRes.json();
        const partRows: Array<string[]> = partsData.values || [];

        const teamNameMap = new Map<string, string>();
        (currentDb.teams || []).forEach(t => teamNameMap.set(t.name.toLowerCase(), t.id));

        const chestMap = new Map<string, any>();
        const nameMap = new Map<string, any>();
        (currentDb.participants || []).forEach(p => {
          if (p.number && p.number !== '-') chestMap.set((p.number || '').toString().trim().toLowerCase(), p);
          if (p.name) nameMap.set(p.name.trim().toLowerCase().replace(/\s+/g, ' '), p);
        });

        const updatedParticipantsList: any[] = [];

        partRows.forEach((row) => {
          if (!row || row.length < 2) return;
          
          // Header check
          const col0 = (row[0] || '').trim().toUpperCase();
          const col1 = (row[1] || '').trim().toUpperCase();
          if (col0 === 'CHEST NO' || col1 === 'STUDENT NAME') return;

          const chestNo = (row[0] || '').trim();
          const name = (row[1] || '').trim();
          if (!name) return;

          importedParticipantCount++;
          const teamStr = (row[2] || '').trim();
          const classAgeStr = (row[3] || '').trim();
          const genderStr = (row[4] || '').trim();
          const progCodesStr = (row[5] || '').trim();

          // Auto-match or infer team
          let matchedTeamId = teamNameMap.get(teamStr.toLowerCase()) || null;
          if (!matchedTeamId && teamStr && teamStr !== '-') {
            // Create missing team automatically so team association isn't lost
            const newTeamId = `team_sheet_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            currentDb.teams.push({
              id: newTeamId,
              name: teamStr,
              symbol: '🚩',
              color: '#1b8155',
              captain: '',
              boysCaptain: '',
              girlsCaptain: '',
              points: 0
            });
            teamNameMap.set(teamStr.toLowerCase(), newTeamId);
            matchedTeamId = newTeamId;
          }

          const cls = classAgeStr.replace(/class/i, '').trim();

          // Infer gender accurately (Girls vs Boys)
          let gender: 'Boys' | 'Girls' = 'Boys';
          if (
            genderStr.toLowerCase().includes('girl') || 
            genderStr.toLowerCase().includes('female') || 
            genderStr.toLowerCase().includes('പെൺ') ||
            classAgeStr.toLowerCase().includes('girl')
          ) {
            gender = 'Girls';
          } else if (
            genderStr.toLowerCase().includes('boy') || 
            genderStr.toLowerCase().includes('male') || 
            genderStr.toLowerCase().includes('ആൺ')
          ) {
            gender = 'Boys';
          }

          // Map program codes to program IDs
          const programIds: string[] = [];
          if (progCodesStr) {
            const codeList = progCodesStr.split(',').map(c => c.trim()).filter(Boolean);
            codeList.forEach(c => {
              const matchedProg = currentDb?.programs.find(pr => 
                pr.code.toLowerCase() === c.toLowerCase() || 
                pr.name.toLowerCase() === c.toLowerCase() ||
                pr.id === c
              );
              if (matchedProg && !programIds.includes(matchedProg.id)) {
                programIds.push(matchedProg.id);
              }
            });
          }

          const chestClean = chestNo && chestNo !== '-' ? chestNo.trim().toLowerCase() : '';
          const nameClean = name.trim().toLowerCase().replace(/\s+/g, ' ');

          const existingPart = (chestClean && chestMap.get(chestClean)) || (nameClean && nameMap.get(nameClean));

          updatedParticipantsList.push({
            id: existingPart?.id || `part_sheet_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            number: chestNo && chestNo !== '-' ? chestNo : (existingPart?.number || String(updatedParticipantsList.length + 100)),
            name: name || existingPart?.name || 'Unnamed Candidate',
            cls: cls || existingPart?.cls || '',
            division: existingPart?.division || '',
            gender: gender || existingPart?.gender || 'Boys',
            age: existingPart?.age || 'Junior',
            teamId: matchedTeamId || existingPart?.teamId || null,
            programIds
          });
        });

        if (updatedParticipantsList.length > 0) {
          currentDb = {
            ...currentDb,
            participants: updatedParticipantsList
          };
        }
      }
    } catch (sheetErr) {
      console.warn('Could not read Participants tab:', sheetErr);
    }

    if (existingLocalDb && existingLocalDb.settings) {
      currentDb.settings = {
        ...currentDb.settings,
        ...existingLocalDb.settings,
        colorTheme: existingLocalDb.settings.colorTheme || currentDb.settings?.colorTheme
      };
    }

    currentDb = normalizeDB({
      ...currentDb,
      lastModified: hasBackupData ? (currentDb.lastModified || Date.now()) : 1
    }) || currentDb;

    // Return null if completely empty to show user friendly "No valid data found in sheet" message
    if (!hasBackupData && importedProgramCount === 0 && importedParticipantCount === 0 && currentDb.participants.length === 0) {
      return null;
    }

    return currentDb;
  } catch (e) {
    console.warn('Failed to fetch from Google Sheet:', e);
    return null;
  }
}

/**
 * Direct public fetch from Google Sheet without requiring OAuth or token
 * Works on any phone, browser, or server
 */
export async function fetchPublicGoogleSheetData(targetSheetId?: string): Promise<Database | null> {
  const sheetId = targetSheetId || getSavedSheetId() || HARDCODED_GOOGLE_SHEET_ID;
  if (!sheetId) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // 1. Fetch System Backup tab via public CSV endpoint
    const backupUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('System Backup')}`;
    const res = await fetch(backupUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const text = await res.text();
      if (text && !text.includes('<!DOCTYPE html>') && text.length > 50) {
        const lines = text.split('\n');
        // skip header row
        const dataLines = lines.slice(1);
        let combined = '';
        for (const line of dataLines) {
          if (!line.trim()) continue;
          let cell = line.trim();
          if (cell.startsWith('"')) {
            const match = cell.match(/^"((?:[^"]|"")*)"/);
            if (match) {
              cell = match[1].replace(/""/g, '"');
            }
          } else {
            const idx = cell.indexOf(',');
            if (idx !== -1) cell = cell.substring(0, idx);
          }
          combined += cell;
        }

        if (combined.trim().startsWith('{') && combined.trim().endsWith('}')) {
          try {
            const parsed = JSON.parse(combined);
            if (parsed && Array.isArray(parsed.teams)) {
              return normalizeDB(parsed);
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {
    console.warn('Public Google Sheet fetch warning:', e);
  }
  return null;
}

