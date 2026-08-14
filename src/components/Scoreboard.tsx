import { useState, useEffect, useRef } from 'react';
import { Database, Team } from '../types';
import { AGE_ICONS, GENDER_ICONS, AGES } from '../db';
import { Award, TrendingUp, TrendingDown, Minus, Sparkles, User, ChevronDown, ChevronUp, Crown, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fireCelebrationConfetti, fireGoldWinnerBurst, fireContinuousVictoryConfetti } from '../utils/confetti';
import { playVictoryFanfare, stopVictoryMusic, toggleAudioMute, isAudioMuted } from '../utils/victoryAudio';
import { applySuspenseRotation } from '../utils/suspense';
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

interface ScoreboardProps {
  db: Database;
  onUpdateDb?: (newDb: Database) => void;
}

const AGE_LABEL_ICONS: Record<string, string> = {
  'Kids': '👶',
  'Sub Junior': '🎒',
  'Junior': '🎓',
  'Senior': '🏅',
  'Super Senior': '🏆',
  'General': '🌐'
};

const ALL_AGES_LIST = ['Kids', 'Sub Junior', 'Junior', 'Senior', 'Super Senior', 'General'];

interface CatStageBreakdown {
  offstageBoys: number;
  offstageGirls: number;
  offstageGeneral: number;
  mainstageBoys: number;
  mainstageGirls: number;
  mainstageGeneral: number;
  total: number;
}

interface FullTeamBreakdown {
  team: Team;
  rank: number;
  offstageBoys: number;
  offstageGirls: number;
  offstageGeneral: number;
  offstageTotal: number;

  mainstageBoys: number;
  mainstageGirls: number;
  mainstageGeneral: number;
  mainstageTotal: number;

  totalBoys: number;
  totalGirls: number;
  totalGeneral: number;
  grandTotal: number;

  categoryBreakdown: Record<string, CatStageBreakdown>;
}

