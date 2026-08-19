import { useState } from 'react';
import { Database, QuizQuestion } from '../types';
import { HelpCircle, Trophy, CheckCircle2, Sparkles, Gift, Clock, Award, ChevronRight, Share2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface LiveQuizViewProps {
  db: Database;
  onNavigateHome?: () => void;
}

export default function LiveQuizView({ db, onNavigateHome }: LiveQuizViewProps) {
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);

  const quizzes = db.quizzes || [];
  const activeQuiz = quizzes.find(q => q.status === 'ACTIVE' || q.status === 'ANSWER_REVEALED' || q.status === 'WINNER_ANNOUNCED') || quizzes[quizzes.length - 1];

  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  };

  const currentViewingQuiz = selectedQuizId ? (quizzes.find(q => q.id === selectedQuizId) || activeQuiz) : activeQuiz;

  return (
    <div className="view active pb-20 max-w-2xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-brand-green-950 rounded-2xl p-5 md:p-6 text-white relative overflow-hidden shadow-lg border border-purple-500/30 select-none">
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/40 text-[10px] font-extrabold uppercase tracking-wider mb-2">
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>Interactive Stage Event</span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-black tracking-wide text-white leading-tight flex items-center gap-2">
              <span>🎯</span> Live Quiz
            </h1>
            <p className="text-xs md:text-sm text-purple-200/90 mt-1 font-medium leading-relaxed">
              Test your knowledge, participate in live stage questions, and win exciting prizes!
            </p>
          </div>

          <div className="shrink-0 bg-white/10 p-3 rounded-2xl border border-white/20 backdrop-blur-md text-amber-300 flex items-center justify-center shadow-inner">
            <Trophy className="w-8 h-8" />
          </div>
        </div>

        {/* Status ticker */}
        <div className="mt-4 pt-3 border-t border-purple-700/40 flex items-center justify-between text-xs font-bold text-purple-200">
          <span>Total Questions: <b>{quizzes.length}</b></span>
          {activeQuiz && (
            <span className="flex items-center gap-1.5 text-amber-300 bg-amber-400/20 px-2.5 py-0.5 rounded-full border border-amber-400/40 text-[11px] font-black animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Question #{activeQuiz.questionNumber} Active
            </span>
          )}
        </div>
      </div>

      {/* Main Quiz Display */}
      {currentViewingQuiz ? (
        <div className="space-y-4">
          <div className="bg-[#fffefb] border-2 border-purple-200 rounded-3xl p-5 md:p-6 shadow-md space-y-5 relative overflow-hidden">
            {/* Top Info Bar */}
            <div className="flex items-center justify-between gap-2 border-b border-purple-100 pb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1 rounded-xl bg-purple-700 text-white font-mono font-black text-xs md:text-sm shadow-xs">
                  QUESTION #{currentViewingQuiz.questionNumber}
                </span>
                {currentViewingQuiz.sponsorName && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                    <Gift className="w-3 h-3 text-amber-700" /> {currentViewingQuiz.sponsorName}
                  </span>
                )}
              </div>

              {/* Status Pill */}
              <div>
                {currentViewingQuiz.status === 'ACTIVE' && (
                  <span className="px-3 py-1 bg-rose-600 text-white rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-xs animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    🔴 LIVE QUESTION
                  </span>
                )}
                {currentViewingQuiz.status === 'ANSWER_REVEALED' && (
                  <span className="px-3 py-1 bg-emerald-700 text-white rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    ANSWER REVEALED
                  </span>
                )}
                {currentViewingQuiz.status === 'WINNER_ANNOUNCED' && (
                  <span className="px-3 py-1 bg-amber-500 text-slate-950 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-xs animate-bounce">
                    🏆 WINNER ANNOUNCED!
                  </span>
                )}
                {currentViewingQuiz.status === 'DRAFT' && (
                  <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 rounded-full font-bold text-[10px]">
                    Upcoming
                  </span>
                )}
              </div>
            </div>

            {/* Question Text in Clear Large Typography */}
            <div className="space-y-3">
              <p className="text-base md:text-xl font-bold text-slate-900 leading-relaxed font-display">
                {currentViewingQuiz.questionText}
              </p>

              {/* Multiple Choice Options if present */}
              {currentViewingQuiz.options && currentViewingQuiz.options.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  {currentViewingQuiz.options.map((opt, idx) => {
                    const isCorrect = (currentViewingQuiz.status === 'ANSWER_REVEALED' || currentViewingQuiz.status === 'WINNER_ANNOUNCED') && 
                      currentViewingQuiz.correctAnswer && 
                      (opt.toLowerCase().includes(currentViewingQuiz.correctAnswer.toLowerCase()) || currentViewingQuiz.correctAnswer.toLowerCase().includes(opt.toLowerCase()));

                    return (
                      <div 
                        key={idx}
                        className={`p-3 rounded-2xl border-2 font-bold text-xs md:text-sm transition-all flex items-center justify-between gap-2 ${
                          isCorrect 
                            ? 'bg-emerald-100 border-emerald-500 text-emerald-950 shadow-sm ring-2 ring-emerald-400 scale-[1.01]' 
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <span>{opt}</span>
                        {isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* REVEALED ANSWER CARD (Shown once Admin triggers Reveal) */}
            {(currentViewingQuiz.status === 'ANSWER_REVEALED' || currentViewingQuiz.status === 'WINNER_ANNOUNCED' || currentViewingQuiz.status === 'COMPLETED') && currentViewingQuiz.correctAnswer && (
              <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl space-y-1.5 shadow-sm animate-scaleIn">
                <div className="flex items-center gap-2 text-xs font-black text-emerald-900 uppercase tracking-wide">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Official Correct Answer:</span>
                </div>
                <div className="text-base md:text-lg font-black text-emerald-950">
                  {currentViewingQuiz.correctAnswer}
                </div>
              </div>
            )}

            {/* WINNER ANNOUNCEMENT CELEBRATION CARD */}
            {(currentViewingQuiz.status === 'WINNER_ANNOUNCED' || currentViewingQuiz.status === 'COMPLETED') && currentViewingQuiz.winnerName && (
              <div 
                onMouseEnter={triggerCelebration}
                className="p-5 bg-gradient-to-br from-amber-400 via-amber-300 to-yellow-400 border-2 border-amber-500 rounded-2xl text-slate-950 space-y-3 shadow-lg relative overflow-hidden animate-bounce-short"
              >
                <div className="flex items-center justify-between border-b border-amber-600/30 pb-2">
                  <span className="font-black text-xs uppercase tracking-widest text-amber-950 flex items-center gap-1.5">
                    <span>👑</span> OFFICIAL QUIZ WINNER
                  </span>
                  <span className="px-2.5 py-0.5 bg-slate-950 text-amber-300 rounded-full font-black text-[10px] uppercase">
                    1st Prize Winner
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-950 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-md">
                    🥇
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg md:text-xl font-black text-slate-950 uppercase tracking-tight leading-none">
                      {currentViewingQuiz.winnerName}
                    </h3>
                    {currentViewingQuiz.winnerDetails && (
                      <p className="text-xs md:text-sm font-bold text-slate-800 mt-1">
                        {currentViewingQuiz.winnerDetails}
                      </p>
                    )}
                    {currentViewingQuiz.winnerPrize && (
                      <p className="text-[11px] font-black text-purple-950 bg-white/70 px-2 py-0.5 rounded-md inline-block mt-1 border border-amber-600/20">
                        🎁 Prize: <b>{currentViewingQuiz.winnerPrize}</b>
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-[11px] font-bold text-slate-900 bg-white/40 p-2 rounded-xl text-center">
                  🎉 Congratulations to the winner! Please collect your gift from the Stage Control Desk.
                </div>
              </div>
            )}

            {/* Waiting message while answer is hidden */}
            {currentViewingQuiz.status === 'ACTIVE' && (
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-900 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-purple-600 shrink-0 animate-spin" />
                <span>
                  <b>Answer is currently locked.</b> The correct answer and winner will be announced live on stage shortly!
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 bg-white border border-brand-line rounded-3xl text-center space-y-2 shadow-sm">
          <div className="text-4xl">🎯</div>
          <b className="block text-sm text-brand-green-950 font-bold">No Live Quiz Published Yet</b>
          <p className="text-xs text-slate-600 max-w-xs mx-auto">
            The event team will publish interactive quiz questions during the live stage program. Stay tuned!
          </p>
        </div>
      )}

      {/* List of All Questions / Past Quiz Archive */}
      {quizzes.length > 1 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 rounded-full bg-purple-600" />
            <h2 className="font-display font-bold text-brand-green-900 text-sm md:text-base">
              All Quiz Questions & Past Winners
            </h2>
          </div>

          <div className="space-y-2">
            {quizzes.map((q) => {
              const isSelected = (currentViewingQuiz && currentViewingQuiz.id === q.id);
              return (
                <div 
                  key={q.id}
                  onClick={() => setSelectedQuizId(q.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected 
                      ? 'bg-purple-50 border-purple-400 shadow-sm ring-1 ring-purple-300' 
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-purple-700 text-white rounded font-mono font-black text-[10px]">
                        Q#{q.questionNumber}
                      </span>
                      {q.status === 'ACTIVE' && (
                        <span className="px-2 py-0.5 bg-rose-600 text-white rounded-full font-black text-[9px] uppercase animate-pulse">
                          🔴 Live Now
                        </span>
                      )}
                      {q.winnerName && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold text-[10px] flex items-center gap-1">
                          👑 Winner: <b>{q.winnerName}</b>
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-900 truncate mt-1">
                      {q.questionText}
                    </p>
                  </div>

                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-purple-700 translate-x-1' : 'text-slate-400'}`} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
