import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { Database, Team, NoticeItem, Program } from '../types';
import { GENDERS, AGES, GENDER_ICONS, AGE_ICONS, classToAge } from '../db';
import { 
  Download, 
  Upload, 
  Database as DbIcon, 
  RefreshCw, 
  Save, 
  Key, 
  Smartphone, 
  LogOut, 
  Printer, 
  AlertCircle,
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  Plus,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  signInWithGoogleForSheets,
  getSavedSheetId,
  saveSheetId,
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  createGoogleSpreadsheet,
  syncDataToGoogleSheet,
  fetchDataFromGoogleSheet,
  getCachedToken,
  googleSignOut
} from '../googleSheets';

interface SettingsProps {
  db: Database;
  onSavePoints: (points: Database['settings']['points']) => void;
  onSaveEventInfo?: (info: { 
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
  }) => void;
  onUpdatePassword: (current: string, next: string) => boolean;
  onUpdatePin: (current: string, next: string) => boolean;
  onFirebaseUrlChange: (url: string) => void;
  onImportBackup: (importedDb: Database) => void;
  onBulkImportParticipants: (participants: any[]) => void;
  onBulkImportPrograms?: (programs: any[]) => void;
  onSaveTeams?: (teams: Team[]) => void;
  onClearAllData?: () => void;
  onLogout: () => void;
  isAdmin: boolean;
  onForceSync: () => void;
  onGenerateReport: (filename: string, title: string, bodyHTML: string) => void;
}

