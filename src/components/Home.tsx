import { useEffect, useState, useRef } from 'react';
import { Database, Result, Program } from '../types';
import { AGE_ICONS, GENDER_ICONS, AGES } from '../db';
import { Trophy, Clock, MapPin, Sparkles, Award, Volume2, VolumeX, AlertTriangle, CheckCircle2, Radio, Calendar, Printer, Share2, Copy, Check, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getProgramScheduleStatus, ProgramScheduleStatus } from '../utils/time';
import { fireCelebrationConfetti, fireGoldWinnerBurst, fireContinuousVictoryConfetti } from '../utils/confetti';
import { playVictoryFanfare, stopVictoryMusic, toggleAudioMute, isAudioMuted } from '../utils/victoryAudio';
import { ChampionsPodiumCard } from './ChampionsPodiumCard';
import { LiveTeamScoreTicker } from './LiveTeamScoreTicker';
import { AlwaysOnTeamBanner } from './AlwaysOnTeamBanner';
import { TeamPerformanceGraph } from './TeamPerformanceGraph';
import { CelebrationPodiumModal } from './CelebrationPodiumModal';

function ConfettiEffect() {
  const [particles, setParticles] = useState<{ id: number; left: string; delay: string; size: string; color: string; animClass: string }[]>([]);

  useEffect(() => {
    const colors = ['#ffd700', '#c0c0c0', '#cd7f32', '#4e4e37', '#ab9b74', '#ff4500', '#32cd32', '#00bfff'];
    const anims = ['animate-confetti-1', 'animate-confetti-2', 'animate-confetti-3'];
    const p = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 4}s`,
      size: `${Math.floor(Math.random() * 6) + 6}px`,
      color: colors[Math.floor(Math.random() * colors.length)],
      animClass: anims[Math.floor(Math.random() * anims.length)],
    }));
    setParticles(p);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10 rounded-2xl">
      {particles.map((pt) => (
        <div
          key={pt.id}
          className={`absolute rounded-full opacity-0 ${pt.animClass}`}
          style={{
            left: pt.left,
            animationDelay: pt.delay,
            width: pt.size,
            height: pt.size,
            backgroundColor: pt.color,
            top: '-10px',
          }}
        />
      ))}
    </div>
  );
}

interface HomeProps {
  db: Database;
  onNavigateToResults: () => void;
  onUpdateDb?: (newDb: Database) => void;
}

export default function Home({ db, onNavigateToResults, onUpdateDb }: HomeProps) {
  const [spotlightSlide, setSpotlightSlide] = useState(0);
  const [scheduleNowMins, setScheduleNowMins] = useState(0);
  const [showPodiumModal, setShowPodiumModal] = useState(false);
  const [countdownSecs, setCountdownSecs] = useState(-1);
  const [showNoticePopup, setShowNoticePopup] = useState(false);
  const [currentNoticeIndex, setCurrentNoticeIndex] = useState(0);
  const [scheduleFilterTab, setScheduleFilterTab] = useState<'ACTIVE' | 'PASSED' | 'ALL'>('ACTIVE');

  // Compute active notices
  const activeNotices = (() => {
    if (db.settings.showNotice === false) return [];
    if (db.settings.notices && db.settings.notices.length > 0) {
      const activeList = db.settings.notices.filter(n => n.active !== false);
      if (activeList.length > 0) return activeList;
    }
    if (db.settings.noticeText) {
      return [{
        id: 'legacy_notice',
        title: db.settings.noticeTitle || '📢 NOTICE BOARD ANNOUNCEMENT',
        text: db.settings.noticeText,
        type: 'urgent' as const,
        active: true,
        date: 'Today'
      }];
    }
    return [];
  })();

  const safeNoticeIndex = Math.min(currentNoticeIndex, Math.max(0, activeNotices.length - 1));

  const handleNextNotice = () => {
    if (activeNotices.length > 0) {
      setCurrentNoticeIndex((prev) => (prev + 1) % activeNotices.length);
    }
  };

  const handlePrevNotice = () => {
    if (activeNotices.length > 0) {
      setCurrentNoticeIndex((prev) => (prev - 1 + activeNotices.length) % activeNotices.length);
    }
  };

  // Auto-cycle notices based on noticeDurationSecs setting (default 8s) on home page if multiple notices exist
  useEffect(() => {
    if (activeNotices.length <= 1) return;
    const durationMs = (db.settings.noticeDurationSecs || 8) * 1000;
    const interval = setInterval(() => {
      setCurrentNoticeIndex((prev) => (prev + 1) % activeNotices.length);
    }, durationMs);
    return () => clearInterval(interval);
  }, [activeNotices.length, db.settings.noticeDurationSecs]);

  // Auto show notice popup on page load if active notices exist and not dismissed in session
  useEffect(() => {
    if (activeNotices.length > 0) {
      const dismissed = sessionStorage.getItem('mrms_notice_popup_dismissed');
      if (!dismissed) {
        setShowNoticePopup(true);
      }
    }
  }, [activeNotices.length]);

  const handleDismissNoticePopup = () => {
    setShowNoticePopup(false);
    sessionStorage.setItem('mrms_notice_popup_dismissed', '1');
  };

  const [isMuted, setIsMuted] = useState(() => isAudioMuted());
  const lastTriggeredPodiumRef = useRef<number>(0);
  const lastTriggeredConfettiRef = useRef<number>(0);

  // Live Sync 1: Auto-open podium ceremony on all connected screens when Admin turns on Live Celebration switch
  useEffect(() => {
    const isActive = db.settings?.isLiveCelebrationActive;
    const revealTime = db.settings?.revealPodiumTime || 0;

    if (isActive) {
      if (revealTime !== lastTriggeredPodiumRef.current) {
        lastTriggeredPodiumRef.current = revealTime;
        setShowPodiumModal(true);
        setCountdownSecs(db.settings?.skipPodiumCountdown ? 0 : 5);
        playVictoryFanfare(60);
        fireContinuousVictoryConfetti(60000);
      }
    } else {
      setShowPodiumModal(false);
      stopVictoryMusic();
      lastTriggeredPodiumRef.current = 0;
    }
  }, [db.settings?.isLiveCelebrationActive, db.settings?.revealPodiumTime, db.settings?.skipPodiumCountdown]);

  // Live Sync 2: Continuous 1-minute victory confetti shower when Admin triggers
  useEffect(() => {
    const confettiUntil = db.settings?.confettiUntil;
    if (db.settings?.isLiveCelebrationActive && confettiUntil && confettiUntil > Date.now() && confettiUntil > lastTriggeredConfettiRef.current) {
      lastTriggeredConfettiRef.current = confettiUntil;
      const durationMs = Math.min(60000, confettiUntil - Date.now());
      fireContinuousVictoryConfetti(durationMs);
      playVictoryFanfare(Math.ceil(durationMs / 1000));
    } else if (!db.settings?.isLiveCelebrationActive && !db.settings?.showFinalWinner) {
      stopVictoryMusic();
      setShowPodiumModal(false);
    }
  }, [db.settings?.confettiUntil, db.settings?.isLiveCelebrationActive, db.settings?.showFinalWinner]);

  // Countdown timer effect
  useEffect(() => {
    let timer: any;
    if (showPodiumModal && countdownSecs > 0) {
      timer = setInterval(() => {
        setCountdownSecs((prev) => prev - 1);
      }, 1000);
    } else if (showPodiumModal && countdownSecs === 0) {
      fireGoldWinnerBurst();
      const cancelConfetti = fireContinuousVictoryConfetti(60000); // 1 minute confetti shower!
      playVictoryFanfare(60);
      return () => {
        cancelConfetti();
      };
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showPodiumModal, countdownSecs]);

  const handleOpenPodium = () => {
    setShowPodiumModal(true);
    setCountdownSecs(5); // Start 5 seconds countdown reveal!
    playVictoryFanfare(60);
  };

  const handleToggleMute = () => {
    const muted = toggleAudioMute();
    setIsMuted(muted);
  };

  const handleClosePodiumModal = () => {
    setShowPodiumModal(false);
    stopVictoryMusic();
    const currentTime = db.settings?.revealPodiumTime || Date.now();
    sessionStorage.setItem('mrms_dismissed_podium_time', String(currentTime));
    if (onUpdateDb && db.settings?.isLiveCelebrationActive) {
      onUpdateDb({
        ...db,
        settings: {
          ...db.settings,
          isLiveCelebrationActive: false
        }
      });
    }
  };

  // Maintain time of day for "NOW" & "NEXT" badges
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setScheduleNowMins(now.getHours() * 60 + now.getMinutes());
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Compute spotlight slides
  const slides = [];
  const sortedTeams = [...db.teams].sort((a, b) => b.points - a.points);
  
  sortedTeams.forEach((team, index) => {
    if (team.points > 0) {
      const rank = index === 0 ? '🏆 Leading Team' : index === 1 ? '🥈 2nd Place Team' : '🥉 3rd Place Team';
      slides.push({
        label: rank,
        symbol: team.symbol,
        logoUrl: team.logoUrl,
        name: team.name,
        points: team.points,
        color: team.color
      });
    }
  });

  // Calculate top Boys, Girls, and General section teams from points
  const genderPts: Record<string, { Boys: number; Girls: number; General: number }> = {};
  db.teams.forEach(t => { genderPts[t.id] = { Boys: 0, Girls: 0, General: 0 }; });

  db.results.forEach(r => {
    const pts = db.settings.points;
    const isBoys = r.gender === 'Boys';
    const isGirls = r.gender === 'Girls';
    const prog = db.programs.find(p => p.id === r.programId);
    const isGeneralProg = prog?.categories.some(c => (c.gender as string) === 'General' || (c.age as string) === 'All' || (c.age as string) === 'General') || (r.gender as string) === 'General' || (r.age as string) === 'General' || (r.age as string) === 'All';
    const genderKey = isGeneralProg ? 'General' : (isBoys ? 'Boys' : isGirls ? 'Girls' : 'General');

    ['first', 'second', 'third'].forEach(pos => {
      const key = pos as 'first' | 'second' | 'third';
      let winPts = pts[key];
      if (isGeneralProg) {
        if (key === 'first') winPts = pts.generalFirst ?? pts.first;
        else if (key === 'second') winPts = pts.generalSecond ?? pts.second;
        else if (key === 'third') winPts = pts.generalThird ?? pts.third;
      }

      (r.winners[key] || []).forEach(w => {
        if (w.teamId && genderPts[w.teamId]) {
          genderPts[w.teamId][genderKey] += winPts;
        }
      });
    });
    ['gradeA', 'gradeB', 'gradeC', 'participation'].forEach(gKey => {
      const key = gKey as 'gradeA' | 'gradeB' | 'gradeC' | 'participation';
      (r.grades[key] || []).forEach(e => {
        if (e.teamId && genderPts[e.teamId]) {
          genderPts[e.teamId][genderKey] += pts[key];
        }
      });
    });
  });

  const topBoysTeam = [...db.teams]
    .map(t => ({ team: t, pts: genderPts[t.id]?.Boys || 0 }))
    .sort((a, b) => b.pts - a.pts)[0];

  const topGirlsTeam = [...db.teams]
    .map(t => ({ team: t, pts: genderPts[t.id]?.Girls || 0 }))
    .sort((a, b) => b.pts - a.pts)[0];

  const topGeneralTeam = [...db.teams]
    .map(t => ({ team: t, pts: genderPts[t.id]?.General || 0 }))
    .sort((a, b) => b.pts - a.pts)[0];

  if (topBoysTeam && topBoysTeam.pts > 0) {
    slides.push({
      label: '👦 Top Boys Section Team',
      symbol: topBoysTeam.team.symbol,
      logoUrl: topBoysTeam.team.logoUrl,
      name: topBoysTeam.team.name,
      points: topBoysTeam.pts,
      color: topBoysTeam.team.color
    });
  }

  if (topGirlsTeam && topGirlsTeam.pts > 0) {
    slides.push({
      label: '👧 Top Girls Section Team',
      symbol: topGirlsTeam.team.symbol,
      logoUrl: topGirlsTeam.team.logoUrl,
      name: topGirlsTeam.team.name,
      points: topGirlsTeam.pts,
      color: topGirlsTeam.team.color
    });
  }

  if (topGeneralTeam && topGeneralTeam.pts > 0) {
    slides.push({
      label: '🌐 Top General Section Team',
      symbol: topGeneralTeam.team.symbol,
      logoUrl: topGeneralTeam.team.logoUrl,
      name: topGeneralTeam.team.name,
      points: topGeneralTeam.pts,
      color: topGeneralTeam.team.color
    });
  }

  // Auto-rotate spotlight slides every 4 seconds
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setSpotlightSlide(prev => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides.length]);

  // Organize schedule grouped by custom Program Schedule Note, Day, or Stage (ONLY time-scheduled programs)
  const scheduleDays: Record<string, Program[]> = {};
  
  // Filter programs that have explicit date/time or schedule note assigned
  const scheduledPrograms = db.programs.filter(p => {
    const hasExplicitSchedule = Boolean(
      (p.startTime && p.startTime.trim()) ||
      (p.day && p.day.trim()) ||
      (p.schedule && p.schedule.trim() && p.schedule.trim().toLowerCase() !== 'pending schedule')
    );
    if (!hasExplicitSchedule) return false;

    const status = getProgramScheduleStatus(p, db.results);
    if (scheduleFilterTab === 'ACTIVE') {
      return status === 'LIVE' || status === 'UPCOMING';
    }
    if (scheduleFilterTab === 'PASSED') {
      return status === 'PASSED' || status === 'COMPLETED';
    }
    return true; // 'ALL' time-scheduled
  });

  scheduledPrograms.forEach(p => {
    let sGroup = 'Scheduled Programs';
    if (p.schedule && p.schedule.trim() && p.schedule.trim().toLowerCase() !== 'pending schedule') {
      sGroup = p.schedule.trim();
    } else if (p.day && p.day.trim()) {
      sGroup = p.day.trim();
    } else if (p.venue && p.venue.trim()) {
      sGroup = p.venue.trim();
    } else if (p.startTime && p.startTime.trim()) {
      sGroup = 'General Schedule';
    }

    if (!scheduleDays[sGroup]) scheduleDays[sGroup] = [];
    scheduleDays[sGroup].push(p);
  });

  const latestResults = [...db.results]
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
    .slice(0, 3);

  const getCandidateClassInfo = (name: string, teamId: string | null) => {
    const p = db.participants.find(x => x.name === name && x.teamId === teamId);
    if (!p || !p.cls) return '';
    return p.cls + (p.division ? ' ' + p.division : '');
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const handlePrintNoticeBoardSchedule = () => {
    const eventName = db.settings.eventName || 'KALIMA 2k26 MEELAD FEST';
    const boardName = db.settings.boardName || 'KALIMA 2k26 MEELAD FEST';

    const bodyHTML = `
      <div style="font-family: Arial, Helvetica, sans-serif; padding: 25px; max-width: 950px; margin: 0 auto; color: #111827; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 4px solid #15803d; padding-bottom: 16px;">
          <div style="font-size: 11px; font-weight: bold; color: #b45309; text-transform: uppercase; letter-spacing: 2px;">OFFICIAL NOTICE BOARD PUBLICATION</div>
          <h1 style="margin: 4px 0 0; color: #15803d; font-size: 28px; font-weight: 800; text-transform: uppercase;">${eventName}</h1>
          <h2 style="margin: 4px 0 0; color: #374151; font-size: 16px; font-weight: 600;">${boardName}</h2>
          <div style="display: inline-block; margin-top: 10px; padding: 6px 18px; background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 20px; color: #15803d; font-weight: 700; font-size: 13px;">
            📅 PROGRAMME SCHEDULE SHEET
          </div>
        </div>

        ${Object.keys(scheduleDays).length === 0 ? `
          <div style="text-align: center; padding: 40px; color: #6b7280; font-style: italic; border: 1px dashed #d1d5db; border-radius: 8px;">
            No scheduled programs found.
          </div>
        ` : Object.keys(scheduleDays).sort().map(sGroup => `
          <div style="margin-bottom: 24px; page-break-inside: avoid;">
            <div style="background-color: #15803d; color: #ffffff; padding: 8px 14px; font-size: 13px; font-weight: bold; border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center;">
              <span>📆 ${sGroup}</span>
              <span style="font-size: 11px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 10px;">Total: ${scheduleDays[sGroup].length} Items</span>
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
                ${scheduleDays[sGroup].map((p, idx) => {
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
            <div style="margin-top: 6px; font-size: 10px; color: #9ca3af;">Published on: ${new Date().toLocaleString()} &bull; Total Scheduled: ${scheduledPrograms.length}</div>
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
      printWin.document.write(`<html><head><title>Notice Board Schedule</title></head><body>${bodyHTML}</body></html>`);
      printWin.document.close();
      printWin.print();
    }
  };

  return (
    <div className="view active pb-20 max-w-2xl mx-auto space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-brand-green-800 to-brand-green-900 rounded-2xl p-5 md:p-6 text-white relative overflow-hidden shadow-md select-none">
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold-400 mb-1">
              {db.settings.boardName || 'KALIMA 2k26 MEELAD FEST'}
            </p>
            <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-wide mb-1 text-white leading-tight">
              {db.settings.eventName || 'KALIMA 2k26 MEELAD FEST'}
            </h1>
            <p className="font-serif italic text-xs md:text-sm text-brand-gold-100 opacity-90 leading-snug">
              {db.settings.subtitle || 'Live Competition Results, Scoring Points & Schedules'}
            </p>
          </div>

          {/* Event Logo on the side */}
          {db.settings.eventLogo ? (
            <div className="shrink-0 bg-white/90 p-1.5 rounded-2xl shadow-xl border border-white/30 backdrop-blur-md">
              <img 
                src={db.settings.eventLogo} 
                alt="Event Logo" 
                className="w-16 h-16 md:w-20 md:h-20 object-contain rounded-xl"
              />
            </div>
          ) : (
            <div className="shrink-0 bg-white/10 p-2.5 rounded-2xl border border-white/20 backdrop-blur-md flex flex-col items-center justify-center w-16 h-16 md:w-20 md:h-20 text-brand-gold-300">
              <svg viewBox="0 0 120 120" className="w-10 h-10 md:w-12 md:h-12 drop-shadow">
                <path
                  d="M60 14c-25 4-42 25-42 48 0 26 21 47 47 47 17 0 32-9 40-23-7 4-15 6-23 6-26 0-47-21-47-47 0-13 5-24 13-31z"
                  fill="currentColor"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Counter Stats */}
        <div className="grid grid-cols-4 gap-2 mt-6 relative z-10">
          <div className="bg-white/8 rounded-xl p-2.5 text-center">
            <b className="block font-mono text-base md:text-lg font-bold text-brand-gold-400">
              {db.participants.length}
            </b>
            <span className="text-[9px] opacity-75">Candidates</span>
          </div>
          <div className="bg-white/8 rounded-xl p-2.5 text-center">
            <b className="block font-mono text-base md:text-lg font-bold text-brand-gold-400">
              {db.teams.length}
            </b>
            <span className="text-[9px] opacity-75">Teams</span>
          </div>
          <div className="bg-white/8 rounded-xl p-2.5 text-center">
            <b className="block font-mono text-base md:text-lg font-bold text-brand-gold-400">
              {AGES.length}
            </b>
            <span className="text-[9px] opacity-75">Categories</span>
          </div>
          <div className="bg-white/8 rounded-xl p-2.5 text-center">
            <b className="block font-mono text-base md:text-lg font-bold text-brand-gold-400">
              {db.programs.length}
            </b>
            <span className="text-[9px] opacity-75">Programs</span>
          </div>
        </div>
      </div>

      {/* LIVE SCROLLING MARQUEE TICKER LINE ("INGACE LINE AAYI POKANAM - DARK COLOR") */}
      {activeNotices.length > 0 && (
        <div 
          onClick={() => setShowNoticePopup(true)}
          className="bg-[#051a12] border-2 border-amber-400/90 rounded-2xl p-2.5 shadow-xl flex items-center gap-2.5 cursor-pointer hover:bg-[#08261b] transition-all overflow-hidden group select-none relative"
        >
          <div className="flex items-center gap-1.5 bg-amber-400 text-slate-950 px-2.5 py-1 rounded-xl font-extrabold text-[10px] shrink-0 shadow-md animate-pulse">
            <span>📢</span>
            <span className="uppercase tracking-wider font-black">LIVE TICKER</span>
            <span className="bg-slate-950 text-amber-300 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
              {activeNotices.length}
            </span>
          </div>

          <div className="overflow-hidden whitespace-nowrap min-w-0 flex-1 relative">
            <div className="inline-block animate-marquee whitespace-nowrap text-xs font-bold space-x-8">
              {activeNotices.map((n, idx) => (
                <span key={n.id || idx} className="inline-flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shadow-xs ${
                    n.type === 'sponsor' ? 'bg-purple-600 text-white animate-pulse ring-1 ring-purple-300' :
                    n.type === 'urgent' ? 'bg-rose-500 text-white animate-pulse ring-1 ring-rose-300' :
                    n.type === 'important' ? 'bg-amber-400 text-slate-950 font-black animate-pulse ring-1 ring-amber-200' :
                    n.type === 'info' ? 'bg-sky-500 text-white' : 'bg-emerald-500 text-white'
                  }`}>
                    {n.type === 'sponsor' ? `🛍️ ${n.sponsorName || 'SPONSORED AD'}` : n.title}
                  </span>
                  <span className="text-white font-bold text-xs leading-none drop-shadow-xs">
                    {n.type === 'sponsor' ? `${n.title}: ${n.text}` : n.text}
                  </span>
                  <span className="text-amber-400 font-extrabold text-sm ml-4">✦</span>
                </span>
              ))}
            </div>
          </div>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowNoticePopup(true);
            }}
            className="shrink-0 px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] rounded-lg shadow-md transition-transform active:scale-95 flex items-center gap-1"
          >
            <span>↗</span> Popup View
          </button>
        </div>
      )}

      {/* ONE-BY-ONE NOTICE SLIDESHOW / CAROUSEL ON HOME PAGE */}
      {activeNotices.length > 0 && (() => {
        const notice = activeNotices[safeNoticeIndex];
        if (!notice) return null;

        const isSponsor = notice.type === 'sponsor';
        const isUrgent = notice.type === 'urgent';
        const isImportant = notice.type === 'important';
        const isInfo = notice.type === 'info';
        
        const cardBg = isSponsor
          ? 'bg-purple-50/95 border-2 border-purple-300 text-purple-950 shadow-sm'
          : isUrgent
          ? 'bg-rose-50/95 border-2 border-rose-300 text-rose-950 shadow-sm'
          : isImportant
          ? 'bg-amber-50/95 border-2 border-amber-300 text-amber-950 shadow-sm'
          : isInfo
          ? 'bg-sky-50/95 border-2 border-sky-300 text-sky-950 shadow-sm'
          : 'bg-emerald-50/95 border-2 border-emerald-300 text-emerald-950 shadow-sm';

        const innerBg = isSponsor
          ? 'bg-white/90 border border-purple-200 text-purple-950'
          : isUrgent
          ? 'bg-white/90 border border-rose-200 text-rose-950'
          : isImportant
          ? 'bg-white/90 border border-amber-200 text-amber-950'
          : isInfo
          ? 'bg-white/90 border border-sky-200 text-sky-950'
          : 'bg-white/90 border border-emerald-200 text-emerald-950';

        const badgeStyle = isSponsor
          ? 'bg-purple-700 text-white font-black'
          : isUrgent
          ? 'bg-rose-600 text-white font-black'
          : isImportant
          ? 'bg-amber-500 text-slate-950 font-black'
          : isInfo
          ? 'bg-sky-600 text-white font-extrabold'
          : 'bg-emerald-700 text-white font-extrabold';

        const badgeLabel = isSponsor 
          ? '🛍️ SPONSORED AD' 
          : isUrgent ? '🚨 URGENT' : isImportant ? '⚡ IMPORTANT' : isInfo ? 'ℹ️ INFO' : '📢 GENERAL';

        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-display font-extrabold text-xs md:text-sm text-brand-green-950 uppercase tracking-wider flex items-center gap-1.5">
                <span>{isSponsor ? '🛍️' : '📢'}</span> {isSponsor ? 'Sponsor Feature' : 'Official Announcements'} ({safeNoticeIndex + 1} of {activeNotices.length})
              </h3>
              <button
                onClick={() => setShowNoticePopup(true)}
                className="text-[10px] font-extrabold text-brand-green-800 hover:text-brand-green-950 underline flex items-center gap-1 cursor-pointer"
              >
                <span>🔔</span> Full Screen Popup
              </button>
            </div>

            <div className={`p-4 md:p-5 rounded-3xl shadow-md border relative overflow-hidden space-y-3 ${cardBg} animate-fadeIn`}>
              <div className="flex items-center justify-between gap-2 border-b border-brand-line/60 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black tracking-wider shrink-0 ${badgeStyle}`}>
                    {badgeLabel}
                  </span>
                  <b className="text-xs md:text-sm font-extrabold tracking-wide truncate">
                    {notice.title}
                  </b>
                </div>
                {notice.date && (
                  <span className="text-[10px] font-mono font-bold bg-white/80 text-brand-ink px-2 py-0.5 rounded-md border border-brand-line shrink-0">
                    {notice.date}
                  </span>
                )}
              </div>

              {notice.sponsorName && (
                <div className="text-[11px] font-bold text-purple-900 bg-purple-100/80 px-3 py-1 rounded-xl border border-purple-200 inline-flex items-center gap-1.5">
                  <span>🏬</span> Sponsored by: <b className="text-purple-950">{notice.sponsorName}</b>
                </div>
              )}

              {/* Poster Image if uploaded */}
              {notice.imageUrl && (
                <div className="rounded-2xl overflow-hidden border border-black/10 bg-slate-950 shadow-sm my-2 relative group">
                  <img 
                    src={notice.imageUrl} 
                    alt={notice.sponsorName || notice.title}
                    className="w-full max-h-72 object-contain mx-auto"
                  />
                </div>
              )}
              
              <div className={`p-3.5 rounded-2xl text-xs md:text-sm font-semibold leading-relaxed whitespace-pre-wrap min-h-[50px] shadow-2xs ${innerBg}`}>
                {notice.text}
              </div>

              {notice.linkUrl && (
                <div className="pt-1">
                  <a
                    href={notice.linkUrl.startsWith('http') ? notice.linkUrl : `https://${notice.linkUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <span>🔗</span> Visit Sponsor &rarr;
                  </a>
                </div>
              )}

              {/* Carousel Controls Bar */}
              <div className="flex items-center justify-between pt-1 border-t border-brand-line/60">
                <button
                  onClick={handlePrevNotice}
                  className="px-3 py-1.5 bg-white hover:bg-brand-bg text-brand-green-950 font-extrabold text-xs rounded-xl border border-brand-line transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs"
                  title="Previous Notice"
                >
                  <span>❮</span> Prev
                </button>

                {/* Dots Indicator */}
                <div className="flex items-center gap-1.5">
                  {activeNotices.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentNoticeIndex(i)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        i === safeNoticeIndex ? 'w-5 bg-brand-green-800' : 'w-2 bg-brand-green-300 hover:bg-brand-green-500'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={handleNextNotice}
                  className="px-3 py-1.5 bg-brand-green-800 hover:bg-brand-green-700 text-white font-black text-xs rounded-xl shadow transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                  title="Next Notice"
                >
                  Next <span>❯</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* NOTICE POPUP MODAL ("ONE BY ONE STEP-BY-STEP POPUP MODEL") */}
      {showNoticePopup && activeNotices.length > 0 && (() => {
        const notice = activeNotices[safeNoticeIndex];
        if (!notice) return null;

        const isSponsor = notice.type === 'sponsor';
        const isUrgent = notice.type === 'urgent';
        const isImportant = notice.type === 'important';
        const isInfo = notice.type === 'info';
        
        const cardStyle = isSponsor
          ? 'bg-purple-50 border-2 border-purple-300 text-purple-950'
          : isUrgent
          ? 'bg-rose-50 border-2 border-rose-300 text-rose-950'
          : isImportant
          ? 'bg-amber-50 border-2 border-amber-300 text-amber-950'
          : isInfo
          ? 'bg-sky-50 border-2 border-sky-300 text-sky-950'
          : 'bg-emerald-50 border-2 border-emerald-300 text-emerald-950';

        const badgeStyle = isSponsor
          ? 'bg-purple-700 text-white font-black'
          : isUrgent
          ? 'bg-rose-600 text-white font-black'
          : isImportant
          ? 'bg-amber-500 text-slate-950 font-black'
          : isInfo
          ? 'bg-sky-600 text-white font-black'
          : 'bg-emerald-700 text-white font-black';

        const badgeLabel = isSponsor
          ? '🛍️ SPONSORED AD'
          : isUrgent ? '🚨 URGENT' : isImportant ? '⚡ IMPORTANT' : isInfo ? 'ℹ️ INFO' : '📢 GENERAL';

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn no-print">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-5 md:p-6 space-y-4 border-2 border-brand-gold-500/80 max-h-[90vh] overflow-y-auto relative animate-scaleIn text-brand-green-950">
              <div className="flex items-center justify-between border-b border-brand-line pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-3.5 w-3.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600"></span>
                  </span>
                  <h3 className="font-display font-extrabold text-brand-green-950 text-xs md:text-sm uppercase tracking-wider flex items-center gap-1.5">
                    📢 {isSponsor ? 'SPONSOR FEATURE' : 'ANNOUNCEMENT'} ({safeNoticeIndex + 1} OF {activeNotices.length})
                  </h3>
                </div>
                <button 
                  onClick={handleDismissNoticePopup}
                  className="p-1.5 text-brand-ink-soft hover:text-brand-ink hover:bg-brand-bg rounded-xl cursor-pointer font-extrabold text-base transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Single Notice Card */}
              <div className={`p-4 md:p-5 rounded-2xl shadow-sm space-y-3 ${cardStyle} animate-fadeIn`}>
                <div className="flex items-center justify-between gap-2 border-b border-black/10 pb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${badgeStyle}`}>
                    {badgeLabel}
                  </span>
                  {notice.date && (
                    <span className="text-[10px] font-mono font-bold bg-white/90 text-brand-ink px-2 py-0.5 rounded border border-black/10">
                      {notice.date}
                    </span>
                  )}
                </div>

                <h4 className="font-extrabold text-sm md:text-base leading-snug tracking-wide">
                  {notice.title}
                </h4>

                {notice.sponsorName && (
                  <div className="text-xs font-bold text-purple-950 bg-purple-100 px-3 py-1 rounded-xl border border-purple-200 inline-flex items-center gap-1.5">
                    <span>🏬</span> Sponsored by: <b>{notice.sponsorName}</b>
                  </div>
                )}

                {/* Poster Image */}
                {notice.imageUrl && (
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 shadow-inner my-2 relative">
                    <img 
                      src={notice.imageUrl} 
                      alt={notice.sponsorName || notice.title}
                      className="w-full max-h-80 object-contain mx-auto"
                    />
                  </div>
                )}

                <p className="text-xs md:text-sm font-semibold leading-relaxed whitespace-pre-wrap bg-white p-3.5 rounded-xl border border-black/10 shadow-2xs">
                  {notice.text}
                </p>

                {notice.linkUrl && (
                  <div className="pt-1">
                    <a
                      href={notice.linkUrl.startsWith('http') ? notice.linkUrl : `https://${notice.linkUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full justify-center py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl shadow transition-all cursor-pointer flex items-center gap-2"
                    >
                      <span>🔗</span> Visit Sponsor Link &rarr;
                    </a>
                  </div>
                )}
              </div>

              {/* Popup Step & Navigation Footer */}
              <div className="pt-2 border-t border-brand-line space-y-3">
                {activeNotices.length > 1 && (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={handlePrevNotice}
                      className="px-3.5 py-2 bg-brand-bg hover:bg-brand-line/60 text-brand-green-950 font-bold text-xs rounded-xl border border-brand-line transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                    >
                      ❮ Prev
                    </button>

                    <div className="flex items-center gap-1.5">
                      {activeNotices.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentNoticeIndex(i)}
                          className={`h-2 rounded-full transition-all cursor-pointer ${
                            i === safeNoticeIndex ? 'w-5 bg-brand-green-800' : 'w-2 bg-brand-green-200 hover:bg-brand-green-400'
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={handleNextNotice}
                      className="px-3.5 py-2 bg-brand-green-800 hover:bg-brand-green-700 text-white font-black text-xs rounded-xl shadow transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                    >
                      Next ❯
                    </button>
                  </div>
                )}

                <button
                  onClick={handleDismissNoticePopup}
                  className="w-full py-3 bg-brand-green-800 hover:bg-brand-green-700 text-white font-black text-xs md:text-sm rounded-2xl shadow-md cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-2"
                >
                  <span>👍</span> Got it / Close Popup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Always On Team Ribbon/Banner */}
      {db.settings.showAlwaysTeamBanner && (
        <AlwaysOnTeamBanner db={db} />
      )}

      {/* Live Team Score Flash Ticker */}
      {db.settings.showTeamTicker && (
        <LiveTeamScoreTicker db={db} />
      )}

      {/* Team Standing Performance Bar & Trend Graph */}
      {db.settings.showTeamAnalyticsGraph && (
        <TeamPerformanceGraph db={db} />
      )}

      {/* Championship Podium Card */}
      {db.settings.showFinalWinner && sortedTeams.length > 0 && (
        <ChampionsPodiumCard db={db} />
      )}

      {/* Celebration Podium Modal */}
      <CelebrationPodiumModal
        db={db}
        showPodiumModal={showPodiumModal}
        countdownSecs={countdownSecs}
        isMuted={isMuted}
        handleToggleMute={handleToggleMute}
        handleClosePodiumModal={handleClosePodiumModal}
        onUpdateDb={onUpdateDb}
      />

      {/* Live Schedule Segment */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-brand-gold-500" />
              <h2 className="font-display font-bold text-brand-green-900 text-sm md:text-base">
                Live Program Schedule
              </h2>
            </div>
            <button
              onClick={handlePrintNoticeBoardSchedule}
              className="px-2.5 py-1 bg-brand-green-800 hover:bg-brand-green-900 text-brand-gold-300 text-[10px] font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1 transition-colors"
              title="Print Schedule Sheet for Notice Board"
            >
              <Printer className="w-3 h-3" />
              <span>🖨️ Notice Board Print</span>
            </button>
          </div>

          {/* Schedule Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-brand-panel p-1 border border-brand-line rounded-xl text-[10px] font-bold">
            <button
              onClick={() => setScheduleFilterTab('ACTIVE')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                scheduleFilterTab === 'ACTIVE'
                  ? 'bg-brand-green-800 text-brand-gold-300 shadow-xs'
                  : 'text-brand-ink-soft hover:text-brand-ink'
              }`}
            >
              🎯 Active & Upcoming
            </button>
            <button
              onClick={() => setScheduleFilterTab('PASSED')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                scheduleFilterTab === 'PASSED'
                  ? 'bg-amber-800 text-amber-100 shadow-xs'
                  : 'text-brand-ink-soft hover:text-brand-ink'
              }`}
            >
              ⚠️ Time Passed / Completed
            </button>
            <button
              onClick={() => setScheduleFilterTab('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                scheduleFilterTab === 'ALL'
                  ? 'bg-brand-green-800 text-brand-gold-300 shadow-xs'
                  : 'text-brand-ink-soft hover:text-brand-ink'
              }`}
            >
              📋 All Scheduled
            </button>
          </div>
        </div>

        {Object.keys(scheduleDays).length === 0 ? (
          <div className="p-5 bg-brand-panel border border-brand-line rounded-xl text-center text-brand-ink-soft text-xs select-none space-y-1">
            <div className="font-bold text-brand-ink">
              {scheduleFilterTab === 'ACTIVE' ? 'No active or upcoming time-scheduled programs.' : 'No scheduled programs matching filter.'}
            </div>
            <p className="text-[11px] opacity-80">
              Only programs with assigned dates & times appear here. Unscheduled programs can be found on the <b>Program Board</b>.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.keys(scheduleDays).sort().map(scheduleLabel => {
              return (
                <div key={scheduleLabel} className="space-y-2">
                  <div className="text-[11px] font-bold text-brand-green-800 tracking-wide flex items-center gap-1.5 px-2 bg-brand-green-50/70 py-1.5 rounded-lg border border-brand-green-100/40">
                    <span className="text-xs">📅</span>
                    <span className="uppercase">{scheduleLabel}</span>
                    <span className="ml-auto text-[9px] font-mono font-medium text-brand-ink-soft bg-white border px-1.5 py-0.5 rounded-md">
                      {scheduleDays[scheduleLabel].length} {scheduleDays[scheduleLabel].length === 1 ? 'program' : 'programs'}
                    </span>
                  </div>

                  <div className="space-y-2 pl-1">
                    {scheduleDays[scheduleLabel].map(p => {
                      const cats = p.categories.map(c => `${c.gender}${c.age === 'All' ? '' : ' ' + c.age}`).join(', ');
                      const timeFormatted = p.startTime ? `${p.startTime}${p.endTime ? ' - ' + p.endTime : ''}` : '';
                      const stageVenue = p.venue || p.stageType || 'Stage';
                      const status = getProgramScheduleStatus(p, db.results);

                      return (
                        <div
                          key={p.id}
                          className={`border rounded-2xl p-3.5 bg-brand-panel shadow-xs transition-all duration-300 space-y-2.5 ${
                            status === 'LIVE'
                              ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500/30'
                              : status === 'PASSED'
                              ? 'border-amber-300/80 bg-amber-50/10'
                              : status === 'COMPLETED'
                              ? 'border-emerald-200 opacity-80'
                              : 'border-brand-line hover:border-brand-green-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0 font-mono text-[10px] font-extrabold bg-brand-green-800 text-brand-gold-300 px-2 py-0.5 rounded-lg shadow-xs">
                                {p.code}
                              </span>
                              <b className="text-xs md:text-sm text-brand-green-950 font-bold truncate">
                                {p.name}
                              </b>
                            </div>

                            {/* Status Badge */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {status === 'LIVE' && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-600 text-white animate-pulse shadow-xs">
                                  <Radio className="w-2.5 h-2.5 animate-spin" /> Live Now
                                </span>
                              )}
                              {status === 'UPCOMING' && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-sky-100 text-sky-900 border border-sky-200">
                                  <Clock className="w-2.5 h-2.5" /> Upcoming
                                </span>
                              )}
                              {status === 'PASSED' && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-700" /> Time Passed
                                </span>
                              )}
                              {status === 'COMPLETED' && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" /> Result Published
                                </span>
                              )}

                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                p.stageType === 'Offstage' 
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                                  : 'bg-sky-100 text-sky-900 border border-sky-200'
                              }`}>
                                {p.stageType === 'Offstage' ? '📝 Offstage' : '🎭 Main Stage'}
                              </span>
                            </div>
                          </div>

                          {/* Date, Time & Stage Badges */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-brand-line/40 text-[11px]">
                            {p.day && (
                              <span className="inline-flex items-center gap-1 bg-amber-50/90 text-amber-950 border border-amber-200/90 px-2.5 py-0.5 rounded-lg font-bold">
                                <span>📅</span> {p.day}
                              </span>
                            )}
                            {timeFormatted && (
                              <span className="inline-flex items-center gap-1 bg-emerald-50/90 text-emerald-950 border border-emerald-200/90 px-2.5 py-0.5 rounded-lg font-bold font-mono">
                                <span>⏰</span> {timeFormatted}
                              </span>
                            )}
                            {stageVenue && (
                              <span className="inline-flex items-center gap-1 bg-sky-50/90 text-sky-950 border border-sky-200/90 px-2.5 py-0.5 rounded-lg font-bold">
                                <span>📍</span> {stageVenue}
                              </span>
                            )}
                            {cats && (
                              <span className="inline-flex items-center gap-1 bg-brand-bg text-brand-ink-soft border border-brand-line px-2 py-0.5 rounded-lg font-medium text-[10px] ml-auto">
                                {cats}
                              </span>
                            )}
                          </div>

                          {/* Category-Wise Multi-Schedule Breakdown */}
                          {p.categorySchedules && Object.keys(p.categorySchedules).length > 0 && (
                            <div className="pt-2 border-t border-brand-line/40 space-y-1">
                              <span className="text-[10px] font-extrabold text-brand-green-900 block">
                                ⏱️ Category Time & Stage Slots:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {Object.entries(p.categorySchedules).map(([catAge, sched]) => (
                                  <div key={catAge} className="p-1.5 bg-brand-green-50/80 rounded-lg border border-brand-green-200/60 text-[10px] flex items-center justify-between">
                                    <span className="font-extrabold text-brand-green-950">{catAge}</span>
                                    <span className="font-semibold text-brand-green-900">
                                      {sched.startTime ? `⏰ ${sched.startTime}` : ''} {sched.venue ? `📍 ${sched.venue}` : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Warning Banner if Time Passed */}
                          {status === 'PASSED' && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2 text-[10px] flex items-center gap-1.5 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                              <span><b>Scheduled time has passed.</b> Activity is awaiting result publication or rescheduling.</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Latest Results Segment - Matching exact Vertical Stack Layout from screenshot */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-gold-500" />
            <h2 className="font-display font-bold text-brand-green-900 text-sm md:text-base flex items-center gap-2">
              <span>📌</span> Latest Competition Results
            </h2>
          </div>
          {db.results.length > 3 && (
            <button
              onClick={onNavigateToResults}
              className="text-[10px] font-bold text-brand-green-700 hover:text-brand-gold-700 uppercase tracking-wider"
            >
              See All &rarr;
            </button>
          )}
        </div>

        {latestResults.length === 0 ? (
          <div className="p-10 bg-brand-panel border border-brand-line rounded-2xl text-center space-y-1 shadow-sm">
            <div className="text-3xl text-brand-ink-soft/40">🏆</div>
            <b className="block text-xs text-brand-ink font-bold">No results published yet</b>
            <p className="text-[10px] text-brand-ink-soft max-w-xs mx-auto">
              Results will appear here as soon as the administrator publishes them on the panel.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {latestResults.map(r => {
              const prog = db.programs.find(p => p.id === r.programId);
              const isGeneralProg = prog?.categories?.some(c => (c.gender as string) === 'General' || (c.age as string) === 'All' || (c.age as string) === 'General') || (r.gender as string) === 'General' || (r.age as string) === 'General' || (r.age as string) === 'All';

              const categoryLabel = (r.age as string) === 'All' || (r.age as string) === 'General' 
                ? (r.gender === 'General' ? 'General' : r.gender)
                : `${r.age} - ${r.gender}`;

              return (
                <div key={r.id} className="bg-[#fffef7] border border-amber-200/80 rounded-2xl p-3.5 shadow-sm space-y-2.5 hover:shadow-md transition-shadow">
                  {/* Category Pin Badge matching screenshot */}
                  <div className="flex items-center justify-between gap-2 border-b border-amber-100 pb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100/90 text-amber-950 border border-amber-300/80 shadow-xs">
                        <span>📌</span> {categoryLabel}
                      </span>
                      {prog && (
                        <span className="font-mono text-[10px] font-extrabold bg-brand-green-100 text-brand-green-900 px-2 py-0.5 rounded border border-brand-green-200">
                          {prog.code} &bull; {prog.name}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {new Date(r.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Top Winners matching exact screenshot layout: Medal + Student Name (Class) + Team Code + Points */}
                  <div className="space-y-1.5">
                    {['first', 'second', 'third'].map(pos => {
                      const key = pos as 'first' | 'second' | 'third';
                      const medal = key === 'first' ? '🥇' : key === 'second' ? '🥈' : '🥉';
                      const entries = r.winners[key] || [];

                      let winPts = db.settings.points[key];
                      if (isGeneralProg) {
                        if (key === 'first') winPts = db.settings.points.generalFirst ?? db.settings.points.first;
                        else if (key === 'second') winPts = db.settings.points.generalSecond ?? db.settings.points.second;
                        else if (key === 'third') winPts = db.settings.points.generalThird ?? db.settings.points.third;
                      }

                      return entries.map((winner, winIndex) => {
                        const team = db.teams.find(t => t.id === winner.teamId);
                        const clsInfo = getCandidateClassInfo(winner.name, winner.teamId);
                        const customPts = (winner as any).points;
                        const assignedPts = customPts !== undefined ? customPts : winPts;

                        return (
                          <div key={key + winIndex} className="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg hover:bg-amber-50/50 transition-colors">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="shrink-0 text-base">{medal}</span>
                              <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                                <b className="text-slate-900 uppercase font-black text-xs tracking-tight">
                                  {winner.name}
                                </b>
                                {clsInfo && (
                                  <span className="text-[11px] text-slate-600 font-bold">
                                    ({clsInfo})
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 ml-2">
                              <span className="text-[11px] font-bold text-slate-700 tracking-wide">
                                {team ? `${team.symbol || ''} ${team.name}` : '—'}
                              </span>
                              <span className="font-mono text-xs font-black text-amber-800 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-md min-w-[42px] text-center">
                                +{assignedPts}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
