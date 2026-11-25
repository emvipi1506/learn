export type SkillType = 'listening' | 'reading' | 'writing' | 'speaking';

export type StudyLanguage = 'en' | 'ko';

export type NavTab =
  | 'dashboard'
  | 'roadmap'
  | 'listening'
  | 'reading'
  | 'writing'
  | 'speaking'
  | 'vocab'
  | 'settings';

export type ActNumber = 1 | 2 | 3 | 4;

export interface SkillBands {
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email?: string;
  currentBand: number;
  targetBand: number;
  dailyMinutes: number;
  xp: number;
  level: number;
  streakDays: number;
  lastStudyDate: string;
  currentAct: ActNumber;
  placementCompleted: boolean;
  skillBands: SkillBands;
}

export interface LessonProgressRecord {
  lessonId: string;
  skill: SkillType;
  score: number; // 0 - 100
  completedAt: string;
}

export interface VocabItem {
  id: string;
  lang?: StudyLanguage; // Mặc định 'en' nếu không khai báo
  lessonNum?: number; // Số bài giáo trình (VD: Bài 6..20 Sejong 1)
  word: string;
  ipa: string;
  romanization?: string; // Phiên âm Latinh cho tiếng Hàn
  pos: string;
  meaningVi: string;
  exampleEn: string; // Câu ví dụ theo ngôn ngữ gốc của thẻ (EN hoặc KO)
  exampleVi: string;
  paraphrases: string[];
  grammarNoteVi?: string; // Ghi chú ngữ pháp ngắn / cách chia đuôi
  act: ActNumber;
  topic: string;
  isCustom?: boolean;
}

export interface VocabSRSState {
  wordId: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string; // ISO string
  lastReviewedAt?: string;
}

export interface ListeningQuestion {
  id: string;
  type: 'mcq' | 'fill';
  prompt: string;
  options?: string[];
  answer: string;
  explanationVi: string;
}

export interface ListeningLesson {
  id: string;
  act: ActNumber;
  bandTarget: string;
  title: string;
  subtitle: string;
  mode: 'dictation' | 'ielts-part';
  accent: 'en-GB' | 'en-US';
  durationLabel: string;
  xpReward: number;
  transcriptLines: {
    speaker: string;
    en: string;
    vi: string;
  }[];
  dictationTarget?: string;
  questions: ListeningQuestion[];
}

export interface ReadingQuestion {
  id: string;
  type: 'tfng' | 'mcq';
  prompt: string;
  options: string[];
  answer: string;
  evidenceQuote: string;
  explanationVi: string;
}

export interface ReadingLesson {
  id: string;
  act: ActNumber;
  bandTarget: string;
  title: string;
  topic: string;
  readingMinutes: number;
  xpReward: number;
  paragraphs: string[];
  glossary: Record<string, { ipa: string; meaningVi: string; vocabId?: string }>;
  questions: ReadingQuestion[];
}

export interface WritingLesson {
  id: string;
  act: ActNumber;
  bandTarget: string;
  taskType: 'Foundation' | 'Task 1' | 'Task 2';
  title: string;
  promptEn: string;
  promptVi: string;
  minWords: number;
  recommendedMinutes: number;
  xpReward: number;
  outlineVi: string[];
  usefulPhrases: { en: string; vi: string }[];
  sampleAnswer: string;
  sampleHighlightsVi: string[];
  checklistVi: string[];
}

export interface SpeakingLesson {
  id: string;
  act: ActNumber;
  bandTarget: string;
  part: 'Foundation' | 'Part 1' | 'Part 2' | 'Part 3';
  title: string;
  topic: string;
  prepSeconds: number;
  speakSeconds: number;
  xpReward: number;
  questions: string[];
  cueCardBullets?: string[];
  sampleAnswerEn: string;
  sampleAnswerVi: string;
  keyVocab: { word: string; ipa: string; meaningVi: string }[];
  tipsVi: string[];
}

export interface AIFeedbackResult {
  overallBand: number;
  criteria: {
    name: string;
    score: number;
    commentVi: string;
  }[];
  strengthsVi: string[];
  improvementsVi: string[];
  upgradedVersionEn: string;
  encouragementVi: string;
  transcriptEn?: string;
}

export interface PracticeSubmission {
  id: string;
  skill: 'writing' | 'speaking';
  promptId: string;
  promptTitle: string;
  content: string;
  bandEstimate: number;
  aiFeedback?: AIFeedbackResult;
  createdAt: string;
}

export interface DailyProgress {
  date: string; // YYYY-MM-DD
  minutesStudied: number;
  vocabReviewed: number;
  lessonsCompleted: number;
  completedQuests: string[];
}

export interface ActInfo {
  act: ActNumber;
  roman: string;
  name: string;
  fantasyTitle: string;
  bandRange: string;
  durationMonths: string;
  goalVi: string;
  milestones: string[];
  dailySplit: string;
}

export interface PlacementQuestion {
  id: string;
  skillLabel: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  weight: number;
}
