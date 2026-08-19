export interface Team {
  id: string;
  name: string;
  symbol: string;
  logoUrl?: string;
  color: string;
  captain: string;
  viceCaptain?: string;
  boysCaptain?: string;
  boysCaptain2?: string;
  girlsCaptain?: string;
  girlsCaptain2?: string;
  points: number;
}

export interface ProgramCategory {
  gender: 'Boys' | 'Girls' | 'General';
  age: 'Kids' | 'Sub Junior' | 'Junior' | 'Senior' | 'Super Senior' | 'All' | 'General';
}

export interface Program {
  id: string;
  code: string;
  name: string;
  day: string; // ISO date string or custom day name
  venue: string;
  startTime: string; // "HH:MM" 24h format
  endTime: string; // "HH:MM" 24h format
  duration: string; // e.g., "10 min"
  description: string;
  maxParticipants: number | null;
  single: boolean;
  group: boolean;
  categories: ProgramCategory[];
  stageType?: 'Main Stage' | 'Offstage';
  schedule?: string;
  categorySchedules?: Record<string, { day?: string; venue?: string; startTime?: string; endTime?: string; stageType?: string }>;
}

export interface Participant {
  id: string;
  number: string;
  chestNo?: string;
  name: string;
  cls: string; // 1-12
  division: string; // A-F
  teamId: string | null;
  gender: 'Boys' | 'Girls' | 'General';
  age: 'Kids' | 'Sub Junior' | 'Junior' | 'Senior' | 'Super Senior';
  category?: string;
  programIds: string[];
}

export interface CandidateResultEntry {
  name: string;
  teamId: string | null;
  description?: string;
}

export interface Winners {
  first: CandidateResultEntry[];
  second: CandidateResultEntry[];
  third: CandidateResultEntry[];
}

export interface Grades {
  gradeA: CandidateResultEntry[];
  gradeB: CandidateResultEntry[];
  gradeC: CandidateResultEntry[];
  participation: CandidateResultEntry[];
}

export interface Result {
  id: string;
  programId: string;
  gender: 'Boys' | 'Girls' | 'General';
  age: 'Kids' | 'Sub Junior' | 'Junior' | 'Senior' | 'Super Senior' | 'All';
  winners: Winners;
  grades: Grades;
  datetime: string; // ISO string
}

export interface PointsSettings {
  first: number;
  second: number;
  third: number;
  generalFirst?: number;
  generalSecond?: number;
  generalThird?: number;
  participation: number;
  gradeA: number;
  gradeB: number;
  gradeC: number;
}

export interface NoticeItem {
  id: string;
  title: string;
  text: string;
  type: 'urgent' | 'important' | 'info' | 'general' | 'sponsor';
  date?: string;
  active?: boolean;
  imageUrl?: string;
  sponsorName?: string;
  linkUrl?: string;
}

export interface QuizQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  options?: string[];
  status: 'DRAFT' | 'ACTIVE' | 'ANSWER_REVEALED' | 'WINNER_ANNOUNCED' | 'COMPLETED';
  correctAnswer?: string;
  winnerName?: string;
  winnerDetails?: string; // e.g. "Chest #204 / Team KAAF / Class 9"
  winnerPrize?: string; // e.g. "Special Memento & Cash Prize"
  sponsorName?: string; // e.g. "Sponsored by Al-Noor Traders"
  createdAt: string;
  revealedAt?: string;
  winnerAnnouncedAt?: string;
}

export interface Settings {
  points: PointsSettings;
  adminPassword: string;
  adminPin: string;
  eventName?: string;
  boardName?: string;
  subtitle?: string;
  eventLogo?: string;
  showFinalWinner?: boolean;
  skipPodiumCountdown?: boolean;
  isLiveCelebrationActive?: boolean;
  showTeamTicker?: boolean;
  showAlwaysTeamBanner?: boolean;
  showTeamPointsInBanner?: boolean;
  showTeamAnalyticsGraph?: boolean;
  showLeadingTeamPopup?: boolean;
  showSpotlightSlider?: boolean;
  suspenseSwapMode?: boolean;
  isPublicSiteOffline?: boolean;
  offlineMessage?: string;
  suspenseIntervalSec?: number;
  podiumBgUrl?: string;
  podiumBgOpacity?: number;
  revealPodiumTime?: number;
  confettiUntil?: number;
  showScoreboard?: boolean;
  showResults?: boolean;
  hideTeamPoints?: boolean;
  showHomeResultsAndSpotlight?: boolean;
  showCandidatePoints?: boolean;
  showDetailedScoreboard?: boolean;
  showIndividualChampions?: boolean;
  showNotice?: boolean;
  noticeTitle?: string;
  noticeText?: string;
  notices?: NoticeItem[];
  noticePopupOnLoad?: boolean;
  noticeDurationSecs?: number;
  showLiveQuiz?: boolean;
  colorTheme?: 'natural' | 'outdoor-light' | 'outdoor-dark' | 'solar-high-contrast' | 'royal-gold' | 'emerald-luxury' | 'crimson-ruby' | 'ocean-breeze';
  googleSheetId?: string;
  sheetWebhookUrl?: string;
  appsScriptUrl?: string;
  githubToken?: string;
  githubRepo?: string;
}

export interface Database {
  teams: Team[];
  programs: Program[];
  participants: Participant[];
  results: Result[];
  settings: Settings;
  prevRanks: Record<string, number>;
  lastModified: number;
  isExplicitReset?: boolean;
  quizzes?: QuizQuestion[];
}

export type ViewName = 'home' | 'results' | 'scoreboard' | 'programs' | 'candidateSearch' | 'categories' | 'quiz' | 'about' | 'settings' | 'adminGate' | 'dashboard';

export type AdminTab = 'teams' | 'programs' | 'participants' | 'results' | 'schedules' | 'quizzes';
