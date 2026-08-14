import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, Sparkles } from 'lucide-react';
import { Database } from '../types';

interface CelebrationPodiumModalProps {
  db: Database;
  showPodiumModal: boolean;
  countdownSecs: number;
  isMuted: boolean;
  handleToggleMute: () => void;
  handleClosePodiumModal: () => void;
  onUpdateDb?: (newDb: Database) => void;
}

export const CelebrationPodiumModal: React.FC<CelebrationPodiumModalProps> = ({
  db,
  showPodiumModal,
  countdownSecs,
  isMuted,
  handleToggleMute,
  handleClosePodiumModal,
}) => {
  if (!showPodiumModal) return null;

  const sortedTeams = [...db.teams].sort((a, b) => b.points - a.points);
  const bgUrl = db.settings?.podiumBgUrl;
  const opacityVal = db.settings?.podiumBgOpacity !== undefined ? db.settings.podiumBgOpacity : 0.6;

  const firstPlace = sortedTeams[0];
  const secondPlace = sortedTeams.length > 1 ? sortedTeams[1] : null;
  const thirdPlace = sortedTeams.length > 2 ? sortedTeams[2] : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto font-sans">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-xl bg-slate-950/90 border-2 border-brand-gold-500/50 rounded-3xl p-5 sm:p-7 text-white shadow-[0_25px_60px_rgba(0,0,0,0.9)] space-y-5 overflow-hidden max-h-[95vh] flex flex-col"
        >
          {/* Modal Background Poster Image Layer */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-3xl">
            {bgUrl ? (
              <img
                src={bgUrl}
                alt="Ceremony Background Poster"
                className="w-full h-full object-cover transition-opacity duration-300"
                style={{ opacity: opacityVal }}
              />
            ) : (
              <div
                className="w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-600/40 via-emerald-950/80 to-brand-green-950 transition-opacity duration-300"
                style={{ opacity: opacityVal }}
              />
            )}
            {/* Soft Overlay to keep background poster clearly visible while guaranteeing readable text */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-slate-950/20 pointer-events-none" />
          </div>

          {countdownSecs > 0 ? (
            /* SUSPENSE COUNTDOWN VIEW */
            <div className="relative z-10 flex flex-col items-center justify-center py-12 sm:py-16 text-center space-y-6 select-none">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent)] pointer-events-none" />

              <span className="text-[10px] tracking-widest font-extrabold text-brand-gold-400 uppercase bg-black/80 px-4 py-1.5 rounded-full border border-brand-gold-500/30 shadow">
                📢 CHAMPIONS REVEAL INCOMING 📢
              </span>

              <div className="relative flex items-center justify-center w-36 h-36">
                <div className="absolute inset-0 rounded-full border-4 border-brand-gold-400/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-brand-gold-400/40 animate-pulse" />
                <div className="absolute inset-0 rounded-full bg-black/90 flex items-center justify-center shadow-lg border border-brand-gold-500/20">
                  <motion.span
                    key={countdownSecs}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.4, opacity: 0 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    className="font-display text-6xl font-black text-brand-gold-400 drop-shadow-[0_0_15px_rgba(171,155,116,0.6)]"
                  >
                    {countdownSecs}
                  </motion.span>
                </div>
              </div>

              <div className="space-y-1 max-w-xs">
                <h3 className="font-display text-xs sm:text-sm font-bold text-brand-gold-300 uppercase tracking-widest animate-pulse">
                  REVEALING CHAMPIONSHIP STANDINGS...
                </h3>
                <p className="text-[10px] text-white/60 uppercase tracking-wider">
                  Please hold your breath!
                </p>
              </div>
            </div>
          ) : (
            /* REVEALED CHAMPIONS & GLASS TRANSPARENT 3D PODIUM STAGE VIEW */
            <>
              {/* Confetti Rain inside the modal */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                {Array.from({ length: 45 }).map((_, i) => {
                  const colors = ['#ffd700', '#c0c0c0', '#cd7f32', '#f1ece1', '#ab9b74', '#ff4500', '#32cd32'];
                  const anims = ['animate-confetti-1', 'animate-confetti-2', 'animate-confetti-3'];
                  return (
                    <div
                      key={i}
                      className={`absolute rounded-full opacity-0 ${anims[i % 3]}`}
                      style={{
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 4}s`,
                        width: `${Math.floor(Math.random() * 6) + 6}px`,
                        height: `${Math.floor(Math.random() * 6) + 6}px`,
                        backgroundColor: colors[i % colors.length],
                        top: '-10px',
                      }}
                    />
                  );
                })}
              </div>

              {/* Controls Header: Audio, Live Status, Close Button */}
              <div className="relative z-30 flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">
                    LIVE CEREMONY
                  </span>
                </div>

                {/* Audio & Close Action Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleToggleMute}
                    title={isMuted ? 'Unmute Victory Audio' : 'Mute Victory Audio'}
                    className="text-white bg-black/70 hover:bg-black/90 border border-white/20 px-2.5 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer text-xs font-bold"
                  >
                    {isMuted ? (
                      <VolumeX className="w-3.5 h-3.5 text-rose-300" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                    )}
                    <span className="text-[10px]">{isMuted ? 'Muted' : 'Music On'}</span>
                  </button>
                  <button
                    onClick={handleClosePodiumModal}
                    className="text-white/80 hover:text-white bg-black/70 hover:bg-black/90 border border-white/20 w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer text-xs font-bold"
                    title="Close Ceremony"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Ceremony Header Title */}
              <div className="relative z-10 text-center space-y-1">
                <span className="text-[9px] tracking-widest font-extrabold text-brand-gold-400 uppercase bg-black/80 px-3.5 py-1 rounded-full border border-brand-gold-500/30 inline-block shadow">
                  🏆 LIVE CHAMPIONSHIP CEREMONY 🏆
                </span>
                <h2 className="font-display text-xl sm:text-2xl font-black text-brand-gold-100 uppercase tracking-wide pt-1 drop-shadow-md">
                  {db.settings.eventName || 'KALIMA 2k26 MEELAD FEST'}
                </h2>
                <p className="text-[11px] text-brand-gold-300/90 font-serif italic">
                  Overall Team Standings & 3D Podium Stage
                </p>
              </div>

              {/* 3D LIVE STAGE & GLASS TRANSPARENT PODIUM VISUALIZATION */}
              <div className="relative z-10 pt-6 pb-2 select-none">
                {/* Stage Floor Reflective Surface */}
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/80 via-amber-500/10 to-transparent rounded-b-2xl border-b border-amber-500/20 pointer-events-none" />

                <div className="relative z-10 flex items-end justify-center gap-2 sm:gap-4 md:gap-6 min-h-[230px] sm:min-h-[260px]">
                  
                  {/* 2ND PLACE (SILVER PODIUM - LEFT - GLASS TRANSPARENT) */}
                  {secondPlace && (
                    <div className="flex flex-col items-center w-24 sm:w-28 md:w-32 text-center group">
                      <div className="mb-2 space-y-1 transform transition-transform duration-300 group-hover:-translate-y-1">
                        <div className="text-2xl sm:text-3xl drop-shadow-[0_0_8px_rgba(192,192,192,0.8)] animate-bounce-subtle" style={{ animationDelay: '0.5s' }}>
                          🥈
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 border-2 border-slate-300 flex items-center justify-center text-lg font-bold text-slate-100 mx-auto shadow-md overflow-hidden ring-2 ring-slate-400/40 backdrop-blur-md">
                          {secondPlace.logoUrl ? (
                            <img src={secondPlace.logoUrl} alt={secondPlace.name} className="w-full h-full object-contain p-0.5" />
                          ) : (
                            secondPlace.symbol
                          )}
                        </div>
                        <div className="font-display text-xs font-bold truncate max-w-[90px] text-slate-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                          {secondPlace.name}
                        </div>
                      </div>

                      {/* 3D Glass Transparent Silver Box */}
                      <div className="relative w-full">
                        <div className="h-3.5 bg-slate-200/40 backdrop-blur-md rounded-t-lg border-t border-l border-r border-white/80 shadow-inner transform -skew-x-6 origin-bottom-left" />
                        <div className="w-full bg-slate-950/30 backdrop-blur-md border-t-2 border-slate-200 border-x border-slate-400/40 rounded-b-xl h-22 sm:h-26 flex flex-col justify-between items-center p-1.5 shadow-[0_10px_25px_rgba(0,0,0,0.6)] relative overflow-hidden ring-1 ring-white/20">
                          <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.25)_50%,transparent_70%)] pointer-events-none" />
                          <span className="text-[8px] sm:text-[9px] font-mono font-black text-slate-100 bg-slate-900/80 border border-slate-400/50 px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow backdrop-blur-md">
                            2ND RUNNER UP
                          </span>
                          <div className="my-auto text-center space-y-0.5">
                            <span className="block text-2xl font-black text-white drop-shadow">2</span>
                            <span className="font-mono text-xs font-black text-slate-100 bg-black/70 px-1.5 py-0.5 rounded border border-slate-300/30 backdrop-blur-md shadow">
                              {secondPlace.points} <span className="text-[8px] text-slate-300">PTS</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 1ST PLACE (GOLD PODIUM - CENTER - GLASS TRANSPARENT) */}
                  {firstPlace && (
                    <div className="flex flex-col items-center w-28 sm:w-34 md:w-38 text-center group z-20">
                      <div className="mb-2 space-y-1 transform transition-transform duration-300 group-hover:-translate-y-2">
                        <div className="relative inline-block">
                          <div className="text-3xl sm:text-4xl text-amber-300 drop-shadow-[0_0_12px_rgba(255,215,0,0.9)] animate-bounce">
                            👑
                          </div>
                          <Sparkles className="absolute -top-2 -right-3 w-4 h-4 text-amber-300 animate-ping" />
                        </div>
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-amber-500/90 via-amber-300/90 to-yellow-100/90 border-3 border-amber-300 flex items-center justify-center text-xl sm:text-2xl font-black text-amber-950 mx-auto shadow-[0_0_20px_rgba(245,158,11,0.7)] overflow-hidden ring-4 ring-amber-400/40 backdrop-blur-md">
                          {firstPlace.logoUrl ? (
                            <img src={firstPlace.logoUrl} alt={firstPlace.name} className="w-full h-full object-contain p-0.5" />
                          ) : (
                            firstPlace.symbol
                          )}
                        </div>
                        <div className="font-display font-black text-xs sm:text-sm md:text-base text-amber-200 truncate max-w-[110px] sm:max-w-[130px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                          {firstPlace.name}
                        </div>
                      </div>

                      {/* 3D Glass Transparent Gold Box */}
                      <div className="relative w-full">
                        <div className="h-4 bg-gradient-to-r from-amber-300/60 via-yellow-100/70 to-amber-400/60 backdrop-blur-md rounded-t-xl border-t-2 border-l border-r border-yellow-200 shadow-inner transform -skew-x-6 origin-bottom-left" />
                        <div className="w-full bg-amber-950/30 backdrop-blur-md border-t-4 border-amber-300 border-x-2 border-amber-400/60 rounded-b-2xl h-28 sm:h-32 md:h-36 flex flex-col justify-between items-center p-2 shadow-[0_15px_35px_rgba(245,158,11,0.3)] relative overflow-hidden ring-1 ring-amber-300/40">
                          <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.35)_50%,transparent_70%)] pointer-events-none" />
                          <span className="bg-gradient-to-r from-amber-300 to-yellow-200 text-amber-950 text-[9px] sm:text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow tracking-wider">
                            ★ CHAMPION ★
                          </span>
                          <div className="my-auto text-center space-y-0.5">
                            <span className="block text-3xl sm:text-4xl font-black text-amber-100 drop-shadow">1</span>
                            <span className="font-mono text-xs sm:text-sm font-black text-white bg-black/80 px-2 py-0.5 rounded border border-amber-400/50 backdrop-blur-md shadow-lg">
                              {firstPlace.points} <span className="text-[9px] text-amber-300">PTS</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3RD PLACE (BRONZE PODIUM - RIGHT - GLASS TRANSPARENT) */}
                  {thirdPlace && (
                    <div className="flex flex-col items-center w-20 sm:w-24 md:w-28 text-center group">
                      <div className="mb-2 space-y-1 transform transition-transform duration-300 group-hover:-translate-y-1">
                        <div className="text-2xl drop-shadow-[0_0_8px_rgba(205,127,50,0.8)] animate-bounce-subtle" style={{ animationDelay: '1s' }}>
                          🥉
                        </div>
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-950/80 border-2 border-amber-600 flex items-center justify-center text-base font-bold text-amber-100 mx-auto shadow-sm overflow-hidden ring-2 ring-amber-700/40 backdrop-blur-md">
                          {thirdPlace.logoUrl ? (
                            <img src={thirdPlace.logoUrl} alt={thirdPlace.name} className="w-full h-full object-contain p-0.5" />
                          ) : (
                            thirdPlace.symbol
                          )}
                        </div>
                        <div className="font-display text-[10px] font-bold truncate max-w-[80px] text-amber-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                          {thirdPlace.name}
                        </div>
                      </div>

                      {/* 3D Glass Transparent Bronze Box */}
                      <div className="relative w-full">
                        <div className="h-3 bg-amber-600/40 backdrop-blur-md rounded-t-lg border-t border-l border-r border-amber-300/60 shadow-inner transform -skew-x-6 origin-bottom-left" />
                        <div className="w-full bg-amber-950/30 backdrop-blur-md border-t-2 border-amber-500 border-x border-amber-700/50 rounded-b-xl h-16 sm:h-20 flex flex-col justify-between items-center p-1 shadow-[0_10px_25px_rgba(0,0,0,0.6)] relative overflow-hidden ring-1 ring-amber-500/20">
                          <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.2)_50%,transparent_70%)] pointer-events-none" />
                          <span className="text-[7px] sm:text-[8px] font-mono font-black text-amber-300 bg-amber-950/80 border border-amber-700/50 px-1 py-0.5 rounded-full uppercase tracking-wider shadow backdrop-blur-md">
                            3RD PLACE
                          </span>
                          <div className="my-auto text-center space-y-0.5">
                            <span className="block text-lg font-black text-amber-200 drop-shadow">3</span>
                            <span className="font-mono text-[11px] font-bold text-amber-200 bg-black/70 px-1 py-0.5 rounded border border-amber-600/30 backdrop-blur-md shadow">
                              {thirdPlace.points} <span className="text-[7px] text-amber-400">PTS</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="relative z-10 bg-black/60 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 space-y-2 overflow-y-auto max-h-[140px] scrollbar-thin">
                <h4 className="text-[10px] font-extrabold uppercase text-brand-gold-400 tracking-wider flex items-center gap-1">
                  <span>📊</span> Complete Leaderboard Standings
                </h4>
                <div className="divide-y divide-white/10 font-sans">
                  {sortedTeams.map((team, index) => (
                    <div key={team.id} className="flex items-center justify-between py-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white/50 w-4 text-right font-bold">{index + 1}.</span>
                        <span className="text-base">{team.symbol}</span>
                        <span className="font-semibold text-white/90">{team.name}</span>
                      </div>
                      <span className="font-mono font-bold text-brand-gold-400">{team.points} pts</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Close Button */}
              <div className="relative z-10 pt-1 text-center">
                <button
                  onClick={handleClosePodiumModal}
                  className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 active:scale-95 text-brand-green-950 font-black text-xs py-3 rounded-xl transition-all cursor-pointer shadow-lg tracking-wider uppercase"
                >
                  Close Ceremony
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
