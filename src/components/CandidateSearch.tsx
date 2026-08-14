import { useState, useMemo } from 'react';
import { Database, Participant, Team } from '../types';
import { classToAge } from '../db';
import { 
  Search, 
  User, 
  Calendar, 
  MapPin, 
  Clock, 
  Printer, 
  X, 
  GraduationCap, 
  Filter
} from 'lucide-react';

interface CandidateSearchProps {
  db: Database;
}

export default function CandidateSearch({ db }: CandidateSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedGender, setSelectedGender] = useState('all');
  const [selectedAge, setSelectedAge] = useState('all');

  // Filter candidates dynamically based on search string and dropdown filters
  const filteredCandidates = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    
    return db.participants.filter(cand => {
      // Search term matching chest number or name
      const matchesSearch = !term || 
        (cand.number && cand.number.toLowerCase().includes(term)) || 
        cand.name.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // Team filter
      if (selectedTeam !== 'all' && cand.teamId !== selectedTeam) return false;

      // Gender filter
      if (selectedGender !== 'all' && cand.gender !== selectedGender) return false;

      // Age group category filter
      const candAgeGroup = classToAge(cand.cls);
      if (selectedAge !== 'all' && candAgeGroup !== selectedAge && cand.age !== selectedAge) return false;

      return true;
    }).sort((a, b) => {
      const numA = parseInt(a.number, 10) || 0;
      const numB = parseInt(b.number, 10) || 0;
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name);
    });
  }, [db.participants, searchTerm, selectedTeam, selectedGender, selectedAge]);

  // Helper to get candidate team
  const getTeam = (teamId: string | null): Team | undefined => {
    return db.teams.find(t => t.id === teamId);
  };

  // Helper to find program results for a candidate
  const getCandidateAchievements = (cand: Participant, programId: string) => {
    const resultsForProg = db.results.filter(r => r.programId === programId);
    const prog = db.programs.find(p => p.id === programId);
    const isGroupProg = Boolean(prog?.group || prog?.categories.some(c => c.gender === 'General' || c.age === 'General' || c.age === 'All'));
    const achievements: { title: string; pts: number; type: 'winner' | 'grade'; isGroup?: boolean }[] = [];

    resultsForProg.forEach(res => {
      // Check winners
      ['first', 'second', 'third'].forEach((placeKey) => {
        const placeWinners = (res.winners as any)?.[placeKey] || [];
        const isWinner = placeWinners.some((w: any) => 
          w.name.toLowerCase() === cand.name.toLowerCase() || 
          (w.teamId && w.teamId === cand.teamId && (w.name.toLowerCase() === cand.name.toLowerCase() || isGroupProg))
        );

        if (isWinner) {
          const rawPts = placeKey === 'first' 
            ? (isGroupProg ? (db.settings.points.generalFirst || 15) : (db.settings.points.first || 10)) 
            : placeKey === 'second' 
            ? (isGroupProg ? (db.settings.points.generalSecond || 10) : (db.settings.points.second || 7)) 
            : (isGroupProg ? (db.settings.points.generalThird || 7) : (db.settings.points.third || 5));
          const pts = isGroupProg ? 0 : rawPts; // Individual candidate gets 0 personal pts for Group item (Team gets pts)
          const title = placeKey === 'first' 
            ? (isGroupProg ? '🥇 1st Place (👥 Group - Team Score)' : '🥇 1st Place')
            : placeKey === 'second' 
            ? (isGroupProg ? '🥈 2nd Place (👥 Group - Team Score)' : '🥈 2nd Place')
            : (isGroupProg ? '🥉 3rd Place (👥 Group - Team Score)' : '🥉 3rd Place');
          achievements.push({ title, pts, type: 'winner', isGroup: isGroupProg });
        }
      });

      // Check grades
      ['gradeA', 'gradeB', 'gradeC'].forEach((gradeKey) => {
        const gradeWinners = (res.grades as any)?.[gradeKey] || [];
        const isGrade = gradeWinners.some((w: any) => 
          w.name.toLowerCase() === cand.name.toLowerCase() ||
          (w.teamId && w.teamId === cand.teamId && isGroupProg)
        );

        if (isGrade) {
          const rawPts = gradeKey === 'gradeA' 
            ? (db.settings.points.gradeA || 5) 
            : gradeKey === 'gradeB' 
            ? (db.settings.points.gradeB || 3) 
            : (db.settings.points.gradeC || 1);
          const pts = isGroupProg ? 0 : rawPts;
          const title = gradeKey === 'gradeA' 
            ? (isGroupProg ? '⭐ Grade A (👥 Group)' : '⭐ Grade A')
            : gradeKey === 'gradeB' 
            ? (isGroupProg ? '✨ Grade B (👥 Group)' : '✨ Grade B')
            : (isGroupProg ? '💫 Grade C (👥 Group)' : '💫 Grade C');
          achievements.push({ title, pts, type: 'grade', isGroup: isGroupProg });
        }
      });
    });

    return achievements;
  };

  // Printable slip handle
  const handlePrintSlip = (cand: Participant) => {
    const team = getTeam(cand.teamId);
    const ageCategory = classToAge(cand.cls);
    const candidatePrograms = db.programs.filter(p => (cand.programIds || []).includes(p.id));

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Candidate Program Slip - ${cand.number} ${cand.name}</title>
        <style>
          @page { size: A5 portrait; margin: 10mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 12px; }
          .card { border: 2px solid #0f172a; border-radius: 10px; padding: 14px; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; }
          .chest-badge { background: #064e3b; color: #fff; font-size: 20px; font-weight: 900; padding: 4px 12px; border-radius: 6px; font-family: monospace; }
          .title-area h2 { margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; }
          .title-area p { margin: 2px 0 0 0; font-size: 12px; color: #475569; font-weight: 600; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #f8fafc; padding: 8px; border-radius: 6px; margin-bottom: 12px; font-size: 11px; border: 1px solid #cbd5e1; }
          .info-item { display: flex; flex-direction: column; }
          .info-label { font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase; }
          .info-val { font-size: 12px; font-weight: 800; color: #0f172a; }
          .table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          .table th, .table td { border: 1px solid #cbd5e1; padding: 6px 5px; text-align: left; font-size: 10.5px; }
          .table th { background: #f1f5f9; font-weight: 800; color: #0f172a; }
          .stage-tag { font-weight: 800; font-size: 9px; padding: 2px 5px; border-radius: 4px; display: inline-block; }
          .main-stage { background: #dbeafe; color: #1e40af; }
          .offstage { background: #fef3c7; color: #92400e; }
          .footer { margin-top: 16px; display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; color: #475569; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="title-area">
              <h2>${db.settings.eventName || 'KALIMA 2k26 MEELAD FEST'}</h2>
              <p>Candidate Program Slip & Entry Card</p>
            </div>
            <div class="chest-badge">#${cand.number || '—'}</div>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Candidate Name</span>
              <span class="info-val">${cand.name}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Team / House</span>
              <span class="info-val" style="color: ${team?.color || '#000'}">${team?.symbol || '🛡️'} ${team?.name || '—'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Class & Division</span>
              <span class="info-val">Class ${cand.cls || '—'} - Div ${cand.division || '—'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Group Category & Gender</span>
              <span class="info-val">${ageCategory} Group (${cand.gender})</span>
            </div>
          </div>

          <h3 style="margin: 0 0 6px 0; font-size: 12px; font-weight: 800; color: #064e3b;">
            Enrolled Programs List (${candidatePrograms.length})
          </h3>
          <table class="table">
            <thead>
              <tr>
                <th style="width: 45px;">Code</th>
                <th>Program Name</th>
                <th>Stage</th>
                <th>Day & Time</th>
                <th>Venue</th>
              </tr>
            </thead>
            <tbody>
              ${candidatePrograms.length > 0 ? candidatePrograms.map(p => `
                <tr>
                  <td style="font-weight: 800; font-family: monospace;">${p.code}</td>
                  <td style="font-weight: 700;">${p.name}</td>
                  <td>
                    <span class="stage-tag ${p.stageType === 'Main Stage' ? 'main-stage' : 'offstage'}">
                      ${p.stageType || 'Offstage'}
                    </span>
                  </td>
                  <td>${p.day || 'Day 1'} ${p.startTime ? `(${p.startTime})` : ''}</td>
                  <td>${p.venue || '—'}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="5" style="text-align: center; color: #64748b; font-style: italic;">No registered programs found.</td>
                </tr>
              `}
            </tbody>
          </table>

          <div class="footer">
            <div>Team Captain: _________________</div>
            <div>Leader Contact: _________________</div>
            <div>Date Printed: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(htmlContent);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        try { printWin.print(); } catch (e) {}
      }, 400);
    }
  };

  return (
    <div className="view active pb-16 max-w-2xl mx-auto space-y-4">
      {/* Compact Clean Header Banner */}
      <div className="bg-brand-panel border border-brand-line rounded-xl p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-extrabold text-base sm:text-lg text-brand-green-950 tracking-tight flex items-center gap-1.5">
            <span>🎭</span> {db.settings.eventName || 'KALIMA 2k26 MEELAD FEST'}
          </h1>
          <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1 mt-0.5">
            <span>🔍</span> Candidate Search Portal
          </p>
        </div>

        <div className="px-2.5 py-1 bg-emerald-50 text-emerald-950 rounded-lg border border-emerald-200 text-xs font-semibold shrink-0 self-start sm:self-auto">
          Total Candidates: <b className="font-mono text-emerald-800">{db.participants.length}</b>
        </div>
      </div>

      {/* Main Search Input & Dropdowns Card */}
      <div className="bg-brand-panel border border-brand-line rounded-xl p-3.5 shadow-2xs space-y-3">
        {/* Search input field */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 h-4 text-brand-green-700" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type Chest Number (e.g. 101, 25) or Candidate Name..."
            className="w-full pl-9 pr-9 py-2 bg-white border border-brand-green-700/40 rounded-lg text-xs md:text-sm font-semibold text-brand-green-950 placeholder-brand-ink-soft/60 focus:outline-none focus:border-brand-green-700 focus:ring-2 focus:ring-brand-green-700/10 transition-all shadow-2xs"
            autoFocus
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Team Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-green-950 flex items-center gap-1">
              <Filter className="w-3 h-3 text-brand-green-700" /> Team Filter
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-brand-line rounded-lg text-xs font-semibold text-brand-ink focus:outline-none focus:border-brand-green-700"
            >
              <option value="all">🛡️ All Teams ({db.teams.length})</option>
              {db.teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.symbol} {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-green-950 flex items-center gap-1">
              <User className="w-3 h-3 text-brand-green-700" /> Gender Section
            </label>
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-brand-line rounded-lg text-xs font-semibold text-brand-ink focus:outline-none focus:border-brand-green-700"
            >
              <option value="all">🚻 All Gender Sections</option>
              <option value="Boys">👦 Boys Section</option>
              <option value="Girls">👧 Girls Section</option>
              <option value="General">🌐 General Section</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-green-950 flex items-center gap-1">
              <GraduationCap className="w-3 h-3 text-brand-green-700" /> Age Category
            </label>
            <select
              value={selectedAge}
              onChange={(e) => setSelectedAge(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-brand-line rounded-lg text-xs font-semibold text-brand-ink focus:outline-none focus:border-brand-green-700"
            >
              <option value="all">🎓 All Age Groups</option>
              <option value="Kids">🧒 Kids Group (Class 1-2)</option>
              <option value="Sub Junior">👦 Sub Junior Group (Class 3-4)</option>
              <option value="Junior">👨‍🎓 Junior Group (Class 5-6)</option>
              <option value="Senior">🎓 Senior Group (Class 7-8)</option>
              <option value="Super Senior">🏆 Super Senior Group (Class 9-12)</option>
            </select>
          </div>
        </div>

        {/* Filter Results Summary */}
        <div className="flex items-center justify-between text-[11px] text-brand-ink-soft border-t border-brand-line/60 pt-2">
          <span>
            Showing <b>{filteredCandidates.length}</b> {filteredCandidates.length === 1 ? 'candidate' : 'candidates'}
          </span>
          {(searchTerm || selectedTeam !== 'all' || selectedGender !== 'all' || selectedAge !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedTeam('all');
                setSelectedGender('all');
                setSelectedAge('all');
              }}
              className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer text-[10px]"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Candidate List Display */}
      {filteredCandidates.length === 0 ? (
        <div className="bg-brand-panel border border-brand-line rounded-xl p-6 text-center space-y-2">
          <div className="w-10 h-10 bg-brand-green-100/70 text-brand-green-800 rounded-full flex items-center justify-center text-lg mx-auto shadow-2xs">
            👤
          </div>
          <h3 className="font-display font-bold text-brand-green-950 text-sm">
            No Candidate Found
          </h3>
          <p className="text-xs text-brand-ink-soft max-w-sm mx-auto">
            {searchTerm 
              ? `No candidate matched "${searchTerm}". Please check the chest number or student's name.`
              : 'Type a chest number or student name in the search box above to view candidate details.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCandidates.map((cand) => {
            const team = getTeam(cand.teamId);
            const ageGroup = classToAge(cand.cls);
            const candProgs = db.programs.filter(p => (cand.programIds || []).includes(p.id));

            return (
              <div 
                key={cand.id}
                className="bg-brand-panel border border-brand-line hover:border-brand-green-700/40 rounded-xl p-3.5 shadow-2xs space-y-3 relative overflow-hidden group"
              >
                {/* Team Top Accent Line */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1" 
                  style={{ backgroundColor: team?.color || '#047857' }}
                />

                {/* Candidate Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-line/80 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    {/* Chest Number Badge */}
                    <div 
                      className="px-2.5 py-1 rounded-lg text-white font-extrabold text-sm font-mono shadow-2xs flex flex-col items-center justify-center shrink-0 min-w-[50px]"
                      style={{ backgroundColor: team?.color || '#064e3b' }}
                    >
                      <span className="text-[8px] opacity-80 uppercase font-sans font-semibold leading-none">CHEST</span>
                      <span className="leading-tight">#{cand.number || '—'}</span>
                    </div>

                    {/* Candidate Name & Info */}
                    <div>
                      <h2 className="font-display font-bold text-brand-green-950 text-sm md:text-base leading-snug">
                        {cand.name}
                      </h2>
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] mt-0.5">
                        {/* Class & Division */}
                        <span className="px-1.5 py-0.2 bg-brand-green-100/90 text-brand-green-900 font-extrabold rounded border border-brand-green-300/60">
                          Class {cand.cls || '—'} ({cand.division || '—'})
                        </span>

                        {/* Age Category */}
                        <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-900 font-semibold rounded">
                          {ageGroup}
                        </span>

                        {/* Gender Section */}
                        <span className="px-1.5 py-0.2 bg-teal-100 text-teal-900 font-semibold rounded">
                          {cand.gender === 'Boys' ? '👦 Boys' : cand.gender === 'Girls' ? '👧 Girls' : '🌐 General'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Team Badge & Print Button */}
                  <div className="flex items-center gap-1.5 sm:self-start">
                    {team && (
                      <div 
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white shadow-2xs flex items-center gap-1 shrink-0"
                        style={{ backgroundColor: team.color }}
                      >
                        <span>{team.symbol}</span>
                        <span>{team.name}</span>
                      </div>
                    )}

                    <button
                      onClick={() => handlePrintSlip(cand)}
                      className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg transition-all cursor-pointer border border-emerald-300/60"
                      title="Print / Save Candidate Program Slip"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Candidate Registered Programs List */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-brand-green-950 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-brand-green-700" />
                      <span>Enrolled Programs ({candProgs.length})</span>
                    </h3>
                  </div>

                  {candProgs.length === 0 ? (
                    <div className="p-2 bg-white/60 rounded-lg text-[11px] text-brand-ink-soft italic border border-dashed border-brand-line">
                      No registered programs for this candidate yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5">
                      {candProgs.map((prog) => {
                        const achievements = getCandidateAchievements(cand, prog.id);

                        return (
                          <div 
                            key={prog.id}
                            className="p-2.5 bg-white rounded-lg border border-brand-line hover:border-emerald-600/30 transition-all shadow-2xs space-y-1"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.2 bg-brand-green-900 text-white font-mono font-bold text-[9.5px] rounded">
                                    {prog.code}
                                  </span>
                                  <h4 className="font-bold text-brand-green-950 text-xs">
                                    {prog.name}
                                  </h4>
                                </div>
                                
                                <div className="flex items-center gap-2.5 text-[10.5px] text-brand-ink-soft mt-1 flex-wrap">
                                  {prog.stageType && (
                                    <span className={`px-1.5 py-0.2 text-[9.5px] font-bold rounded ${prog.stageType === 'Main Stage' ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'}`}>
                                      {prog.stageType === 'Main Stage' ? '🎭 Main Stage' : '📜 Offstage'}
                                    </span>
                                  )}

                                  {prog.venue && (
                                    <span className="flex items-center gap-0.5">
                                      <MapPin className="w-3 h-3 text-emerald-700" /> {prog.venue}
                                    </span>
                                  )}

                                  {prog.startTime && (
                                    <span className="flex items-center gap-0.5">
                                      <Clock className="w-3 h-3 text-emerald-700" /> {prog.startTime}
                                    </span>
                                  )}

                                  {prog.day && (
                                    <span className="text-[9.5px] bg-slate-100 px-1.5 py-0.2 rounded font-semibold">
                                      {prog.day}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Achievements or Status */}
                              <div className="flex flex-col items-end gap-1">
                                {achievements.length > 0 ? (
                                  achievements.map((ach, idx) => (
                                    <span 
                                      key={idx}
                                      className="px-2 py-0.2 bg-emerald-800 text-white text-[9.5px] font-bold rounded-full flex items-center gap-1"
                                    >
                                      <span>{ach.title}</span>
                                      <span className="bg-emerald-950 px-1 py-0.1 rounded-full text-[8.5px] text-emerald-300">
                                        +{ach.pts} Pts
                                      </span>
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[9.5px] text-slate-400 font-semibold italic">
                                    Registered
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