export default function Scoreboard({ db, onUpdateDb }: ScoreboardProps) {
  const [showPodiumModal, setShowPodiumModal] = useState(false);
  const [countdownSecs, setCountdownSecs] = useState(-1);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [selectedTeamTab, setSelectedTeamTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMuted, setIsMuted] = useState(() => isAudioMuted());
  const [suspenseStep, setSuspenseStep] = useState(0);

  useEffect(() => {
    if (!db.settings?.suspenseSwapMode) {
      setSuspenseStep(0);
      return;
    }
    const intervalMs = (db.settings?.suspenseIntervalSec || 3) * 1000;
    const interval = setInterval(() => {
      setSuspenseStep(prev => prev + 1);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [db.settings?.suspenseSwapMode, db.settings?.suspenseIntervalSec]);

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
    if (confettiUntil && confettiUntil > Date.now() && confettiUntil > lastTriggeredConfettiRef.current) {
      lastTriggeredConfettiRef.current = confettiUntil;
      const durationMs = Math.min(60000, confettiUntil - Date.now());
      fireContinuousVictoryConfetti(durationMs);
      playVictoryFanfare(Math.ceil(durationMs / 1000));
    }
  }, [db.settings?.confettiUntil]);

  // Stop celebration effects & audio when Admin turns off celebration
  useEffect(() => {
    if (!db.settings?.isLiveCelebrationActive && !db.settings?.showFinalWinner) {
      stopVictoryMusic();
      setShowPodiumModal(false);
    }
  }, [db.settings?.isLiveCelebrationActive, db.settings?.showFinalWinner]);

  // Countdown timer effect & 1-minute continuous confetti & music trigger on zero
  useEffect(() => {
    let timer: any;
    if (showPodiumModal && countdownSecs > 0) {
      timer = setInterval(() => {
        setCountdownSecs((prev) => prev - 1);
      }, 1000);
    } else if (showPodiumModal && countdownSecs === 0) {
      // Reveal moment: 1-minute continuous confetti rain & victory music!
      fireGoldWinnerBurst();
      const cancelConfetti = fireContinuousVictoryConfetti(60000); // 1 minute confetti shower!
      playVictoryFanfare(60); // Play 1 minute fanfare music
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

  const handleTrigger1MinConfetti = () => {
    fireContinuousVictoryConfetti(60000); // Fires 1 minute continuous victory confetti!
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
  let sortedTeams = [...db.teams].sort((a, b) => b.points - a.points);
  sortedTeams = applySuspenseRotation(sortedTeams, db.settings?.suspenseSwapMode, suspenseStep);
  const prev = db.prevRanks || {};

  const progMap = new Map();
  db.programs.forEach(p => progMap.set(p.id, p));

  // Compute point totals specifically for Boys, Girls, and General sections
  const genderPts: Record<string, { Boys: number; Girls: number; General: number }> = {};
  db.teams.forEach(t => { genderPts[t.id] = { Boys: 0, Girls: 0, General: 0 }; });

  // Compute comprehensive stage & category point breakdowns for each team
  const teamBreakdowns: Record<string, FullTeamBreakdown> = {};

  db.teams.forEach(t => {
    const teamRank = sortedTeams.findIndex(st => st.id === t.id) + 1;
    const cats: Record<string, CatStageBreakdown> = {};
    ALL_AGES_LIST.forEach(age => {
      cats[age] = { offstageBoys: 0, offstageGirls: 0, offstageGeneral: 0, mainstageBoys: 0, mainstageGirls: 0, mainstageGeneral: 0, total: 0 };
    });

    teamBreakdowns[t.id] = {
      team: t,
      rank: teamRank,
      offstageBoys: 0,
      offstageGirls: 0,
      offstageGeneral: 0,
      offstageTotal: 0,

      mainstageBoys: 0,
      mainstageGirls: 0,
      mainstageGeneral: 0,
      mainstageTotal: 0,

      totalBoys: 0,
      totalGirls: 0,
      totalGeneral: 0,
      grandTotal: 0,

      categoryBreakdown: cats
    };
  });

  db.results.forEach(r => {
    const pts = db.settings.points;
    const prog = progMap.get(r.programId);
    const isOffstage = prog?.stageType === 'Offstage';
    const g = r.gender; 
    const gStr = r.gender as string;
    const rAgeStr = r.age as string;

    // Check if this program is a General program or General category
    const isGeneralProg = prog?.categories.some(c => (c.gender as string) === 'General' || (c.age as string) === 'All' || (c.age as string) === 'General') || gStr === 'General' || rAgeStr === 'General' || rAgeStr === 'All';

    const age = isGeneralProg ? 'General' : ((r.age && r.age !== 'All') ? r.age : 'General');

    const addPts = (teamId: string | null, pointVal: number) => {
      if (!teamId) return;

      const isGenSection = isGeneralProg || gStr === 'General';

      // Gender summary
      if (genderPts[teamId]) {
        if (isGenSection) genderPts[teamId].General += pointVal;
        else if (g === 'Boys') genderPts[teamId].Boys += pointVal;
        else if (g === 'Girls') genderPts[teamId].Girls += pointVal;
        else genderPts[teamId].General += pointVal;
      }

      // Detailed Team Breakdown
      const tb = teamBreakdowns[teamId];
      if (tb) {
        tb.grandTotal += pointVal;

        if (isOffstage) {
          tb.offstageTotal += pointVal;
          if (isGenSection) {
            tb.offstageGeneral += pointVal;
            tb.totalGeneral += pointVal;
          } else if (g === 'Boys') {
            tb.offstageBoys += pointVal;
            tb.totalBoys += pointVal;
          } else if (g === 'Girls') {
            tb.offstageGirls += pointVal;
            tb.totalGirls += pointVal;
          } else {
            tb.offstageGeneral += pointVal;
            tb.totalGeneral += pointVal;
          }
        } else {
          // Main stage
          tb.mainstageTotal += pointVal;
          if (isGenSection) {
            tb.mainstageGeneral += pointVal;
            tb.totalGeneral += pointVal;
          } else if (g === 'Boys') {
            tb.mainstageBoys += pointVal;
            tb.totalBoys += pointVal;
          } else if (g === 'Girls') {
            tb.mainstageGirls += pointVal;
            tb.totalGirls += pointVal;
          } else {
            tb.mainstageGeneral += pointVal;
            tb.totalGeneral += pointVal;
          }
        }

        // Category breakdown
        if (!tb.categoryBreakdown[age]) {
          tb.categoryBreakdown[age] = { offstageBoys: 0, offstageGirls: 0, offstageGeneral: 0, mainstageBoys: 0, mainstageGirls: 0, mainstageGeneral: 0, total: 0 };
        }
        const catObj = tb.categoryBreakdown[age];
        catObj.total += pointVal;
        if (isOffstage) {
          if (isGenSection) catObj.offstageGeneral += pointVal;
          else if (g === 'Boys') catObj.offstageBoys += pointVal;
          else if (g === 'Girls') catObj.offstageGirls += pointVal;
          else catObj.offstageGeneral += pointVal;
        } else {
          if (isGenSection) catObj.mainstageGeneral += pointVal;
          else if (g === 'Boys') catObj.mainstageBoys += pointVal;
          else if (g === 'Girls') catObj.mainstageGirls += pointVal;
          else catObj.mainstageGeneral += pointVal;
        }
      }
    };

    ['first', 'second', 'third'].forEach(pos => {
      const key = pos as 'first' | 'second' | 'third';
      let winPts = pts[key];
      if (isGeneralProg) {
        if (key === 'first') winPts = pts.generalFirst ?? pts.first;
        else if (key === 'second') winPts = pts.generalSecond ?? pts.second;
        else if (key === 'third') winPts = pts.generalThird ?? pts.third;
      }
      (r.winners[key] || []).forEach(w => addPts(w.teamId, winPts));
    });

    ['gradeA', 'gradeB', 'gradeC', 'participation'].forEach(gKey => {
      const key = gKey as 'gradeA' | 'gradeB' | 'gradeC' | 'participation';
      (r.grades[key] || []).forEach(e => addPts(e.teamId, pts[key]));
    });
  });

  // Calculate maximum points value to normalize visual bars
  let maxGenderVal = 1;
  db.teams.forEach(t => {
    const g = genderPts[t.id] || { Boys: 0, Girls: 0, General: 0 };
    maxGenderVal = Math.max(maxGenderVal, g.Boys, g.Girls, g.General);
  });

  // Compute category-wise summaries (Boys Section & Girls Section vs Divisions)
  const categoryCombos: { gender: 'Boys' | 'Girls'; age: typeof AGES[number] }[] = [];
  ['Boys', 'Girls'].forEach(g => {
    AGES.forEach(a => {
      categoryCombos.push({ gender: g as any, age: a });
    });
  });

  // Calculate Overall Individual Champions (Kalaprathibha = Boys, Kalathilakam = Girls)
  const overallBoysCandidates: Record<string, { name: string; teamId: string | null; points: number }> = {};
  const overallGirlsCandidates: Record<string, { name: string; teamId: string | null; points: number }> = {};

  db.results.forEach(r => {
    const pts = db.settings.points;
    const targetMap = r.gender === 'Boys' ? overallBoysCandidates : r.gender === 'Girls' ? overallGirlsCandidates : null;
    if (!targetMap) return;

    const prog = progMap.get(r.programId);
    const isGen = prog?.categories.some(c => (c.gender as string) === 'General' || (c.age as string) === 'All' || (c.age as string) === 'General') || (r.gender as string) === 'General' || (r.age as string) === 'General' || (r.age as string) === 'All';
    const isGroupProg = Boolean(prog?.group || isGen);

    // Group & General programs award points solely to the TEAM score, NOT to individual candidate toppers!
    if (isGroupProg) return;

    ['first', 'second', 'third'].forEach(pos => {
      const key = pos as 'first' | 'second' | 'third';
      let winPts = pts[key];
      if (isGen) {
        if (key === 'first') winPts = pts.generalFirst ?? pts.first;
        else if (key === 'second') winPts = pts.generalSecond ?? pts.second;
        else if (key === 'third') winPts = pts.generalThird ?? pts.third;
      }

      (r.winners[key] || []).forEach(w => {
        const candKey = `${w.name}|${w.teamId || ''}`;
        if (!targetMap[candKey]) {
          targetMap[candKey] = { name: w.name, teamId: w.teamId, points: 0 };
        }
        targetMap[candKey].points += winPts;
      });
    });

    ['gradeA', 'gradeB', 'gradeC', 'participation'].forEach(gKey => {
      const key = gKey as 'gradeA' | 'gradeB' | 'gradeC' | 'participation';
      (r.grades[key] || []).forEach(e => {
        const candKey = `${e.name}|${e.teamId || ''}`;
        if (!targetMap[candKey]) {
          targetMap[candKey] = { name: e.name, teamId: e.teamId, points: 0 };
        }
        targetMap[candKey].points += pts[key];
      });
    });
  });

  const topKalaprathibha = Object.values(overallBoysCandidates)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  const topKalathilakam = Object.values(overallGirlsCandidates)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  const categorySummaries = categoryCombos.map(({ gender, age }) => {
    const catResults = db.results.filter(r => r.gender === gender && r.age === age);
    if (!catResults.length) return null;

    const teamScores: Record<string, number> = {};
    const candidateScores: Record<string, { name: string; teamId: string | null; points: number }> = {};
    const pts = db.settings.points;

    catResults.forEach(r => {
      const prog = progMap.get(r.programId);
      const isGroupProg = Boolean(prog?.group || prog?.categories.some(c => (c.gender as string) === 'General' || (c.age as string) === 'General' || (c.age as string) === 'All') || (r.gender as string) === 'General' || (r.age as string) === 'General' || (r.age as string) === 'All');

      ['first', 'second', 'third'].forEach(pos => {
        const key = pos as 'first' | 'second' | 'third';
        let winPts = pts[key];
        if (isGroupProg) {
          if (key === 'first') winPts = pts.generalFirst ?? pts.first;
          else if (key === 'second') winPts = pts.generalSecond ?? pts.second;
          else if (key === 'third') winPts = pts.generalThird ?? pts.third;
        }

        (r.winners[key] || []).forEach(w => {
          if (w.teamId) teamScores[w.teamId] = (teamScores[w.teamId] || 0) + winPts;
          
          if (!isGroupProg) {
            const candKey = `${w.name}|${w.teamId || ''}`;
            if (!candidateScores[candKey]) {
              candidateScores[candKey] = { name: w.name, teamId: w.teamId, points: 0 };
            }
            candidateScores[candKey].points += winPts;
          }
        });
      });

      ['gradeA', 'gradeB', 'gradeC', 'participation'].forEach(gKey => {
        const key = gKey as 'gradeA' | 'gradeB' | 'gradeC' | 'participation';
        (r.grades[key] || []).forEach(e => {
          if (e.teamId) teamScores[e.teamId] = (teamScores[e.teamId] || 0) + pts[key];

          if (!isGroupProg) {
            const candKey = `${e.name}|${e.teamId || ''}`;
            if (!candidateScores[candKey]) {
              candidateScores[candKey] = { name: e.name, teamId: e.teamId, points: 0 };
            }
            candidateScores[candKey].points += pts[key];
          }
        });
      });
    });

    const teamRankings = Object.entries(teamScores)
      .map(([teamId, points]) => ({
        team: db.teams.find(t => t.id === teamId),
        points
      }))
      .filter(x => x.team)
      .sort((a, b) => b.points - a.points);

    const topCandidates = Object.values(candidateScores)
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);

    return {
      gender,
      age,
      teamRankings,
      topCandidates
    };
  }).filter(Boolean);

  const renderBar = (label: string, icon: string, val: number, colorClass: string) => {
    const percentage = Math.round((val / maxGenderVal) * 100);
    return (
      <div className="flex items-center gap-3 text-xs">
        <span className="w-14 text-brand-ink-soft shrink-0 flex items-center gap-1">
          <span>{icon}</span> {label}
        </span>
        <div className="flex-1 h-3 bg-brand-bg rounded-full overflow-hidden border border-brand-line/50">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="w-8 text-right font-mono font-bold text-brand-ink">{val}</span>
      </div>
    );
  };

  // Helper renderer for Team Detailed Breakdown Card
  const renderTeamDetailCard = (tb: FullTeamBreakdown) => {
    const activeCats = Object.entries(tb.categoryBreakdown).filter(([_, c]) => c.total > 0);

    return (
      <div className="bg-brand-bg/80 border border-brand-line rounded-2xl p-4 space-y-4 font-sans text-xs shadow-inner">
        {/* Header Team Title */}
        <div className="flex items-center justify-between border-b border-brand-line pb-2">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-white border border-brand-line flex items-center justify-center text-lg shrink-0 overflow-hidden shadow-xs">
              {tb.team.logoUrl ? (
                <img src={tb.team.logoUrl} alt={tb.team.name} className="w-full h-full object-contain p-0.5" />
              ) : (
                tb.team.symbol
              )}
            </span>
            <div>
              <b className="text-sm text-brand-green-950 font-extrabold block">
                {tb.team.name}
              </b>
              <div className="text-[10px] text-brand-ink-soft space-y-0.5">
                <div>Rank #{tb.rank} &bull; Captain: {tb.team.captain || 'N/A'}</div>
                {(() => {
                  const tParts = db.participants.filter(p => p.teamId === tb.team.id);
                  const bCount = tParts.filter(p => p.gender === 'Boys').length;
                  const gCount = tParts.filter(p => p.gender === 'Girls').length;
                  return (
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="text-sky-800 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">👦 {bCount} Boys</span>
                      <span className="text-pink-800 bg-pink-50 px-1.5 py-0.2 rounded border border-pink-200">👧 {gCount} Girls</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          <span className="font-mono text-sm font-black bg-brand-green-800 text-brand-gold-300 px-3 py-1 rounded-xl shadow-xs">
            {tb.grandTotal} PTS
          </span>
        </div>

        {/* 1. Main Stage vs Offstage Card */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-green-950 flex items-center gap-1.5">
            <span>🎭</span> Main Stage vs Offstage Breakdown
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Offstage Section */}
            <div className="bg-purple-50/90 border border-purple-200 rounded-xl p-3 space-y-2 shadow-xs">
              <div className="flex items-center justify-between border-b border-purple-200/80 pb-1.5">
                <span className="font-extrabold text-purple-900 text-xs flex items-center gap-1">
                  <span>📝</span> Offstage
                </span>
                <span className="font-mono font-extrabold text-purple-950 bg-purple-200 px-2 py-0.5 rounded-md text-[11px]">
                  {tb.offstageTotal} pts
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center text-slate-800 font-medium">
                  <span>👦 Boys Offstage</span>
                  <b className="font-mono text-sky-700 font-bold">{tb.offstageBoys} pts</b>
                </div>
                <div className="flex justify-between items-center text-slate-800 font-medium">
                  <span>👧 Girls Offstage</span>
                  <b className="font-mono text-pink-700 font-bold">{tb.offstageGirls} pts</b>
                </div>
                {tb.offstageGeneral > 0 && (
                  <div className="flex justify-between items-center text-slate-800 font-medium">
                    <span>🌐 General Offstage</span>
                    <b className="font-mono text-emerald-700 font-bold">{tb.offstageGeneral} pts</b>
                  </div>
                )}
              </div>
            </div>

            {/* Main Stage Section */}
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 space-y-2 shadow-xs">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-1.5">
                <span className="font-extrabold text-emerald-900 text-xs flex items-center gap-1">
                  <span>🎭</span> Main Stage
                </span>
                <span className="font-mono font-extrabold text-emerald-950 bg-emerald-200 px-2 py-0.5 rounded-md text-[11px]">
                  {tb.mainstageTotal} pts
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center text-slate-800 font-medium">
                  <span>👦 Boys Main Stage</span>
                  <b className="font-mono text-sky-700 font-bold">{tb.mainstageBoys} pts</b>
                </div>
                <div className="flex justify-between items-center text-slate-800 font-medium">
                  <span>👧 Girls Main Stage</span>
                  <b className="font-mono text-pink-700 font-bold">{tb.mainstageGirls} pts</b>
                </div>
                {tb.mainstageGeneral > 0 && (
                  <div className="flex justify-between items-center text-slate-800 font-medium">
                    <span>🌐 General Main Stage</span>
                    <b className="font-mono text-emerald-700 font-bold">{tb.mainstageGeneral} pts</b>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Category-Wise Points Breakdown */}
        <div className="space-y-2.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-green-950 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>📊</span> Category-Wise Score Breakdown (Kids, Sub Junior, Junior, Senior, Super Senior & General)
            </span>
          </span>

          <div className="space-y-2.5">
            {ALL_AGES_LIST.map(catName => {
              const cObj = tb.categoryBreakdown[catName] || {
                offstageBoys: 0,
                offstageGirls: 0,
                offstageGeneral: 0,
                mainstageBoys: 0,
                mainstageGirls: 0,
                mainstageGeneral: 0,
                total: 0
              };
              const isZero = cObj.total === 0;

              return (
                <div 
                  key={catName} 
                  className={`border rounded-xl p-3 space-y-2 shadow-2xs transition-all ${
                    isZero ? 'bg-white/70 border-slate-200/80 opacity-75' : 'bg-white border-brand-line/90'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-brand-line/40 pb-1.5">
                    <span className="font-extrabold text-brand-green-950 text-xs flex items-center gap-1.5">
                      <span>{AGE_LABEL_ICONS[catName] || '🏷️'}</span> {catName} Category
                    </span>
                    <span className={`font-mono font-extrabold px-2.5 py-0.5 rounded-md text-[11px] border ${
                      isZero ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-brand-gold-100/90 text-brand-green-900 border-brand-gold-300'
                    }`}>
                      Total: {cObj.total} pts
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-purple-50/90 p-2 rounded-lg border border-purple-200/80 text-center">
                      <span className="block text-[9px] text-purple-900 font-extrabold">👦 Boys Offstage</span>
                      <b className="font-mono text-xs text-sky-800 font-extrabold">{cObj.offstageBoys} pts</b>
                    </div>

                    <div className="bg-purple-50/90 p-2 rounded-lg border border-purple-200/80 text-center">
                      <span className="block text-[9px] text-purple-900 font-extrabold">👧 Girls Offstage</span>
                      <b className="font-mono text-xs text-pink-800 font-extrabold">{cObj.offstageGirls} pts</b>
                    </div>

                    <div className="bg-emerald-50/90 p-2 rounded-lg border border-emerald-200/80 text-center">
                      <span className="block text-[9px] text-emerald-900 font-extrabold">👦 Boys Main Stage</span>
                      <b className="font-mono text-xs text-sky-800 font-extrabold">{cObj.mainstageBoys} pts</b>
                    </div>

                    <div className="bg-emerald-50/90 p-2 rounded-lg border border-emerald-200/80 text-center">
                      <span className="block text-[9px] text-emerald-900 font-extrabold">👧 Girls Main Stage</span>
                      <b className="font-mono text-xs text-pink-800 font-extrabold">{cObj.mainstageGirls} pts</b>
                    </div>
                  </div>

                  {(cObj.offstageGeneral > 0 || cObj.mainstageGeneral > 0) && (
                    <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-200 text-center text-[10px] font-bold text-amber-900 flex justify-between px-3">
                      <span>🌐 General Section:</span>
                      <span className="font-mono">{cObj.offstageGeneral + cObj.mainstageGeneral} pts</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (db.settings.showScoreboard === false) {
    return (
      <div className="view active pb-20 max-w-2xl mx-auto space-y-6 pt-6">
        <div className="p-8 bg-brand-panel border border-brand-gold-500/30 rounded-3xl text-center space-y-3 shadow-md">
          <div className="text-4xl animate-bounce">🔒</div>
          <h3 className="font-display font-extrabold text-brand-green-900 text-lg">
            Scoreboard On Hold
          </h3>
          <p className="text-xs text-brand-ink-soft max-w-sm mx-auto leading-relaxed">
            Live team scoreboards have been temporarily paused by event administration. Full team standings will be officially unveiled during the closing ceremony!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="view active pb-20 max-w-2xl mx-auto space-y-8 font-sans">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-brand-line/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-gold-500 animate-pulse" />
          <h2 className="font-display font-extrabold text-brand-green-950 text-base md:text-lg tracking-tight">
            Live Championship Scoreboard
          </h2>
        </div>
        <span className="text-[10px] font-bold uppercase bg-brand-gold-100 text-brand-gold-800 px-2.5 py-1 rounded-full border border-brand-gold-300 shadow-2xs">
          Official Standings
        </span>
      </div>

      {/* Search Bar for Candidate / Student Score or Program Details */}
      {db.settings.showCandidatePoints !== false && (
        <div className="bg-brand-panel border border-brand-line rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="scoreboardSearchInput" className="text-xs font-extrabold text-brand-green-950 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
              <span>🔍</span> Search Student or Program Details
            </label>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
              >
                Clear Search ✕
              </button>
            )}
          </div>

          <div className="relative">
            <input
              id="scoreboardSearchInput"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, chest number, or program code..."
              className="w-full bg-white border border-brand-line rounded-xl px-3.5 py-2.5 text-xs text-brand-ink placeholder:text-brand-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand-green-800 shadow-inner"
            />
          </div>

          {/* Search Results Display */}
          {searchQuery.trim() && (() => {
            const q = searchQuery.trim().toLowerCase();

            // 1. Matching Candidates
            const matchingParticipants = db.participants.filter(p => 
              p.name.toLowerCase().includes(q) || 
              (p.number && p.number.toLowerCase().includes(q)) ||
              (p.cls && p.cls.toLowerCase().includes(q))
            );

            // 2. Matching Programs
            const matchingPrograms = db.programs.filter(p => 
              p.code.toLowerCase().includes(q) || 
              p.name.toLowerCase().includes(q)
            );

            if (matchingParticipants.length === 0 && matchingPrograms.length === 0) {
              return (
                <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-xl text-center text-xs text-amber-900 font-medium">
                  No candidates or programs matching "{searchQuery}" were found. Try typing chest number or program code.
                </div>
              );
            }

            return (
              <div className="space-y-4 pt-2">
                {/* Candidate Search Results */}
                {matchingParticipants.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-green-900 flex items-center gap-1">
                      <span>👤</span> Candidate Details ({matchingParticipants.length})
                    </span>

                    <div className="space-y-2.5">
                      {matchingParticipants.slice(0, 5).map(participant => {
                        const team = db.teams.find(t => t.id === participant.teamId);

                        // Calculate candidate's positions and total points across all results
                        let totalCandPoints = 0;
                        const candidateWins: { programCode: string; programName: string; posOrGrade: string; pts: number }[] = [];

                        db.results.forEach(r => {
                          const prog = db.programs.find(p => p.id === r.programId);
                          const pCode = prog ? prog.code : r.programId;
                          const pName = prog ? prog.name : 'Program';
                          const ptsSetting = db.settings.points;

                          ['first', 'second', 'third'].forEach(pos => {
                            const key = pos as 'first' | 'second' | 'third';
                            const winLabel = key === 'first' ? '🥇 1st Place' : key === 'second' ? '🥈 2nd Place' : '🥉 3rd Place';
                            const isGen = prog?.categories.some(c => (c.gender as string) === 'General' || (c.age as string) === 'All' || (c.age as string) === 'General') || (r.gender as string) === 'General' || (r.age as string) === 'General' || (r.age as string) === 'All';
                            let winPts = ptsSetting[key];
                            if (isGen) {
                              if (key === 'first') winPts = ptsSetting.generalFirst ?? ptsSetting.first;
                              else if (key === 'second') winPts = ptsSetting.generalSecond ?? ptsSetting.second;
                              else if (key === 'third') winPts = ptsSetting.generalThird ?? ptsSetting.third;
                            }

                            (r.winners[key] || []).forEach(w => {
                              if (w.name.toLowerCase() === participant.name.toLowerCase() && (!w.teamId || w.teamId === participant.teamId)) {
                                totalCandPoints += winPts;
                                candidateWins.push({ programCode: pCode, programName: pName, posOrGrade: winLabel, pts: winPts });
                              }
                            });
                          });

                          ['gradeA', 'gradeB', 'gradeC', 'participation'].forEach(gKey => {
                            const key = gKey as 'gradeA' | 'gradeB' | 'gradeC' | 'participation';
                            const gLabel = key === 'gradeA' ? 'Grade A' : key === 'gradeB' ? 'Grade B' : key === 'gradeC' ? 'Grade C' : 'Participation';
                            (r.grades[key] || []).forEach(g => {
                              if (g.name.toLowerCase() === participant.name.toLowerCase() && (!g.teamId || g.teamId === participant.teamId)) {
                                totalCandPoints += ptsSetting[key];
                                candidateWins.push({ programCode: pCode, programName: pName, posOrGrade: gLabel, pts: ptsSetting[key] });
                              }
                            });
                          });
                        });

                        return (
                          <div key={participant.id} className="bg-white border-2 border-brand-green-700/40 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <b className="text-sm font-extrabold text-brand-green-950">{participant.name}</b>
                                  {participant.number && (
                                    <span className="font-mono text-[10px] font-black bg-brand-green-900 text-brand-gold-300 px-2 py-0.5 rounded-md">
                                      #{participant.number}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2 text-[10px] text-brand-ink-soft mt-1">
                                  {team && (
                                    <span className="font-bold text-brand-green-800 bg-brand-green-50 px-2 py-0.5 rounded border border-brand-green-200">
                                      {team.symbol} {team.name}
                                    </span>
                                  )}
                                  {participant.cls && (
                                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-medium">
                                      Class: {participant.cls}{participant.division ? ` ${participant.division}` : ''}
                                    </span>
                                  )}
                                  {participant.gender && (
                                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-medium">
                                      {participant.gender} ({participant.age})
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="block font-mono text-base font-black text-brand-green-900 bg-brand-gold-100 text-brand-gold-900 px-3 py-1 rounded-xl border border-brand-gold-300">
                                  {totalCandPoints} PTS
                                </span>
                              </div>
                            </div>

                            {/* Breakdown of candidate's performances */}
                            {candidateWins.length > 0 ? (
                              <div className="space-y-1 bg-brand-bg/60 p-2.5 rounded-xl border border-brand-line/60">
                                <span className="text-[9px] font-extrabold text-brand-green-900 uppercase tracking-wider block">
                                  Published Achievements ({candidateWins.length})
                                </span>
                                {candidateWins.map((win, winIdx) => (
                                  <div key={winIdx} className="flex items-center justify-between text-xs py-0.5 border-b border-brand-line/30 last:border-0">
                                    <span className="font-mono text-[10px] font-bold text-brand-green-800 bg-white px-1.5 py-0.2 rounded border">
                                      {win.programCode}
                                    </span>
                                    <span className="font-semibold text-brand-ink truncate flex-1 mx-2">
                                      {win.programName}
                                    </span>
                                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                      {win.posOrGrade}
                                    </span>
                                    <span className="font-mono text-[10px] font-black text-brand-green-900 ml-2">
                                      +{win.pts}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-brand-ink-soft italic bg-slate-50 p-2 rounded-lg text-center">
                                No published competition points recorded for this candidate yet.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Program Search Results */}
                {matchingPrograms.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-green-900 flex items-center gap-1">
                      <span>🎭</span> Program Details ({matchingPrograms.length})
                    </span>

                    <div className="space-y-2">
                      {matchingPrograms.slice(0, 5).map(prog => {
                        const progResult = db.results.find(r => r.programId === prog.id);
                        return (
                          <div key={prog.id} className="bg-white border rounded-2xl p-3 space-y-2 shadow-xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-extrabold bg-brand-green-900 text-brand-gold-300 px-2 py-0.5 rounded">
                                  {prog.code}
                                </span>
                                <b className="text-xs font-extrabold text-brand-green-950">{prog.name}</b>
                              </div>
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                prog.stageType === 'Offstage' ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'
                              }`}>
                                {prog.stageType === 'Offstage' ? '📝 Offstage' : '🎭 Main Stage'}
                              </span>
                            </div>

                            {progResult ? (
                              <div className="text-xs bg-emerald-50/80 p-2 rounded-xl border border-emerald-200 space-y-1">
                                <span className="text-[9px] font-bold text-emerald-900 uppercase">Status: Published Winners</span>
                                <div className="flex flex-wrap gap-2 text-[10px]">
                                  {progResult.winners?.first?.[0] && (
                                    <span className="font-bold text-slate-900">🥇 1st: {progResult.winners.first[0].name}</span>
                                  )}
                                  {progResult.winners?.second?.[0] && (
                                    <span className="font-bold text-slate-900">🥈 2nd: {progResult.winners.second[0].name}</span>
                                  )}
                                  {progResult.winners?.third?.[0] && (
                                    <span className="font-bold text-slate-900">🥉 3rd: {progResult.winners.third[0].name}</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-brand-ink-soft italic block">Result pending / results not declared yet</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

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

      {/* ============================================================ */}
      {/* SECTION 1: OVERALL TEAM POINTS LEADERBOARD */}
      {/* ============================================================ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-extrabold text-brand-green-950 text-sm md:text-base flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-brand-gold-400 text-brand-green-950 flex items-center justify-center text-xs font-black shadow-xs">
              1
            </span>
            Overall Team Points Standings
          </h3>
          <span className="text-[11px] font-mono font-bold text-brand-ink-soft">
            Total Teams: {sortedTeams.length}
          </span>
        </div>

        {sortedTeams.length === 0 ? (
          <div className="p-8 bg-brand-panel border border-brand-line rounded-2xl text-center text-brand-ink-soft text-xs">
            No teams recorded.
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedTeams.map((team, index) => {
              const rank = index + 1;
              const prevRank = prev[team.id];
              const isExpanded = expandedTeamId === team.id;
              const tb = teamBreakdowns[team.id];
              
              let rankChange = <Minus className="w-3.5 h-3.5 text-brand-ink-soft/40" />;
              if (prevRank !== undefined) {
                if (prevRank > rank) {
                  rankChange = (
                    <span className="flex items-center text-brand-green-600 font-bold text-[10px] gap-0.5">
                      <TrendingUp className="w-3.5 h-3.5" /> {prevRank - rank}
                    </span>
                  );
                } else if (prevRank < rank) {
                  rankChange = (
                    <span className="flex items-center text-pink-600 font-bold text-[10px] gap-0.5">
                      <TrendingDown className="w-3.5 h-3.5" /> {rank - prevRank}
                    </span>
                  );
                }
              }

              let rankBadgeStyle = "bg-brand-green-800 text-white";
              if (rank === 1) rankBadgeStyle = "bg-gradient-to-br from-brand-gold-400 to-brand-gold-600 text-brand-green-900 shadow-sm";
              if (rank === 2) rankBadgeStyle = "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800";
              if (rank === 3) rankBadgeStyle = "bg-gradient-to-br from-amber-600 to-amber-800 text-white";

              return (
                <div 
                  key={team.id}
                  className="bg-brand-panel border border-brand-line rounded-2xl shadow-sm overflow-hidden transition-all duration-200"
                >
                  <div 
                    onClick={() => {
                      if (db.settings.showDetailedScoreboard !== false) {
                        setExpandedTeamId(isExpanded ? null : team.id);
                      }
                    }}
                    className={`flex items-center justify-between p-3.5 ${db.settings.showDetailedScoreboard !== false ? 'hover:bg-brand-bg/50 cursor-pointer' : ''} select-none`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-extrabold text-sm shrink-0 ${rankBadgeStyle}`}>
                        {rank}
                      </div>
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-inner shrink-0 overflow-hidden"
                        style={{ backgroundColor: `${team.color}15`, color: team.color }}
                      >
                        {team.logoUrl ? (
                          <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain p-0.5" />
                        ) : (
                          team.symbol
                        )}
                      </div>
                      <div className="min-w-0">
                        <b className="block text-xs md:text-sm text-brand-ink font-semibold truncate">
                          {team.name}
                        </b>
                        <small className="block text-[10px] text-brand-ink-soft leading-tight mt-0.5 space-y-1">
                          {team.boysCaptain || team.boysCaptain2 || team.girlsCaptain || team.girlsCaptain2 ? (
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              {team.captain && <span>⭐ General: <b className="text-brand-ink">{team.captain}</b></span>}
                              {team.boysCaptain && <span>👦 Boy L1: <b className="text-brand-ink">{team.boysCaptain}</b></span>}
                              {team.boysCaptain2 && <span>👦 Boy L2: <b className="text-brand-ink">{team.boysCaptain2}</b></span>}
                              {team.girlsCaptain && <span>👧 Girl L1: <b className="text-brand-ink">{team.girlsCaptain}</b></span>}
                              {team.girlsCaptain2 && <span>👧 Girl L2: <b className="text-brand-ink">{team.girlsCaptain2}</b></span>}
                            </span>
                          ) : team.captain ? (
                            <span className="truncate block">Captain: {team.captain}</span>
                          ) : (
                            <span className="truncate block">No captains set</span>
                          )}

                          {(() => {
                            const teamParts = db.participants.filter(p => p.teamId === team.id);
                            const boysCount = teamParts.filter(p => p.gender === 'Boys').length;
                            const girlsCount = teamParts.filter(p => p.gender === 'Girls').length;
                            return (
                              <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                <span className="bg-sky-50 text-sky-900 border border-sky-200/80 px-1.5 py-0.2 rounded font-bold text-[9px] flex items-center gap-0.5">
                                  👦 {boysCount} Boys
                                </span>
                                <span className="bg-pink-50 text-pink-900 border border-pink-200/80 px-1.5 py-0.2 rounded font-bold text-[9px] flex items-center gap-0.5">
                                  👧 {girlsCount} Girls
                                </span>
                              </span>
                            );
                          })()}
                        </small>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right shrink-0">{rankChange}</div>
                      <div className="font-mono text-base md:text-lg font-extrabold text-brand-green-800 shrink-0 min-w-[36px] text-right">
                        {team.points} <span className="text-[10px] font-sans text-brand-ink-soft">PTS</span>
                      </div>
                      {db.settings.showDetailedScoreboard !== false && (
                        <button className="p-1 rounded-lg text-brand-ink-soft hover:text-brand-ink hover:bg-brand-bg/80 transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {db.settings.showDetailedScoreboard !== false && isExpanded && tb && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-brand-line p-3 md:p-4 bg-brand-bg/30"
                      >
                        {renderTeamDetailCard(tb)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {db.settings.showDetailedScoreboard !== false && (
        <>
          {/* ============================================================ */}
          {/* SECTION 2: TOTAL BOYS & GIRLS POINTS PER TEAM */}
          {/* ============================================================ */}
          <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-brand-line/50 pb-2.5">
              <h3 className="font-display font-extrabold text-brand-green-950 text-xs md:text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                  2
                </span>
                Total Boys Points & Total Girls Points (Per Team)
              </h3>
              <span className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wider">
                Gender Breakdown
              </span>
            </div>

            {db.teams.length === 0 ? (
              <p className="text-xs text-brand-ink-soft/70 text-center py-2">No team data computed.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {sortedTeams.map(t => {
                  const g = genderPts[t.id] || { Boys: 0, Girls: 0, General: 0 };
                  const total = g.Boys + g.Girls + g.General;

                  return (
                    <div key={t.id} className="bg-white border border-brand-line/80 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-brand-line/40 pb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">{t.symbol}</span>
                          <b className="text-xs font-bold text-brand-green-950 truncate">{t.name}</b>
                        </div>
                        <span className="font-mono text-xs font-black text-brand-green-800 bg-brand-gold-100/90 border border-brand-gold-300 px-2 py-0.5 rounded-md">
                          {total} PTS
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-sky-50/90 border border-sky-200/80 rounded-lg p-2 text-center">
                          <span className="block text-[10px] font-bold text-sky-900 uppercase tracking-wider">
                            👦 Total Boys
                          </span>
                          <b className="font-mono text-sm font-extrabold text-sky-800 block mt-0.5">
                            {g.Boys} <span className="text-[10px] font-medium">pts</span>
                          </b>
                        </div>

                        <div className="bg-pink-50/90 border border-pink-200/80 rounded-lg p-2 text-center">
                          <span className="block text-[10px] font-bold text-pink-900 uppercase tracking-wider">
                            👧 Total Girls
                          </span>
                          <b className="font-mono text-sm font-extrabold text-pink-800 block mt-0.5">
                            {g.Girls} <span className="text-[10px] font-medium">pts</span>
                          </b>
                        </div>
                      </div>

                      {g.General > 0 && (
                        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-lg p-1.5 text-center text-xs flex justify-between items-center px-3">
                          <span className="text-[10px] font-bold text-emerald-900">🌐 General / Combined Section:</span>
                          <b className="font-mono text-xs font-extrabold text-emerald-800">{g.General} pts</b>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* SECTION 3: OFF STAGE AND MAIN STAGE TOTAL POINTS PER TEAM */}
          {/* ============================================================ */}
          <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-brand-line/50 pb-2.5">
              <h3 className="font-display font-extrabold text-brand-green-950 text-xs md:text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                  3
                </span>
                Off-Stage & Main-Stage Total Points (Per Team)
              </h3>
              <span className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wider">
                Stage Distribution
              </span>
            </div>

            {db.teams.length === 0 ? (
              <p className="text-xs text-brand-ink-soft/70 text-center py-2">No team data computed.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {sortedTeams.map(t => {
                  const tb = teamBreakdowns[t.id];
                  if (!tb) return null;

                  return (
                    <div key={t.id} className="bg-white border border-brand-line/80 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-brand-line/40 pb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">{t.symbol}</span>
                          <b className="text-xs font-bold text-brand-green-950 truncate">{t.name}</b>
                        </div>
                        <span className="font-mono text-xs font-black text-brand-green-800 bg-brand-gold-100/90 border border-brand-gold-300 px-2 py-0.5 rounded-md">
                          {tb.grandTotal} PTS
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* Off Stage */}
                        <div className="bg-purple-50/90 border border-purple-200/80 rounded-lg p-2.5 space-y-1">
                          <div className="flex items-center justify-between border-b border-purple-200 pb-1">
                            <span className="text-[10px] font-bold text-purple-900 flex items-center gap-1">
                              <span>📝</span> Off Stage Total
                            </span>
                            <b className="font-mono text-xs font-black text-purple-950 bg-purple-200/80 px-1.5 py-0.5 rounded">
                              {tb.offstageTotal} pts
                            </b>
                          </div>
                          <div className="text-[10px] space-y-0.5 pt-0.5">
                            <div className="flex justify-between text-slate-700">
                              <span>Boys Offstage:</span>
                              <b className="font-mono text-sky-800">{tb.offstageBoys} pts</b>
                            </div>
                            <div className="flex justify-between text-slate-700">
                              <span>Girls Offstage:</span>
                              <b className="font-mono text-pink-800">{tb.offstageGirls} pts</b>
                            </div>
                          </div>
                        </div>

                        {/* Main Stage */}
                        <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-lg p-2.5 space-y-1">
                          <div className="flex items-center justify-between border-b border-emerald-200 pb-1">
                            <span className="text-[10px] font-bold text-emerald-900 flex items-center gap-1">
                              <span>🎭</span> Main Stage Total
                            </span>
                            <b className="font-mono text-xs font-black text-emerald-950 bg-emerald-200/80 px-1.5 py-0.5 rounded">
                              {tb.mainstageTotal} pts
                            </b>
                          </div>
                          <div className="text-[10px] space-y-0.5 pt-0.5">
                            <div className="flex justify-between text-slate-700">
                              <span>Boys Mainstage:</span>
                              <b className="font-mono text-sky-800">{tb.mainstageBoys} pts</b>
                            </div>
                            <div className="flex justify-between text-slate-700">
                              <span>Girls Mainstage:</span>
                              <b className="font-mono text-pink-800">{tb.mainstageGirls} pts</b>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* SECTION 4: CATEGORY BOYS AND GIRLS POINTS (OFFSTAGE & MAINSTAGE) */}
          {/* ============================================================ */}
          <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-line/50 pb-2.5">
              <h3 className="font-display font-extrabold text-brand-green-950 text-xs md:text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-700 text-white flex items-center justify-center text-xs font-black shadow-xs">
                  4
                </span>
                Category Points Breakdown (Boys & Girls &bull; Off Stage & Main Stage)
              </h3>

              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none max-w-full">
                <button
                  onClick={() => setSelectedTeamTab('ALL')}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all shrink-0 cursor-pointer ${
                    selectedTeamTab === 'ALL'
                      ? 'bg-brand-green-800 text-white border-brand-green-800'
                      : 'bg-brand-bg text-brand-ink-soft border-brand-line hover:border-brand-gold-400/50'
                  }`}
                >
                  All Teams
                </button>
                {db.teams.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeamTab(t.id)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                      selectedTeamTab === t.id
                        ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-xs'
                        : 'bg-brand-bg text-brand-ink-soft border-brand-line hover:border-brand-gold-400/50'
                    }`}
                  >
                    <span>{t.symbol}</span> {t.name}
                  </button>
                ))}
              </div>
            </div>

            {db.teams.length === 0 ? (
              <p className="text-xs text-brand-ink-soft/70 text-center py-2">No category data computed.</p>
            ) : (
              <div className="space-y-4">
                {(selectedTeamTab === 'ALL' ? sortedTeams : sortedTeams.filter(t => t.id === selectedTeamTab)).map(team => {
                  const tb = teamBreakdowns[team.id];
                  if (!tb) return null;
                  const targetCats = ALL_AGES_LIST;

                  return (
                    <div key={team.id} className="bg-white border border-brand-line/90 rounded-2xl p-4 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between border-b border-brand-line pb-2 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg p-1 bg-brand-bg rounded-lg border border-brand-line">
                            {team.symbol}
                          </span>
                          <div>
                            <b className="text-xs md:text-sm text-brand-green-950 font-bold block">
                              {team.name}
                            </b>
                            {(() => {
                              const tParts = db.participants.filter(p => p.teamId === team.id);
                              const bCount = tParts.filter(p => p.gender === 'Boys').length;
                              const gCount = tParts.filter(p => p.gender === 'Girls').length;
                              return (
                                <span className="text-[10px] text-brand-ink-soft flex items-center gap-1.5 flex-wrap">
                                  <span>👥 {tParts.length} Candidates</span>
                                  <span className="text-sky-800 font-semibold bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">👦 {bCount} Boys</span>
                                  <span className="text-pink-800 font-semibold bg-pink-50 px-1.5 py-0.2 rounded border border-pink-200">👧 {gCount} Girls</span>
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                        <span className="font-mono text-xs font-black bg-brand-green-800 text-brand-gold-300 px-3 py-1 rounded-lg">
                          {tb.grandTotal} PTS TOTAL
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {targetCats.map(catName => {
                          const cObj = tb.categoryBreakdown[catName] || {
                            offstageBoys: 0,
                            offstageGirls: 0,
                            offstageGeneral: 0,
                            mainstageBoys: 0,
                            mainstageGirls: 0,
                            mainstageGeneral: 0,
                            total: 0
                          };
                          const isZero = cObj.total === 0;

                          return (
                            <div 
                              key={catName} 
                              className={`border rounded-xl p-3 space-y-2 shadow-2xs transition-all ${
                                isZero ? 'bg-slate-50/60 border-slate-200/80 opacity-75' : 'bg-brand-bg/60 border-brand-line/80'
                              }`}
                            >
                              <div className="flex items-center justify-between border-b border-brand-line/40 pb-1.5">
                                <span className="font-extrabold text-brand-green-950 text-xs flex items-center gap-1.5">
                                  <span>{AGE_LABEL_ICONS[catName] || '🏷️'}</span> {catName} Category
                                </span>
                                <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] border ${
                                  isZero ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-brand-gold-100 text-brand-green-900 border-brand-gold-300'
                                }`}>
                                  Total: {cObj.total} pts
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                <div className="bg-purple-50 p-2 rounded-lg border border-purple-200 text-center">
                                  <span className="block text-[9px] text-purple-900 font-extrabold">👦 Boys Offstage</span>
                                  <b className="font-mono text-xs text-sky-800 font-bold">{cObj.offstageBoys} pts</b>
                                </div>

                                <div className="bg-purple-50 p-2 rounded-lg border border-purple-200 text-center">
                                  <span className="block text-[9px] text-purple-900 font-extrabold">👧 Girls Offstage</span>
                                  <b className="font-mono text-xs text-pink-800 font-bold">{cObj.offstageGirls} pts</b>
                                </div>

                                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200 text-center">
                                  <span className="block text-[9px] text-emerald-900 font-extrabold">👦 Boys Main Stage</span>
                                  <b className="font-mono text-xs text-sky-800 font-bold">{cObj.mainstageBoys} pts</b>
                                </div>

                                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200 text-center">
                                  <span className="block text-[9px] text-emerald-900 font-extrabold">👧 Girls Main Stage</span>
                                  <b className="font-mono text-xs text-pink-800 font-bold">{cObj.mainstageGirls} pts</b>
                                </div>
                              </div>

                              {(cObj.offstageGeneral > 0 || cObj.mainstageGeneral > 0) && (
                                <div className="bg-amber-50 p-1 rounded-lg border border-amber-200 text-center text-[10px] font-bold text-amber-900 flex justify-between px-2">
                                  <span>🌐 General Section:</span>
                                  <span className="font-mono">{cObj.offstageGeneral + cObj.mainstageGeneral} pts</span>
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

          {/* ============================================================ */}
          {/* SECTION 5: OVERALL INDIVIDUAL CHAMPIONS IN EACH CATEGORY (BOYS & GIRLS) */}
          {/* ============================================================ */}
          {db.settings.showIndividualChampions !== false && (
            <div className="bg-gradient-to-br from-brand-panel via-brand-panel to-brand-gold-500/10 border border-brand-gold-500/40 rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-brand-line/50 pb-2.5">
              <h3 className="font-display font-extrabold text-brand-green-950 text-xs md:text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-brand-gold-500 text-brand-green-950 flex items-center justify-center text-xs font-black shadow-xs">
                  5
                </span>
                Overall Individual Champions (Per Category & Gender)
              </h3>
              <span className="text-[10px] font-extrabold uppercase bg-brand-gold-100 text-brand-gold-800 px-2.5 py-0.5 rounded-full border border-brand-gold-300">
                Toppers Spotlight
              </span>
            </div>

            {/* GRAND OVERALL SPOTLIGHT: Overall Boys & Girls Champions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Overall Boys Champion */}
              <div className="bg-sky-50/90 border border-sky-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-sky-200 pb-2">
                  <span className="font-extrabold text-sky-950 text-xs flex items-center gap-1.5">
                    <span>👑</span> Overall Boys Top Champion
                  </span>
                  <button
                    onClick={() => fireGoldWinnerBurst()}
                    className="text-[10px] font-bold text-sky-900 bg-sky-200/80 hover:bg-sky-300 px-2 py-0.5 rounded-md cursor-pointer transition-all flex items-center gap-1 active:scale-95"
                    title="Click to celebrate overall boys champion!"
                  >
                    <span>🎉</span> Celebrate
                  </button>
                </div>

                {topKalaprathibha.length === 0 ? (
                  <p className="text-[11px] text-sky-800/60 italic text-center py-2">No boys candidate points recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {topKalaprathibha.map((cand, i) => {
                      const medals = ['🥇 1st', '🥈 2nd', '🥉 3rd'];
                      const tm = db.teams.find(t => t.id === cand.teamId);
                      return (
                        <div key={i} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-sky-200 shadow-2xs text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-[10px] text-amber-700 shrink-0 w-12">{medals[i]}</span>
                            <div className="min-w-0">
                              <b className="text-slate-900 font-bold truncate block">{cand.name}</b>
                              {tm && <span className="text-[10px] text-slate-500 block truncate">{tm.symbol} {tm.name}</span>}
                            </div>
                          </div>
                          <span className="font-mono font-black text-sky-900 bg-sky-100 px-2.5 py-1 rounded-lg text-xs shrink-0 ml-2">
                            {cand.points} pts
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Overall Girls Champion */}
              <div className="bg-pink-50/90 border border-pink-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-pink-200 pb-2">
                  <span className="font-extrabold text-pink-950 text-xs flex items-center gap-1.5">
                    <span>👑</span> Overall Girls Top Champion
                  </span>
                  <button
                    onClick={() => fireGoldWinnerBurst()}
                    className="text-[10px] font-bold text-pink-900 bg-pink-200/80 hover:bg-pink-300 px-2 py-0.5 rounded-md cursor-pointer transition-all flex items-center gap-1 active:scale-95"
                    title="Click to celebrate overall girls champion!"
                  >
                    <span>🎉</span> Celebrate
                  </button>
                </div>

                {topKalathilakam.length === 0 ? (
                  <p className="text-[11px] text-pink-800/60 italic text-center py-2">No girls candidate points recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {topKalathilakam.map((cand, i) => {
                      const medals = ['🥇 1st', '🥈 2nd', '🥉 3rd'];
                      const tm = db.teams.find(t => t.id === cand.teamId);
                      return (
                        <div key={i} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-pink-200 shadow-2xs text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-[10px] text-amber-700 shrink-0 w-12">{medals[i]}</span>
                            <div className="min-w-0">
                              <b className="text-slate-900 font-bold truncate block">{cand.name}</b>
                              {tm && <span className="text-[10px] text-slate-500 block truncate">{tm.symbol} {tm.name}</span>}
                            </div>
                          </div>
                          <span className="font-mono font-black text-pink-900 bg-pink-100 px-2.5 py-1 rounded-lg text-xs shrink-0 ml-2">
                            {cand.points} pts
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* CATEGORY BY CATEGORY INDIVIDUAL CHAMPIONS (Separate Boys & Girls) */}
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-extrabold text-brand-green-950 uppercase tracking-wider border-b border-brand-line/40 pb-1.5 flex items-center gap-1.5">
                <span>🏅</span> Individual Champions By Category (Separate Boys & Girls)
              </h4>

              <div className="grid grid-cols-1 gap-4">
                {ALL_AGES_LIST.map(ageCat => {
                  const catBoys = categorySummaries.find(s => s && s.age === ageCat && s.gender === 'Boys');
                  const catGirls = categorySummaries.find(s => s && s.age === ageCat && s.gender === 'Girls');

                  const boysList = catBoys?.topCandidates || [];
                  const girlsList = catGirls?.topCandidates || [];

                  // Show General category only if it has scores, but always show Kids, Sub Junior, Junior, Senior, Super Senior
                  if (ageCat === 'General' && boysList.length === 0 && girlsList.length === 0) {
                    return null;
                  }

                  return (
                    <div key={ageCat} className="bg-white border border-brand-line/90 rounded-2xl p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-brand-line/50 pb-2">
                        <span className="font-extrabold text-brand-green-950 text-xs flex items-center gap-1.5">
                          <span>{AGE_LABEL_ICONS[ageCat] || '🏷️'}</span> {ageCat} Category Champions
                        </span>
                        <span className="text-[10px] font-mono text-brand-gold-800 font-bold bg-brand-gold-100 px-2.5 py-0.5 rounded-full border border-brand-gold-300">
                          {ageCat} Individual Toppers
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Boys Toppers for this Category */}
                        <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-3 space-y-2">
                          <span className="text-[11px] font-extrabold text-sky-950 block border-b border-sky-200 pb-1 flex justify-between items-center">
                            <span>👦 {ageCat} Boys Champions</span>
                            <span className="text-[9px] text-sky-800 font-mono font-bold bg-sky-200/70 px-1.5 py-0.5 rounded">Boys Section</span>
                          </span>

                          {boysList.length === 0 ? (
                            <p className="text-[10px] text-sky-800/70 italic py-2 text-center bg-white/70 rounded-lg border border-sky-100">
                              No boys scores recorded yet in {ageCat}.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {boysList.map((cand, cIdx) => {
                                const medals = ['🥇 1st', '🥈 2nd', '🥉 3rd'];
                                const candTeam = db.teams.find(t => t.id === cand.teamId);
                                return (
                                  <div key={cIdx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-sky-200 text-xs shadow-2xs">
                                    <div className="min-w-0 pr-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-amber-700">{medals[cIdx]}</span>
                                        <b className="text-slate-900 font-bold truncate">{cand.name}</b>
                                      </div>
                                      {candTeam && (
                                        <span className="text-[9px] text-slate-500 block truncate pl-9">
                                          {candTeam.symbol} {candTeam.name}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono font-extrabold text-sky-900 bg-sky-100 px-2 py-0.5 rounded text-[11px] shrink-0 border border-sky-200">
                                      {cand.points} pts
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Girls Toppers for this Category */}
                        <div className="bg-pink-50/80 border border-pink-200 rounded-xl p-3 space-y-2">
                          <span className="text-[11px] font-extrabold text-pink-950 block border-b border-pink-200 pb-1 flex justify-between items-center">
                            <span>👧 {ageCat} Girls Champions</span>
                            <span className="text-[9px] text-pink-800 font-mono font-bold bg-pink-200/70 px-1.5 py-0.5 rounded">Girls Section</span>
                          </span>

                          {girlsList.length === 0 ? (
                            <p className="text-[10px] text-pink-800/70 italic py-2 text-center bg-white/70 rounded-lg border border-pink-100">
                              No girls scores recorded yet in {ageCat}.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {girlsList.map((cand, cIdx) => {
                                const medals = ['🥇 1st', '🥈 2nd', '🥉 3rd'];
                                const candTeam = db.teams.find(t => t.id === cand.teamId);
                                return (
                                  <div key={cIdx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-pink-200 text-xs shadow-2xs">
                                    <div className="min-w-0 pr-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-amber-700">{medals[cIdx]}</span>
                                        <b className="text-slate-900 font-bold truncate">{cand.name}</b>
                                      </div>
                                      {candTeam && (
                                        <span className="text-[9px] text-slate-500 block truncate pl-9">
                                          {candTeam.symbol} {candTeam.name}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono font-extrabold text-pink-900 bg-pink-100 px-2 py-0.5 rounded text-[11px] shrink-0 border border-pink-200">
                                      {cand.points} pts
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
}

