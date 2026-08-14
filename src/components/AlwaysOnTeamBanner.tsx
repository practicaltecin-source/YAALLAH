import React from 'react';
import { Database, Team } from '../types';
import { Shield, Award } from 'lucide-react';
import { applySuspenseRotation } from '../utils/suspense';

interface AlwaysOnTeamBannerProps {
  db: Database;
}

export const AlwaysOnTeamBanner: React.FC<AlwaysOnTeamBannerProps> = ({ db }) => {
  const showPoints = db.settings?.showTeamPointsInBanner !== false;

  const [suspenseStep, setSuspenseStep] = React.useState(0);

  React.useEffect(() => {
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

  // Calculate scores for each team
  const teamsWithScores = db.teams.map((team) => {
    let pts = team.points || 0;
    return { ...team, totalPoints: pts };
  });

  // Sort descending by points
  teamsWithScores.sort((a, b) => b.totalPoints - a.totalPoints);

  const rotatedTeams = applySuspenseRotation<typeof teamsWithScores[number]>(teamsWithScores, db.settings?.suspenseSwapMode, suspenseStep);

  if (rotatedTeams.length === 0) return null;

  return (
    <div className="w-full bg-gradient-to-r from-brand-green-950 via-brand-green-900 to-brand-green-950 border-y border-brand-gold-500/40 py-2.5 px-3 my-3 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-amber-400 text-sm font-black flex items-center gap-1">
            <Shield className="w-4 h-4 text-brand-gold-400 inline" />
            TEAMS
          </span>
          <span className="text-[10px] bg-brand-gold-500/20 text-brand-gold-300 font-bold px-2 py-0.5 rounded-full border border-brand-gold-500/30 uppercase tracking-wider">
            LIVE DISPLAY
          </span>
        </div>

        {/* Horizontal Scrolling or Flex wrap of teams */}
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1 flex-1 justify-start sm:justify-center">
          {rotatedTeams.map((team, idx) => {
            const isTop3 = idx < 3;
            const rankColors = [
              'bg-amber-500/30 border-amber-400 text-amber-300',
              'bg-slate-300/30 border-slate-300 text-slate-200',
              'bg-amber-700/30 border-amber-600 text-amber-400',
            ];
            const badgeClass = isTop3 ? rankColors[idx] : 'bg-black/30 border-white/20 text-white/80';

            return (
              <div
                key={team.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 transition-all shadow-xs ${badgeClass}`}
                style={{ backgroundColor: team.color ? `${team.color}22` : undefined, borderColor: team.color || undefined }}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0 border border-white/40 shadow-xs"
                  style={{ backgroundColor: team.color || '#eab308' }}
                />
                <span className="font-extrabold text-white truncate max-w-[110px] sm:max-w-none">
                  {team.name}
                </span>

                {showPoints ? (
                  <span className="bg-black/50 text-amber-300 font-mono font-black px-2 py-0.5 rounded-md text-[11px] border border-brand-gold-500/30">
                    {team.totalPoints} PTS
                  </span>
                ) : (
                  <span className="bg-white/10 text-white/90 font-mono font-black px-1.5 py-0.5 rounded-md text-[10px]">
                    #{idx + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
