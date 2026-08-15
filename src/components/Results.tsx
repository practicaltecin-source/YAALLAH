import { useState } from 'react';
import { Database } from '../types';
import { AGES, AGE_ICONS, GENDER_ICONS } from '../db';
import { Search, Trophy, Sparkles, X, Users, UserCheck } from 'lucide-react';
import { fireCelebrationConfetti, fireGoldWinnerBurst } from '../utils/confetti';

interface ResultsProps {
  db: Database;
}

export default function Results({ db }: ResultsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGender, setSelectedGender] = useState<'All' | 'Boys' | 'Girls' | 'General'>('All');
  const [selectedAge, setSelectedAge] = useState<'All' | 'Kids' | 'Sub Junior' | 'Junior' | 'Senior' | 'Super Senior' | 'General'>('All');
  const [selectedTeam, setSelectedTeam] = useState<string>('All');

  const getCandidateClassInfo = (name: string, teamId: string | null) => {
    const p = db.participants.find(x => x.name === name && x.teamId === teamId);
    if (!p || !p.cls) return '';
    return p.cls + (p.division ? ' ' + p.division : '');
  };

  // Filter logic
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
            // Check participant by name or team to find their chest number & class
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

  // Count results per section
  const countBoys = db.results.filter(r => r.gender === 'Boys').length;
  const countGirls = db.results.filter(r => r.gender === 'Girls').length;
  const countGeneral = db.results.filter(r => (r.gender as string) === 'General' || (r.age as string) === 'General' || (r.age as string) === 'All').length;

  return (
    <div className="view active pb-20 max-w-2xl mx-auto space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-gold-500 animate-pulse" />
          <div>
            <h2 className="font-display font-bold text-brand-green-950 text-sm md:text-base">
              Competition Winners & Results
            </h2>
            <p className="text-[10px] text-brand-ink-soft">
              ഔദ്യോഗിക മത്സര ഫലങ്ങൾ &middot; Official Published Standings
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold bg-brand-green-100 text-brand-green-900 px-2.5 py-1 rounded-full border border-brand-green-200">
          {db.results.length} Published
        </span>
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
          <span className="leading-tight text-center">All Results</span>
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
          <span className="leading-tight text-center">Boys Section (ആൺ)</span>
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
          <span className="leading-tight text-center">Girls Section (പെൺ)</span>
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
          placeholder="Search team name, program code, candidate name..."
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

      {/* Category Pills (Sub Junior, Junior, Senior, Super Senior, Kids, General) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <label className="text-[10px] font-bold text-brand-gold-800 tracking-wider uppercase flex items-center gap-1">
            <span>🏷️</span> Filter by Age Category (വിഭാഗം)
          </label>
          {selectedAge !== 'All' && (
            <button
              onClick={() => setSelectedAge('All')}
              className="text-[10px] text-amber-800 font-bold hover:underline"
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
            Filter By Team (ടീം തിരിച്ച്)
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

      {/* Results List */}
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
      ) : (
        <div className="space-y-3.5">
          {/* Major Category Spotlight Header */}
          <div className="bg-gradient-to-br from-brand-gold-100 via-amber-50 to-brand-gold-100/60 border border-brand-gold-300 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl p-1 bg-white rounded-xl border border-brand-gold-300 shadow-2xs">🏆</span>
              <div>
                <b className="text-xs font-extrabold text-brand-green-950 block">
                  {selectedGender === 'Boys' ? '👦 Boys Section' : selectedGender === 'Girls' ? '👧 Girls Section' : selectedGender === 'General' ? '👥 General / Group Items' : '✨ All Sections'}{' '}
                  {selectedAge !== 'All' ? `• ${selectedAge} Group` : ''} Results
                </b>
                <span className="text-[10px] text-brand-gold-900 font-medium">
                  Showing <b>{filteredResults.length}</b> published competition result{filteredResults.length > 1 ? 's' : ''}
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

          {filteredResults.map(r => {
            const prog = db.programs.find(p => p.id === r.programId);
            const isBoys = r.gender === 'Boys';
            const isGirls = r.gender === 'Girls';
            const isGeneralOrGroup = Boolean(prog?.group || prog?.categories.some(c => (c.gender as string) === 'General' || (c.age as string) === 'All' || (c.age as string) === 'General') || (r.gender as string) === 'General' || (r.age as string) === 'General' || (r.age as string) === 'All');

            const tagClass = isBoys 
              ? 'bg-sky-100 text-sky-950 border border-sky-300' 
              : isGirls 
                ? 'bg-fuchsia-100 text-fuchsia-950 border border-fuchsia-300' 
                : 'bg-emerald-100 text-emerald-950 border border-emerald-300';

            return (
              <div key={r.id} className="bg-brand-panel border border-brand-line rounded-2xl p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[9px] font-extrabold bg-brand-green-100 text-brand-green-900 px-2 py-0.5 rounded border border-brand-green-200">
                        {prog?.code || '—'}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${tagClass}`}>
                        {isBoys ? '👦 Boys Section' : isGirls ? '👧 Girls Section' : '🌐 General Section'}
                      </span>
                      {r.age !== 'All' && (
                        <span className="text-[9px] font-bold bg-brand-gold-100 text-brand-gold-900 px-2 py-0.5 rounded-full border border-brand-gold-300">
                          {AGE_ICONS[r.age] || '🏷️'} {r.age} Group
                        </span>
                      )}
                      {isGeneralOrGroup && (
                        <span className="text-[9px] font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                          <Users className="w-3 h-3 text-amber-700" /> Team Points Item
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-xs md:text-sm text-brand-ink mt-1.5">
                      {prog?.name || 'Untitled Program'}
                    </h3>

                    {isGeneralOrGroup && (
                      <p className="text-[10px] text-amber-900 font-semibold mt-0.5">
                        👥 ജനറൽ / ഗ്രൂപ്പ് മത്സരം: ഇതിലെ പോയിന്റുകൾ പൂർണ്ണമായും ടീമിന്റെ സ്കോറിലാണ് കൂട്ടപ്പെടുന്നത് (വ്യക്തികൾക്കല്ല).
                      </p>
                    )}
                  </div>

                  {/* Celebrate First Place winner button */}
                  {r.winners?.first?.[0] && (
                    <button
                      onClick={() => fireGoldWinnerBurst()}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-all shrink-0 active:scale-95"
                      title="Trigger confetti celebration for 1st place winner!"
                    >
                      <span>🎉</span> Celebrate 1st
                    </button>
                  )}
                </div>

                {/* Score listing */}
                <div className="space-y-1.5 bg-brand-bg/60 p-3 rounded-xl border border-brand-line/60">
                  {(() => {
                    return ['first', 'second', 'third'].map(pos => {
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
                        const clsInfo = getCandidateClassInfo(winner.name, winner.teamId);
                        return (
                          <div key={key + winIndex} className="flex items-center justify-between text-xs py-1 border-b border-brand-line/30 last:border-0">
                            <span className="shrink-0 w-6 text-center text-sm">{medal}</span>
                            <div className="flex-1 min-w-0 ml-1">
                              <b className="text-brand-ink truncate block font-bold text-xs">
                                {winner.name}
                                {clsInfo && <span className="text-[10px] text-brand-ink-soft ml-1 font-normal">(Class {clsInfo})</span>}
                              </b>
                              <span className="text-[10px] text-brand-ink-soft flex items-center gap-1 font-medium">
                                <span style={{ color: team?.color || '#000' }}>{team?.symbol || '🛡️'}</span>
                                <span>{team ? team.name : 'Independent'}</span>
                                <span>&bull;</span>
                                <span className="text-brand-gold-800 font-semibold">{labelText}</span>
                              </span>
                            </div>
                            <span className="font-mono text-xs font-black bg-brand-green-100 text-brand-green-950 px-2 py-0.5 rounded-lg border border-brand-green-300 shrink-0 ml-2">
                              +{winPts} PTS {isGeneralOrGroup ? '(Team)' : ''}
                            </span>
                          </div>
                        );
                      });
                    });
                  })()}

                  {/* Grades listing */}
                  {r.grades && Object.entries(r.grades).map(([gradeKey, list]) => {
                    const key = gradeKey as keyof typeof r.grades;
                    const icon = key === 'gradeA' ? '🅰️' : key === 'gradeB' ? '🅱️' : key === 'gradeC' ? '🅲' : '🎗️';
                    const label = key === 'gradeA' ? 'Grade A' : key === 'gradeB' ? 'Grade B' : key === 'gradeC' ? 'Grade C' : 'Participation';
                    
                    return list.map((entry, idx) => {
                      const team = db.teams.find(t => t.id === entry.teamId);
                      const clsInfo = getCandidateClassInfo(entry.name, entry.teamId);
                      return (
                        <div key={key + idx} className="flex items-center justify-between text-xs py-1 border-b border-brand-line/30 last:border-0">
                          <span className="shrink-0 w-6 text-center text-sm">{icon}</span>
                          <div className="flex-1 min-w-0 ml-1">
                            <b className="text-brand-ink truncate block font-bold text-xs">
                              {entry.name}
                              {clsInfo && <span className="text-[10px] text-brand-ink-soft ml-1 font-normal">(Class {clsInfo})</span>}
                            </b>
                            <span className="text-[10px] text-brand-ink-soft flex items-center gap-1 font-medium">
                              <span style={{ color: team?.color || '#000' }}>{team?.symbol || '🛡️'}</span>
                              <span>{team ? team.name : 'Independent'}</span>
                              <span>&bull;</span>
                              <span className="text-brand-green-800 font-bold">{label}</span>
                            </span>
                          </div>
                          <span className="font-mono text-xs font-black bg-amber-100 text-amber-950 px-2 py-0.5 rounded-lg border border-amber-300 shrink-0 ml-2">
                            +{db.settings.points[key]} PTS
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
          })}
        </div>
      )}
    </div>
  );
}