export default function Settings({
  db,
  onSavePoints,
  onSaveEventInfo,
  onUpdatePassword,
  onUpdatePin,
  onFirebaseUrlChange,
  onImportBackup,
  onBulkImportParticipants,
  onBulkImportPrograms,
  onSaveTeams,
  onClearAllData,
  onLogout,
  isAdmin,
  onForceSync,
  onGenerateReport
}: SettingsProps) {
  const [showClearModal, setShowClearModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  // Points configuration states
  const [ptFirst, setPtFirst] = useState(db.settings.points.first);
  const [ptSecond, setPtSecond] = useState(db.settings.points.second);
  const [ptThird, setPtThird] = useState(db.settings.points.third);
  const [ptGenFirst, setPtGenFirst] = useState(db.settings.points.generalFirst ?? db.settings.points.first);
  const [ptGenSecond, setPtGenSecond] = useState(db.settings.points.generalSecond ?? db.settings.points.second);
  const [ptGenThird, setPtGenThird] = useState(db.settings.points.generalThird ?? db.settings.points.third);
  const [ptPart, setPtPart] = useState(db.settings.points.participation);
  const [ptGA, setPtGA] = useState(db.settings.points.gradeA);
  const [ptGB, setPtGB] = useState(db.settings.points.gradeB);
  const [ptGC, setPtGC] = useState(db.settings.points.gradeC);

  // Event branding states
  const [evtName, setEvtName] = useState(db.settings.eventName || 'KALIMA 2k26 MEELAD FEST');
  const [brdName, setBrdName] = useState(db.settings.boardName || 'KALIMA 2k26 MEELAD FEST');
  const [subName, setSubName] = useState(db.settings.subtitle || 'Live Competition Results, Scoring Points & Schedules');
  const [evtLogo, setEvtLogo] = useState(db.settings.eventLogo || '');
  const [colorTheme, setColorTheme] = useState<'natural' | 'outdoor-light' | 'outdoor-dark' | 'solar-high-contrast' | 'royal-gold' | 'emerald-luxury' | 'crimson-ruby' | 'ocean-breeze'>(db.settings.colorTheme || 'natural');
  const [showWinner, setShowWinner] = useState(!!db.settings.showFinalWinner);
  const [showScoreboard, setShowScoreboard] = useState(db.settings.showScoreboard !== false);
  const [showCandidatePoints, setShowCandidatePoints] = useState(db.settings.showCandidatePoints !== false);
  const [showDetailedScoreboard, setShowDetailedScoreboard] = useState(db.settings.showDetailedScoreboard !== false);
  const [showIndividualChampions, setShowIndividualChampions] = useState(db.settings.showIndividualChampions !== false);

  // Sync state with db.settings whenever database settings prop updates
  useEffect(() => {
    setEvtName(db.settings.eventName || 'KALIMA 2k26 MEELAD FEST');
    setBrdName(db.settings.boardName || 'KALIMA 2k26 MEELAD FEST');
    setSubName(db.settings.subtitle || 'Live Competition Results, Scoring Points & Schedules');
    setEvtLogo(db.settings.eventLogo || '');
    setColorTheme(db.settings.colorTheme || 'natural');
    setShowWinner(!!db.settings.showFinalWinner);
    setShowScoreboard(db.settings.showScoreboard !== false);
    setShowCandidatePoints(db.settings.showCandidatePoints !== false);
    setShowDetailedScoreboard(db.settings.showDetailedScoreboard !== false);
    setShowIndividualChampions(db.settings.showIndividualChampions !== false);
    setShowNotice(!!db.settings.showNotice);
    setNoticeDurationSecs(db.settings.noticeDurationSecs || 8);
    if (db.settings.notices && Array.isArray(db.settings.notices)) {
      setNoticesList(db.settings.notices);
    }
  }, [
    db.settings.eventName,
    db.settings.boardName,
    db.settings.subtitle,
    db.settings.eventLogo,
    db.settings.colorTheme,
    db.settings.showFinalWinner,
    db.settings.showScoreboard,
    db.settings.showCandidatePoints,
    db.settings.showDetailedScoreboard,
    db.settings.showIndividualChampions,
    db.settings.showNotice,
    db.settings.noticeDurationSecs,
    db.settings.notices
  ]);

  // Image compressor helper function to keep Firestore payload lightweight (<100KB per image)
  const compressImage = (file: File, maxWidth = 900, quality = 0.65): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            resolve((e.target?.result as string) || '');
          }
        };
        img.onerror = () => resolve((e.target?.result as string) || '');
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file, 600, 0.7);
      if (compressed) {
        setEvtLogo(compressed);
        setSuccessMsg('Logo file processed & optimized successfully. Click "Save Event Branding & Settings" below to apply.');
      }
    }
  };

  const handleTeamLogoUpload = async (e: ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file, 300, 0.7);
      if (compressed) {
        const next = [...teamsList];
        next[idx] = { ...next[idx], logoUrl: compressed };
        setTeamsList(next);
        setSuccessMsg(`Logo uploaded & assigned to ${teamsList[idx].name}! Click "Save Team Details" below to publish live.`);
      }
    }
  };

  // Notice Board & Sponsor Advertisements states
  const [showNotice, setShowNotice] = useState(!!db.settings.showNotice);
  const [noticeDurationSecs, setNoticeDurationSecs] = useState(db.settings.noticeDurationSecs || 8);
  const [noticeTitle, setNoticeTitle] = useState(db.settings.noticeTitle || '📢 NOTICE BOARD / ANNOUNCEMENTS');
  const [noticeText, setNoticeText] = useState(db.settings.noticeText || '');

  const [noticesList, setNoticesList] = useState<NoticeItem[]>(() => {
    if (db.settings.notices && db.settings.notices.length > 0) {
      return db.settings.notices;
    }
    if (db.settings.noticeText) {
      return [{
        id: '1',
        title: db.settings.noticeTitle || '📢 IMPORTANT ANNOUNCEMENT',
        text: db.settings.noticeText,
        type: 'general',
        active: true,
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      }];
    }
    return [];
  });

  const [nTitle, setNTitle] = useState('');
  const [nText, setNText] = useState('');
  const [nType, setNType] = useState<NoticeItem['type']>('general');
  const [nSponsorName, setNSponsorName] = useState('');
  const [nImageUrl, setNImageUrl] = useState('');
  const [nLinkUrl, setNLinkUrl] = useState('');
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);

  const handleNoticeImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file, 800, 0.65);
      if (compressed) {
        setNImageUrl(compressed);
        setSuccessMsg('Poster / Ad image compressed & attached successfully!');
      }
    }
  };

  const handleAddOrUpdateNotice = () => {
    if (!nTitle.trim() || !nText.trim()) {
      setErrorMsg('Please enter both Title and Message for the notice/advertisement.');
      return;
    }

    if (editingNoticeId) {
      const updated = noticesList.map(n => n.id === editingNoticeId ? {
        ...n,
        title: nTitle,
        text: nText,
        type: nType,
        sponsorName: nSponsorName,
        imageUrl: nImageUrl,
        linkUrl: nLinkUrl
      } : n);
      setNoticesList(updated);
      setEditingNoticeId(null);
      setSuccessMsg('Notice / Advertisement updated in list! Click "Save Event Branding & Notice Board" below to apply.');
    } else {
      const newItem: NoticeItem = {
        id: Date.now().toString(),
        title: nTitle,
        text: nText,
        type: nType,
        sponsorName: nSponsorName,
        imageUrl: nImageUrl,
        linkUrl: nLinkUrl,
        active: true,
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      };
      setNoticesList([newItem, ...noticesList]);
      setSuccessMsg('New Notice / Sponsor Advertisement added! Click "Save Event Branding & Notice Board" below to apply.');
    }

    setNTitle('');
    setNText('');
    setNType('general');
    setNSponsorName('');
    setNImageUrl('');
    setNLinkUrl('');
  };

  const handleEditNoticeItem = (item: NoticeItem) => {
    setEditingNoticeId(item.id);
    setNTitle(item.title);
    setNText(item.text);
    setNType(item.type || 'general');
    setNSponsorName(item.sponsorName || '');
    setNImageUrl(item.imageUrl || '');
    setNLinkUrl(item.linkUrl || '');
  };

  const handleToggleNoticeActive = (id: string) => {
    const updated = noticesList.map(n => n.id === id ? { ...n, active: !n.active } : n);
    setNoticesList(updated);
  };

  const handleDeleteNoticeItem = (id: string) => {
    setNoticesList(noticesList.filter(n => n.id !== id));
  };

  // Teams customization state
  const [teamsList, setTeamsList] = useState<Team[]>(db.teams || []);

  useEffect(() => {
    setTeamsList(db.teams || []);
  }, [db.teams]);

  // Password / Pin update states
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');

  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  // Firebase configurations
  const [firebaseInput, setFirebaseInput] = useState(() => {
    return localStorage.getItem('mrms_firebase_url') || '';
  });

  // Report printing states
  const [reportTeamId, setReportTeamId] = useState('all');
  const [reportCatId, setReportCatId] = useState('all');

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Google Sheets integration state
  const [sheetId, setSheetIdState] = useState<string>(() => getSavedSheetId(db) || '');
  const [customWebhookUrl, setCustomWebhookUrl] = useState<string>(() => db.settings?.sheetWebhookUrl || db.settings?.appsScriptUrl || '');
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [autoSync, setAutoSyncState] = useState<boolean>(() => isAutoSyncEnabled());
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [sheetsLoading, setSheetsLoading] = useState<boolean>(false);
  const [sheetsStatusMsg, setSheetsStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Keep sheetId state synchronized if updated from central DB on another system
  useEffect(() => {
    const saved = getSavedSheetId(db);
    if (saved && saved !== sheetId) {
      setSheetIdState(saved);
      saveSheetId(saved);
    }
  }, [db.settings?.googleSheetId]);

  const handleSignInGoogleSheets = async () => {
    setSheetsLoading(true);
    setSheetsStatusMsg(null);
    try {
      const res = await signInWithGoogleForSheets();
      setGoogleUserEmail(res.user.email || 'Google User');
      setSheetsStatusMsg({ type: 'success', text: `Signed in as ${res.user.email || 'Google User'}` });

      if (sheetId) {
        await syncDataToGoogleSheet(db, sheetId, res.accessToken);
        setSheetsStatusMsg({ type: 'success', text: `Signed in as ${res.user.email} & synced latest data!` });
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setSheetsStatusMsg({ type: 'error', text: err?.message || 'Google sign in failed. Please try again.' });
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleCreateNewGoogleSheet = async () => {
    let token = getCachedToken();
    if (!token) {
      try {
        const authRes = await signInWithGoogleForSheets();
        token = authRes.accessToken;
        setGoogleUserEmail(authRes.user.email);
      } catch (err) {
        return;
      }
    }

    const existingSheetId = db.settings?.googleSheetId || getSavedSheetId(db);
    if (existingSheetId) {
      const confirmCreate = window.confirm('A permanent Google Sheet is already connected. Creating a new sheet will replace the existing connection. Are you sure you want to create a new sheet?');
      if (!confirmCreate) return;
    }

    setSheetsLoading(true);
    setSheetsStatusMsg(null);
    try {
      const evtTitle = db.settings.eventName || 'Meeladunnabi Celebrations';
      const created = await createGoogleSpreadsheet(`${evtTitle} - Competition Data`, token);
      setSheetIdState(created.id);
      saveSheetId(created.id);

      const updatedDbWithSheet = {
        ...db,
        settings: {
          ...db.settings,
          googleSheetId: created.id
        }
      };
      onImportBackup(updatedDbWithSheet);

      await syncDataToGoogleSheet(updatedDbWithSheet, created.id, token);
      setSheetsStatusMsg({
        type: 'success',
        text: `Permanent Google Sheet created (ID: ${created.id}) and successfully linked across all systems!`
      });
    } catch (err: any) {
      console.error('Create sheet error:', err);
      setSheetsStatusMsg({ type: 'error', text: err?.message || 'Failed to create Google Sheet.' });
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSyncToGoogleSheetsNow = async () => {
    setSheetsLoading(true);
    setSheetsStatusMsg(null);
    const syncResults: string[] = [];

    // 1. Webhook / Apps Script Server Proxy Push
    try {
      const targetUrl = customWebhookUrl.trim() || db.settings?.sheetWebhookUrl || db.settings?.appsScriptUrl;
      const proxyRes = await fetch('/api/webhook-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          payload: { action: 'write', db, lastModified: Date.now() },
          db
        })
      });
      const proxyData = await proxyRes.json();
      if (proxyData.success) {
        syncResults.push('Google Apps Script / Webhook Sync');
      }
    } catch (proxyErr) {
      console.warn('Proxy sync warning:', proxyErr);
    }

    // 2. Google Sheets OAuth API Sync (if signed in)
    const token = getCachedToken();
    if (sheetId && token) {
      try {
        await syncDataToGoogleSheet(db, sheetId, token);
        syncResults.push('Google Sheets API Sync');
      } catch (err: any) {
        console.warn('Sheets API sync warning:', err);
      }
    }

    setSheetsLoading(false);

    if (syncResults.length > 0) {
      setSheetsStatusMsg({
        type: 'success',
        text: `✅ ${syncResults.join(' & ')} completed successfully! All live scores and competition results are now pushed to Google Sheets.`
      });
    } else if (!sheetId && !customWebhookUrl) {
      setSheetsStatusMsg({
        type: 'error',
        text: '⚠️ No custom Google Webhook URL set and no Google Sheet connected. Please paste your Apps Script URL or click "Sign in with Google".'
      });
    } else {
      setSheetsStatusMsg({
        type: 'error',
        text: '⚠️ Sync attempt completed. Please verify your Google Sheet / Apps Script deployment access is set to "Anyone".'
      });
    }
  };

  const handlePullFromGoogleSheetsNow = async () => {
    let token = getCachedToken();
    if (!token) {
      try {
        const authRes = await signInWithGoogleForSheets();
        token = authRes.accessToken;
        setGoogleUserEmail(authRes.user.email);
      } catch (err: any) {
        setSheetsStatusMsg({ type: 'error', text: err?.message || 'Google Sign-In required to pull data from Google Sheets.' });
        return;
      }
    }

    if (!sheetId) {
      setSheetsStatusMsg({ type: 'error', text: 'Please enter a Google Sheet ID or click "Create New Sheet" first.' });
      return;
    }

    setSheetsLoading(true);
    setSheetsStatusMsg(null);
    try {
      const fetched = await fetchDataFromGoogleSheet(sheetId, token, db);
      if (fetched) {
        onImportBackup(fetched);
        setSheetsStatusMsg({ type: 'success', text: `Data from Google Sheet successfully imported into the app!` });
      } else {
        setSheetsStatusMsg({ type: 'error', text: `No data found in Google Sheet. Please perform "Push/Sync Now" first.` });
      }
    } catch (err: any) {
      console.error('Pull sheet error:', err);
      setSheetsStatusMsg({ type: 'error', text: err?.message || 'Failed to pull from Google Sheet.' });
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSyncState(enabled);
    setAutoSyncEnabled(enabled);
    if (enabled) {
      setSheetsStatusMsg({ type: 'success', text: '⚡ Auto-Sync Enabled! Any database update will automatically update your Google Sheet.' });
    }
  };

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const clearMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSavePoints = () => {
    clearMessages();
    onSavePoints({
      first: Number(ptFirst),
      second: Number(ptSecond),
      third: Number(ptThird),
      generalFirst: Number(ptGenFirst),
      generalSecond: Number(ptGenSecond),
      generalThird: Number(ptGenThird),
      participation: Number(ptPart),
      gradeA: Number(ptGA),
      gradeB: Number(ptGB),
      gradeC: Number(ptGC)
    });
    setSuccessMsg('Grading point structures updated successfully.');
  };

  const handleSaveEventDetails = () => {
    clearMessages();
    if (onSaveEventInfo) {
      onSaveEventInfo({
        eventName: evtName,
        boardName: brdName,
        subtitle: subName,
        eventLogo: evtLogo,
        showFinalWinner: showWinner,
        showScoreboard: showScoreboard,
        showCandidatePoints: showCandidatePoints,
        showDetailedScoreboard: showDetailedScoreboard,
        showIndividualChampions: showIndividualChampions,
        showNotice: showNotice,
        noticeTitle: noticesList[0]?.title || noticeTitle,
        noticeText: noticesList[0]?.text || noticeText,
        notices: noticesList,
        noticeDurationSecs: Number(noticeDurationSecs) || 8,
        colorTheme
      });
      setSuccessMsg('Event branding, notice duration & settings saved successfully!');
    }
  };

  const handlePasswordChange = (e: FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (cpNew !== cpConfirm) {
      setErrorMsg('New passwords do not match.');
      return;
    }
    if (onUpdatePassword(cpCurrent, cpNew)) {
      setSuccessMsg('Master password updated.');
      setCpCurrent('');
      setCpNew('');
      setCpConfirm('');
    } else {
      setErrorMsg('Current password is incorrect.');
    }
  };

  const handlePinChange = (e: FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (pinNew !== pinConfirm) {
      setErrorMsg('New PINs do not match.');
      return;
    }
    if (onUpdatePin(pinCurrent, pinNew)) {
      setSuccessMsg('Security PIN updated successfully.');
      setPinCurrent('');
      setPinNew('');
      setPinConfirm('');
    } else {
      setErrorMsg('Current PIN is incorrect.');
    }
  };

  const handleFirebaseSave = () => {
    clearMessages();
    onFirebaseUrlChange(firebaseInput);
    setSuccessMsg('Firebase Database URL updated.');
  };

  const handleJSONExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `meeladunnabi_backup_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
  };

  const handleJSONImport = (e: ChangeEvent<HTMLInputElement>) => {
    clearMessages();
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.teams && parsed.settings) {
          onImportBackup(parsed);
          setSuccessMsg('Database state restored successfully from backup.');
        } else {
          setErrorMsg('Invalid backup file schema.');
        }
      } catch (err) {
        setErrorMsg('Could not parse JSON backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExcelTemplate = () => {
    const wsData = [
      ['Number', 'Name', 'Class', 'Division', 'Gender', 'Team', 'Programs (codes, comma-separated)'],
      ['101', 'Muhammed Ali', '4', 'B', 'Boys', 'Team A', 'SB01, SB02'],
      ['102', 'Ayisha Fathima', '7', 'A', 'Girls', 'Team B', 'JR01']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 7 }, { wch: 9 }, { wch: 9 }, { wch: 14 }, { wch: 32 }];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Participants');

    const progRows = [['Program Code', 'Program Name', 'Category']];
    db.programs.forEach(p => {
      p.categories.forEach(c => {
        progRows.push([p.code, p.name, `${c.gender}${c.age === 'All' ? '' : ' ' + c.age}`]);
      });
    });
    const wsProgs = XLSX.utils.aoa_to_sheet(progRows);
    wsProgs['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsProgs, 'Program Codes');

    const teamRows = [['Team Name']];
    db.teams.forEach(t => teamRows.push([t.name]));
    const wsTeams = XLSX.utils.aoa_to_sheet(teamRows);
    XLSX.utils.book_append_sheet(wb, wsTeams, 'Teams');

    XLSX.writeFile(wb, 'Participant_Import_Template.xlsx');
  };

  const handleExcelUpload = (e: ChangeEvent<HTMLInputElement>) => {
    clearMessages();
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const importedList: any[] = [];
        rows.forEach(row => {
          const getVal = (candidates: string[]) => {
            if (!row || typeof row !== 'object') return '';
            const keys = Object.keys(row);
            for (const cand of candidates) {
              if (row[cand] !== undefined && row[cand] !== null && String(row[cand]).trim() !== '') {
                return String(row[cand]).trim();
              }
              const fk = keys.find(k => k.toLowerCase().trim() === cand.toLowerCase().trim());
              if (fk && row[fk] !== undefined && row[fk] !== null && String(row[fk]).trim() !== '') {
                return String(row[fk]).trim();
              }
            }
            for (const cand of candidates) {
              const fk = keys.find(k => k.toLowerCase().includes(cand.toLowerCase()));
              if (fk && row[fk] !== undefined && row[fk] !== null && String(row[fk]).trim() !== '') {
                return String(row[fk]).trim();
              }
            }
            return '';
          };

          const name = getVal(['Name', 'Student Name', 'Participant Name', 'Full Name', 'name']);
          if (!name) return;

          const number = getVal(['Number', 'Chest No', 'Chest Number', 'Chest', 'ChestNo', 'number', 'no']);
          const cls = getVal(['Class', 'Cls', 'Grade', 'Std', 'class']);
          const division = getVal(['Division', 'Div', 'Section', 'division']);
          
          const rawGender = getVal(['Gender', 'Sex', 'Category', 'Boy/Girl', 'gender', 'sex']).toLowerCase();
          let gender: 'Boys' | 'Girls' | 'General' = 'Boys';
          if (
            rawGender.includes('girl') || 
            rawGender.includes('female') || 
            rawGender.includes('പെൺ') || 
            rawGender === 'g' || 
            rawGender === 'f' ||
            rawGender.includes('lady') ||
            rawGender.includes('women')
          ) {
            gender = 'Girls';
          } else if (
            rawGender.includes('boy') || 
            rawGender.includes('male') || 
            rawGender.includes('ആൺ') || 
            rawGender === 'b' || 
            rawGender === 'm'
          ) {
            gender = 'Boys';
          } else if (rawGender.includes('gen') || rawGender.includes('all') || rawGender.includes('പൊതു')) {
            gender = 'General';
          }

          const teamName = getVal(['Team', 'Team Name', 'House', 'Group', 'team']);
          const matchedTeam = db.teams.find(t => t.name.toLowerCase() === teamName.toLowerCase());

          const rawPrograms = getVal(['Programs (codes, comma-separated)', 'Programs', 'Program Codes', 'Item Codes', 'Codes', 'programs', 'items']);
          const codes = rawPrograms.split(',').map((c: string) => c.trim()).filter(Boolean);

          importedList.push({
            number,
            name,
            cls,
            division,
            gender,
            teamId: matchedTeam ? matchedTeam.id : null,
            codes
          });
        });

        if (importedList.length > 0) {
          onBulkImportParticipants(importedList);
          setSuccessMsg(`Bulk imported ${importedList.length} participants successfully with gender detection.`);
        } else {
          setErrorMsg('No participants found in spreadsheet.');
        }
      } catch (err) {
        setErrorMsg('Failed to process spreadsheet file.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleProgramExcelTemplate = () => {
    const wsData = [
      ['Program Code', 'Program Name', 'Gender', 'Age Category', 'Program Type'],
      ['KD01', 'Song Competition', 'Boys', 'Kids', 'Single'],
      ['SB01', 'Qirat Recitation', 'Boys', 'Sub Junior', 'Single'],
      ['JR01', 'Elocution', 'Boys', 'Junior', 'Single'],
      ['SR01', 'Mappilappattu', 'Girls', 'Senior', 'Group'],
      ['OFF01', 'Essay Writing (Open to All)', 'General', 'All', 'Single']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 28 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Programs');

    const refData = [
      ['Allowed Gender Options', 'Allowed Age Category Options', 'Allowed Program Types'],
      ['Boys', 'Kids', 'Single'],
      ['Girls', 'Sub Junior', 'Group'],
      ['General', 'Junior', 'Single & Group'],
      ['', 'Senior', ''],
      ['', 'Super Senior', ''],
      ['', 'All', '']
    ];
    const refWs = XLSX.utils.aoa_to_sheet(refData);
    refWs['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, refWs, 'Valid Options Reference');

    XLSX.writeFile(wb, 'Program_Import_Template.xlsx');
  };

  const handleProgramExcelUpload = (e: ChangeEvent<HTMLInputElement>) => {
    clearMessages();
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const importedList: any[] = [];
        rows.forEach(row => {
          const code = (row['Program Code'] || row['Code'] || row['code'] || '').toString().trim();
          const name = (row['Program Name'] || row['Name'] || row['name'] || '').toString().trim();
          if (!code && !name) return;

          const rawStage = (row['Stage Type'] || row['Stage'] || row['stage'] || '').toString().trim();
          const stageType = rawStage.toLowerCase().includes('off') ? 'Offstage' : 'Main Stage';

          const rawGender = (row['Gender'] || row['gender'] || '').toString().trim();
          const gender = GENDERS.find(g => g.toLowerCase() === rawGender.toLowerCase()) || 'Boys';

          const rawAge = (row['Age Category'] || row['Age Group'] || row['Age'] || row['age'] || '').toString().trim();
          const ALL_AGES = [...AGES, 'All'];
          const age = ALL_AGES.find(a => a.toLowerCase() === rawAge.toLowerCase()) || (rawAge.toLowerCase().includes('all') ? 'All' : 'Junior');

          const rawType = (row['Program Type'] || row['Type'] || row['type'] || '').toString().trim().toLowerCase();
          const isGroup = rawType.includes('group');
          const isSingle = !isGroup || rawType.includes('single');

          const day = (row['Day / Date'] || row['Day'] || row['day'] || row['Date'] || row['date'] || 'Day 1').toString().trim();
          const startTime = (row['Start Time'] || row['start_time'] || row['startTime'] || '').toString().trim();
          const endTime = (row['End Time'] || row['end_time'] || row['endTime'] || '').toString().trim();
          const venue = (row['Venue'] || row['venue'] || '').toString().trim();
          let schedule = (row['Schedule Note'] || row['Schedule'] || row['schedule'] || '').toString().trim();

          if (!schedule && (day || startTime)) {
            schedule = `${day}${startTime ? ' ' + startTime : ''}`;
          }

          importedList.push({
            code: code || ('P' + Math.floor(Math.random() * 1000)),
            name: name || 'Unnamed Program',
            stageType,
            gender,
            age,
            single: isSingle,
            group: isGroup,
            day,
            startTime,
            endTime,
            venue,
            schedule
          });
        });

        if (importedList.length > 0) {
          if (onBulkImportPrograms) {
            onBulkImportPrograms(importedList);
            setSuccessMsg(`Bulk imported ${importedList.length} programs successfully.`);
          }
        } else {
          setErrorMsg('No valid programs found in spreadsheet. Ensure columns "Program Code" and "Program Name" are provided.');
        }
      } catch (err) {
        setErrorMsg('Failed to process program spreadsheet file.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Printing reports
  const handlePrintPrograms = () => {
    if (db.programs.length === 0) {
      setErrorMsg('No programs loaded.');
      return;
    }
    const currentEvtName = db.settings.eventName || 'KALIMA 2k26 MEELAD FEST';
    let html = `<h1>${currentEvtName} &mdash; Official Competition Program List</h1><p class="meta">Generated ${new Date().toLocaleDateString()}</p>`;
    
    ['Boys', 'Girls'].forEach(g => {
      AGES.forEach(age => {
        const progs = db.programs.filter(p => p.categories.some(c => c.gender === g && c.age === age));
        if (progs.length === 0) return;
        html += `<div class="cat-block"><h2>${g} Section &mdash; ${age} Group</h2>
          <table>
            <thead><tr><th>Program Code</th><th>Program Name</th><th>Gender</th><th>Age Category</th><th>Program Type</th></tr></thead>
            <tbody>${progs.map(p => `<tr><td><b>${p.code}</b></td><td>${p.name}</td><td>${g}</td><td>${age}</td><td>${p.single ? 'Single' : ''}${p.single && p.group ? '/' : ''}${p.group ? 'Group' : ''}</td></tr>`).join('')}</tbody>
          </table>
        </div>`;
      });
    });

    const genProgs = db.programs.filter(p => p.categories.some(c => c.gender === 'General'));
    if (genProgs.length > 0) {
      html += `<div class="cat-block"><h2>General Section</h2>
        <table>
          <thead><tr><th>Program Code</th><th>Program Name</th><th>Gender</th><th>Age Category</th><th>Program Type</th></tr></thead>
          <tbody>${genProgs.map(p => `<tr><td><b>${p.code}</b></td><td>${p.name}</td><td>General</td><td>All</td><td>${p.single ? 'Single' : ''}${p.single && p.group ? '/' : ''}${p.group ? 'Group' : ''}</td></tr>`).join('')}</tbody>
        </table>
      </div>`;
    }

    onGenerateReport('Program_Sheet.html', 'Official Program Sheet', html);
  };

  const handlePrintNoticeBoardSchedule = () => {
    const eventName = db.settings.eventName || 'KALIMA 2k26 MEELAD FEST';
    const boardName = db.settings.boardName || 'KALIMA 2k26 MEELAD FEST';

    const schedPrograms = db.programs.filter(p => 
      Boolean((p.startTime && p.startTime.trim()) || (p.day && p.day.trim()) || (p.schedule && p.schedule.trim() && p.schedule.trim().toLowerCase() !== 'pending schedule'))
    );

    const grouped: Record<string, Program[]> = {};
    schedPrograms.forEach(p => {
      const gKey = p.day || p.schedule || 'General Schedule';
      if (!grouped[gKey]) grouped[gKey] = [];
      grouped[gKey].push(p);
    });

    const bodyHTML = `
      <div style="font-family: Arial, Helvetica, sans-serif; padding: 25px; max-width: 950px; margin: 0 auto; color: #111827; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 4px solid #15803d; padding-bottom: 16px;">
          <div style="font-size: 11px; font-weight: bold; color: #b45309; text-transform: uppercase; letter-spacing: 2px;">OFFICIAL NOTICE BOARD PUBLICATION</div>
          <h1 style="margin: 4px 0 0; color: #15803d; font-size: 28px; font-weight: 800; text-transform: uppercase;">${eventName}</h1>
          <h2 style="margin: 4px 0 0; color: #374151; font-size: 16px; font-weight: 600;">${boardName}</h2>
          <div style="display: inline-block; margin-top: 10px; padding: 6px 18px; background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 20px; color: #15803d; font-weight: 700; font-size: 13px;">
            📅 DAILY PROGRAMME SCHEDULE SHEET
          </div>
        </div>

        ${Object.keys(grouped).length === 0 ? `
          <div style="text-align: center; padding: 40px; color: #6b7280; font-style: italic; border: 1px dashed #d1d5db; border-radius: 8px;">
            No scheduled programs found.
          </div>
        ` : Object.keys(grouped).map(gKey => `
          <div style="margin-bottom: 24px; page-break-inside: avoid;">
            <div style="background-color: #15803d; color: #ffffff; padding: 8px 14px; font-size: 13px; font-weight: bold; border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center;">
              <span>📆 ${gKey}</span>
              <span style="font-size: 11px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 10px;">Total: ${grouped[gKey].length} Items</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #d1d5db;">
              <thead>
                <tr style="background-color: #f3f4f6; color: #374151; text-align: left; font-size: 11px; text-transform: uppercase;">
                  <th style="padding: 10px 8px; border: 1px solid #d1d5db; width: 65px; text-align: center;">Code</th>
                  <th style="padding: 10px 8px; border: 1px solid #d1d5db;">Program Name</th>
                  <th style="padding: 10px 8px; border: 1px solid #d1d5db; width: 140px;">Category</th>
                  <th style="padding: 10px 8px; border: 1px solid #d1d5db; width: 130px;">Stage / Venue</th>
                  <th style="padding: 10px 8px; border: 1px solid #d1d5db; width: 130px;">Time / Slot</th>
                </tr>
              </thead>
              <tbody>
                ${grouped[gKey].map((p, idx) => {
                  const catStr = p.categories?.map(c => `${c.age} (${c.gender})`).join(', ') || 'General';
                  return `
                    <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                      <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; font-family: monospace; color: #15803d; text-align: center; font-size: 13px;">${p.code}</td>
                      <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; color: #111827;">${p.name}</td>
                      <td style="padding: 8px; border: 1px solid #e5e7eb; font-size: 11px; color: #4b5563;">${catStr}</td>
                      <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: 600; color: #b45309;">📍 ${p.stageType || 'Main Stage'}${p.venue ? ` (${p.venue})` : ''}</td>
                      <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; color: #15803d;">⏰ ${p.startTime || '-'}${p.endTime ? ' - ' + p.endTime : ''}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}

        <div style="margin-top: 30px; border-top: 2px dashed #d1d5db; padding-top: 16px; font-size: 11px; color: #4b5563; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-weight: bold; color: #111827;">📌 Notice Board Guidelines:</div>
            <div>1. Participants must report to the stage 15 minutes prior to scheduled start time.</div>
            <div>2. Schedule timings are subject to minor modifications by Stage Management Committee.</div>
            <div style="margin-top: 6px; font-size: 10px; color: #9ca3af;">Published on: ${new Date().toLocaleString()} &bull; Total Items: ${schedPrograms.length}</div>
          </div>
          <div style="text-align: center; width: 180px;">
            <div style="border-bottom: 1px solid #9ca3af; height: 35px; margin-bottom: 4px;"></div>
            <div style="font-weight: bold; color: #111827; font-size: 11px;">Stage & Schedule Controller</div>
            <div style="font-size: 10px; color: #6b7280;">Convenor Signature</div>
          </div>
        </div>
      </div>
    `;

    onGenerateReport('Notice_Board_Schedule.html', 'Official Notice Board Schedule Sheet', bodyHTML);
  };

  const handlePrintTeamSheet = () => {
    const teams = reportTeamId === 'all' ? db.teams : db.teams.filter(t => t.id === reportTeamId);
    const currentEvtName = db.settings.eventName || 'KALIMA 2k26 MEELAD FEST';
    let html = `<h1>${currentEvtName} &mdash; Team Participant Records</h1><p class="meta">Generated ${new Date().toLocaleDateString()}</p>`;

    let anyContent = false;
    teams.forEach((team, tIdx) => {
      const pageClass = tIdx > 0 ? 'team-block new-page' : 'team-block';
      let teamHTML = `<div class="${pageClass}"><h2>${team.symbol} ${team.name}</h2>`;
      let teamHasParts = false;

      const filterGender = reportCatId !== 'all' ? [reportCatId.split('|')[0]] : ['Boys', 'Girls', 'General'];
      const filterAge = reportCatId !== 'all' ? [reportCatId.split('|')[1]] : [...AGES, 'All'];

      filterGender.forEach(g => {
        filterAge.forEach(age => {
          const progs = db.programs.filter(p => p.categories.some(c => c.gender === g && (c.age === age || age === 'All')));
          progs.forEach(p => {
            const matchParts = db.participants.filter(pa => pa.teamId === team.id && pa.gender === g && (pa.age === age || age === 'All') && pa.programIds.includes(p.id));
            if (matchParts.length === 0) return;
            
            teamHasParts = true;
            anyContent = true;
            teamHTML += `<div class="cat-block"><h3>${p.code} &mdash; ${p.name} (${g} Section${age !== 'All' ? ` &bull; ${age}` : ''})</h3>
              <table>
                <thead><tr><th>No.</th><th>Candidate Name</th><th>Class</th><th>Division</th></tr></thead>
                <tbody>${matchParts.map(pa => `<tr><td><b>${pa.number}</b></td><td>${pa.name}</td><td>${pa.cls || '—'}</td><td>${pa.division || '—'}</td></tr>`).join('')}</tbody>
              </table>
            </div>`;
          });
        });
      });

      if (!teamHasParts) {
        teamHTML += `<p style="font-size: 11px; color:#888; font-style:italic;">No registered candidates found for this segment.</p>`;
      }
      teamHTML += `</div>`;
      html += teamHTML;
    });

    if (!anyContent) {
      setErrorMsg('No matches found for that criteria.');
      return;
    }

    onGenerateReport('Team_Sheets.html', 'Team Participant Sheets', html);
  };

  const handleDownloadTeamExcel = () => {
    const teams = reportTeamId === 'all' ? db.teams : db.teams.filter(t => t.id === reportTeamId);
    
    if (db.participants.length === 0) {
      setErrorMsg('No candidates available to export.');
      return;
    }

    const wb = XLSX.utils.book_new();

    teams.forEach(team => {
      ['Boys', 'Girls', 'General'].forEach(g => {
        const matchParts = db.participants.filter(pa => pa.teamId === team.id && pa.gender === g);
        if (matchParts.length > 0) {
          const rows = [
            ['Chest No', 'Name', 'Class', 'Division', 'Gender', 'Group Category', 'Team', 'Registered Programs']
          ];

          matchParts.forEach(pa => {
            const progs = (pa.programIds || [])
              .map(pid => {
                const prog = db.programs.find(p => p.id === pid);
                return prog ? `${prog.code} (${prog.name})` : '';
              })
              .filter(Boolean)
              .join(', ');

            rows.push([
              pa.number || '—',
              pa.name,
              pa.cls || '—',
              pa.division || '—',
              pa.gender || '—',
              classToAge(pa.cls),
              team.name,
              progs || 'None'
            ]);
          });

          const ws = XLSX.utils.aoa_to_sheet(rows);
          ws['!cols'] = [
            { wch: 10 },
            { wch: 24 },
            { wch: 7 },
            { wch: 9 },
            { wch: 14 },
            { wch: 16 },
            { wch: 16 },
            { wch: 45 }
          ];

          const sheetName = `${team.name} - ${g}`.replace(/[\\/?*:[\]]/g, '').slice(0, 31);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
      });
    });

    if (wb.SheetNames.length === 0) {
      setErrorMsg('No candidate matches found for the selected team/section criteria.');
      return;
    }

    const teamLabel = reportTeamId !== 'all' ? (db.teams.find(t => t.id === reportTeamId)?.name || 'Team') : 'All_Teams';
    XLSX.writeFile(wb, `Team_Candidates_${teamLabel}_Excel.xlsx`);
    setSuccessMsg('✅ Successfully exported candidate Excel sheet with team & gender tabs!');
  };

  const handleDownloadTeamMatrixExcel = () => {
    const teams = reportTeamId === 'all' ? db.teams : db.teams.filter(t => t.id === reportTeamId);
    
    if (db.participants.length === 0) {
      setErrorMsg('No candidates available to export matrix.');
      return;
    }

    const filterGender = reportCatId !== 'all' ? [reportCatId.split('|')[0]] : ['Boys', 'Girls', 'General'];
    const filterAge = reportCatId !== 'all' ? [reportCatId.split('|')[1]] : [...AGES, 'General'];

    const wb = XLSX.utils.book_new();

    teams.forEach(team => {
      filterGender.forEach(g => {
        filterAge.forEach(ageCat => {
          const progs = db.programs.filter(p => {
            const isGenProg = p.categories.some(c => c.gender === 'General' || c.age === 'All' || c.age === 'General');
            if (isGenProg) {
              if (ageCat === 'Kids') return false;
              return g === 'General' || ageCat === 'General' || ageCat !== 'Kids';
            }
            return p.categories.some(c => 
              (c.gender === g || c.gender === 'General') && 
              (c.age === ageCat || c.age === 'All' || c.age === 'General')
            );
          });

          if (progs.length === 0) return;

          const candidates = db.participants.filter(pa => {
            if (pa.teamId !== team.id) return false;
            if (pa.gender !== g) return false;
            const candAge = classToAge(pa.cls);
            if (ageCat !== 'All' && candAge !== ageCat) return false;
            return true;
          });

          if (candidates.length === 0) return;

          const titleRow = [`${team.symbol} ${team.name} — ${ageCat} (${g} Section) — Program Checklist Grid Matrix`];
          const headerRow = ['Chest No', 'Candidate Name', 'Class', 'Div', ...progs.map(p => `${p.code} - ${p.name}`), 'Total Reg'];
          const rows = [titleRow, [], headerRow];

          candidates.sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0)).forEach(cand => {
            const candProgs = cand.programIds || [];
            rows.push([
              cand.number || '—',
              cand.name,
              cand.cls || '—',
              cand.division || '—',
              ...progs.map(p => candProgs.includes(p.id) ? '✓' : ''),
              String(candProgs.length)
            ]);
          });

          for (let i = 0; i < 3; i++) {
            rows.push(['[  ]', '____________________', '__', '__', ...progs.map(() => '[  ]'), '0']);
          }

          const ws = XLSX.utils.aoa_to_sheet(rows);
          ws['!cols'] = [{ wch: 10 }, { wch: 24 }, { wch: 7 }, { wch: 9 }, ...progs.map(() => ({ wch: 18 })), { wch: 10 }];

          const sheetName = `${team.name.slice(0, 10)} ${ageCat.slice(0, 6)} ${g}`.replace(/[\\/?*:[\]]/g, '').slice(0, 31);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });
      });
    });

    if (wb.SheetNames.length === 0) {
      setErrorMsg('No matches found for that team/category matrix combination.');
      return;
    }

    const teamLabel = reportTeamId !== 'all' ? (db.teams.find(t => t.id === reportTeamId)?.name || 'Team') : 'All_Teams';
    XLSX.writeFile(wb, `Team_Leader_Grid_Matrix_${teamLabel}.xlsx`);
    setSuccessMsg('✅ Successfully generated Team Leader Matrix Excel sheet!');
  };

  return (
    <div className="view active pb-20 max-w-2xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-brand-gold-500" />
        <h2 className="font-display font-bold text-brand-green-900 text-sm md:text-base">
          System Preferences &amp; Config
        </h2>
      </div>

      {/* Success / Error notification bar */}
      {(successMsg || errorMsg) && (
        <div className={`p-4 rounded-xl text-xs font-semibold select-none flex items-start gap-2 border ${
          successMsg ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="flex-1 leading-normal">{successMsg || errorMsg}</p>
        </div>
      )}

      {/* Event Details & Public Link Configuration */}
      {isAdmin && (
        <>
          {/* Public Website Link Access Control */}
          <div className={`p-5 rounded-2xl border-2 shadow-sm space-y-4 transition-all ${
            db.settings?.isPublicSiteOffline 
              ? 'bg-red-500/10 border-red-500/40' 
              : 'bg-emerald-500/10 border-emerald-500/40'
          }`}>
            <div className="flex items-center justify-between gap-3 border-b border-brand-line/50 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{db.settings?.isPublicSiteOffline ? '🔴' : '🟢'}</span>
                <div>
                  <h3 className="font-display font-bold text-brand-green-950 text-xs md:text-sm">
                    🌐 Public Website Link Access Control (ON / OFF)
                  </h3>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                    db.settings?.isPublicSiteOffline ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                  }`}>
                    Status: {db.settings?.isPublicSiteOffline ? 'OFF (404 Maintenance Mode)' : 'ON (Public Live View Active)'}
                  </span>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={!db.settings?.isPublicSiteOffline}
                  onChange={(e) => {
                    const isON = e.target.checked;
                    const isOffline = !isON;
                    if (onSaveEventInfo) {
                      onSaveEventInfo({
                        eventName: evtName,
                        boardName: brdName,
                        subtitle: subName,
                        eventLogo: evtLogo,
                        showFinalWinner: showWinner,
                        showScoreboard: showScoreboard,
                        showCandidatePoints: showCandidatePoints,
                        showDetailedScoreboard: showDetailedScoreboard,
                        showIndividualChampions: showIndividualChampions,
                        showNotice: showNotice,
                        noticeTitle: noticesList[0]?.title || noticeTitle,
                        noticeText: noticesList[0]?.text || noticeText,
                        notices: noticesList,
                        noticeDurationSecs: Number(noticeDurationSecs) || 8,
                        colorTheme,
                        isPublicSiteOffline: isOffline
                      });
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-red-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
              </label>
            </div>

            <p className="text-xs text-brand-ink-soft leading-relaxed">
              {db.settings?.isPublicSiteOffline 
                ? '⚠️ Link is OFF: Visitors and parents accessing this link will see a 404 Error Page. Admins can sign in using their admin password.'
                : '✅ Link is ON: Competition data, live scoreboards, and program schedules are viewable by everyone.'}
            </p>

            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wider block">
                ✏️ Custom 404 Message for Public Users:
              </label>
              <input
                type="text"
                value={db.settings?.offlineMessage || ''}
                onChange={(e) => {
                  const msg = e.target.value;
                  if (onSaveEventInfo) {
                    onSaveEventInfo({
                      eventName: evtName,
                      boardName: brdName,
                      subtitle: subName,
                      eventLogo: evtLogo,
                      showFinalWinner: showWinner,
                      showScoreboard: showScoreboard,
                      showCandidatePoints: showCandidatePoints,
                      showDetailedScoreboard: showDetailedScoreboard,
                      showIndividualChampions: showIndividualChampions,
                      showNotice: showNotice,
                      noticeTitle: noticesList[0]?.title || noticeTitle,
                      noticeText: noticesList[0]?.text || noticeText,
                      notices: noticesList,
                      noticeDurationSecs: Number(noticeDurationSecs) || 8,
                      colorTheme,
                      offlineMessage: msg
                    });
                  }
                }}
                className="w-full px-3.5 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs text-brand-ink focus:outline-none focus:border-brand-gold-500"
                placeholder="This public link is currently switched off by Abdul Haseeb PC."
              />
            </div>
          </div>

          <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-display font-bold text-brand-green-950 text-xs md:text-sm flex items-center gap-1.5 border-b border-brand-line/50 pb-2">
            <span>📝</span> Event Branding
          </h3>
          <p className="text-[11px] text-brand-ink-soft leading-relaxed">
            Customize the title, organization name, and slogan shown on the headers and scoreboard of all clients.
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-ink-soft">Event Name</label>
              <input
                type="text"
                value={evtName}
                onChange={(e) => setEvtName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs md:text-sm text-brand-ink focus:outline-none focus:border-brand-gold-500"
                placeholder="Meeladunnabi Celebrations"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-ink-soft">Board/Committee Name</label>
              <input
                type="text"
                value={brdName}
                onChange={(e) => setBrdName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs md:text-sm text-brand-ink focus:outline-none focus:border-brand-gold-500"
                placeholder="Islamic Academic Board"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-ink-soft">Subtext/Slogan</label>
              <input
                type="text"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs md:text-sm text-brand-ink focus:outline-none focus:border-brand-gold-500"
                placeholder="Live Competition Results, Scoring Points & Schedules"
              />
            </div>

            {/* Logo Upload Section */}
            <div className="space-y-1.5 p-3.5 bg-brand-bg rounded-xl border border-brand-line">
              <label className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wider block">
                🖼️ Event / Board Logo (Official Crest / Emblem)
              </label>
              <div className="flex items-center gap-3">
                {evtLogo ? (
                  <div className="relative group shrink-0">
                    <img 
                      src={evtLogo} 
                      alt="Event Logo Preview" 
                      className="w-14 h-14 object-contain rounded-xl bg-white p-1 border border-brand-line shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setEvtLogo('')}
                      className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow hover:bg-rose-700 cursor-pointer"
                      title="Remove Logo"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-xl border-2 border-dashed border-brand-line flex items-center justify-center bg-white/50 text-2xl text-brand-ink-soft shrink-0">
                    🏛️
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="block w-full text-xs text-brand-ink-soft file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-green-800 file:text-white hover:file:bg-brand-green-700 cursor-pointer"
                  />
                  <p className="text-[10px] text-brand-ink-soft">
                    Upload PNG, JPG, or SVG logo image (Max 2MB). Displayed prominently on the main Home banner opposite Candidates, Teams & Programs counter cards.
                  </p>
                </div>
              </div>
            </div>

            {/* Color Theme Selector Panel */}
            <div className="p-4 bg-brand-bg rounded-xl border border-brand-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-ink flex items-center gap-2">
                  <span>🎨</span> Display Theme & High-Contrast Outdoor Mode
                </span>
                <span className="text-[10px] font-bold text-brand-green-800 bg-brand-green-100 px-2 py-0.5 rounded-full">
                  Accessibility
                </span>
              </div>
              <p className="text-[11px] text-brand-ink-soft">
                Choose a color scheme to optimize readability for daylight, outdoor projector screens, or bright environments.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setColorTheme('natural')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    colorTheme === 'natural'
                      ? 'border-brand-green-800 bg-brand-panel ring-2 ring-brand-green-800/20 shadow-xs'
                      : 'border-brand-line bg-white hover:bg-brand-bg'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-brand-ink flex items-center gap-1.5">
                      <span>🌿</span> Natural Tones
                    </div>
                    <div className="text-[10px] text-brand-ink-soft">
                      Original warm earth palette (Default)
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full border border-emerald-700 bg-[#f4f3ed] flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#1b4332]" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setColorTheme('outdoor-light')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    colorTheme === 'outdoor-light'
                      ? 'border-emerald-600 bg-slate-50 ring-2 ring-emerald-600/20 shadow-xs'
                      : 'border-brand-line bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>☀️</span> Outdoor High Light
                    </div>
                    <div className="text-[10px] text-slate-600">
                      High contrast crisp white & emerald
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full border border-emerald-800 bg-white flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setColorTheme('outdoor-dark')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    colorTheme === 'outdoor-dark'
                      ? 'border-teal-500 bg-slate-900 text-white ring-2 ring-teal-500/20 shadow-xs'
                      : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                      <span>🌙</span> Night Stage / Dark
                    </div>
                    <div className="text-[10px] text-slate-300">
                      Deep contrast for night events
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full border border-teal-400 bg-slate-950 flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setColorTheme('solar-high-contrast')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    colorTheme === 'solar-high-contrast'
                      ? 'border-black bg-yellow-100 ring-2 ring-black/30 shadow-xs'
                      : 'border-amber-300 bg-yellow-50 hover:bg-yellow-100'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-black flex items-center gap-1.5">
                      <span>⚡</span> Solar Ultra-Contrast
                    </div>
                    <div className="text-[10px] text-neutral-800 font-medium">
                      Maximum readability under direct sunlight
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 border-black bg-yellow-300 flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-black" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setColorTheme('royal-gold')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    colorTheme === 'royal-gold'
                      ? 'border-amber-400 bg-blue-950 text-white ring-2 ring-amber-400/30 shadow-xs'
                      : 'border-blue-900 bg-slate-900 text-slate-100 hover:bg-blue-950'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span>👑</span> Royal Gold & Navy
                    </div>
                    <div className="text-[10px] text-blue-200">
                      Midnight blue canvas with gold typography
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full border border-amber-400 bg-blue-950 flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setColorTheme('emerald-luxury')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    colorTheme === 'emerald-luxury'
                      ? 'border-emerald-400 bg-emerald-950 text-white ring-2 ring-emerald-400/30 shadow-xs'
                      : 'border-emerald-900 bg-slate-900 text-emerald-100 hover:bg-emerald-950'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <span>💎</span> Emerald Luxury
                    </div>
                    <div className="text-[10px] text-emerald-200">
                      Deep forest emerald & champagne gold
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full border border-emerald-400 bg-emerald-950 flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setColorTheme('crimson-ruby')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    colorTheme === 'crimson-ruby'
                      ? 'border-rose-400 bg-rose-950 text-white ring-2 ring-rose-400/30 shadow-xs'
                      : 'border-rose-900 bg-slate-900 text-rose-100 hover:bg-rose-950'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                      <span>🍷</span> Crimson Ruby
                    </div>
                    <div className="text-[10px] text-rose-200">
                      Velvet maroon canvas & gold accents
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full border border-rose-400 bg-rose-950 flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setColorTheme('ocean-breeze')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    colorTheme === 'ocean-breeze'
                      ? 'border-cyan-600 bg-cyan-50 ring-2 ring-cyan-600/20 shadow-xs'
                      : 'border-brand-line bg-white hover:bg-cyan-50/50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-cyan-950 flex items-center gap-1.5">
                      <span>🌊</span> Ocean Aqua Breeze
                    </div>
                    <div className="text-[10px] text-cyan-800">
                      Light cyan breeze & deep dark navy ink
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full border border-cyan-700 bg-cyan-100 flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-700" />
                  </div>
                </button>
              </div>
            </div>



            {/* Championship Podium Control Panel */}
            <div className="p-4 bg-gradient-to-r from-amber-500/15 via-brand-gold-500/25 to-amber-500/15 border-2 border-brand-gold-400/80 rounded-2xl space-y-4 shadow-sm">
              {/* Switch 1: Live Celebration Pop-Up Modal */}
              <div className="flex items-center justify-between gap-3 flex-wrap border-b border-brand-gold-500/30 pb-3">
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-2xl shrink-0">🎆</span>
                    <h4 className="text-xs font-extrabold text-brand-green-950 uppercase tracking-wide">
                      Fullscreen Live Ceremony Modal
                    </h4>
                    {db.settings?.isLiveCelebrationActive && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-600 text-white animate-pulse">
                        LIVE CEREMONY ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-brand-green-900 font-medium leading-relaxed">
                    Immediately opens live full-screen celebration modal on ALL connected devices. Turning OFF closes it instantly.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={!!db.settings?.isLiveCelebrationActive}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      const updated = {
                        ...db,
                        settings: {
                          ...db.settings,
                          isLiveCelebrationActive: enabled,
                          revealPodiumTime: enabled ? Date.now() : undefined,
                          confettiUntil: enabled ? Date.now() + 60000 : undefined,
                        }
                      };
                      onImportBackup(updated);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-rose-600"></div>
                </label>
              </div>

              {/* Switch 2: Main Screen Champions Podium Card */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-2xl shrink-0">🏆</span>
                    <h4 className="text-xs font-extrabold text-brand-green-950 uppercase tracking-wide">
                      Show Champions Podium Card on Main Screen (Home / Scoreboard)
                    </h4>
                    {db.settings?.showFinalWinner && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-600 text-white">
                        MAIN SCREEN ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-brand-green-900 font-medium leading-relaxed">
                    Displays the Champions Podium (1st, 2nd, 3rd) continuously on the Home & Scoreboard screens with glowing animations.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={!!db.settings?.showFinalWinner}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setShowWinner(enabled);
                      const updated = {
                        ...db,
                        settings: {
                          ...db.settings,
                          showFinalWinner: enabled,
                        }
                      };
                      onImportBackup(updated);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              <div className="pt-2 border-t border-brand-gold-500/30 flex items-center justify-between gap-2 text-xs">
                <span className="text-[11px] font-bold text-brand-green-950">
                  ⚡ Direct Podium View (Skip Countdown):
                </span>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={!!db.settings?.skipPodiumCountdown}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      const updated = {
                        ...db,
                        settings: {
                          ...db.settings,
                          skipPodiumCountdown: enabled,
                        }
                      };
                      onImportBackup(updated);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
            <div className="p-4 bg-gradient-to-r from-blue-500/15 via-sky-500/20 to-blue-500/15 border-2 border-sky-400/80 rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-2xl shrink-0">🛡️</span>
                    <h4 className="text-xs font-extrabold text-brand-green-950 uppercase tracking-wide">
                      Always-On Team Display Switch
                    </h4>
                    {db.settings?.showAlwaysTeamBanner && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-sky-600 text-white animate-pulse">
                        DISPLAY ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-brand-green-900 font-medium leading-relaxed">
                    Continuously displays team banners across the top of the app. Toggle points view below.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={!!db.settings?.showAlwaysTeamBanner}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      const updated = {
                        ...db,
                        settings: {
                          ...db.settings,
                          showAlwaysTeamBanner: enabled,
                        }
                      };
                      onImportBackup(updated);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {db.settings?.showAlwaysTeamBanner && (
                <div className="pt-2 border-t border-sky-500/30 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] font-bold text-brand-green-950">
                    🔢 Show Points in Banner:
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={db.settings?.showTeamPointsInBanner !== false}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        const updated = {
                          ...db,
                          settings: {
                            ...db.settings,
                            showTeamPointsInBanner: enabled,
                          }
                        };
                        onImportBackup(updated);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              )}
            </div>

            {/* Team Performance Bar & Trend Graph Switch */}
            <div className="p-4 bg-gradient-to-r from-emerald-500/15 via-teal-500/20 to-emerald-500/15 border-2 border-teal-400/80 rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-2xl shrink-0">📊</span>
                    <h4 className="text-xs font-extrabold text-brand-green-950 uppercase tracking-wide">
                      Team Performance Bar Graph & Trend Switch
                    </h4>
                    {db.settings?.showTeamAnalyticsGraph && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-teal-600 text-white animate-pulse">
                        GRAPH ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-brand-green-900 font-medium leading-relaxed">
                    Displays team score totals along with rank advancement or drop trend bar graphs.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={!!db.settings?.showTeamAnalyticsGraph}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      const updated = {
                        ...db,
                        settings: {
                          ...db.settings,
                          showTeamAnalyticsGraph: enabled,
                        }
                      };
                      onImportBackup(updated);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>
            </div>

            {/* Live Rotating Team Score Flash Switch */}
            <div className="p-4 bg-gradient-to-r from-purple-500/15 via-indigo-500/20 to-purple-500/15 border-2 border-indigo-400/80 rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-2xl shrink-0">⚡</span>
                    <h4 className="text-xs font-extrabold text-brand-green-950 uppercase tracking-wide">
                      Live Rotating Team Score Flash Switch
                    </h4>
                    {db.settings?.showTeamTicker && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-600 text-white animate-pulse">
                        TEAM FLASH ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-brand-green-900 font-medium leading-relaxed">
                    When enabled, team points will sequentially flash in vibrant colors across the screen.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={!!db.settings?.showTeamTicker}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      const updated = {
                        ...db,
                        settings: {
                          ...db.settings,
                          showTeamTicker: enabled,
                        }
                      };
                      onImportBackup(updated);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            {/* Curiosity / Suspense Top 3 Teams Rotation Switch */}
            <div className="p-4 bg-gradient-to-r from-amber-500/15 via-rose-500/20 to-amber-500/15 border-2 border-amber-400/80 rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-2xl shrink-0">🔀</span>
                    <h4 className="text-xs font-extrabold text-brand-green-950 uppercase tracking-wide">
                      Curiosity / Suspense Mode (1st, 2nd & 3rd Team Position Rotation)
                    </h4>
                    {db.settings?.suspenseSwapMode && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-600 text-white animate-pulse">
                        SUSPENSE ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-brand-green-900 font-medium leading-relaxed">
                    Dynamic Leaderboard Mode: Cycle teams in top positions at regular intervals. Turning off restores actual rankings.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={!!db.settings?.suspenseSwapMode}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      const updated = {
                        ...db,
                        settings: {
                          ...db.settings,
                          suspenseSwapMode: enabled,
                        }
                      };
                      onImportBackup(updated);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* Rotation Time Speed Option */}
              {db.settings?.suspenseSwapMode && (
                <div className="pt-2 border-t border-amber-300/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <label className="font-bold text-brand-green-950 flex items-center gap-1.5">
                    ⏱️ Rotation Speed (Interval in seconds):
                  </label>
                  <select
                    value={db.settings?.suspenseIntervalSec || 3}
                    onChange={(e) => {
                      const sec = parseInt(e.target.value, 10) || 3;
                      const updated = {
                        ...db,
                        settings: {
                          ...db.settings,
                          suspenseIntervalSec: sec,
                        }
                      };
                      onImportBackup(updated);
                    }}
                    className="px-3 py-1.5 bg-white border border-amber-400 rounded-xl text-xs font-bold text-brand-green-950 focus:outline-none shadow-2xs cursor-pointer"
                  >
                    <option value={1}>⚡ 1 Second (Very Fast)</option>
                    <option value={2}>🚀 2 Seconds (Fast)</option>
                    <option value={3}>🎯 3 Seconds (Standard Default)</option>
                    <option value={5}>🐢 5 Seconds (Slow)</option>
                    <option value={10}>⏳ 10 Seconds (Very Slow)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="p-3.5 bg-brand-panel border border-brand-line rounded-xl flex items-start gap-2.5">
              <input
                type="checkbox"
                id="showScoreboardChk"
                checked={showScoreboard}
                onChange={(e) => {
                  const val = e.target.checked;
                  setShowScoreboard(val);
                  if (onSaveEventInfo) {
                    onSaveEventInfo({
                      eventName: evtName,
                      boardName: brdName,
                      subtitle: subName,
                      eventLogo: evtLogo,
                      showFinalWinner: showWinner,
                      showScoreboard: val,
                      showCandidatePoints: showCandidatePoints,
                      showDetailedScoreboard: showDetailedScoreboard,
                      showIndividualChampions: showIndividualChampions,
                      showNotice: showNotice,
                      noticeTitle: noticesList[0]?.title || noticeTitle,
                      noticeText: noticesList[0]?.text || noticeText,
                      notices: noticesList,
                      noticeDurationSecs: Number(noticeDurationSecs) || 8,
                      colorTheme
                    });
                  }
                }}
                className="w-4 h-4 rounded mt-0.5 accent-brand-green-800 cursor-pointer"
              />
              <label htmlFor="showScoreboardChk" className="text-xs text-brand-ink font-semibold cursor-pointer select-none leading-normal">
                📊 Enable Overall Team Scoreboard View<br/>
                <span className="text-[10px] text-brand-ink-soft font-normal">
                  Uncheck to temporarily hide/pause the overall team scoreboard from public viewers.
                </span>
              </label>
            </div>

            <div className="p-3.5 bg-brand-panel border border-brand-line rounded-xl flex items-start gap-2.5">
              <input
                type="checkbox"
                id="showCandidatePointsChk"
                checked={showCandidatePoints}
                onChange={(e) => {
                  const val = e.target.checked;
                  setShowCandidatePoints(val);
                  if (onSaveEventInfo) {
                    onSaveEventInfo({
                      eventName: evtName,
                      boardName: brdName,
                      subtitle: subName,
                      eventLogo: evtLogo,
                      showFinalWinner: showWinner,
                      showScoreboard: showScoreboard,
                      showCandidatePoints: val,
                      showDetailedScoreboard: showDetailedScoreboard,
                      showIndividualChampions: showIndividualChampions,
                      showNotice: showNotice,
                      noticeTitle: noticesList[0]?.title || noticeTitle,
                      noticeText: noticesList[0]?.text || noticeText,
                      notices: noticesList,
                      noticeDurationSecs: Number(noticeDurationSecs) || 8,
                      colorTheme
                    });
                  }
                }}
                className="w-4 h-4 rounded mt-0.5 accent-brand-green-800 cursor-pointer"
              />
              <label htmlFor="showCandidatePointsChk" className="text-xs text-brand-ink font-semibold cursor-pointer select-none leading-normal">
                👤 Enable Individual Candidate Points &amp; Details Search<br/>
                <span className="text-[10px] text-brand-ink-soft font-normal">
                  Show or hide individual student scores, search card, and candidate points table on the scoreboard.
                </span>
              </label>
            </div>

            <div className="p-3.5 bg-brand-panel border border-brand-line rounded-xl flex items-start gap-2.5">
              <input
                type="checkbox"
                id="showDetailedScoreboardChk"
                checked={showDetailedScoreboard}
                onChange={(e) => {
                  const val = e.target.checked;
                  setShowDetailedScoreboard(val);
                  if (onSaveEventInfo) {
                    onSaveEventInfo({
                      eventName: evtName,
                      boardName: brdName,
                      subtitle: subName,
                      eventLogo: evtLogo,
                      showFinalWinner: showWinner,
                      showScoreboard: showScoreboard,
                      showCandidatePoints: showCandidatePoints,
                      showDetailedScoreboard: val,
                      showIndividualChampions: showIndividualChampions,
                      showNotice: showNotice,
                      noticeTitle: noticesList[0]?.title || noticeTitle,
                      noticeText: noticesList[0]?.text || noticeText,
                      notices: noticesList,
                      noticeDurationSecs: Number(noticeDurationSecs) || 8,
                      colorTheme
                    });
                  }
                }}
                className="w-4 h-4 rounded mt-0.5 accent-brand-green-800 cursor-pointer"
              />
              <label htmlFor="showDetailedScoreboardChk" className="text-xs text-brand-ink font-semibold cursor-pointer select-none leading-normal">
                📈 Show Category &amp; Stage Breakdown Points<br/>
                <span className="text-[10px] text-brand-ink-soft font-normal">
                  Show or hide detailed Boys, Girls, Offstage, and Category division point breakdowns on the scoreboard.
                </span>
              </label>
            </div>

            <div className="p-3.5 bg-brand-panel border border-brand-line rounded-xl flex items-start gap-2.5">
              <input
                type="checkbox"
                id="showIndividualChampionsChk"
                checked={showIndividualChampions}
                onChange={(e) => {
                  const val = e.target.checked;
                  setShowIndividualChampions(val);
                  if (onSaveEventInfo) {
                    onSaveEventInfo({
                      eventName: evtName,
                      boardName: brdName,
                      subtitle: subName,
                      eventLogo: evtLogo,
                      showFinalWinner: showWinner,
                      showScoreboard: showScoreboard,
                      showCandidatePoints: showCandidatePoints,
                      showDetailedScoreboard: showDetailedScoreboard,
                      showIndividualChampions: val,
                      showNotice: showNotice,
                      noticeTitle: noticesList[0]?.title || noticeTitle,
                      noticeText: noticesList[0]?.text || noticeText,
                      notices: noticesList,
                      noticeDurationSecs: Number(noticeDurationSecs) || 8,
                      colorTheme
                    });
                  }
                }}
                className="w-4 h-4 rounded mt-0.5 accent-brand-green-800 cursor-pointer"
              />
              <label htmlFor="showIndividualChampionsChk" className="text-xs text-brand-ink font-semibold cursor-pointer select-none leading-normal">
                🏅 Show Category Individual Champions Section<br/>
                <span className="text-[10px] text-brand-ink-soft font-normal">
                  Show or hide individual champions by Kids, Sub Junior, Junior, Senior, and Super Senior (Boys &amp; Girls) section.
                </span>
              </label>
            </div>

            {/* Category Class Breakdown Info */}
            <div className="p-4 bg-brand-green-50/80 border border-brand-green-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-green-950 flex items-center gap-1.5">
                  <span>🎓</span> Active Age Categories &amp; Class Mapping
                </span>
                <span className="text-[10px] font-extrabold text-brand-green-800 bg-brand-green-100 px-2 py-0.5 rounded-full">
                  System Standard
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-brand-green-200">
                  <div className="font-bold text-brand-green-900 flex items-center gap-1">🧒 KIDS</div>
                  <div className="text-[11px] text-brand-ink-soft font-medium">Classes: <strong>1, 2</strong></div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-brand-green-200">
                  <div className="font-bold text-brand-green-900 flex items-center gap-1">🎒 SUB JUNIOR</div>
                  <div className="text-[11px] text-brand-ink-soft font-medium">Classes: <strong>3, 4</strong></div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-brand-green-200">
                  <div className="font-bold text-brand-green-900 flex items-center gap-1">⭐ JUNIOR</div>
                  <div className="text-[11px] text-brand-ink-soft font-medium">Classes: <strong>5, 6</strong></div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-brand-green-200">
                  <div className="font-bold text-brand-green-900 flex items-center gap-1">🔥 SENIOR</div>
                  <div className="text-[11px] text-brand-ink-soft font-medium">Classes: <strong>7, 8</strong></div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-brand-green-200">
                  <div className="font-bold text-brand-green-900 flex items-center gap-1">🎓 SUPER SENIOR</div>
                  <div className="text-[11px] text-brand-ink-soft font-medium">Classes: <strong>9, 10, 11, 12</strong></div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-brand-green-200">
                  <div className="font-bold text-brand-green-900 flex items-center gap-1">🌐 GENERAL PROGRAM</div>
                  <div className="text-[11px] text-brand-ink-soft font-medium">Open to <strong>All Classes &amp; Both Genders</strong></div>
                </div>
              </div>
            </div>

            {/* Notice Board & Sponsor Advertisements Configuration */}
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="showNoticeChk"
                    checked={showNotice}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setShowNotice(val);
                      if (onSaveEventInfo) {
                        onSaveEventInfo({
                          eventName: evtName,
                          boardName: brdName,
                          subtitle: subName,
                          eventLogo: evtLogo,
                          showFinalWinner: showWinner,
                          showScoreboard: showScoreboard,
                          showCandidatePoints: showCandidatePoints,
                          showDetailedScoreboard: showDetailedScoreboard,
                          showIndividualChampions: showIndividualChampions,
                          showNotice: val,
                          noticeTitle: noticesList[0]?.title || noticeTitle,
                          noticeText: noticesList[0]?.text || noticeText,
                          notices: noticesList,
                          noticeDurationSecs: Number(noticeDurationSecs) || 8,
                          colorTheme
                        });
                      }
                    }}
                    className="w-4 h-4 rounded mt-0.5 accent-amber-600 cursor-pointer"
                  />
                  <label htmlFor="showNoticeChk" className="text-xs text-brand-ink font-bold cursor-pointer select-none leading-normal">
                    📢 Enable Main Notice Board & Sponsor Ads<br/>
                    <span className="text-[10px] text-brand-ink-soft font-normal">
                      Turn ON/OFF to display live announcements, news & shop sponsor posters prominently on the Home screen.
                    </span>
                  </label>
                </div>

                {/* Duration Setting (in Seconds) */}
                <div className="bg-white p-2.5 rounded-xl border border-amber-300 shrink-0 flex items-center gap-2">
                  <label htmlFor="noticeDurationInput" className="text-[10px] font-bold text-amber-950 uppercase tracking-wider">
                    ⏱️ Display Duration:
                  </label>
                  <input
                    id="noticeDurationInput"
                    type="number"
                    min={3}
                    max={120}
                    value={noticeDurationSecs}
                    onChange={(e) => setNoticeDurationSecs(Math.max(3, parseInt(e.target.value) || 8))}
                    className="w-16 px-2 py-1 bg-amber-50 border border-amber-300 rounded text-xs font-mono font-bold text-center text-amber-950 focus:outline-none"
                  />
                  <span className="text-[10px] font-bold text-amber-800">Seconds</span>
                </div>
              </div>

              {showNotice && (
                <div className="space-y-4 pt-2 border-t border-amber-300/40">
                  {/* Create / Edit Form */}
                  <div className="p-3.5 bg-white rounded-xl border border-amber-300 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                      <span className="text-xs font-bold text-brand-green-950 flex items-center gap-1.5">
                        <span>{editingNoticeId ? '✏️' : '➕'}</span>
                        {editingNoticeId ? 'Edit Announcement / Sponsor Ad' : 'Add New Announcement or Sponsor Ad'}
                      </span>
                      {editingNoticeId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoticeId(null);
                            setNTitle('');
                            setNText('');
                            setNType('general');
                            setNSponsorName('');
                            setNImageUrl('');
                            setNLinkUrl('');
                          }}
                          className="text-[10px] text-rose-600 hover:underline font-bold"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-brand-ink-soft">Category / Type</label>
                        <select
                          value={nType}
                          onChange={(e) => setNType(e.target.value as NoticeItem['type'])}
                          className="w-full px-3 py-2 bg-brand-bg border border-amber-300 rounded-lg text-xs font-bold text-brand-ink focus:outline-none"
                        >
                          <option value="sponsor">🛍️ Sponsor Advertisement (Shop/Sponsor)</option>
                          <option value="urgent">🚨 Urgent Notice</option>
                          <option value="important">⚡ Important Notice</option>
                          <option value="info">ℹ️ Information</option>
                          <option value="general">📢 General Announcement</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-brand-ink-soft">Headline / Title</label>
                        <input
                          type="text"
                          value={nTitle}
                          onChange={(e) => setNTitle(e.target.value)}
                          placeholder={nType === 'sponsor' ? 'e.g. 50% Festival Offer at Grand Supermarket' : 'e.g. Stage 1 Programs Rescheduled'}
                          className="w-full px-3 py-2 bg-brand-bg border border-amber-300 rounded-lg text-xs text-brand-ink focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Sponsor Details (if Sponsor Ad selected) */}
                    {nType === 'sponsor' && (
                      <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2.5">
                        <span className="text-[10px] font-bold text-purple-900 block">
                          🏬 Sponsor / Shop Details
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-purple-800 block">Shop / Sponsor Name</label>
                            <input
                              type="text"
                              value={nSponsorName}
                              onChange={(e) => setNSponsorName(e.target.value)}
                              placeholder="e.g. ABC Textiles & Hypermarket"
                              className="w-full px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-xs text-brand-ink focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-purple-800 block">WhatsApp / Website Link</label>
                            <input
                              type="text"
                              value={nLinkUrl}
                              onChange={(e) => setNLinkUrl(e.target.value)}
                              placeholder="e.g. https://wa.me/919876543210 or www.abchypermarket.com"
                              className="w-full px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-xs text-brand-ink focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-brand-ink-soft">Notice Body / Ad Details</label>
                      <textarea
                        value={nText}
                        onChange={(e) => setNText(e.target.value)}
                        rows={2}
                        placeholder="Type notice description or ad details here..."
                        className="w-full px-3 py-2 bg-brand-bg border border-amber-300 rounded-lg text-xs text-brand-ink focus:outline-none"
                      />
                    </div>

                    {/* Poster Image Upload */}
                    <div className="space-y-1.5 p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <label className="text-[10px] font-bold text-amber-900 flex items-center justify-between">
                        <span>🖼️ Poster / Ad Banner Image</span>
                        {nImageUrl && (
                          <button
                            type="button"
                            onClick={() => setNImageUrl('')}
                            className="text-rose-600 hover:underline text-[10px] font-bold"
                          >
                            Remove Image
                          </button>
                        )}
                      </label>
                      
                      <div className="flex items-center gap-3">
                        {nImageUrl ? (
                          <div className="relative shrink-0">
                            <img
                              src={nImageUrl}
                              alt="Poster Preview"
                              className="w-16 h-16 object-cover rounded-lg border border-amber-300 shadow-2xs"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-lg border-2 border-dashed border-amber-300 flex items-center justify-center bg-white text-xl text-amber-500 shrink-0">
                            🖼️
                          </div>
                        )}
                        <div className="flex-1 space-y-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleNoticeImageUpload}
                            className="block w-full text-xs text-brand-ink-soft file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer"
                          />
                          <p className="text-[9px] text-brand-ink-soft">
                            Upload shop poster or notice photo (PNG, JPG, max 3MB).
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddOrUpdateNotice}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>{editingNoticeId ? '💾 Update Notice / Ad Item' : '➕ Add to Notice List'}</span>
                    </button>
                  </div>

                  {/* List of Existing Notices & Advertisements */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-brand-green-950 flex items-center justify-between">
                      <span>📋 Current Notices &amp; Sponsor Ads ({noticesList.length})</span>
                      <span className="text-[10px] font-normal text-brand-ink-soft">Active notices are displayed on Live Ticker &amp; Popup</span>
                    </h4>

                    {noticesList.length === 0 ? (
                      <p className="text-xs text-brand-ink-soft italic p-3 text-center bg-white/60 rounded-xl">
                        No notices or sponsor ads created yet. Use the form above to add one.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {noticesList.map((item) => (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 shadow-2xs transition-all ${
                              item.active ? 'bg-white border-amber-300' : 'bg-slate-100 border-slate-200 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt="Thumb"
                                  className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-sm shrink-0">
                                  {item.type === 'sponsor' ? '🛍️' : '📢'}
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-2 py-0.2 rounded text-[9px] font-black uppercase ${
                                    item.type === 'sponsor' ? 'bg-purple-600 text-white' :
                                    item.type === 'urgent' ? 'bg-rose-600 text-white' :
                                    item.type === 'important' ? 'bg-amber-500 text-slate-950' : 'bg-emerald-700 text-white'
                                  }`}>
                                    {item.type === 'sponsor' ? '🛍️ AD' : item.type}
                                  </span>
                                  <b className="text-xs text-brand-green-950 font-bold truncate">{item.title}</b>
                                </div>
                                <p className="text-[11px] text-brand-ink-soft truncate mt-0.5">{item.text}</p>
                                {item.sponsorName && (
                                  <span className="text-[9px] text-purple-700 font-bold block">🏬 {item.sponsorName}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleNoticeActive(item.id)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition-colors ${
                                  item.active ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                }`}
                                title="Toggle Active/Inactive"
                              >
                                {item.active ? '🟢 Active' : '⚪ Hidden'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditNoticeItem(item)}
                                className="p-1.5 text-brand-green-800 hover:bg-brand-bg rounded-lg cursor-pointer text-xs"
                                title="Edit Notice"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteNoticeItem(item.id)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer text-xs"
                                title="Delete Notice"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="pt-2">
            <button
              onClick={() => {
                handleSaveEventDetails();
                alert('✅ All spot updates successfully published live to all devices!');
              }}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-700 via-brand-green-800 to-emerald-900 hover:brightness-110 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4 text-emerald-300 animate-pulse" />
              <span>🚀 SAVE &amp; PUBLISH ALL SPOT UPDATES LIVE TO ALL DEVICES</span>
            </button>
          </div>
        </div>
        </>
      )}



      {/* TEAM COLORS & BRANDING MANAGER */}
      {isAdmin && (
        <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-brand-line/50 pb-2">
            <h3 className="font-display font-bold text-brand-green-950 text-xs md:text-sm flex items-center gap-1.5">
              🎨 Team Customization & Captain Names
            </h3>
            <button
              type="button"
              onClick={() => {
                const newTeam: Team = {
                  id: 'team_' + Date.now().toString(36),
                  name: `Team ${String.fromCharCode(65 + teamsList.length)}`,
                  symbol: '🚩',
                  color: ['#1b8155', '#2a5d9c', '#b5306e', '#d97706', '#7c3aed'][teamsList.length % 5],
                  captain: '',
                  boysCaptain: '',
                  boysCaptain2: '',
                  girlsCaptain: '',
                  girlsCaptain2: '',
                  points: 0
                };
                setTeamsList([...teamsList, newTeam]);
              }}
              className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add New Team
            </button>
          </div>

          <p className="text-[11px] text-brand-ink-soft leading-relaxed">
            Customize team names, emoji symbols, primary colors, General Captain, 1st & 2nd Boy Leaders, and 1st & 2nd Girl Leaders. All updates sync live to the public scoreboard in real time.
          </p>

          <div className="space-y-3">
            {teamsList.map((t, idx) => (
              <div key={t.id} className="p-3.5 bg-brand-bg rounded-xl border border-brand-line space-y-2.5 relative group">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={t.symbol}
                    onChange={(e) => {
                      const next = [...teamsList];
                      next[idx] = { ...next[idx], symbol: e.target.value };
                      setTeamsList(next);
                    }}
                    className="w-10 h-10 bg-white border border-brand-line rounded-lg text-center font-bold text-base shrink-0 focus:outline-none"
                    title="Team Emoji Symbol"
                  />
                  <input
                    type="text"
                    value={t.name}
                    onChange={(e) => {
                      const next = [...teamsList];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setTeamsList(next);
                    }}
                    className="flex-1 px-3 py-2 bg-white border border-brand-line rounded-lg text-xs md:text-sm font-bold text-brand-ink focus:outline-none"
                    placeholder="Team Name"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="color"
                      value={t.color}
                      onChange={(e) => {
                        const next = [...teamsList];
                        next[idx] = { ...next[idx], color: e.target.value };
                        setTeamsList(next);
                      }}
                      className="w-10 h-10 p-0.5 bg-white border border-brand-line rounded-lg cursor-pointer"
                      title="Choose custom color"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete ${t.name}?`)) {
                          setTeamsList(teamsList.filter((_, i) => i !== idx));
                        }
                      }}
                      className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                      title="Delete Team"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Team Logo Image Upload Section */}
                <div className="flex items-center gap-2.5 py-1 px-2.5 bg-white/70 rounded-lg border border-brand-line/60">
                  <div className="w-9 h-9 rounded-lg bg-white border border-brand-line flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                    {t.logoUrl ? (
                      <img src={t.logoUrl} alt={t.name} className="w-full h-full object-contain p-0.5" />
                    ) : (
                      <span className="text-lg" title="Emoji Symbol">{t.symbol}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                    <label className="px-2.5 py-1.5 bg-brand-green-800 hover:bg-brand-green-700 text-white font-bold text-[10px] sm:text-[11px] rounded-lg shadow-2xs cursor-pointer flex items-center gap-1.5 transition-colors shrink-0">
                      <ImageIcon className="w-3.5 h-3.5 text-brand-gold-300" />
                      <span>{t.logoUrl ? 'Change Logo Image' : '🖼️ Upload Team Logo Image'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleTeamLogoUpload(e, idx)}
                        className="hidden"
                      />
                    </label>

                    {t.logoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...teamsList];
                          delete next[idx].logoUrl;
                          setTeamsList(next);
                        }}
                        className="px-2 py-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-md text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        ❌ Remove Logo
                      </button>
                    )}
                  </div>
                </div>

                {/* Captains & Leaders: General, Boy L1, Boy L2, Girl L1, Girl L2 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-brand-ink-soft block mb-0.5">
                      ⭐ General Captain:
                    </label>
                    <input
                      type="text"
                      value={t.captain || ''}
                      onChange={(e) => {
                        const next = [...teamsList];
                        next[idx] = { ...next[idx], captain: e.target.value };
                        setTeamsList(next);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-brand-line rounded-lg text-xs font-semibold text-brand-ink focus:outline-none"
                      placeholder="e.g. Mohammed"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-brand-green-900 block mb-0.5">
                      👦 1st Boy Leader:
                    </label>
                    <input
                      type="text"
                      value={t.boysCaptain || ''}
                      onChange={(e) => {
                        const next = [...teamsList];
                        next[idx] = { ...next[idx], boysCaptain: e.target.value };
                        setTeamsList(next);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-brand-line rounded-lg text-xs font-semibold text-brand-ink focus:outline-none"
                      placeholder="e.g. Riaz"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-brand-green-900 block mb-0.5">
                      👦 2nd Boy Leader:
                    </label>
                    <input
                      type="text"
                      value={t.boysCaptain2 || ''}
                      onChange={(e) => {
                        const next = [...teamsList];
                        next[idx] = { ...next[idx], boysCaptain2: e.target.value };
                        setTeamsList(next);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-brand-line rounded-lg text-xs font-semibold text-brand-ink focus:outline-none"
                      placeholder="e.g. Bilal"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-pink-900 block mb-0.5">
                      👧 1st Girl Leader:
                    </label>
                    <input
                      type="text"
                      value={t.girlsCaptain || ''}
                      onChange={(e) => {
                        const next = [...teamsList];
                        next[idx] = { ...next[idx], girlsCaptain: e.target.value };
                        setTeamsList(next);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-brand-line rounded-lg text-xs font-semibold text-brand-ink focus:outline-none"
                      placeholder="e.g. Fathima"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-pink-900 block mb-0.5">
                      👧 2nd Girl Leader:
                    </label>
                    <input
                      type="text"
                      value={t.girlsCaptain2 || ''}
                      onChange={(e) => {
                        const next = [...teamsList];
                        next[idx] = { ...next[idx], girlsCaptain2: e.target.value };
                        setTeamsList(next);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-brand-line rounded-lg text-xs font-semibold text-brand-ink focus:outline-none"
                      placeholder="e.g. Ayisha"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-brand-line/50">
                  <span className="text-[10px] text-brand-ink-soft font-bold mr-1">Color Presets:</span>
                  {['#1b8155', '#2a5d9c', '#b5306e', '#d97706', '#7c3aed', '#0d9488', '#dc2626', '#ea580c', '#0284c7', '#4f46e5', '#be123c', '#15803d'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        const next = [...teamsList];
                        next[idx] = { ...next[idx], color: c };
                        setTeamsList(next);
                      }}
                      className={`w-6 h-6 rounded-md border transition-transform cursor-pointer hover:scale-110 shadow-2xs ${
                        t.color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-brand-gold-500 scale-110 border-white' : 'border-black/10'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (onSaveTeams) {
                  onSaveTeams(teamsList);
                  setSuccessMsg('Team details and captain names updated successfully!');
                }
              }}
              className="flex-1 py-3 bg-brand-green-800 hover:bg-brand-green-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-colors"
            >
              💾 Save Team Details & Captain Names
            </button>
          </div>
        </div>
      )}

      {/* Bulk spreadsheet upload */}
      {isAdmin && (
        <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-display font-bold text-brand-green-950 text-xs md:text-sm flex items-center gap-1.5 border-b border-brand-line/50 pb-2">
            <Upload className="w-4 h-4 text-brand-gold-600" /> Excel Candidate Bulk Import & Templates
          </h3>
          <p className="text-[11px] text-brand-ink-soft leading-relaxed">
            Download pre-formatted Excel template, fill out candidate details, and upload them to import candidates in bulk.
          </p>

          <div className="space-y-3.5">
            {/* Candidate Import */}
            <div className="p-3.5 bg-brand-bg/60 border border-brand-line/40 rounded-xl space-y-2">
              <span className="text-xs font-bold text-brand-green-900 flex items-center gap-1.5">
                <span>👥</span> Candidate / Participant Bulk Import
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <button
                  onClick={handleExcelTemplate}
                  className="w-full py-2.5 px-3 bg-transparent border border-brand-green-700 text-brand-green-800 font-semibold text-xs rounded-xl hover:bg-brand-green-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Candidate Template
                </button>
                <label className="w-full py-2.5 px-3 bg-gradient-to-r from-brand-gold-500 to-brand-gold-700 text-brand-green-900 font-bold text-xs rounded-xl hover:brightness-110 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-center">
                  <Upload className="w-4 h-4" /> Upload Candidates Excel
                  <input 
                    type="file" 
                    accept=".xlsx,.xls" 
                    onChange={handleExcelUpload} 
                    className="hidden" 
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printing segment */}
      <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-display font-bold text-brand-green-950 text-xs md:text-sm flex items-center gap-1.5 border-b border-brand-line/50 pb-2">
          <Printer className="w-4 h-4 text-brand-gold-600" /> Printable Report Engine
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={handlePrintPrograms}
            className="w-full py-2.5 px-4 bg-transparent border border-brand-green-700 text-brand-green-800 font-semibold text-xs rounded-xl hover:bg-brand-green-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            📋 Program List (Categories)
          </button>
          <button
            onClick={handlePrintNoticeBoardSchedule}
            className="w-full py-2.5 px-4 bg-brand-green-800 text-brand-gold-300 font-bold text-xs rounded-xl hover:bg-brand-green-900 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            📅 Notice Board Schedule Sheet
          </button>
          <button
            onClick={() => window.print()}
            className="w-full py-2.5 px-4 bg-transparent border border-brand-green-700 text-brand-green-800 font-semibold text-xs rounded-xl hover:bg-brand-green-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            🖨️ Browser Print Dialog
          </button>
        </div>

        <div className="h-px bg-brand-line/30 my-2" />

        <div className="space-y-3">
          <h4 className="text-xs font-bold text-brand-ink">Generate Team Sheet</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-brand-ink-soft font-bold">Team Selector</label>
              <select
                value={reportTeamId}
                onChange={(e) => setReportTeamId(e.target.value)}
                className="w-full px-3 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs text-brand-ink focus:outline-none"
              >
                <option value="all">All Teams</option>
                {db.teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-brand-ink-soft font-bold">Category Selector</label>
              <select
                value={reportCatId}
                onChange={(e) => setReportCatId(e.target.value)}
                className="w-full px-3 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs text-brand-ink focus:outline-none"
              >
                <option value="all">All Category Segments</option>
                {['Boys', 'Girls'].flatMap(g => AGES.map(a => (
                  <option key={`${g}|${a}`} value={`${g}|${a}`}>{g} &mdash; {a}</option>
                )))}
                <option value="General|All">General Section</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={handlePrintTeamSheet}
              className="w-full py-2.5 bg-brand-green-800 hover:bg-brand-green-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              📄 Printable HTML Sheet
            </button>
            <button
              onClick={handleDownloadTeamExcel}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              📊 Candidate List Excel
            </button>
            <button
              onClick={handleDownloadTeamMatrixExcel}
              className="w-full py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer border border-teal-600/40"
            >
              📋 Team Grid Matrix Excel
            </button>
          </div>
        </div>
      </div>

      {/* Admin Password Change Form */}
      {isAdmin && (
        <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-display font-bold text-brand-green-950 text-xs md:text-sm flex items-center gap-1.5 border-b border-brand-line/50 pb-2">
            <Key className="w-4 h-4 text-brand-gold-600" /> Change Password
          </h3>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-ink-soft">Current Master Password</label>
                <input
                  type="password"
                  value={cpCurrent}
                  onChange={(e) => setCpCurrent(e.target.value)}
                  className="w-full px-3.5 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs text-brand-ink focus:outline-none focus:border-brand-gold-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-ink-soft">New Master Password</label>
                <input
                  type="password"
                  value={cpNew}
                  onChange={(e) => setCpNew(e.target.value)}
                  className="w-full px-3.5 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs text-brand-ink focus:outline-none focus:border-brand-gold-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-ink-soft">Confirm Password</label>
                <input
                  type="password"
                  value={cpConfirm}
                  onChange={(e) => setCpConfirm(e.target.value)}
                  className="w-full px-3.5 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs text-brand-ink focus:outline-none focus:border-brand-gold-500"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-brand-green-800 hover:bg-brand-green-700 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              Update Password
            </button>
          </form>
        </div>
      )}

      {/* Advanced Toggle Button */}
      {isAdmin && (
        <div className="text-center pt-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-4 py-2 bg-brand-green-50 hover:bg-brand-green-100 text-brand-green-800 text-[11px] font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 border border-brand-green-200"
          >
            {showAdvanced ? '🙈 Hide Advanced Settings' : '⚙️ Show Advanced / Developer Settings'}
          </button>
        </div>
      )}

      {/* ADVANCED DEVELOPER SETTINGS CONTAINER */}
      {isAdmin && showAdvanced && (
        <div className="space-y-6 pt-2 border-t border-dashed border-brand-line/60">
          <div className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wider text-center select-none">
            🛠️ Advanced Configuration Panels
          </div>

          {/* Point assignment weights config */}
          <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-brand-line/50 pb-2.5">
              <h3 className="font-display font-bold text-brand-green-950 text-xs md:text-sm flex items-center gap-1.5">
                <span>🏅</span> Grading Point Structure Configuration
              </h3>
              <span className="text-[10px] bg-brand-gold-500/15 text-brand-gold-800 font-bold px-2 py-0.5 rounded-md border border-brand-gold-500/30">
                System Rules
              </span>
            </div>

            {/* Standard Category Points */}
            <div className="space-y-2 bg-brand-bg/60 p-3.5 rounded-xl border border-brand-line/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-green-950 flex items-center gap-1">
                  <span>🧒</span> Standard Category Points
                </span>
                <span className="text-[9px] font-bold text-brand-ink-soft">Kids, Sub Junior, Junior, Senior, Super Senior</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-ink flex items-center gap-1">🥇 1st Place</label>
                  <input
                    type="number"
                    value={ptFirst}
                    onChange={(e) => setPtFirst(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-green-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-ink flex items-center gap-1">🥈 2nd Place</label>
                  <input
                    type="number"
                    value={ptSecond}
                    onChange={(e) => setPtSecond(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-green-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-ink flex items-center gap-1">🥉 3rd Place</label>
                  <input
                    type="number"
                    value={ptThird}
                    onChange={(e) => setPtThird(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-green-700"
                  />
                </div>
              </div>
            </div>

            {/* General Category Big Points */}
            <div className="space-y-2 bg-amber-50/80 p-3.5 rounded-xl border border-amber-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                  <span>🌐</span> General Category Points
                </span>
                <span className="text-[9px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded">All Class / General Programs</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-900 flex items-center gap-1">🏆 General 1st Place</label>
                  <input
                    type="number"
                    value={ptGenFirst}
                    onChange={(e) => setPtGenFirst(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-brand-ink focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-900 flex items-center gap-1">🥈 General 2nd Place</label>
                  <input
                    type="number"
                    value={ptGenSecond}
                    onChange={(e) => setPtGenSecond(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-brand-ink focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-900 flex items-center gap-1">🥉 General 3rd Place</label>
                  <input
                    type="number"
                    value={ptGenThird}
                    onChange={(e) => setPtGenThird(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-brand-ink focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>
            </div>

            {/* Grades & Participation Points */}
            <div className="space-y-2 bg-brand-bg/60 p-3.5 rounded-xl border border-brand-line/60">
              <span className="text-xs font-bold text-brand-green-950 block">
                🎗️ Grades &amp; Participation Points
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-ink">🅰️ Grade A</label>
                  <input
                    type="number"
                    value={ptGA}
                    onChange={(e) => setPtGA(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-bold text-brand-ink focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-ink">🅱️ Grade B</label>
                  <input
                    type="number"
                    value={ptGB}
                    onChange={(e) => setPtGB(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-bold text-brand-ink focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-ink">🅲 Grade C</label>
                  <input
                    type="number"
                    value={ptGC}
                    onChange={(e) => setPtGC(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-bold text-brand-ink focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-ink">🎗️ Participation</label>
                  <input
                    type="number"
                    value={ptPart}
                    onChange={(e) => setPtPart(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-bold text-brand-ink focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSavePoints}
              className="w-full py-3 bg-brand-green-800 hover:bg-brand-green-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-colors"
            >
              Update Point Weights
            </button>
          </div>

          {/* Backup controls */}
          <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-brand-green-950 text-xs md:text-sm flex items-center gap-1.5 border-b border-brand-line/50 pb-2">
              <DbIcon className="w-4 h-4 text-brand-gold-600" /> System State Backup (JSON Backup)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={handleJSONExport}
                className="w-full py-2.5 px-4 bg-transparent border border-brand-green-700 text-brand-green-800 font-semibold text-xs rounded-xl hover:bg-brand-green-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4.5 h-4.5" /> Export Data Backup File
              </button>
              <label className="w-full py-2.5 px-4 bg-transparent border border-brand-green-700 text-brand-green-800 font-semibold text-xs rounded-xl hover:bg-brand-green-50 transition-colors flex items-center justify-center gap-2 cursor-pointer text-center">
                <Upload className="w-4.5 h-4.5" /> Restore Backup File
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleJSONImport} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>

          {/* Google Sheets Sync Section */}
          <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-brand-line/50 pb-2.5">
              <h3 className="font-display font-bold text-brand-green-950 text-xs md:text-sm flex items-center gap-2">
                <span className="text-emerald-600 text-base">📊</span> Google Sheets Live Sync
              </h3>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200">
                Live Cloud Sync
              </span>
            </div>

            {/* Centralized Web App Backend Active Banner */}
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs space-y-2 text-emerald-950">
              <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Centralized Google Apps Script Backend Connected</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                All users opening this app seamlessly fetch real-time data from your Google Sheet backend automatically. No configuration needed!
              </p>
              <div className="p-2 bg-white/90 rounded-lg border border-emerald-200 font-mono text-[10px] text-emerald-900 break-all select-all flex items-center justify-between gap-2">
                <span>https://script.google.com/macros/s/AKfycbzHY7h3kGqHfxnjrq7fdce45Ch8BrvKlCRLLqlZPDmqVKKDiaWXjDXtk10rf-0d4ueK/exec</span>
              </div>
            </div>

            <p className="text-[11px] text-brand-ink-soft leading-relaxed">
              Automatically sync competition points, results, programs, and candidate details in real-time to a connected **Google Sheet**.
            </p>

            {sheetsStatusMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                sheetsStatusMsg.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <span>{sheetsStatusMsg.type === 'success' ? '✅' : '⚠️'}</span>
                <span className="flex-1 leading-snug">{sheetsStatusMsg.text}</span>
              </div>
            )}

            {/* Account Connection Bar */}
            <div className="p-3.5 bg-brand-bg rounded-xl border border-brand-line flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs">
                  G
                </div>
                <div>
                  <div className="text-xs font-bold text-brand-green-950">
                    {googleUserEmail ? `Connected: ${googleUserEmail}` : 'Google Account Sync'}
                  </div>
                  <div className="text-[10px] text-brand-ink-soft">
                    {googleUserEmail ? 'OAuth authentication active' : 'Click sign in to authorize Google Sheets API'}
                  </div>
                </div>
              </div>

              {!googleUserEmail ? (
                <button
                  onClick={handleSignInGoogleSheets}
                  disabled={sheetsLoading}
                  className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  Sign in with Google
                </button>
              ) : (
                <button
                  onClick={() => {
                    googleSignOut();
                    setGoogleUserEmail(null);
                  }}
                  className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-[11px] rounded-lg cursor-pointer"
                >
                  Sign Out
                </button>
              )}
            </div>

            {/* Sheet ID & Controls */}
            <div className="space-y-3">
              {sheetId ? (
                <div className="p-3 bg-emerald-50/90 border border-emerald-300 rounded-xl flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-emerald-900 font-medium">
                    <span className="text-base">📍</span>
                    <span>Connected Google Sheet Ready (ID: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">{sheetId.slice(0, 12)}...</code>)</span>
                  </div>
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open Google Sheet
                  </a>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <span>ℹ️</span>
                  <span>No Google Sheet connected. Click <b>➕ Create New Sheet</b> below to create one automatically.</span>
                </div>
              )}

              {/* Custom Google Apps Script / Webhook URL Field */}
              <div className="space-y-1.5 p-3 bg-white border border-brand-line rounded-xl shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-brand-green-950 flex items-center gap-1.5">
                    <span>🔗</span> Custom Google Apps Script / Webhook Web App URL
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowScriptModal(!showScriptModal)}
                    className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
                  >
                    {showScriptModal ? '✖️ Close Script Helper' : '📋 Copy Apps Script Template Code (Code.gs)'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customWebhookUrl}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setCustomWebhookUrl(val);
                      onImportBackup({
                        ...db,
                        settings: {
                          ...db.settings,
                          sheetWebhookUrl: val,
                          appsScriptUrl: val
                        }
                      });
                    }}
                    placeholder="e.g. https://script.google.com/macros/s/AKfycbx.../exec"
                    className="flex-1 px-3.5 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs font-mono text-brand-ink focus:outline-none focus:border-brand-gold-500"
                  />
                  <button
                    type="button"
                    onClick={handleSyncToGoogleSheetsNow}
                    disabled={sheetsLoading}
                    className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <span>🚀 Sync Now</span>
                  </button>
                </div>
                <p className="text-[10px] text-brand-ink-soft">
                  Optional custom Google Apps Script Web App URL. When configured, all live results and scores are proxied directly to your sheet.
                </p>
              </div>

              {/* Apps Script Helper Modal / Collapsible */}
              {showScriptModal && (
                <div className="p-4 bg-indigo-50/90 border border-indigo-200 rounded-xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <span>📜</span> Official Google Apps Script (Code.gs)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const code = `function doGet(e) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName('System Backup') || doc.insertSheet('System Backup');
  var val = sheet.getRange('A1').getValue();
  return ContentService.createTextOutput(val || '{"status":"ok"}').setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var rawText = e.postData.contents;
    var data = JSON.parse(rawText);
    var db = data.db || data;
    var doc = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Save Full Database JSON Backup
    var backupSheet = doc.getSheetByName('System Backup') || doc.insertSheet('System Backup');
    backupSheet.getRange('A1').setValue(JSON.stringify(db));

    // 2. Write Scoreboard Tab
    if (db.teams) {
      var scoreSheet = doc.getSheetByName('Scoreboard') || doc.insertSheet('Scoreboard');
      scoreSheet.clear();
      scoreSheet.appendRow(['Team ID', 'Team Name', 'Symbol', 'Total Points', 'Captain']);
      db.teams.forEach(function(t) {
        scoreSheet.appendRow([t.id, t.name, t.symbol, t.points || 0, t.captain || '']);
      });
    }

    // 3. Write Results Tab
    if (db.results) {
      var resSheet = doc.getSheetByName('Program Results') || doc.insertSheet('Program Results');
      resSheet.clear();
      resSheet.appendRow(['Result ID', 'Program ID', 'Category', 'First Place', 'Second Place', 'Third Place']);
      db.results.forEach(function(r) {
        var f = (r.winners && r.winners.first) ? r.winners.first.join(', ') : '';
        var s = (r.winners && r.winners.second) ? r.winners.second.join(', ') : '';
        var t = (r.winners && r.winners.third) ? r.winners.third.join(', ') : '';
        resSheet.appendRow([r.id, r.programId, r.category || '', f, s, t]);
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Data synced successfully' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
                        navigator.clipboard.writeText(code);
                        alert('✅ Google Apps Script code copied to clipboard! Paste this into Google Sheets -> Extensions -> Apps Script.');
                      }}
                      className="px-3 py-1 bg-indigo-700 hover:bg-indigo-800 text-white text-[10px] font-extrabold rounded-lg shadow-2xs transition-all cursor-pointer"
                    >
                      📋 Copy Script Code
                    </button>
                  </div>
                  <p className="text-[11px] text-indigo-900 leading-relaxed">
                    Paste this script into your Google Sheet by navigating to <b>Extensions &gt; Apps Script</b>. Deploy as a <b>Web App</b> with access set to <b>"Anyone"</b>.
                  </p>
                  <pre className="p-3 bg-slate-900 text-emerald-300 font-mono text-[10px] rounded-lg overflow-x-auto max-h-52 select-all border border-slate-700">
{`function doGet(e) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName('System Backup') || doc.insertSheet('System Backup');
  var val = sheet.getRange('A1').getValue();
  return ContentService.createTextOutput(val || '{"status":"ok"}').setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var rawText = e.postData.contents;
    var data = JSON.parse(rawText);
    var db = data.db || data;
    var doc = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Save Full Database JSON Backup
    var backupSheet = doc.getSheetByName('System Backup') || doc.insertSheet('System Backup');
    backupSheet.getRange('A1').setValue(JSON.stringify(db));

    // 2. Write Scoreboard Tab
    if (db.teams) {
      var scoreSheet = doc.getSheetByName('Scoreboard') || doc.insertSheet('Scoreboard');
      scoreSheet.clear();
      scoreSheet.appendRow(['Team ID', 'Team Name', 'Symbol', 'Total Points', 'Captain']);
      db.teams.forEach(function(t) {
        scoreSheet.appendRow([t.id, t.name, t.symbol, t.points || 0, t.captain || '']);
      });
    }

    // 3. Write Results Tab
    if (db.results) {
      var resSheet = doc.getSheetByName('Program Results') || doc.insertSheet('Program Results');
      resSheet.clear();
      resSheet.appendRow(['Result ID', 'Program ID', 'Category', 'First Place', 'Second Place', 'Third Place']);
      db.results.forEach(function(r) {
        var f = (r.winners && r.winners.first) ? r.winners.first.join(', ') : '';
        var s = (r.winners && r.winners.second) ? r.winners.second.join(', ') : '';
        var t = (r.winners && r.winners.third) ? r.winners.third.join(', ') : '';
        resSheet.appendRow([r.id, r.programId, r.category || '', f, s, t]);
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Data synced successfully' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`}
                  </pre>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-ink-soft">Connected Google Sheet ID or Link (OAuth API)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sheetId}
                    onChange={(e) => {
                      let val = e.target.value.trim();
                      const match = val.match(/\/d\/([a-zA-Z0-9-_]+)/);
                      if (match && match[1]) val = match[1];
                      setSheetIdState(val);
                      saveSheetId(val);
                      if (val) {
                        onImportBackup({
                          ...db,
                          settings: {
                            ...db.settings,
                            googleSheetId: val
                          }
                        });
                      }
                    }}
                    placeholder="Spreadsheet ID (e.g. 1BxiMVs0XRnt3...) or paste full link"
                    className="flex-1 px-3.5 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs font-mono text-brand-ink focus:outline-none focus:border-brand-gold-500"
                  />
                  {sheetId && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 transition-all shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open Sheet
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <button
                  onClick={handleCreateNewGoogleSheet}
                  disabled={sheetsLoading}
                  className="py-2.5 px-3 bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  ➕ Create New Sheet
                </button>

                <button
                  onClick={handleSyncToGoogleSheetsNow}
                  disabled={sheetsLoading || !sheetId}
                  className="py-2.5 px-3 bg-brand-green-800 hover:bg-brand-green-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  ⬆️ Push / Sync Now
                </button>

                <button
                  onClick={handlePullFromGoogleSheetsNow}
                  disabled={sheetsLoading || !sheetId}
                  className="py-2.5 px-3 bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  📥 Pull From Sheet
                </button>
              </div>

              {/* Auto-Sync Toggle */}
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    ⚡ Automatic Real-Time Auto-Sync
                  </div>
                  <div className="text-[10px] text-emerald-800">
                    Automatically update Google Sheet when scores and results are published
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleAutoSync(!autoSync)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    autoSync ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                </button>
              </div>
            </div>
          </div>

          {/* Danger Zone - Clear All Data */}
          <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-display font-bold text-rose-900 text-xs md:text-sm flex items-center gap-1.5 border-b border-rose-200 pb-2">
              <AlertCircle className="w-4 h-4 text-rose-600" /> Danger Zone - Clear System Data
            </h3>
            <p className="text-xs text-rose-800 leading-relaxed">
              Use the button below to clear all programs, candidate registrations, and competition results from the system.
            </p>
            <button
              onClick={() => {
                setConfirmInput('');
                setShowClearModal(true);
              }}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              🗑️ Clear All Data
            </button>
          </div>

          {/* Synchronizer settings */}
          <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-brand-green-950 text-xs md:text-sm flex items-center gap-1.5 border-b border-brand-line/50 pb-2">
              <RefreshCw className="w-4 h-4 text-brand-gold-600 animate-spin-slow" /> Real-time Device Sync (Firebase)
            </h3>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-ink-soft">Firebase DB Endpoint URL</label>
              <input
                type="text"
                value={firebaseInput}
                onChange={(e) => setFirebaseInput(e.target.value)}
                placeholder="https://your-project-rtdb.firebaseio.com"
                className="w-full px-4 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs md:text-sm text-brand-ink focus:outline-none focus:border-brand-gold-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleFirebaseSave}
                className="py-2.5 px-4 bg-brand-green-800 hover:bg-brand-green-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4" /> Save Endpoint
              </button>
              <button
                onClick={onForceSync}
                className="py-2.5 px-4 bg-transparent border border-brand-green-700 text-brand-green-800 font-semibold text-xs rounded-xl hover:bg-brand-green-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Force Sync Now
              </button>
            </div>
          </div>

          {/* Security PIN change */}
          <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-brand-green-950 text-xs md:text-sm flex items-center gap-1.5 border-b border-brand-line/50 pb-2">
              <Smartphone className="w-4 h-4 text-brand-gold-600" /> Change Security PIN
            </h3>
            <form onSubmit={handlePinChange} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-ink-soft">Current Security PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinCurrent}
                    onChange={(e) => setPinCurrent(e.target.value)}
                    className="w-full px-3.5 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs text-brand-ink font-mono tracking-widest text-center font-bold focus:outline-none focus:border-brand-gold-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-ink-soft">New Security PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinNew}
                    onChange={(e) => setPinNew(e.target.value)}
                    className="w-full px-3.5 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs text-brand-ink font-mono tracking-widest text-center font-bold focus:outline-none focus:border-brand-gold-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-ink-soft">Confirm Security PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value)}
                    className="w-full px-3.5 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs text-brand-ink font-mono tracking-widest text-center font-bold focus:outline-none focus:border-brand-gold-500"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-brand-green-800 hover:bg-brand-green-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Update PIN
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Log out option */}
      {isAdmin ? (
        <button
          onClick={onLogout}
          className="w-full py-3.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs md:text-sm rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> Log Out of Admin Dashboard
        </button>
      ) : (
        <div className="bg-brand-panel border border-brand-line rounded-2xl p-4 shadow-sm text-center text-xs text-brand-ink-soft">
          Log in via the side drawer menu to unlock administrator options.
        </div>
      )}

      {/* Confirmation Modal for Clear All Data */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
          <div className="bg-brand-panel border border-brand-line max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl animate-scaleIn">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-2xl mx-auto shadow-inner">
              ⚠️
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-display font-extrabold text-brand-green-950 text-base md:text-lg">
                Clear All System Data?
              </h3>
              <p className="text-xs text-brand-ink-soft leading-relaxed">
                If you proceed, all current **programs**, **candidate registrations**, and **competition results** will be permanently deleted! Team scores will be reset to 0.
              </p>
              <p className="text-xs font-semibold text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                Warning: This action cannot be undone. Type <span className="font-bold underline">CLEAR</span> below to confirm:
              </p>
            </div>

            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Type CLEAR to confirm"
              className="w-full px-4 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs md:text-sm font-bold text-center text-rose-700 tracking-wider uppercase focus:outline-none focus:border-rose-500"
            />

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setShowClearModal(false);
                  setConfirmInput('');
                }}
                className="py-3 bg-brand-panel border border-brand-line hover:bg-brand-bg text-brand-ink font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={confirmInput.trim().toUpperCase() !== 'CLEAR'}
                onClick={() => {
                  setShowClearModal(false);
                  setConfirmInput('');
                  if (onClearAllData) {
                    onClearAllData();
                    setSuccessMsg('All system data cleared successfully!');
                  }
                }}
                className={`py-3 font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5 ${
                  confirmInput.trim().toUpperCase() === 'CLEAR'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                    : 'bg-rose-200 text-rose-400 cursor-not-allowed'
                }`}
              >
                🗑️ Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
