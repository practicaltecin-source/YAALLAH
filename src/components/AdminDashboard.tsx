import { useState, useMemo, ChangeEvent } from 'react';
import { 
  Database, 
  Team, 
  Program, 
  Participant, 
  Result, 
  AdminTab, 
  ProgramCategory, 
  CandidateResultEntry,
  NoticeItem
} from '../types';
import { 
  GENDERS, 
  AGES, 
  CLASSES, 
  DIVISIONS, 
  AGE_ICONS, 
  GENDER_ICONS, 
  classToAge, 
  generateId,
  pushToAppsScriptDirect,
  fetchFromAppsScriptDirect,
  pushToFirebase
} from '../db';
import { saveToFirestore, fetchFromFirestore } from '../firebase';
import { getProgramScheduleStatus } from '../utils/time';
import { 
  ShieldAlert, 
  Plus, 
  Users, 
  Calendar, 
  Trophy, 
  Flag, 
  Trash2, 
  Edit, 
  PlusCircle, 
  XCircle,
  Clock,
  MapPin,
  CheckSquare,
  Square,
  Download,
  Upload,
  Printer,
  Search,
  ExternalLink,
  RefreshCw,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Sparkles,
  Copy,
  Layers,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import AdminQuizManager from './AdminQuizManager';
import { 
  getSavedSheetId, 
  saveSheetId, 
  isAutoSyncEnabled, 
  setAutoSyncEnabled, 
  getCachedToken, 
  signInWithGoogleForSheets, 
  checkRedirectResult,
  syncDataToGoogleSheet, 
  fetchDataFromGoogleSheet, 
  createGoogleSpreadsheet,
  parseCategoriesFromInput
} from '../googleSheets';

function formatTimeFromPicker(time24: string): string {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
}

interface AdminDashboardProps {
  db: Database;
  onUpdateDb: (updatedDb: Database) => void;
  onAddResultDirectly: (programId: string) => void;
  onBulkImportPrograms?: (programs: any[]) => void;
  onBulkImportParticipants?: (participants: any[]) => void;
}

export default function AdminDashboard({ db, onUpdateDb, onAddResultDirectly, onBulkImportPrograms, onBulkImportParticipants }: AdminDashboardProps) {
  const [adminMode, setAdminMode] = useState<'management' | 'broadcasting'>('management');
  const [activeTab, setActiveTab] = useState<AdminTab>('teams');

  // Modal State
  const [modalType, setModalType] = useState<'team' | 'program' | 'participant' | 'result' | 'bulk_schedule' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Completed Schedule Lock & Candidate List States
  const [unlockedSchedulePrograms, setUnlockedSchedulePrograms] = useState<Record<string, boolean>>({});
  const [expandedScheduleCandidatesProgId, setExpandedScheduleCandidatesProgId] = useState<string | null>(null);
  const [selectedPrintCat, setSelectedPrintCat] = useState<Record<string, string>>({});
  const [selectedPrintGender, setSelectedPrintGender] = useState<Record<string, string>>({});

  // Notice Board Quick Manager States
  const [showNoticeEditor, setShowNoticeEditor] = useState(false);
  const [noticeEnabled, setNoticeEnabled] = useState(db.settings.showNotice !== false);
  const [noticesList, setNoticesList] = useState<NoticeItem[]>(() => {
    if (db.settings.notices && db.settings.notices.length > 0) {
      return db.settings.notices;
    }
    if (db.settings.noticeText) {
      return [{
        id: generateId(),
        title: db.settings.noticeTitle || '📢 NOTICE BOARD ANNOUNCEMENT',
        text: db.settings.noticeText,
        type: 'urgent',
        active: true,
        date: new Date().toLocaleDateString()
      }];
    }
    return [];
  });

  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeText, setNewNoticeText] = useState('');
  const [newNoticeType, setNewNoticeType] = useState<'urgent' | 'important' | 'info' | 'general' | 'sponsor'>('urgent');
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);

  const handleAddOrUpdateNotice = () => {
    if (!newNoticeText.trim()) return;

    if (editingNoticeId) {
      setNoticesList(prev => prev.map(n => n.id === editingNoticeId ? {
        ...n,
        title: newNoticeTitle.trim() || '📢 ANNOUNCEMENT',
        text: newNoticeText.trim(),
        type: newNoticeType
      } : n));
      setEditingNoticeId(null);
    } else {
      const item: NoticeItem = {
        id: generateId(),
        title: newNoticeTitle.trim() || (newNoticeType === 'urgent' ? '🚨 URGENT NOTICE' : newNoticeType === 'important' ? '⚡ IMPORTANT' : newNoticeType === 'info' ? 'ℹ️ INFO UPDATE' : '📢 ANNOUNCEMENT'),
        text: newNoticeText.trim(),
        type: newNoticeType,
        active: true,
        date: new Date().toLocaleDateString()
      };
      setNoticesList(prev => [item, ...prev]);
    }

    setNewNoticeTitle('');
    setNewNoticeText('');
    setNewNoticeType('urgent');
  };

  const handleToggleNoticeActive = (id: string) => {
    setNoticesList(prev => prev.map(n => n.id === id ? { ...n, active: !n.active } : n));
  };

  const handleDeleteNotice = (id: string) => {
    setNoticesList(prev => prev.filter(n => n.id !== id));
  };

  const handleEditNotice = (n: NoticeItem) => {
    setEditingNoticeId(n.id);
    setNewNoticeTitle(n.title);
    setNewNoticeText(n.text);
    setNewNoticeType(n.type);
  };

  // Google Sheets & Apps Script Quick Manager States
  const [showSheetsManager, setShowSheetsManager] = useState(false);
  const [sheetSyncMethod, setSheetSyncMethod] = useState<'webhook' | 'oauth'>('webhook');
  const [sheetId, setSheetIdState] = useState<string>(() => getSavedSheetId() || '');
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => db.settings?.sheetWebhookUrl || db.settings?.appsScriptUrl || localStorage.getItem('mrms_apps_script_url') || '');
  const [autoSync, setAutoSyncState] = useState<boolean>(() => isAutoSyncEnabled());
  const [sheetsLoading, setSheetsLoading] = useState<boolean>(false);
  const [sheetsStatusMsg, setSheetsStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);
  const [copiedScriptCode, setCopiedScriptCode] = useState(false);

  // Auto-check OAuth redirect result if popups were blocked
  useState(() => {
    checkRedirectResult().then(res => {
      if (res?.user?.email) {
        setGoogleUserEmail(res.user.email);
        setSheetsStatusMsg({
          type: 'success',
          text: `Logged in as ${res.user.email}`
        });
      }
    });
  });

  const handlePushViaWebhook = async (customUrl?: string) => {
    const target = (customUrl !== undefined ? customUrl : appsScriptUrl).trim();
    if (!target) {
      setSheetsStatusMsg({ type: 'error', text: 'Please enter a valid Google Apps Script Web App URL.' });
      return;
    }
    setSheetsLoading(true);
    setSheetsStatusMsg(null);
    try {
      const updated: Database = {
        ...db,
        settings: {
          ...db.settings,
          sheetWebhookUrl: target,
          appsScriptUrl: target
        }
      };
      localStorage.setItem('mrms_apps_script_url', target);
      onUpdateDb(updated);
      const ok = await pushToAppsScriptDirect(updated);
      if (ok) {
        setSheetsStatusMsg({ type: 'success', text: '✅ Competition data successfully synced to Google Sheet via Webhook!' });
      } else {
        setSheetsStatusMsg({ type: 'error', text: 'Failed to push to Webhook. Please ensure your Google Apps Script is deployed as "Web App" with Execute as: "Me" and Who has access: "Anyone".' });
      }
    } catch (e: any) {
      setSheetsStatusMsg({ type: 'error', text: e?.message || 'Error connecting to Apps Script Webhook.' });
    } finally {
      setSheetsLoading(false);
    }
  };

  const handlePullViaWebhook = async (customUrl?: string) => {
    const target = (customUrl !== undefined ? customUrl : appsScriptUrl).trim();
    if (!target) {
      setSheetsStatusMsg({ type: 'error', text: 'Please enter a valid Google Apps Script Web App URL.' });
      return;
    }
    setSheetsLoading(true);
    setSheetsStatusMsg(null);
    try {
      const fetched = await fetchFromAppsScriptDirect(target);
      if (fetched) {
        onUpdateDb(fetched);
        setSheetsStatusMsg({ type: 'success', text: `✅ Successfully imported ${fetched.participants?.length || 0} participants, ${fetched.programs?.length || 0} programs, and ${fetched.teams?.length || 0} teams from Google Sheet!` });
      } else {
        setSheetsStatusMsg({ type: 'error', text: 'Could not fetch data from Google Sheet. If this is a new sheet, please click "Push to Sheet via Webhook" first to initialize the data.' });
      }
    } catch (e: any) {
      setSheetsStatusMsg({ type: 'error', text: e?.message || 'Failed to pull data from Apps Script Webhook.' });
    } finally {
      setSheetsLoading(false);
    }
  };

  const [cloudSyncLoading, setCloudSyncLoading] = useState(false);
  const [cloudSyncStatusMsg, setCloudSyncStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleBroadcastToAllDevices = async () => {
    setCloudSyncLoading(true);
    setCloudSyncStatusMsg(null);
    try {
      const updatedWithTimestamp: Database = {
        ...db,
        lastModified: Date.now()
      };
      onUpdateDb(updatedWithTimestamp);
      const ok = await saveToFirestore(updatedWithTimestamp);
      await pushToFirebase(updatedWithTimestamp);
      
      // Also push to webhook if configured
      if (db.settings?.sheetWebhookUrl || appsScriptUrl) {
        pushToAppsScriptDirect(updatedWithTimestamp).catch(() => {});
      }

      setCloudSyncStatusMsg({
        type: 'success',
        text: `✅ Data successfully synchronized to cloud! All mobile phones and connected devices are updated in real time (${updatedWithTimestamp.participants?.length || 0} participants, ${updatedWithTimestamp.programs?.length || 0} programs, ${updatedWithTimestamp.results?.length || 0} results).`
      });
    } catch (e: any) {
      setCloudSyncStatusMsg({
        type: 'error',
        text: e?.message || 'Failed to sync with cloud. Please try again.'
      });
    } finally {
      setCloudSyncLoading(false);
    }
  };

  const handleQuickSheetAuth = async () => {
    setSheetsLoading(true);
    setSheetsStatusMsg(null);
    try {
      const res = await signInWithGoogleForSheets();
      setGoogleUserEmail(res.user.email);
      setSheetsStatusMsg({
        type: 'success',
        text: `Logged in as ${res.user.email}`
      });
      if (sheetId) {
        await syncDataToGoogleSheet(db, sheetId, res.accessToken);
      }
    } catch (err: any) {
      console.error('Google Sheets sign in error:', err);
      setSheetsStatusMsg({
        type: 'error',
        text: err?.message || 'Failed to authenticate with Google.'
      });
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleQuickSheetSync = async () => {
    const webhook = (appsScriptUrl || db.settings?.sheetWebhookUrl || db.settings?.appsScriptUrl || '').trim();
    let token = getCachedToken();

    // If Webhook URL is present and user is not signed into Google OAuth, prioritize direct Webhook Push
    if (webhook && (!token || !sheetId)) {
      return handlePushViaWebhook(webhook);
    }

    if (!token) {
      try {
        const res = await signInWithGoogleForSheets();
        token = res.accessToken;
        setGoogleUserEmail(res.user.email);
      } catch (err: any) {
        setSheetsStatusMsg({ 
          type: 'error', 
          text: err?.message || 'Google Sign-in failed. You can use the "Apps Script Webhook" tab above to sync directly without sign-in!' 
        });
        return;
      }
    }

    if (!sheetId) {
      setSheetsStatusMsg({ type: 'error', text: 'No Google Sheet ID connected. Please enter ID or Create Sheet.' });
      return;
    }

    setSheetsLoading(true);
    setSheetsStatusMsg(null);
    try {
      await syncDataToGoogleSheet(db, sheetId, token);
      setSheetsStatusMsg({ type: 'success', text: 'Synced DB to Google Sheet successfully!' });
    } catch (err: any) {
      console.error('Quick sync error:', err);
      setSheetsStatusMsg({ type: 'error', text: err?.message || 'Failed to sync to Google Sheet.' });
    } finally {
      setSheetsLoading(false);
    }
  };

  const handlePrintProgramJudgeSheet = (program: Program, targetCategory: string = 'All', targetGender: string = 'All') => {
    const eventName = db.settings.eventName || 'KALIMA 2k26 MEELAD FEST';
    const boardName = db.settings.boardName || 'KALIMA 2k26 MEELAD FEST';

    const enrolled = db.participants.filter(pt => pt.programIds && pt.programIds.includes(program.id));

    // Filter by target category and target gender
    let filtered = enrolled;
    if (targetCategory && targetCategory !== 'All') {
      filtered = filtered.filter(pt => (pt.category || pt.age) === targetCategory);
    }
    if (targetGender && targetGender !== 'All') {
      filtered = filtered.filter(pt => (pt.gender || 'General') === targetGender);
    }

    const sorted = [...filtered].sort((a, b) => {
      const chestA = parseInt(a.chestNo || a.number || '0', 10);
      const chestB = parseInt(b.chestNo || b.number || '0', 10);
      if (!isNaN(chestA) && !isNaN(chestB) && chestA !== chestB) return chestA - chestB;
      return a.name.localeCompare(b.name);
    });

    const progType = (program.single && program.group) ? 'Single & Group' : program.group ? 'Group' : 'Single';
    const venueTime = [
      program.stageType || 'Main Stage',
      program.venue,
      program.day,
      program.startTime ? `${program.startTime}${program.endTime ? ' - ' + program.endTime : ''}` : program.schedule
    ].filter(Boolean).join('  •  ');

    const badgeParts = [];
    if (targetCategory !== 'All') badgeParts.push(`CATEGORY: ${targetCategory.toUpperCase()}`);
    else badgeParts.push('ALL CATEGORIES');

    if (targetGender !== 'All') badgeParts.push(`GENDER: ${targetGender.toUpperCase()}`);
    else badgeParts.push('ALL GENDERS');

    const categoryBadgeText = badgeParts.join(' | ');

    let tablesHTML = '';

    if (targetGender === 'All' || targetCategory === 'All') {
      const groupMap: Record<string, typeof sorted> = {};
      sorted.forEach(p => {
        const catName = p.category || p.age || 'General';
        const genderName = p.gender || 'General';
        const groupKey = targetCategory === 'All' && targetGender === 'All'
          ? `${catName} — ${genderName}`
          : targetCategory === 'All'
            ? `${catName}`
            : `${genderName}`;

        if (!groupMap[groupKey]) groupMap[groupKey] = [];
        groupMap[groupKey].push(p);
      });

      const groupKeys = Object.keys(groupMap);
      if (groupKeys.length === 0) {
        tablesHTML = `
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #15803d; color: white;">
                <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 40px;">#</th>
                <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 75px;">Chest No</th>
                <th style="padding: 8px; border: 1px solid #374151; text-align: left;">Candidate Name</th>
                <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 140px;">Team</th>
                <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 100px;">Gender</th>
                <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 110px;">Class / Div</th>
                <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 65px;">Present</th>
                <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 110px;">Judge Score / Rank</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="8" style="padding: 20px; text-align: center; color: #6b7280; font-style: italic;">No candidates currently enrolled.</td>
              </tr>
            </tbody>
          </table>
        `;
      } else {
        tablesHTML = groupKeys.map((gKey, groupIdx) => {
          const groupList = groupMap[gKey];
          return `
            <div style="margin-top: ${groupIdx > 0 ? '24px' : '0'}; margin-bottom: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 6px 12px; border-radius: 6px; font-weight: bold; color: #166534; font-size: 13px;">
              📌 SECTION: ${gKey.toUpperCase()} (${groupList.length} Candidates)
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #15803d; color: white;">
                  <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 40px;">#</th>
                  <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 75px;">Chest No</th>
                  <th style="padding: 8px; border: 1px solid #374151; text-align: left;">Candidate Name</th>
                  <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 140px;">Team</th>
                  <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 100px;">Gender</th>
                  <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 110px;">Class / Div</th>
                  <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 65px;">Present</th>
                  <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 110px;">Judge Score / Rank</th>
                </tr>
              </thead>
              <tbody>
                ${groupList.map((p, idx) => {
                  const team = db.teams.find(t => t.id === p.teamId);
                  const classDiv = p.cls ? `${p.cls}${p.division ? ' ' + p.division : ''}` : '—';
                  return `
                    <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                      <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center; font-weight: bold;">${idx + 1}</td>
                      <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center; font-weight: bold; font-family: monospace; font-size: 13px; color: #15803d;">${p.chestNo || p.number || '—'}</td>
                      <td style="padding: 8px; border: 1px solid #d1d5db; font-weight: bold; color: #111827;">${p.name}</td>
                      <td style="padding: 8px; border: 1px solid #d1d5db; font-size: 11px;">${team ? team.name : '—'}</td>
                      <td style="padding: 8px; border: 1px solid #d1d5db; font-size: 11px; font-weight: 600; color: ${p.gender === 'Girls' ? '#c026d3' : '#2563eb'};">${p.gender || 'General'}</td>
                      <td style="padding: 8px; border: 1px solid #d1d5db; font-size: 11px;">${classDiv}</td>
                      <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center;"><input type="checkbox" style="transform: scale(1.3);" /></td>
                      <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center;"></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `;
        }).join('');
      }
    } else {
      tablesHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #15803d; color: white;">
              <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 40px;">#</th>
              <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 75px;">Chest No</th>
              <th style="padding: 8px; border: 1px solid #374151; text-align: left;">Candidate Name</th>
              <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 140px;">Team</th>
              <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 100px;">Gender</th>
              <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 110px;">Class / Div</th>
              <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 65px;">Present</th>
              <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 110px;">Judge Score / Rank</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.length === 0 ? `
              <tr>
                <td colspan="8" style="padding: 20px; text-align: center; color: #6b7280; font-style: italic;">No candidates found matching filter criteria.</td>
              </tr>
            ` : sorted.map((p, idx) => {
              const team = db.teams.find(t => t.id === p.teamId);
              const classDiv = p.cls ? `${p.cls}${p.division ? ' ' + p.division : ''}` : '—';
              return `
                <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                  <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center; font-weight: bold;">${idx + 1}</td>
                  <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center; font-weight: bold; font-family: monospace; font-size: 13px; color: #15803d;">${p.chestNo || p.number || '—'}</td>
                  <td style="padding: 8px; border: 1px solid #d1d5db; font-weight: bold; color: #111827;">${p.name}</td>
                  <td style="padding: 8px; border: 1px solid #d1d5db; font-size: 11px;">${team ? team.name : '—'}</td>
                  <td style="padding: 8px; border: 1px solid #d1d5db; font-size: 11px; font-weight: 600; color: ${p.gender === 'Girls' ? '#c026d3' : '#2563eb'};">${p.gender || 'General'}</td>
                  <td style="padding: 8px; border: 1px solid #d1d5db; font-size: 11px;">${classDiv}</td>
                  <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center;"><input type="checkbox" style="transform: scale(1.3);" /></td>
                  <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center;"></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    const bodyHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 950px; margin: 0 auto; color: #111827;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 3px double #15803d; padding-bottom: 12px;">
          <h1 style="margin: 0; color: #15803d; font-size: 24px; font-weight: bold; text-transform: uppercase;">${eventName}</h1>
          <h2 style="margin: 4px 0 0; color: #b45309; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">${boardName}</h2>
          <div style="margin-top: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px 16px; border-radius: 8px; display: inline-block;">
            <h3 style="margin: 0; font-size: 18px; color: #166534;">[${program.code}] ${program.name}</h3>
            <div style="margin-top: 6px; font-size: 13px; color: #15803d; font-weight: bold; text-transform: uppercase; background: #dcfce7; display: inline-block; padding: 4px 12px; border-radius: 20px; border: 1px solid #bbf7d0;">
              🎯 ${categoryBadgeText}
            </div>
            <p style="margin: 6px 0 0; font-size: 12px; color: #374151; font-weight: 600;">${venueTime} | Type: ${progType}</p>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 12px; font-weight: bold; color: #1f2937;">
          <span>📋 OFFICIAL JUDGE CALL & EVALUATION SHEET</span>
          <span>Candidates Count: ${sorted.length}</span>
        </div>

        ${tablesHTML}

        <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 11px; font-weight: bold; color: #374151;">
          <div style="border-top: 1px solid #9ca3af; width: 220px; padding-top: 6px;">Judge 1 Signature</div>
          <div style="border-top: 1px solid #9ca3af; width: 220px; padding-top: 6px;">Judge 2 Signature</div>
          <div style="border-top: 1px solid #9ca3af; width: 220px; padding-top: 6px;">Stage Convener Signature</div>
        </div>
      </div>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`<html><head><title>Stage Call Sheet - ${program.code} (${targetCategory})</title></head><body>${bodyHTML}</body></html>`);
      printWin.document.close();
      printWin.print();
    }
  };

  const handleQuickCreateSheet = async () => {
    let token = getCachedToken();
    if (!token) {
      try {
        const res = await signInWithGoogleForSheets();
        token = res.accessToken;
        setGoogleUserEmail(res.user.email);
      } catch (err: any) {
        setSheetsStatusMsg({ type: 'error', text: 'Google Sign-in required to create sheet.' });
        return;
      }
    }

    setSheetsLoading(true);
    setSheetsStatusMsg(null);
    try {
      const created = await createGoogleSpreadsheet(`${db.settings.eventName || 'Festival'} Results & Scoreboard`, token);
      setSheetIdState(created.id);
      saveSheetId(created.id);
      await syncDataToGoogleSheet(db, created.id, token);
      setSheetsStatusMsg({ type: 'success', text: 'New Google Sheet created and synced successfully!' });
    } catch (err: any) {
      console.error('Create sheet error:', err);
      setSheetsStatusMsg({ type: 'error', text: err?.message || 'Failed to create Google Sheet.' });
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleQuickPullSheet = async () => {
    const webhook = (appsScriptUrl || db.settings?.sheetWebhookUrl || db.settings?.appsScriptUrl || '').trim();
    let token = getCachedToken();

    // If Webhook URL is present and no OAuth token, prioritize Webhook Pull!
    if (webhook && (!token || !sheetId)) {
      return handlePullViaWebhook(webhook);
    }

    if (!token) {
      try {
        const res = await signInWithGoogleForSheets();
        token = res.accessToken;
        setGoogleUserEmail(res.user.email);
      } catch (err: any) {
        setSheetsStatusMsg({ 
          type: 'error', 
          text: err?.message || 'Google Sign-in failed. You can use the "Apps Script Webhook" tab to sync directly without sign-in!' 
        });
        return;
      }
    }

    if (!sheetId) {
      setSheetsStatusMsg({ type: 'error', text: 'No Google Sheet ID provided.' });
      return;
    }

    setSheetsLoading(true);
    setSheetsStatusMsg(null);
    try {
      const fetched = await fetchDataFromGoogleSheet(sheetId, token, db);
      if (fetched) {
        onUpdateDb(fetched);
        setSheetsStatusMsg({ type: 'success', text: 'Google Sheet data imported successfully!' });
      } else {
        setSheetsStatusMsg({ 
          type: 'error', 
          text: 'No valid data found in Google Sheet. If this is a new sheet, first click "Push to Google Sheet Now" to upload your local competition data.' 
        });
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
      setSheetsStatusMsg({ type: 'success', text: '⚡ Auto-Sync Enabled! Updates automatically sync to Google Sheet.' });
    }
  };

  const handleAdminTriggerLivePodium = () => {
    const updated = {
      ...db,
      settings: {
        ...db.settings,
        showFinalWinner: true,
        revealPodiumTime: Date.now(),
        confettiUntil: Date.now() + 65000,
      }
    };
    onUpdateDb(updated);
  };

  const handleAdminTriggerLiveConfetti = () => {
    const updated = {
      ...db,
      settings: {
        ...db.settings,
        confettiUntil: Date.now() + 60000,
      }
    };
    onUpdateDb(updated);
  };

  // Bulk Program Schedule State
  const [bulkSchedules, setBulkSchedules] = useState<Array<{
    id: string;
    code: string;
    name: string;
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
    schedule: string;
    stageType: 'Main Stage' | 'Offstage';
  }>>([]);
  const [scheduleFilterText, setScheduleFilterText] = useState('');

  // Dedicated Schedule Dropdown Filters State
  const [scheduleProgFilter, setScheduleProgFilter] = useState('all');
  const [scheduleStageFilter, setScheduleStageFilter] = useState('all');
  const [scheduleDayFilter, setScheduleDayFilter] = useState('all');
  const [scheduleCatFilter, setScheduleCatFilter] = useState('all');

  // Program Management Search & Filtering States
  const [programSearchQuery, setProgramSearchQuery] = useState('');
  const [programStageFilter, setProgramStageFilter] = useState<'all' | 'Main Stage' | 'Offstage'>('all');
  const [programCategoryFilter, setProgramCategoryFilter] = useState<string>('all');
  const [programSortBy, setProgramSortBy] = useState<'code' | 'name' | 'stage' | 'time'>('code');

  // Candidate Management & Chest Re-Numbering States
  const [participantSearchQuery, setParticipantSearchQuery] = useState('');
  const [participantSortBy, setParticipantSortBy] = useState<'chest' | 'group' | 'team' | 'name'>('group');
  const [participantProgramFilter, setParticipantProgramFilter] = useState<'all' | 'zero' | 'enrolled'>('all');
  const [participantTeamFilter, setParticipantTeamFilter] = useState<string>('all');
  const [participantGenderFilter, setParticipantGenderFilter] = useState<string>('all');
  const [participantCategoryFilter, setParticipantCategoryFilter] = useState<string>('all');
  const [showRenumberModal, setShowRenumberModal] = useState(false);
  const [renumberSortBy, setRenumberSortBy] = useState<'group_team_name' | 'team_name' | 'class_name' | 'name'>('group_team_name');
  const [renumberStartNo, setRenumberStartNo] = useState('101');
  const [renumberPrefix, setRenumberPrefix] = useState('');

  // Candidate Export Modal States
  const [resultCandidateSearch, setResultCandidateSearch] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTeamFilter, setExportTeamFilter] = useState('all');
  const [exportGenderFilter, setExportGenderFilter] = useState('all');
  const [exportSheetStructure, setExportSheetStructure] = useState<'single' | 'per_team' | 'per_team_gender'>('per_team_gender');

  // Matrix Grid Checklist Modal States
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [matrixTeamFilter, setMatrixTeamFilter] = useState('all');
  const [matrixAgeFilter, setMatrixAgeFilter] = useState('all');
  const [matrixGenderFilter, setMatrixGenderFilter] = useState('all');
  const [matrixBlankRows, setMatrixBlankRows] = useState(3);

  // Duplicate Audit & Inspector Engine State
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateTab, setDuplicateTab] = useState<'programs' | 'chests' | 'registrations' | 'results'>('programs');

  const duplicateReport = useMemo(() => {
    // 1. Duplicate Programs by Code
    const codeMap = new Map<string, Program[]>();
    db.programs.forEach(p => {
      const codeKey = (p.code || '').trim().toUpperCase();
      if (codeKey) {
        const arr = codeMap.get(codeKey) || [];
        arr.push(p);
        codeMap.set(codeKey, arr);
      }
    });
    const duplicateProgramsByCode = Array.from(codeMap.entries())
      .filter(([_, arr]) => arr.length > 1)
      .map(([code, programs]) => ({ code, programs }));

    // 2. Duplicate Programs by Name
    const nameMap = new Map<string, Program[]>();
    db.programs.forEach(p => {
      const nameKey = (p.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (nameKey) {
        const arr = nameMap.get(nameKey) || [];
        arr.push(p);
        nameMap.set(nameKey, arr);
      }
    });
    const duplicateProgramsByName = Array.from(nameMap.entries())
      .filter(([_, arr]) => arr.length > 1)
      .map(([_, programs]) => ({ name: programs[0].name, programs }));

    // 3. Duplicate Chest Numbers
    const chestMap = new Map<string, Participant[]>();
    db.participants.forEach(pt => {
      const numKey = (pt.number || '').trim();
      if (numKey) {
        const arr = chestMap.get(numKey) || [];
        arr.push(pt);
        chestMap.set(numKey, arr);
      }
    });
    const duplicateChestNumbers = Array.from(chestMap.entries())
      .filter(([_, arr]) => arr.length > 1)
      .map(([number, participants]) => ({ number, participants }));

    // 4. Double Program Registrations (Same candidate registered in same program twice)
    const duplicateRegistrations: Array<{ participant: Participant; program: Program; count: number }> = [];
    db.participants.forEach(pt => {
      const counts = new Map<string, number>();
      (pt.programIds || []).forEach(pid => {
        counts.set(pid, (counts.get(pid) || 0) + 1);
      });
      counts.forEach((cnt, pid) => {
        if (cnt > 1) {
          const prog = db.programs.find(p => p.id === pid);
          if (prog) {
            duplicateRegistrations.push({ participant: pt, program: prog, count: cnt });
          }
        }
      });
    });

    // 5. Duplicate Results for same program
    const resultMap = new Map<string, Result[]>();
    db.results.forEach(r => {
      if (r.programId) {
        const arr = resultMap.get(r.programId) || [];
        arr.push(r);
        resultMap.set(r.programId, arr);
      }
    });
    const duplicateResults = Array.from(resultMap.entries())
      .filter(([_, arr]) => arr.length > 1)
      .map(([programId, results]) => {
        const prog = db.programs.find(p => p.id === programId);
        return { programId, programName: prog?.name || 'Program', results };
      });

    const totalIssueCount = 
      duplicateProgramsByCode.length +
      duplicateProgramsByName.length +
      duplicateChestNumbers.length +
      duplicateRegistrations.length +
      duplicateResults.length;

    return {
      duplicateProgramsByCode,
      duplicateProgramsByName,
      duplicateChestNumbers,
      duplicateRegistrations,
      duplicateResults,
      totalIssueCount
    };
  }, [db]);

  const handleAutoFixDuplicatePrograms = () => {
    let updatedPrograms = [...db.programs];
    let updatedParticipants = [...db.participants];
    let removedCount = 0;

    // Merge by Code
    const codeGroupMap = new Map<string, Program[]>();
    updatedPrograms.forEach(p => {
      const k = (p.code || '').trim().toUpperCase();
      if (k) {
        const arr = codeGroupMap.get(k) || [];
        arr.push(p);
        codeGroupMap.set(k, arr);
      }
    });

    const idsToRemove = new Set<string>();
    const remapIdMap = new Map<string, string>(); // duplicateId -> masterId

    codeGroupMap.forEach((progs) => {
      if (progs.length > 1) {
        const master = progs[0];
        for (let i = 1; i < progs.length; i++) {
          idsToRemove.add(progs[i].id);
          remapIdMap.set(progs[i].id, master.id);
          removedCount++;
        }
      }
    });

    // Merge by Name for remaining programs
    const nameGroupMap = new Map<string, Program[]>();
    updatedPrograms.filter(p => !idsToRemove.has(p.id)).forEach(p => {
      const k = (p.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (k) {
        const arr = nameGroupMap.get(k) || [];
        arr.push(p);
        nameGroupMap.set(k, arr);
      }
    });

    nameGroupMap.forEach((progs) => {
      if (progs.length > 1) {
        const master = progs[0];
        for (let i = 1; i < progs.length; i++) {
          idsToRemove.add(progs[i].id);
          remapIdMap.set(progs[i].id, master.id);
          removedCount++;
        }
      }
    });

    if (idsToRemove.size === 0) {
      alert('ℹ️ No duplicate programs found to merge.');
      return;
    }

    updatedPrograms = updatedPrograms.filter(p => !idsToRemove.has(p.id));

    updatedParticipants = updatedParticipants.map(pt => {
      let newPids = (pt.programIds || []).map(pid => remapIdMap.get(pid) || pid);
      newPids = Array.from(new Set(newPids));
      return { ...pt, programIds: newPids };
    });

    onUpdateDb({
      ...db,
      programs: updatedPrograms,
      participants: updatedParticipants
    });

    alert(`✅ ${removedCount} duplicate program(s) merged successfully! Participant registrations preserved.`);
  };

  const handleAutoFixDuplicateRegistrations = () => {
    let fixedCount = 0;
    const updatedParticipants = db.participants.map(pt => {
      const origCount = (pt.programIds || []).length;
      const uniquePids = Array.from(new Set(pt.programIds || []));
      if (uniquePids.length < origCount) {
        fixedCount += (origCount - uniquePids.length);
      }
      return { ...pt, programIds: uniquePids };
    });

    if (fixedCount === 0) {
      alert('ℹ️ No double candidate program registrations found.');
      return;
    }

    onUpdateDb({
      ...db,
      participants: updatedParticipants
    });

    alert(`✅ Cleaned ${fixedCount} duplicate program registration(s) across candidates.`);
  };

  const handleAutoFixAllDuplicates = () => {
    if (duplicateReport.totalIssueCount === 0) {
      alert('✅ No duplicates found! All data is clean.');
      return;
    }

    if (!window.confirm(`⚠️ Auto-clean all ${duplicateReport.totalIssueCount} duplicate issue(s)?\n\nThis will automatically:\n- Merge programs with duplicate codes/names\n- Remap participant registrations to master program\n- Deduplicate candidate registration IDs`)) {
      return;
    }

    handleAutoFixDuplicatePrograms();
    handleAutoFixDuplicateRegistrations();
  };

  const filteredSchedulePrograms = db.programs.filter(p => {
    if (scheduleFilterText.trim()) {
      const q = scheduleFilterText.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchCode = p.code.toLowerCase().includes(q);
      const matchVenue = (p.venue || '').toLowerCase().includes(q);
      const matchDay = (p.day || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchVenue && !matchDay) return false;
    }
    if (scheduleProgFilter !== 'all' && p.id !== scheduleProgFilter) return false;
    if (scheduleStageFilter !== 'all') {
      if (scheduleStageFilter === 'Main Stage' || scheduleStageFilter === 'Offstage') {
        if ((p.stageType || 'Main Stage') !== scheduleStageFilter) return false;
      } else if ((p.venue || '') !== scheduleStageFilter) {
        return false;
      }
    }
    if (scheduleDayFilter !== 'all') {
      const dayStr = (p.day || '').toLowerCase();
      const timeStr = (p.startTime || '').toLowerCase();
      if (scheduleDayFilter === 'Morning') {
        if (!timeStr.includes('am') && !timeStr.includes('08:') && !timeStr.includes('09:') && !timeStr.includes('10:') && !timeStr.includes('11:')) return false;
      } else if (scheduleDayFilter === 'Afternoon') {
        if (!timeStr.includes('pm') && !timeStr.includes('12:') && !timeStr.includes('13:') && !timeStr.includes('14:') && !timeStr.includes('15:')) return false;
      } else if (scheduleDayFilter === 'Evening') {
        if (!timeStr.includes('pm') || timeStr.includes('12:') || timeStr.includes('01:') || timeStr.includes('02:')) return false;
      } else {
        if (!dayStr.includes(scheduleDayFilter.toLowerCase())) return false;
      }
    }
    if (scheduleCatFilter !== 'all') {
      const matchCat = p.categories.some(c => c.age === scheduleCatFilter || c.gender === scheduleCatFilter);
      if (!matchCat) return false;
    }
    return true;
  });

  const handlePrintScheduleSheet = (customDayFilter?: string) => {
    const eventName = db.settings.eventName || 'KALIMA 2k26 MEELAD FEST';
    const boardName = db.settings.boardName || 'KALIMA 2k26 MEELAD FEST';

    let listToPrint = filteredSchedulePrograms;
    if (customDayFilter && customDayFilter !== 'all') {
      listToPrint = db.programs.filter(p => {
        const pDay = p.day?.toLowerCase() || '';
        const pSched = p.schedule?.toLowerCase() || '';
        const filter = customDayFilter.toLowerCase();
        return pDay.includes(filter) || pSched.includes(filter);
      });
    }

    // Group by Day / Schedule note
    const grouped: Record<string, Program[]> = {};
    listToPrint.forEach(p => {
      const gKey = p.day || p.schedule || 'General Schedule';
      if (!grouped[gKey]) grouped[gKey] = [];
      grouped[gKey].push(p);
    });

    const activeFilterText = customDayFilter && customDayFilter !== 'all' 
      ? `DAILY SCHEDULE (${customDayFilter.toUpperCase()})` 
      : scheduleDayFilter !== 'all' 
      ? `SCHEDULE (${scheduleDayFilter.toUpperCase()})` 
      : 'OFFICIAL NOTICE BOARD SCHEDULE';

    const bodyHTML = `
      <div style="font-family: Arial, Helvetica, sans-serif; padding: 25px; max-width: 950px; margin: 0 auto; color: #111827; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 4px solid #15803d; padding-bottom: 16px;">
          <div style="font-size: 11px; font-weight: bold; color: #b45309; text-transform: uppercase; letter-spacing: 2px;">OFFICIAL NOTICE BOARD PUBLICATION</div>
          <h1 style="margin: 4px 0 0; color: #15803d; font-size: 28px; font-weight: 800; text-transform: uppercase;">${eventName}</h1>
          <h2 style="margin: 4px 0 0; color: #374151; font-size: 16px; font-weight: 600;">${boardName}</h2>
          <div style="display: inline-block; margin-top: 10px; padding: 6px 18px; background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 20px; color: #15803d; font-weight: 700; font-size: 13px;">
            📅 ${activeFilterText}
          </div>
        </div>

        ${Object.keys(grouped).length === 0 ? `
          <div style="text-align: center; padding: 40px; color: #6b7280; font-style: italic; border: 1px dashed #d1d5db; border-radius: 8px;">
            No scheduled programs found matching the selected day/filter.
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
            <div style="margin-top: 6px; font-size: 10px; color: #9ca3af;">Published on: ${new Date().toLocaleString()} &bull; Total Items: ${listToPrint.length}</div>
          </div>
          <div style="text-align: center; width: 180px;">
            <div style="border-bottom: 1px solid #9ca3af; height: 35px; margin-bottom: 4px;"></div>
            <div style="font-weight: bold; color: #111827; font-size: 11px;">Stage & Schedule Controller</div>
            <div style="font-size: 10px; color: #6b7280;">Convenor Signature</div>
          </div>
        </div>
      </div>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`<html><head><title>Notice Board Schedule - ${activeFilterText}</title></head><body>${bodyHTML}</body></html>`);
      printWin.document.close();
      printWin.print();
    }
  };

  const handleQuickUpdateSchedule = (id: string, field: string, value: any) => {
    onUpdateDb({
      ...db,
      programs: db.programs.map(p => p.id === id ? { ...p, [field]: value } : p)
    });
  };

  const handleUpdateCategorySchedule = (progId: string, categoryAge: string, field: string, val: string) => {
    onUpdateDb({
      ...db,
      programs: db.programs.map(p => {
        if (p.id !== progId) return p;
        const existing = p.categorySchedules || {};
        const catObj = existing[categoryAge] || {};
        return {
          ...p,
          categorySchedules: {
            ...existing,
            [categoryAge]: {
              ...catObj,
              [field]: val
            }
          }
        };
      })
    });
  };

  // Form states - Team
  const [teamName, setTeamName] = useState('');
  const [teamSymbol, setTeamSymbol] = useState('🛡️');
  const [teamColor, setTeamColor] = useState('#1b8155');
  const [teamCaptain, setTeamCaptain] = useState('');
  const [teamBoysCaptain, setTeamBoysCaptain] = useState('');
  const [teamBoysCaptain2, setTeamBoysCaptain2] = useState('');
  const [teamGirlsCaptain, setTeamGirlsCaptain] = useState('');
  const [teamGirlsCaptain2, setTeamGirlsCaptain2] = useState('');

  // Form states - Program
  const [progCode, setProgCode] = useState('');
  const [progName, setProgName] = useState('');
  const [progDay, setProgDay] = useState('');
  const [progVenue, setProgVenue] = useState('');
  const [progStart, setProgStart] = useState('');
  const [progEnd, setProgEnd] = useState('');
  const [progDur, setProgDur] = useState('');
  const [progDesc, setProgDesc] = useState('');
  const [progMax, setProgMax] = useState<number | null>(null);
  const [progSingle, setProgSingle] = useState(true);
  const [progGroup, setProgGroup] = useState(false);
  const [progCats, setProgCats] = useState<ProgramCategory[]>([]);
  const [progStageType, setProgStageType] = useState<'Main Stage' | 'Offstage'>('Main Stage');
  const [progSchedule, setProgSchedule] = useState('');

  // Form states - Participant
  const [paNum, setPaNum] = useState('');
  const [paName, setPaName] = useState('');
  const [paClass, setPaClass] = useState('1');
  const [paDivision, setPaDivision] = useState('');
  const [paTeam, setPaTeam] = useState('');
  const [paGender, setPaGender] = useState<'Boys' | 'Girls' | 'General'>('Boys');
  const [paProgs, setPaProgs] = useState<string[]>([]);

  // Form states - Result Publishing (Dual Section Boys & Girls + General)
  const [resProgId, setResProgId] = useState('');
  const [resAge, setResAge] = useState<typeof AGES[number] | 'All'>('Kids');
  const [resActiveView, setResActiveView] = useState<'dual' | 'boys' | 'girls' | 'general'>('dual');

  // Boys Section States
  const [resBoysTies, setResBoysTies] = useState<Record<string, string>>({});
  const [boysManualRows, setBoysManualRows] = useState<{ name: string; teamId: string; assign: string; description?: string }[]>([]);
  const [boysSearch, setBoysSearch] = useState('');

  // Girls Section States
  const [resGirlsTies, setResGirlsTies] = useState<Record<string, string>>({});
  const [girlsManualRows, setGirlsManualRows] = useState<{ name: string; teamId: string; assign: string; description?: string }[]>([]);
  const [girlsSearch, setGirlsSearch] = useState('');

  // General Section States
  const [resGenTies, setResGenTies] = useState<Record<string, string>>({});
  const [genManualRows, setGenManualRows] = useState<{ name: string; teamId: string; assign: string; description?: string }[]>([]);
  const [genSearch, setGenSearch] = useState('');

  // Admin Results Tab Filters
  const [adminResultFilterGender, setAdminResultFilterGender] = useState<'all' | 'Boys' | 'Girls' | 'General'>('all');
  const [adminResultFilterAge, setAdminResultFilterAge] = useState<string>('all');
  const [adminResultSearch, setAdminResultSearch] = useState<string>('');

  const [deleteArmId, setDeleteArmId] = useState<string | null>(null);

  // UTILS
  const armDelete = (id: string) => {
    setDeleteArmId(id);
    setTimeout(() => setDeleteArmId(null), 3000);
  };

  const getCandidateClassInfo = (name: string, teamId: string | null) => {
    const p = db.participants.find(x => x.name === name && x.teamId === teamId);
    if (!p || !p.cls) return '';
    return p.cls + (p.division ? ' ' + p.division : '');
  };

  const closeModal = () => {
    setModalType(null);
    setEditingId(null);
    setDeleteArmId(null);
  };

  // ==================== TEAMS ====================
  const handleOpenTeam = (id?: string) => {
    if (id) {
      const t = db.teams.find(x => x.id === id);
      if (t) {
        setTeamName(t.name);
        setTeamSymbol(t.symbol);
        setTeamColor(t.color);
        setTeamCaptain(t.captain || '');
        setTeamBoysCaptain(t.boysCaptain || '');
        setTeamBoysCaptain2(t.boysCaptain2 || '');
        setTeamGirlsCaptain(t.girlsCaptain || '');
        setTeamGirlsCaptain2(t.girlsCaptain2 || '');
        setEditingId(id);
      }
    } else {
      setTeamName('');
      setTeamSymbol('🛡️');
      setTeamColor('#1b8155');
      setTeamCaptain('');
      setTeamBoysCaptain('');
      setTeamBoysCaptain2('');
      setTeamGirlsCaptain('');
      setTeamGirlsCaptain2('');
    }
    setModalType('team');
  };

  const handleSaveTeam = () => {
    if (!teamName.trim()) return;
    let updatedTeams = [...db.teams];
    const data = {
      name: teamName.trim(),
      symbol: teamSymbol,
      color: teamColor,
      captain: teamCaptain.trim(),
      boysCaptain: teamBoysCaptain.trim(),
      boysCaptain2: teamBoysCaptain2.trim(),
      girlsCaptain: teamGirlsCaptain.trim(),
      girlsCaptain2: teamGirlsCaptain2.trim()
    };

    if (editingId) {
      updatedTeams = updatedTeams.map(t => t.id === editingId ? { ...t, ...data } : t);
    } else {
      updatedTeams.push({
        id: generateId(),
        points: 0,
        ...data
      });
    }

    onUpdateDb({ ...db, teams: updatedTeams });
    closeModal();
  };

  const handleDeleteTeam = (id: string) => {
    onUpdateDb({
      ...db,
      teams: db.teams.filter(t => t.id !== id)
    });
  };

  // ==================== PROGRAMS ====================
  const handleOpenProgram = (id?: string) => {
    if (id) {
      const p = db.programs.find(x => x.id === id);
      if (p) {
        setProgCode(p.code);
        setProgName(p.name);
        setProgDay(p.day);
        setProgVenue(p.venue);
        setProgStart(p.startTime);
        setProgEnd(p.endTime);
        setProgDur(p.duration);
        setProgDesc(p.description);
        setProgMax(p.maxParticipants);
        setProgSingle(p.single);
        setProgGroup(p.group);
        setProgCats(p.categories);
        setProgStageType(p.stageType || 'Main Stage');
        setProgSchedule(p.schedule || '');
        setEditingId(id);
      }
    } else {
      setProgCode('');
      setProgName('');
      setProgDay('');
      setProgVenue('');
      setProgStart('');
      setProgEnd('');
      setProgDur('');
      setProgDesc('');
      setProgMax(null);
      setProgSingle(true);
      setProgGroup(false);
      setProgCats([]);
      setProgStageType('Main Stage');
      setProgSchedule('');
    }
    setModalType('program');
  };

  const handleToggleCat = (g: 'Boys' | 'Girls' | 'General', age: any) => {
    const exists = progCats.some(c => c.gender === g && c.age === age);
    if (exists) {
      setProgCats(progCats.filter(c => !(c.gender === g && c.age === age)));
    } else {
      setProgCats([...progCats, { gender: g, age }]);
    }
  };

  const handleToggleCatGroup = (g: 'Boys' | 'Girls', checked: boolean) => {
    if (checked) {
      const added = AGES.map(a => ({ gender: g as any, age: a as any }));
      const clean = progCats.filter(c => c.gender !== g);
      setProgCats([...clean, ...added]);
    } else {
      setProgCats(progCats.filter(c => c.gender !== g));
    }
  };

  const handleSelectAllCategories = () => {
    const all: ProgramCategory[] = [];
    ['Boys', 'Girls'].forEach(g => {
      AGES.forEach(a => {
        all.push({ gender: g as any, age: a as any });
      });
    });
    all.push({ gender: 'General', age: 'All' });
    setProgCats(all);
  };

  const handleSelectGenderOnly = (g: 'Boys' | 'Girls') => {
    const clean = progCats.filter(c => c.gender !== g);
    const added = AGES.map(a => ({ gender: g as any, age: a as any }));
    setProgCats([...clean, ...added]);
  };

  const handleClearAllCategories = () => {
    setProgCats([]);
  };

  const handleSaveProgram = () => {
    if (!progCode.trim() || !progName.trim()) return;

    const trimmedCode = progCode.trim().toUpperCase();
    const trimmedName = progName.trim().toLowerCase().replace(/\s+/g, ' ');

    const dupCode = db.programs.find(p => p.code.toUpperCase() === trimmedCode && p.id !== editingId);
    if (dupCode) {
      alert(`⚠️ Program code "${trimmedCode}" is already assigned to "${dupCode.name}"!`);
      return;
    }

    const dupName = db.programs.find(p => p.name.trim().toLowerCase().replace(/\s+/g, ' ') === trimmedName && p.id !== editingId);
    if (dupName) {
      alert(`⚠️ Program "${progName.trim()}" already exists in the system! [Code: ${dupName.code}]`);
      return;
    }

    let updatedProgs = [...db.programs];
    const data = {
      code: trimmedCode,
      name: progName.trim(),
      day: progDay,
      venue: progVenue,
      startTime: progStart,
      endTime: progEnd,
      duration: progDur.trim(),
      description: progDesc.trim(),
      maxParticipants: progMax,
      single: progSingle,
      group: progGroup,
      categories: progCats,
      stageType: progStageType,
      schedule: progSchedule.trim()
    };

    if (editingId) {
      updatedProgs = updatedProgs.map(p => p.id === editingId ? { ...p, ...data } : p);
    } else {
      updatedProgs.push({
        id: generateId(),
        ...data
      });
    }

    onUpdateDb({ ...db, programs: updatedProgs });
    closeModal();
  };

  const handleDeleteProgram = (id: string) => {
    onUpdateDb({
      ...db,
      programs: db.programs.filter(p => p.id !== id),
      results: db.results.filter(r => r.programId !== id)
    });
  };

  const handleOpenBulkSchedule = () => {
    const list = db.programs.map(p => ({
      id: p.id,
      code: p.code,
      name: p.name,
      day: p.day || 'Day 1',
      startTime: p.startTime || '',
      endTime: p.endTime || '',
      venue: p.venue || '',
      schedule: p.schedule || '',
      stageType: p.stageType || 'Main Stage'
    }));
    setBulkSchedules(list);
    setScheduleFilterText('');
    setModalType('bulk_schedule');
  };

  const handleUpdateBulkScheduleRow = (id: string, field: string, val: string) => {
    setBulkSchedules(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: val };
      }
      return item;
    }));
  };

  const handleBatchApplyDay = (dayVal: string) => {
    if (!dayVal) return;
    setBulkSchedules(prev => prev.map(item => ({ ...item, day: dayVal })));
  };

  const handleSaveBulkSchedules = () => {
    const updatedPrograms = db.programs.map(p => {
      const match = bulkSchedules.find(item => item.id === p.id);
      if (match) {
        return {
          ...p,
          day: match.day.trim(),
          startTime: match.startTime.trim(),
          endTime: match.endTime.trim(),
          venue: match.venue.trim(),
          schedule: match.schedule.trim() || `${match.day}${match.startTime ? ' ' + match.startTime : ''}`,
          stageType: match.stageType
        };
      }
      return p;
    });

    onUpdateDb({ ...db, programs: updatedPrograms });
    closeModal();
  };

  // ==================== PARTICIPANTS ====================
  const handleOpenParticipant = (id?: string) => {
    if (id) {
      const pa = db.participants.find(x => x.id === id);
      if (pa) {
        setPaNum(pa.number);
        setPaName(pa.name);
        setPaClass(pa.cls || '1');
        setPaDivision(pa.division || '');
        setPaTeam(pa.teamId || '');
        setPaGender(pa.gender);
        setPaProgs(pa.programIds);
        setEditingId(id);
      }
    } else {
      setPaNum('');
      setPaName('');
      setPaClass('1');
      setPaDivision('');
      setPaTeam('');
      setPaGender('Boys');
      setPaProgs([]);
    }
    setModalType('participant');
  };

  const handleSaveParticipant = () => {
    if (!paName.trim()) return;
    let updatedPas = [...db.participants];
    const computedAge = classToAge(paClass);

    const data = {
      number: paNum.trim(),
      name: paName.trim(),
      cls: paClass,
      division: paDivision,
      teamId: paTeam || null,
      gender: paGender,
      age: computedAge,
      programIds: paProgs
    };

    if (editingId) {
      updatedPas = updatedPas.map(p => p.id === editingId ? { ...p, ...data } : p);
    } else {
      updatedPas.push({
        id: generateId(),
        ...data
      });
    }

    onUpdateDb({ ...db, participants: updatedPas });
    closeModal();
  };

  const handleDeleteParticipant = (id: string) => {
    onUpdateDb({
      ...db,
      participants: db.participants.filter(p => p.id !== id)
    });
  };

  const handleApplyAutoRenumber = () => {
    const startNo = parseInt(renumberStartNo, 10);
    if (isNaN(startNo)) {
      alert('Please enter a valid starting chest number (e.g. 101).');
      return;
    }

    const groupOrderMap: Record<string, number> = {
      'Kids': 1,
      'Sub Junior': 2,
      'Junior': 3,
      'Senior': 4,
      'Super Senior': 5,
    };

    let list = [...db.participants];

    list.sort((a, b) => {
      if (renumberSortBy === 'group_team_name') {
        const gA = groupOrderMap[classToAge(a.cls)] || 99;
        const gB = groupOrderMap[classToAge(b.cls)] || 99;
        if (gA !== gB) return gA - gB;

        const teamA = db.teams.find(t => t.id === a.teamId)?.name || '';
        const teamB = db.teams.find(t => t.id === b.teamId)?.name || '';
        if (teamA !== teamB) return teamA.localeCompare(teamB);

        return a.name.localeCompare(b.name);
      } else if (renumberSortBy === 'team_name') {
        const teamA = db.teams.find(t => t.id === a.teamId)?.name || '';
        const teamB = db.teams.find(t => t.id === b.teamId)?.name || '';
        if (teamA !== teamB) return teamA.localeCompare(teamB);
        return a.name.localeCompare(b.name);
      } else if (renumberSortBy === 'class_name') {
        const cA = parseInt(a.cls, 10) || 0;
        const cB = parseInt(b.cls, 10) || 0;
        if (cA !== cB) return cA - cB;
        return a.name.localeCompare(b.name);
      } else {
        return a.name.localeCompare(b.name);
      }
    });

    const renumberedParticipants = list.map((p, idx) => ({
      ...p,
      number: `${renumberPrefix}${(startNo + idx).toString()}`
    }));

    onUpdateDb({
      ...db,
      participants: renumberedParticipants
    });

    setShowRenumberModal(false);
    alert(`✅ Successfully re-numbered ${renumberedParticipants.length} candidates starting from ${renumberPrefix}${startNo}!`);
  };

  const handleDeduplicateCandidates = () => {
    if (!db.participants || db.participants.length === 0) {
      alert('No candidates found to deduplicate.');
      return;
    }

    const seen = new Map<string, Participant>();
    let dupCount = 0;

    db.participants.forEach(p => {
      const cNum = (p.number || '').toString().trim().toLowerCase();
      const cName = (p.name || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
      const key = cNum && cNum !== '-' ? `chest_${cNum}` : `name_${cName}`;

      if (key && seen.has(key)) {
        dupCount++;
        const existing = seen.get(key)!;
        const mergedProgs = Array.from(new Set([...(existing.programIds || []), ...(p.programIds || [])]));
        seen.set(key, {
          ...existing,
          cls: existing.cls || p.cls,
          division: existing.division || p.division,
          teamId: existing.teamId || p.teamId,
          programIds: mergedProgs
        });
      } else {
        seen.set(key, { ...p, name: p.name.trim() });
      }
    });

    if (dupCount === 0) {
      alert('✅ No duplicate candidates found! All records are unique.');
      return;
    }

    const cleanedList = Array.from(seen.values());
    onUpdateDb({
      ...db,
      participants: cleanedList
    });

    alert(`✅ Successfully merged and removed ${dupCount} duplicate candidate record(s)! All registered programs were preserved.`);
  };

  const handleExportCandidatesExcel = () => {
    let list = [...db.participants];

    if (exportTeamFilter !== 'all') {
      list = list.filter(p => p.teamId === exportTeamFilter);
    }

    if (exportGenderFilter !== 'all') {
      list = list.filter(p => p.gender === exportGenderFilter);
    }

    if (list.length === 0) {
      alert('No candidates found matching the selected export filters.');
      return;
    }

    const wb = XLSX.utils.book_new();

    const groupOrderMap: Record<string, number> = {
      'Kids': 1,
      'Sub Junior': 2,
      'Junior': 3,
      'Senior': 4,
      'Super Senior': 5,
    };

    const sortCandidates = (arr: typeof list) => {
      return [...arr].sort((a, b) => {
        const gA = groupOrderMap[classToAge(a.cls)] || 99;
        const gB = groupOrderMap[classToAge(b.cls)] || 99;
        if (gA !== gB) return gA - gB;

        const numA = parseInt(a.number, 10) || 0;
        const numB = parseInt(b.number, 10) || 0;
        if (numA !== numB) return numA - numB;

        return a.name.localeCompare(b.name);
      });
    };

    const buildRows = (items: typeof list) => {
      const rows = [
        ['Chest No', 'Name', 'Class', 'Division', 'Gender Section', 'Group Category', 'Team', 'Registered Programs']
      ];
      items.forEach(pa => {
        const team = db.teams.find(t => t.id === pa.teamId);
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
          team ? team.name : '—',
          progs || 'None'
        ]);
      });
      return rows;
    };

    const applyColWidths = (ws: any) => {
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
    };

    if (exportSheetStructure === 'single') {
      const sorted = sortCandidates(list);
      const wsData = buildRows(sorted);
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      applyColWidths(ws);
      XLSX.utils.book_append_sheet(wb, ws, 'All Candidates');
    } else if (exportSheetStructure === 'per_team') {
      const teamsToExport = exportTeamFilter !== 'all'
        ? db.teams.filter(t => t.id === exportTeamFilter)
        : db.teams;

      teamsToExport.forEach(team => {
        const teamParts = list.filter(p => p.teamId === team.id);
        if (teamParts.length > 0) {
          const sorted = sortCandidates(teamParts);
          const wsData = buildRows(sorted);
          const ws = XLSX.utils.aoa_to_sheet(wsData);
          applyColWidths(ws);
          const sheetName = team.name.replace(/[\\/?*:[\]]/g, '').slice(0, 31);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
      });
    } else if (exportSheetStructure === 'per_team_gender') {
      const teamsToExport = exportTeamFilter !== 'all'
        ? db.teams.filter(t => t.id === exportTeamFilter)
        : db.teams;

      const gendersToExport = exportGenderFilter !== 'all'
        ? [exportGenderFilter]
        : ['Boys', 'Girls', 'General'];

      teamsToExport.forEach(team => {
        gendersToExport.forEach(gen => {
          const matchingParts = list.filter(p => p.teamId === team.id && p.gender === gen);
          if (matchingParts.length > 0) {
            const sorted = sortCandidates(matchingParts);
            const wsData = buildRows(sorted);
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            applyColWidths(ws);
            const sheetName = `${team.name} - ${gen}`.replace(/[\\/?*:[\]]/g, '').slice(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
          }
        });
      });
    }

    const teamLabel = exportTeamFilter !== 'all' ? (db.teams.find(t => t.id === exportTeamFilter)?.name || 'Team') : 'All_Teams';
    const genLabel = exportGenderFilter !== 'all' ? exportGenderFilter : 'All_Sections';
    const fileName = `Candidates_${teamLabel}_${genLabel}.xlsx`;

    XLSX.writeFile(wb, fileName);
    setShowExportModal(false);
  };

  // ==================== TEAM LEADER MATRIX GRID CHECKLIST GENERATOR ====================
  const handleGenerateMatrixExcel = () => {
    const teamsToExport = matrixTeamFilter !== 'all'
      ? db.teams.filter(t => t.id === matrixTeamFilter)
      : db.teams;

    const agesToExport = matrixAgeFilter !== 'all'
      ? [matrixAgeFilter]
      : [...AGES, 'General'];

    const gendersToExport = matrixGenderFilter !== 'all'
      ? [matrixGenderFilter]
      : ['Boys', 'Girls', 'General'];

    const wb = XLSX.utils.book_new();
    let totalSheetsAdded = 0;

    teamsToExport.forEach(team => {
      agesToExport.forEach(ageCat => {
        gendersToExport.forEach(gen => {
          // Find programs belonging to this category & gender
          const progs = db.programs.filter(p => {
            const isGenProg = p.categories.some(c => c.gender === 'General' || c.age === 'All' || c.age === 'General');
            if (isGenProg) {
              if (ageCat === 'Kids') return false; // General progs hide for Kids
              return gen === 'General' || ageCat === 'General' || ageCat !== 'Kids';
            }
            return p.categories.some(c => 
              (gen === 'all' || c.gender === gen || c.gender === 'General') && 
              (ageCat === 'all' || c.age === ageCat || c.age === 'All' || c.age === 'General')
            );
          });

          if (progs.length === 0) return;

          // Find candidates
          const candidates = db.participants.filter(p => {
            if (p.teamId !== team.id) return false;
            if (matrixGenderFilter !== 'all' && p.gender !== gen) return false;
            const candAge = classToAge(p.cls);
            if (matrixAgeFilter !== 'all' && candAge !== ageCat) return false;
            return true;
          });

          if (candidates.length === 0) return;

          const titleRow = [`${team.symbol} ${team.name} — ${ageCat} Group (${gen} Section) — Program Checklist Matrix`];
          const emptyRow: string[] = [];
          const headerRow = [
            'Chest No',
            'Candidate Name',
            'Class',
            'Division',
            ...progs.map(p => `${p.code} - ${p.name}`),
            'Total Reg'
          ];

          const rows = [titleRow, emptyRow, headerRow];

          const sortedCandidates = [...candidates].sort((a, b) => {
            const numA = parseInt(a.number, 10) || 0;
            const numB = parseInt(b.number, 10) || 0;
            if (numA !== numB) return numA - numB;
            return a.name.localeCompare(b.name);
          });

          sortedCandidates.forEach(cand => {
            const candProgs = cand.programIds || [];
            const progTicks = progs.map(p => candProgs.includes(p.id) ? '✓' : '');
            rows.push([
              cand.number || '—',
              cand.name,
              cand.cls || '—',
              cand.division || '—',
              ...progTicks,
              String(candProgs.length)
            ]);
          });

          for (let i = 1; i <= matrixBlankRows; i++) {
            rows.push([
              `[  ]`,
              `___________________`,
              `__`,
              `__`,
              ...progs.map(() => '[  ]'),
              '0'
            ]);
          }

          const ws = XLSX.utils.aoa_to_sheet(rows);
          ws['!cols'] = [
            { wch: 10 },
            { wch: 24 },
            { wch: 7 },
            { wch: 9 },
            ...progs.map(() => ({ wch: 14 })),
            { wch: 10 }
          ];

          const sheetName = `${team.name.slice(0, 8)} ${ageCat.slice(0, 6)} ${gen}`.replace(/[\\/?*:[\]]/g, '').slice(0, 31);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
          totalSheetsAdded++;
        });
      });
    });

    if (totalSheetsAdded === 0) {
      alert('No candidates/programs found matching the selected team and category criteria.');
      return;
    }

    const teamLabel = matrixTeamFilter !== 'all' ? (db.teams.find(t => t.id === matrixTeamFilter)?.name || 'Team') : 'All_Teams';
    XLSX.writeFile(wb, `Team_Leader_Grid_Checklist_${teamLabel}.xlsx`);
    setShowMatrixModal(false);
  };

  const handleGenerateMatrixPrintHTML = () => {
    const teamsToExport = matrixTeamFilter !== 'all'
      ? db.teams.filter(t => t.id === matrixTeamFilter)
      : db.teams;

    const agesToExport = matrixAgeFilter !== 'all'
      ? [matrixAgeFilter]
      : [...AGES, 'General'];

    const gendersToExport = matrixGenderFilter !== 'all'
      ? [matrixGenderFilter]
      : ['Boys', 'Girls', 'General'];

    let htmlPages = '';
    let pageCount = 0;

    teamsToExport.forEach(team => {
      agesToExport.forEach(ageCat => {
        gendersToExport.forEach(gen => {
          const progs = db.programs.filter(p => {
            const isGenProg = p.categories.some(c => c.gender === 'General' || c.age === 'All' || c.age === 'General');
            if (isGenProg) {
              if (ageCat === 'Kids') return false;
              return gen === 'General' || ageCat === 'General' || ageCat !== 'Kids';
            }
            return p.categories.some(c => 
              (gen === 'all' || c.gender === gen || c.gender === 'General') && 
              (ageCat === 'all' || c.age === ageCat || c.age === 'All' || c.age === 'General')
            );
          });

          if (progs.length === 0) return;

          const candidates = db.participants.filter(p => {
            if (p.teamId !== team.id) return false;
            if (matrixGenderFilter !== 'all' && p.gender !== gen) return false;
            const candAge = classToAge(p.cls);
            if (matrixAgeFilter !== 'all' && candAge !== ageCat) return false;
            return true;
          });

          if (candidates.length === 0) return;

          pageCount++;

          const sortedCandidates = [...candidates].sort((a, b) => {
            const numA = parseInt(a.number, 10) || 0;
            const numB = parseInt(b.number, 10) || 0;
            if (numA !== numB) return numA - numB;
            return a.name.localeCompare(b.name);
          });

          htmlPages += `
            <div class="grid-page">
              <div class="grid-header">
                <div>
                  <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #064e3b;">
                    ${team.symbol} ${team.name} &mdash; ${ageCat} Group (${gen} Section)
                  </h2>
                  <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: bold; color: #334155;">
                    📋 TEAM LEADER PROGRAM CHECKLIST MATRIX SHEET
                  </p>
                </div>
                <div style="text-align: right; font-size: 11px; font-weight: bold; color: #1e293b;">
                  <div>Candidates: <b>${candidates.length}</b> | Programs: <b>${progs.length}</b></div>
                  <div style="color: #64748b; font-size: 10px; margin-top: 2px;">Date: ____________</div>
                </div>
              </div>

              <table class="grid-table">
                <thead>
                  <tr>
                    <th style="width: 42px; font-weight: 800; vertical-align: bottom; padding-bottom: 6px;">Chest No</th>
                    <th class="cand-name" style="font-weight: 800; vertical-align: bottom; padding-bottom: 6px;">Candidate Name</th>
                    <th style="width: 32px; font-weight: 800; vertical-align: bottom; padding-bottom: 6px;">Class</th>
                    <th style="width: 28px; font-weight: 800; vertical-align: bottom; padding-bottom: 6px;">Div</th>
                    ${progs.map(p => `
                      <th class="prog-header" title="${p.code} - ${p.name}">
                        <div class="prog-rotate-wrapper">
                          <span class="prog-code">${p.code}</span>
                          <span class="prog-sep">-</span>
                          <span class="prog-title">${p.name}</span>
                        </div>
                      </th>
                    `).join('')}
                    <th style="width: 36px; font-weight: 800; vertical-align: bottom; padding-bottom: 6px;">Total Reg</th>
                  </tr>
                </thead>
                <tbody>
                  ${sortedCandidates.map(c => {
                    const cProgs = c.programIds || [];
                    return `
                      <tr>
                        <td style="font-weight: 800; font-family: monospace;">${c.number || '—'}</td>
                        <td class="cand-name">${c.name}</td>
                        <td style="font-weight: 600;">${c.cls || '—'}</td>
                        <td style="font-weight: 600;">${c.division || '—'}</td>
                        ${progs.map(p => {
                          const isReg = cProgs.includes(p.id);
                          return isReg ? `<td class="tick-cell">✓</td>` : `<td class="empty-cell"></td>`;
                        }).join('')}
                        <td style="font-weight: 800; background: #f8fafc;">${cProgs.length}</td>
                      </tr>
                    `;
                  }).join('')}

                  ${Array.from({ length: matrixBlankRows }).map(() => `
                    <tr style="height: 26px;">
                      <td style="color: #475569; font-weight: 600; font-size: 11px;">[ ]</td>
                      <td class="cand-name" style="color: #475569;">________________________</td>
                      <td style="color: #475569;">__</td>
                      <td style="color: #475569;">__</td>
                      ${progs.map(() => `<td class="empty-cell" style="color: #475569; font-size: 11px;">[ ]</td>`).join('')}
                      <td style="font-weight: 700; color: #475569;">0</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <div class="footer-signatures">
                <div>Team Captain: _____________________</div>
                <div>Leader Contact: _____________________</div>
                <div>Signature: _____________________</div>
              </div>
            </div>
          `;
        });
      });
    });

    if (pageCount === 0) {
      alert('No candidates/programs found matching the selected criteria.');
      return;
    }

    const fullHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Team Leader Program Checklist Matrix</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 12px; color: #0f172a; background: #fff; }
          .grid-page { page-break-after: always; margin-bottom: 25px; }
          .grid-header { border: 2px solid #0f172a; padding: 10px 14px; background: #f1f5f9; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border-radius: 6px; }
          .grid-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          .grid-table th, .grid-table td { border: 1.5px solid #1e293b; padding: 4px 3px; text-align: center; font-size: 11px; }
          .grid-table th { background: #ffffff; font-weight: 800; color: #0f172a; font-size: 11px; }
          .prog-header { height: 160px; width: 32px; min-width: 28px; max-width: 36px; vertical-align: bottom; padding: 0 !important; position: relative; background: #ffffff !important; text-align: center; }
          .prog-rotate-wrapper { position: absolute; left: 50%; bottom: 8px; transform: rotate(-90deg) translateY(50%); transform-origin: left center; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; font-weight: 800; line-height: 1; color: #000000; }
          .prog-code { font-weight: 900; font-size: 11px; color: #000000; font-family: inherit; }
          .prog-sep { color: #334155; font-weight: 700; margin: 0 1px; }
          .prog-title { font-size: 11px; font-weight: 800; color: #000000; white-space: nowrap; }
          .cand-name { text-align: left !important; font-weight: 700; padding-left: 8px !important; min-width: 140px; font-size: 11px; }
          .tick-cell { font-size: 14px; font-weight: 900; color: #000000; background: #ffffff; }
          .empty-cell { color: #94a3b8; font-size: 12px; }
          .footer-signatures { margin-top: 14px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #334155; padding-top: 6px; border-top: 1px dashed #94a3b8; }
          @media print {
            .grid-page { page-break-after: always; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        ${htmlPages}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(fullHTML);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        try { printWindow.print(); } catch (e) { /* ignore */ }
      }, 400);
    } else {
      // Fallback to downloading HTML file
      const blob = new Blob([fullHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Team_Leader_Program_Grid_Checklist.html';
      a.click();
    }

    setShowMatrixModal(false);
  };

  // ==================== RESULTS (DUAL BOYS & GIRLS PUBLISHING) ====================
  const loadResultStateForProgramAndAge = (progId: string, age: string) => {
    // Find existing results for Boys, Girls, General
    const boysRes = db.results.find(r => r.programId === progId && r.gender === 'Boys' && (r.age === age || age === 'All' || r.age === 'All'));
    const girlsRes = db.results.find(r => r.programId === progId && r.gender === 'Girls' && (r.age === age || age === 'All' || r.age === 'All'));
    const genRes = db.results.find(r => r.programId === progId && r.gender === 'General' && (r.age === age || age === 'All' || r.age === 'All'));

    // Load Boys ties
    const boysTies: Record<string, string> = {};
    const boysManual: { name: string; teamId: string; assign: string; description?: string }[] = [];
    if (boysRes) {
      const boysCandidates = db.participants.filter(p => (p.gender === 'Boys' || !p.gender) && (p.age === age || age === 'All') && p.programIds.includes(progId));
      boysCandidates.forEach(cand => {
        let val = '';
        ['first', 'second', 'third'].forEach(pos => {
          if ((boysRes.winners as any)[pos]?.some((e: any) => e.name === cand.name && e.teamId === cand.teamId)) val = pos;
        });
        ['gradeA', 'gradeB', 'gradeC', 'participation'].forEach(g => {
          if ((boysRes.grades as any)[g]?.some((e: any) => e.name === cand.name && e.teamId === cand.teamId)) val = g;
        });
        if (val) boysTies[cand.id] = val;
      });

      ['first', 'second', 'third', 'gradeA', 'gradeB', 'gradeC', 'participation'].forEach(key => {
        const list = ['first', 'second', 'third'].includes(key) ? (boysRes.winners as any)[key] : (boysRes.grades as any)[key];
        (list || []).forEach((e: any) => {
          const isReg = boysCandidates.some(c => c.name === e.name && c.teamId === e.teamId);
          if (!isReg) boysManual.push({ name: e.name, teamId: e.teamId || '', assign: key, description: e.description || '' });
        });
      });
    }
    setResBoysTies(boysTies);
    setBoysManualRows(boysManual);

    // Load Girls ties
    const girlsTies: Record<string, string> = {};
    const girlsManual: { name: string; teamId: string; assign: string; description?: string }[] = [];
    if (girlsRes) {
      const girlsCandidates = db.participants.filter(p => p.gender === 'Girls' && (p.age === age || age === 'All') && p.programIds.includes(progId));
      girlsCandidates.forEach(cand => {
        let val = '';
        ['first', 'second', 'third'].forEach(pos => {
          if ((girlsRes.winners as any)[pos]?.some((e: any) => e.name === cand.name && e.teamId === cand.teamId)) val = pos;
        });
        ['gradeA', 'gradeB', 'gradeC', 'participation'].forEach(g => {
          if ((girlsRes.grades as any)[g]?.some((e: any) => e.name === cand.name && e.teamId === cand.teamId)) val = g;
        });
        if (val) girlsTies[cand.id] = val;
      });

      ['first', 'second', 'third', 'gradeA', 'gradeB', 'gradeC', 'participation'].forEach(key => {
        const list = ['first', 'second', 'third'].includes(key) ? (girlsRes.winners as any)[key] : (girlsRes.grades as any)[key];
        (list || []).forEach((e: any) => {
          const isReg = girlsCandidates.some(c => c.name === e.name && c.teamId === e.teamId);
          if (!isReg) girlsManual.push({ name: e.name, teamId: e.teamId || '', assign: key, description: e.description || '' });
        });
      });
    }
    setResGirlsTies(girlsTies);
    setGirlsManualRows(girlsManual);

    // Load General ties
    const genTies: Record<string, string> = {};
    const genManual: { name: string; teamId: string; assign: string; description?: string }[] = [];
    if (genRes) {
      const genCandidates = db.participants.filter(p => (p.age === age || age === 'All') && p.programIds.includes(progId));
      genCandidates.forEach(cand => {
        let val = '';
        ['first', 'second', 'third'].forEach(pos => {
          if ((genRes.winners as any)[pos]?.some((e: any) => e.name === cand.name && e.teamId === cand.teamId)) val = pos;
        });
        ['gradeA', 'gradeB', 'gradeC', 'participation'].forEach(g => {
          if ((genRes.grades as any)[g]?.some((e: any) => e.name === cand.name && e.teamId === cand.teamId)) val = g;
        });
        if (val) genTies[cand.id] = val;
      });

      ['first', 'second', 'third', 'gradeA', 'gradeB', 'gradeC', 'participation'].forEach(key => {
        const list = ['first', 'second', 'third'].includes(key) ? (genRes.winners as any)[key] : (genRes.grades as any)[key];
        (list || []).forEach((e: any) => {
          const isReg = genCandidates.some(c => c.name === e.name && c.teamId === e.teamId);
          if (!isReg) genManual.push({ name: e.name, teamId: e.teamId || '', assign: key, description: e.description || '' });
        });
      });
    }
    setResGenTies(genTies);
    setGenManualRows(genManual);
  };

  const handleOpenResult = (id?: string) => {
    if (id) {
      const r = db.results.find(x => x.id === id);
      if (r) {
        setResProgId(r.programId);
        setResAge(r.age as any);
        if (r.gender === 'Boys') setResActiveView('boys');
        else if (r.gender === 'Girls') setResActiveView('girls');
        else if (r.gender === 'General') setResActiveView('general');
        else setResActiveView('dual');

        loadResultStateForProgramAndAge(r.programId, r.age);
        setEditingId(id);
      }
    } else {
      setResProgId('');
      setResAge('Kids');
      setResActiveView('dual');
      setResBoysTies({});
      setBoysManualRows([]);
      setResGirlsTies({});
      setGirlsManualRows([]);
      setResGenTies({});
      setGenManualRows([]);
      setEditingId(null);
    }
    setModalType('result');
  };

  const handleResultProgChange = (pid: string) => {
    setResProgId(pid);
    if (!pid) {
      setResBoysTies({});
      setBoysManualRows([]);
      setResGirlsTies({});
      setGirlsManualRows([]);
      setResGenTies({});
      setGenManualRows([]);
      setEditingId(null);
      return;
    }
    const prog = db.programs.find(p => p.id === pid);
    const defaultAge = prog?.categories?.[0]?.age || 'Kids';
    setResAge(defaultAge as any);

    // Set appropriate active view based on program categories
    const hasBoys = prog?.categories.some(c => c.gender === 'Boys') ?? true;
    const hasGirls = prog?.categories.some(c => c.gender === 'Girls') ?? true;
    const hasGen = prog?.categories.some(c => c.gender === 'General') ?? false;

    if (hasGen && !hasBoys && !hasGirls) {
      setResActiveView('general');
    } else if (hasBoys && hasGirls) {
      setResActiveView('dual');
    } else if (hasBoys) {
      setResActiveView('boys');
    } else if (hasGirls) {
      setResActiveView('girls');
    } else {
      setResActiveView('dual');
    }

    loadResultStateForProgramAndAge(pid, defaultAge);
  };

  const handleResultAgeChange = (age: string) => {
    setResAge(age as any);
    if (resProgId) {
      loadResultStateForProgramAndAge(resProgId, age);
    }
  };

  const handleSaveResult = () => {
    if (!resProgId) {
      alert('Please select a competition program to publish results.');
      return;
    }

    let updatedResults = [...db.results];
    const prog = db.programs.find(p => p.id === resProgId);

    // ==================== PROCESS BOYS RESULTS ====================
    const boysWinners: Result['winners'] = { first: [], second: [], third: [] };
    const boysGrades: Result['grades'] = { gradeA: [], gradeB: [], gradeC: [], participation: [] };

    const boysCandidates = db.participants.filter(p => {
      if (!p.programIds.includes(resProgId)) return false;
      const genderMatch = p.gender === 'Boys' || !p.gender;
      const ageMatch = (resAge as string) === 'All' || p.age === resAge;
      return genderMatch && ageMatch;
    });

    boysCandidates.forEach(p => {
      const val = resBoysTies[p.id];
      if (!val) return;
      const entry: CandidateResultEntry = { name: p.name, teamId: p.teamId };
      if (['first', 'second', 'third'].includes(val)) {
        (boysWinners as any)[val].push(entry);
      } else {
        (boysGrades as any)[val].push(entry);
      }
    });

    boysManualRows.forEach(row => {
      if (!row.name.trim() || !row.assign) return;
      const entry: CandidateResultEntry = {
        name: row.name.trim(),
        teamId: row.teamId || null,
        description: row.description?.trim() || undefined
      };
      if (['first', 'second', 'third'].includes(row.assign)) {
        (boysWinners as any)[row.assign].push(entry);
      } else {
        (boysGrades as any)[row.assign].push(entry);
      }
    });

    const hasBoysData = boysWinners.first.length > 0 || boysWinners.second.length > 0 || boysWinners.third.length > 0 ||
      Object.values(boysGrades).some(arr => arr.length > 0);

    const existingBoysRes = db.results.find(r => r.programId === resProgId && r.gender === 'Boys' && (r.age === resAge || resAge === 'All' || r.age === 'All'));

    if (hasBoysData) {
      const boysData: Omit<Result, 'id'> = {
        programId: resProgId,
        gender: 'Boys',
        age: resAge,
        winners: boysWinners,
        grades: boysGrades,
        datetime: existingBoysRes?.datetime || new Date().toISOString()
      };
      if (existingBoysRes) {
        updatedResults = updatedResults.map(r => r.id === existingBoysRes.id ? { ...r, ...boysData } : r);
      } else {
        updatedResults.push({ id: generateId(), ...boysData });
      }
    } else if (existingBoysRes && resActiveView === 'boys') {
      // If user deliberately emptied boys while in boys view, remove or update
      updatedResults = updatedResults.filter(r => r.id !== existingBoysRes.id);
    }

    // ==================== PROCESS GIRLS RESULTS ====================
    const girlsWinners: Result['winners'] = { first: [], second: [], third: [] };
    const girlsGrades: Result['grades'] = { gradeA: [], gradeB: [], gradeC: [], participation: [] };

    const girlsCandidates = db.participants.filter(p => {
      if (!p.programIds.includes(resProgId)) return false;
      const genderMatch = p.gender === 'Girls';
      const ageMatch = (resAge as string) === 'All' || p.age === resAge;
      return genderMatch && ageMatch;
    });

    girlsCandidates.forEach(p => {
      const val = resGirlsTies[p.id];
      if (!val) return;
      const entry: CandidateResultEntry = { name: p.name, teamId: p.teamId };
      if (['first', 'second', 'third'].includes(val)) {
        (girlsWinners as any)[val].push(entry);
      } else {
        (girlsGrades as any)[val].push(entry);
      }
    });

    girlsManualRows.forEach(row => {
      if (!row.name.trim() || !row.assign) return;
      const entry: CandidateResultEntry = {
        name: row.name.trim(),
        teamId: row.teamId || null,
        description: row.description?.trim() || undefined
      };
      if (['first', 'second', 'third'].includes(row.assign)) {
        (girlsWinners as any)[row.assign].push(entry);
      } else {
        (girlsGrades as any)[row.assign].push(entry);
      }
    });

    const hasGirlsData = girlsWinners.first.length > 0 || girlsWinners.second.length > 0 || girlsWinners.third.length > 0 ||
      Object.values(girlsGrades).some(arr => arr.length > 0);

    const existingGirlsRes = db.results.find(r => r.programId === resProgId && r.gender === 'Girls' && (r.age === resAge || resAge === 'All' || r.age === 'All'));

    if (hasGirlsData) {
      const girlsData: Omit<Result, 'id'> = {
        programId: resProgId,
        gender: 'Girls',
        age: resAge,
        winners: girlsWinners,
        grades: girlsGrades,
        datetime: existingGirlsRes?.datetime || new Date().toISOString()
      };
      if (existingGirlsRes) {
        updatedResults = updatedResults.map(r => r.id === existingGirlsRes.id ? { ...r, ...girlsData } : r);
      } else {
        updatedResults.push({ id: generateId(), ...girlsData });
      }
    } else if (existingGirlsRes && resActiveView === 'girls') {
      updatedResults = updatedResults.filter(r => r.id !== existingGirlsRes.id);
    }

    // ==================== PROCESS GENERAL RESULTS ====================
    const genWinners: Result['winners'] = { first: [], second: [], third: [] };
    const genGrades: Result['grades'] = { gradeA: [], gradeB: [], gradeC: [], participation: [] };

    const genCandidates = db.participants.filter(p => {
      if (!p.programIds.includes(resProgId)) return false;
      const ageMatch = (resAge as string) === 'All' || p.age === resAge;
      return ageMatch;
    });

    genCandidates.forEach(p => {
      const val = resGenTies[p.id];
      if (!val) return;
      const entry: CandidateResultEntry = { name: p.name, teamId: p.teamId };
      if (['first', 'second', 'third'].includes(val)) {
        (genWinners as any)[val].push(entry);
      } else {
        (genGrades as any)[val].push(entry);
      }
    });

    genManualRows.forEach(row => {
      if (!row.name.trim() || !row.assign) return;
      const entry: CandidateResultEntry = {
        name: row.name.trim(),
        teamId: row.teamId || null,
        description: row.description?.trim() || undefined
      };
      if (['first', 'second', 'third'].includes(row.assign)) {
        (genWinners as any)[row.assign].push(entry);
      } else {
        (genGrades as any)[row.assign].push(entry);
      }
    });

    const hasGenData = genWinners.first.length > 0 || genWinners.second.length > 0 || genWinners.third.length > 0 ||
      Object.values(genGrades).some(arr => arr.length > 0);

    const existingGenRes = db.results.find(r => r.programId === resProgId && r.gender === 'General' && (r.age === resAge || resAge === 'All' || r.age === 'All'));

    if (hasGenData) {
      const genData: Omit<Result, 'id'> = {
        programId: resProgId,
        gender: 'General',
        age: resAge,
        winners: genWinners,
        grades: genGrades,
        datetime: existingGenRes?.datetime || new Date().toISOString()
      };
      if (existingGenRes) {
        updatedResults = updatedResults.map(r => r.id === existingGenRes.id ? { ...r, ...genData } : r);
      } else {
        updatedResults.push({ id: generateId(), ...genData });
      }
    } else if (existingGenRes && resActiveView === 'general') {
      updatedResults = updatedResults.filter(r => r.id !== existingGenRes.id);
    }

    if (!hasBoysData && !hasGirlsData && !hasGenData) {
      alert('Please assign at least 1 winner or grade before publishing.');
      return;
    }

    onUpdateDb({ ...db, results: updatedResults });
    closeModal();
  };

  const handleDeleteResult = (id: string) => {
    onUpdateDb({
      ...db,
      results: db.results.filter(r => r.id !== id)
    });
  };

  const handleProgramExcelTemplate = () => {
    const wsData = [
      ['Program Code', 'Program Name', 'Gender Section', 'Age Category', 'Program Type', 'Stage Type'],
      ['KD01', 'Song Competition', 'Boys', 'Kids', 'Single', 'Main Stage'],
      ['SB01', 'Qirat Recitation', 'Girls', 'Sub Junior', 'Single', 'Offstage'],
      ['JR01', 'Elocution', 'Boys', 'Junior', 'Single', 'Main Stage'],
      ['SR01', 'Group Song', 'Girls', 'Senior', 'Group', 'Main Stage'],
      ['OFF01', 'Essay Writing (Open to Class 5-12)', 'General', 'General', 'Single', 'Offstage']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 32 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Programs');

    const refData = [
      ['Allowed Gender Section Options', 'Allowed Age Category Options', 'Allowed Program Types', 'Stage Options'],
      ['Boys', 'Kids (Class 1-2)', 'Single', 'Main Stage'],
      ['Girls', 'Sub Junior (Class 3-4)', 'Group', 'Offstage'],
      ['General', 'Junior (Class 5-6)', 'Single & Group', ''],
      ['', 'Senior (Class 7-8)', '', ''],
      ['', 'Super Senior (Class 9-12)', '', ''],
      ['', 'General / All (Class 5-12)', '', '']
    ];
    const refWs = XLSX.utils.aoa_to_sheet(refData);
    refWs['!cols'] = [{ wch: 28 }, { wch: 30 }, { wch: 22 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, refWs, 'Valid Options Reference');

    XLSX.writeFile(wb, 'Program_Import_Template.xlsx');
  };

  const handleProgramExcelUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];

        // Read matrix to auto-detect header row or column positions
        const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!matrix || matrix.length === 0) {
          alert('⚠️ The uploaded spreadsheet is empty.');
          return;
        }

        // Auto-detect header row index (scanning first 15 rows)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(15, matrix.length); i++) {
          const rowStr = (matrix[i] || []).map(cell => String(cell).toLowerCase()).join(' ');
          if (rowStr.includes('code') || rowStr.includes('program') || rowStr.includes('name') || rowStr.includes('item') || rowStr.includes('category')) {
            headerRowIdx = i;
            break;
          }
        }

        const headerRow = matrix[headerRowIdx] || [];
        const dataRows = matrix.slice(headerRowIdx + 1);

        const importedList: any[] = [];

        dataRows.forEach((rowArray) => {
          if (!rowArray || !Array.isArray(rowArray) || rowArray.every(cell => String(cell).trim() === '')) return;

          // Helper to get value by matching header text OR column index
          const getColVal = (headerCandidates: string[], fallbackIndices: number[]) => {
            // 1. Check header text match
            for (let c = 0; c < headerRow.length; c++) {
              const hText = String(headerRow[c] || '').toLowerCase().trim();
              if (headerCandidates.some(cand => hText.includes(cand.toLowerCase()))) {
                const val = String(rowArray[c] || '').trim();
                if (val && !val.toLowerCase().startsWith('column ')) return val;
              }
            }
            // 2. Fallback to column index
            for (const idx of fallbackIndices) {
              if (rowArray[idx] !== undefined && rowArray[idx] !== null) {
                const val = String(rowArray[idx]).trim();
                if (val) return val;
              }
            }
            return '';
          };

          const code = getColVal(['Program Code', 'Code', 'Item Code', 'no'], [0]);
          const name = getColVal(['Program Name', 'Name', 'Item Name', 'Title'], [1]);

          if (!code && !name) return;

          const rawGender = getColVal(['Gender Section', 'Gender', 'Sex', 'Boy/Girl', 'Boys/Girls', 'Section', 'വിഭാഗം'], [2]);
          const rawAge = getColVal(['Age Category', 'Age Group', 'Age', 'Class Division', 'Group Category', 'Category'], [3]);
          const parsedCategories = parseCategoriesFromInput(rawGender, rawAge);
          const firstCat = parsedCategories[0] || { gender: 'Boys', age: 'Junior' };

          const rawType = getColVal(['Program Type', 'Type', 'Single/Group'], [4]).toLowerCase();
          const isGroup = rawType.includes('group');
          const isSingle = !isGroup || rawType.includes('single');

          const rawStage = getColVal(['Stage Type', 'Stage', 'Venue Type', 'Stage/Offstage'], [5]);
          const stageType = rawStage.toLowerCase().includes('off') ? 'Offstage' : 'Main Stage';

          const venue = getColVal(['Venue', 'Location', 'Place'], [6]);
          const schedule = getColVal(['Schedule', 'Time', 'Day'], [7]);

          importedList.push({
            code: code || ('P' + Math.floor(Math.random() * 1000)),
            name: name || 'Unnamed Program',
            stageType,
            gender: firstCat.gender,
            age: firstCat.age,
            categories: parsedCategories,
            single: isSingle,
            group: isGroup,
            venue,
            schedule
          });
        });

        if (importedList.length > 0) {
          if (onBulkImportPrograms) {
            onBulkImportPrograms(importedList);
            alert(`✅ Successfully imported ${importedList.length} programs with precise Gender (Boys/Girls/General) detection!`);
          }
        } else {
          alert('⚠️ No valid program entries found in the spreadsheet.');
        }
      } catch (err) {
        alert('❌ Error processing the program spreadsheet file.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleExportProgramExcel = () => {
    if (db.programs.length === 0) {
      alert('ℹ️ No competition programs found to export.');
      return;
    }

    const wb = XLSX.utils.book_new();
    const rows = [
      ['Program Code', 'Program Name', 'Gender Section', 'Age Category', 'Stage / Venue', 'Day', 'Time Schedule', 'Program Type', 'Max Candidates', 'Enrolled Candidates']
    ];

    db.programs.forEach(p => {
      const genders = Array.from(new Set((p.categories || []).map(c => c.gender))).join(', ') || 'General';
      const ages = Array.from(new Set((p.categories || []).map(c => c.age))).join(', ') || 'All';
      const progType = (p.single && p.group) ? 'Single & Group' : p.group ? 'Group' : 'Single';
      
      const enrolledCount = db.participants.filter(pt => pt.programIds && pt.programIds.includes(p.id)).length;

      rows.push([
        p.code || '—',
        p.name,
        genders,
        ages,
        p.venue ? `${p.stageType || 'Main Stage'} (${p.venue})` : (p.stageType || 'Main Stage'),
        p.day || 'Day 1',
        p.startTime ? `${p.startTime}${p.endTime ? ' - ' + p.endTime : ''}` : (p.schedule || '—'),
        progType,
        p.maxParticipants ? String(p.maxParticipants) : 'Unlimited',
        String(enrolledCount)
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 }, // Code
      { wch: 32 }, // Name
      { wch: 16 }, // Gender
      { wch: 18 }, // Age Category
      { wch: 22 }, // Stage / Venue
      { wch: 12 }, // Day
      { wch: 22 }, // Time Schedule
      { wch: 16 }, // Type
      { wch: 16 }, // Max
      { wch: 20 }  // Enrolled Count
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Programs Sheet');
    const fileName = `Competition_Programs_Sheet_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleParticipantExcelTemplate = () => {
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

  const handleParticipantExcelUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];

        // Read matrix to auto-detect header row or column positions
        const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!matrix || matrix.length === 0) {
          alert('⚠️ The uploaded spreadsheet is empty.');
          return;
        }

        // Auto-detect header row index (scanning first 15 rows)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(15, matrix.length); i++) {
          const rowStr = (matrix[i] || []).map(cell => String(cell).toLowerCase()).join(' ');
          if (rowStr.includes('name') || rowStr.includes('student') || rowStr.includes('chest') || rowStr.includes('number') || rowStr.includes('class') || rowStr.includes('team')) {
            headerRowIdx = i;
            break;
          }
        }

        const headerRow = matrix[headerRowIdx] || [];
        const dataRows = matrix.slice(headerRowIdx + 1);

        const importedList: any[] = [];

        dataRows.forEach((rowArray) => {
          if (!rowArray || !Array.isArray(rowArray) || rowArray.every(cell => String(cell).trim() === '')) return;

          // Helper to get value by matching header text OR column index
          const getColVal = (headerCandidates: string[], fallbackIndices: number[]) => {
            // 1. Check header text match
            for (let c = 0; c < headerRow.length; c++) {
              const hText = String(headerRow[c] || '').toLowerCase().trim();
              if (headerCandidates.some(cand => hText.includes(cand.toLowerCase()))) {
                const val = String(rowArray[c] || '').trim();
                if (val && !val.toLowerCase().startsWith('column ')) return val;
              }
            }
            // 2. Fallback to column index
            for (const idx of fallbackIndices) {
              if (rowArray[idx] !== undefined && rowArray[idx] !== null) {
                const val = String(rowArray[idx]).trim();
                if (val) return val;
              }
            }
            return '';
          };

          const name = getColVal(['Name', 'Student Name', 'Participant Name', 'Full Name', 'Candidate'], [1, 0]);
          if (!name) return;

          const number = getColVal(['Number', 'Chest No', 'Chest Number', 'Chest', 'ChestNo', 'no'], [0, 1]);
          const cls = getColVal(['Class', 'Cls', 'Grade', 'Std'], [2, 3]);
          const division = getColVal(['Division', 'Div', 'Section'], [3, 4]);

          const rawGender = getColVal(['Gender', 'Sex', 'Category', 'Boy/Girl', 'Section'], [4, 2]).toLowerCase();
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

          const teamName = getColVal(['Team', 'Team Name', 'House', 'Group'], [5, 4]);
          const matchedTeam = db.teams.find(t => t.name.toLowerCase() === teamName.toLowerCase());

          const rawPrograms = getColVal(['Programs (codes, comma-separated)', 'Programs', 'Program Codes', 'Item Codes', 'Codes', 'items'], [6, 5]);
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
          if (onBulkImportParticipants) {
            onBulkImportParticipants(importedList);
            alert(`✅ Bulk imported ${importedList.length} participants with gender detection!`);
          } else {
            const newParticipants = [...db.participants];
            importedList.forEach(entry => {
              const programIds: string[] = [];
              entry.codes.forEach((code: string) => {
                const prog = db.programs.find(p => p.code.toLowerCase() === code.toLowerCase());
                if (prog) programIds.push(prog.id);
              });

              newParticipants.push({
                id: generateId(),
                number: entry.number || '',
                name: entry.name,
                cls: entry.cls,
                division: entry.division,
                teamId: entry.teamId,
                gender: entry.gender,
                age: classToAge(entry.cls),
                programIds: programIds
              });
            });

            onUpdateDb({
              ...db,
              participants: newParticipants
            });
            alert(`✅ Bulk imported ${importedList.length} participants with gender detection!`);
          }
        } else {
          alert('❌ No valid participants found in spreadsheet.');
        }
      } catch (err) {
        alert('❌ Failed to process Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleSaveNoticeQuick = () => {
    const updatedDb = {
      ...db,
      settings: {
        ...db.settings,
        showNotice: noticeEnabled,
        notices: noticesList,
        noticeText: noticesList.length > 0 ? noticesList[0].text : '',
        noticeTitle: noticesList.length > 0 ? noticesList[0].title : ''
      }
    };
    onUpdateDb(updatedDb);
    setShowNoticeEditor(false);
    alert('✅ All spot notices & advertisements successfully published live to all devices!');
  };

  return (
    <div className="view active pb-20 max-w-2xl mx-auto space-y-4">
      {/* Master Admin Page Banner */}
      <div className="p-3.5 bg-gradient-to-r from-emerald-900 via-brand-green-900 to-emerald-950 text-white rounded-2xl border-2 border-brand-gold-500/50 shadow-md space-y-1 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-brand-gold-400 animate-ping" />
            <h2 className="font-display font-extrabold text-brand-gold-300 text-sm md:text-base">
              🛡️ MASTER ADMIN PANEL &bull; Live Operations Center
            </h2>
          </div>
          <span className="px-2.5 py-0.5 bg-brand-gold-500/20 text-brand-gold-300 text-[10px] font-mono font-bold rounded-full border border-brand-gold-500/30">
            LIVE MASTER
          </span>
        </div>
        <p className="text-[11px] text-emerald-100/90 leading-snug">
          Results and scoring published here instantly update across all connected participant and audience devices in real time!
        </p>
      </div>

      {/* Title & Mode Switcher */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-brand-gold-500 animate-pulse" />
            <h3 className="font-display font-bold text-brand-green-950 text-base md:text-lg">
              System Admin Dashboard
            </h3>
          </div>
          {adminMode === 'management' && (
            <button
              onClick={() => {
                if (activeTab === 'teams') handleOpenTeam();
                if (activeTab === 'programs') handleOpenProgram();
                if (activeTab === 'participants') handleOpenParticipant();
                if (activeTab === 'results') handleOpenResult();
              }}
              className="px-4 py-2 bg-gradient-to-r from-brand-gold-500 to-brand-gold-700 text-brand-green-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer hover:brightness-110 active:scale-95 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Record
            </button>
          )}
        </div>

        {/* Master Category Selector Tabs */}
        <div className="p-1.5 bg-brand-panel border-2 border-brand-line rounded-2xl grid grid-cols-2 gap-1.5 shadow-sm select-none">
          <button
            onClick={() => setAdminMode('management')}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              adminMode === 'management'
                ? 'bg-brand-green-900 text-brand-gold-300 shadow-md ring-1 ring-brand-gold-500/40'
                : 'bg-white/60 text-brand-ink-soft hover:bg-white hover:text-brand-green-900'
            }`}
          >
            <span className="text-sm">🛠️</span>
            <span className="truncate">Data & Program Management</span>
          </button>

          <button
            onClick={() => setAdminMode('broadcasting')}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              adminMode === 'broadcasting'
                ? 'bg-amber-600 text-white shadow-md ring-1 ring-amber-400'
                : 'bg-white/60 text-brand-ink-soft hover:bg-white hover:text-amber-900'
            }`}
          >
            <span className="text-sm">📺</span>
            <span className="truncate">Live Broadcast & Screen Controls</span>
            {(db.settings?.isLiveCelebrationActive || db.settings?.showNotice !== false) && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
            )}
          </button>
        </div>
      </div>

      {/* ==================== CATEGORY 1: LIVE BROADCAST & SCREEN CONTROLS ==================== */}
      {adminMode === 'broadcasting' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-950 flex items-center gap-2">
            <span className="text-base shrink-0">📺</span>
            <span>
              <b>Live Broadcast Control Page:</b> Manage live screen displays, color themes, announcement popups, stage celebrations, podium cards, rotating team score tickers, and Google Sheets integration.
            </span>
          </div>

          {/* Quick Color Theme Switcher Bar */}
          <div className="p-3 bg-brand-panel border-2 border-brand-line rounded-2xl space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-brand-green-950">
                <span>🎨</span>
                <span>Website Color Theme & High-Contrast Mode</span>
              </div>
              <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full uppercase">
                Current: {db.settings.colorTheme || 'natural'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 xs:grid-cols-4 gap-1.5">
              {[
                { id: 'natural', label: '🌿 Natural', bg: 'bg-[#f4f3ed] text-[#1b4332] border-[#1b4332]' },
                { id: 'outdoor-light', label: '☀️ Outdoor Light', bg: 'bg-white text-emerald-950 border-emerald-600' },
                { id: 'outdoor-dark', label: '🌙 Night Stage', bg: 'bg-slate-900 text-teal-300 border-teal-500' },
                { id: 'solar-high-contrast', label: '⚡ Solar High', bg: 'bg-yellow-200 text-black border-black font-extrabold' },
                { id: 'royal-gold', label: '👑 Royal Navy', bg: 'bg-blue-950 text-amber-300 border-amber-400' },
                { id: 'emerald-luxury', label: '💎 Emerald Lux', bg: 'bg-emerald-950 text-emerald-200 border-emerald-400' },
                { id: 'crimson-ruby', label: '🍷 Crimson Ruby', bg: 'bg-rose-950 text-rose-200 border-rose-400' },
                { id: 'ocean-breeze', label: '🌊 Ocean Breeze', bg: 'bg-cyan-50 text-cyan-950 border-cyan-600' },
              ].map(t => {
                const isActive = (db.settings.colorTheme || 'natural') === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onUpdateDb({
                        ...db,
                        settings: {
                          ...db.settings,
                          colorTheme: t.id as any
                        }
                      });
                    }}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${t.bg} ${
                      isActive ? 'ring-2 ring-offset-1 ring-amber-500 scale-[1.02] shadow-sm font-black' : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notice Board Quick Toggle & Manager Bar */}
      <div className="p-3 bg-gradient-to-r from-amber-500/15 via-amber-600/10 to-yellow-500/15 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2.5 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">📢</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs text-brand-green-950 uppercase tracking-wide truncate">
                Live Notice Board:
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${db.settings.showNotice !== false ? 'bg-amber-600 text-white animate-pulse' : 'bg-gray-200 text-gray-700'}`}>
                {db.settings.showNotice !== false ? `🔴 LIVE (${noticesList.filter(n => n.active !== false).length} ACTIVE)` : '⚪ OFF'}
              </span>
            </div>
            <span className="text-[10px] text-brand-ink-soft block mt-0.5 truncate max-w-sm">
              {noticesList.length > 0 ? noticesList.map(n => n.title).join(' • ') : 'No notices configured.'}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setNoticeEnabled(db.settings.showNotice !== false);
            setShowNoticeEditor(!showNoticeEditor);
          }}
          className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5 shrink-0"
        >
          <span>✍️</span> {showNoticeEditor ? 'Close Notice Manager' : 'Manage Notices (Add/Edit)'}
        </button>
      </div>

      {/* Notice Board Quick Editor Collapsible Box */}
      {showNoticeEditor && (
        <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-2xl space-y-4 shadow-md animate-fadeIn">
          <div className="flex items-center justify-between border-b border-amber-200 pb-2.5">
            <span className="font-extrabold text-xs text-amber-950 flex items-center gap-1.5">
              <span>📢</span> Live Notice Board & Popup Manager
            </span>
            <label className="flex items-center gap-1.5 text-xs font-bold text-amber-900 cursor-pointer">
              <input
                type="checkbox"
                checked={noticeEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  setNoticeEnabled(val);
                  onUpdateDb({
                    ...db,
                    settings: {
                      ...db.settings,
                      showNotice: val
                    }
                  });
                }}
                className="w-4 h-4 rounded accent-amber-600 cursor-pointer"
              />
              Enable Notice Board on Home Screen
            </label>
          </div>

          {/* Auto Popup Control Switch */}
          <div className="p-3 bg-amber-100/70 rounded-xl border border-amber-300 flex items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-extrabold text-amber-950 block text-[11px]">
                ⚡ Auto-Popup on Initial Page Load (Recommended: OFF)
              </span>
              <span className="text-[10px] text-amber-900 block font-medium">
                When OFF, users see a clean website entry. Notices open smoothly only when users click "Explore Live Results" or tap the notice banner.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={!!db.settings?.noticePopupOnLoad}
                onChange={(e) => {
                  const val = e.target.checked;
                  onUpdateDb({
                    ...db,
                    settings: {
                      ...db.settings,
                      noticePopupOnLoad: val
                    }
                  });
                }}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* Form to add or edit a notice */}
          <div className="bg-white p-3.5 border border-amber-300 rounded-xl space-y-3 shadow-inner">
            <span className="font-extrabold text-xs text-amber-900 block">
              {editingNoticeId ? '✏️ Edit Notice Item' : '➕ Add New Notice Item'}
            </span>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-amber-900 block mb-1">Notice Category & Color Theme</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { type: 'urgent', label: '🚨 Urgent (Red)', bg: 'bg-rose-600 text-white', border: 'border-rose-500' },
                    { type: 'important', label: '⚡ Important (Amber)', bg: 'bg-amber-500 text-amber-950', border: 'border-amber-500' },
                    { type: 'info', label: 'ℹ️ Info (Blue)', bg: 'bg-sky-600 text-white', border: 'border-sky-500' },
                    { type: 'general', label: '📢 General (Green)', bg: 'bg-emerald-600 text-white', border: 'border-emerald-500' },
                  ].map((cat) => (
                    <button
                      key={cat.type}
                      type="button"
                      onClick={() => setNewNoticeType(cat.type as any)}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-extrabold cursor-pointer border transition-all text-center ${
                        newNoticeType === cat.type ? `${cat.bg} shadow-md scale-105 ring-2 ring-amber-400` : 'bg-gray-100 text-gray-700 border-gray-200 opacity-80'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-amber-900 block mb-0.5">Notice Headline / Short Title</label>
                <input
                  type="text"
                  value={newNoticeTitle}
                  onChange={(e) => setNewNoticeTitle(e.target.value)}
                  placeholder="e.g. Stage 1 Time Rescheduled / Results Announced"
                  className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-semibold text-amber-950 focus:outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-amber-900 block mb-0.5">Notice Message Body</label>
                <textarea
                  value={newNoticeText}
                  onChange={(e) => setNewNoticeText(e.target.value)}
                  rows={2}
                  placeholder="Type full notice description here..."
                  className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-medium text-amber-950 focus:outline-none focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                {editingNoticeId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoticeId(null);
                      setNewNoticeTitle('');
                      setNewNoticeText('');
                    }}
                    className="px-3 py-1 bg-gray-200 text-gray-800 font-bold text-xs rounded-lg"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddOrUpdateNotice}
                  disabled={!newNoticeText.trim()}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer disabled:opacity-50"
                >
                  {editingNoticeId ? 'Update Notice Item' : '➕ Add Notice to List'}
                </button>
              </div>
            </div>
          </div>

          {/* List of active/inactive notices */}
          {noticesList.length > 0 ? (
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wide block">
                Configured Notices ({noticesList.length}):
              </span>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {noticesList.map((n) => {
                  const isUrgent = n.type === 'urgent';
                  const isImportant = n.type === 'important';
                  const isInfo = n.type === 'info';

                  const badgeClass = isUrgent ? 'bg-rose-600 text-white' : isImportant ? 'bg-amber-500 text-amber-950 font-bold' : isInfo ? 'bg-sky-600 text-white' : 'bg-emerald-600 text-white';

                  return (
                    <div key={n.id} className={`p-3 bg-white border rounded-xl flex items-start justify-between gap-2 shadow-sm ${n.active === false ? 'opacity-50 border-gray-200' : 'border-amber-300'}`}>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${badgeClass}`}>
                            {n.type}
                          </span>
                          <b className="text-xs font-bold text-amber-950 truncate">{n.title}</b>
                        </div>
                        <p className="text-[11px] text-amber-900 leading-snug line-clamp-2">{n.text}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleNoticeActive(n.id)}
                          className={`px-2 py-1 rounded text-[10px] font-extrabold ${n.active !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-600 border border-gray-300'}`}
                        >
                          {n.active !== false ? '🟢 Active' : '⚪ Hidden'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditNotice(n)}
                          className="p-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNotice(n.id)}
                          className="p-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-amber-800 text-center py-2 italic bg-amber-100/50 rounded-xl">
              No notices added yet. Use the form above to add your first notice!
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-amber-200">
            <button
              onClick={() => setShowNoticeEditor(false)}
              className="px-3 py-1.5 border border-amber-300 text-amber-900 font-bold text-xs rounded-xl hover:bg-amber-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNoticeQuick}
              className="px-5 py-2 bg-amber-700 hover:bg-amber-800 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              💾 Save & Publish All Notices
            </button>
          </div>
        </div>
      )}



      {/* Public Website Link ON/OFF Control Switch Card */}
      <div className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md transition-all ${
        db.settings?.isPublicSiteOffline 
          ? 'bg-gradient-to-r from-red-500/20 via-rose-500/25 to-red-500/20 border-red-500 shadow-red-500/10' 
          : 'bg-gradient-to-r from-emerald-500/20 via-teal-500/25 to-emerald-500/20 border-emerald-500 shadow-emerald-500/10'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-xs ${
            db.settings?.isPublicSiteOffline ? 'bg-red-600 text-white animate-pulse' : 'bg-emerald-600 text-white'
          }`}>
            {db.settings?.isPublicSiteOffline ? '🔴' : '🟢'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-xs md:text-sm text-brand-green-950 uppercase tracking-wide">
                Public Link Access Switch (ON / OFF)
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                db.settings?.isPublicSiteOffline 
                  ? 'bg-red-700 text-white animate-bounce' 
                  : 'bg-emerald-700 text-white'
              }`}>
                {db.settings?.isPublicSiteOffline ? 'OFF (404 Offline Mode)' : 'ON (Public Access Active)'}
              </span>
            </div>
            <p className="text-xs text-brand-green-900 mt-0.5 font-medium leading-tight">
              {db.settings?.isPublicSiteOffline 
                ? '⚠️ LINK IS OFF: Parents/Public opening this link will see a 404 Page Not Found error message. Only Admins can log in and view the app.'
                : '✅ LINK IS ON: Competition data, live results, and scoreboard are viewable publicly by everyone.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={!db.settings?.isPublicSiteOffline}
              onChange={(e) => {
                const isON = e.target.checked;
                const updated = {
                  ...db,
                  settings: {
                    ...db.settings,
                    isPublicSiteOffline: !isON
                  },
                  lastModified: Date.now()
                };
                onUpdateDb(updated);
              }}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-red-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      </div>

      {/* Championship Podium Control Panel */}
      <div className="p-4 bg-gradient-to-r from-amber-500/20 via-brand-gold-500/30 to-amber-500/20 border-2 border-brand-gold-400 rounded-2xl flex flex-col gap-4 shadow-md">
        {/* Switch 1: Live Celebration Pop-Up Modal */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-brand-gold-500/30 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">🎆</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-xs text-brand-green-950 uppercase tracking-wide">
                  Fullscreen Live Ceremony Modal
                </span>
                {db.settings?.isLiveCelebrationActive && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 bg-rose-600 text-white animate-pulse">
                    LIVE CEREMONY ACTIVE
                  </span>
                )}
              </div>
              <span className="text-[10px] text-brand-green-900 block mt-0.5 font-medium">
                Immediately opens live full-screen celebration modal on ALL connected devices. Turning OFF closes it instantly for everyone.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
                  onUpdateDb(updated);
                }}
                className="sr-only peer"
              />
              <div className="w-12 h-6.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>
        </div>

        {/* Switch 2: Always-On Main Screen Champions Podium Card */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">🏆</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-xs text-brand-green-950 uppercase tracking-wide">
                  Show Champions Podium Card on Main Screen (Home / Scoreboard)
                </span>
                {db.settings?.showFinalWinner && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 bg-emerald-600 text-white">
                    MAIN SCREEN ACTIVE
                  </span>
                )}
              </div>
              <span className="text-[10px] text-brand-green-900 block mt-0.5 font-medium">
                Displays the Champions Podium (1st, 2nd, 3rd) continuously on the Home & Scoreboard screens with glowing animations.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={!!db.settings?.showFinalWinner}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  const updated = {
                    ...db,
                    settings: {
                      ...db.settings,
                      showFinalWinner: enabled,
                    }
                  };
                  onUpdateDb(updated);
                }}
                className="sr-only peer"
              />
              <div className="w-12 h-6.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>
        </div>

        {/* Podium Backdrop Poster Upload & Visibility Slider Section */}
        <div className="pt-2 border-t border-brand-gold-500/40 flex flex-col gap-3 text-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {db.settings?.podiumBgUrl ? (
                <div className="relative shrink-0">
                  <img
                    src={db.settings.podiumBgUrl}
                    alt="Podium Background Poster"
                    className="w-12 h-12 object-cover rounded-xl border border-brand-gold-500 shadow-sm"
                    style={{ opacity: db.settings?.podiumBgOpacity !== undefined ? db.settings.podiumBgOpacity : 0.5 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = {
                        ...db,
                        settings: {
                          ...db.settings,
                          podiumBgUrl: undefined,
                        }
                      };
                      onUpdateDb(updated);
                    }}
                    className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold shadow hover:bg-red-700 cursor-pointer"
                    title="Remove custom poster"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl border border-dashed border-brand-gold-600 flex items-center justify-center bg-black/10 text-xl text-brand-green-950 shrink-0">
                  🖼️
                </div>
              )}
              <div className="min-w-0">
                <b className="text-[11px] font-bold text-brand-green-950 block">
                  🖼️ Championship Background Poster Upload
                </b>
                <span className="text-[10px] text-brand-green-900 block leading-tight">
                  Upload your event's official poster image and adjust brightness/opacity for the podium background.
                </span>
              </div>
            </div>

            <label className="shrink-0 bg-brand-green-900 hover:bg-brand-green-800 text-brand-gold-300 px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-all shadow-xs flex items-center gap-1.5 border border-brand-gold-500/30">
              <span>📤 Upload Poster Image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        if (width > 900) {
                          height = Math.round((height * 900) / width);
                          width = 900;
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.drawImage(img, 0, 0, width, height);
                          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
                          const updated = {
                            ...db,
                            settings: {
                              ...db.settings,
                              podiumBgUrl: dataUrl,
                            }
                          };
                          onUpdateDb(updated);
                        }
                      };
                      img.src = event.target?.result as string;
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
          </div>

          {/* Color & Poster Opacity Visibility Adjustment Slider */}
          <div className="bg-black/10 p-2.5 rounded-xl border border-brand-gold-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-green-950">
                🎨 Poster Brightness / Opacity:
              </span>
              <span className="font-mono text-xs font-black text-amber-700 bg-white/70 px-2 py-0.5 rounded-md border border-amber-500/30">
                {Math.round((db.settings?.podiumBgOpacity !== undefined ? db.settings.podiumBgOpacity : 0.5) * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[10px] text-gray-600 font-medium">Dark (10%)</span>
              <input
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={db.settings?.podiumBgOpacity !== undefined ? db.settings.podiumBgOpacity : 0.5}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  const updated = {
                    ...db,
                    settings: {
                      ...db.settings,
                      podiumBgOpacity: val,
                    }
                  };
                  onUpdateDb(updated);
                }}
                className="w-full sm:w-36 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
              <span className="text-[10px] text-gray-600 font-medium">Bright (95%)</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
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
                  onUpdateDb(updated);
                }}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>
      </div>
      <div className="p-3.5 bg-gradient-to-r from-blue-500/20 via-sky-500/25 to-blue-500/20 border-2 border-sky-400 rounded-2xl flex flex-col gap-3 shadow-md">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">🛡️</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-xs text-brand-green-950 uppercase tracking-wide">
                  Always-On Team Display Switch
                </span>
                {db.settings?.showAlwaysTeamBanner && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 bg-sky-600 text-white animate-pulse">
                    DISPLAY ACTIVE
                  </span>
                )}
              </div>
              <span className="text-[10px] text-brand-green-900 block mt-0.5 font-medium">
                Displays all teams prominently across the top/bottom of the screen at all times.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
                  onUpdateDb(updated);
                }}
                className="sr-only peer"
              />
              <div className="w-12 h-6.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>
        </div>

        {db.settings?.showAlwaysTeamBanner && (
          <div className="pt-2 border-t border-sky-500/30 flex items-center justify-between gap-2 text-xs">
            <span className="text-[11px] font-bold text-brand-green-950">
              🔢 Show Points in Team Banner:
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
                  onUpdateDb(updated);
                }}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        )}
      </div>

      {/* Team Standings & Performance Bar Graph Quick Bar */}
      <div className="p-3.5 bg-gradient-to-r from-emerald-500/20 via-teal-500/25 to-emerald-500/20 border-2 border-teal-400 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl shrink-0">📊</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-xs text-brand-green-950 uppercase tracking-wide">
                Team Performance Bar Graph & Rank Trend Switch
              </span>
              {db.settings?.showTeamAnalyticsGraph && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 bg-teal-600 text-white animate-pulse">
                  GRAPH ACTIVE
                </span>
              )}
            </div>
            <span className="text-[10px] text-brand-green-900 block mt-0.5 font-medium">
              Displays bar chart analytics showing team score totals and rank movement trends.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
                onUpdateDb(updated);
              }}
              className="sr-only peer"
            />
            <div className="w-12 h-6.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-teal-600"></div>
          </label>
        </div>
      </div>

      {/* Live Rotating Team Score Flash Quick Bar */}
      <div className="p-3.5 bg-gradient-to-r from-purple-500/20 via-indigo-500/25 to-purple-500/20 border-2 border-indigo-400 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl shrink-0">⚡</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-xs text-brand-green-950 uppercase tracking-wide">
                Live Rotating Team Score Flash Switch
              </span>
              {db.settings?.showTeamTicker && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 bg-indigo-600 text-white animate-pulse">
                  TEAM FLASH ACTIVE
                </span>
              )}
            </div>
            <span className="text-[10px] text-brand-green-900 block mt-0.5 font-medium">
              Flashes individual team scores in vibrant colors sequentially across the screen.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
                onUpdateDb(updated);
              }}
              className="sr-only peer"
            />
            <div className="w-12 h-6.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      {/* Suspense & Curiosity Controls (Admin Quick Bar) */}
      <div className="p-4 bg-gradient-to-r from-amber-500/20 via-yellow-500/25 to-amber-500/20 border-2 border-amber-400 rounded-2xl space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-2 border-b border-amber-400/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔒</span>
            <div>
              <h4 className="font-extrabold text-xs text-brand-green-950 uppercase tracking-wide">
                Suspense Mode &amp; Curiosity Controls (സസ്‌പെൻസ് കൺട്രോൾസ്)
              </h4>
              <p className="text-[10px] text-brand-green-900 font-medium">
                അവസാന വിജയി പ്രഖ്യാപനം വരെ കുട്ടികൾക്ക് ആകാംഷ നിലനിർത്താൻ പോയിന്റുകളും റിസൾട്ടും ഹൈഡ് ചെയ്യാനുള്ള കൺട്രോളുകൾ.
              </p>
            </div>
          </div>
          {(db.settings?.hideTeamPoints || db.settings?.showResults === false || db.settings?.showHomeResultsAndSpotlight === false) && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 bg-amber-600 text-white animate-pulse">
              🔒 SUSPENSE ACTIVE
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Toggle 1: Results Page */}
          <div className="bg-white/80 border border-amber-300 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
            <div>
              <span className="block text-[11px] font-extrabold text-brand-green-950">
                1. Results Page
              </span>
              <span className="text-[9px] text-slate-600 font-medium">
                {db.settings?.showResults !== false ? '🟢 Results Live' : '🔒 Results Locked'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={db.settings?.showResults !== false}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  onUpdateDb({
                    ...db,
                    settings: {
                      ...db.settings,
                      showResults: enabled,
                    }
                  });
                }}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Toggle 2: Hide Team Points */}
          <div className="bg-white/80 border border-amber-300 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
            <div>
              <span className="block text-[11px] font-extrabold text-brand-green-950">
                2. Hide Team Points
              </span>
              <span className="text-[9px] text-slate-600 font-medium">
                {db.settings?.hideTeamPoints ? '🔒 Points Hidden' : '👁️ Points Visible'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={!!db.settings?.hideTeamPoints}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  onUpdateDb({
                    ...db,
                    settings: {
                      ...db.settings,
                      hideTeamPoints: enabled,
                    }
                  });
                }}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* Toggle 3: Main Screen Results */}
          <div className="bg-white/80 border border-amber-300 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
            <div>
              <span className="block text-[11px] font-extrabold text-brand-green-950">
                3. Home Results
              </span>
              <span className="text-[9px] text-slate-600 font-medium">
                {db.settings?.showHomeResultsAndSpotlight !== false ? '🟢 Home Results Shown' : '🔒 Home Results Hidden'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={db.settings?.showHomeResultsAndSpotlight !== false}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  onUpdateDb({
                    ...db,
                    settings: {
                      ...db.settings,
                      showHomeResultsAndSpotlight: enabled,
                    }
                  });
                }}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Live Quiz & Stage Contest Operations Center */}
      <AdminQuizManager db={db} onUpdateDb={onUpdateDb} />

      {/* Multi-Device Cloud Live Sync Broadcast Bar */}
      <div className="p-3.5 bg-gradient-to-r from-blue-600/15 via-indigo-600/10 to-sky-500/15 border-2 border-blue-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl shrink-0 shadow-xs">
            📲
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-xs text-blue-950 uppercase tracking-wide">
                Multi-Device Cloud Broadcast:
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 bg-blue-600 text-white flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                <span>🔥 LIVE ACROSS ALL PHONES</span>
              </span>
            </div>
            <span className="text-[11px] text-blue-900 block mt-0.5 font-medium">
              Click the button to immediately push the latest results, standings, and points across all user devices.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleBroadcastToAllDevices}
            disabled={cloudSyncLoading}
            className="w-full sm:w-auto py-2 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${cloudSyncLoading ? 'animate-spin' : ''}`} />
            <span>{cloudSyncLoading ? 'Syncing to Cloud...' : '⚡ Sync & Push to All Devices'}</span>
          </button>
        </div>
      </div>

      {cloudSyncStatusMsg && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn ${
          cloudSyncStatusMsg.type === 'success' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-red-100 text-red-900 border border-red-300'
        }`}>
          <span>{cloudSyncStatusMsg.text}</span>
          <button onClick={() => setCloudSyncStatusMsg(null)} className="p-0.5 hover:bg-black/10 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Google Sheets Live Sync Quick Bar */}
      <div className="p-3 bg-gradient-to-r from-emerald-500/15 via-teal-600/10 to-emerald-500/15 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2.5 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">📊</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-xs text-brand-green-950 uppercase tracking-wide">
                Google Sheets Live Sync:
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${sheetId ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-amber-950'}`}>
                {sheetId ? '🟢 CONNECTED' : '🟡 NOT CONNECTED'}
              </span>
              {autoSync && sheetId && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-bold rounded-full">
                  ⚡ Auto-Sync On
                </span>
              )}
            </div>
            <span className="text-[10px] text-brand-ink-soft block mt-0.5 truncate max-w-xs sm:max-w-md">
              {sheetId ? `Sheet ID: ${sheetId.slice(0, 16)}...` : 'Connect Google Sheet to auto-sync competition results in real-time.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {sheetId && (
            <>
              <a
                href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-1.5 px-2.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1 shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Sheet
              </a>

              <button
                onClick={handleQuickSheetSync}
                disabled={sheetsLoading}
                className="py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sheetsLoading ? 'animate-spin' : ''}`} />
                {sheetsLoading ? 'Syncing...' : 'Sync Now'}
              </button>
            </>
          )}

          <button
            onClick={() => setShowSheetsManager(!showSheetsManager)}
            className="py-1.5 px-3 bg-brand-green-900 hover:bg-brand-green-950 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5 shrink-0"
          >
            <span>⚙️</span> {showSheetsManager ? 'Close Setup' : 'Sheet Manager'}
          </button>
        </div>
      </div>

      {/* Google Sheets Quick Manager Collapsible Panel */}
      {showSheetsManager && (
        <div className="p-4 bg-emerald-50/90 border-2 border-emerald-400 rounded-2xl space-y-4 shadow-md animate-fadeIn">
          <div className="flex items-center justify-between border-b border-emerald-200 pb-2.5">
            <span className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
              <span>📊</span> Google Sheets Live Integration & Sync Manager
            </span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => handleToggleAutoSync(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                />
                Enable Auto-Sync
              </label>
              <button
                onClick={() => setShowSheetsManager(false)}
                className="p-1 hover:bg-emerald-200 rounded-lg text-emerald-900 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sync Method Selection Tabs */}
          <div className="grid grid-cols-2 gap-2 bg-emerald-100/70 p-1.5 rounded-xl">
            <button
              type="button"
              onClick={() => setSheetSyncMethod('webhook')}
              className={`py-2 px-3 rounded-lg font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                sheetSyncMethod === 'webhook'
                  ? 'bg-white text-emerald-950 shadow-sm border border-emerald-300'
                  : 'text-emerald-800 hover:text-emerald-950'
              }`}
            >
              <span>⚡</span> Apps Script Webhook
              <span className="px-1.5 py-0.2 bg-emerald-600 text-white text-[9px] rounded-full">Easy / No Login</span>
            </button>
            <button
              type="button"
              onClick={() => setSheetSyncMethod('oauth')}
              className={`py-2 px-3 rounded-lg font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                sheetSyncMethod === 'oauth'
                  ? 'bg-white text-emerald-950 shadow-sm border border-emerald-300'
                  : 'text-emerald-800 hover:text-emerald-950'
              }`}
            >
              <span>🔑</span> Google OAuth API
              <span className="px-1.5 py-0.2 bg-sky-600 text-white text-[9px] rounded-full">Sign-In</span>
            </button>
          </div>

          {/* Dismissible Status Message */}
          {sheetsStatusMsg && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-start justify-between gap-2 border ${
              sheetsStatusMsg.type === 'success' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-rose-100 text-rose-900 border-rose-300'
            }`}>
              <div className="flex items-start gap-2 min-w-0">
                <span className="shrink-0 mt-0.5">{sheetsStatusMsg.type === 'success' ? '✅' : '⚠️'}</span>
                <span className="break-words">{sheetsStatusMsg.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setSheetsStatusMsg(null)}
                className="p-1 hover:bg-black/10 rounded text-xs font-bold shrink-0 cursor-pointer"
                title="Dismiss message"
              >
                ✕
              </button>
            </div>
          )}

          {/* METHOD 1: Apps Script Webhook (Zero login / Domain restriction free) */}
          {sheetSyncMethod === 'webhook' && (
            <div className="space-y-3 bg-white p-3.5 border border-emerald-200 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-2">
                <div>
                  <h4 className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                    <span>⚡</span> Google Apps Script Web App Webhook
                  </h4>
                  <p className="text-[10px] text-brand-ink-soft">
                    Push and pull data directly to Google Sheets in real time with high concurrency LockService.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAppsScriptModal(true)}
                  className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[11px] rounded-lg border border-emerald-300 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>📜</span> View & Copy Script Code
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-emerald-900 block">
                  Google Apps Script Web App URL (<code className="text-emerald-700">https://script.google.com/macros/s/.../exec</code>)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={appsScriptUrl}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setAppsScriptUrl(val);
                      localStorage.setItem('mrms_apps_script_url', val);
                      onUpdateDb({
                        ...db,
                        settings: {
                          ...db.settings,
                          sheetWebhookUrl: val,
                          appsScriptUrl: val
                        }
                      });
                    }}
                    placeholder="Paste Apps Script Web App URL (https://script.google.com/macros/s/.../exec)"
                    className="flex-1 px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {appsScriptUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setAppsScriptUrl('');
                        localStorage.removeItem('mrms_apps_script_url');
                      }}
                      className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer"
                      title="Clear URL"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-100">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handlePushViaWebhook()}
                    disabled={sheetsLoading || !appsScriptUrl}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${sheetsLoading ? 'animate-spin' : ''}`} />
                    Push to Sheet via Webhook
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePullViaWebhook()}
                    disabled={sheetsLoading || !appsScriptUrl}
                    className="px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    📥 Pull Data from Sheet
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* METHOD 2: Google Sheets OAuth API */}
          {sheetSyncMethod === 'oauth' && (
            <div className="space-y-3 bg-white p-3.5 border border-emerald-200 rounded-xl">
              {/* Account Authentication status */}
              <div className="bg-emerald-50/70 p-3 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-brand-green-950">
                    {googleUserEmail ? `Connected Account: ${googleUserEmail}` : 'Google Account Login Status'}
                  </div>
                  <div className="text-[10px] text-brand-ink-soft">
                    {googleUserEmail ? 'OAuth authentication active for Google Sheets API' : 'Sign in with Google to authorize direct sheets updating'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleQuickSheetAuth}
                  disabled={sheetsLoading}
                  className="px-3 py-1.5 bg-brand-green-900 hover:bg-brand-green-950 text-white font-bold text-xs rounded-lg transition-all shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {googleUserEmail ? 'Re-Authenticate' : 'Sign In with Google'}
                </button>
              </div>

              {/* Sheet ID & Link Controls */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-emerald-900 block">Connected Google Sheet ID or Full URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sheetId}
                    onChange={(e) => {
                      let val = e.target.value.trim();
                      if (val.includes('/spreadsheets/d/')) {
                        const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                        if (match && match[1]) val = match[1];
                      }
                      setSheetIdState(val);
                      saveSheetId(val);
                    }}
                    placeholder="Paste Google Sheet ID or Full URL"
                    className="flex-1 px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleQuickCreateSheet}
                    disabled={sheetsLoading}
                    className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer transition-all shrink-0 disabled:opacity-50"
                  >
                    ➕ Create New Sheet
                  </button>
                </div>
              </div>

              {/* Push / Pull for OAuth */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-200">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleQuickSheetSync}
                    disabled={sheetsLoading || !sheetId}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${sheetsLoading ? 'animate-spin' : ''}`} />
                    Push to Google Sheet Now
                  </button>

                  <button
                    type="button"
                    onClick={handleQuickPullSheet}
                    disabled={sheetsLoading || !sheetId}
                    className="px-3 py-2 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    📥 Pull Data from Sheet
                  </button>
                </div>
              </div>

              {/* Authorized Domain Tip Box */}
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-900 leading-relaxed">
                <strong>💡 Note on 'auth/unauthorized-domain':</strong> If Google sign-in shows this error, add <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">{typeof window !== 'undefined' ? window.location.hostname : 'your domain'}</code> in Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains. Or switch to the <strong>Apps Script Webhook</strong> tab above to sync without any sign-in!
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={() => setShowSheetsManager(false)}
              className="px-4 py-1.5 border border-emerald-300 text-emerald-900 font-bold text-xs rounded-xl hover:bg-emerald-100 cursor-pointer"
            >
              Close Setup
            </button>
          </div>
        </div>
      )}

      {/* Google Apps Script Code Modal */}
      {showAppsScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-emerald-200 overflow-hidden">
            <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📜</span>
                <div>
                  <h3 className="font-extrabold text-sm">Google Apps Script Web App Code</h3>
                  <p className="text-[11px] text-emerald-200">Copy this code into your Google Sheet &gt; Extensions &gt; Apps Script</p>
                </div>
              </div>
              <button
                onClick={() => setShowAppsScriptModal(false)}
                className="p-1.5 hover:bg-emerald-700 rounded-lg text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs text-brand-green-950">
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 space-y-1.5">
                <h4 className="font-bold text-emerald-900">📋 Setup Instructions (Simple 3 Steps):</h4>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-emerald-800">
                  <li>Open your Google Sheet and click <strong>Extensions &gt; Apps Script</strong> from the top menu.</li>
                  <li>Replace the existing code with the script below and click <strong>Save (💾)</strong>.</li>
                  <li>Click <strong>Deploy &gt; New deployment</strong> in the top right corner.
                    <ul className="list-disc list-inside ml-4 mt-0.5 text-emerald-700">
                      <li>Type: <strong>Web app</strong></li>
                      <li>Execute as: <strong>Me</strong></li>
                      <li>Who has access: <strong>Anyone</strong> (Critical for seamless live syncing)</li>
                    </ul>
                  </li>
                  <li>Copy the resulting <strong>Web app URL</strong> and paste it into the Webhook field below.</li>
                </ol>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900">Google Apps Script Code:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const code = `function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var postData = "";
    if (e && e.postData && e.postData.contents) {
      postData = e.postData.contents;
    }
    
    var req = {};
    if (postData) {
      try { req = JSON.parse(postData); } catch(err) {}
    }
    
    var action = (e && e.parameter && e.parameter.action) || req.action || "read";
    
    if (action === "write") {
      var db = req.db || req;
      var dataSheet = ss.getSheetByName("FEST_PORTAL_DATA");
      if (!dataSheet) {
        dataSheet = ss.insertSheet("FEST_PORTAL_DATA");
      }
      dataSheet.clear();
      var jsonStr = JSON.stringify(db);
      var chunkSize = 40000;
      var chunks = [];
      for (var i = 0; i < jsonStr.length; i += chunkSize) {
        chunks.push([jsonStr.substring(i, i + chunkSize)]);
      }
      dataSheet.getRange(1, 1, chunks.length, 1).setValues(chunks);
      
      // Update Scoreboard Sheet if teams exist
      if (db.teams && Array.isArray(db.teams)) {
        var scoreSheet = ss.getSheetByName("Scoreboard");
        if (!scoreSheet) scoreSheet = ss.insertSheet("Scoreboard");
        scoreSheet.clear();
        scoreSheet.appendRow(["Rank", "Team Name", "Symbol", "Total Points"]);
        var sortedTeams = db.teams.slice().sort(function(a, b) { return (b.points || 0) - (a.points || 0); });
        for (var t = 0; t < sortedTeams.length; t++) {
          scoreSheet.appendRow([t + 1, sortedTeams[t].name, sortedTeams[t].symbol || "", sortedTeams[t].points || 0]);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Data saved successfully" }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      // READ ACTION
      var dataSheet = ss.getSheetByName("FEST_PORTAL_DATA");
      if (!dataSheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: "empty", db: null }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var values = dataSheet.getDataRange().getValues();
      var jsonStr = "";
      for (var r = 0; r < values.length; r++) {
        jsonStr += values[r][0];
      }
      if (!jsonStr) {
        return ContentService.createTextOutput(JSON.stringify({ status: "empty", db: null }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var db = JSON.parse(jsonStr);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", db: db }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`;
                      navigator.clipboard.writeText(code);
                      setCopiedScriptCode(true);
                      setTimeout(() => setCopiedScriptCode(false), 3000);
                    }}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedScriptCode ? 'Copied to Clipboard!' : 'Copy Code'}
                  </button>
                </div>
                <pre className="p-3 bg-gray-900 text-emerald-300 font-mono text-[10px] rounded-xl overflow-x-auto max-h-60 leading-relaxed border border-gray-800">
{`function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var postData = "";
    if (e && e.postData && e.postData.contents) {
      postData = e.postData.contents;
    }
    
    var req = {};
    if (postData) {
      try { req = JSON.parse(postData); } catch(err) {}
    }
    
    var action = (e && e.parameter && e.parameter.action) || req.action || "read";
    
    if (action === "write") {
      var db = req.db || req;
      var dataSheet = ss.getSheetByName("FEST_PORTAL_DATA");
      if (!dataSheet) {
        dataSheet = ss.insertSheet("FEST_PORTAL_DATA");
      }
      dataSheet.clear();
      var jsonStr = JSON.stringify(db);
      var chunkSize = 40000;
      var chunks = [];
      for (var i = 0; i < jsonStr.length; i += chunkSize) {
        chunks.push([jsonStr.substring(i, i + chunkSize)]);
      }
      dataSheet.getRange(1, 1, chunks.length, 1).setValues(chunks);
      
      // Update Scoreboard Sheet if teams exist
      if (db.teams && Array.isArray(db.teams)) {
        var scoreSheet = ss.getSheetByName("Scoreboard");
        if (!scoreSheet) scoreSheet = ss.insertSheet("Scoreboard");
        scoreSheet.clear();
        scoreSheet.appendRow(["Rank", "Team Name", "Symbol", "Total Points"]);
        var sortedTeams = db.teams.slice().sort(function(a, b) { return (b.points || 0) - (a.points || 0); });
        for (var t = 0; t < sortedTeams.length; t++) {
          scoreSheet.appendRow([t + 1, sortedTeams[t].name, sortedTeams[t].symbol || "", sortedTeams[t].points || 0]);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Data saved successfully" }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      // READ ACTION
      var dataSheet = ss.getSheetByName("FEST_PORTAL_DATA");
      if (!dataSheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: "empty", db: null }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var values = dataSheet.getDataRange().getValues();
      var jsonStr = "";
      for (var r = 0; r < values.length; r++) {
        jsonStr += values[r][0];
      }
      if (!jsonStr) {
        return ContentService.createTextOutput(JSON.stringify({ status: "empty", db: null }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var db = JSON.parse(jsonStr);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", db: db }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`}
                </pre>
              </div>
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAppsScriptModal(false)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      )}

      {/* ==================== CATEGORY 2: CORE DATA & PROGRAM MANAGEMENT ==================== */}
      {adminMode === 'management' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Duplicate Health Audit Bar */}
          <div className={`p-3.5 rounded-2xl border transition-all shadow-sm ${
            duplicateReport.totalIssueCount > 0 
              ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 text-amber-950' 
              : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 text-emerald-950'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  duplicateReport.totalIssueCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {duplicateReport.totalIssueCount > 0 ? (
                    <AlertTriangle className="w-5 h-5 animate-bounce text-amber-600" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-xs sm:text-sm tracking-tight">
                      {duplicateReport.totalIssueCount > 0
                        ? `⚠️ ${duplicateReport.totalIssueCount} Duplicate Issues Detected`
                        : '✅ No Duplicates Found (All Data Clean & Unique)'}
                    </span>
                    {duplicateReport.totalIssueCount > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-black bg-amber-600 text-white rounded-full animate-pulse">
                        {duplicateReport.totalIssueCount} Conflicts
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-brand-ink-soft mt-0.5 leading-tight">
                    {duplicateReport.totalIssueCount > 0
                      ? 'System is ready to inspect and auto-clean duplicate program codes, names, or double chest numbers.'
                      : 'All program codes, names, and chest numbers are unique.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                {duplicateReport.totalIssueCount > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoFixAllDuplicates}
                    className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-extrabold rounded-xl shadow cursor-pointer transition-transform active:scale-95 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> ⚡ Auto-Clean All
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDuplicateModal(true)}
                  className="px-3 py-2 bg-white border border-brand-line hover:border-brand-gold-500 text-brand-green-950 text-xs font-bold rounded-xl shadow-2xs cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-brand-gold-600" />
                  {duplicateReport.totalIssueCount > 0 ? '🔍 View Duplicates' : '🔍 Duplicate Inspector'}
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
      <div className="flex border-b border-brand-line select-none" id="adminTabs">
        {[
          { tab: 'teams', label: 'Teams', icon: Flag },
          { tab: 'programs', label: 'Programs', icon: Calendar },
          { tab: 'participants', label: 'Candidates', icon: Users },
          { tab: 'results', label: 'Results', icon: Trophy },
          { tab: 'schedules', label: 'Time, Date & Stage', icon: Clock },
        ].map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => setActiveTab(item.tab as any)}
              className={`flex-1 py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                isActive
                  ? 'border-brand-gold-500 text-brand-green-800 bg-brand-gold-500/5'
                  : 'border-transparent text-brand-ink-soft hover:text-brand-green-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {item.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {/* Teams List */}
        {activeTab === 'teams' && (
          db.teams.length === 0 ? (
            <div className="p-10 bg-brand-panel border border-brand-line rounded-2xl text-center text-brand-ink-soft text-xs">
              No teams found. Tap Add Record to add a team.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Overall Teams Candidate Breakdown Header */}
              <div className="p-3 bg-brand-panel border border-brand-line rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-brand-green-950 shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <span>🛡️ Teams Total Candidates:</span>
                  <span className="font-mono bg-brand-green-800 text-brand-gold-300 px-2 py-0.5 rounded-md text-[11px]">
                    {db.participants.length} Candidates
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 bg-sky-100 text-sky-900 border border-sky-200 rounded-md">
                    👦 Boys: <b>{db.participants.filter(p => p.gender === 'Boys').length}</b>
                  </span>
                  <span className="px-2 py-0.5 bg-pink-100 text-pink-900 border border-pink-200 rounded-md">
                    👧 Girls: <b>{db.participants.filter(p => p.gender === 'Girls').length}</b>
                  </span>
                  {db.participants.some(p => p.gender === 'General' || (!p.gender || (p.gender !== 'Boys' && p.gender !== 'Girls'))) && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-md">
                      👥 General: <b>{db.participants.filter(p => p.gender === 'General' || (!p.gender || (p.gender !== 'Boys' && p.gender !== 'Girls'))).length}</b>
                    </span>
                  )}
                </div>
              </div>

              {db.teams.map(t => {
                const teamParts = db.participants.filter(p => p.teamId === t.id);
                const boysCount = teamParts.filter(p => p.gender === 'Boys').length;
                const girlsCount = teamParts.filter(p => p.gender === 'Girls').length;
                const genCount = teamParts.filter(p => p.gender === 'General' || (!p.gender || (p.gender !== 'Boys' && p.gender !== 'Girls'))).length;

                return (
                  <div key={t.id} className="p-3.5 bg-brand-panel border border-brand-line rounded-xl shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3.5 h-8 rounded-full shrink-0 shadow-2xs border border-black/10" style={{ backgroundColor: t.color }} title={`Color: ${t.color}`} />
                        <div>
                          <b className="text-xs md:text-sm text-brand-ink font-semibold flex items-center gap-1.5">
                            <span className="text-lg">{t.symbol}</span> {t.name}
                          </b>
                          <small className="block text-[10px] text-brand-ink-soft mt-0.5 font-sans leading-relaxed">
                            {t.boysCaptain || t.boysCaptain2 || t.girlsCaptain || t.girlsCaptain2 ? (
                              <>
                                {t.captain && <span className="mr-2">General: <b>{t.captain}</b></span>}
                                {t.boysCaptain && <span className="mr-2">👦 Boy L1: <b>{t.boysCaptain}</b></span>}
                                {t.boysCaptain2 && <span className="mr-2">👦 Boy L2: <b>{t.boysCaptain2}</b></span>}
                                {t.girlsCaptain && <span className="mr-2">👧 Girl L1: <b>{t.girlsCaptain}</b></span>}
                                {t.girlsCaptain2 && <span className="mr-2">👧 Girl L2: <b>{t.girlsCaptain2}</b></span>}
                              </>
                            ) : (
                              <span>Captain: {t.captain || 'None'}</span>
                            )}
                            <span className="ml-2 font-mono font-bold text-brand-green-800">&bull; {t.points} PTS</span>
                          </small>
                        </div>
                      </div>

                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => handleOpenTeam(t.id)} className="p-2 bg-brand-bg rounded-lg hover:bg-brand-line/50 transition-colors text-brand-green-800 cursor-pointer">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if (deleteArmId === t.id) {
                              handleDeleteTeam(t.id);
                              setDeleteArmId(null);
                            } else {
                              armDelete(t.id);
                            }
                          }} 
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            deleteArmId === t.id ? 'bg-red-500 text-white animate-pulse' : 'bg-brand-bg text-rose-600 hover:bg-rose-50'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Candidate Gender Breakdown Badges */}
                    <div className="pt-1.5 border-t border-brand-line/60 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="text-brand-ink-soft font-semibold mr-1">👥 Candidates:</span>
                      <span className="bg-sky-50 text-sky-900 border border-sky-200/80 px-2.5 py-0.5 rounded-lg font-bold flex items-center gap-1">
                        👦 {boysCount} Boys
                      </span>
                      <span className="bg-pink-50 text-pink-900 border border-pink-200/80 px-2.5 py-0.5 rounded-lg font-bold flex items-center gap-1">
                        👧 {girlsCount} Girls
                      </span>
                      {genCount > 0 && (
                        <span className="bg-emerald-50 text-emerald-900 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg font-bold flex items-center gap-1">
                          👥 {genCount} General
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[10px] text-brand-green-900 font-bold bg-brand-gold-100/80 border border-brand-gold-300 px-2 py-0.5 rounded-md">
                        Total {teamParts.length} Candidates
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Programs List */}
        {activeTab === 'programs' && (
          <div className="space-y-3">
            {/* Program Counts Overview Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 bg-brand-panel border border-brand-line rounded-xl flex items-center gap-2 shadow-2xs">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">🌐</span>
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-brand-ink-soft uppercase block truncate">All Programs</span>
                  <span className="text-sm font-extrabold text-brand-green-900 leading-none">{db.programs.length}</span>
                </div>
              </div>
              <div className="p-2.5 bg-brand-panel border border-brand-line rounded-xl flex items-center gap-2 shadow-2xs">
                <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs shrink-0">🎭</span>
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-brand-ink-soft uppercase block truncate">Main Stage</span>
                  <span className="text-sm font-extrabold text-brand-green-900 leading-none">
                    {db.programs.filter(p => (p.stageType || 'Main Stage') === 'Main Stage').length}
                  </span>
                </div>
              </div>
              <div className="p-2.5 bg-brand-panel border border-brand-line rounded-xl flex items-center gap-2 shadow-2xs">
                <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">📝</span>
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-brand-ink-soft uppercase block truncate">Off Stage</span>
                  <span className="text-sm font-extrabold text-brand-green-900 leading-none">
                    {db.programs.filter(p => p.stageType === 'Offstage').length}
                  </span>
                </div>
              </div>
              <div className="p-2.5 bg-brand-panel border border-brand-line rounded-xl flex items-center gap-2 shadow-2xs">
                <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs shrink-0">🌟</span>
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-brand-ink-soft uppercase block truncate">General</span>
                  <span className="text-sm font-extrabold text-brand-green-900 leading-none">
                    {db.programs.filter(p => !p.categories || p.categories.length === 0 || p.categories.some(c => c.gender === 'General' || c.age === 'General' || c.age === 'All')).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Bar for Programs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Excel Import */}
              <div className="p-3 bg-brand-panel border border-brand-line rounded-xl flex items-center justify-between gap-2 shadow-sm">
                <div className="min-w-0">
                  <span className="font-bold text-brand-green-900 text-xs flex items-center gap-1 truncate">
                    <span>📊</span> Excel Bulk Import &amp; Template
                  </span>
                  <span className="text-[10px] text-brand-ink-soft block truncate">
                    Import program codes &amp; details
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleProgramExcelTemplate}
                    className="py-1 px-2.5 bg-transparent border border-brand-green-700 text-brand-green-800 font-semibold text-[10px] rounded-lg hover:bg-brand-green-50 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> Template
                  </button>
                  <label className="py-1 px-2.5 bg-brand-green-800 hover:bg-brand-green-700 text-white font-bold text-[10px] rounded-lg shadow-sm transition-colors flex items-center gap-1 cursor-pointer">
                    <Upload className="w-3 h-3 text-brand-gold-400" /> Upload
                    <input 
                      type="file" 
                      accept=".xlsx,.xls" 
                      onChange={handleProgramExcelUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              {/* Excel Export Program Sheet */}
              <div className="p-3 bg-brand-panel border border-brand-line rounded-xl flex items-center justify-between gap-2 shadow-sm">
                <div className="min-w-0">
                  <span className="font-bold text-brand-green-900 text-xs flex items-center gap-1 truncate">
                    <span>📑</span> Export Program Excel Sheet
                  </span>
                  <span className="text-[10px] text-brand-ink-soft block truncate">
                    Download complete program sheet (.xlsx)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleExportProgramExcel}
                    className="py-1 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] rounded-lg shadow-sm transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-emerald-200" /> Download Sheet (.xlsx)
                  </button>
                </div>
              </div>
            </div>

            {/* Program Search & Filter Bar */}
            <div className="p-3 bg-brand-bg/80 border border-brand-line/80 rounded-xl space-y-2.5 shadow-2xs">
              <div className="flex flex-col md:flex-row items-center gap-2 justify-between">
                {/* Search Input */}
                <div className="relative w-full md:w-80">
                  <Search className="w-3.5 h-3.5 text-brand-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={programSearchQuery}
                    onChange={(e) => setProgramSearchQuery(e.target.value)}
                    placeholder="🔍 Search program by code, name, stage, venue..."
                    className="w-full pl-8 pr-8 py-1.5 bg-white border border-brand-line rounded-lg text-xs font-medium text-brand-ink placeholder:text-brand-ink-soft/60 focus:outline-none focus:border-brand-gold-500 shadow-xs"
                  />
                  {programSearchQuery && (
                    <button
                      onClick={() => setProgramSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                  <select
                    value={programStageFilter}
                    onChange={(e) => setProgramStageFilter(e.target.value as any)}
                    className="px-2.5 py-1 bg-white border border-brand-line rounded-lg text-xs font-bold text-brand-green-950 focus:outline-none shadow-2xs cursor-pointer"
                  >
                    <option value="all">🎭 All Stages</option>
                    <option value="Main Stage">✨ Main Stage</option>
                    <option value="Offstage">📝 Offstage</option>
                  </select>

                  <select
                    value={programCategoryFilter}
                    onChange={(e) => setProgramCategoryFilter(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-brand-line rounded-lg text-xs font-bold text-brand-green-950 focus:outline-none shadow-2xs cursor-pointer"
                  >
                    <option value="all">🏷️ All Groups</option>
                    <option value="Kids">👶 Kids</option>
                    <option value="Sub Junior">👦 Sub Junior</option>
                    <option value="Junior">🧑 Junior</option>
                    <option value="Senior">🎓 Senior</option>
                    <option value="Super Senior">👑 Super Senior</option>
                    <option value="General">🌟 General</option>
                  </select>

                  <select
                    value={programSortBy}
                    onChange={(e) => setProgramSortBy(e.target.value as any)}
                    className="px-2.5 py-1 bg-white border border-brand-line rounded-lg text-xs font-bold text-brand-green-950 focus:outline-none shadow-2xs cursor-pointer"
                  >
                    <option value="code">🔢 Sort Code</option>
                    <option value="name">🔤 Name (A-Z)</option>
                    <option value="stage">📍 Stage / Venue</option>
                    <option value="time">⏰ Day & Time</option>
                  </select>
                </div>
              </div>
            </div>

            {db.programs.length === 0 ? (
              <div className="p-10 bg-brand-panel border border-brand-line rounded-2xl text-center text-brand-ink-soft text-xs">
                No competition programs found. Add programs using "+ Add Record" or "Upload Excel".
              </div>
            ) : (
              (() => {
                const filteredProgs = db.programs
                  .filter(p => {
                    if (programSearchQuery.trim()) {
                      const q = programSearchQuery.toLowerCase().trim();
                      const matchCode = p.code.toLowerCase().includes(q);
                      const matchName = p.name.toLowerCase().includes(q);
                      const matchVenue = (p.venue || '').toLowerCase().includes(q);
                      const matchDay = (p.day || '').toLowerCase().includes(q);
                      const matchSchedule = (p.schedule || '').toLowerCase().includes(q);
                      const matchCat = p.categories.some(c => 
                        c.gender.toLowerCase().includes(q) || c.age.toLowerCase().includes(q)
                      );
                      if (!matchCode && !matchName && !matchVenue && !matchDay && !matchSchedule && !matchCat) {
                        return false;
                      }
                    }

                    if (programStageFilter !== 'all') {
                      const pStage = p.stageType || 'Main Stage';
                      if (pStage !== programStageFilter) return false;
                    }

                    if (programCategoryFilter !== 'all') {
                      if (programCategoryFilter === 'General') {
                        const isGen = !p.categories || p.categories.length === 0 || p.categories.some(c => c.gender === 'General' || c.age === 'General' || c.age === 'All');
                        if (!isGen) return false;
                      } else {
                        const matchAge = p.categories.some(c => c.age === programCategoryFilter || c.age === 'All');
                        if (!matchAge) return false;
                      }
                    }

                    return true;
                  })
                  .sort((a, b) => {
                    if (programSortBy === 'name') {
                      return a.name.localeCompare(b.name);
                    } else if (programSortBy === 'stage') {
                      const sA = (a.stageType || '') + (a.venue || '');
                      const sB = (b.stageType || '') + (b.venue || '');
                      return sA.localeCompare(sB);
                    } else if (programSortBy === 'time') {
                      const tA = (a.day || '') + (a.startTime || '');
                      const tB = (b.day || '') + (b.startTime || '');
                      return tA.localeCompare(tB);
                    } else {
                      return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
                    }
                  });

                if (filteredProgs.length === 0) {
                  return (
                    <div className="p-8 bg-brand-panel border border-brand-line rounded-xl text-center text-brand-ink-soft text-xs">
                      🔍 No programs match your search &quot;{programSearchQuery}&quot; or selected filters.
                    </div>
                  );
                }

                return filteredProgs.map(p => (
                  <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-brand-panel border border-brand-line rounded-xl shadow-sm gap-2">
                    <div className="min-w-0 flex-1 pr-2">
                      <b className="text-xs md:text-sm text-brand-ink font-semibold flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[9px] bg-brand-green-100 text-brand-green-800 px-1.5 py-0.5 rounded">{p.code}</span>
                        {p.stageType === 'Offstage' ? (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold font-sans">📝 Offstage</span>
                        ) : (
                          <span className="text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold font-sans">🎭 Main Stage</span>
                        )}
                        <span className="truncate">{p.name}</span>
                      </b>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {p.categories.map((c, idx) => {
                          const isBoys = c.gender === 'Boys';
                          const isGirls = c.gender === 'Girls';
                          const bgClass = isBoys 
                            ? 'bg-sky-100 text-sky-950 border-sky-300' 
                            : isGirls 
                              ? 'bg-pink-100 text-pink-950 border-pink-300' 
                              : 'bg-purple-100 text-purple-950 border-purple-300';
                          return (
                            <span key={idx} className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${bgClass}`}>
                              {isBoys ? '👦' : isGirls ? '👧' : '🌐'} {c.gender} {c.age !== 'All' ? `• ${c.age}` : ''}
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] font-medium text-brand-green-900 bg-brand-bg/60 p-1.5 rounded-lg border border-brand-line/50">
                        <span>🗓️ <b>{p.day || 'Day 1'}</b></span>
                        <span>&bull;</span>
                        <span>⏰ <b>{p.startTime ? `${p.startTime}${p.endTime ? ' - ' + p.endTime : ''}` : 'Time Pending'}</b></span>
                        <span>&bull;</span>
                        <span>📍 Stage: <b>{p.venue || 'Unassigned'}</b></span>
                        {p.schedule && (
                          <>
                            <span>&bull;</span>
                            <span className="text-brand-gold-700 italic">({p.schedule})</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center pt-1 sm:pt-0">
                      <button 
                        onClick={() => handleOpenProgram(p.id)}
                        className="px-2 py-1.5 bg-brand-gold-100 hover:bg-brand-gold-200 text-brand-green-950 text-[10px] font-bold rounded-lg cursor-pointer flex items-center gap-1"
                        title="Edit Schedule & Time"
                      >
                        ⏰ Time
                      </button>
                      <button 
                        onClick={() => onAddResultDirectly(p.id)}
                        className="px-2.5 py-1.5 bg-brand-green-100 text-brand-green-800 text-[10px] font-bold rounded-lg hover:bg-brand-green-200 cursor-pointer flex items-center gap-0.5"
                        title="Quick enter result"
                      >
                        🏅 Result
                      </button>
                      <button onClick={() => handleOpenProgram(p.id)} className="p-1.5 bg-brand-bg rounded-lg hover:bg-brand-line/50 transition-colors text-brand-green-800 cursor-pointer" title="Edit Program">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => {
                          if (deleteArmId === p.id) {
                            handleDeleteProgram(p.id);
                            setDeleteArmId(null);
                          } else {
                            armDelete(p.id);
                          }
                        }} 
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          deleteArmId === p.id ? 'bg-red-500 text-white animate-pulse' : 'bg-brand-bg text-rose-600 hover:bg-rose-50'
                        }`}
                        title="Delete Program"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
        )}

        {/* Participants List */}
        {activeTab === 'participants' && (
          <div className="space-y-3">
            {/* Quick Bulk Excel Candidate Import & Auto Re-Number Card */}
            <div className="p-3 bg-brand-panel border border-brand-line rounded-xl flex items-center justify-between gap-2 flex-wrap shadow-xs">
              <div className="text-xs text-brand-ink font-semibold flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Bulk Candidate Import &amp; Re-Numbering</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowMatrixModal(true)}
                  className="px-3 py-1 bg-gradient-to-r from-teal-700 to-emerald-900 hover:from-teal-800 hover:to-emerald-950 text-white text-[11px] font-extrabold rounded-lg shadow-xs cursor-pointer flex items-center gap-1 transition-all border border-emerald-600/40"
                  title="Generate Team Leader Program Grid Checklist (matching reference grid sheet with tick boxes)"
                >
                  <span>📋</span> Team Matrix Grid Checklist
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportModal(true)}
                  className="px-3 py-1 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white text-[11px] font-extrabold rounded-lg shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                  title="Export candidates to Excel with Team and Gender filters & separate sheets"
                >
                  <Download className="w-3.5 h-3.5" /> Export Candidates Excel
                </button>
                <button
                  type="button"
                  onClick={handleDeduplicateCandidates}
                  className="px-3 py-1 bg-gradient-to-r from-rose-700 to-red-800 hover:from-rose-800 hover:to-red-900 text-white text-[11px] font-extrabold rounded-lg shadow-xs cursor-pointer flex items-center gap-1 transition-all border border-rose-600/40"
                  title="Remove duplicate candidates with identical chest number or name and merge their registered programs"
                >
                  <span>🧹</span> Clean Duplicates
                </button>
                <button
                  type="button"
                  onClick={() => setShowRenumberModal(true)}
                  className="px-3 py-1 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-[11px] font-extrabold rounded-lg shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                  title="Auto re-assign chest numbers sequentially by group or team"
                >
                  <span>🔢</span> Auto Re-Number Chest Numbers
                </button>
                <button
                  type="button"
                  onClick={handleParticipantExcelTemplate}
                  className="px-2.5 py-1 bg-brand-bg hover:bg-brand-line/50 text-brand-green-900 border border-brand-line text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3 h-3 text-emerald-600" /> Template
                </button>
                <label className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1 shadow-xs">
                  <Upload className="w-3 h-3" /> Upload Excel File
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleParticipantExcelUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Unassigned Candidates Quick Alert Banner (Admin & Committee Only) */}
            {(() => {
              const zeroProgCandidates = db.participants.filter(p => !p.programIds || p.programIds.length === 0);
              const zeroProgCount = zeroProgCandidates.length;
              if (zeroProgCount === 0) return null;

              const boysZero = zeroProgCandidates.filter(p => p.gender === 'Boys').length;
              const girlsZero = zeroProgCandidates.filter(p => p.gender === 'Girls').length;

              return (
                <div className="p-4 bg-gradient-to-r from-amber-500/20 via-amber-100 to-amber-500/10 border-2 border-amber-400/90 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl">⚠️</span>
                      <h4 className="text-xs md:text-sm font-black text-amber-950 uppercase tracking-wide">
                        Admin Notice: {zeroProgCount} Candidates have zero assigned programs!
                      </h4>
                      <span className="text-[10px] bg-amber-800 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Admin Committee Only
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 font-medium leading-relaxed">
                      Unassigned candidates across categories (Kids, Sub Junior, Junior, Senior, Super Senior):
                      <b className="ml-1 text-sky-900 font-bold">👦 Boys: {boysZero}</b> &bull; <b className="text-pink-900 font-bold">👧 Girls: {girlsZero}</b>. Click below to assign events to them.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setParticipantProgramFilter('zero')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer flex items-center gap-1.5 ${
                        participantProgramFilter === 'zero'
                          ? 'bg-amber-800 text-white ring-2 ring-amber-400 animate-pulse'
                          : 'bg-amber-700 hover:bg-amber-800 text-white'
                      }`}
                    >
                      🔍 View 0-Program Candidates ({zeroProgCount})
                    </button>
                    {participantProgramFilter === 'zero' && (
                      <button
                        onClick={() => setParticipantProgramFilter('all')}
                        className="px-3 py-2 bg-white border border-amber-300 text-amber-900 rounded-xl text-xs font-bold hover:bg-amber-50 cursor-pointer"
                      >
                        Show All Candidates
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Candidate Search & Multi-Filter Bar */}
            <div className="p-3 bg-brand-bg/80 border border-brand-line/80 rounded-xl space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 items-center">
                {/* Search Query Input */}
                <div className="relative md:col-span-2">
                  <Search className="w-3.5 h-3.5 text-brand-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={participantSearchQuery}
                    onChange={(e) => setParticipantSearchQuery(e.target.value)}
                    placeholder="Search name, chest #, team..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-brand-line rounded-lg text-xs focus:outline-none"
                  />
                  {participantSearchQuery && (
                    <button
                      onClick={() => setParticipantSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Team Filter */}
                <select
                  value={participantTeamFilter}
                  onChange={(e) => setParticipantTeamFilter(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-brand-line rounded-lg text-xs font-bold text-brand-green-950 focus:outline-none"
                >
                  <option value="all">🛡️ All Teams ({db.teams.length})</option>
                  {db.teams.map(t => (
                    <option key={t.id} value={t.id}>{t.symbol} {t.name}</option>
                  ))}
                </select>

                {/* Age Category Filter */}
                <select
                  value={participantCategoryFilter}
                  onChange={(e) => setParticipantCategoryFilter(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-brand-line rounded-lg text-xs font-bold text-brand-green-950 focus:outline-none"
                >
                  <option value="all">🎓 All Age Categories</option>
                  <option value="Kids">🧒 Kids (Class 1-2)</option>
                  <option value="Sub Junior">👦 Sub Junior (Class 3-4)</option>
                  <option value="Junior">👨‍🎓 Junior (Class 5-6)</option>
                  <option value="Senior">🎓 Senior (Class 7-8)</option>
                  <option value="Super Senior">🏆 Super Senior (Class 9-12)</option>
                </select>

                {/* Program Status Filter */}
                <select
                  value={participantProgramFilter}
                  onChange={(e) => setParticipantProgramFilter(e.target.value as any)}
                  className={`px-2 py-1.5 border rounded-lg text-xs font-bold focus:outline-none ${
                    participantProgramFilter === 'zero' 
                      ? 'bg-amber-100 border-amber-400 text-amber-950' 
                      : 'bg-white border-brand-line text-brand-green-950'
                  }`}
                >
                  <option value="all">📋 All Enrollment ({db.participants.length})</option>
                  <option value="zero">⚠️ Unassigned (0 Programs)</option>
                  <option value="enrolled">✅ Enrolled (1+ Programs)</option>
                </select>

                {/* Sort Order Dropdown */}
                <select
                  value={participantSortBy}
                  onChange={(e) => setParticipantSortBy(e.target.value as any)}
                  className="px-2 py-1.5 bg-white border border-brand-line rounded-lg text-xs font-bold text-brand-green-950 focus:outline-none"
                >
                  <option value="group">🏷️ Sort Group</option>
                  <option value="chest">🔢 Sort Chest #</option>
                  <option value="team">🛡️ Sort Team</option>
                  <option value="name">🔤 Sort Name (A-Z)</option>
                </select>
              </div>

              {/* Gender & Active Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-line/60 pt-2 text-[11px] text-brand-ink-soft">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Gender Section:</span>
                  <button
                    onClick={() => setParticipantGenderFilter('all')}
                    className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                      participantGenderFilter === 'all' ? 'bg-brand-green-800 text-white' : 'bg-white border border-brand-line'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setParticipantGenderFilter('Boys')}
                    className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                      participantGenderFilter === 'Boys' ? 'bg-sky-700 text-white' : 'bg-sky-50 text-sky-800 border border-sky-200'
                    }`}
                  >
                    👦 Boys
                  </button>
                  <button
                    onClick={() => setParticipantGenderFilter('Girls')}
                    className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                      participantGenderFilter === 'Girls' ? 'bg-pink-700 text-white' : 'bg-pink-50 text-pink-800 border border-pink-200'
                    }`}
                  >
                    👧 Girls
                  </button>
                </div>

                {(participantSearchQuery || participantTeamFilter !== 'all' || participantGenderFilter !== 'all' || participantProgramFilter !== 'all' || participantCategoryFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setParticipantSearchQuery('');
                      setParticipantTeamFilter('all');
                      setParticipantGenderFilter('all');
                      setParticipantCategoryFilter('all');
                      setParticipantProgramFilter('all');
                    }}
                    className="text-amber-800 hover:underline font-extrabold cursor-pointer text-[10px]"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>

            {db.participants.length === 0 ? (
              <div className="p-10 bg-brand-panel border border-brand-line rounded-2xl text-center text-brand-ink-soft text-xs">
                No candidates populated. Import from Excel or Add a participant.
              </div>
            ) : (
              (() => {
                const groupOrderMap: Record<string, number> = {
                  'Kids': 1,
                  'Sub Junior': 2,
                  'Junior': 3,
                  'Senior': 4,
                  'Super Senior': 5,
                };
                const processed = db.participants
                  .filter(pa => {
                    // Search Query Filter
                    if (participantSearchQuery.trim()) {
                      const q = participantSearchQuery.toLowerCase().trim();
                      const matchName = pa.name.toLowerCase().includes(q);
                      const matchNum = (pa.number || '').toLowerCase().includes(q);
                      const matchClass = (pa.cls || '').toLowerCase().includes(q);
                      const teamName = db.teams.find(t => t.id === pa.teamId)?.name || '';
                      const matchTeam = teamName.toLowerCase().includes(q);
                      if (!matchName && !matchNum && !matchClass && !matchTeam) return false;
                    }

                    // Team Filter
                    if (participantTeamFilter !== 'all' && pa.teamId !== participantTeamFilter) return false;

                    // Age Category Filter
                    const candAge = classToAge(pa.cls);
                    if (participantCategoryFilter !== 'all' && candAge !== participantCategoryFilter && pa.age !== participantCategoryFilter) return false;

                    // Gender Filter
                    if (participantGenderFilter !== 'all' && pa.gender !== participantGenderFilter) return false;

                    // Program Enrollment Status Filter
                    const hasZeroProgs = !pa.programIds || pa.programIds.length === 0;
                    if (participantProgramFilter === 'zero' && !hasZeroProgs) return false;
                    if (participantProgramFilter === 'enrolled' && hasZeroProgs) return false;

                    return true;
                  })
                  .sort((a, b) => {
                    if (participantSortBy === 'group') {
                      const gA = groupOrderMap[classToAge(a.cls)] || 99;
                      const gB = groupOrderMap[classToAge(b.cls)] || 99;
                      if (gA !== gB) return gA - gB;
                      const teamA = db.teams.find(t => t.id === a.teamId)?.name || '';
                      const teamB = db.teams.find(t => t.id === b.teamId)?.name || '';
                      if (teamA !== teamB) return teamA.localeCompare(teamB);
                      return a.name.localeCompare(b.name);
                    } else if (participantSortBy === 'chest') {
                      const nA = parseInt(a.number, 10) || 0;
                      const nB = parseInt(b.number, 10) || 0;
                      if (nA !== nB) return nA - nB;
                      return a.number.localeCompare(b.number);
                    } else if (participantSortBy === 'team') {
                      const teamA = db.teams.find(t => t.id === a.teamId)?.name || '';
                      const teamB = db.teams.find(t => t.id === b.teamId)?.name || '';
                      if (teamA !== teamB) return teamA.localeCompare(teamB);
                      return a.name.localeCompare(b.name);
                    } else {
                      return a.name.localeCompare(b.name);
                    }
                  });

                if (processed.length === 0) {
                  return (
                    <div className="p-8 bg-brand-panel border border-brand-line rounded-xl text-center text-brand-ink-soft text-xs">
                      No candidates match the selected filters.
                    </div>
                  );
                }

                return processed.map(pa => {
                  const team = db.teams.find(t => t.id === pa.teamId);
                  const isZeroPrograms = !pa.programIds || pa.programIds.length === 0;

                  return (
                    <div 
                      key={pa.id} 
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border rounded-xl shadow-sm gap-2 transition-all ${
                        isZeroPrograms 
                          ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400' 
                          : 'bg-brand-panel border-brand-line'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[9px] bg-brand-gold-100 text-brand-gold-700 px-1.5 py-0.5 rounded font-bold">#{pa.number}</span>
                          <b className="text-xs md:text-sm text-brand-ink font-semibold truncate">{pa.name}</b>
                          {isZeroPrograms && (
                            <span className="px-2 py-0.5 bg-amber-500 text-white font-extrabold text-[9px] rounded-full animate-pulse uppercase tracking-wider">
                              ⚠️ 0 Programs (Unassigned)
                            </span>
                          )}
                        </div>
                        <small className="block text-[10px] text-brand-ink-soft mt-1 leading-snug">
                          {pa.cls ? `Class ${pa.cls}${pa.division ? ` ${pa.division}` : ''}` : 'No class'} &bull; <span className="text-brand-gold-700 font-semibold bg-brand-gold-50 px-1 py-0.2 rounded text-[9px] uppercase tracking-wide">{classToAge(pa.cls)} Group</span> &bull; Team: {team ? team.name : '—'} &bull; Section: {pa.gender} &bull; <b className={isZeroPrograms ? 'text-amber-800 font-extrabold' : 'text-brand-green-900'}>Programs: {pa.programIds.length}</b>
                        </small>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {isZeroPrograms && (
                          <button
                            onClick={() => handleOpenParticipant(pa.id)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          >
                            ➕ Assign Program
                          </button>
                        )}
                        <button onClick={() => handleOpenParticipant(pa.id)} className="p-2 bg-brand-bg rounded-lg hover:bg-brand-line/50 transition-colors text-brand-green-800 cursor-pointer" title="Edit Candidate">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if (deleteArmId === pa.id) {
                              handleDeleteParticipant(pa.id);
                              setDeleteArmId(null);
                            } else {
                              armDelete(pa.id);
                            }
                          }} 
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            deleteArmId === pa.id ? 'bg-red-500 text-white animate-pulse' : 'bg-brand-bg text-rose-600 hover:bg-rose-50'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        )}

        {/* Results List */}
        {activeTab === 'results' && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="p-4 bg-brand-panel border border-brand-line rounded-2xl shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-brand-green-950 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-brand-gold-600" />
                    Published Competition Results ({db.results.length})
                  </h3>
                  <p className="text-[11px] text-brand-ink-soft mt-0.5">
                    View, search, edit, or publish results separately for Boys and Girls sections.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenResult()}
                  className="px-4 py-2 bg-brand-green-800 hover:bg-brand-green-900 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-2 transition-all shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>➕ Publish New Result</span>
                </button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-brand-line/60">
                <input
                  type="text"
                  placeholder="🔍 Search by program name, code, candidate, or team..."
                  value={adminResultSearch}
                  onChange={(e) => setAdminResultSearch(e.target.value)}
                  className="px-3 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs font-medium text-brand-ink focus:outline-none focus:border-brand-gold-500"
                />

                <select
                  value={adminResultFilterGender}
                  onChange={(e) => setAdminResultFilterGender(e.target.value as any)}
                  className="px-3 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs font-bold text-brand-ink focus:outline-none"
                >
                  <option value="all">👥 All Sections (Boys &amp; Girls &amp; General)</option>
                  <option value="Boys">👦 Boys Section Only</option>
                  <option value="Girls">👧 Girls Section Only</option>
                  <option value="General">🌐 General Section Only</option>
                </select>

                <select
                  value={adminResultFilterAge}
                  onChange={(e) => setAdminResultFilterAge(e.target.value)}
                  className="px-3 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs font-bold text-brand-ink focus:outline-none"
                >
                  <option value="all">🏷️ All Age Categories</option>
                  {AGES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            {db.results.length === 0 ? (
              <div className="p-10 bg-brand-panel border border-brand-line rounded-2xl text-center text-brand-ink-soft text-xs space-y-2">
                <p>No results entries recorded yet.</p>
                <button
                  type="button"
                  onClick={() => handleOpenResult()}
                  className="px-3.5 py-1.5 bg-brand-green-100 text-brand-green-900 font-bold text-xs rounded-xl hover:bg-brand-green-200 transition-colors"
                >
                  + Publish First Result
                </button>
              </div>
            ) : (
              (() => {
                const filtered = db.results.filter(r => {
                  if (adminResultFilterGender !== 'all' && r.gender !== adminResultFilterGender) return false;
                  if (adminResultFilterAge !== 'all' && r.age !== adminResultFilterAge && r.age !== 'All') return false;

                  if (adminResultSearch.trim()) {
                    const q = adminResultSearch.toLowerCase().trim();
                    const prog = db.programs.find(p => p.id === r.programId);
                    const progMatch = (prog?.name || '').toLowerCase().includes(q) || (prog?.code || '').toLowerCase().includes(q);
                    
                    // Check if any winner matches
                    const allWinners = [
                      ...(r.winners.first || []),
                      ...(r.winners.second || []),
                      ...(r.winners.third || [])
                    ];
                    const winnerMatch = allWinners.some(w => {
                      const nameMatch = w.name.toLowerCase().includes(q);
                      const team = db.teams.find(t => t.id === w.teamId);
                      const teamMatch = (team?.name || '').toLowerCase().includes(q);
                      return nameMatch || teamMatch;
                    });

                    if (!progMatch && !winnerMatch) return false;
                  }

                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 bg-brand-panel border border-brand-line rounded-2xl text-center text-brand-ink-soft text-xs">
                      No results matching current filters.
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filtered.map(r => {
                      const prog = db.programs.find(p => p.id === r.programId);
                      const isBoys = r.gender === 'Boys';
                      const isGirls = r.gender === 'Girls';

                      return (
                        <div
                          key={r.id}
                          className={`p-4 bg-brand-panel border rounded-2xl shadow-sm space-y-3 transition-all hover:shadow-md ${
                            isBoys
                              ? 'border-sky-300/80 bg-gradient-to-br from-white via-sky-50/20 to-sky-50/40'
                              : isGirls
                              ? 'border-pink-300/80 bg-gradient-to-br from-white via-pink-50/20 to-pink-50/40'
                              : 'border-emerald-300/80 bg-gradient-to-br from-white via-emerald-50/20 to-emerald-50/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  isBoys
                                    ? 'bg-sky-100 text-sky-900 border border-sky-300'
                                    : isGirls
                                    ? 'bg-pink-100 text-pink-900 border border-pink-300'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}>
                                  {isBoys ? '👦 BOYS' : isGirls ? '👧 GIRLS' : '🌐 GENERAL'}
                                </span>
                                <span className="bg-brand-bg text-brand-ink-soft px-2 py-0.5 rounded-md text-[10px] font-bold border border-brand-line">
                                  {r.age} Group
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-brand-ink mt-1.5 leading-snug">
                                {prog ? `${prog.code} — ${prog.name}` : 'Competition'}
                              </h4>
                              <small className="text-[10px] text-brand-ink-soft block mt-0.5">
                                Published: {new Date(r.datetime).toLocaleDateString()} at {new Date(r.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </small>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handleOpenResult(r.id)}
                                className="p-2 bg-brand-bg hover:bg-brand-line/60 rounded-xl transition-colors text-brand-green-800 cursor-pointer"
                                title="Edit Result"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (deleteArmId === r.id) {
                                    handleDeleteResult(r.id);
                                    setDeleteArmId(null);
                                  } else {
                                    armDelete(r.id);
                                  }
                                }}
                                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                                  deleteArmId === r.id ? 'bg-red-500 text-white animate-pulse' : 'bg-brand-bg text-rose-600 hover:bg-rose-50'
                                }`}
                                title="Delete Result"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Winners Preview */}
                          <div className="pt-2 border-t border-brand-line/60 space-y-1.5">
                            {/* 1st */}
                            {r.winners.first?.length > 0 && (
                              <div className="flex items-center gap-2 text-xs bg-amber-50/80 p-1.5 rounded-xl border border-amber-200">
                                <span className="text-sm shrink-0">🥇</span>
                                <span className="font-bold text-amber-950 truncate flex-1">
                                  {r.winners.first.map(w => w.name).join(', ')}
                                </span>
                                {r.winners.first[0]?.teamId && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-200/80 text-amber-950 rounded shrink-0">
                                    {db.teams.find(t => t.id === r.winners.first[0].teamId)?.name}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* 2nd */}
                            {r.winners.second?.length > 0 && (
                              <div className="flex items-center gap-2 text-xs bg-slate-100/90 p-1.5 rounded-xl border border-slate-300">
                                <span className="text-sm shrink-0">🥈</span>
                                <span className="font-bold text-slate-900 truncate flex-1">
                                  {r.winners.second.map(w => w.name).join(', ')}
                                </span>
                                {r.winners.second[0]?.teamId && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-900 rounded shrink-0">
                                    {db.teams.find(t => t.id === r.winners.second[0].teamId)?.name}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* 3rd */}
                            {r.winners.third?.length > 0 && (
                              <div className="flex items-center gap-2 text-xs bg-amber-50/50 p-1.5 rounded-xl border border-amber-200/70">
                                <span className="text-sm shrink-0">🥉</span>
                                <span className="font-bold text-amber-900 truncate flex-1">
                                  {r.winners.third.map(w => w.name).join(', ')}
                                </span>
                                {r.winners.third[0]?.teamId && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded shrink-0">
                                    {db.teams.find(t => t.id === r.winners.third[0].teamId)?.name}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* Schedule, Time & Stage Manager */}
        {activeTab === 'schedules' && (
          <div className="space-y-4">
            {/* Header & Print Banner */}
            <div className="p-4 bg-brand-panel border border-brand-line rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-brand-green-950 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-gold-600" />
                  Time, Date & Stage Schedule Manager
                </h3>
                <p className="text-[11px] text-brand-ink-soft mt-0.5">
                  Select Program Name, Stage/Venue, or Date/Time from the dropdowns below to filter and update schedules.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={() => handlePrintScheduleSheet()}
                  className="px-3.5 py-2 bg-brand-green-800 hover:bg-brand-green-900 text-brand-gold-300 font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5 transition-colors"
                  title="Print Notice Board Schedule Sheet for today or filtered view"
                >
                  <Printer className="w-4 h-4" />
                  <span>🖨️ Notice Board Schedule Print</span>
                </button>
                <button
                  onClick={handleOpenBulkSchedule}
                  className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <span>📅</span> Bulk Schedule Matrix
                </button>
              </div>
            </div>

            {/* Search Bar & Dropdown Filters Panel (Dropdown Model) */}
            <div className="p-4 bg-gradient-to-r from-brand-panel to-brand-bg border border-brand-gold-500/30 rounded-2xl shadow-sm space-y-3">
              {/* Program Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-brand-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={scheduleFilterText}
                  onChange={(e) => setScheduleFilterText(e.target.value)}
                  placeholder="🔍 Search program by name, code, or stage (e.g., 101, Oppana, Stage 1)..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-brand-line rounded-xl text-xs font-medium text-brand-ink placeholder:text-brand-ink-soft/60 focus:outline-none focus:border-brand-gold-500 shadow-xs"
                />
                {scheduleFilterText && (
                  <button
                    onClick={() => setScheduleFilterText('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-ink-soft hover:text-brand-ink text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="text-xs font-bold text-brand-green-900 flex items-center justify-between">
                <span className="flex items-center gap-1.5">🎛️ Filter Schedule by Dropdowns</span>
                <span className="text-[10px] text-brand-ink-soft">
                  Showing <b>{filteredSchedulePrograms.length}</b> of <b>{db.programs.length}</b> programs
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Dropdown 1: Program Select */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wider block">
                    1. Program
                  </label>
                  <select
                    value={scheduleProgFilter}
                    onChange={(e) => setScheduleProgFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-brand-panel border border-brand-line rounded-xl text-xs font-medium text-brand-ink focus:outline-none focus:border-brand-gold-500 shadow-xs cursor-pointer"
                  >
                    <option value="all">🌐 All Programs ({db.programs.length})</option>
                    {db.programs.map(p => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dropdown 2: Stage / Venue Select */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wider block">
                    2. Stage / Venue
                  </label>
                  <select
                    value={scheduleStageFilter}
                    onChange={(e) => setScheduleStageFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-brand-panel border border-brand-line rounded-xl text-xs font-medium text-brand-ink focus:outline-none focus:border-brand-gold-500 shadow-xs cursor-pointer"
                  >
                    <option value="all">🌐 All Stages & Venues</option>
                    <option value="Stage 1">🏟️ Stage 1</option>
                    <option value="Stage 2">🏟️ Stage 2</option>
                    <option value="Stage 3">🏟️ Stage 3</option>
                    <option value="Stage 4">🏟️ Stage 4</option>
                    <option value="Stage 5">🏟️ Stage 5</option>
                    <option value="Main Stage">🏟️ Main Stage (General)</option>
                    <option value="Offstage">🏫 Offstage</option>
                    {Array.from(new Set(db.programs.map(p => p.venue).filter(Boolean))).map(v => (
                      <option key={v} value={v}>📍 Venue: {v}</option>
                    ))}
                  </select>
                </div>

                {/* Dropdown 3: Category Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wider block">
                    3. Age Category
                  </label>
                  <select
                    value={scheduleCatFilter}
                    onChange={(e) => setScheduleCatFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-brand-panel border border-brand-line rounded-xl text-xs font-medium text-brand-ink focus:outline-none focus:border-brand-gold-500 shadow-xs cursor-pointer"
                  >
                    <option value="all">🌐 All Age Groups</option>
                    <option value="Kids">👶 Kids</option>
                    <option value="Sub Junior">👦 Sub Junior</option>
                    <option value="Junior">🧑 Junior</option>
                    <option value="Senior">👨 Senior</option>
                    <option value="Super Senior">🎓 Super Senior</option>
                    <option value="General">👥 General / All</option>
                  </select>
                </div>

                {/* Dropdown 4: Time / Date Select */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wider block">
                    4. Time & Date
                  </label>
                  <select
                    value={scheduleDayFilter}
                    onChange={(e) => setScheduleDayFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-brand-panel border border-brand-line rounded-xl text-xs font-medium text-brand-ink focus:outline-none focus:border-brand-gold-500 shadow-xs cursor-pointer"
                  >
                    <option value="all">🌐 All Dates & Times</option>
                    <option value="Day 1">📅 Day 1</option>
                    <option value="Day 2">📅 Day 2</option>
                    <option value="Day 3">📅 Day 3</option>
                    <option value="Morning">🌅 Morning (08:00 AM - 12:00 PM)</option>
                    <option value="Afternoon">☀️ Afternoon (12:00 PM - 04:00 PM)</option>
                    <option value="Evening">🌙 Evening (04:00 PM onwards)</option>
                    {Array.from(new Set(db.programs.map(p => p.day).filter(Boolean))).map(d => (
                      <option key={d} value={d}>📆 Date/Day: {d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(scheduleFilterText || scheduleProgFilter !== 'all' || scheduleStageFilter !== 'all' || scheduleDayFilter !== 'all') && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => {
                      setScheduleFilterText('');
                      setScheduleProgFilter('all');
                      setScheduleStageFilter('all');
                      setScheduleDayFilter('all');
                    }}
                    className="text-xs font-bold text-amber-700 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>🔄</span> Clear All Search & Dropdown Filters
                  </button>
                </div>
              )}
            </div>

            {/* Filtered Schedule Results Cards */}
            <div className="space-y-3">
              {filteredSchedulePrograms.length === 0 ? (
                <div className="p-8 bg-brand-panel border border-brand-line rounded-2xl text-center text-brand-ink-soft text-xs">
                  No programs match the selected Program Name, Stage, or Date/Time dropdown options.
                </div>
              ) : (
                filteredSchedulePrograms.map(p => {
                  const status = getProgramScheduleStatus(p, db.results);
                  const isCompleted = status === 'COMPLETED';
                  const isUnlocked = Boolean(unlockedSchedulePrograms[p.id]);
                  const isLocked = isCompleted && !isUnlocked;
                  const enrolledParts = db.participants.filter(pt => pt.programIds && pt.programIds.includes(p.id));
                  const isCandidatesExpanded = expandedScheduleCandidatesProgId === p.id;

                  return (
                    <div 
                      key={p.id} 
                      onDoubleClick={() => {
                        if (isCompleted) {
                          setUnlockedSchedulePrograms(prev => ({ ...prev, [p.id]: !prev[p.id] }));
                        }
                      }}
                      className={`p-4 border rounded-2xl shadow-sm space-y-3 transition-all ${
                        isCompleted
                          ? isLocked
                            ? 'bg-red-50/60 border-red-400 dark:bg-red-950/20'
                            : 'bg-emerald-50/40 border-emerald-400 dark:bg-emerald-950/20'
                          : 'bg-brand-panel border-brand-line hover:border-brand-gold-500/50'
                      }`}
                    >
                      {/* Completed / Lock Status Banner */}
                      {isCompleted && (
                        <div className={`p-2.5 rounded-xl text-xs font-bold flex flex-wrap items-center justify-between gap-2 border ${
                          isLocked 
                            ? 'bg-red-100/90 text-red-950 border-red-300' 
                            : 'bg-emerald-100/90 text-emerald-950 border-emerald-300'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{isLocked ? '🔒' : '🔓'}</span>
                            <span>
                              {isLocked 
                                ? 'Program Completed & Schedule Locked. (Double-tap card or click button to unlock)' 
                                : 'Program Unlocked for Rescheduling.'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUnlockedSchedulePrograms(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold shadow-xs cursor-pointer active:scale-95 transition-all ${
                              isLocked 
                                ? 'bg-red-700 text-white hover:bg-red-800' 
                                : 'bg-emerald-700 text-white hover:bg-emerald-800'
                            }`}
                          >
                            {isLocked ? '🔓 Double-Tap / Click to Unlock' : '🔒 Lock Schedule'}
                          </button>
                        </div>
                      )}

                      {/* Top Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-brand-line/40">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-brand-green-800 text-brand-gold-300 font-mono font-bold text-xs rounded-lg shadow-xs">
                            {p.code}
                          </span>
                          <h4 className="font-bold text-xs md:text-sm text-brand-green-950">
                            {p.name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          {isCompleted ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-900 border border-red-300 rounded-md font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-red-700" /> Finished (Result Out)
                            </span>
                          ) : status === 'PASSED' ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-700" /> Time Passed
                            </span>
                          ) : status === 'LIVE' ? (
                            <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-md font-bold animate-pulse flex items-center gap-1">
                              🔴 Live Now
                            </span>
                          ) : null}
                          <span className={`px-2.5 py-1 rounded-lg font-bold shadow-xs ${p.stageType === 'Offstage' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-sky-100 text-sky-900 border border-sky-200'}`}>
                            {p.stageType || 'Main Stage'}
                          </span>
                          {p.categories.map((c, i) => (
                            <span key={i} className="px-2 py-0.5 bg-brand-bg text-brand-ink border border-brand-line rounded-md font-medium">
                              {c.gender} ({c.age})
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Quick Editable Schedule Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {/* Stage / Venue Select */}
                        <div>
                          <label className="text-[10px] font-bold text-brand-ink-soft block mb-1">
                            📍 Stage / Venue {isLocked && '🔒'}
                          </label>
                          <div className="space-y-1">
                            <select
                              value={p.venue || ''}
                              disabled={isLocked}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleQuickUpdateSchedule(p.id, 'venue', e.target.value);
                                }
                              }}
                              className="w-full px-2 py-1.5 bg-brand-bg border border-brand-line rounded-xl text-xs font-semibold text-brand-ink focus:border-brand-gold-500 focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <option value="">-- Select Stage --</option>
                              <option value="Stage 1">Stage 1</option>
                              <option value="Stage 2">Stage 2</option>
                              <option value="Stage 3">Stage 3</option>
                              <option value="Stage 4">Stage 4</option>
                              <option value="Stage 5">Stage 5</option>
                              <option value="Main Stage">Main Stage</option>
                              <option value="Offstage - Room 1">Offstage - Room 1</option>
                              <option value="Offstage - Room 2">Offstage - Room 2</option>
                              <option value="Auditorium">Auditorium</option>
                            </select>
                            <input
                              type="text"
                              value={p.venue || ''}
                              disabled={isLocked}
                              onChange={(e) => handleQuickUpdateSchedule(p.id, 'venue', e.target.value)}
                              placeholder="e.g. Stage 1 / Exam Hall"
                              className="w-full px-2.5 py-1 bg-brand-bg border border-brand-line rounded-lg text-[11px] text-brand-ink focus:border-brand-gold-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Date Select */}
                        <div>
                          <label className="text-[10px] font-bold text-brand-ink-soft block mb-1">
                            📅 Date {isLocked && '🔒'}
                          </label>
                          <div className="space-y-1">
                            <input
                              type="date"
                              disabled={isLocked}
                              onChange={(e) => {
                                if (e.target.value) {
                                  const [y, m, d] = e.target.value.split('-');
                                  handleQuickUpdateSchedule(p.id, 'day', `${d}/${m}/${y}`);
                                }
                              }}
                              className="w-full px-2 py-1.5 bg-brand-bg border border-brand-line rounded-xl text-xs font-semibold text-brand-ink focus:border-brand-gold-500 focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                              title="Pick Date"
                            />
                            <input
                              type="text"
                              value={p.day || ''}
                              disabled={isLocked}
                              onChange={(e) => handleQuickUpdateSchedule(p.id, 'day', e.target.value)}
                              placeholder="e.g. 24/07/2026"
                              className="w-full px-2.5 py-1 bg-brand-bg border border-brand-line rounded-lg text-[11px] text-brand-ink focus:border-brand-gold-500 focus:outline-none font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Time Select */}
                        <div>
                          <label className="text-[10px] font-bold text-brand-ink-soft block mb-1">
                            ⏰ Start Time {isLocked && '🔒'}
                          </label>
                          <div className="space-y-1">
                            <div className="flex gap-1">
                              <select
                                disabled={isLocked}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleQuickUpdateSchedule(p.id, 'startTime', e.target.value);
                                  }
                                }}
                                className="w-1/2 px-1.5 py-1.5 bg-brand-bg border border-brand-line rounded-xl text-[11px] font-medium text-brand-ink focus:border-brand-gold-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <option value="">Time...</option>
                                <option value="08:30 AM">08:30 AM</option>
                                <option value="09:00 AM">09:00 AM</option>
                                <option value="09:30 AM">09:30 AM</option>
                                <option value="10:00 AM">10:00 AM</option>
                                <option value="10:30 AM">10:30 AM</option>
                                <option value="11:00 AM">11:00 AM</option>
                                <option value="11:30 AM">11:30 AM</option>
                                <option value="12:00 PM">12:00 PM</option>
                                <option value="02:00 PM">02:00 PM</option>
                                <option value="02:30 PM">02:30 PM</option>
                                <option value="03:00 PM">03:00 PM</option>
                                <option value="03:30 PM">03:30 PM</option>
                                <option value="04:00 PM">04:00 PM</option>
                                <option value="04:30 PM">04:30 PM</option>
                                <option value="05:00 PM">05:00 PM</option>
                                <option value="07:00 PM">07:00 PM</option>
                                <option value="08:00 PM">08:00 PM</option>
                              </select>
                              <input
                                type="time"
                                disabled={isLocked}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleQuickUpdateSchedule(p.id, 'startTime', formatTimeFromPicker(e.target.value));
                                  }
                                }}
                                className="w-1/2 px-1 py-1.5 bg-brand-bg border border-brand-line rounded-xl text-[10px] text-brand-ink focus:border-brand-gold-500 focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                title="Pick Clock Time"
                              />
                            </div>
                            <input
                              type="text"
                              value={p.startTime || ''}
                              disabled={isLocked}
                              onChange={(e) => handleQuickUpdateSchedule(p.id, 'startTime', e.target.value)}
                              placeholder="e.g. 09:30 AM"
                              className="w-full px-2.5 py-1 bg-brand-bg border border-brand-line rounded-lg text-[11px] text-brand-ink focus:border-brand-gold-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Stage Location Type */}
                        <div>
                          <label className="text-[10px] font-bold text-brand-ink-soft block mb-1">
                            🎭 Stage Type {isLocked && '🔒'}
                          </label>
                          <select
                            value={p.stageType || 'Main Stage'}
                            disabled={isLocked}
                            onChange={(e) => handleQuickUpdateSchedule(p.id, 'stageType', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-brand-bg border border-brand-line rounded-xl text-xs font-semibold text-brand-ink focus:border-brand-gold-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <option value="Main Stage">🏟️ Main Stage</option>
                            <option value="Offstage">🏫 Offstage</option>
                          </select>
                        </div>
                      </div>

                      {/* Category-Wise Schedule Multi-Slot Control */}
                      {p.categories && p.categories.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-brand-line/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-brand-green-950 flex items-center gap-1.5">
                              <span>⏱️ Category-Specific Schedule & Stage Slots</span>
                            </span>
                            <span className="text-[10px] text-brand-ink-soft">
                              Set custom time slots & stages for Super Senior, Senior, Junior, Sub Junior, Kids
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {p.categories.map((cat, cIdx) => {
                              const catKey = cat.age;
                              const catSched = p.categorySchedules?.[catKey] || {};

                              return (
                                <div key={cIdx} className="p-2.5 bg-brand-bg/80 rounded-xl border border-brand-line/60 space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-brand-green-950 text-xs">
                                      {cat.age} ({cat.gender})
                                    </span>
                                    <span className="text-[9px] font-semibold text-brand-gold-700 bg-brand-gold-100 px-1.5 py-0.5 rounded">
                                      {catSched.startTime || 'Time Pending'}
                                    </span>
                                  </div>

                                  <div className="space-y-1 text-[11px]">
                                    <input
                                      type="text"
                                      placeholder="Stage / Venue (e.g. Stage 1)"
                                      value={catSched.venue || ''}
                                      disabled={isLocked}
                                      onChange={(e) => handleUpdateCategorySchedule(p.id, catKey, 'venue', e.target.value)}
                                      className="w-full px-2 py-1 bg-white border border-brand-line rounded-lg text-[11px] focus:outline-none disabled:opacity-60"
                                    />
                                    <div className="flex gap-1">
                                      <input
                                        type="text"
                                        placeholder="Time (e.g. 09:30 AM)"
                                        value={catSched.startTime || ''}
                                        disabled={isLocked}
                                        onChange={(e) => handleUpdateCategorySchedule(p.id, catKey, 'startTime', e.target.value)}
                                        className="w-1/2 px-2 py-1 bg-white border border-brand-line rounded-lg text-[11px] focus:outline-none disabled:opacity-60"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Date (e.g. 24/07)"
                                        value={catSched.day || ''}
                                        disabled={isLocked}
                                        onChange={(e) => handleUpdateCategorySchedule(p.id, catKey, 'day', e.target.value)}
                                        className="w-1/2 px-2 py-1 bg-white border border-brand-line rounded-lg text-[11px] focus:outline-none disabled:opacity-60"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Candidate List & Stage Call Print Section */}
                      {(() => {
                        const availableCats = Array.from(new Set([
                          ...p.categories.map(c => c.age),
                          ...enrolledParts.map(pt => pt.category || pt.age).filter(Boolean) as string[]
                        ]));

                        const currentCat = selectedPrintCat[p.id] || 'All';
                        const currentGender = selectedPrintGender[p.id] || 'All';

                        let displayEnrolled = enrolledParts;
                        if (currentCat !== 'All') {
                          displayEnrolled = displayEnrolled.filter(pt => (pt.category || pt.age) === currentCat);
                        }
                        if (currentGender !== 'All') {
                          displayEnrolled = displayEnrolled.filter(pt => (pt.gender || 'General') === currentGender);
                        }

                        const boysCount = enrolledParts.filter(pt => pt.gender === 'Boys').length;
                        const girlsCount = enrolledParts.filter(pt => pt.gender === 'Girls').length;
                        const genCount = enrolledParts.filter(pt => !pt.gender || pt.gender === 'General').length;

                        return (
                          <>
                            <div className="pt-2 border-t border-brand-line/40 flex flex-wrap items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedScheduleCandidatesProgId(isCandidatesExpanded ? null : p.id)}
                                className="flex items-center gap-1.5 text-xs font-bold text-brand-green-800 hover:text-brand-green-950 bg-brand-green-50 px-3 py-1.5 rounded-xl border border-brand-green-200 transition-colors cursor-pointer"
                              >
                                <Users className="w-3.5 h-3.5 text-brand-green-700" />
                                <span>👥 Candidates ({enrolledParts.length})</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCandidatesExpanded ? 'rotate-180' : ''}`} />
                              </button>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {availableCats.length > 0 && (
                                  <select
                                    value={currentCat}
                                    onChange={(e) => setSelectedPrintCat(prev => ({ ...prev, [p.id]: e.target.value }))}
                                    className="px-2.5 py-1.5 bg-brand-bg border border-brand-line rounded-xl text-xs font-bold text-brand-green-900 focus:outline-none focus:border-brand-gold-500 cursor-pointer shadow-xs"
                                    title="Select Category to Filter"
                                  >
                                    <option value="All">🏷️ All Categories ({enrolledParts.length})</option>
                                    {availableCats.map(cat => {
                                      const count = enrolledParts.filter(pt => (pt.category || pt.age) === cat).length;
                                      return (
                                        <option key={cat} value={cat}>
                                          📌 {cat} ({count})
                                        </option>
                                      );
                                    })}
                                  </select>
                                )}

                                <select
                                  value={currentGender}
                                  onChange={(e) => setSelectedPrintGender(prev => ({ ...prev, [p.id]: e.target.value }))}
                                  className="px-2.5 py-1.5 bg-brand-bg border border-brand-line rounded-xl text-xs font-bold text-brand-green-900 focus:outline-none focus:border-brand-gold-500 cursor-pointer shadow-xs"
                                  title="Select Gender to Separate Boys & Girls"
                                >
                                  <option value="All">🚻 All Genders ({enrolledParts.length})</option>
                                  <option value="Boys">👦 Boys Only ({boysCount})</option>
                                  <option value="Girls">👧 Girls Only ({girlsCount})</option>
                                  {genCount > 0 && <option value="General">🚻 General ({genCount})</option>}
                                </select>

                                <button
                                  type="button"
                                  onClick={() => handlePrintProgramJudgeSheet(p, currentCat, currentGender)}
                                  className="flex items-center gap-1.5 text-xs font-extrabold text-white bg-brand-green-900 hover:bg-brand-green-800 border border-brand-green-950 px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                                  title="Print Stage Call & Evaluation Form for Judges"
                                >
                                  <Printer className="w-3.5 h-3.5 text-brand-gold-400" />
                                  <span>🖨️ Print Call Sheet</span>
                                </button>
                              </div>
                            </div>

                            {/* Expandable Candidates List in Schedule */}
                            {isCandidatesExpanded && (
                              <div className="bg-white border border-brand-line rounded-xl p-3 space-y-2 text-xs shadow-inner">
                                <div className="flex items-center justify-between border-b border-brand-line/60 pb-1.5">
                                  <span className="font-bold text-brand-green-950 text-[11px] uppercase tracking-wider">
                                    Candidates ({displayEnrolled.length} {currentCat !== 'All' ? `• ${currentCat}` : ''} {currentGender !== 'All' ? `• ${currentGender}` : ''})
                                  </span>
                                  <span className="text-[10px] text-brand-ink-soft">
                                    Sorted by Chest Number
                                  </span>
                                </div>

                                {displayEnrolled.length === 0 ? (
                                  <p className="text-[11px] text-brand-ink-soft italic text-center py-2">
                                    No candidates enrolled matching filter criteria.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-[11px] border-collapse">
                                      <thead>
                                        <tr className="border-b border-brand-line/80 text-brand-ink-soft font-bold text-[10px] uppercase">
                                          <th className="py-1 px-1.5">Chest No</th>
                                          <th className="py-1 px-1.5">Name</th>
                                          <th className="py-1 px-1.5">Team</th>
                                          <th className="py-1 px-1.5">Gender</th>
                                          <th className="py-1 px-1.5">Category</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {displayEnrolled
                                          .sort((a, b) => (parseInt(a.chestNo || a.number || '0', 10) - parseInt(b.chestNo || b.number || '0', 10)))
                                          .map(pt => {
                                            const team = db.teams.find(t => t.id === pt.teamId);
                                            const isGirl = pt.gender === 'Girls';
                                            return (
                                              <tr key={pt.id} className="border-b border-brand-line/30 hover:bg-brand-bg/40">
                                                <td className="py-1.5 px-1.5 font-mono font-bold text-brand-green-800">
                                                  {pt.chestNo || pt.number || '—'}
                                                </td>
                                                <td className="py-1.5 px-1.5 font-bold text-brand-ink">
                                                  {pt.name}
                                                </td>
                                                <td className="py-1.5 px-1.5 text-brand-ink-soft text-[10.5px]">
                                                  {team ? team.name : '—'}
                                                </td>
                                                <td className="py-1.5 px-1.5 font-semibold text-[10.5px]">
                                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isGirl ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}`}>
                                                    {isGirl ? '👧 Girls' : '👦 Boys'}
                                                  </span>
                                                </td>
                                                <td className="py-1.5 px-1.5 text-[10px] text-brand-ink-soft">
                                                  {pt.category || pt.age || '—'} {pt.cls ? `(${pt.cls})` : ''}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>

            {filteredSchedulePrograms.length > 0 && (
              <div className="pt-4 mt-4 border-t border-brand-line flex flex-col sm:flex-row items-center justify-between gap-3 bg-brand-green-50/70 p-4 rounded-2xl border border-brand-green-200 shadow-sm">
                <div>
                  <span className="font-extrabold text-xs text-brand-green-950 block">
                    ⚡ PUBLISH SCHEDULE UPDATES LIVE
                  </span>
                  <span className="text-[10px] text-brand-green-800 font-medium">
                    Publish competition dates and time schedules live to all devices with one click.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateDb({ ...db });
                    alert('✅ All program schedules successfully published live!');
                  }}
                  className="px-5 py-2.5 bg-brand-green-800 hover:bg-brand-green-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5 shrink-0"
                >
                  <span>🚀</span> Save & Publish All Schedules Live
                </button>
              </div>
            )}
          </div>
        )}
      </div>
        </div>
      )}

      {/* MODAL FORMS POPUP */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 no-print">
          <div className={`bg-brand-panel w-full ${modalType === 'bulk_schedule' ? 'max-w-4xl' : 'max-w-lg'} rounded-t-3xl md:rounded-2xl shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto border border-brand-line`}>
            <div className="flex items-center justify-between border-b border-brand-line pb-3">
              <h3 className="font-display font-bold text-brand-green-950 text-sm md:text-base uppercase flex items-center gap-1.5">
                <span>{modalType === 'bulk_schedule' ? '📅' : '🛡️'}</span> {modalType === 'bulk_schedule' ? 'Bulk Program Schedule & Time Manager' : `${editingId ? 'Edit' : 'Add New'} ${modalType}`}
              </h3>
              <button onClick={closeModal} className="p-1 text-brand-ink-soft hover:bg-brand-bg rounded-lg">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* BULK PROGRAM SCHEDULE MANAGER */}
            {modalType === 'bulk_schedule' && (
              <div className="space-y-4">
                <div className="p-3 bg-brand-green-50 border border-brand-green-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <div className="text-xs text-brand-green-900">
                    <span className="font-bold block">📅 Batch Time & Schedule Setup</span>
                    <span className="text-[10px] text-brand-green-700">Quickly assign date, start/end times, venue stage, and schedule notes for all programs at once.</span>
                  </div>
                  <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => handleBatchApplyDay('Day 1')}
                      className="px-2.5 py-1 bg-brand-green-800 text-white text-[10px] font-bold rounded-lg hover:bg-brand-green-700 cursor-pointer"
                    >
                      Set All "Day 1"
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchApplyDay('Day 2')}
                      className="px-2.5 py-1 bg-brand-green-800 text-white text-[10px] font-bold rounded-lg hover:bg-brand-green-700 cursor-pointer"
                    >
                      Set All "Day 2"
                    </button>
                  </div>
                </div>

                {/* Filter box */}
                <div className="relative">
                  <input
                    type="text"
                    value={scheduleFilterText}
                    onChange={(e) => setScheduleFilterText(e.target.value)}
                    placeholder="Filter programs by code or name..."
                    className="w-full px-3.5 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs focus:outline-none"
                  />
                </div>

                {/* List / Table of Programs */}
                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                  {bulkSchedules
                    .filter(item => !scheduleFilterText || item.code.toLowerCase().includes(scheduleFilterText.toLowerCase()) || item.name.toLowerCase().includes(scheduleFilterText.toLowerCase()))
                    .map(item => (
                      <div key={item.id} className="p-3 bg-brand-bg/60 border border-brand-line/60 rounded-xl space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-brand-ink flex items-center gap-1.5 truncate">
                            <span className="font-mono text-[10px] bg-brand-green-100 text-brand-green-800 px-1.5 py-0.5 rounded font-bold">{item.code}</span>
                            <span className="truncate">{item.name}</span>
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${item.stageType === 'Offstage' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                            {item.stageType}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {/* Date Select */}
                          <div>
                            <label className="text-[10px] font-bold text-brand-ink-soft block mb-0.5">📅 Date</label>
                            <div className="space-y-1">
                              <input
                                type="date"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    const [y, m, d] = e.target.value.split('-');
                                    handleUpdateBulkScheduleRow(item.id, 'day', `${d}/${m}/${y}`);
                                  }
                                }}
                                className="w-full px-1.5 py-1 bg-white border border-brand-line rounded text-xs font-semibold"
                              />
                              <input
                                type="text"
                                value={item.day}
                                onChange={(e) => handleUpdateBulkScheduleRow(item.id, 'day', e.target.value)}
                                placeholder="e.g. 24/07/2026"
                                className="w-full px-2 py-1 bg-white border border-brand-line rounded-lg text-xs font-medium"
                              />
                            </div>
                          </div>

                          {/* Start Time Select */}
                          <div>
                            <label className="text-[10px] font-bold text-brand-ink-soft block mb-0.5">⏰ Start Time</label>
                            <div className="space-y-1">
                              <div className="flex gap-1">
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleUpdateBulkScheduleRow(item.id, 'startTime', e.target.value);
                                    }
                                  }}
                                  className="w-1/2 px-1 py-1 bg-white border border-brand-line rounded text-[10px]"
                                >
                                  <option value="">Time...</option>
                                  <option value="09:00 AM">09:00 AM</option>
                                  <option value="09:30 AM">09:30 AM</option>
                                  <option value="10:00 AM">10:00 AM</option>
                                  <option value="10:30 AM">10:30 AM</option>
                                  <option value="11:00 AM">11:00 AM</option>
                                  <option value="02:00 PM">02:00 PM</option>
                                  <option value="02:30 PM">02:30 PM</option>
                                  <option value="03:00 PM">03:00 PM</option>
                                  <option value="04:00 PM">04:00 PM</option>
                                  <option value="07:00 PM">07:00 PM</option>
                                </select>
                                <input
                                  type="time"
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleUpdateBulkScheduleRow(item.id, 'startTime', formatTimeFromPicker(e.target.value));
                                    }
                                  }}
                                  className="w-1/2 px-0.5 py-1 bg-white border border-brand-line rounded text-[9px]"
                                />
                              </div>
                              <input
                                type="text"
                                value={item.startTime}
                                onChange={(e) => handleUpdateBulkScheduleRow(item.id, 'startTime', e.target.value)}
                                placeholder="09:30 AM"
                                className="w-full px-2 py-1 bg-white border border-brand-line rounded-lg text-xs font-medium"
                              />
                            </div>
                          </div>

                          {/* End Time Select */}
                          <div>
                            <label className="text-[10px] font-bold text-brand-ink-soft block mb-0.5">⌛ End Time</label>
                            <div className="space-y-1">
                              <input
                                type="time"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleUpdateBulkScheduleRow(item.id, 'endTime', formatTimeFromPicker(e.target.value));
                                  }
                                }}
                                className="w-full px-1 py-1 bg-white border border-brand-line rounded text-[10px]"
                              />
                              <input
                                type="text"
                                value={item.endTime}
                                onChange={(e) => handleUpdateBulkScheduleRow(item.id, 'endTime', e.target.value)}
                                placeholder="11:00 AM"
                                className="w-full px-2 py-1 bg-white border border-brand-line rounded-lg text-xs font-medium"
                              />
                            </div>
                          </div>

                          {/* Venue / Stage Select */}
                          <div>
                            <label className="text-[10px] font-bold text-brand-ink-soft block mb-0.5">📍 Stage / Venue</label>
                            <div className="space-y-1">
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleUpdateBulkScheduleRow(item.id, 'venue', e.target.value);
                                  }
                                }}
                                className="w-full px-1 py-1 bg-white border border-brand-line rounded text-[10px]"
                              >
                                <option value="">Stage...</option>
                                <option value="Stage 1">Stage 1</option>
                                <option value="Stage 2">Stage 2</option>
                                <option value="Stage 3">Stage 3</option>
                                <option value="Main Stage">Main Stage</option>
                                <option value="Offstage - Room 1">Offstage - Room 1</option>
                                <option value="Offstage - Room 2">Offstage - Room 2</option>
                              </select>
                              <input
                                type="text"
                                value={item.venue}
                                onChange={(e) => handleUpdateBulkScheduleRow(item.id, 'venue', e.target.value)}
                                placeholder="Stage 1"
                                className="w-full px-2 py-1 bg-white border border-brand-line rounded-lg text-xs font-medium"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-brand-ink-soft block mb-0.5">📋 Schedule Note / Group Header</label>
                          <input
                            type="text"
                            value={item.schedule}
                            onChange={(e) => handleUpdateBulkScheduleRow(item.id, 'schedule', e.target.value)}
                            placeholder="e.g. Day 1 Morning Session"
                            className="w-full px-2 py-1.5 bg-white border border-brand-line rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    ))}
                </div>

                <div className="pt-2 border-t border-brand-line flex gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-1/3 py-2.5 border border-brand-line text-brand-ink font-bold text-xs rounded-xl hover:bg-brand-bg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBulkSchedules}
                    className="w-2/3 py-2.5 bg-brand-green-800 hover:bg-brand-green-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    💾 Save All Schedules ({bulkSchedules.length} Programs)
                  </button>
                </div>
              </div>
            )}

            {/* TEAM FORM */}
            {modalType === 'team' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-ink-soft">Team Name</label>
                  <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Al Hilal" className="w-full px-3.5 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs md:text-sm focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-ink-soft">Symbol (emoji)</label>
                    <input type="text" value={teamSymbol} onChange={(e) => setTeamSymbol(e.target.value)} className="w-full px-3.5 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs md:text-sm text-center font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-ink-soft flex justify-between">
                      <span>Theme Color</span>
                      <span className="font-mono text-[10px]" style={{ color: teamColor }}>{teamColor}</span>
                    </label>
                    <input type="color" value={teamColor} onChange={(e) => setTeamColor(e.target.value)} className="w-full h-11 bg-transparent p-0 border border-brand-line rounded-xl cursor-pointer" />
                  </div>
                </div>

                {/* Color Presets */}
                <div className="space-y-1.5 p-3 bg-brand-bg border border-brand-line rounded-xl">
                  <label className="text-[11px] font-bold text-brand-ink-soft">Quick Color Presets:</label>
                  <div className="flex flex-wrap gap-2">
                    {['#1b8155', '#2a5d9c', '#b5306e', '#d97706', '#7c3aed', '#0d9488', '#dc2626', '#ea580c', '#0284c7', '#4f46e5', '#be123c', '#15803d'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setTeamColor(c)}
                        className={`w-7 h-7 rounded-lg border-2 cursor-pointer transition-transform hover:scale-110 shadow-2xs ${
                          teamColor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-brand-gold-500 scale-110 border-white' : 'border-black/10'
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-1 border-t border-brand-line/60">
                  <div>
                    <label className="text-xs font-bold text-brand-ink-soft block mb-1">General Captain Name (General Captain)</label>
                    <input type="text" value={teamCaptain} onChange={(e) => setTeamCaptain(e.target.value)} placeholder="e.g. Mohammed" className="w-full px-3.5 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs md:text-sm focus:outline-none" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-brand-green-900 block mb-1">👦 1st Boy Leader</label>
                      <input type="text" value={teamBoysCaptain} onChange={(e) => setTeamBoysCaptain(e.target.value)} placeholder="e.g. Riaz" className="w-full px-3 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-brand-green-900 block mb-1">👦 2nd Boy Leader</label>
                      <input type="text" value={teamBoysCaptain2} onChange={(e) => setTeamBoysCaptain2(e.target.value)} placeholder="e.g. Bilal" className="w-full px-3 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs focus:outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-pink-900 block mb-1">👧 1st Girl Leader</label>
                      <input type="text" value={teamGirlsCaptain} onChange={(e) => setTeamGirlsCaptain(e.target.value)} placeholder="e.g. Nuha" className="w-full px-3 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-pink-900 block mb-1">👧 2nd Girl Leader</label>
                      <input type="text" value={teamGirlsCaptain2} onChange={(e) => setTeamGirlsCaptain2(e.target.value)} placeholder="e.g. Ayisha" className="w-full px-3 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs focus:outline-none" />
                    </div>
                  </div>
                </div>
                <button onClick={handleSaveTeam} className="w-full py-3 bg-brand-green-800 text-white font-bold text-xs rounded-xl shadow cursor-pointer hover:bg-brand-green-700 transition-colors">
                  Save Team
                </button>
              </div>
            )}

            {/* PROGRAM FORM */}
            {modalType === 'program' && (
              <div className="space-y-4">
                {/* 1. Basic Program Identification (Code & Name) */}
                <div className="p-3 bg-brand-panel border border-brand-line rounded-2xl shadow-2xs space-y-3">
                  <span className="text-xs font-bold text-brand-green-950 uppercase tracking-wider block">
                    1. Program Code & Name
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-[10px] font-extrabold text-brand-ink-soft uppercase tracking-wider block">
                        Program Code
                      </label>
                      <input 
                        type="text" 
                        value={progCode} 
                        onChange={(e) => setProgCode(e.target.value)} 
                        placeholder="e.g. 0233 or SB01" 
                        className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-mono font-bold text-brand-green-950 focus:outline-none focus:border-brand-gold-500 uppercase shadow-2xs" 
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-extrabold text-brand-ink-soft uppercase tracking-wider block">
                        Program Name
                      </label>
                      <input 
                        type="text" 
                        value={progName} 
                        onChange={(e) => setProgName(e.target.value)} 
                        placeholder="e.g. SPEECH, QURAN RECITATION, OPPANA" 
                        className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-gold-500 shadow-2xs" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-brand-ink-soft block">Max Candidates per Team</label>
                      <input 
                        type="number" 
                        value={progMax || ''} 
                        onChange={(e) => setProgMax(e.target.value ? Number(e.target.value) : null)} 
                        placeholder="No limit" 
                        className="w-full px-3 py-1.5 bg-white border border-brand-line rounded-xl text-xs focus:outline-none" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-brand-ink-soft block">Type</label>
                      <div className="flex gap-3 pt-1">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-brand-ink cursor-pointer">
                          <input type="checkbox" checked={progSingle} onChange={(e) => setProgSingle(e.target.checked)} className="rounded text-brand-green-800" /> Single
                        </label>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-brand-ink cursor-pointer">
                          <input type="checkbox" checked={progGroup} onChange={(e) => setProgGroup(e.target.checked)} className="rounded text-brand-green-800" /> Group
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Category Checkboxes Selection (Boys, Girls & General) */}
                <div className="p-3.5 bg-gradient-to-br from-brand-panel to-brand-bg border border-brand-gold-500/30 rounded-2xl shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-brand-line/50 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">☑️</span>
                      <span className="text-xs font-extrabold text-brand-green-950 uppercase tracking-wider">
                        2. Category Checkboxes
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-extrabold bg-brand-gold-100 text-brand-gold-800 px-2 py-0.5 rounded-md border border-brand-gold-300">
                      {progCats.length} Categories Selected
                    </span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={handleSelectAllCategories}
                      className="px-2.5 py-1 bg-brand-green-800 text-white font-bold rounded-lg hover:bg-brand-green-700 transition-colors cursor-pointer"
                    >
                      ✅ Select All Categories
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectGenderOnly('Boys')}
                      className="px-2.5 py-1 bg-sky-100 text-sky-900 border border-sky-300 font-bold rounded-lg hover:bg-sky-200 transition-colors cursor-pointer"
                    >
                      👦 Select All Boys
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectGenderOnly('Girls')}
                      className="px-2.5 py-1 bg-pink-100 text-pink-900 border border-pink-300 font-bold rounded-lg hover:bg-pink-200 transition-colors cursor-pointer"
                    >
                      👧 Select All Girls
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllCategories}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-300 font-bold rounded-lg hover:bg-slate-200 transition-colors cursor-pointer ml-auto"
                    >
                      ❌ Clear
                    </button>
                  </div>

                  {/* Category Tick Cards */}
                  <div className="space-y-2.5">
                    {/* Boys Categories */}
                    <div className="bg-sky-50/90 border border-sky-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-sky-200 pb-1.5">
                        <span className="font-extrabold text-sky-950 text-xs flex items-center gap-1.5">
                          <span>👦</span> BOYS CATEGORIES
                        </span>
                        <label className="flex items-center gap-1 text-[10px] font-extrabold text-sky-800 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={AGES.every(a => progCats.some(c => c.gender === 'Boys' && c.age === a))} 
                            onChange={(e) => handleToggleCatGroup('Boys', e.target.checked)} 
                            className="rounded" 
                          /> 
                          Toggle All Boys
                        </label>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
                        {AGES.map(a => {
                          const isChecked = progCats.some(c => c.gender === 'Boys' && c.age === a);
                          return (
                            <label key={a} className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                              isChecked ? 'bg-sky-200/90 border-sky-400 text-sky-950 shadow-2xs' : 'bg-white/80 border-sky-200 text-slate-700 hover:bg-sky-100/50'
                            }`}>
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={() => handleToggleCat('Boys', a)} 
                                className="rounded text-sky-600 focus:ring-sky-500" 
                              /> 
                              <span>{AGE_ICONS[a]} {a}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Girls Categories */}
                    <div className="bg-pink-50/90 border border-pink-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-pink-200 pb-1.5">
                        <span className="font-extrabold text-pink-950 text-xs flex items-center gap-1.5">
                          <span>👧</span> GIRLS CATEGORIES
                        </span>
                        <label className="flex items-center gap-1 text-[10px] font-extrabold text-pink-800 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={AGES.every(a => progCats.some(c => c.gender === 'Girls' && c.age === a))} 
                            onChange={(e) => handleToggleCatGroup('Girls', e.target.checked)} 
                            className="rounded" 
                          /> 
                          Toggle All Girls
                        </label>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
                        {AGES.map(a => {
                          const isChecked = progCats.some(c => c.gender === 'Girls' && c.age === a);
                          return (
                            <label key={a} className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                              isChecked ? 'bg-pink-200/90 border-pink-400 text-pink-950 shadow-2xs' : 'bg-white/80 border-pink-200 text-slate-700 hover:bg-pink-100/50'
                            }`}>
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={() => handleToggleCat('Girls', a)} 
                                className="rounded text-pink-600 focus:ring-pink-500" 
                              /> 
                              <span>{AGE_ICONS[a]} {a}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* General Category */}
                    <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-2.5">
                      <label className="flex items-center gap-2 text-xs font-bold text-emerald-950 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={progCats.some(c => c.gender === 'General')} 
                          onChange={() => handleToggleCat('General', 'All')} 
                          className="rounded text-emerald-600" 
                        /> 
                        <span>🌐 General Section (Open to all divisions, no class restriction)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 3. Program Time, Date & Stage Schedule Options */}
                <div className="p-3.5 bg-brand-bg/70 border border-brand-line/80 rounded-2xl space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-brand-line/50 pb-2">
                    <span className="text-xs font-extrabold text-brand-green-950 flex items-center gap-1.5 uppercase tracking-wider">
                      <span>⏰</span> 3. Time, Date & Stage Setup
                    </span>
                    <span className="text-[10px] text-brand-ink-soft italic">
                      Separate Option for Schedule
                    </span>
                  </div>

                  {/* Stage Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wider block">
                      Program Stage
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5', 'Main Stage', 'Offstage'].map(stg => (
                        <button
                          key={stg}
                          type="button"
                          onClick={() => setProgVenue(stg)}
                          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            progVenue === stg 
                              ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-xs' 
                              : 'bg-white text-brand-ink border-brand-line hover:border-brand-gold-400'
                          }`}
                        >
                          📍 {stg}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={progVenue}
                      onChange={(e) => setProgVenue(e.target.value)}
                      placeholder="Or enter custom stage (e.g., Auditorium, Stage 1)"
                      className="w-full px-3 py-1.5 bg-white border border-brand-line rounded-xl text-xs mt-1"
                    />
                  </div>

                  {/* Date Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wider block">
                        Date
                      </label>
                      <input
                        type="date"
                        onChange={(e) => {
                          if (e.target.value) {
                            const [y, m, d] = e.target.value.split('-');
                            setProgDay(`${d}/${m}/${y}`);
                          }
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-brand-line rounded-xl text-xs font-semibold text-brand-ink cursor-pointer"
                        title="Calendar Picker"
                      />
                      <input
                        type="text"
                        value={progDay}
                        onChange={(e) => setProgDay(e.target.value)}
                        placeholder="e.g. 24/07/2026"
                        className="w-full px-3 py-1.5 bg-white border border-brand-line rounded-xl text-xs font-semibold text-brand-ink"
                      />
                    </div>

                    {/* Time Picker Controls */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wider block">
                        Program Time
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-extrabold text-brand-ink-soft">Start Time</span>
                          <input
                            type="time"
                            onChange={(e) => {
                              if (e.target.value) setProgStart(formatTimeFromPicker(e.target.value));
                            }}
                            className="w-full px-2 py-1 bg-white border border-brand-line rounded-lg text-xs font-mono font-bold cursor-pointer"
                          />
                          <input
                            type="text"
                            value={progStart}
                            onChange={(e) => setProgStart(e.target.value)}
                            placeholder="e.g. 09:30 AM"
                            className="w-full px-2 py-1 bg-white border border-brand-line rounded-lg text-xs"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[9px] font-extrabold text-brand-ink-soft">End Time</span>
                          <input
                            type="time"
                            onChange={(e) => {
                              if (e.target.value) setProgEnd(formatTimeFromPicker(e.target.value));
                            }}
                            className="w-full px-2 py-1 bg-white border border-brand-line rounded-lg text-xs font-mono font-bold cursor-pointer"
                          />
                          <input
                            type="text"
                            value={progEnd}
                            onChange={(e) => setProgEnd(e.target.value)}
                            placeholder="e.g. 11:30 AM"
                            className="w-full px-2 py-1 bg-white border border-brand-line rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Location Type */}
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-brand-line/60">
                    <span className="text-xs font-bold text-brand-green-950">Location Type:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setProgStageType('Main Stage')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          progStageType === 'Main Stage' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        🎭 Main Stage
                      </button>
                      <button
                        type="button"
                        onClick={() => setProgStageType('Offstage')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          progStageType === 'Offstage' ? 'bg-amber-800 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        📝 Offstage
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-ink-soft">Description (optional)</label>
                  <textarea value={progDesc} onChange={(e) => setProgDesc(e.target.value)} rows={2} className="w-full px-3.5 py-2 bg-brand-bg border border-brand-line rounded-xl text-xs focus:outline-none" />
                </div>

                {/* Save Button */}
                <div className="pt-2 border-t border-brand-line flex gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-1/3 py-3 border border-brand-line text-brand-ink font-bold text-xs rounded-xl hover:bg-brand-bg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveProgram} 
                    className="w-2/3 py-3 bg-brand-green-800 hover:bg-brand-green-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition-colors flex items-center justify-center gap-2"
                  >
                    <span>💾</span> Save Program Details
                  </button>
                </div>
              </div>
            )}

            {/* PARTICIPANT FORM */}
            {modalType === 'participant' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-ink-soft">Candidate Number</label>
                    <input type="text" value={paNum} onChange={(e) => setPaNum(e.target.value)} placeholder="e.g. 101" className="w-full px-3.5 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs md:text-sm focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-ink-soft">Candidate Name</label>
                    <input type="text" value={paName} onChange={(e) => setPaName(e.target.value)} placeholder="e.g. Muhammed Ali" className="w-full px-3.5 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs md:text-sm focus:outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-brand-ink-soft">Class</label>
                      <span className="text-[10px] text-brand-green-800 font-bold bg-brand-green-50 px-1.5 py-0.5 rounded leading-none uppercase tracking-wide">
                        {classToAge(paClass)} Group
                      </span>
                    </div>
                    <select value={paClass} onChange={(e) => {
                      setPaClass(e.target.value);
                      setPaProgs([]); // Clear selected programs since age group changed
                    }} className="w-full px-3.5 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs">
                      {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-ink-soft">Division (optional)</label>
                    <select value={paDivision} onChange={(e) => setPaDivision(e.target.value)} className="w-full px-3.5 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs">
                      <option value="">—</option>
                      {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-ink-soft">Team</label>
                    <select value={paTeam} onChange={(e) => setPaTeam(e.target.value)} className="w-full px-3.5 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs">
                      <option value="">— Select Team —</option>
                      {db.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-ink-soft">Gender Section</label>
                    <select value={paGender} onChange={(e) => {
                      setPaGender(e.target.value as any);
                      setPaProgs([]); // Clear program options on change
                    }} className="w-full px-3.5 py-2.5 bg-brand-bg border border-brand-line rounded-xl text-xs">
                      {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>

                {/* Dynamic Program Checklist selector */}
                <div className="space-y-1 border-t border-brand-line pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-brand-ink">
                      Assign Programs ({paGender} Section &bull; {paGender === 'General' ? 'All' : classToAge(paClass)})
                    </label>
                    <span className="text-[10px] font-semibold text-brand-ink-soft bg-brand-bg px-2 py-0.5 rounded border border-brand-line">
                      Class {paClass || '—'}
                    </span>
                  </div>

                  {(() => {
                    const age = classToAge(paClass);
                    const clsNum = parseInt(paClass, 10);
                    const isClass5OrAbove = !isNaN(clsNum) ? clsNum >= 5 : age !== 'Kids';

                    if (!isClass5OrAbove) {
                      return (
                        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-950 font-medium my-1 flex items-center gap-1.5">
                          <span>ℹ️</span>
                          <span><b>Class 1 to 4 Note:</b> General (🌐) programs are hidden for Class 1-4. They are available only for Class 5 and above.</span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="max-h-48 overflow-y-auto border border-brand-line rounded-xl p-3 bg-brand-bg/50 space-y-1.5">
                    {(() => {
                      const age = classToAge(paClass);
                      const clsNum = parseInt(paClass, 10);
                      const isClass5OrAbove = !isNaN(clsNum) ? clsNum >= 5 : age !== 'Kids';

                      const availableProgs = db.programs.filter(p => {
                        const isGeneralProg = p.categories.some(c => c.gender === 'General' || c.age === 'All' || c.age === 'General');
                        
                        // General programs are strictly for Class 5 and above (Class 1-4 excluded)
                        if (isGeneralProg) {
                          return isClass5OrAbove;
                        }

                        if (paGender === 'General') {
                          return p.categories.some(c => c.gender === 'General' || c.age === age || c.age === 'All');
                        }

                        return p.categories.some(c => (c.gender === paGender || c.gender === 'General') && (c.age === age || c.age === 'All'));
                      });

                      if (availableProgs.length === 0) {
                        return <p className="text-[11px] text-brand-ink-soft italic">No programs found matching this gender/age division.</p>;
                      }

                      return availableProgs.map(p => {
                        const isChecked = paProgs.includes(p.id);
                        return (
                          <label key={p.id} className="flex items-center gap-2 text-xs font-medium text-brand-ink cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPaProgs([...paProgs, p.id]);
                                } else {
                                  setPaProgs(paProgs.filter(id => id !== p.id));
                                }
                              }}
                              className="rounded"
                            />
                            <span>{p.code} &mdash; {p.name}</span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>

                <button onClick={handleSaveParticipant} className="w-full py-3 bg-brand-green-800 text-white font-bold text-xs rounded-xl shadow cursor-pointer">
                  Save Candidate
                </button>
              </div>
            )}

            {/* RESULTS FORM (DUAL SECTION BOYS & GIRLS PUBLISHING) */}
            {modalType === 'result' && (
              <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
                {/* Program & Age Selector Header */}
                <div className="p-3.5 bg-brand-bg rounded-2xl border border-brand-line/80 space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-brand-green-950">Select Competition Program</label>
                      {resProgId && (
                        <div className="flex items-center gap-1 text-[10px] font-bold">
                          {db.results.some(r => r.programId === resProgId && r.gender === 'Boys') && (
                            <span className="px-1.5 py-0.5 bg-sky-100 text-sky-900 border border-sky-300 rounded">👦 Boys Published</span>
                          )}
                          {db.results.some(r => r.programId === resProgId && r.gender === 'Girls') && (
                            <span className="px-1.5 py-0.5 bg-pink-100 text-pink-900 border border-pink-300 rounded">👧 Girls Published</span>
                          )}
                          {db.results.some(r => r.programId === resProgId && r.gender === 'General') && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded">🌐 Gen Published</span>
                          )}
                        </div>
                      )}
                    </div>
                    <select
                      value={resProgId}
                      onChange={(e) => handleResultProgChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-brand-line rounded-xl text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-gold-500"
                    >
                      <option value="">— Select Competition —</option>
                      {db.programs.map(p => {
                        const boysDeclared = db.results.some(r => r.programId === p.id && r.gender === 'Boys');
                        const girlsDeclared = db.results.some(r => r.programId === p.id && r.gender === 'Girls');
                        const genDeclared = db.results.some(r => r.programId === p.id && r.gender === 'General');

                        let tag = '';
                        if (boysDeclared && girlsDeclared) tag = ' ✅ [BOYS & GIRLS PUBLISHED]';
                        else if (boysDeclared) tag = ' 👦 [BOYS PUBLISHED]';
                        else if (girlsDeclared) tag = ' 👧 [GIRLS PUBLISHED]';
                        else if (genDeclared) tag = ' 🌐 [PUBLISHED]';

                        return (
                          <option key={p.id} value={p.id}>
                            {p.code} — {p.name} {tag}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {resProgId && (
                    <div className="space-y-2.5 pt-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="text-xs font-black text-brand-green-950 flex items-center gap-1.5">
                            <span>🏷️</span> Age Category for Results
                          </label>
                          <p className="text-[10px] text-brand-ink-soft">
                            Click any category below to enter/edit winners for that age group.
                          </p>
                        </div>

                        {/* View Switcher */}
                        <div className="flex bg-white p-1 rounded-xl border border-brand-line gap-1 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setResActiveView('dual')}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                              resActiveView === 'dual' ? 'bg-brand-green-800 text-white' : 'text-brand-ink hover:bg-brand-bg'
                            }`}
                          >
                            👥 Dual (Boys &amp; Girls)
                          </button>
                          <button
                            type="button"
                            onClick={() => setResActiveView('boys')}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                              resActiveView === 'boys' ? 'bg-sky-700 text-white' : 'text-sky-950 hover:bg-sky-50'
                            }`}
                          >
                            👦 Boys Only
                          </button>
                          <button
                            type="button"
                            onClick={() => setResActiveView('girls')}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                              resActiveView === 'girls' ? 'bg-pink-700 text-white' : 'text-pink-950 hover:bg-pink-50'
                            }`}
                          >
                            👧 Girls Only
                          </button>
                          <button
                            type="button"
                            onClick={() => setResActiveView('general')}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                              resActiveView === 'general' ? 'bg-emerald-700 text-white' : 'text-emerald-950 hover:bg-emerald-50'
                            }`}
                          >
                            🌐 Gen
                          </button>
                        </div>
                      </div>

                      {/* Category Selection Tabs Bar */}
                      <div className="flex flex-wrap gap-1.5 p-2 bg-brand-bg/80 border border-brand-line rounded-2xl">
                        {AGES.map(a => {
                          const isCurrent = resAge === a;
                          const boysPublished = db.results.some(r => r.programId === resProgId && r.age === a && r.gender === 'Boys');
                          const girlsPublished = db.results.some(r => r.programId === resProgId && r.age === a && r.gender === 'Girls');
                          const prog = db.programs.find(p => p.id === resProgId);
                          const isProgCategory = prog?.categories.some(c => c.age === a);

                          return (
                            <button
                              key={a}
                              type="button"
                              onClick={() => handleResultAgeChange(a)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                isCurrent
                                  ? 'bg-brand-green-800 text-brand-gold-300 ring-2 ring-brand-gold-400'
                                  : 'bg-white text-brand-ink hover:bg-brand-bg border border-brand-line'
                              }`}
                            >
                              <span>{AGE_ICONS[a] || '🏷️'}</span>
                              <span>{a}</span>
                              {boysPublished && girlsPublished ? (
                                <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-bold">✅ B+G</span>
                              ) : boysPublished ? (
                                <span className="text-[9px] bg-sky-600 text-white px-1.5 py-0.2 rounded-full font-bold">👦 Boys</span>
                              ) : girlsPublished ? (
                                <span className="text-[9px] bg-pink-600 text-white px-1.5 py-0.2 rounded-full font-bold">👧 Girls</span>
                              ) : isProgCategory ? (
                                <span className="text-[9px] text-brand-gold-700 font-bold">★</span>
                              ) : null}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => handleResultAgeChange('All')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            resAge === 'All'
                              ? 'bg-brand-green-800 text-brand-gold-300 ring-2 ring-brand-gold-400'
                              : 'bg-white text-brand-ink hover:bg-brand-bg border border-brand-line'
                          }`}
                        >
                          <span>🌐</span>
                          <span>All / General</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {!resProgId ? (
                  <div className="p-8 text-center bg-brand-bg rounded-2xl border border-brand-line text-xs text-brand-ink-soft">
                    Please select a competition program above to publish winners and grades.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* DUAL OR MULTI-SECTION PANELS */}
                    <div className={`grid gap-4 ${resActiveView === 'dual' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                      {/* ================= BOYS SECTION ================= */}
                      {(resActiveView === 'dual' || resActiveView === 'boys') && (
                        <div className="p-4 bg-sky-50/40 border-2 border-sky-300/80 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 bg-sky-100 text-sky-800 rounded-lg text-sm">👦</span>
                              <div>
                                <h4 className="text-xs font-bold text-sky-950">Boys Section Results</h4>
                                <p className="text-[10px] text-sky-800">Assign winners &amp; grades for Boys</p>
                              </div>
                            </div>
                            {db.results.some(r => r.programId === resProgId && r.gender === 'Boys') && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-200/80 text-sky-900 rounded-md">
                                ✅ Published
                              </span>
                            )}
                          </div>

                          {/* Quick Filter */}
                          <input
                            type="text"
                            placeholder="🔍 Filter boys by name, chest #, team..."
                            value={boysSearch}
                            onChange={(e) => setBoysSearch(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sky-200 rounded-xl text-xs font-medium text-brand-ink focus:outline-none focus:border-sky-400"
                          />

                          {/* Candidate List */}
                          {(() => {
                            const boysCandidates = db.participants.filter(p => {
                              if (!p.programIds.includes(resProgId)) return false;
                              const genderMatch = p.gender === 'Boys' || !p.gender;
                              const ageMatch = (resAge as string) === 'All' || p.age === resAge;
                              return genderMatch && ageMatch;
                            });

                            const filtered = boysCandidates.filter(p => {
                              if (!boysSearch.trim()) return true;
                              const q = boysSearch.toLowerCase().trim();
                              const nameMatch = p.name.toLowerCase().includes(q);
                              const numMatch = (p.number || '').toLowerCase().includes(q);
                              const team = db.teams.find(t => t.id === p.teamId)?.name || '';
                              return nameMatch || numMatch || team.toLowerCase().includes(q);
                            });

                            return (
                              <div className="space-y-2">
                                {filtered.length === 0 ? (
                                  <div className="p-3 bg-white/80 rounded-xl border border-sky-200 text-center text-xs text-sky-900/70">
                                    {boysCandidates.length === 0
                                      ? 'No registered boys candidates found for this program.'
                                      : 'No candidates match search filter.'}
                                  </div>
                                ) : (
                                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                    {filtered.map(p => {
                                      const teamName = db.teams.find(t => t.id === p.teamId)?.name || 'No Team';
                                      const val = resBoysTies[p.id] || '';
                                      return (
                                        <div
                                          key={p.id}
                                          className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
                                            val === 'first'
                                              ? 'bg-amber-100 border-amber-300 font-bold'
                                              : val === 'second'
                                              ? 'bg-slate-200 border-slate-300 font-bold'
                                              : val === 'third'
                                              ? 'bg-amber-100/70 border-amber-200 font-bold'
                                              : val
                                              ? 'bg-emerald-100 border-emerald-300 font-bold'
                                              : 'bg-white border-sky-200'
                                          }`}
                                        >
                                          <div className="min-w-0 pr-2">
                                            <b className="text-brand-ink block truncate">{p.name}</b>
                                            <small className="text-brand-ink-soft block text-[10px]">
                                              {teamName} &bull; <span className="font-mono font-bold text-sky-800">#{p.number}</span>
                                            </small>
                                          </div>
                                          <select
                                            value={val}
                                            onChange={(e) => setResBoysTies({ ...resBoysTies, [p.id]: e.target.value })}
                                            className="px-2 py-1 bg-white border border-sky-300 rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                                          >
                                            <option value="">— Award —</option>
                                            <option value="first">🥇 1st Place</option>
                                            <option value="second">🥈 2nd Place</option>
                                            <option value="third">🥉 3rd Place</option>
                                            <option value="gradeA">🅰️ Grade A</option>
                                            <option value="gradeB">🅱️ Grade B</option>
                                            <option value="gradeC">🅲 Grade C</option>
                                            <option value="participation">🎗️ Part.</option>
                                          </select>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                  {/* Manual rows for Boys */}
                                  <div className="space-y-2 pt-2 border-t border-sky-200/80">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-sky-950">
                                      <span>Manual / Group / Team Winners (Boys)</span>
                                      <button
                                        type="button"
                                        onClick={() => setBoysManualRows([...boysManualRows, { name: '', teamId: '', assign: '', description: '' }])}
                                        className="px-2 py-0.5 bg-sky-200/70 hover:bg-sky-300 text-sky-900 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                      >
                                        + Add Group / Winner
                                      </button>
                                    </div>
                                    {boysManualRows.map((row, idx) => (
                                      <div key={idx} className="p-2 bg-white rounded-xl border border-sky-200 space-y-1.5 shadow-sm">
                                        <div className="flex gap-1.5 items-center">
                                          <input
                                            type="text"
                                            placeholder="Candidate or Group Name (e.g. Team KAAF)"
                                            value={row.name}
                                            onChange={(e) => {
                                              const next = [...boysManualRows];
                                              next[idx].name = e.target.value;
                                              setBoysManualRows(next);
                                            }}
                                            className="flex-1 min-w-0 px-2 py-1 bg-sky-50/50 border border-sky-200 rounded text-xs font-semibold"
                                          />
                                          <select
                                            value={row.teamId}
                                            onChange={(e) => {
                                              const next = [...boysManualRows];
                                              next[idx].teamId = e.target.value;
                                              // Auto-fill name with team name if empty
                                              if (!next[idx].name.trim() && e.target.value) {
                                                const selTeam = db.teams.find(t => t.id === e.target.value);
                                                if (selTeam) next[idx].name = selTeam.name;
                                              }
                                              setBoysManualRows(next);
                                            }}
                                            className="w-28 px-1.5 py-1 bg-sky-50/50 border border-sky-200 rounded text-xs font-medium"
                                          >
                                            <option value="">Select Team</option>
                                            {db.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                          </select>
                                          <select
                                            value={row.assign}
                                            onChange={(e) => {
                                              const next = [...boysManualRows];
                                              next[idx].assign = e.target.value;
                                              setBoysManualRows(next);
                                            }}
                                            className="w-24 px-1 py-1 bg-sky-50/50 border border-sky-200 rounded text-xs font-bold"
                                          >
                                            <option value="">Place</option>
                                            <option value="first">🥇 1st</option>
                                            <option value="second">🥈 2nd</option>
                                            <option value="third">🥉 3rd</option>
                                            <option value="gradeA">🅰️ A</option>
                                            <option value="gradeB">🅱️ B</option>
                                            <option value="gradeC">🅲 C</option>
                                            <option value="participation">🎗️ Part.</option>
                                          </select>
                                          <button
                                            type="button"
                                            onClick={() => setBoysManualRows(boysManualRows.filter((_, rIdx) => rIdx !== idx))}
                                            className="text-rose-600 hover:bg-rose-50 p-1 rounded cursor-pointer"
                                            title="Remove entry"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                        <div>
                                          <input
                                            type="text"
                                            placeholder="👥 Participants / Team Members (Optional, e.g. Siraj, Ali, Muneer, Zaid...)"
                                            value={row.description || ''}
                                            onChange={(e) => {
                                              const next = [...boysManualRows];
                                              next[idx].description = e.target.value;
                                              setBoysManualRows(next);
                                            }}
                                            className="w-full px-2 py-1 bg-slate-50 border border-sky-100 rounded text-[11px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-sky-300"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* ================= GIRLS SECTION ================= */}
                      {(resActiveView === 'dual' || resActiveView === 'girls') && (
                        <div className="p-4 bg-pink-50/40 border-2 border-pink-300/80 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 bg-pink-100 text-pink-800 rounded-lg text-sm">👧</span>
                              <div>
                                <h4 className="text-xs font-bold text-pink-950">Girls Section Results</h4>
                                <p className="text-[10px] text-pink-800">Assign winners &amp; grades for Girls</p>
                              </div>
                            </div>
                            {db.results.some(r => r.programId === resProgId && r.gender === 'Girls') && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-pink-200/80 text-pink-900 rounded-md">
                                ✅ Published
                              </span>
                            )}
                          </div>

                          {/* Quick Filter */}
                          <input
                            type="text"
                            placeholder="🔍 Filter girls by name, chest #, team..."
                            value={girlsSearch}
                            onChange={(e) => setGirlsSearch(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-pink-200 rounded-xl text-xs font-medium text-brand-ink focus:outline-none focus:border-pink-400"
                          />

                          {/* Candidate List */}
                          {(() => {
                            const girlsCandidates = db.participants.filter(p => {
                              if (!p.programIds.includes(resProgId)) return false;
                              const genderMatch = p.gender === 'Girls';
                              const ageMatch = (resAge as string) === 'All' || p.age === resAge;
                              return genderMatch && ageMatch;
                            });

                            const filtered = girlsCandidates.filter(p => {
                              if (!girlsSearch.trim()) return true;
                              const q = girlsSearch.toLowerCase().trim();
                              const nameMatch = p.name.toLowerCase().includes(q);
                              const numMatch = (p.number || '').toLowerCase().includes(q);
                              const team = db.teams.find(t => t.id === p.teamId)?.name || '';
                              return nameMatch || numMatch || team.toLowerCase().includes(q);
                            });

                            return (
                              <div className="space-y-2">
                                {filtered.length === 0 ? (
                                  <div className="p-3 bg-white/80 rounded-xl border border-pink-200 text-center text-xs text-pink-900/70">
                                    {girlsCandidates.length === 0
                                      ? 'No registered girls candidates found for this program.'
                                      : 'No candidates match search filter.'}
                                  </div>
                                ) : (
                                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                    {filtered.map(p => {
                                      const teamName = db.teams.find(t => t.id === p.teamId)?.name || 'No Team';
                                      const val = resGirlsTies[p.id] || '';
                                      return (
                                        <div
                                          key={p.id}
                                          className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
                                            val === 'first'
                                              ? 'bg-amber-100 border-amber-300 font-bold'
                                              : val === 'second'
                                              ? 'bg-slate-200 border-slate-300 font-bold'
                                              : val === 'third'
                                              ? 'bg-amber-100/70 border-amber-200 font-bold'
                                              : val
                                              ? 'bg-emerald-100 border-emerald-300 font-bold'
                                              : 'bg-white border-pink-200'
                                          }`}
                                        >
                                          <div className="min-w-0 pr-2">
                                            <b className="text-brand-ink block truncate">{p.name}</b>
                                            <small className="text-brand-ink-soft block text-[10px]">
                                              {teamName} &bull; <span className="font-mono font-bold text-pink-800">#{p.number}</span>
                                            </small>
                                          </div>
                                          <select
                                            value={val}
                                            onChange={(e) => setResGirlsTies({ ...resGirlsTies, [p.id]: e.target.value })}
                                            className="px-2 py-1 bg-white border border-pink-300 rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                                          >
                                            <option value="">— Award —</option>
                                            <option value="first">🥇 1st Place</option>
                                            <option value="second">🥈 2nd Place</option>
                                            <option value="third">🥉 3rd Place</option>
                                            <option value="gradeA">🅰️ Grade A</option>
                                            <option value="gradeB">🅱️ Grade B</option>
                                            <option value="gradeC">🅲 Grade C</option>
                                            <option value="participation">🎗️ Part.</option>
                                          </select>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                  {/* Manual rows for Girls */}
                                  <div className="space-y-2 pt-2 border-t border-pink-200/80">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-pink-950">
                                      <span>Manual / Group / Team Winners (Girls)</span>
                                      <button
                                        type="button"
                                        onClick={() => setGirlsManualRows([...girlsManualRows, { name: '', teamId: '', assign: '', description: '' }])}
                                        className="px-2 py-0.5 bg-pink-200/70 hover:bg-pink-300 text-pink-900 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                      >
                                        + Add Group / Winner
                                      </button>
                                    </div>
                                    {girlsManualRows.map((row, idx) => (
                                      <div key={idx} className="p-2 bg-white rounded-xl border border-pink-200 space-y-1.5 shadow-sm">
                                        <div className="flex gap-1.5 items-center">
                                          <input
                                            type="text"
                                            placeholder="Candidate or Group Name (e.g. Team KAAF)"
                                            value={row.name}
                                            onChange={(e) => {
                                              const next = [...girlsManualRows];
                                              next[idx].name = e.target.value;
                                              setGirlsManualRows(next);
                                            }}
                                            className="flex-1 min-w-0 px-2 py-1 bg-pink-50/50 border border-pink-200 rounded text-xs font-semibold"
                                          />
                                          <select
                                            value={row.teamId}
                                            onChange={(e) => {
                                              const next = [...girlsManualRows];
                                              next[idx].teamId = e.target.value;
                                              if (!next[idx].name.trim() && e.target.value) {
                                                const selTeam = db.teams.find(t => t.id === e.target.value);
                                                if (selTeam) next[idx].name = selTeam.name;
                                              }
                                              setGirlsManualRows(next);
                                            }}
                                            className="w-28 px-1.5 py-1 bg-pink-50/50 border border-pink-200 rounded text-xs font-medium"
                                          >
                                            <option value="">Select Team</option>
                                            {db.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                          </select>
                                          <select
                                            value={row.assign}
                                            onChange={(e) => {
                                              const next = [...girlsManualRows];
                                              next[idx].assign = e.target.value;
                                              setGirlsManualRows(next);
                                            }}
                                            className="w-24 px-1 py-1 bg-pink-50/50 border border-pink-200 rounded text-xs font-bold"
                                          >
                                            <option value="">Place</option>
                                            <option value="first">🥇 1st</option>
                                            <option value="second">🥈 2nd</option>
                                            <option value="third">🥉 3rd</option>
                                            <option value="gradeA">🅰️ A</option>
                                            <option value="gradeB">🅱️ B</option>
                                            <option value="gradeC">🅲 C</option>
                                            <option value="participation">🎗️ Part.</option>
                                          </select>
                                          <button
                                            type="button"
                                            onClick={() => setGirlsManualRows(girlsManualRows.filter((_, rIdx) => rIdx !== idx))}
                                            className="text-rose-600 hover:bg-rose-50 p-1 rounded cursor-pointer"
                                            title="Remove entry"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                        <div>
                                          <input
                                            type="text"
                                            placeholder="👥 Participants / Team Members (Optional, e.g. Fatima, Ayesha, Zainab...)"
                                            value={row.description || ''}
                                            onChange={(e) => {
                                              const next = [...girlsManualRows];
                                              next[idx].description = e.target.value;
                                              setGirlsManualRows(next);
                                            }}
                                            className="w-full px-2 py-1 bg-slate-50 border border-pink-100 rounded text-[11px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-pink-300"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* ================= GENERAL SECTION ================= */}
                      {resActiveView === 'general' && (
                        <div className="p-4 bg-emerald-50/40 border-2 border-emerald-300/80 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-sm">🌐</span>
                              <div>
                                <h4 className="text-xs font-bold text-emerald-950">General Section Results</h4>
                                <p className="text-[10px] text-emerald-800">Assign winners &amp; grades for General Competition</p>
                              </div>
                            </div>
                            {db.results.some(r => r.programId === resProgId && r.gender === 'General') && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200/80 text-emerald-900 rounded-md">
                                ✅ Published
                              </span>
                            )}
                          </div>

                          {/* Quick Filter */}
                          <input
                            type="text"
                            placeholder="🔍 Filter candidates by name, chest #, team..."
                            value={genSearch}
                            onChange={(e) => setGenSearch(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-medium text-brand-ink focus:outline-none focus:border-emerald-400"
                          />

                          {/* Candidate List */}
                          {(() => {
                            const genCandidates = db.participants.filter(p => {
                              if (!p.programIds.includes(resProgId)) return false;
                              const ageMatch = (resAge as string) === 'All' || p.age === resAge;
                              return ageMatch;
                            });

                            const filtered = genCandidates.filter(p => {
                              if (!genSearch.trim()) return true;
                              const q = genSearch.toLowerCase().trim();
                              const nameMatch = p.name.toLowerCase().includes(q);
                              const numMatch = (p.number || '').toLowerCase().includes(q);
                              const team = db.teams.find(t => t.id === p.teamId)?.name || '';
                              return nameMatch || numMatch || team.toLowerCase().includes(q);
                            });

                            return (
                              <div className="space-y-2">
                                {filtered.length === 0 ? (
                                  <div className="p-3 bg-white/80 rounded-xl border border-emerald-200 text-center text-xs text-emerald-900/70">
                                    {genCandidates.length === 0
                                      ? 'No registered candidates found for this program.'
                                      : 'No candidates match search filter.'}
                                  </div>
                                ) : (
                                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                    {filtered.map(p => {
                                      const teamName = db.teams.find(t => t.id === p.teamId)?.name || 'No Team';
                                      const val = resGenTies[p.id] || '';
                                      return (
                                        <div
                                          key={p.id}
                                          className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
                                            val === 'first'
                                              ? 'bg-amber-100 border-amber-300 font-bold'
                                              : val === 'second'
                                              ? 'bg-slate-200 border-slate-300 font-bold'
                                              : val === 'third'
                                              ? 'bg-amber-100/70 border-amber-200 font-bold'
                                              : val
                                              ? 'bg-emerald-100 border-emerald-300 font-bold'
                                              : 'bg-white border-emerald-200'
                                          }`}
                                        >
                                          <div className="min-w-0 pr-2">
                                            <b className="text-brand-ink block truncate">{p.name}</b>
                                            <small className="text-brand-ink-soft block text-[10px]">
                                              {teamName} &bull; <span className="font-mono font-bold text-emerald-800">#{p.number}</span>
                                            </small>
                                          </div>
                                          <select
                                            value={val}
                                            onChange={(e) => setResGenTies({ ...resGenTies, [p.id]: e.target.value })}
                                            className="px-2 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                                          >
                                            <option value="">— Award —</option>
                                            <option value="first">🥇 1st Place</option>
                                            <option value="second">🥈 2nd Place</option>
                                            <option value="third">🥉 3rd Place</option>
                                            <option value="gradeA">🅰️ Grade A</option>
                                            <option value="gradeB">🅱️ Grade B</option>
                                            <option value="gradeC">🅲 Grade C</option>
                                            <option value="participation">🎗️ Part.</option>
                                          </select>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Manual rows for General */}
                                <div className="space-y-2 pt-2 border-t border-emerald-200/80">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-950">
                                    <span>Manual / Group / Team Winners (General)</span>
                                    <button
                                      type="button"
                                      onClick={() => setGenManualRows([...genManualRows, { name: '', teamId: '', assign: '', description: '' }])}
                                      className="px-2 py-0.5 bg-emerald-200/70 hover:bg-emerald-300 text-emerald-900 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                    >
                                      + Add Group / Winner
                                    </button>
                                  </div>
                                  {genManualRows.map((row, idx) => (
                                    <div key={idx} className="p-2 bg-white rounded-xl border border-emerald-200 space-y-1.5 shadow-sm">
                                      <div className="flex gap-1.5 items-center">
                                        <input
                                          type="text"
                                          placeholder="Candidate or Group Name (e.g. Team KAAF)"
                                          value={row.name}
                                          onChange={(e) => {
                                            const next = [...genManualRows];
                                            next[idx].name = e.target.value;
                                            setGenManualRows(next);
                                          }}
                                          className="flex-1 min-w-0 px-2 py-1 bg-emerald-50/50 border border-emerald-200 rounded text-xs font-semibold"
                                        />
                                        <select
                                          value={row.teamId}
                                          onChange={(e) => {
                                            const next = [...genManualRows];
                                            next[idx].teamId = e.target.value;
                                            if (!next[idx].name.trim() && e.target.value) {
                                              const selTeam = db.teams.find(t => t.id === e.target.value);
                                              if (selTeam) next[idx].name = selTeam.name;
                                            }
                                            setGenManualRows(next);
                                          }}
                                          className="w-28 px-1.5 py-1 bg-emerald-50/50 border border-emerald-200 rounded text-xs font-medium"
                                        >
                                          <option value="">Select Team</option>
                                          {db.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                        <select
                                          value={row.assign}
                                          onChange={(e) => {
                                            const next = [...genManualRows];
                                            next[idx].assign = e.target.value;
                                            setGenManualRows(next);
                                          }}
                                          className="w-24 px-1 py-1 bg-emerald-50/50 border border-emerald-200 rounded text-xs font-bold"
                                        >
                                          <option value="">Place</option>
                                          <option value="first">🥇 1st</option>
                                          <option value="second">🥈 2nd</option>
                                          <option value="third">🥉 3rd</option>
                                          <option value="gradeA">🅰️ A</option>
                                          <option value="gradeB">🅱️ B</option>
                                          <option value="gradeC">🅲 C</option>
                                          <option value="participation">🎗️ Part.</option>
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() => setGenManualRows(genManualRows.filter((_, rIdx) => rIdx !== idx))}
                                          className="text-rose-600 hover:bg-rose-50 p-1 rounded cursor-pointer"
                                          title="Remove entry"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                      <div>
                                        <input
                                          type="text"
                                          placeholder="👥 Participants / Team Members (Optional, e.g. Siraj, Ali, Muneer, Zaid...)"
                                          value={row.description || ''}
                                          onChange={(e) => {
                                            const next = [...genManualRows];
                                            next[idx].description = e.target.value;
                                            setGenManualRows(next);
                                          }}
                                          className="w-full px-2 py-1 bg-slate-50 border border-emerald-100 rounded text-[11px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-300"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="pt-3 border-t border-brand-line flex gap-2">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="w-1/3 py-3 border border-brand-line text-brand-ink font-bold text-xs rounded-xl hover:bg-brand-bg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveResult}
                        className="w-2/3 py-3 bg-brand-green-800 hover:bg-brand-green-900 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
                      >
                        <span>🏆</span>
                        <span>Save &amp; Publish Results</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* ==================== AUTO RE-NUMBER CHEST NUMBERS MODAL ==================== */}
      {showRenumberModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-brand-panel border-2 border-brand-gold-500 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowRenumberModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-brand-ink-soft hover:bg-brand-bg hover:text-brand-ink transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🔢</span>
              <div>
                <h3 className="font-display font-bold text-brand-green-950 text-base md:text-lg">
                  Sequential Auto Re-Number Chest Numbers
                </h3>
                <p className="text-xs text-brand-ink-soft">
                  Re-arrange and re-assign chest numbers sequentially for all candidates.
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-950 space-y-1">
              <span className="font-bold block">💡 How it works:</span>
              <p className="text-[11px] leading-relaxed">
                If candidate lists were added out of order (e.g. Group A candidates added after Group B), this tool sorts all {db.participants.length} candidates by Group/Category &amp; Team &amp; Name, and assigns sequential chest numbers (101, 102, 103...).
              </p>
            </div>

            <div className="space-y-3">
              {/* Sorting Method */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-green-950 block">
                  1. Candidate Sorting Strategy
                </label>
                <select
                  value={renumberSortBy}
                  onChange={(e) => setRenumberSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-semibold text-brand-ink focus:outline-none"
                >
                  <option value="group_team_name">
                    🏷️ Sort by Group Category (Kids &rarr; Sub Junior &rarr; Junior &rarr; Senior &rarr; Super Senior) then Team &amp; Name (Recommended)
                  </option>
                  <option value="team_name">
                    🛡️ Sort by Team Name then Candidate Name
                  </option>
                  <option value="class_name">
                    📚 Sort by Class (1 to 12) then Candidate Name
                  </option>
                  <option value="name">
                    🔤 Sort by Candidate Name (Alphabetical A-Z)
                  </option>
                </select>
              </div>

              {/* Numbering options */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-green-950 block">
                    2. Starting Chest Number
                  </label>
                  <input
                    type="number"
                    value={renumberStartNo}
                    onChange={(e) => setRenumberStartNo(e.target.value)}
                    placeholder="e.g. 101"
                    className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-mono font-bold text-brand-ink"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-green-950 block">
                    3. Optional Prefix
                  </label>
                  <input
                    type="text"
                    value={renumberPrefix}
                    onChange={(e) => setRenumberPrefix(e.target.value)}
                    placeholder="e.g. C or leave empty"
                    className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-mono font-bold text-brand-ink"
                  />
                </div>
              </div>

              {/* Live Preview of sample candidates */}
              <div className="p-3 bg-brand-bg rounded-xl border border-brand-line/60 space-y-1.5">
                <span className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wider block">
                  Re-Numbering Preview Sample (First 4 Candidates):
                </span>
                {(() => {
                  const groupOrderMap: Record<string, number> = {
                    'Kids': 1,
                    'Sub Junior': 2,
                    'Junior': 3,
                    'Senior': 4,
                    'Super Senior': 5,
                  };
                  let list = [...db.participants];
                  list.sort((a, b) => {
                    if (renumberSortBy === 'group_team_name') {
                      const gA = groupOrderMap[classToAge(a.cls)] || 99;
                      const gB = groupOrderMap[classToAge(b.cls)] || 99;
                      if (gA !== gB) return gA - gB;
                      const teamA = db.teams.find(t => t.id === a.teamId)?.name || '';
                      const teamB = db.teams.find(t => t.id === b.teamId)?.name || '';
                      if (teamA !== teamB) return teamA.localeCompare(teamB);
                      return a.name.localeCompare(b.name);
                    } else if (renumberSortBy === 'team_name') {
                      const teamA = db.teams.find(t => t.id === a.teamId)?.name || '';
                      const teamB = db.teams.find(t => t.id === b.teamId)?.name || '';
                      if (teamA !== teamB) return teamA.localeCompare(teamB);
                      return a.name.localeCompare(b.name);
                    } else if (renumberSortBy === 'class_name') {
                      const cA = parseInt(a.cls, 10) || 0;
                      const cB = parseInt(b.cls, 10) || 0;
                      if (cA !== cB) return cA - cB;
                      return a.name.localeCompare(b.name);
                    } else {
                      return a.name.localeCompare(b.name);
                    }
                  });

                  const startNo = parseInt(renumberStartNo, 10) || 101;

                  if (list.length === 0) {
                    return <p className="text-xs text-brand-ink-soft italic">No candidates to renumber.</p>;
                  }

                  return (
                    <div className="space-y-1">
                      {list.slice(0, 4).map((p, idx) => {
                        const newNum = `${renumberPrefix}${startNo + idx}`;
                        const tName = db.teams.find(t => t.id === p.teamId)?.name || 'No Team';
                        return (
                          <div key={p.id} className="flex items-center justify-between text-xs bg-white p-1.5 rounded-lg border border-brand-line/50">
                            <div className="truncate pr-2">
                              <span className="font-semibold text-brand-ink">{p.name}</span>
                              <span className="text-[10px] text-brand-ink-soft block">
                                Class {p.cls} &bull; {classToAge(p.cls)} &bull; {tName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
                              <span className="text-gray-400 line-through">#{p.number}</span>
                              <span>&rarr;</span>
                              <span className="font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                                #{newNum}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-brand-line">
              <button
                type="button"
                onClick={() => setShowRenumberModal(false)}
                className="w-1/3 py-2.5 border border-brand-line text-brand-ink font-bold text-xs rounded-xl hover:bg-brand-bg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyAutoRenumber}
                className="w-2/3 py-2.5 bg-gradient-to-r from-emerald-700 to-emerald-900 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <span>⚡</span> Apply Auto Re-Numbering
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== EXPORT CANDIDATES EXCEL MODAL ==================== */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-brand-panel border-2 border-emerald-600 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowExportModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-brand-ink-soft hover:bg-brand-bg hover:text-brand-ink transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <span className="text-2xl">📥</span>
              <div>
                <h3 className="font-display font-bold text-brand-green-950 text-base md:text-lg">
                  Export Candidates Excel Sheet
                </h3>
                <p className="text-xs text-brand-ink-soft">
                  Download candidate lists with team and gender breakdown tabs.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Team Filter */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-green-950 block">
                  1. Filter by Team:
                </label>
                <select
                  value={exportTeamFilter}
                  onChange={(e) => setExportTeamFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-semibold text-brand-ink focus:outline-none"
                >
                  <option value="all">🛡️ All Teams (Combined)</option>
                  {db.teams.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.symbol} {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gender Section Filter */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-green-950 block">
                  2. Filter by Gender / Section:
                </label>
                <select
                  value={exportGenderFilter}
                  onChange={(e) => setExportGenderFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-semibold text-brand-ink focus:outline-none"
                >
                  <option value="all">🚻 All Sections (Boys, Girls &amp; General)</option>
                  <option value="Boys">👦 Boys Section Only</option>
                  <option value="Girls">👧 Girls Section Only</option>
                  <option value="General">🌐 General Section Only</option>
                </select>
              </div>

              {/* Excel Sheet Tabs Layout */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-green-950 block">
                  3. Excel Workbook Tab Structure:
                </label>
                <select
                  value={exportSheetStructure}
                  onChange={(e) => setExportSheetStructure(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-semibold text-brand-ink focus:outline-none"
                >
                  <option value="per_team_gender">
                    📑 Separate Tab for Each Team &amp; Gender (e.g. &quot;Team A - Boys&quot;, &quot;Team A - Girls&quot;)
                  </option>
                  <option value="per_team">
                    🛡️ Separate Tab for Each Team (e.g. &quot;Team A&quot;, &quot;Team B&quot;)
                  </option>
                  <option value="single">
                    📄 Single Sheet (All candidates in one main list)
                  </option>
                </select>
              </div>

              {/* Summary Stats */}
              <div className="p-3 bg-brand-bg rounded-xl border border-brand-line text-xs space-y-1">
                <span className="font-bold text-brand-green-950 block">📊 Export Preview Stats:</span>
                {(() => {
                  let count = db.participants;
                  if (exportTeamFilter !== 'all') count = count.filter(p => p.teamId === exportTeamFilter);
                  if (exportGenderFilter !== 'all') count = count.filter(p => p.gender === exportGenderFilter);
                  return (
                    <p className="text-[11px] text-brand-ink-soft">
                      Total Candidates matching criteria: <b className="text-emerald-700 font-bold">{count.length}</b> candidates.
                    </p>
                  );
                })()}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-brand-line">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="w-1/3 py-2.5 border border-brand-line text-brand-ink font-bold text-xs rounded-xl hover:bg-brand-bg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExportCandidatesExcel}
                className="w-2/3 py-2.5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Download Excel File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TEAM LEADER MATRIX GRID CHECKLIST MODAL ==================== */}
      {showMatrixModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-brand-panel border-2 border-emerald-600 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowMatrixModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-brand-ink-soft hover:bg-brand-bg hover:text-brand-ink transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <span className="text-3xl">📋</span>
              <div>
                <h3 className="font-display font-bold text-brand-green-950 text-base md:text-lg">
                  Team Leader Program Grid Checklist Generator
                </h3>
                <p className="text-xs text-brand-ink-soft">
                  Creates a grid matrix sheet with candidate details &amp; program column headers for easy ticking.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Team Filter */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-green-950 block">
                  1. Select Team:
                </label>
                <select
                  value={matrixTeamFilter}
                  onChange={(e) => setMatrixTeamFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-semibold text-brand-ink focus:outline-none"
                >
                  <option value="all">🛡️ All Teams (Individual Grid Sheet per Team)</option>
                  {db.teams.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.symbol} {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category / Group Filter */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-green-950 block">
                  2. Select Category / Group:
                </label>
                <select
                  value={matrixAgeFilter}
                  onChange={(e) => setMatrixAgeFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-semibold text-brand-ink focus:outline-none"
                >
                  <option value="all">🏷️ All Categories (Kids, Sub Junior, Junior, Senior, Super Senior, General)</option>
                  <option value="Kids">🧒 Kids Group</option>
                  <option value="Sub Junior">👦 Sub Junior Group</option>
                  <option value="Junior">👨‍🎓 Junior Group</option>
                  <option value="Senior">🎓 Senior Group</option>
                  <option value="Super Senior">🏆 Super Senior Group</option>
                  <option value="General">🌐 General Section (Open Category)</option>
                </select>
              </div>

              {/* Gender Section Filter */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-green-950 block">
                  3. Select Gender Section:
                </label>
                <select
                  value={matrixGenderFilter}
                  onChange={(e) => setMatrixGenderFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-semibold text-brand-ink focus:outline-none"
                >
                  <option value="all">🚻 All Sections (Boys, Girls &amp; General)</option>
                  <option value="Boys">👦 Boys Section Only</option>
                  <option value="Girls">👧 Girls Section Only</option>
                  <option value="General">🌐 General Section Only</option>
                </select>
              </div>

              {/* Extra Blank Candidate Rows */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-green-950 block">
                  4. Extra Blank Candidate Rows (for hand-written paper additions):
                </label>
                <select
                  value={matrixBlankRows}
                  onChange={(e) => setMatrixBlankRows(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-white border border-brand-line rounded-xl text-xs font-semibold text-brand-ink focus:outline-none"
                >
                  <option value={0}>0 Blank Rows</option>
                  <option value={3}>3 Blank Rows (Recommended)</option>
                  <option value={5}>5 Blank Rows</option>
                  <option value={10}>10 Blank Rows</option>
                </select>
              </div>

              {/* Live Preview Info */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs space-y-1">
                <span className="font-bold text-emerald-950 block flex items-center gap-1">
                  <span>💡</span> Matrix Layout Format Info:
                </span>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  Generates a grid table matching your reference image: candidate <b>Chest No, Name, Class &amp; Division</b> on the left, with <b>Category Programs</b> across column headers and <b>✓ ticks</b> under enrolled programs!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-brand-line flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => setShowMatrixModal(false)}
                className="w-full sm:w-1/4 py-2.5 border border-brand-line text-brand-ink font-bold text-xs rounded-xl hover:bg-brand-bg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateMatrixPrintHTML}
                className="w-full sm:w-2/4 py-2.5 bg-gradient-to-r from-teal-700 to-emerald-900 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print / Download HTML Grid
              </button>
              <button
                type="button"
                onClick={handleGenerateMatrixExcel}
                className="w-full sm:w-2/4 py-2.5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Download Excel Grid (.xlsx)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DUPLICATE DATA INSPECTOR & CLEANER MODAL ==================== */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-fadeIn">
          <div className="bg-brand-panel border-2 border-amber-500 rounded-3xl max-w-3xl w-full p-5 md:p-6 space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col">
            {/* Close button */}
            <button 
              onClick={() => setShowDuplicateModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-brand-ink-soft hover:bg-brand-bg hover:text-brand-ink transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-brand-line pb-3 shrink-0">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-700 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-brand-green-950 text-base md:text-lg flex items-center gap-2">
                  <span>🔍 Data Duplicate Inspector &amp; Cleaner</span>
                  <span className="text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-sans font-bold">
                    Duplicate Inspector
                  </span>
                </h3>
                <p className="text-xs text-brand-ink-soft">
                  Inspect and resolve duplicate programs or conflicting chest numbers.
                </p>
              </div>
            </div>

            {/* Sub Tabs */}
            <div className="flex items-center gap-1.5 border-b border-brand-line pb-2 shrink-0 overflow-x-auto">
              <button
                onClick={() => setDuplicateTab('programs')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  duplicateTab === 'programs'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-brand-bg text-brand-ink-soft hover:text-brand-ink'
                }`}
              >
                <span>🎭 Programs</span>
                <span className="px-1.5 py-0.2 text-[10px] bg-white/20 rounded-full font-mono">
                  {duplicateReport.duplicateProgramsByCode.length + duplicateReport.duplicateProgramsByName.length}
                </span>
              </button>

              <button
                onClick={() => setDuplicateTab('chests')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  duplicateTab === 'chests'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-brand-bg text-brand-ink-soft hover:text-brand-ink'
                }`}
              >
                <span>🎽 Chest Numbers</span>
                <span className="px-1.5 py-0.2 text-[10px] bg-white/20 rounded-full font-mono">
                  {duplicateReport.duplicateChestNumbers.length}
                </span>
              </button>

              <button
                onClick={() => setDuplicateTab('registrations')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  duplicateTab === 'registrations'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-brand-bg text-brand-ink-soft hover:text-brand-ink'
                }`}
              >
                <span>📝 Double Registrations</span>
                <span className="px-1.5 py-0.2 text-[10px] bg-white/20 rounded-full font-mono">
                  {duplicateReport.duplicateRegistrations.length}
                </span>
              </button>

              <button
                onClick={() => setDuplicateTab('results')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  duplicateTab === 'results'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-brand-bg text-brand-ink-soft hover:text-brand-ink'
                }`}
              >
                <span>🏅 Duplicate Results</span>
                <span className="px-1.5 py-0.2 text-[10px] bg-white/20 rounded-full font-mono">
                  {duplicateReport.duplicateResults.length}
                </span>
              </button>
            </div>

            {/* Scrollable Tab Content */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[220px]">
              {/* TAB 1: PROGRAMS */}
              {duplicateTab === 'programs' && (
                <div className="space-y-3">
                  {duplicateReport.duplicateProgramsByCode.length === 0 && duplicateReport.duplicateProgramsByName.length === 0 ? (
                    <div className="p-8 text-center bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-medium">
                      ✨ No duplicate program codes or names found! Everything is clean.
                    </div>
                  ) : (
                    <>
                      {/* By Code */}
                      {duplicateReport.duplicateProgramsByCode.map(({ code, programs }) => (
                        <div key={`code_${code}`} className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                              <span>🔢 Duplicate Code:</span>
                              <code className="bg-amber-200 text-amber-900 font-mono px-2 py-0.5 rounded font-bold">{code}</code>
                              <span className="text-[10px] text-amber-800 font-normal">({programs.length} programs sharing code)</span>
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {programs.map((p, idx) => (
                              <div key={p.id} className="p-2 bg-white border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                                <div className="min-w-0 flex-1">
                                  <span className="font-bold text-brand-green-950 truncate block">
                                    {idx === 0 ? '⭐ [Master] ' : '⚠️ [Duplicate] '}{p.name}
                                  </span>
                                  <span className="text-[10px] text-brand-ink-soft block">
                                    Stage: {p.venue || p.stageType || 'Main Stage'} &bull; Day: {p.day || '1'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => {
                                      setShowDuplicateModal(false);
                                      handleOpenProgram(p.id);
                                    }}
                                    className="px-2 py-1 bg-brand-bg hover:bg-brand-line text-brand-ink-soft text-[10px] font-bold rounded-lg cursor-pointer"
                                  >
                                    ✏️ Edit
                                  </button>
                                  {idx > 0 && (
                                    <button
                                      onClick={() => {
                                        if (confirm(`Delete duplicate program "${p.name}" (${p.code})?`)) {
                                          handleDeleteProgram(p.id);
                                        }
                                      }}
                                      className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold rounded-lg cursor-pointer"
                                    >
                                      🗑️ Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* By Name */}
                      {duplicateReport.duplicateProgramsByName.map(({ name, programs }) => (
                        <div key={`name_${name}`} className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                              <span>🔤 Duplicate Program Name:</span>
                              <span className="bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded">{name}</span>
                              <span className="text-[10px] text-amber-800 font-normal">({programs.length} instances)</span>
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {programs.map((p, idx) => (
                              <div key={p.id} className="p-2 bg-white border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                                <div className="min-w-0 flex-1">
                                  <span className="font-bold text-brand-green-950 truncate block">
                                    {idx === 0 ? '⭐ [Master] ' : '⚠️ [Duplicate] '}{p.name} ({p.code})
                                  </span>
                                  <span className="text-[10px] text-brand-ink-soft block">
                                    Code: <code>{p.code}</code> &bull; Stage: {p.venue || p.stageType || 'Main Stage'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => {
                                      setShowDuplicateModal(false);
                                      handleOpenProgram(p.id);
                                    }}
                                    className="px-2 py-1 bg-brand-bg hover:bg-brand-line text-brand-ink-soft text-[10px] font-bold rounded-lg cursor-pointer"
                                  >
                                    ✏️ Edit
                                  </button>
                                  {idx > 0 && (
                                    <button
                                      onClick={() => {
                                        if (confirm(`Delete duplicate program "${p.name}"?`)) {
                                          handleDeleteProgram(p.id);
                                        }
                                      }}
                                      className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold rounded-lg cursor-pointer"
                                    >
                                      🗑️ Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: CHEST NUMBERS */}
              {duplicateTab === 'chests' && (
                <div className="space-y-3">
                  {duplicateReport.duplicateChestNumbers.length === 0 ? (
                    <div className="p-8 text-center bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-medium">
                      ✨ No duplicate chest numbers assigned! Every candidate has a unique chest number.
                    </div>
                  ) : (
                    duplicateReport.duplicateChestNumbers.map(({ number, participants }) => (
                      <div key={`chest_${number}`} className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                            <span>🎽 Chest #{number}:</span>
                            <span className="text-[10px] text-amber-800 font-normal">({participants.length} candidates sharing chest number #{number})</span>
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {participants.map((pt) => {
                            const team = db.teams.find(t => t.id === pt.teamId);
                            return (
                              <div key={pt.id} className="p-2 bg-white border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                                <div className="min-w-0 flex-1">
                                  <span className="font-bold text-brand-green-950 truncate block">
                                    {pt.name} <span className="font-normal text-brand-ink-soft">({pt.cls ? `Class ${pt.cls}${pt.division}` : pt.age})</span>
                                  </span>
                                  <span className="text-[10px] text-brand-ink-soft block">
                                    Team: {team ? team.name : 'No Team'} &bull; Enrolled Programs: {pt.programIds.length}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => {
                                      setShowDuplicateModal(false);
                                      handleOpenParticipant(pt.id);
                                    }}
                                    className="px-2 py-1 bg-brand-bg hover:bg-brand-line text-brand-ink-soft text-[10px] font-bold rounded-lg cursor-pointer"
                                  >
                                    ✏️ Edit Chest #
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Delete candidate record "${pt.name}"?`)) {
                                        handleDeleteParticipant(pt.id);
                                      }
                                    }}
                                    className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold rounded-lg cursor-pointer"
                                  >
                                    🗑️ Delete
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: DOUBLE REGISTRATIONS */}
              {duplicateTab === 'registrations' && (
                <div className="space-y-3">
                  {duplicateReport.duplicateRegistrations.length === 0 ? (
                    <div className="p-8 text-center bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-medium">
                      ✨ No candidate is double-registered in the same program.
                    </div>
                  ) : (
                    duplicateReport.duplicateRegistrations.map(({ participant, program, count }) => (
                      <div key={`reg_${participant.id}_${program.id}`} className="p-3 bg-white border border-amber-300 rounded-2xl flex items-center justify-between gap-2 text-xs">
                        <div>
                          <b className="text-brand-green-950 font-bold block">
                            Candidate: {participant.name} (#{participant.number})
                          </b>
                          <span className="text-[11px] text-amber-900 block mt-0.5">
                            Program: <b>{program.name}</b> ({program.code}) &bull; Enrolled <b>{count} times</b>
                          </span>
                        </div>
                        <button
                          onClick={handleAutoFixDuplicateRegistrations}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-2xs shrink-0"
                        >
                          ⚡ Deduplicate Entry
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: DUPLICATE RESULTS */}
              {duplicateTab === 'results' && (
                <div className="space-y-3">
                  {duplicateReport.duplicateResults.length === 0 ? (
                    <div className="p-8 text-center bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-medium">
                      ✨ No duplicate result records found. Every program has at most one result recorded.
                    </div>
                  ) : (
                    duplicateReport.duplicateResults.map(({ programId, programName, results }) => (
                      <div key={`res_${programId}`} className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2 text-xs">
                        <b className="text-amber-950 font-bold block">
                          Program: {programName} ({results.length} result entries found)
                        </b>
                        <div className="space-y-1">
                          {results.map((r, idx) => (
                            <div key={r.id} className="p-2 bg-white rounded-xl border border-amber-200 flex items-center justify-between gap-2">
                              <span>Entry #{idx + 1} &bull; Recorded: {new Date(r.datetime).toLocaleString()}</span>
                              {idx > 0 && (
                                <button
                                  onClick={() => {
                                    if (confirm('Delete duplicate result entry?')) {
                                      onUpdateDb({
                                        ...db,
                                        results: db.results.filter(x => x.id !== r.id)
                                      });
                                    }
                                  }}
                                  className="px-2 py-1 bg-rose-100 text-rose-800 rounded-lg text-[10px] font-bold hover:bg-rose-200 cursor-pointer"
                                >
                                  🗑️ Delete Result
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-brand-line shrink-0">
              <button
                type="button"
                onClick={handleAutoFixAllDuplicates}
                disabled={duplicateReport.totalIssueCount === 0}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-800 hover:from-amber-700 hover:to-amber-900 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" /> ⚡ Auto-Clean All Duplicates Now
              </button>

              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="px-4 py-2 border border-brand-line text-brand-ink font-bold text-xs rounded-xl hover:bg-brand-bg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
