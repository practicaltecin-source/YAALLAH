import React, { useState, useEffect } from 'react';
import { Database, Team } from '../types';
import { Sparkles, Trophy, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { applySuspenseRotation } from '../utils/suspense';

interface LiveTeamScoreTickerProps {
  db: Database;
}

export const LiveTeamScoreTicker: React.FC<LiveTeamScoreTickerProps> = ({ db }) => {
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

  let teams = [...(db.teams || [])].sort((a, b) => b.points - a.points);
  teams = applySuspenseRotation(teams, db.settings?.suspenseSwapMode, suspenseStep);

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (teams.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % teams.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [teams.length]);

  if (teams.length === 0) return null;

  const currentTeam = teams[currentIndex] || teams[0];
  const rank = currentIndex + 1;

  // Preset color gradients mapped to team colors or rank
  const getGradient = (team: Team, idx: number) => {
    if (team.color) {
      if (team.color.includes('green')) return 'from-emerald-600 via-teal-600 to-green-700';
      if (team.color.includes('red') || team.color.includes('rose')) return 'from-rose-600 via-red-600 to-orange-600';
      if (team.color.includes('blue') || team.color.includes('indigo')) return 'from-blue-600 via-indigo-600 to-sky-700';
      if (team.color.includes('yellow') || team.color.includes('amber') || team.color.includes('gold')) return 'from-amber-500 via-yellow-600 to-amber-700';
      if (team.color.includes('purple') || team.color.includes('violet')) return 'from-purple-600 via-fuchsia-600 to-indigo-700';
    }
    const fallbackGradients = [
      'from-amber-500 via-yellow-600 to-amber-700',
      'from-emerald-600 via-teal-600 to-green-700',
      'from-rose-600 via-red-600 to-orange-600',
      'from-blue-600 via-indigo-600 to-sky-700',
      'from-purple-600 via-fuchsia-600 to-indigo-700',
    ];
    return fallbackGradients[idx % fallbackGradients.length];
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + teams.length) % teams.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % teams.length);
  };

  return (
    <div className="w-full my-4 animate-fadeIn">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 p-0.5 border border-amber-500/40 shadow-xl">
        {/* Header Ribbon */}
        <div className="bg-black/60 px-4 py-1.5 flex items-center justify-between border-b border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
            <span className="font-extrabold uppercase tracking-widest text-[10px] text-amber-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> LIVE TEAM POINTS FLASH
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold text-gray-300 bg-white/10 px-2 py-0.5 rounded-full">
              {currentIndex + 1} / {teams.length}
            </span>
            <button
              onClick={handlePrev}
              className="p-1 hover:bg-white/20 rounded-md text-white/80 transition-colors cursor-pointer"
              title="Previous Team"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNext}
              className="p-1 hover:bg-white/20 rounded-md text-white/80 transition-colors cursor-pointer"
              title="Next Team"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dynamic Animated Flash Card */}
        <div className="relative p-4 md:p-5 text-white overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-r ${getGradient(currentTeam, currentIndex)} opacity-90 transition-all duration-700`} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent)] pointer-events-none" />

          <div key={currentTeam.id} className="relative z-10 flex items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Rank Badge */}
              <div className="shrink-0 flex flex-col items-center justify-center w-11 h-11 md:w-13 md:h-13 rounded-xl bg-black/40 border border-white/30 backdrop-blur-md shadow-inner text-white">
                <span className="text-[9px] font-mono font-extrabold uppercase tracking-tighter opacity-80">
                  RANK
                </span>
                <span className="text-base md:text-lg font-black font-mono leading-none">
                  #{rank}
                </span>
              </div>

              {/* Team Symbol/Logo */}
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-2xl font-bold shadow-md shrink-0 overflow-hidden p-1">
                {currentTeam.logoUrl ? (
                  <img src={currentTeam.logoUrl} alt={currentTeam.name} className="w-full h-full object-contain" />
                ) : (
                  <span>{currentTeam.symbol}</span>
                )}
              </div>

              {/* Team Name & Captain info */}
              <div className="min-w-0 space-y-0.5">
                <h3 className="font-display text-lg md:text-xl font-black truncate text-white drop-shadow-md tracking-wide uppercase">
                  {currentTeam.name}
                </h3>
                {currentTeam.captain && (
                  <p className="text-[11px] text-white/90 truncate font-medium">
                    Captain: <span className="font-bold">{currentTeam.captain}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Points Badge */}
            <div className="shrink-0 text-right bg-black/40 border border-white/30 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-lg">
              <div className="text-[9px] font-mono font-extrabold uppercase tracking-wider text-amber-300">
                TOTAL POINTS
              </div>
              <div className="text-xl md:text-2xl font-black font-mono text-white tracking-tight drop-shadow">
                {currentTeam.points} <span className="text-xs font-bold text-amber-300">PTS</span>
              </div>
            </div>
          </div>

          {/* Progress dots bar at bottom */}
          <div className="relative z-10 flex items-center justify-center gap-1.5 mt-3 pt-2 border-t border-white/20">
            {teams.map((t, idx) => (
              <button
                key={t.id}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentIndex ? 'w-6 bg-white shadow-sm' : 'w-1.5 bg-white/40 hover:bg-white/70'
                }`}
                title={t.name}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
