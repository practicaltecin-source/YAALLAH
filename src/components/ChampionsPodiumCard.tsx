import React from 'react';
import { Trophy, Award, Sparkles, Crown } from 'lucide-react';
import { Database } from '../types';

interface ChampionsPodiumCardProps {
  db: Database;
}

export const ChampionsPodiumCard: React.FC<ChampionsPodiumCardProps> = ({ db }) => {
  const sortedTeams = [...db.teams].sort((a, b) => b.points - a.points);

  if (sortedTeams.length === 0) return null;

  const firstPlace = sortedTeams[0];
  const secondPlace = sortedTeams.length > 1 ? sortedTeams[1] : null;
  const thirdPlace = sortedTeams.length > 2 ? sortedTeams[2] : null;

  const bgUrl = db.settings?.podiumBgUrl;
  const opacity = db.settings?.podiumBgOpacity !== undefined ? db.settings.podiumBgOpacity : 0.6;

  return (
    <div className="relative w-full overflow-hidden bg-slate-950/90 border-2 border-brand-gold-500/50 rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)] my-6 font-sans">
      {/* Background Poster Image Layer */}
      {bgUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none transition-opacity duration-300"
          style={{
            backgroundImage: `url(${bgUrl})`,
            opacity: opacity,
          }}
        />
      ) : (
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-600/30 via-emerald-950/70 to-slate-950 pointer-events-none transition-opacity duration-300"
          style={{ opacity: opacity }}
        />
      )}

      {/* Subtle Gradient Overlay to ensure text legibility while keeping poster fully visible */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-slate-950/20 pointer-events-none" />
      
      {/* Top Center Cone Spotlight Beam */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 sm:w-96 h-96 bg-gradient-to-b from-amber-300/30 via-amber-400/10 to-transparent blur-2xl pointer-events-none animate-pulse" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-amber-300/80 blur-sm rounded-full shadow-[0_0_20px_#ffd700]" />

      {/* Content Container */}
      <div className="relative z-10 text-center space-y-4">
        {/* Header Badge */}
        <div className="inline-flex items-center gap-2 bg-black/60 border border-brand-gold-500/50 px-4 py-1.5 rounded-full backdrop-blur-md shadow-[0_0_15px_rgba(217,119,6,0.3)]">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span className="text-brand-gold-300 font-extrabold text-[11px] sm:text-xs uppercase tracking-widest flex items-center gap-1.5">
            🏆 LIVE CHAMPIONSHIP CEREMONY PODIUM 🏆
          </span>
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-brand-gold-100 uppercase tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            {db.settings.eventName || 'Overall Champions'}
          </h2>
          <p className="text-xs text-brand-gold-300/90 font-serif italic mt-0.5 drop-shadow">
            Real-Time Overall Team Standings & Podium Stage
          </p>
        </div>

        {/* 3D LIVE STAGE & GLASS-TRANSPARENT PODIUM VISUALIZATION */}
        <div className="relative pt-8 pb-2 mt-4 select-none">
          {/* Stage Reflective Floor Line */}
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/80 via-amber-500/10 to-transparent rounded-b-2xl border-b border-amber-500/30" />

          <div className="relative z-10 flex items-end justify-center gap-2 sm:gap-4 md:gap-8 min-h-[240px] sm:min-h-[270px]">
            
            {/* 2ND PLACE (SILVER PODIUM - LEFT - GLASS TRANSPARENT) */}
            {secondPlace && (
              <div className="flex flex-col items-center w-24 sm:w-28 md:w-36 text-center group">
                {/* Team Info & Mascot */}
                <div className="mb-3 space-y-1 transform transition-transform duration-300 group-hover:-translate-y-1">
                  <div className="text-2xl sm:text-3xl drop-shadow-[0_0_8px_rgba(192,192,192,0.8)] animate-bounce-subtle" style={{ animationDelay: '0.4s' }}>
                    🥈
                  </div>
                  <div className="relative w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-slate-900/80 border-2 border-slate-300 flex items-center justify-center text-lg sm:text-xl font-bold text-slate-100 mx-auto shadow-[0_5px_15px_rgba(0,0,0,0.7)] overflow-hidden ring-2 ring-slate-400/40 backdrop-blur-md">
                    {secondPlace.logoUrl ? (
                      <img src={secondPlace.logoUrl} alt={secondPlace.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <span>{secondPlace.symbol || '🥈'}</span>
                    )}
                  </div>
                  <div className="font-display font-extrabold text-xs sm:text-sm text-slate-100 truncate max-w-[90px] sm:max-w-[120px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                    {secondPlace.name}
                  </div>
                </div>

                {/* 3D Glass Transparent Silver Podium Box */}
                <div className="relative w-full">
                  {/* Top Perspective Face */}
                  <div className="h-4 bg-slate-200/40 backdrop-blur-md rounded-t-lg border-t border-l border-r border-white/80 shadow-inner transform -skew-x-6 origin-bottom-left" />
                  
                  {/* Front Main Box (Glassmorphic Transparent) */}
                  <div className="w-full bg-slate-950/30 backdrop-blur-md border-t-2 border-slate-200 border-x border-slate-400/40 rounded-b-xl h-24 sm:h-28 md:h-32 flex flex-col justify-between items-center p-2 shadow-[0_10px_25px_rgba(0,0,0,0.6)] relative overflow-hidden ring-1 ring-white/20">
                    {/* Metallic Glass Highlights */}
                    <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.25)_50%,transparent_70%)] pointer-events-none" />
                    
                    <span className="text-[9px] sm:text-[10px] font-mono font-black text-slate-100 bg-slate-900/80 border border-slate-400/50 px-2 py-0.5 rounded-full uppercase tracking-wider shadow backdrop-blur-md">
                      2ND RUNNER UP
                    </span>
                    
                    <div className="my-auto text-center space-y-0.5">
                      <span className="block text-2xl sm:text-3xl font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                        2
                      </span>
                      <span className="font-mono text-xs sm:text-sm font-black text-slate-100 bg-black/70 px-2 py-0.5 rounded border border-slate-300/30 backdrop-blur-md shadow">
                        {secondPlace.points} <span className="text-[9px] text-slate-300 font-normal">PTS</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 1ST PLACE (GOLD PODIUM - CENTER - GLASS TRANSPARENT) */}
            {firstPlace && (
              <div className="flex flex-col items-center w-28 sm:w-36 md:w-44 text-center group z-20">
                {/* Crown & Team Info */}
                <div className="mb-3 space-y-1 transform transition-transform duration-300 group-hover:-translate-y-2">
                  <div className="relative inline-block">
                    <div className="text-3xl sm:text-4xl text-amber-300 drop-shadow-[0_0_12px_rgba(255,215,0,0.9)] animate-bounce">
                      👑
                    </div>
                    <Sparkles className="absolute -top-2 -right-3 w-4 h-4 text-amber-300 animate-ping" />
                  </div>

                  <div className="relative w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-amber-500/90 via-amber-300/90 to-yellow-100/90 border-4 border-amber-300 flex items-center justify-center text-2xl sm:text-3xl font-black text-amber-950 mx-auto shadow-[0_0_25px_rgba(245,158,11,0.7)] overflow-hidden ring-4 ring-amber-400/40 backdrop-blur-md">
                    {firstPlace.logoUrl ? (
                      <img src={firstPlace.logoUrl} alt={firstPlace.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <span>{firstPlace.symbol || '👑'}</span>
                    )}
                  </div>

                  <div className="font-display font-black text-sm sm:text-base md:text-lg text-amber-200 truncate max-w-[110px] sm:max-w-[150px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                    {firstPlace.name}
                  </div>
                </div>

                {/* 3D Glass Transparent Gold Podium Box */}
                <div className="relative w-full">
                  {/* Top Perspective Face */}
                  <div className="h-5 bg-gradient-to-r from-amber-300/60 via-yellow-100/70 to-amber-400/60 backdrop-blur-md rounded-t-xl border-t-2 border-l border-r border-yellow-200 shadow-inner transform -skew-x-6 origin-bottom-left" />
                  
                  {/* Front Main Box (Glassmorphic Transparent) */}
                  <div className="w-full bg-amber-950/30 backdrop-blur-md border-t-4 border-amber-300 border-x-2 border-amber-400/60 rounded-b-2xl h-32 sm:h-36 md:h-40 flex flex-col justify-between items-center p-2.5 shadow-[0_15px_35px_rgba(245,158,11,0.3)] relative overflow-hidden ring-1 ring-amber-300/40">
                    {/* Metallic Glass Highlights */}
                    <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.35)_50%,transparent_70%)] pointer-events-none" />
                    
                    <span className="bg-gradient-to-r from-amber-300 to-yellow-200 text-amber-950 text-[10px] sm:text-xs font-black uppercase px-3 py-0.5 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.6)] tracking-wider">
                      ★ CHAMPION ★
                    </span>
                    
                    <div className="my-auto text-center space-y-0.5">
                      <span className="block text-3xl sm:text-4xl md:text-5xl font-black text-amber-100 drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)]">
                        1
                      </span>
                      <span className="font-mono text-sm sm:text-base md:text-lg font-black text-white bg-black/80 px-2.5 py-0.5 rounded border border-amber-400/50 backdrop-blur-md shadow-lg">
                        {firstPlace.points} <span className="text-[10px] text-amber-300 font-bold">PTS</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3RD PLACE (BRONZE PODIUM - RIGHT - GLASS TRANSPARENT) */}
            {thirdPlace && (
              <div className="flex flex-col items-center w-22 sm:w-26 md:w-32 text-center group">
                {/* Team Info & Mascot */}
                <div className="mb-3 space-y-1 transform transition-transform duration-300 group-hover:-translate-y-1">
                  <div className="text-2xl sm:text-3xl drop-shadow-[0_0_8px_rgba(205,127,50,0.8)] animate-bounce-subtle" style={{ animationDelay: '0.8s' }}>
                    🥉
                  </div>
                  <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-950/80 border-2 border-amber-600 flex items-center justify-center text-base sm:text-lg font-bold text-amber-100 mx-auto shadow-[0_5px_15px_rgba(0,0,0,0.7)] overflow-hidden ring-2 ring-amber-700/40 backdrop-blur-md">
                    {thirdPlace.logoUrl ? (
                      <img src={thirdPlace.logoUrl} alt={thirdPlace.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <span>{thirdPlace.symbol || '🥉'}</span>
                    )}
                  </div>
                  <div className="font-display font-extrabold text-[11px] sm:text-xs text-amber-300 truncate max-w-[80px] sm:max-w-[100px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                    {thirdPlace.name}
                  </div>
                </div>

                {/* 3D Glass Transparent Bronze Podium Box */}
                <div className="relative w-full">
                  {/* Top Perspective Face */}
                  <div className="h-3.5 bg-amber-600/40 backdrop-blur-md rounded-t-lg border-t border-l border-r border-amber-300/60 shadow-inner transform -skew-x-6 origin-bottom-left" />
                  
                  {/* Front Main Box (Glassmorphic Transparent) */}
                  <div className="w-full bg-amber-950/30 backdrop-blur-md border-t-2 border-amber-500 border-x border-amber-700/50 rounded-b-xl h-18 sm:h-22 md:h-26 flex flex-col justify-between items-center p-1.5 shadow-[0_10px_25px_rgba(0,0,0,0.6)] relative overflow-hidden ring-1 ring-amber-500/20">
                    {/* Metallic Glass Highlights */}
                    <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.2)_50%,transparent_70%)] pointer-events-none" />
                    
                    <span className="text-[8px] sm:text-[9px] font-mono font-black text-amber-300 bg-amber-950/80 border border-amber-700/50 px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow backdrop-blur-md">
                      3RD PLACE
                    </span>
                    
                    <div className="my-auto text-center space-y-0.5">
                      <span className="block text-xl sm:text-2xl font-black text-amber-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                        3
                      </span>
                      <span className="font-mono text-xs sm:text-xs font-bold text-amber-200 bg-black/70 px-1.5 py-0.5 rounded border border-amber-600/30 backdrop-blur-md shadow">
                        {thirdPlace.points} <span className="text-[8px] text-amber-400 font-normal">PTS</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
