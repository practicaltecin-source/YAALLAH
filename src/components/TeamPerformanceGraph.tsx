import React from 'react';
import { Database } from '../types';
import { TrendingUp, TrendingDown, Minus, BarChart3, Trophy, Award } from 'lucide-react';

interface TeamPerformanceGraphProps {
  db: Database;
}

export const TeamPerformanceGraph: React.FC<TeamPerformanceGraphProps> = ({ db }) => {
  // Calculate total points for each team
  const teamsData = db.teams.map((team) => {
    let pts = 0;
    let totalWinsCount = 0;

    db.results.forEach((res) => {
      const p = db.programs.find((prg) => prg.id === res.programId);
      if (p && p.status === 'published') {
        const teamWins = res.winners.filter((w) => w.teamId === team.id);
        teamWins.forEach((w) => {
          totalWinsCount++;
          if (w.position === 1) pts += p.firstPoints ?? db.settings.points.first;
          else if (w.position === 2) pts += p.secondPoints ?? db.settings.points.second;
          else if (w.position === 3) pts += p.thirdPoints ?? db.settings.points.third;
          else if (w.grade === 'A') pts += db.settings.points.gradeA;
          else if (w.grade === 'B') pts += db.settings.points.gradeB;
          else if (w.grade === 'C') pts += db.settings.points.gradeC;
        });
      }
    });

    return {
      ...team,
      totalPoints: pts,
      winsCount: totalWinsCount,
    };
  });

  // Sort descending by points
  teamsData.sort((a, b) => b.totalPoints - a.totalPoints);

  const maxPoints = Math.max(...teamsData.map((t) => t.totalPoints), 1);
  const totalAllPoints = teamsData.reduce((acc, t) => acc + t.totalPoints, 0) || 1;

  if (teamsData.length === 0) return null;

  return (
    <div className="w-full my-6 bg-gradient-to-br from-brand-green-950 via-brand-green-900 to-brand-green-950 border-2 border-brand-gold-500/50 rounded-3xl p-5 md:p-6 text-white shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-brand-gold-500/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-brand-gold-400 flex items-center justify-center text-amber-300 shadow-sm shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-black text-amber-300 uppercase tracking-wide flex items-center gap-2">
              <span>TEAM PERFORMANCE & TREND GRAPH</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full uppercase font-bold">
                LIVE ANALYTICS
              </span>
            </h3>
            <p className="text-xs text-brand-green-200/80 font-medium">
              Real-time team standings, point totals, and performance rank movement
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-amber-200/90 font-mono font-bold bg-black/30 px-3 py-1.5 rounded-xl border border-brand-gold-500/30 self-stretch sm:self-auto text-center sm:text-right">
          TOTAL POINTS: <span className="text-amber-400 font-black text-sm">{totalAllPoints}</span>
        </div>
      </div>

      {/* Bar Chart & Rank Trend List */}
      <div className="space-y-4">
        {teamsData.map((team, idx) => {
          const currentRank = idx + 1;
          const prevRank = db.prevRanks?.[team.id] ?? currentRank;
          const percentageOfMax = Math.round((team.totalPoints / maxPoints) * 100);
          const percentageOfTotal = Math.round((team.totalPoints / totalAllPoints) * 100);

          // Trend calculation (Rank difference)
          let trend: 'up' | 'down' | 'stable' = 'stable';
          let diff = 0;
          if (prevRank > currentRank) {
            trend = 'up'; // Rank improved (e.g., went from 3 to 1)
            diff = prevRank - currentRank;
          } else if (prevRank < currentRank) {
            trend = 'down'; // Rank dropped (e.g., went from 1 to 2)
            diff = currentRank - prevRank;
          }

          const rankBadges = [
            'bg-amber-400 text-brand-green-950 font-black shadow-lg shadow-amber-500/30',
            'bg-slate-200 text-slate-900 font-black shadow-md',
            'bg-amber-700 text-amber-100 font-black shadow-md',
          ];

          return (
            <div
              key={team.id}
              className="p-3.5 bg-black/40 border border-brand-gold-500/20 rounded-2xl space-y-2 hover:border-brand-gold-500/60 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                {/* Team Rank + Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      idx < 3 ? rankBadges[idx] : 'bg-brand-green-800 text-white font-bold border border-white/20'
                    }`}
                  >
                    #{currentRank}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-white/40"
                        style={{ backgroundColor: team.color || '#eab308' }}
                      />
                      <span className="font-extrabold text-sm text-white truncate">{team.name}</span>
                    </div>
                  </div>
                </div>

                {/* Score & Trend Indicator */}
                <div className="flex items-center gap-3 shrink-0">
                  {/* Rise / Fall Trend Indicator */}
                  {trend === 'up' && (
                    <span
                      className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 animate-pulse"
                      title={`Risen by ${diff} place(s)`}
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      +{diff} UP
                    </span>
                  )}
                  {trend === 'down' && (
                    <span
                      className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1"
                      title={`Dropped by ${diff} place(s)`}
                    >
                      <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                      -{diff} DOWN
                    </span>
                  )}
                  {trend === 'stable' && (
                    <span
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/10 text-white/70 border border-white/20 flex items-center gap-1"
                      title="Rank position stable"
                    >
                      <Minus className="w-3.5 h-3.5 text-gray-300" />
                      STABLE
                    </span>
                  )}

                  {/* Points display */}
                  <div className="text-right">
                    <span className="text-base font-black text-amber-400 block leading-none font-mono">
                      {team.totalPoints} <span className="text-[10px] font-sans font-normal text-amber-200">PTS</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">{percentageOfTotal}% share</span>
                  </div>
                </div>
              </div>

              {/* Graphical Bar */}
              <div className="relative w-full h-3.5 bg-black/60 rounded-full overflow-hidden border border-white/10 p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out shadow-inner"
                  style={{
                    width: `${Math.max(percentageOfMax, 4)}%`,
                    backgroundColor: team.color || '#eab308',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
