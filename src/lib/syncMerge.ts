import { DAILY_QUESTS, getXpForNextLevel, roundIeltsBand } from '../data/roadmap';
import type {
  ActNumber,
  DailyProgress,
  LessonProgressRecord,
  PracticeSubmission,
  SkillBands,
  SkillType,
  UserProfile,
  VocabItem,
  VocabSRSState,
} from '../types';

export interface PersistedState {
  profile: UserProfile;
  lessonProgress: Record<string, LessonProgressRecord>;
  vocabSRS: Record<string, VocabSRSState>;
  savedVocabIds: string[];
  starterSeeded: boolean;
  customVocab: VocabItem[];
  submissions: PracticeSubmission[];
  daily: DailyProgress;
  updatedAt?: string;
}

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_V4_REGEX.test(value);
}

/**
 * Sinh UUID v4 hợp lệ (tương thích trực tiếp với cột uuid của bảng practice_submissions trên Supabase)
 */
export function generateSubmissionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getTodayStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createFreshDaily(today: string = getTodayStr()): DailyProgress {
  return {
    date: today,
    minutesStudied: 0,
    vocabReviewed: 0,
    lessonsCompleted: 0,
    completedQuests: [],
  };
}

export function applyXpGain(
  prevProfile: UserProfile,
  gainedXp: number,
  today: string = getTodayStr()
): UserProfile {
  const safeGain = Math.max(0, Math.round(gainedXp));
  let xp = Math.max(0, prevProfile.xp) + safeGain;
  let level = Math.max(1, prevProfile.level);
  while (xp >= getXpForNextLevel(level)) {
    xp -= getXpForNextLevel(level);
    level += 1;
  }

  let streakDays = Math.max(1, prevProfile.streakDays);
  if (prevProfile.lastStudyDate !== today) {
    const prevDate = new Date(`${prevProfile.lastStudyDate}T00:00:00`);
    const nowDate = new Date(`${today}T00:00:00`);
    const diffDays = Math.round((nowDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    streakDays = diffDays === 1 ? streakDays + 1 : 1;
  }

  return {
    ...prevProfile,
    xp,
    level,
    streakDays,
    lastStudyDate: today,
  };
}

/**
 * Tính tổng XP thưởng thêm cho các Daily Quests vừa mới hoàn thành lần đầu trong ngày
 */
export function computeNewlyCompletedQuestXp(
  prevCompletedQuests: string[],
  nextCompletedQuests: string[]
): number {
  const prevSet = new Set(prevCompletedQuests);
  let bonusXp = 0;
  for (const quest of DAILY_QUESTS) {
    if (nextCompletedQuests.includes(quest.id) && !prevSet.has(quest.id)) {
      bonusXp += quest.xp;
    }
  }
  return bonusXp;
}

function toTimestamp(iso?: string): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function compareProgressLevelXp(
  a: Pick<UserProfile, 'level' | 'xp'>,
  b: Pick<UserProfile, 'level' | 'xp'>
): number {
  if (a.level !== b.level) return a.level - b.level;
  return a.xp - b.xp;
}

function isValidAct(val: unknown): val is ActNumber {
  return val === 1 || val === 2 || val === 3 || val === 4;
}

function isValidSkill(val: unknown): val is SkillType {
  return val === 'listening' || val === 'reading' || val === 'writing' || val === 'speaking';
}

function clampBand(val: unknown, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return roundIeltsBand(num);
}

/**
 * Gộp thông minh 2 chiều (Pull -> Merge -> Push) giữa dữ liệu cục bộ và dữ liệu Supabase.
 * Nguyên tắc: Không bao giờ ghi đè làm mất tiến độ cao hơn hoặc thẻ SRS ôn gần hơn.
 */
export function mergePersistedStates(
  local: PersistedState,
  cloud: Partial<PersistedState>,
  options?: {
    cloudHasProfile?: boolean;
    preferCloudSavedVocab?: boolean;
    today?: string;
  }
): PersistedState {
  const today = options?.today ?? getTodayStr();
  const cloudProfile = cloud.profile;
  const localTs = toTimestamp(local.updatedAt);
  const cloudTs = toTimestamp(cloud.updatedAt);
  const cloudNewer = cloudTs > localTs;
  const localNewer = localTs > cloudTs;

  // 1. Hợp nhất hồ sơ học viên
  let mergedProfile: UserProfile = { ...local.profile };
  if (cloudProfile && options?.cloudHasProfile !== false) {
    const useCloudLevelXp = compareProgressLevelXp(cloudProfile, local.profile) >= 0;
    const mergedSkillBands: SkillBands = {
      listening: Math.max(local.profile.skillBands.listening, cloudProfile.skillBands?.listening ?? 0),
      reading: Math.max(local.profile.skillBands.reading, cloudProfile.skillBands?.reading ?? 0),
      writing: Math.max(local.profile.skillBands.writing, cloudProfile.skillBands?.writing ?? 0),
      speaking: Math.max(local.profile.skillBands.speaking, cloudProfile.skillBands?.speaking ?? 0),
    };

    const newerStudyDate =
      cloudProfile.lastStudyDate > local.profile.lastStudyDate
        ? cloudProfile.lastStudyDate
        : local.profile.lastStudyDate;

    const isLocalDefaultName = local.profile.displayName === 'Học Giả Khởi Nguyên';
    const isCloudDefaultName = cloudProfile.displayName === 'Học Giả Mới';

    mergedProfile = {
      ...local.profile,
      id: cloudProfile.id || local.profile.id,
      email: cloudProfile.email || local.profile.email,
      displayName:
        cloudNewer || (isLocalDefaultName && !isCloudDefaultName)
          ? cloudProfile.displayName || local.profile.displayName
          : local.profile.displayName,
      targetBand: cloudNewer ? cloudProfile.targetBand : local.profile.targetBand,
      dailyMinutes: cloudNewer ? cloudProfile.dailyMinutes : local.profile.dailyMinutes,
      currentAct: cloudNewer
        ? cloudProfile.currentAct
        : (Math.max(local.profile.currentAct, cloudProfile.currentAct) as ActNumber),
      currentBand: Math.max(local.profile.currentBand, cloudProfile.currentBand),
      xp: useCloudLevelXp ? cloudProfile.xp : local.profile.xp,
      level: useCloudLevelXp ? cloudProfile.level : local.profile.level,
      streakDays: Math.max(local.profile.streakDays, cloudProfile.streakDays),
      lastStudyDate: newerStudyDate,
      placementCompleted: local.profile.placementCompleted || cloudProfile.placementCompleted,
      skillBands: mergedSkillBands,
    };
  }

  // 2. Hợp nhất tiến độ bài học (giữ điểm cao hơn; nếu bằng điểm thì giữ thời điểm mới hơn)
  const mergedLessons: Record<string, LessonProgressRecord> = { ...local.lessonProgress };
  if (cloud.lessonProgress) {
    for (const [lessonId, cloudRec] of Object.entries(cloud.lessonProgress)) {
      const localRec = mergedLessons[lessonId];
      if (!localRec) {
        mergedLessons[lessonId] = cloudRec;
      } else {
        const bestScore = Math.max(localRec.score, cloudRec.score);
        const newerCompletedAt =
          toTimestamp(cloudRec.completedAt) >= toTimestamp(localRec.completedAt)
            ? cloudRec.completedAt
            : localRec.completedAt;
        mergedLessons[lessonId] = {
          ...localRec,
          score: bestScore,
          completedAt: newerCompletedAt,
        };
      }
    }
  }

  // 3. Hợp nhất thẻ SRS (giữ bản ghi có lastReviewedAt mới hơn, hoặc repetitions cao hơn nếu chưa có timestamp)
  const mergedSRS: Record<string, VocabSRSState> = { ...local.vocabSRS };
  if (cloud.vocabSRS) {
    for (const [wordId, cloudCard] of Object.entries(cloud.vocabSRS)) {
      const localCard = mergedSRS[wordId];
      if (!localCard) {
        mergedSRS[wordId] = cloudCard;
      } else {
        const cloudTime = toTimestamp(cloudCard.lastReviewedAt);
        const localTime = toTimestamp(localCard.lastReviewedAt);
        if (
          cloudTime > localTime ||
          (cloudTime === localTime && cloudCard.repetitions > localCard.repetitions)
        ) {
          mergedSRS[wordId] = cloudCard;
        }
      }
    }
  }

  // 4. Hợp nhất customVocab theo id (giữ đầy đủ cả 2 máy)
  const customMap = new Map<string, VocabItem>();
  for (const item of cloud.customVocab || []) {
    customMap.set(item.id, { ...item, isCustom: true });
  }
  for (const item of local.customVocab || []) {
    customMap.set(item.id, { ...item, isCustom: true });
  }
  const mergedCustomVocab = Array.from(customMap.values());

  // 5. Hợp nhất savedVocabIds (tôn trọng thao tác bỏ chọn thẻ của người dùng, không tự hồi sinh từ vocabSRS)
  const hasCloudSaved = Array.isArray(cloud.savedVocabIds);
  const localCustomIds = new Set((local.customVocab || []).map((c) => c.id));
  const cloudCustomIds = new Set((cloud.customVocab || []).map((c) => c.id));
  let mergedSavedVocabIds: string[];
  if (hasCloudSaved) {
    if (options?.preferCloudSavedVocab && cloudNewer) {
      const nextSet = new Set<string>(cloud.savedVocabIds);
      for (const id of local.savedVocabIds) {
        if (localCustomIds.has(id) && !cloudCustomIds.has(id)) {
          nextSet.add(id);
        }
      }
      mergedSavedVocabIds = Array.from(nextSet);
    } else if (!options?.preferCloudSavedVocab && localNewer) {
      const nextSet = new Set<string>(local.savedVocabIds);
      for (const id of cloud.savedVocabIds!) {
        if (cloudCustomIds.has(id) && !localCustomIds.has(id)) {
          nextSet.add(id);
        }
      }
      mergedSavedVocabIds = Array.from(nextSet);
    } else {
      const savedSet = new Set<string>(local.savedVocabIds);
      for (const id of cloud.savedVocabIds!) {
        savedSet.add(id);
      }
      mergedSavedVocabIds = Array.from(savedSet);
    }
  } else {
    // Tài khoản cũ trước khi nâng cấp cột saved_vocab_ids: giữ danh sách cục bộ và thẻ SRS từ đám mây
    const savedSet = new Set<string>(local.savedVocabIds);
    for (const wordId of Object.keys(cloud.vocabSRS || {})) {
      savedSet.add(wordId);
    }
    mergedSavedVocabIds = Array.from(savedSet);
  }

  // 6. Hợp nhất submissions theo id & khử trùng bản ghi cũ (sub_...) trùng nội dung trong vòng 2 phút
  const mergedSubmissionList: PracticeSubmission[] = [];
  const seenIds = new Set<string>();
  for (const sub of [...(cloud.submissions || []), ...(local.submissions || [])]) {
    if (sub.id && seenIds.has(sub.id)) continue;
    const subTs = toTimestamp(sub.createdAt);
    const trimmedContent = sub.content.trim();
    const isNearDuplicate = mergedSubmissionList.some(
      (existing) =>
        existing.skill === sub.skill &&
        existing.promptId === sub.promptId &&
        existing.content.trim() === trimmedContent &&
        Math.abs(toTimestamp(existing.createdAt) - subTs) <= 120_000
    );
    if (isNearDuplicate) continue;
    if (sub.id) seenIds.add(sub.id);
    mergedSubmissionList.push(sub);
  }
  const mergedSubmissions = mergedSubmissionList
    .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
    .slice(0, 30);

  // 7. Hợp nhất daily_logs cho ngày hôm nay
  const localDailyToday = local.daily?.date === today ? local.daily : null;
  const cloudDailyToday = cloud.daily?.date === today ? cloud.daily : null;
  let mergedDaily: DailyProgress;
  if (localDailyToday && cloudDailyToday) {
    mergedDaily = {
      date: today,
      minutesStudied: Math.max(localDailyToday.minutesStudied, cloudDailyToday.minutesStudied),
      vocabReviewed: Math.max(localDailyToday.vocabReviewed, cloudDailyToday.vocabReviewed),
      lessonsCompleted: Math.max(localDailyToday.lessonsCompleted, cloudDailyToday.lessonsCompleted),
      completedQuests: Array.from(
        new Set([...localDailyToday.completedQuests, ...cloudDailyToday.completedQuests])
      ),
    };
  } else {
    mergedDaily = localDailyToday || cloudDailyToday || createFreshDaily(today);
  }

  const maxUpdated =
    toTimestamp(cloud.updatedAt) > toTimestamp(local.updatedAt)
      ? cloud.updatedAt
      : local.updatedAt || new Date().toISOString();

  return {
    profile: mergedProfile,
    lessonProgress: mergedLessons,
    vocabSRS: mergedSRS,
    savedVocabIds: mergedSavedVocabIds,
    starterSeeded: Boolean(local.starterSeeded || cloud.starterSeeded),
    customVocab: mergedCustomVocab,
    submissions: mergedSubmissions,
    daily: mergedDaily,
    updatedAt: maxUpdated,
  };
}

/**
 * Kiểm tra chặt chẽ và chuẩn hóa tệp JSON sao lưu trước khi nạp vào state để chống crash ứng dụng
 */
export function sanitizeImportedState(
  raw: unknown,
  current: PersistedState,
  fallback: PersistedState,
  today: string = getTodayStr()
): { ok: true; state: PersistedState } | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: 'Tệp sao lưu không đúng định dạng đối tượng JSON.' };
  }

  const parsed = raw as Record<string, unknown>;
  const rawProfile = parsed.profile;
  if (!rawProfile || typeof rawProfile !== 'object' || Array.isArray(rawProfile)) {
    return { ok: false, message: 'Tệp sao lưu thiếu thông tin hồ sơ (profile).' };
  }

  const p = rawProfile as Record<string, unknown>;
  if (typeof p.xp !== 'number' || !Number.isFinite(p.xp)) {
    return { ok: false, message: 'Tệp sao lưu không hợp lệ (trường xp bị lỗi).' };
  }

  const rawSkillBands =
    p.skillBands && typeof p.skillBands === 'object' && !Array.isArray(p.skillBands)
      ? (p.skillBands as Record<string, unknown>)
      : {};

  const skillBands: SkillBands = {
    listening: clampBand(rawSkillBands.listening, fallback.profile.skillBands.listening),
    reading: clampBand(rawSkillBands.reading, fallback.profile.skillBands.reading),
    writing: clampBand(rawSkillBands.writing, fallback.profile.skillBands.writing),
    speaking: clampBand(rawSkillBands.speaking, fallback.profile.skillBands.speaking),
  };

  const nextProfile: UserProfile = {
    id: current.profile.id,
    email: current.profile.email,
    displayName:
      typeof p.displayName === 'string' && p.displayName.trim()
        ? p.displayName.trim().slice(0, 80)
        : fallback.profile.displayName,
    currentBand: clampBand(p.currentBand, fallback.profile.currentBand),
    targetBand: clampBand(p.targetBand, fallback.profile.targetBand),
    dailyMinutes:
      typeof p.dailyMinutes === 'number' && Number.isFinite(p.dailyMinutes)
        ? Math.max(15, Math.min(480, Math.round(p.dailyMinutes)))
        : fallback.profile.dailyMinutes,
    xp: Math.max(0, Math.round(p.xp)),
    level:
      typeof p.level === 'number' && Number.isFinite(p.level)
        ? Math.max(1, Math.round(p.level))
        : fallback.profile.level,
    streakDays:
      typeof p.streakDays === 'number' && Number.isFinite(p.streakDays)
        ? Math.max(1, Math.round(p.streakDays))
        : fallback.profile.streakDays,
    lastStudyDate:
      typeof p.lastStudyDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.lastStudyDate)
        ? p.lastStudyDate
        : today,
    currentAct: isValidAct(p.currentAct) ? p.currentAct : fallback.profile.currentAct,
    placementCompleted: Boolean(p.placementCompleted),
    skillBands,
  };

  // Validate lessonProgress
  const lessonProgress: Record<string, LessonProgressRecord> = {};
  if (parsed.lessonProgress && typeof parsed.lessonProgress === 'object' && !Array.isArray(parsed.lessonProgress)) {
    for (const [key, val] of Object.entries(parsed.lessonProgress as Record<string, unknown>)) {
      if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
      const rec = val as Record<string, unknown>;
      if (!isValidSkill(rec.skill)) continue;
      lessonProgress[key] = {
        lessonId: typeof rec.lessonId === 'string' ? rec.lessonId : key,
        skill: rec.skill,
        score:
          typeof rec.score === 'number' && Number.isFinite(rec.score)
            ? Math.max(0, Math.min(100, Math.round(rec.score)))
            : 0,
        completedAt: typeof rec.completedAt === 'string' ? rec.completedAt : new Date().toISOString(),
      };
    }
  }

  // Validate vocabSRS
  const vocabSRS: Record<string, VocabSRSState> = {};
  if (parsed.vocabSRS && typeof parsed.vocabSRS === 'object' && !Array.isArray(parsed.vocabSRS)) {
    for (const [key, val] of Object.entries(parsed.vocabSRS as Record<string, unknown>)) {
      if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
      const card = val as Record<string, unknown>;
      const nextReviewAt =
        typeof card.nextReviewAt === 'string' && !Number.isNaN(Date.parse(card.nextReviewAt))
          ? card.nextReviewAt
          : new Date().toISOString();
      vocabSRS[key] = {
        wordId: typeof card.wordId === 'string' ? card.wordId : key,
        easeFactor:
          typeof card.easeFactor === 'number' && Number.isFinite(card.easeFactor)
            ? Math.max(1.3, card.easeFactor)
            : 2.5,
        intervalDays:
          typeof card.intervalDays === 'number' && Number.isFinite(card.intervalDays)
            ? Math.max(0, Math.round(card.intervalDays))
            : 0,
        repetitions:
          typeof card.repetitions === 'number' && Number.isFinite(card.repetitions)
            ? Math.max(0, Math.round(card.repetitions))
            : 0,
        nextReviewAt,
        lastReviewedAt:
          typeof card.lastReviewedAt === 'string' && !Number.isNaN(Date.parse(card.lastReviewedAt))
            ? card.lastReviewedAt
            : undefined,
      };
    }
  }

  // Validate savedVocabIds
  const savedVocabIds = Array.isArray(parsed.savedVocabIds)
    ? Array.from(new Set(parsed.savedVocabIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)))
    : fallback.savedVocabIds;

  // Validate customVocab
  const customVocab: VocabItem[] = [];
  if (Array.isArray(parsed.customVocab)) {
    for (const item of parsed.customVocab) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const v = item as Record<string, unknown>;
      if (typeof v.id !== 'string' || typeof v.word !== 'string' || typeof v.meaningVi !== 'string') continue;
      customVocab.push({
        id: v.id,
        lang: v.lang === 'ko' ? 'ko' : 'en',
        lessonNum: typeof v.lessonNum === 'number' ? v.lessonNum : undefined,
        word: v.word,
        ipa: typeof v.ipa === 'string' ? v.ipa : '',
        romanization: typeof v.romanization === 'string' ? v.romanization : undefined,
        pos: typeof v.pos === 'string' ? v.pos : 'từ vựng',
        meaningVi: v.meaningVi,
        exampleEn: typeof v.exampleEn === 'string' ? v.exampleEn : v.word,
        exampleVi: typeof v.exampleVi === 'string' ? v.exampleVi : v.meaningVi,
        paraphrases: Array.isArray(v.paraphrases)
          ? v.paraphrases.filter((s): s is string => typeof s === 'string')
          : [],
        grammarNoteVi: typeof v.grammarNoteVi === 'string' ? v.grammarNoteVi : undefined,
        act: isValidAct(v.act) ? v.act : 1,
        topic: typeof v.topic === 'string' ? v.topic : 'Bài trên lớp',
        isCustom: true,
      });
    }
  }

  // Validate submissions
  const submissions: PracticeSubmission[] = [];
  if (Array.isArray(parsed.submissions)) {
    for (const item of parsed.submissions) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const s = item as Record<string, unknown>;
      if (s.skill !== 'writing' && s.skill !== 'speaking') continue;
      if (typeof s.promptId !== 'string' || typeof s.content !== 'string') continue;
      submissions.push({
        id: typeof s.id === 'string' && s.id.trim() ? s.id : generateSubmissionId(),
        skill: s.skill,
        promptId: s.promptId,
        promptTitle: typeof s.promptTitle === 'string' ? s.promptTitle : s.promptId,
        content: s.content,
        bandEstimate: clampBand(s.bandEstimate, 5.0),
        aiFeedback:
          s.aiFeedback && typeof s.aiFeedback === 'object'
            ? (s.aiFeedback as PracticeSubmission['aiFeedback'])
            : undefined,
        createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date().toISOString(),
      });
    }
  }

  // Validate daily
  let daily = createFreshDaily(today);
  if (parsed.daily && typeof parsed.daily === 'object' && !Array.isArray(parsed.daily)) {
    const d = parsed.daily as Record<string, unknown>;
    if (d.date === today) {
      daily = {
        date: today,
        minutesStudied:
          typeof d.minutesStudied === 'number' && Number.isFinite(d.minutesStudied)
            ? Math.max(0, Math.round(d.minutesStudied))
            : 0,
        vocabReviewed:
          typeof d.vocabReviewed === 'number' && Number.isFinite(d.vocabReviewed)
            ? Math.max(0, Math.round(d.vocabReviewed))
            : 0,
        lessonsCompleted:
          typeof d.lessonsCompleted === 'number' && Number.isFinite(d.lessonsCompleted)
            ? Math.max(0, Math.round(d.lessonsCompleted))
            : 0,
        completedQuests: Array.isArray(d.completedQuests)
          ? Array.from(new Set(d.completedQuests.filter((q): q is string => typeof q === 'string')))
          : [],
      };
    }
  }

  return {
    ok: true,
    state: {
      profile: nextProfile,
      lessonProgress,
      vocabSRS,
      savedVocabIds,
      starterSeeded: parsed.starterSeeded !== undefined ? Boolean(parsed.starterSeeded) : true,
      customVocab,
      submissions: submissions.slice(0, 30),
      daily,
      updatedAt: new Date().toISOString(),
    },
  };
}
