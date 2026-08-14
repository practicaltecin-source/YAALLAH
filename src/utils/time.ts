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

export type ProgramScheduleStatus = 'COMPLETED' | 'PASSED' | 'LIVE' | 'UPCOMING';

export function getProgramScheduleStatus(p: Program, results: Result[]): ProgramScheduleStatus {
  // 1. If result is already published for this program
  if (results && results.some(r => r.programId === p.id)) {
    return 'COMPLETED';
  }

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  // 2. Check date in p.day if formatted as DD/MM/YYYY or YYYY-MM-DD
  if (p.day) {
    const dateMatch = p.day.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dateMatch) {
      const dayNum = parseInt(dateMatch[1], 10);
      const monthNum = parseInt(dateMatch[2], 10) - 1;
      const yearNum = parseInt(dateMatch[3], 10);
      const pDate = new Date(yearNum, monthNum, dayNum);
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (pDate.getTime() < todayDate.getTime()) {
        return 'PASSED';
      }
      if (pDate.getTime() > todayDate.getTime()) {
        return 'UPCOMING';
      }
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
