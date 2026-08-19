import { Database, QuizQuestion } from '../types';
import { Sparkles, Trophy, HelpCircle, ArrowRight, CheckCircle2, Gift } from 'lucide-react';

interface LiveQuizCardProps {
  db: Database;
  onOpenQuizView: () => void;
}

export default function LiveQuizCard({ db, onOpenQuizView }: LiveQuizCardProps) {
  const quizzes = db.quizzes || [];
  if (quizzes.length === 0 || db.settings.showLiveQuiz === false) return null;

  // Find most active quiz or latest
  const activeQuiz = quizzes.find(q => q.status === 'ACTIVE' || q.status === 'ANSWER_REVEALED' || q.status === 'WINNER_ANNOUNCED') || quizzes[quizzes.length - 1];
  if (!activeQuiz) return null;

  const isLive = activeQuiz.status === 'ACTIVE';
  const hasWinner = activeQuiz.status === 'WINNER_ANNOUNCED' || (activeQuiz.status === 'COMPLETED' && !!activeQuiz.winnerName);
  const isAnswerRevealed = activeQuiz.status === 'ANSWER_REVEALED';

  return (
    <div 
      onClick={onOpenQuizView}
      className={`rounded-3xl p-4 md:p-5 transition-all cursor-pointer shadow-md select-none border-2 relative overflow-hidden group ${
        hasWinner
          ? 'bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-500 border-amber-600 text-slate-950 hover:shadow-lg'
          : isLive
          ? 'bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-950 border-purple-400 text-white hover:shadow-lg'
          : 'bg-[#fffef7] border-purple-300 text-slate-900 hover:border-purple-500'
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/10 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <span className={`font-black text-xs uppercase tracking-wider ${hasWinner ? 'text-amber-950' : isLive ? 'text-purple-200' : 'text-purple-900'}`}>
            Live Quiz
          </span>
        </div>

        <div>
          {isLive && (
            <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-full font-black text-[10px] uppercase tracking-wider flex items-center gap-1 animate-pulse shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              LIVE QUESTION
            </span>
          )}
          {hasWinner && (
            <span className="px-2.5 py-0.5 bg-slate-950 text-amber-300 rounded-full font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-xs">
              🏆 WINNER DECLARED
            </span>
          )}
          {isAnswerRevealed && (
            <span className="px-2.5 py-0.5 bg-emerald-700 text-white rounded-full font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-xs">
              <CheckCircle2 className="w-3 h-3" />
              ANSWER OUT
            </span>
          )}
        </div>
      </div>

      {hasWinner ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 bg-slate-950 text-amber-300 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-md">
              🥇
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider block">
                Quiz #{activeQuiz.questionNumber} Winner:
              </span>
              <h4 className="text-base md:text-lg font-black uppercase text-slate-950 truncate">
                {activeQuiz.winnerName}
              </h4>
              {activeQuiz.winnerDetails && (
                <p className="text-xs font-bold text-slate-800 truncate">
                  {activeQuiz.winnerDetails}
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0 bg-slate-950 text-amber-300 p-2 rounded-xl text-xs font-black flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            <span>View</span> <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded font-mono font-black text-[10px] ${isLive ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-900'}`}>
              Q#{activeQuiz.questionNumber}
            </span>
            {activeQuiz.sponsorName && (
              <span className="text-[10px] font-bold opacity-90 flex items-center gap-1">
                <Gift className="w-3 h-3 text-amber-400" /> {activeQuiz.sponsorName}
              </span>
            )}
          </div>

          <p className="text-xs md:text-sm font-bold line-clamp-2 leading-relaxed">
            {activeQuiz.questionText}
          </p>

          <div className="flex items-center justify-between pt-1 text-[11px] font-black">
            <span className={isLive ? 'text-amber-300' : 'text-purple-700'}>
              {isAnswerRevealed ? `Answer: ${activeQuiz.correctAnswer}` : 'Tap to view options & details &rarr;'}
            </span>
            <span className="opacity-75 text-[10px]">
              {quizzes.length} Questions Total
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
