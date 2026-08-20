import { useState } from 'react';
import { Database, Result, Program } from '../types';
import { AGES, AGE_ICONS, GENDER_ICONS } from '../db';
import { Search, Trophy, Sparkles, X, Users, Layers, ListFilter, Award, CheckCircle2, Columns } from 'lucide-react';
import { fireCelebrationConfetti, fireGoldWinnerBurst } from '../utils/confetti';

interface ResultsProps {
  db: Database;
}

export default function Results({ db }: ResultsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGender, setSelectedGender] = useState<'All' | 'Boys' | 'Girls' | 'General'>('All');
  const [selectedAge, setSelectedAge] = useState<'All' | 'Kids' | 'Sub Junior' | 'Junior' | 'Senior' | 'Super Senior' | 'General'>('All');
  const [selectedTeam, setSelectedTeam] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grouped' | 'split' | 'stream'>('grouped');

  if (db.settings?.showResults === false) {
    return (
      <div className="view active pb-20 max-w-2xl mx-auto space-y-6 pt-6 font-sans">
        <div className="p-8 bg-brand-panel border border-brand-gold-500/30 rounded-3xl text-center space-y-4 shadow-md">
          <div className="text-5xl animate-bounce">🔒</div>
          <h3 className="font-display font-extrabold text-brand-green-950 text-lg md:text-xl">
            Results Publication on Hold
          </h3>
          <p className="text-xs md:text-sm text-brand-ink-soft max-w-md mx-auto leading-relaxed">
            Competition results have been temporarily paused for grand final stage announcements. Stay tuned for the official live stage reveals!
          </p>
          <div className="pt-2">
            <span className="px-3.5 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-bold text-xs inline-flex items-center gap-1.5 shadow-2xs">
              <span>🤫</span> Climax Suspense Mode Active
            </span>
          </div>
        </div>
      </div>
    );
  }

  const getCandidateDetails = (name: string, teamId: string | null) => {
    const p = db.participants.find(x => x.name === name && (!teamId || x.teamId === teamId));
    return {
      chestNo: p?.number || '',
      cls: p?.cls ? `${p.cls}${p.division ? ' ' + p.division : ''}` : ''
    };
  };

  // Filter individual results
  const filteredResults = [...db.results]
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
    .filter(r => {
      // Gender filter
      if (selectedGender !== 'All' && r.gender !== selectedGender) return false;

      // Age filter
      if (selectedAge !== 'All') {
        if (selectedAge === 'General') {
          if ((r.age as string) !== 'General' && (r.age as string) !== 'All') return false;
        } else if (r.age !== selectedAge) {
          return false;
        }
      }

      // Selected Team filter
      if (selectedTeam !== 'All') {
        const checkTeamEntries = (arr: any[]) =>
          arr.some(e => e.teamId === selectedTeam);
        const matchesWinnersTeam =
          checkTeamEntries(r.winners.first) ||
          checkTeamEntries(r.winners.second) ||
          checkTeamEntries(r.winners.third);
        const matchesGradesTeam =
          checkTeamEntries(r.grades.gradeA) ||
          checkTeamEntries(r.grades.gradeB) ||
          checkTeamEntries(r.grades.gradeC) ||
          checkTeamEntries(r.grades.participation);
        if (!matchesWinnersTeam && !matchesGradesTeam) return false;
      }

      // Search term match
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const prog = db.programs.find(p => p.id === r.programId);
        
        const matchesProgram = prog && (
          prog.name.toLowerCase().includes(term) || 
          prog.code.toLowerCase().includes(term)
        );

        const checkEntries = (arr: any[]) => 
          arr.some(e => {
            if (!e) return false;
            if (e.name && e.name.toLowerCase().includes(term)) return true;
            if (e.teamId) {
              if (e.teamId.toLowerCase().includes(term)) return true;
              const team = db.teams.find(t => t.id === e.teamId);
              if (team && (team.name.toLowerCase().includes(term) || team.symbol.toLowerCase().includes(term))) return true;
            }
            const part = db.participants.find(p => p.name === e.name && (!e.teamId || p.teamId === e.teamId));
            if (part) {
              if (part.number && String(part.number).toLowerCase().includes(term)) return true;
              if (part.cls && String(part.cls).toLowerCase().includes(term)) return true;
            }
            return false;
          });

        const matchesWinners = 
          checkEntries(r.winners.first) || 
          checkEntries(r.winners.second) || 
          checkEntries(r.winners.third);

        const matchesGrades = 
          checkEntries(r.grades.gradeA) || 
          checkEntries(r.grades.gradeB) || 
          checkEntries(r.grades.gradeC) || 
          checkEntries(r.grades.participation);

        if (!matchesProgram && !matchesWinners && !matchesGrades) return false;
      }

      return true;
    });

  // Group results by Program
  interface ProgramResultGroup {
    program: Program;
    results: Result[];
  }

  const groupedProgramResults: ProgramResultGroup[] = [];
  const programMap = new Map<string, Result[]>();

  filteredResults.forEach(r => {
    const list = programMap.get(r.programId) || [];
    list.push(r);
    programMap.set(r.programId, list);
  });

  programMap.forEach((resList, progId) => {
    const prog = db.programs.find(p => p.id === progId);
    if (prog) {
      // Sort within program strictly in requested hierarchy:
      // Junior (Boys, Girls) -> Senior (Boys, Girls) -> Super Senior (Boys, Girls) -> Kids (Boys, Girls) -> Sub Junior (Boys, Girls) -> General
      const ageRank: Record<string, number> = { 'Junior': 1, 'Senior': 2, 'Super Senior': 3, 'Kids': 4, 'Sub Junior': 5, 'General': 6, 'All': 7 };
      const sorted = [...resList].sort((a, b) => {
        const rankA = ageRank[a.age] || 99;
        const rankB = ageRank[b.age] || 99;
        if (rankA !== rankB) return rankA - rankB;
        if (a.gender === 'Boys' && b.gender !== 'Boys') return -1;
        if (a.gender === 'Girls' && b.gender !== 'Girls') return 1;
        return 0;
      });
      groupedProgramResults.push({ program: prog, results: sorted });
    }
  });

  // Sort program groups by latest result datetime
  groupedProgramResults.sort((a, b) => {
    const latestA = Math.max(...a.results.map(r => new Date(r.datetime).getTime()));
    const latestB = Math.max(...b.results.map(r => new Date(r.datetime).getTime()));
    return latestB - latestA;
  });

  // Helper to render a single result card
  const renderSingleResultCard = (r: Result) => {
    const prog = db.programs.find(p => p.id === r.programId);
    const isBoys = r.gender === 'Boys';
    const isGirls = r.gender === 'Girls';
    const isGeneralOrGroup = Boolean(prog?.group || prog?.categories?.some(c => (c.gender as string) === 'General' || (c.age as string) === 'All' || (c.age as string) === 'General') || (r.gender as string) === 'General' || (r.age as string) === 'General' || (r.age as string) === 'All');

    const tagClass = isBoys 
      ? 'bg-sky-100 text-sky-950 border border-sky-300' 
      : isGirls 
        ? 'bg-fuchsia-100 text-fuchsia-950 border border-fuchsia-300' 
        : 'bg-emerald-100 text-emerald-950 border border-emerald-300';

    return (
      <div key={r.id} className="bg-brand-panel border border-brand-line rounded-2xl p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[9px] font-extrabold bg-brand-green-100 text-brand-green-900 px-2 py-0.5 rounded border border-brand-green-200">
                {prog?.code || '—'}
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${tagClass}`}>
                {isBoys ? '👦 Boys' : isGirls ? '👧 Girls' : '🌐 General'}
              </span>
              {r.age !== 'All' && (
                <span className="text-[9px] font-bold bg-brand-gold-100 text-brand-gold-900 px-2 py-0.5 rounded-full border border-brand-gold-300">
                  {AGE_ICONS[r.age] || '🏷️'} {r.age}
                </span>
              )}
              {isGeneralOrGroup && (
                <span className="text-[9px] font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                  <Users className="w-3 h-3 text-amber-700" /> Group Event
                </span>
              )}
            </div>

            <h4 className="font-bold text-xs md:text-sm text-brand-ink mt-1.5 leading-snug">
              {prog?.name || 'Untitled Program'}
            </h4>
          </div>

          {r.winners?.first?.[0] && (
            <button
              onClick={() => fireGoldWinnerBurst()}
              className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-[9px] font-extrabold flex items-center gap-1 cursor-pointer transition-all shrink-0 active:scale-95"
              title="Trigger celebration"
            >
              <span>🎉</span> Celebrate
            </button>
          )}
        </div>

        {/* Score listing */}
        <div className="space-y-1.5 bg-brand-bg/60 p-3 rounded-xl border border-brand-line/60">
          {['first', 'second', 'third'].map(pos => {
            const key = pos as 'first' | 'second' | 'third';
            const medal = key === 'first' ? '🥇' : key === 'second' ? '🥈' : '🥉';
            const labelText = key === 'first' ? '1st Place' : key === 'second' ? '2nd Place' : '3rd Place';
            const entries = r.winners[key] || [];

            let winPts = db.settings.points[key];
            if (isGeneralOrGroup) {
              if (key === 'first') winPts = db.settings.points.generalFirst ?? db.settings.points.first;
              else if (key === 'second') winPts = db.settings.points.generalSecond ?? db.settings.points.second;
              else if (key === 'third') winPts = db.settings.points.generalThird ?? db.settings.points.third;
            }

            return entries.map((winner, winIndex) => {
              const team = db.teams.find(t => t.id === winner.teamId);
              const details = getCandidateDetails(winner.name, winner.teamId);

              return (
                <div key={key + winIndex} className="flex items-center justify-between text-xs py-1 border-b border-brand-line/30 last:border-0">
                  <span className="shrink-0 w-6 text-center text-sm">{medal}</span>
                  <div className="flex-1 min-w-0 ml-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {details.chestNo && (
                        <span className="font-mono text-[9px] font-extrabold bg-slate-900 text-amber-300 px-1.5 py-0.2 rounded shrink-0">
                          #{details.chestNo}
                        </span>
                      )}
                      <b className="text-brand-ink truncate block font-bold text-xs">
                        {winner.name}
                      </b>
                      {details.cls && (
                        <span className="text-[10px] text-brand-ink-soft font-medium">
                          (Class {details.cls})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-brand-ink-soft flex items-center gap-1 font-medium mt-0.5">
                      <span style={{ color: team?.color || '#000' }}>{team?.symbol || '🛡️'}</span>
                      <span>{team ? team.name : 'Independent'}</span>
                      <span>&bull;</span>
                      <span className="text-brand-gold-800 font-semibold">{labelText}</span>
                    </span>
                    {winner.description && (
                      <div className="text-[10px] text-slate-700 font-medium bg-slate-100/90 px-2 py-0.5 rounded-md mt-1 border border-slate-200 inline-flex items-center gap-1">
                        <span>👥</span> <span>{winner.description}</span>
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-xs font-black bg-brand-green-100 text-brand-green-950 px-2 py-0.5 rounded-lg border border-brand-green-300 shrink-0 ml-2">
                    {db.settings?.hideTeamPoints ? (
                      <span className="flex items-center gap-1 text-[11px]" title="Points hidden until final announcement">
                        <span>🔒</span> <span className="text-[10px]">Hidden</span>
                      </span>
                    ) : (
                      `+${winPts} PTS`
                    )}
                  </span>
                </div>
              );
            });
          })}

          {/* Grades listing */}
          {r.grades && Object.entries(r.grades).map(([gradeKey, list]) => {
            const key = gradeKey as keyof typeof r.grades;
            const icon = key === 'gradeA' ? '🅰️' : key === 'gradeB' ? '🅱️' : key === 'gradeC' ? '🅲' : '🎗️';
            const label = key === 'gradeA' ? 'Grade A' : key === 'gradeB' ? 'Grade B' : key === 'gradeC' ? 'Grade C' : 'Participation';
            
            return list.map((entry, idx) => {
              const team = db.teams.find(t => t.id === entry.teamId);
              const details = getCandidateDetails(entry.name, entry.teamId);

              return (
                <div key={key + idx} className="flex items-center justify-between text-xs py-1 border-b border-brand-line/30 last:border-0">
                  <span className="shrink-0 w-6 text-center text-sm">{icon}</span>
                  <div className="flex-1 min-w-0 ml-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {details.chestNo && (
                        <span className="font-mono text-[9px] font-extrabold bg-slate-900 text-amber-300 px-1.5 py-0.2 rounded shrink-0">
                          #{details.chestNo}
                        </span>
                      )}
                      <b className="text-brand-ink truncate block font-bold text-xs">
                        {entry.name}
                      </b>
                      {details.cls && (
                        <span className="text-[10px] text-brand-ink-soft font-medium">
                          (Class {details.cls})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-brand-ink-soft flex items-center gap-1 font-medium mt-0.5">
                      <span style={{ color: team?.color || '#000' }}>{team?.symbol || '🛡️'}</span>
                      <span>{team ? team.name : 'Independent'}</span>
                      <span>&bull;</span>
                      <span className="text-brand-green-800 font-bold">{label}</span>
                    </span>
                    {entry.description && (
                      <div className="text-[10px] text-slate-700 font-medium bg-slate-100/90 px-2 py-0.5 rounded-md mt-1 border border-slate-200 inline-flex items-center gap-1">
                        <span>👥</span> <span>{entry.description}</span>
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-xs font-black bg-amber-100 text-amber-950 px-2 py-0.5 rounded-lg border border-amber-300 shrink-0 ml-2">
                    {db.settings?.hideTeamPoints ? (
                      <span className="flex items-center gap-1 text-[11px]" title="Points hidden until final announcement">
                        <span>🔒</span> <span className="text-[10px]">Hidden</span>
                      </span>
                    ) : (
                      `+${db.settings.points[key]} PTS`
                    )}
                  </span>
                </div>
              );
            });
          })}
        </div>

        <div className="flex items-center justify-between border-t border-brand-line/40 pt-2 text-[10px] text-brand-ink-soft">
          <span className="font-semibold text-brand-green-900">
            🏆 Status: Published Live
          </span>
          <span>
            {new Date(r.datetime).toLocaleDateString()} &bull; {new Date(r.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  };

  const boysResults = filteredResults.filter(r => r.gender === 'Boys');
  const girlsResults = filteredResults.filter(r => r.gender === 'Girls');
  const generalResults = filteredResults.filter(r => (r.gender as string) === 'General' || (r.age as string) === 'General' || (r.age as string) === 'All');

  // Count results per section across all published results
  const countBoys = db.results.filter(r => r.gender === 'Boys').length;
  const countGirls = db.results.filter(r => r.gender === 'Girls').length;
  const countGeneral = db.results.filter(r => (r.gender as string) === 'General' || (r.age as string) === 'General' || (r.age as string) === 'All').length;

  return (
    <div className={`view active pb-20 mx-auto space-y-4 transition-all ${viewMode === 'split' ? 'max-w-6xl' : 'max-w-3xl'}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand-gold-500 animate-pulse shadow-sm" />
          <div>
            <h2 className="font-display font-black text-brand-green-950 text-base md:text-lg">
              Official Results & Standings
            </h2>
            <p className="text-[11px] text-brand-ink-soft">
              Official Competition Results &middot; Boys & Girls Segregated Standings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-brand-panel border border-brand-line rounded-xl p-0.5 text-xs font-bold shadow-2xs">
            <button
              onClick={() => setViewMode('grouped')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-brand-green-800 text-brand-gold-300 shadow-xs'
                  : 'text-brand-ink-soft hover:text-brand-ink'
              }`}
              title="Group results under each Program"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Program View</span>
            </button>
            <button
              onClick={() => {
                setViewMode('split');
                setSelectedGender('All');
              }}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-brand-green-800 text-brand-gold-300 shadow-xs'
                  : 'text-brand-ink-soft hover:text-brand-ink'
              }`}
              title="Show Boys and Girls results side-by-side on screen"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Boys | Girls Split</span>
            </button>
            <button
              onClick={() => setViewMode('stream')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === 'stream'
                  ? 'bg-brand-green-800 text-brand-gold-300 shadow-xs'
                  : 'text-brand-ink-soft hover:text-brand-ink'
              }`}
              title="Stream of individual cards"
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Stream View</span>
            </button>
          </div>

          <span className="text-[10px] font-mono font-bold bg-brand-green-100 text-brand-green-900 px-2.5 py-1 rounded-xl border border-brand-green-200 shadow-2xs">
            {db.results.length} Published
          </span>
        </div>
      </div>

      {/* Primary Section Switcher Tabs (Boys / Girls / General / All) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={() => {
            setSelectedGender('All');
            setSelectedAge('All');
          }}
          className={`p-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border shadow-xs ${
            selectedGender === 'All'
              ? 'bg-brand-green-800 text-white border-brand-green-900 ring-2 ring-brand-gold-400'
              : 'bg-brand-panel text-brand-ink hover:bg-brand-bg border-brand-line'
          }`}
        >
          <span className="text-base">✨</span>
          <span className="leading-tight text-center">All Sections</span>
          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${selectedGender === 'All' ? 'bg-brand-gold-400 text-brand-green-950' : 'bg-brand-bg text-brand-ink-soft'}`}>
            {db.results.length} Total
          </span>
        </button>

        <button
          onClick={() => {
            setSelectedGender('Boys');
            if (selectedAge === 'General') setSelectedAge('All');
          }}
          className={`p-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border shadow-xs ${
            selectedGender === 'Boys'
              ? 'bg-sky-700 text-white border-sky-800 ring-2 ring-sky-300'
              : 'bg-sky-50/70 text-sky-900 hover:bg-sky-100 border-sky-200'
          }`}
        >
          <span className="text-base">👦</span>
          <span className="leading-tight text-center">Boys Section</span>
          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${selectedGender === 'Boys' ? 'bg-white text-sky-900' : 'bg-sky-200 text-sky-950'}`}>
            {countBoys} Results
          </span>
        </button>

        <button
          onClick={() => {
            setSelectedGender('Girls');
            if (selectedAge === 'General') setSelectedAge('All');
          }}
          className={`p-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border shadow-xs ${
            selectedGender === 'Girls'
              ? 'bg-fuchsia-700 text-white border-fuchsia-800 ring-2 ring-fuchsia-300'
              : 'bg-fuchsia-50/70 text-fuchsia-900 hover:bg-fuchsia-100 border-fuchsia-200'
          }`}
        >
          <span className="text-base">👧</span>
          <span className="leading-tight text-center">Girls Section</span>
          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${selectedGender === 'Girls' ? 'bg-white text-fuchsia-900' : 'bg-fuchsia-200 text-fuchsia-950'}`}>
            {countGirls} Results
          </span>
        </button>

        <button
          onClick={() => {
            setSelectedGender('General');
            setSelectedAge('All');
          }}
          className={`p-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border shadow-xs ${
            selectedGender === 'General'
              ? 'bg-emerald-800 text-white border-emerald-900 ring-2 ring-emerald-300'
              : 'bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100 border-emerald-200'
          }`}
        >
          <span className="text-base">👥</span>
          <span className="leading-tight text-center">General &amp; Group</span>
          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${selectedGender === 'General' ? 'bg-white text-emerald-950' : 'bg-emerald-200 text-emerald-950'}`}>
            {countGeneral} Results
          </span>
        </button>
      </div>

      {/* Searchbar */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="🔍 Search program name, chest number (#101), candidate name, or team..."
          className="w-full pl-11 pr-10 py-3 bg-brand-panel border border-brand-line rounded-2xl text-xs md:text-sm text-brand-ink placeholder:text-brand-ink-soft/60 focus:outline-none focus:border-brand-gold-500 transition-colors shadow-xs"
        />
        <Search className="absolute left-4 top-3.5 w-4.5 h-4.5 text-brand-ink-soft/50" />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3.5 top-3.5 text-brand-ink-soft/60 hover:text-brand-ink p-0.5 rounded-full"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <label className="text-[10px] font-bold text-brand-gold-800 tracking-wider uppercase flex items-center gap-1">
            <span>🏷️</span> Filter by Age Category
          </label>
          {selectedAge !== 'All' && (
            <button
              onClick={() => setSelectedAge('All')}
              className="text-[10px] text-amber-800 font-bold hover:underline cursor-pointer"
            >
              Reset Category
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 select-none scrollbar-none">
          {['All', ...AGES, 'General'].map(a => {
            const isSel = selectedAge === a;
            const countForAge = db.results.filter(r => {
              if (selectedGender !== 'All' && r.gender !== selectedGender) return false;
              if (a === 'All') return true;
              if (a === 'General') return (r.age as string) === 'General' || (r.age as string) === 'All' || (r.gender as string) === 'General';
              return r.age === a;
            }).length;

            return (
              <button
                key={a}
                onClick={() => setSelectedAge(a as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border cursor-pointer transition-all flex items-center gap-1 shrink-0 ${
                  isSel
                    ? 'bg-brand-green-800 text-white border-brand-green-900 shadow-xs'
                    : 'bg-brand-panel text-brand-ink-soft border-brand-line hover:border-brand-gold-400/50'
                }`}
              >
                <span>{AGE_ICONS[a] || '🏷️'}</span>
                <span>{a === 'All' ? 'All Groups' : a}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-md ${isSel ? 'bg-brand-gold-400 text-brand-green-950 font-black' : 'bg-brand-bg text-brand-ink-soft'}`}>
                  {countForAge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Chips - Teams */}
      {db.teams && db.teams.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-brand-gold-800 tracking-wider uppercase px-1">
            Filter By Team
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 select-none scrollbar-none">
            <button
              onClick={() => setSelectedTeam('All')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border cursor-pointer transition-all ${
                selectedTeam === 'All'
                  ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-xs'
                  : 'bg-brand-panel text-brand-ink-soft border-brand-line hover:border-brand-gold-400/50'
              }`}
            >
              All Teams
            </button>
            {db.teams.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTeam(t.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border cursor-pointer transition-all flex items-center gap-1.5 ${
                  selectedTeam === t.id
                    ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-xs'
                    : 'bg-brand-panel text-brand-ink-soft border-brand-line hover:border-brand-gold-400/50'
                }`}
              >
                <span>{t.symbol || '🛡️'}</span>
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results Content */}
      {filteredResults.length === 0 ? (
        <div className="p-12 bg-brand-panel border border-brand-line rounded-2xl text-center space-y-2 shadow-xs select-none">
          <div className="text-3xl">🔍</div>
          <b className="block text-xs md:text-sm text-brand-ink font-bold">No results found</b>
          <p className="text-[11px] text-brand-ink-soft max-w-xs mx-auto">
            {selectedGender !== 'All' 
              ? `No published results found for ${selectedGender} section yet.`
              : 'Try adjusting your category filters or search query to find the result you are looking for.'}
          </p>
        </div>
      ) : viewMode === 'grouped' ? (
        /* ================= GROUPED BY PROGRAM VIEW ================= */
        <div className="space-y-4">
          {/* Spotlight banner */}
          <div className="bg-gradient-to-br from-brand-gold-100 via-amber-50 to-brand-gold-100/60 border border-brand-gold-300 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl p-1 bg-white rounded-xl border border-brand-gold-300 shadow-2xs">🏆</span>
              <div>
                <b className="text-xs font-extrabold text-brand-green-950 block">
                  {selectedGender === 'Boys' ? '👦 Boys Section' : selectedGender === 'Girls' ? '👧 Girls Section' : selectedGender === 'General' ? '👥 General / Group Items' : '✨ All Sections'}{' '}
                  {selectedAge !== 'All' ? `• ${selectedAge} Group` : ''} Results
                </b>
                <span className="text-[10px] text-brand-gold-900 font-medium">
                  Showing <b>{groupedProgramResults.length}</b> competition programs ({filteredResults.length} segregated result cards)
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                fireGoldWinnerBurst();
                setTimeout(() => fireCelebrationConfetti(), 250);
              }}
              className="px-3 py-1.5 bg-brand-green-950 hover:bg-brand-green-900 text-brand-gold-300 text-[10px] font-bold rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer shrink-0 active:scale-95"
            >
              <span>🎉</span> Celebrate
            </button>
          </div>

          {groupedProgramResults.map(({ program, results }) => {
            const isGeneralOrGroup = Boolean(program.group || program.categories.some(c => (c.gender as string) === 'General' || (c.age as string) === 'All' || (c.age as string) === 'General'));

            // Group results of this program by Age category
            const ageOrder = ['Kids', 'Sub Junior', 'Junior', 'Senior', 'Super Senior', 'General', 'All'];
            const distinctAges = Array.from(new Set(results.map(r => r.age || 'General'))).sort((a, b) => {
              const idxA = ageOrder.indexOf(a);
              const idxB = ageOrder.indexOf(b);
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return a.localeCompare(b);
            });

            return (
              <div key={program.id} className="bg-brand-panel border-2 border-brand-line/80 rounded-3xl p-4 md:p-6 shadow-sm space-y-4 hover:shadow-md transition-shadow">
                {/* Program Header */}
                <div className="flex items-start justify-between gap-3 border-b-2 border-brand-line/70 pb-3.5">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black bg-brand-green-900 text-brand-gold-300 px-3 py-1 rounded-xl shadow-xs border border-brand-gold-500/30">
                        {program.code || 'PRG'}
                      </span>
                      {isGeneralOrGroup ? (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 flex items-center gap-1">
                          <Users className="w-3 h-3 text-emerald-700" /> General / Group Event
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300">
                          🎯 {results.length} Published Result {results.length === 1 ? 'Section' : 'Sections'}
                        </span>
                      )}
                    </div>

                    <h3 className="font-display font-black text-base md:text-lg text-brand-green-950 tracking-tight leading-snug">
                      {program.code ? `${program.code} — ${program.name}` : program.name}
                    </h3>
                  </div>

                  <button
                    onClick={() => {
                      fireGoldWinnerBurst();
                      setTimeout(() => fireCelebrationConfetti(), 200);
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shrink-0 shadow-xs active:scale-95"
                    title="Celebrate program winners!"
                  >
                    <span>🎉</span> Celebrate
                  </button>
                </div>

                {/* Age Categories Breakdown */}
                <div className="space-y-4">
                  {distinctAges.map(ageCat => {
                    const ageResults = results.filter(r => (r.age || 'General') === ageCat);
                    const boysRes = ageResults.find(r => r.gender === 'Boys');
                    const girlsRes = ageResults.find(r => r.gender === 'Girls');
                    const genRes = ageResults.find(r => (r.gender as string) === 'General' || (!r.gender && ((r.age as string) === 'General' || (r.age as string) === 'All')));
                    const otherRes = ageResults.filter(r => r !== boysRes && r !== girlsRes && r !== genRes);

                    const hasDual = Boolean(boysRes && girlsRes);

                    const renderWinnerBlock = (r: Result, genderTitle: string, theme: 'boys' | 'girls' | 'gen') => {
                      const isBoys = theme === 'boys';
                      const isGirls = theme === 'girls';
                      const isGen = theme === 'gen' || (r.gender as string) === 'General' || (r.age as string) === 'General' || (r.age as string) === 'All';

                      const containerBg = isBoys
                        ? 'bg-sky-50/80 border-sky-300/90'
                        : isGirls
                        ? 'bg-pink-50/80 border-pink-300/90'
                        : 'bg-emerald-50/80 border-emerald-300/90';

                      const badgeBg = isBoys
                        ? 'bg-sky-700 text-white'
                        : isGirls
                        ? 'bg-pink-700 text-white'
                        : 'bg-emerald-800 text-white';

                      return (
                        <div key={r.id} className={`p-3.5 md:p-4 rounded-2xl border-2 ${containerBg} space-y-3 shadow-xs`}>
                          {/* Sub-header for Gender Section */}
                          <div className="flex items-center justify-between border-b border-black/5 pb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-2xs ${badgeBg}`}>
                                {isBoys ? '👦 BOYS' : isGirls ? '👧 GIRLS' : '🌐 GENERAL'} {ageCat !== 'All' && ageCat !== 'General' ? ageCat.toUpperCase() : ''}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-brand-ink-soft bg-white/80 px-2 py-0.5 rounded-md border border-black/5">
                              {new Date(r.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Winners list */}
                          <div className="space-y-2 bg-white/95 p-3 rounded-xl border border-black/5 shadow-2xs">
                            {['first', 'second', 'third'].map(pos => {
                              const key = pos as 'first' | 'second' | 'third';
                              const medal = key === 'first' ? '🥇' : key === 'second' ? '🥈' : '🥉';
                              const labelText = key === 'first' ? '1st Place' : key === 'second' ? '2nd Place' : '3rd Place';
                              const entries = r.winners[key] || [];

                              let winPts = db.settings.points[key];
                              if (isGeneralOrGroup || isGen) {
                                if (key === 'first') winPts = db.settings.points.generalFirst ?? db.settings.points.first;
                                else if (key === 'second') winPts = db.settings.points.generalSecond ?? db.settings.points.second;
                                else if (key === 'third') winPts = db.settings.points.generalThird ?? db.settings.points.third;
                              }

                              if (entries.length === 0) return null;

                              return entries.map((winner, winIndex) => {
                                const team = db.teams.find(t => t.id === winner.teamId);
                                const details = getCandidateDetails(winner.name, winner.teamId);

                                return (
                                  <div key={key + winIndex} className="flex items-center justify-between text-xs py-1.5 border-b border-brand-line/40 last:border-0">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="text-base shrink-0">{medal}</span>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {details.chestNo && (
                                            <span className="font-mono text-[9px] font-extrabold bg-slate-900 text-amber-300 px-1.5 py-0.2 rounded shrink-0">
                                              #{details.chestNo}
                                            </span>
                                          )}
                                          <b className="text-brand-ink truncate font-bold text-xs">
                                            {winner.name}
                                          </b>
                                          {details.cls && (
                                            <span className="text-[10px] text-brand-ink-soft font-medium">
                                              (Class {details.cls})
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-brand-ink-soft flex items-center gap-1.5 font-medium mt-0.5">
                                          <span style={{ color: team?.color || '#000' }}>{team?.symbol || '🛡️'}</span>
                                          <span className="font-bold">{team ? team.name : 'Independent'}</span>
                                          <span>&bull;</span>
                                          <span className="text-brand-gold-800 font-bold">{labelText}</span>
                                        </div>
                                        {winner.description && (
                                          <div className="text-[10px] text-slate-700 font-medium bg-slate-100/90 px-2 py-0.5 rounded-md mt-1 border border-slate-200 inline-flex items-center gap-1">
                                            <span>👥</span> <span>{winner.description}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <span className="font-mono text-xs font-black bg-brand-green-100 text-brand-green-950 px-2 py-0.5 rounded-lg border border-brand-green-300 shrink-0 ml-2 shadow-2xs">
                                      {db.settings?.hideTeamPoints ? (
                                        <span className="flex items-center gap-1 text-[11px]" title="Points hidden until final announcement">
                                          <span>🔒</span> <span className="text-[10px]">Hidden</span>
                                        </span>
                                      ) : (
                                        `+${winPts} PTS ${isGeneralOrGroup || isGen ? '(Team)' : ''}`
                                      )}
                                    </span>
                                  </div>
                                );
                              });
                            })}

                            {/* Grades */}
                            {r.grades && Object.entries(r.grades).map(([gradeKey, list]) => {
                              const key = gradeKey as keyof typeof r.grades;
                              const icon = key === 'gradeA' ? '🅰️' : key === 'gradeB' ? '🅱️' : key === 'gradeC' ? '🅲' : '🎗️';
                              const label = key === 'gradeA' ? 'Grade A' : key === 'gradeB' ? 'Grade B' : key === 'gradeC' ? 'Grade C' : 'Participation';
                              
                              return list.map((entry, idx) => {
                                const team = db.teams.find(t => t.id === entry.teamId);
                                const details = getCandidateDetails(entry.name, entry.teamId);

                                return (
                                  <div key={key + idx} className="flex items-center justify-between text-xs py-1.5 border-b border-brand-line/40 last:border-0">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="text-sm shrink-0">{icon}</span>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {details.chestNo && (
                                            <span className="font-mono text-[9px] font-extrabold bg-slate-900 text-amber-300 px-1.5 py-0.2 rounded shrink-0">
                                              #{details.chestNo}
                                            </span>
                                          )}
                                          <b className="text-brand-ink truncate font-bold text-xs">
                                            {entry.name}
                                          </b>
                                          {details.cls && (
                                            <span className="text-[10px] text-brand-ink-soft font-medium">
                                              (Class {details.cls})
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-brand-ink-soft flex items-center gap-1.5 font-medium mt-0.5">
                                          <span style={{ color: team?.color || '#000' }}>{team?.symbol || '🛡️'}</span>
                                          <span className="font-bold">{team ? team.name : 'Independent'}</span>
                                          <span>&bull;</span>
                                          <span className="text-brand-green-800 font-bold">{label}</span>
                                        </div>
                                        {entry.description && (
                                          <div className="text-[10px] text-slate-700 font-medium bg-slate-100/90 px-2 py-0.5 rounded-md mt-1 border border-slate-200 inline-flex items-center gap-1">
                                            <span>👥</span> <span>{entry.description}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <span className="font-mono text-xs font-black bg-amber-100 text-amber-950 px-2 py-0.5 rounded-lg border border-amber-300 shrink-0 ml-2 shadow-2xs">
                                      {db.settings?.hideTeamPoints ? (
                                        <span className="flex items-center gap-1 text-[11px]" title="Points hidden until final announcement">
                                          <span>🔒</span> <span className="text-[10px]">Hidden</span>
                                        </span>
                                      ) : (
                                        `+${db.settings.points[key]} PTS`
                                      )}
                                    </span>
                                  </div>
                                );
                              });
                            })}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div key={ageCat} className="bg-brand-bg/60 border border-brand-line rounded-2xl p-3 md:p-4 space-y-3">
                        {/* Category Header Label */}
                        <div className="flex items-center justify-between border-b border-brand-line/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{AGE_ICONS[ageCat] || '🏷️'}</span>
                            <h4 className="text-xs md:text-sm font-black text-brand-green-950 uppercase tracking-wide">
                              {ageCat} Category Winners
                            </h4>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-white text-brand-green-950 rounded-md border border-brand-line shadow-2xs">
                            {hasDual ? '👦 Boys & 👧 Girls' : boysRes ? '👦 Boys' : girlsRes ? '👧 Girls' : '👥 General'}
                          </span>
                        </div>

                        {/* Dual or Single Column Grid */}
                        <div className={`grid gap-3 ${hasDual ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                          {boysRes && renderWinnerBlock(boysRes, 'Boys', 'boys')}
                          {girlsRes && renderWinnerBlock(girlsRes, 'Girls', 'girls')}
                          {genRes && renderWinnerBlock(genRes, 'General', 'gen')}
                          {otherRes.map(or => renderWinnerBlock(or, or.gender || 'General', or.gender === 'Boys' ? 'boys' : or.gender === 'Girls' ? 'girls' : 'gen'))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'split' ? (
        /* ================= SIDE-BY-SIDE SPLIT VIEW (BOYS & GIRLS) ================= */
        <div className="space-y-6">
          {/* Dual Columns Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Left Column: Boys */}
            <div className="bg-sky-50/50 border-2 border-sky-300 rounded-3xl p-4 md:p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-sky-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl p-2 bg-sky-100 rounded-2xl border border-sky-300 shadow-2xs">👦</span>
                  <div>
                    <h3 className="font-display font-black text-sky-950 text-sm md:text-base">
                      Boys Section Results
                    </h3>
                    <p className="text-[10px] text-sky-800 font-medium">
                      Boys category competition standings
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black bg-sky-600 text-white px-2.5 py-1 rounded-full shadow-2xs">
                  {boysResults.length} Results
                </span>
              </div>

              {boysResults.length === 0 ? (
                <div className="p-8 text-center bg-white/70 rounded-2xl border border-sky-200/60 text-xs text-sky-800 font-medium">
                  No published results for Boys section matching your current filters.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {boysResults.map(r => renderSingleResultCard(r))}
                </div>
              )}
            </div>

            {/* Right Column: Girls */}
            <div className="bg-fuchsia-50/50 border-2 border-fuchsia-300 rounded-3xl p-4 md:p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-fuchsia-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl p-2 bg-fuchsia-100 rounded-2xl border border-fuchsia-300 shadow-2xs">👧</span>
                  <div>
                    <h3 className="font-display font-black text-fuchsia-950 text-sm md:text-base">
                      Girls Section Results
                    </h3>
                    <p className="text-[10px] text-fuchsia-800 font-medium">
                      Girls category competition standings
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black bg-fuchsia-600 text-white px-2.5 py-1 rounded-full shadow-2xs">
                  {girlsResults.length} Results
                </span>
              </div>

              {girlsResults.length === 0 ? (
                <div className="p-8 text-center bg-white/70 rounded-2xl border border-fuchsia-200/60 text-xs text-fuchsia-800 font-medium">
                  No published results for Girls section matching your current filters.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {girlsResults.map(r => renderSingleResultCard(r))}
                </div>
              )}
            </div>
          </div>

          {/* General / Group Events if any */}
          {generalResults.length > 0 && (
            <div className="bg-emerald-50/50 border-2 border-emerald-300 rounded-3xl p-4 md:p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl p-2 bg-emerald-100 rounded-2xl border border-emerald-300 shadow-2xs">👥</span>
                  <div>
                    <h3 className="font-display font-black text-emerald-950 text-sm md:text-base">
                      General &amp; Group Events
                    </h3>
                    <p className="text-[10px] text-emerald-800 font-medium">
                      General and team group competition standings
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black bg-emerald-700 text-white px-2.5 py-1 rounded-full shadow-2xs">
                  {generalResults.length} Results
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {generalResults.map(r => renderSingleResultCard(r))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================= CHRONOLOGICAL STREAM VIEW ================= */
        <div className="space-y-3.5">
          {filteredResults.map(r => renderSingleResultCard(r))}
        </div>
      )}
    </div>
  );
}
