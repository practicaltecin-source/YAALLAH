import { Program, Result } from '../types';

export function parseTimeStringToMinutes(timeStr?: string): number | null {
  if (!timeStr || !timeStr.trim()) return null;
  const str = timeStr.trim().toUpperCase();
  const match = str.match(/(\d{1,2})[:.](\d{2})\s*(AM|PM)?/);
  if (!match) {
    const simple = str.match(/(\d{1,2})\s*(AM|PM)/);
    if (simple) {
      let h = parseInt(simple[1], 10);
      const ampm = simple[2];
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h * 60;
    }
    return null;
  }
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

export function parseDateString(dayStr?: string): Date | null {
  if (!dayStr || !dayStr.trim()) return null;
  const str = dayStr.trim();

  // 1. ISO YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    return new Date(y, m, d);
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    return new Date(y, m, d);
  }

  // 3. Fallback date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && str.length >= 8) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  return null;
}

export type ProgramScheduleStatus = 'COMPLETED' | 'PASSED' | 'LIVE' | 'UPCOMING';

export function getProgramScheduleStatus(p: Program, results: Result[]): ProgramScheduleStatus {
  // 1. If result is already published for this program
  if (results && results.some(r => r.programId === p.id)) {
    return 'COMPLETED';
  }

  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentMins = now.getHours() * 60 + now.getMinutes();

  // 2. Check date in p.day or p.schedule
  const progDate = parseDateString(p.day) || parseDateString(p.schedule);
  if (progDate) {
    if (progDate.getTime() < todayDate.getTime()) {
      // Past day: event already concluded on yesterday or earlier!
      return 'PASSED';
    }
    if (progDate.getTime() > todayDate.getTime()) {
      // Future day: event is scheduled for tomorrow or future!
      return 'UPCOMING';
    }
  }

  // 3. Same day or unspecified date: check startTime & endTime
  const startMins = parseTimeStringToMinutes(p.startTime);
  const endMins = parseTimeStringToMinutes(p.endTime);

  if (startMins !== null) {
    const finishMins = endMins !== null ? endMins : startMins + 90; // Default 90 min window
    if (currentMins > finishMins) {
      return 'PASSED';
    } else if (currentMins >= startMins - 15 && currentMins <= finishMins) {
      return 'LIVE';
    } else if (currentMins < startMins - 15) {
      return 'UPCOMING';
    }
  }

  return 'UPCOMING';
}
