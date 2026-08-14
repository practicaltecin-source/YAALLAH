import { useState } from 'react';
import { Database, Program } from '../types';
import { GENDERS, AGES, AGE_ICONS, GENDER_ICONS } from '../db';
import { Search, MapPin, Clock, Users, FileText, Calendar, Printer, X, ChevronDown, Layers, Sparkles, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ProgramsProps {
  db: Database;
  onGenerateReport?: (filename: string, title: string, bodyHTML: string) => void;
}

export function isGeneralProgram(p: Program): boolean {
  if (!p.categories || p.categories.length === 0) return true;
  return p.categories.some(c => 
    c.gender === 'General' || 
    c.age === 'General' || 
    c.age === 'All'
  );
}

export default function Programs({ db, onGenerateReport }: ProgramsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGender, setSelectedGender] = useState<'All' | 'Boys' | 'Girls' | 'General'>('All');
  const [selectedAge, setSelectedAge] = useState<'All' | 'Kids' | 'Sub Junior' | 'Junior' | 'Senior' | 'Super Senior'>('All');
  const [selectedStageType, setSelectedStageType] = useState<'All' | 'Main Stage' | 'Offstage' | 'General'>('All');
  const [selectedTeam, setSelectedTeam] = useState<string>('All');
  const [expandedProgId, setExpandedProgId] = useState<string | null>(null);

  const [selectedPrintCat, setSelectedPrintCat] = useState<Record<string, string>>({});
  const [selectedPrintGender, setSelectedPrintGender] = useState<Record<string, string>>({});

  const handlePrintProgramJudgeSheet = (program: Program, targetCategory: string = 'All', targetGender: string = 'All') => {
    const eventName = db.settings.eventName || 'KALIMA 2k26 MEELAD FEST';
    const boardName = db.settings.boardName || 'KALIMA 2k26 MEELAD FEST';

    const enrolled = db.participants.filter(pt => pt.programIds && pt.programIds.includes(program.id));

    // Filter by target category and target gender
    let filtered = enrolled;
    if (targetCategory && targetCategory !== 'All') {
      filtered = filtered.filter(pt => (pt.category || pt.age) === targetCategory);
    }
    if (targetGender && targetGender !== 'All') {
      filtered = filtered.filter(pt => (pt.gender || 'General') === targetGender);
    }

    const sorted = [...filtered].sort((a, b) => {
      const chestA = parseInt(a.chestNo || a.number || '0', 10);
      const chestB = parseInt(b.chestNo || b.number || '0', 10);
      if (!isNaN(chestA) && !isNaN(chestB) && chestA !== chestB) return chestA - chestB;
      return a.name.localeCompare(b.name);
    });

    const progType = (program.single && program.group) ? 'Single & Group' : program.group ? 'Group' : 'Single';
    const venueTime = [
      program.stageType || 'Main Stage',
      program.venue,
      program.day,
      program.startTime ? `${program.startTime}${program.endTime ? ' - ' + program.endTime : ''}` : program.schedule
    ].filter(Boolean).join('  •  ');

    const badgeParts = [];
    if (targetCategory !== 'All') badgeParts.push(`CATEGORY: ${targetCategory.toUpperCase()}`);
    else badgeParts.push('ALL CATEGORIES');

    if (targetGender !== 'All') badgeParts.push(`GENDER: ${targetGender.toUpperCase()}`);
    else badgeParts.push('ALL GENDERS');

    const categoryBadgeText = badgeParts.join(' | ');

    let tablesHTML = '';

    // Grouping helper
    if (targetGender === 'All' || targetCategory === 'All') {
      // Group candidates by combined key: "Category - Gender"
      const groupMap: Record<string, typeof sorted> = {};
      sorted.forEach(p => {
        const catName = p.category || p.age || 'General';
        const genderName = p.gender || 'General';
        const groupKey = targetCategory === 'All' && targetGender === 'All'
          ? `${catName} — ${genderName}`
          : targetCategory === 'All'
            ? `${catName}`
            : `${genderName}`;

        if (!groupMap[groupKey]) groupMap[groupKey] = [];
        groupMap[groupKey].push(p);
      });

      const groupKeys = Object.keys(groupMap);
      if (groupKeys.length === 0) {
        tablesHTML = `
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #15803d; color: white;">
                <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 40px;">#</th>
                <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 75px;">Chest No</th>
                <th style="padding: 8px; border: 1px solid #374151; text-align: left;">Candidate Name</th>
                <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 140px;">Team</th>
                <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 110px;">Gender</th>
                <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 110px;">Class / Div</th>
                <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 65px;">Present</th>
                <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 110px;">Judge Score / Rank</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="8" style="padding: 20px; text-align: center; color: #6b7280; font-style: italic;">No candidates currently enrolled.</td>
              </tr>
            </tbody>
          </table>
        `;
      } else {
        tablesHTML = groupKeys.map((gKey, groupIdx) => {
          const groupList = groupMap[gKey];
          return `
            <div style="margin-top: ${groupIdx > 0 ? '24px' : '0'}; margin-bottom: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 6px 12px; border-radius: 6px; font-weight: bold; color: #166534; font-size: 13px;">
              📌 SECTION: ${gKey.toUpperCase()} (${groupList.length} Candidates)
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #15803d; color: white;">
                  <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 40px;">#</th>
                  <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 75px;">Chest No</th>
                  <th style="padding: 8px; border: 1px solid #374151; text-align: left;">Candidate Name</th>
                  <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 140px;">Team</th>
                  <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 110px;">Gender</th>
                  <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 110px;">Class / Div</th>
                  <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 65px;">Present</th>
                  <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 110px;">Judge Score / Rank</th>
                </tr>
              </thead>
              <tbody>
                ${groupList.map((p, idx) => {
                  const team = db.teams.find(t => t.id === p.teamId);
                  const classDiv = p.cls ? `${p.cls}${p.division ? ' ' + p.division : ''}` : '—';
                  return `
                    <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                      <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center; font-weight: bold;">${idx + 1}</td>
                      <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center; font-weight: bold; font-family: monospace; font-size: 13px; color: #15803d;">${p.chestNo || p.number || '—'}</td>
                      <td style="padding: 8px; border: 1px solid #d1d5db; font-weight: bold; color: #111827;">${p.name}</td>
                      <td style="padding: 8px; border: 1px solid #d1d5db; font-size: 11px;">${team ? team.name : '—'}</td>
                      <td style="padding: 8px; border: 1px solid #d1d5db; font-size: 11px; font-weight: 600; color: ${p.gender === 'Girls' ? '#c026d3' : '#2563eb'};">${p.gender || 'General'}</td>
                      <td style="padding: 8px; border: 1px solid #d1d5db; font-size: 11px;">${classDiv}</td>
                      <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center;"><input type="checkbox" style="transform: scale(1.3);" /></td>
                      <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center;"></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `;
        }).join('');
      }
    } else {
      tablesHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #15803d; color: white;">
              <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 40px;">#</th>
              <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 75px;">Chest No</th>
              <th style="padding: 8px; border: 1px solid #374151; text-align: left;">Candidate Name</th>
              <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 140px;">Team</th>
              <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 110px;">Gender</th>
              <th style="padding: 8px; border: 1px solid #374151; text-align: left; width: 110px;">Class / Div</th>
              <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 65px;">Present</th>
              <th style="padding: 8px; border: 1px solid #374151; text-align: center; width: 110px;">Judge Score / Rank</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.length === 0 ? `
              <tr>
                <td colspan="8" style="padding: 20px; text-align: center; color: #6b7280; font-style: italic;">No candidates found matching filter criteria.</td>
              </tr>
            ` : sorted.map((p, idx) => {
              const team = db.teams.find(t => t.id === p.teamId);
              const classDiv = p.cls ? `${p.cls}${p.division ? ' ' + p.division : ''}` : '—';
              return `
                <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                  <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center; font-weight: bold;">${idx + 1}</td>
                  <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center; font-weight: bold; font-family: monospace; font-size: 13px; color: #15803d;">${p.chestNo || p.number || '—'}</td>
                  <td style="padding: 8px; border: 1px solid #d1d5db; font-weight: bold; color: #111827;">${p.name}</td>
                  <td style="padding: 8px; border: 1px solid #d1d5db; font-size: 11px;">${team ? team.name : '—'}</td>
                  <td style="padding: 8px; border: 1px solid #d1d5db; font-size: 11px; font-weight: 600; color: ${p.gender === 'Girls' ? '#c026d3' : '#2563eb'};">${p.gender || 'General'}</td>
                  <td style="padding: 8px; border: 1px solid #d1d5db; font-size: 11px;">${classDiv}</td>
                  <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center;"><input type="checkbox" style="transform: scale(1.3);" /></td>
                  <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center;"></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    const bodyHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 950px; margin: 0 auto; color: #111827;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 3px double #15803d; padding-bottom: 12px;">
          <h1 style="margin: 0; color: #15803d; font-size: 24px; font-weight: bold; text-transform: uppercase;">${eventName}</h1>
          <h2 style="margin: 4px 0 0; color: #b45309; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">${boardName}</h2>
          <div style="margin-top: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px 16px; border-radius: 8px; display: inline-block;">
            <h3 style="margin: 0; font-size: 18px; color: #166534;">[${program.code}] ${program.name}</h3>
            <div style="margin-top: 6px; font-size: 12px; color: #15803d; font-weight: bold; text-transform: uppercase; background: #dcfce7; display: inline-block; padding: 4px 12px; border-radius: 20px; border: 1px solid #bbf7d0;">
              🎯 ${categoryBadgeText}
            </div>
            <p style="margin: 6px 0 0; font-size: 12px; color: #374151; font-weight: 600;">${venueTime} | Type: ${progType}</p>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 12px; font-weight: bold; color: #1f2937;">
          <span>📋 OFFICIAL JUDGE CALL & EVALUATION SHEET</span>
          <span>Candidates Count: ${sorted.length}</span>
        </div>

        ${tablesHTML}

        <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 11px; font-weight: bold; color: #374151;">
          <div style="border-top: 1px solid #9ca3af; width: 220px; padding-top: 6px;">Judge 1 Signature</div>
          <div style="border-top: 1px solid #9ca3af; width: 220px; padding-top: 6px;">Judge 2 Signature</div>
          <div style="border-top: 1px solid #9ca3af; width: 220px; padding-top: 6px;">Stage Convener Signature</div>
        </div>
      </div>
    `;

    if (onGenerateReport) {
      onGenerateReport(`Judge_CallSheet_${program.code}_${targetCategory}_${targetGender}`, `Stage Call Sheet - ${program.code} (${targetCategory} - ${targetGender})`, bodyHTML);
    } else {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`<html><head><title>Stage Call Sheet - ${program.code} (${targetCategory} - ${targetGender})</title></head><body>${bodyHTML}</body></html>`);
        printWin.document.close();
        printWin.print();
      }
    }
  };

  // Compute program counts
  const totalProgramCount = db.programs.length;
  const mainStageCount = db.programs.filter(p => (p.stageType || 'Main Stage') === 'Main Stage').length;
  const offStageCount = db.programs.filter(p => p.stageType === 'Offstage').length;
  const generalCount = db.programs.filter(p => isGeneralProgram(p)).length;

  const filteredPrograms = db.programs.filter(p => {
    // Stage type / General filter
    if (selectedStageType !== 'All') {
      if (selectedStageType === 'General') {
        if (!isGeneralProgram(p)) return false;
      } else {
        const pStage = p.stageType || 'Main Stage';
        if (pStage !== selectedStageType) {
          return false;
        }
      }
    }

    // Selected Team filter
    if (selectedTeam !== 'All') {
      const teamParticipants = db.participants.filter(
        part => part.teamId === selectedTeam && part.programIds && part.programIds.includes(p.id)
      );
      if (teamParticipants.length === 0) {
        return false;
      }
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();

      const matchesCode = p.code.toLowerCase().includes(term);
      const matchesName = p.name.toLowerCase().includes(term);
      const matchesMeta = (p.venue && p.venue.toLowerCase().includes(term)) || 
                          (p.day && p.day.toLowerCase().includes(term)) ||
                          (p.schedule && p.schedule.toLowerCase().includes(term)) ||
                          (p.description && p.description.toLowerCase().includes(term));

      // Find teams matching search term
      const matchingTeamIds = db.teams
        .filter(t => t.name.toLowerCase().includes(term) || t.id.toLowerCase().includes(term))
        .map(t => t.id);

      const matchesTeam = matchingTeamIds.length > 0 && db.participants.some(
        part => matchingTeamIds.includes(part.teamId) && part.programIds && part.programIds.includes(p.id)
      );

      // Find participant names matching search term
      const matchesParticipant = db.participants.some(
        part => part.name.toLowerCase().includes(term) && part.programIds && part.programIds.includes(p.id)
      );

      if (!matchesCode && !matchesName && !matchesMeta && !matchesTeam && !matchesParticipant) {
        return false;
      }
    }

    // Gender filter
    if (selectedGender !== 'All') {
      if (selectedGender === 'General') {
        if (!isGeneralProgram(p)) return false;
      } else if (!p.categories.some(c => c.gender === selectedGender)) {
        return false;
      }
    }

    // Age filter
    if (selectedAge !== 'All') {
      if (selectedAge === 'Kids' && isGeneralProgram(p)) {
        return false;
      }
      if (!p.categories.some(c => c.age === selectedAge)) {
        return false;
      }
    }

    return true;
  });

  const handlePrintProgramSheet = () => {
    const eventName = db.settings.eventName || 'KALIMA 2k26 MEELAD FEST';
    const boardName = db.settings.boardName || 'KALIMA 2k26 MEELAD FEST';

    const bodyHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; color: #1f2937;">
        <div style="text-align: center; margin-bottom: 24px; border-bottom: 3px double #15803d; padding-bottom: 16px;">
          <h1 style="margin: 0; color: #15803d; font-size: 26px; font-weight: bold;">${eventName}</h1>
          <h2 style="margin: 6px 0 0; color: #b45309; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">${boardName}</h2>
          <p style="margin: 6px 0 0; color: #4b5563; font-size: 13px; font-weight: 600;">Official Competition Program Sheet</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px;">
          <thead>
            <tr style="background-color: #15803d; color: white;">
              <th style="padding: 10px 8px; border: 1px solid #d1d5db; text-align: left; width: 90px;">Program Code</th>
              <th style="padding: 10px 8px; border: 1px solid #d1d5db; text-align: left;">Program Name</th>
              <th style="padding: 10px 8px; border: 1px solid #d1d5db; text-align: left; width: 100px;">Gender</th>
              <th style="padding: 10px 8px; border: 1px solid #d1d5db; text-align: left; width: 130px;">Age Category</th>
              <th style="padding: 10px 8px; border: 1px solid #d1d5db; text-align: left; width: 120px;">Program Type</th>
            </tr>
          </thead>
          <tbody>
            ${filteredPrograms.map((p, i) => {
              const genders = Array.from(new Set(p.categories.map(c => c.gender))).join(', ') || 'General';
              const ages = Array.from(new Set(p.categories.map(c => c.age))).join(', ') || 'All';
              const progType = (p.single && p.group) ? 'Single & Group' : p.group ? 'Group' : 'Single';
              return `
                <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                  <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; font-family: monospace; color: #15803d;">${p.code}</td>
                  <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">${p.name}</td>
                  <td style="padding: 8px; border: 1px solid #e5e7eb; font-size: 11px;">${genders}</td>
                  <td style="padding: 8px; border: 1px solid #e5e7eb; font-size: 11px;">${ages}</td>
                  <td style="padding: 8px; border: 1px solid #e5e7eb; font-size: 11px;">${progType}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="margin-top: 30px; font-size: 10px; color: #6b7280; text-align: center; border-t: 1px solid #e5e7eb; padding-top: 10px;">
          Generated on ${new Date().toLocaleDateString()} &bull; Total Programs: ${filteredPrograms.length}
        </div>
      </div>
    `;

    if (onGenerateReport) {
      onGenerateReport('Program_Sheet', 'Official Program Sheet', bodyHTML);
    } else {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`<html><head><title>Program Sheet</title></head><body>${bodyHTML}</body></html>`);
        printWin.document.close();
        printWin.print();
      }
    }
  };

  const handleExportProgramsExcel = () => {
    if (filteredPrograms.length === 0) {
      alert('ℹ️ No programs found matching selected filters.');
      return;
    }

    const wb = XLSX.utils.book_new();
    const rows = [
      ['Program Code', 'Program Name', 'Gender Section', 'Age Category', 'Stage / Venue', 'Day / Date', 'Time Schedule', 'Program Type', 'Max Candidates', 'Enrolled Candidates']
    ];

    filteredPrograms.forEach(p => {
      const genders = Array.from(new Set((p.categories || []).map(c => c.gender))).join(', ') || 'General';
      const ages = Array.from(new Set((p.categories || []).map(c => c.age))).join(', ') || 'All';
      const progType = (p.single && p.group) ? 'Single & Group' : p.group ? 'Group' : 'Single';
      
      const enrolledCount = db.participants.filter(pt => pt.programIds && pt.programIds.includes(p.id)).length;

      rows.push([
        p.code || '—',
        p.name,
        genders,
        ages,
        p.venue ? `${p.stageType || 'Main Stage'} (${p.venue})` : (p.stageType || 'Main Stage'),
        p.day || 'Day 1',
        p.startTime ? `${p.startTime}${p.endTime ? ' - ' + p.endTime : ''}` : (p.schedule || '—'),
        progType,
        p.maxParticipants ? String(p.maxParticipants) : 'Unlimited',
        String(enrolledCount)
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 }, // Code
      { wch: 32 }, // Name
      { wch: 16 }, // Gender
      { wch: 18 }, // Age Category
      { wch: 22 }, // Stage / Venue
      { wch: 12 }, // Day
      { wch: 22 }, // Time Schedule
      { wch: 16 }, // Type
      { wch: 16 }, // Max
      { wch: 20 }  // Enrolled Count
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Program Sheet');
    const fileName = `Program_List_Sheet_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="view active pb-20 max-w-2xl mx-auto space-y-4">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-gold-500 animate-pulse" />
          <h2 className="font-display font-bold text-brand-green-950 text-base md:text-lg">
            Academic Competition Programs
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportProgramsExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all"
            title="Download complete program sheet as Microsoft Excel (.xlsx) file"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>📊 Download Excel Sheet (.xlsx)</span>
          </button>
          <button
            onClick={handlePrintProgramSheet}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-green-900 hover:bg-brand-green-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all"
            title="Print or view printable PDF program sheet"
          >
            <Printer className="w-3.5 h-3.5 text-brand-gold-400" />
            <span>🖨️ Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Program Count Summary Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={() => setSelectedStageType('All')}
          className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
            selectedStageType === 'All'
              ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-md ring-2 ring-brand-gold-400/50'
              : 'bg-brand-panel text-brand-ink border-brand-line hover:border-brand-gold-400/50 shadow-2xs'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
            selectedStageType === 'All' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            🌐
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${
              selectedStageType === 'All' ? 'text-brand-gold-300' : 'text-brand-ink-soft'
            }`}>
              All Programs
            </span>
            <span className={`text-base font-extrabold leading-none ${
              selectedStageType === 'All' ? 'text-white' : 'text-brand-green-900'
            }`}>
              {totalProgramCount}
            </span>
          </div>
        </button>

        <button
          onClick={() => setSelectedStageType('Main Stage')}
          className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
            selectedStageType === 'Main Stage'
              ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-md ring-2 ring-brand-gold-400/50'
              : 'bg-brand-panel text-brand-ink border-brand-line hover:border-brand-gold-400/50 shadow-2xs'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
            selectedStageType === 'Main Stage' ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-800'
          }`}>
            🎭
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${
              selectedStageType === 'Main Stage' ? 'text-brand-gold-300' : 'text-brand-ink-soft'
            }`}>
              Main Stage
            </span>
            <span className={`text-base font-extrabold leading-none ${
              selectedStageType === 'Main Stage' ? 'text-white' : 'text-brand-green-900'
            }`}>
              {mainStageCount}
            </span>
          </div>
        </button>

        <button
          onClick={() => setSelectedStageType('Offstage')}
          className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
            selectedStageType === 'Offstage'
              ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-md ring-2 ring-brand-gold-400/50'
              : 'bg-brand-panel text-brand-ink border-brand-line hover:border-brand-gold-400/50 shadow-2xs'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
            selectedStageType === 'Offstage' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
          }`}>
            📝
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${
              selectedStageType === 'Offstage' ? 'text-brand-gold-300' : 'text-brand-ink-soft'
            }`}>
              Off Stage
            </span>
            <span className={`text-base font-extrabold leading-none ${
              selectedStageType === 'Offstage' ? 'text-white' : 'text-brand-green-900'
            }`}>
              {offStageCount}
            </span>
          </div>
        </button>

        <button
          onClick={() => setSelectedStageType('General')}
          className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
            selectedStageType === 'General'
              ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-md ring-2 ring-brand-gold-400/50'
              : 'bg-brand-panel text-brand-ink border-brand-line hover:border-brand-gold-400/50 shadow-2xs'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
            selectedStageType === 'General' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
          }`}>
            🌟
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${
              selectedStageType === 'General' ? 'text-brand-gold-300' : 'text-brand-ink-soft'
            }`}>
              General
            </span>
            <span className={`text-base font-extrabold leading-none ${
              selectedStageType === 'General' ? 'text-white' : 'text-brand-green-900'
            }`}>
              {generalCount}
            </span>
          </div>
        </button>
      </div>

      {/* Searchbar */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search team name, program code, candidate, venue..."
          className="w-full pl-11 pr-10 py-3 bg-brand-panel border border-brand-line rounded-2xl text-xs md:text-sm text-brand-ink placeholder:text-brand-ink-soft/60 focus:outline-none focus:border-brand-gold-500 transition-colors shadow-sm"
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

      {/* Filter Chips - Teams */}
      {db.teams && db.teams.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-brand-gold-700 tracking-wider uppercase px-1">
            Filter By Team
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 select-none scrollbar-none">
            <button
              onClick={() => setSelectedTeam('All')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border cursor-pointer transition-all ${
                selectedTeam === 'All'
                  ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-sm'
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
                    ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-sm'
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

      {/* Stage & Category Location Tabs */}
      <div className="bg-brand-panel border border-brand-line rounded-2xl p-1.5 flex gap-1 shadow-sm select-none overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSelectedStageType('All')}
          className={`flex-1 min-w-[70px] py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center border leading-tight ${
            selectedStageType === 'All'
              ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-sm'
              : 'bg-transparent text-brand-ink-soft border-transparent hover:bg-brand-bg hover:border-brand-line/50'
          }`}
        >
          🌐 All ({totalProgramCount})
        </button>
        <button
          onClick={() => setSelectedStageType('Main Stage')}
          className={`flex-1 min-w-[90px] py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center border leading-tight ${
            selectedStageType === 'Main Stage'
              ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-sm'
              : 'bg-transparent text-brand-ink-soft border-transparent hover:bg-brand-bg hover:border-brand-line/50'
          }`}
          title="Events conducted on main stage"
        >
          🎭 Main Stage ({mainStageCount})
        </button>
        <button
          onClick={() => setSelectedStageType('Offstage')}
          className={`flex-1 min-w-[80px] py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center border leading-tight ${
            selectedStageType === 'Offstage'
              ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-sm'
              : 'bg-transparent text-brand-ink-soft border-transparent hover:bg-brand-bg hover:border-brand-line/50'
          }`}
          title="Events conducted in classrooms / offstage"
        >
          📝 Offstage ({offStageCount})
        </button>
        <button
          onClick={() => setSelectedStageType('General')}
          className={`flex-1 min-w-[75px] py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center border leading-tight ${
            selectedStageType === 'General'
              ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-sm'
              : 'bg-transparent text-brand-ink-soft border-transparent hover:bg-brand-bg hover:border-brand-line/50'
          }`}
          title="General competition programs open to all"
        >
          🌟 General ({generalCount})
        </button>
      </div>

      {/* Gender Filters */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-brand-gold-700 tracking-wider uppercase px-1">
          Sections
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 select-none scrollbar-none">
          {['All', ...GENDERS].map(g => (
            <button
              key={g}
              onClick={() => setSelectedGender(g as any)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border cursor-pointer transition-all ${
                selectedGender === g
                  ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-sm'
                  : 'bg-brand-panel text-brand-ink-soft border-brand-line hover:border-brand-gold-400/50'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Age Filters */}
      {selectedGender !== 'General' && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-brand-gold-700 tracking-wider uppercase px-1">
            Age Divisions
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 select-none scrollbar-none">
            {['All', ...AGES].map(a => (
              <button
                key={a}
                onClick={() => setSelectedAge(a as any)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border cursor-pointer transition-all ${
                  selectedAge === a
                    ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-sm'
                    : 'bg-brand-panel text-brand-ink-soft border-brand-line hover:border-brand-gold-400/50'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Program List */}
      {filteredPrograms.length === 0 ? (
        <div className="p-12 bg-brand-panel border border-brand-line rounded-2xl text-center space-y-1 shadow-sm select-none">
          <div className="text-3xl">📋</div>
          <b className="block text-xs text-brand-ink font-bold">No programs loaded</b>
          <p className="text-[10px] text-brand-ink-soft max-w-xs mx-auto">
            Try adjusting your section or category filters to find the competition program.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredPrograms.map(p => {
            return (
              <div 
                key={p.id}
                className="bg-brand-panel border border-brand-line rounded-2xl p-4.5 shadow-sm space-y-3 hover:shadow transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[9px] font-extrabold bg-brand-green-100 text-brand-green-800 px-2.5 py-0.5 rounded">
                        {p.code}
                      </span>
                      {p.stageType === 'Offstage' ? (
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-sans">
                          📝 Offstage / Classroom
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-sans">
                          🎭 Main Stage
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-xs md:text-sm text-brand-ink mt-1.5">
                      {p.name}
                    </h3>
                  </div>
                </div>

                {/* Subcategory criteria */}
                <div className="flex flex-wrap gap-1.5">
                  {p.categories.map((cat, idx) => {
                    const tagClass = cat.gender === 'Boys' 
                      ? 'bg-sky-100 text-sky-950 border border-sky-300 font-extrabold' 
                      : cat.gender === 'Girls' 
                        ? 'bg-pink-100 text-pink-950 border border-pink-300 font-extrabold' 
                        : 'bg-purple-100 text-purple-950 border border-purple-300 font-extrabold';
                    return (
                      <span key={idx} className={`text-[10px] px-2.5 py-0.5 rounded-full ${tagClass}`}>
                        {GENDER_ICONS[cat.gender]} {cat.gender}
                        {cat.age !== 'All' ? `  •  ${AGE_ICONS[cat.age]} ${cat.age}` : ''}
                      </span>
                    );
                  })}
                </div>

                {/* Type tags */}
                <div className="flex gap-2">
                  {p.single && (
                    <span className="text-[9px] font-bold bg-brand-gold-100 text-brand-gold-700 px-2 py-0.5 rounded">
                      Single Entry
                    </span>
                  )}
                  {p.group && (
                    <span className="text-[9px] font-bold bg-brand-gold-100 text-brand-gold-700 px-2 py-0.5 rounded">
                      Group Entry
                    </span>
                  )}
                </div>

                {/* Meta details list */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-[10px] text-brand-ink-soft bg-brand-bg/55 p-3 rounded-xl border border-brand-line/50">
                  <div className="flex flex-wrap items-center gap-2 col-span-1 md:col-span-2 bg-brand-green-50/60 p-2 rounded-lg border border-brand-green-100 text-brand-green-950">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-brand-green-800 shrink-0" />
                      <span className="font-bold">{p.day || 'Day 1'}</span>
                    </div>
                    <span>&bull;</span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-brand-green-800 shrink-0" />
                      <span className="font-bold">{p.startTime ? `${p.startTime}${p.endTime ? ' - ' + p.endTime : ''}` : (p.schedule || 'Schedule Pending')}</span>
                    </div>
                    {p.venue && (
                      <>
                        <span>&bull;</span>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-brand-gold-600 shrink-0" />
                          <span className="font-bold">{p.venue}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Category-Wise Time Slots */}
                  {p.categorySchedules && Object.keys(p.categorySchedules).length > 0 && (
                    <div className="col-span-1 md:col-span-2 space-y-1.5 pt-1 border-t border-brand-line/40">
                      <span className="text-[10px] font-extrabold text-brand-green-900 flex items-center gap-1">
                        ⏱️ Category Time & Stage Slots:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {Object.entries(p.categorySchedules).map(([catAge, sched]) => (
                          <div key={catAge} className="p-1.5 bg-brand-green-50/80 rounded-lg border border-brand-green-200/60 text-[10px]">
                            <div className="flex items-center justify-between font-bold text-brand-green-950">
                              <span>{catAge}</span>
                              <span className="text-brand-gold-700 font-extrabold">{sched.startTime || 'Pending'}</span>
                            </div>
                            {(sched.venue || sched.day) && (
                              <div className="text-[9px] text-brand-ink-soft mt-0.5 font-medium">
                                {sched.venue && <span>📍 {sched.venue}</span>}
                                {sched.venue && sched.day && <span> &bull; </span>}
                                {sched.day && <span>📅 {sched.day}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {p.schedule && (
                    <div className="flex items-center gap-1.5 text-brand-ink-soft col-span-1 md:col-span-2 text-[9px] italic">
                      <span>Schedule Note:</span> <span>{p.schedule}</span>
                    </div>
                  )}

                  {p.maxParticipants !== null && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-brand-gold-600 shrink-0" />
                      <span>Max Candidates: {p.maxParticipants}</span>
                    </div>
                  )}
                </div>

                {p.description && (
                  <div className="text-[10px] text-brand-ink-soft leading-relaxed flex gap-1.5 border-t border-brand-line/30 pt-2.5">
                    <FileText className="w-3.5 h-3.5 text-brand-ink-soft/40 shrink-0 mt-0.5" />
                    <p>{p.description}</p>
                  </div>
                )}

                {/* Candidate List & Stage Call Print Section */}
                {(() => {
                  const enrolledParts = db.participants.filter(pt => pt.programIds && pt.programIds.includes(p.id));
                  const isExpanded = expandedProgId === p.id;

                  const availableCats = Array.from(new Set([
                    ...p.categories.map(c => c.age),
                    ...enrolledParts.map(pt => pt.category || pt.age).filter(Boolean) as string[]
                  ]));

                  const currentCat = selectedPrintCat[p.id] || 'All';
                  const currentGender = selectedPrintGender[p.id] || 'All';

                  let displayEnrolled = enrolledParts;
                  if (currentCat !== 'All') {
                    displayEnrolled = displayEnrolled.filter(pt => (pt.category || pt.age) === currentCat);
                  }
                  if (currentGender !== 'All') {
                    displayEnrolled = displayEnrolled.filter(pt => (pt.gender || 'General') === currentGender);
                  }

                  const boysCount = enrolledParts.filter(pt => pt.gender === 'Boys').length;
                  const girlsCount = enrolledParts.filter(pt => pt.gender === 'Girls').length;
                  const genCount = enrolledParts.filter(pt => !pt.gender || pt.gender === 'General').length;

                  return (
                    <div className="pt-2 border-t border-brand-line/40 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedProgId(isExpanded ? null : p.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-brand-green-800 hover:text-brand-green-950 bg-brand-green-50/80 hover:bg-brand-green-100/80 border border-brand-green-200/80 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                        >
                          <Users className="w-3.5 h-3.5 text-brand-green-700" />
                          <span>👥 Candidates ({enrolledParts.length})</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {availableCats.length > 0 && (
                            <select
                              value={currentCat}
                              onChange={(e) => setSelectedPrintCat(prev => ({ ...prev, [p.id]: e.target.value }))}
                              className="px-2.5 py-1.5 bg-brand-bg border border-brand-line rounded-xl text-xs font-bold text-brand-green-900 focus:outline-none focus:border-brand-gold-500 cursor-pointer shadow-xs"
                              title="Select Category to Filter"
                            >
                              <option value="All">🏷️ All Categories ({enrolledParts.length})</option>
                              {availableCats.map(cat => {
                                const count = enrolledParts.filter(pt => (pt.category || pt.age) === cat).length;
                                return (
                                  <option key={cat} value={cat}>
                                    📌 {cat} ({count})
                                  </option>
                                );
                              })}
                            </select>
                          )}

                          <select
                            value={currentGender}
                            onChange={(e) => setSelectedPrintGender(prev => ({ ...prev, [p.id]: e.target.value }))}
                            className="px-2.5 py-1.5 bg-brand-bg border border-brand-line rounded-xl text-xs font-bold text-brand-green-900 focus:outline-none focus:border-brand-gold-500 cursor-pointer shadow-xs"
                            title="Select Gender to Separate Boys & Girls"
                          >
                            <option value="All">🚻 All Genders ({enrolledParts.length})</option>
                            <option value="Boys">👦 Boys Only ({boysCount})</option>
                            <option value="Girls">👧 Girls Only ({girlsCount})</option>
                            {genCount > 0 && <option value="General">🚻 General ({genCount})</option>}
                          </select>

                          <button
                            type="button"
                            onClick={() => handlePrintProgramJudgeSheet(p, currentCat, currentGender)}
                            className="flex items-center gap-1.5 text-xs font-extrabold text-white bg-brand-green-900 hover:bg-brand-green-800 border border-brand-green-950 px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                            title="Print Stage Judge Call Sheet & Evaluation Form"
                          >
                            <Printer className="w-3.5 h-3.5 text-brand-gold-400" />
                            <span>🖨️ Print Call Sheet</span>
                          </button>
                        </div>
                      </div>

                      {/* Expandable Candidates List */}
                      {isExpanded && (
                        <div className="bg-brand-bg/70 border border-brand-line rounded-xl p-3 space-y-2 text-xs">
                          <div className="flex items-center justify-between border-b border-brand-line/60 pb-1.5">
                            <span className="font-bold text-brand-green-950 text-[11px] uppercase tracking-wider">
                              Candidates ({displayEnrolled.length} {currentCat !== 'All' ? `• ${currentCat}` : ''} {currentGender !== 'All' ? `• ${currentGender}` : ''})
                            </span>
                            <span className="text-[10px] text-brand-ink-soft">
                              Sorted by Chest No.
                            </span>
                          </div>

                          {displayEnrolled.length === 0 ? (
                            <p className="text-[11px] text-brand-ink-soft italic text-center py-2">
                              No candidates enrolled matching criteria.
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-[11px] border-collapse">
                                <thead>
                                  <tr className="border-b border-brand-line/80 text-brand-ink-soft font-bold text-[10px] uppercase">
                                    <th className="py-1 px-1.5">Chest No</th>
                                    <th className="py-1 px-1.5">Name</th>
                                    <th className="py-1 px-1.5">Team</th>
                                    <th className="py-1 px-1.5">Gender</th>
                                    <th className="py-1 px-1.5">Category</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {displayEnrolled
                                    .sort((a, b) => (parseInt(a.chestNo || a.number || '0', 10) - parseInt(b.chestNo || b.number || '0', 10)))
                                    .map(pt => {
                                      const team = db.teams.find(t => t.id === pt.teamId);
                                      const isGirl = pt.gender === 'Girls';
                                      return (
                                        <tr key={pt.id} className="border-b border-brand-line/30 hover:bg-white/50">
                                          <td className="py-1.5 px-1.5 font-mono font-bold text-brand-green-800">
                                            {pt.chestNo || pt.number || '—'}
                                          </td>
                                          <td className="py-1.5 px-1.5 font-bold text-brand-ink">
                                            {pt.name}
                                          </td>
                                          <td className="py-1.5 px-1.5 text-brand-ink-soft text-[10.5px]">
                                            {team ? team.name : '—'}
                                          </td>
                                          <td className="py-1.5 px-1.5 font-semibold text-[10.5px]">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isGirl ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}`}>
                                              {isGirl ? '👧 Girls' : '👦 Boys'}
                                            </span>
                                          </td>
                                          <td className="py-1.5 px-1.5 text-[10px] text-brand-ink-soft">
                                            {pt.category || pt.age || '—'} {pt.cls ? `(${pt.cls})` : ''}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
