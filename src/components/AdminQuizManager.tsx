import { useState } from 'react';
import { Database, QuizQuestion } from '../types';
import { generateId } from '../db';
import { 
  HelpCircle, 
  Plus, 
  Trash2, 
  Edit3, 
  Play, 
  CheckCircle2, 
  Trophy, 
  Sparkles, 
  Clock, 
  Gift, 
  Check, 
  X,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AdminQuizManagerProps {
  db: Database;
  onUpdateDb: (updatedDb: Database) => void;
}

export default function AdminQuizManager({ db, onUpdateDb }: AdminQuizManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizQuestion | null>(null);

  // Form states
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [sponsorName, setSponsorName] = useState('');
  const [winnerPrize, setWinnerPrize] = useState('');

  // Winner Announcement Modal state
  const [announcingQuiz, setAnnouncingQuiz] = useState<QuizQuestion | null>(null);
  const [winnerNameInput, setWinnerNameInput] = useState('');
  const [winnerDetailsInput, setWinnerDetailsInput] = useState('');
  const [winnerPrizeInput, setWinnerPrizeInput] = useState('');

  const quizzes = db.quizzes || [];

  const handleOpenAdd = () => {
    setEditingQuiz(null);
    setQuestionText('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setCorrectAnswer('');
    setSponsorName('');
    setWinnerPrize('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (q: QuizQuestion) => {
    setEditingQuiz(q);
    setQuestionText(q.questionText);
    setOptionA(q.options?.[0] || '');
    setOptionB(q.options?.[1] || '');
    setOptionC(q.options?.[2] || '');
    setOptionD(q.options?.[3] || '');
    setCorrectAnswer(q.correctAnswer || '');
    setSponsorName(q.sponsorName || '');
    setWinnerPrize(q.winnerPrize || '');
    setShowAddModal(true);
  };

  const handleSaveQuestion = () => {
    if (!questionText.trim()) {
      alert('Please enter question text');
      return;
    }

    const options = [optionA, optionB, optionC, optionD].map(o => o.trim()).filter(Boolean);

    let updatedQuizzes = [...quizzes];

    if (editingQuiz) {
      updatedQuizzes = updatedQuizzes.map(q => {
        if (q.id === editingQuiz.id) {
          return {
            ...q,
            questionText: questionText.trim(),
            options: options.length > 0 ? options : undefined,
            correctAnswer: correctAnswer.trim(),
            sponsorName: sponsorName.trim() || undefined,
            winnerPrize: winnerPrize.trim() || undefined
          };
        }
        return q;
      });
    } else {
      const nextNumber = quizzes.length > 0 ? Math.max(...quizzes.map(q => q.questionNumber)) + 1 : 1;
      const newQ: QuizQuestion = {
        id: generateId(),
        questionNumber: nextNumber,
        questionText: questionText.trim(),
        options: options.length > 0 ? options : undefined,
        status: 'DRAFT',
        correctAnswer: correctAnswer.trim(),
        sponsorName: sponsorName.trim() || undefined,
        winnerPrize: winnerPrize.trim() || undefined,
        createdAt: new Date().toISOString()
      };
      updatedQuizzes.push(newQ);
    }

    onUpdateDb({
      ...db,
      quizzes: updatedQuizzes,
      lastModified: Date.now()
    });

    setShowAddModal(false);
  };

  const handleDeleteQuiz = (id: string) => {
    if (!confirm('Are you sure you want to delete this quiz question?')) return;
    const updatedQuizzes = quizzes.filter(q => q.id !== id);
    onUpdateDb({
      ...db,
      quizzes: updatedQuizzes,
      lastModified: Date.now()
    });
  };

  const handleSetStatus = (quizId: string, newStatus: QuizQuestion['status']) => {
    const updatedQuizzes = quizzes.map(q => {
      if (q.id === quizId) {
        return {
          ...q,
          status: newStatus,
          revealedAt: newStatus === 'ANSWER_REVEALED' ? new Date().toISOString() : q.revealedAt
        };
      }
      // If making this one active, deactivate other live ones to avoid collision
      if (newStatus === 'ACTIVE' && q.id !== quizId && q.status === 'ACTIVE') {
        return {
          ...q,
          status: 'COMPLETED' as const
        };
      }
      return q;
    });

    onUpdateDb({
      ...db,
      quizzes: updatedQuizzes,
      lastModified: Date.now()
    });
  };

  const handleOpenWinnerModal = (q: QuizQuestion) => {
    setAnnouncingQuiz(q);
    setWinnerNameInput(q.winnerName || '');
    setWinnerDetailsInput(q.winnerDetails || '');
    setWinnerPrizeInput(q.winnerPrize || '');
  };

  const handleConfirmWinner = () => {
    if (!announcingQuiz) return;
    if (!winnerNameInput.trim()) {
      alert('Please enter Winner Name');
      return;
    }

    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    const updatedQuizzes = quizzes.map(q => {
      if (q.id === announcingQuiz.id) {
        return {
          ...q,
          status: 'WINNER_ANNOUNCED' as const,
          winnerName: winnerNameInput.trim(),
          winnerDetails: winnerDetailsInput.trim() || undefined,
          winnerPrize: winnerPrizeInput.trim() || q.winnerPrize,
          winnerAnnouncedAt: new Date().toISOString()
        };
      }
      return q;
    });

    onUpdateDb({
      ...db,
      quizzes: updatedQuizzes,
      lastModified: Date.now()
    });

    setAnnouncingQuiz(null);
  };

  return (
    <div className="p-4 bg-gradient-to-r from-purple-500/15 via-indigo-500/20 to-purple-500/15 border-2 border-purple-400 rounded-2xl space-y-4 shadow-md">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-purple-200/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-700 text-white flex items-center justify-center text-xl shrink-0 shadow-xs">
            🎯
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-xs md:text-sm text-purple-950 uppercase tracking-wide">
                Live Audience Quiz & Stage Contest Manager
              </h3>
              <span className="px-2 py-0.5 bg-purple-600 text-white text-[10px] font-black rounded-full uppercase">
                {quizzes.length} Questions
              </span>
            </div>
            <p className="text-[11px] text-purple-900 mt-0.5 font-medium leading-tight">
              Create audience questions, launch them live on stage, reveal answers later, and announce winners with celebratory effects!
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>➕ Add New Question</span>
        </button>
      </div>

      {/* Quizzes List */}
      {quizzes.length === 0 ? (
        <div className="p-6 bg-white/80 border border-purple-200 rounded-xl text-center space-y-2">
          <p className="text-xs text-purple-900 font-bold">
            No quiz questions created yet. Tap "Add New Question" to prepare your stage quiz!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {quizzes.map((q) => {
            const isLive = q.status === 'ACTIVE';
            const isRevealed = q.status === 'ANSWER_REVEALED';
            const isWinnerAnnounced = q.status === 'WINNER_ANNOUNCED';

            return (
              <div 
                key={q.id}
                className={`p-4 bg-white border-2 rounded-2xl transition-all shadow-xs space-y-3 ${
                  isLive 
                    ? 'border-rose-500 ring-2 ring-rose-400/30' 
                    : isWinnerAnnounced
                    ? 'border-amber-400 bg-amber-50/50'
                    : 'border-purple-200'
                }`}
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 bg-purple-800 text-white rounded-lg font-mono font-black text-xs">
                      Q#{q.questionNumber}
                    </span>

                    {/* Status badges */}
                    {isLive && (
                      <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-full font-black text-[10px] uppercase flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        🔴 LIVE ON SCREEN
                      </span>
                    )}
                    {isRevealed && (
                      <span className="px-2.5 py-0.5 bg-emerald-700 text-white rounded-full font-black text-[10px] uppercase flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        ANSWER REVEALED
                      </span>
                    )}
                    {isWinnerAnnounced && (
                      <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 rounded-full font-black text-[10px] uppercase flex items-center gap-1 shadow-xs">
                        👑 WINNER ANNOUNCED
                      </span>
                    )}
                    {q.status === 'DRAFT' && (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full font-bold text-[10px]">
                        Draft / Ready
                      </span>
                    )}
                    {q.status === 'COMPLETED' && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-bold text-[10px]">
                        Completed
                      </span>
                    )}

                    {q.sponsorName && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold">
                        🎁 {q.sponsorName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(q)}
                      className="p-1.5 hover:bg-purple-100 text-purple-900 rounded-lg text-xs font-bold transition-colors"
                      title="Edit Question"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuiz(q.id)}
                      className="p-1.5 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors"
                      title="Delete Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question body */}
                <div className="space-y-1">
                  <p className="text-xs md:text-sm font-bold text-slate-900 leading-relaxed">
                    {q.questionText}
                  </p>

                  {q.options && q.options.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] font-medium text-slate-700">
                      {q.options.map((opt, i) => (
                        <div key={i} className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <b>{String.fromCharCode(65 + i)}:</b> {opt}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.correctAnswer && (
                    <div className="text-[11px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-lg mt-1 inline-flex items-center gap-1.5">
                      <span>💡 Correct Answer:</span>
                      <b className="text-emerald-950 font-black">{q.correctAnswer}</b>
                    </div>
                  )}

                  {q.winnerName && (
                    <div className="text-xs font-bold text-amber-950 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-xl mt-1 flex items-center justify-between gap-2">
                      <div>
                        <span>🏆 Winner: <b>{q.winnerName}</b></span>
                        {q.winnerDetails && <span className="text-[11px] text-amber-900 block font-normal">{q.winnerDetails}</span>}
                      </div>
                      {q.winnerPrize && <span className="text-[10px] bg-amber-200 px-2 py-0.5 rounded font-black">🎁 {q.winnerPrize}</span>}
                    </div>
                  )}
                </div>

                {/* Stage Action Controls */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">
                    Stage Trigger Actions:
                  </span>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* 1. Go Live button */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(q.id, 'ACTIVE')}
                      className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all flex items-center gap-1 shadow-2xs ${
                        isLive 
                          ? 'bg-rose-600 text-white ring-2 ring-rose-400' 
                          : 'bg-rose-100 text-rose-900 hover:bg-rose-200'
                      }`}
                    >
                      <span>🔴 Go Live (Show Question)</span>
                    </button>

                    {/* 2. Reveal Answer button */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(q.id, 'ANSWER_REVEALED')}
                      className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all flex items-center gap-1 shadow-2xs ${
                        isRevealed 
                          ? 'bg-emerald-700 text-white' 
                          : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>💡 Reveal Answer</span>
                    </button>

                    {/* 3. Announce Winner button */}
                    <button
                      type="button"
                      onClick={() => handleOpenWinnerModal(q)}
                      className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all flex items-center gap-1 shadow-2xs ${
                        isWinnerAnnounced 
                          ? 'bg-amber-500 text-slate-950 font-black' 
                          : 'bg-amber-100 text-amber-950 hover:bg-amber-200'
                      }`}
                    >
                      <span>👑 Announce Winner</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Question Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl border-2 border-purple-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <h4 className="font-extrabold text-sm text-purple-950 flex items-center gap-2">
                <span>🎯</span> {editingQuiz ? `Edit Question #${editingQuiz.questionNumber}` : 'Add New Quiz Question'}
              </h4>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Question Text (Malayalam or English) *
                </label>
                <textarea
                  rows={3}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="e.g. വിശുദ്ധ ഖുർആനിലെ ഏറ്റവും വലിയ സൂറത്ത് ഏതാണ്?"
                  className="w-full px-3 py-2 border border-purple-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Multiple Choice Options (Optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={optionA}
                    onChange={(e) => setOptionA(e.target.value)}
                    placeholder="Option A"
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                  <input
                    type="text"
                    value={optionB}
                    onChange={(e) => setOptionB(e.target.value)}
                    placeholder="Option B"
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                  <input
                    type="text"
                    value={optionC}
                    onChange={(e) => setOptionC(e.target.value)}
                    placeholder="Option C"
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                  <input
                    type="text"
                    value={optionD}
                    onChange={(e) => setOptionD(e.target.value)}
                    placeholder="Option D"
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  Official Correct Answer (Revealed when you trigger Reveal)
                </label>
                <input
                  type="text"
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  placeholder="e.g. സൂറത്തുൽ ബഖറ (Surah Al-Baqarah)"
                  className="w-full px-3 py-2 border border-emerald-300 rounded-xl text-xs bg-emerald-50/50 text-emerald-950 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Sponsor Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={sponsorName}
                    onChange={(e) => setSponsorName(e.target.value)}
                    placeholder="e.g. Al-Noor Supermarket"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Prize Details (Optional)
                  </label>
                  <input
                    type="text"
                    value={winnerPrize}
                    onChange={(e) => setWinnerPrize(e.target.value)}
                    placeholder="e.g. ₹500 Cash Prize / Gift Hamper"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-purple-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuestion}
                className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer"
              >
                💾 Save Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Winner Announcement Modal */}
      {announcingQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl border-2 border-amber-400">
            <div className="flex items-center justify-between border-b border-amber-200 pb-3">
              <h4 className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
                <span>👑</span> Announce Winner &bull; Question #{announcingQuiz.questionNumber}
              </h4>
              <button 
                onClick={() => setAnnouncingQuiz(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium">
                <b>Question:</b> {announcingQuiz.questionText}
                {announcingQuiz.correctAnswer && (
                  <div className="mt-1 text-emerald-800 font-bold">
                    💡 Answer: {announcingQuiz.correctAnswer}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Winner Name *
                </label>
                <input
                  type="text"
                  value={winnerNameInput}
                  onChange={(e) => setWinnerNameInput(e.target.value)}
                  placeholder="e.g. Muhammed Bilal"
                  className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Winner Details (Chest No / Team / Class / Phone)
                </label>
                <input
                  type="text"
                  value={winnerDetailsInput}
                  onChange={(e) => setWinnerDetailsInput(e.target.value)}
                  placeholder="e.g. Chest #204 &bull; Team KAAF &bull; Class 9"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Prize Description
                </label>
                <input
                  type="text"
                  value={winnerPrizeInput}
                  onChange={(e) => setWinnerPrizeInput(e.target.value)}
                  placeholder="e.g. Special Trophy & Cash Award"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-amber-200">
              <button
                type="button"
                onClick={() => setAnnouncingQuiz(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWinner}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5"
              >
                <span>🎉 Announce Winner Live</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
