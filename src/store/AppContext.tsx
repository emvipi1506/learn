import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { calculateNextSRS, createInitialSRS, isCardDue, type ReviewRating } from '../lib/srs';
import { getSavedGeminiKey, saveGeminiKey } from '../lib/gemini';
import {
  applyXpGain,
  computeNewlyCompletedQuestXp,
  createFreshDaily,
  generateSubmissionId,
  getTodayStr,
  isValidUuid,
  mergePersistedStates,
  sanitizeAiFeedback,
  sanitizeImportedState,
  type PersistedState,
} from '../lib/syncMerge';
import { roundIeltsBand } from '../data/roadmap';
import { VOCABULARY_BANK } from '../data/vocabulary';
import { KOREAN_VOCAB_BANK } from '../data/koreanVocab';
import type {
  ActNumber,
  DailyProgress,
  LessonProgressRecord,
  PracticeSubmission,
  SkillBands,
  SkillType,
  StudyLanguage,
  UserProfile,
  VocabItem,
  VocabSRSState,
} from '../types';

const STORAGE_KEY = 'grimoire_ielts_state_v1';
const ACTIVE_LANG_STORAGE_KEY = 'grimoire_active_study_lang';

const STARTER_KO_IDS = KOREAN_VOCAB_BANK.filter((v) => v.lessonNum === 6)
  .slice(0, 10)
  .map((v) => v.id);

function getSavedStudyLang(): StudyLanguage {
  try {
    return localStorage.getItem(ACTIVE_LANG_STORAGE_KEY) === 'ko' ? 'ko' : 'en';
  } catch {
    return 'en';
  }
}

function isMissingProfileColumnError(err: { code?: string; message?: string; details?: string } | null): boolean {
  if (!err) return false;
  if (err.code === '42703' || err.code === 'PGRST204') return true;
  const msg = `${err.message || ''} ${err.details || ''}`.toLowerCase();
  return (
    msg.includes('schema cache') ||
    msg.includes('deleted_custom_vocab_ids') ||
    msg.includes('settings_updated_at')
  );
}

function getDefaultState(): PersistedState {
  const today = getTodayStr();
  return {
    profile: {
      id: 'local-guest',
      displayName: 'Học Giả Khởi Nguyên',
      currentBand: 3.0,
      targetBand: 6.5,
      dailyMinutes: 120,
      xp: 45,
      level: 1,
      streakDays: 1,
      lastStudyDate: today,
      currentAct: 1,
      placementCompleted: false,
      skillBands: {
        listening: 3.0,
        reading: 3.0,
        writing: 2.5,
        speaking: 2.5,
      },
    },
    lessonProgress: {},
    vocabSRS: {},
    savedVocabIds: [
      ...VOCABULARY_BANK.filter((v) => v.act === 1).map((v) => v.id),
      ...STARTER_KO_IDS,
    ],
    starterSeeded: true,
    customVocab: [],
    deletedCustomVocabIds: [],
    submissions: [],
    daily: {
      date: today,
      minutesStudied: 0,
      vocabReviewed: 0,
      lessonsCompleted: 0,
      completedQuests: ['quest_streak'],
    },
  };
}

function rolloverDailyIfNeeded(prev: PersistedState, today: string = getTodayStr()): PersistedState {
  if (prev.daily?.date === today) {
    if (!prev.daily.completedQuests.includes('quest_streak')) {
      const nextQuests = [...prev.daily.completedQuests, 'quest_streak'];
      const questBonus = computeNewlyCompletedQuestXp(prev.daily.completedQuests, nextQuests);
      return {
        ...prev,
        profile: applyXpGain(prev.profile, questBonus, today),
        daily: {
          ...prev.daily,
          completedQuests: nextQuests,
        },
      };
    }
    return prev;
  }

  // Sang ngày mới: chỉ cập nhật daily & điểm danh (+25 XP), không làm mới settingsUpdatedAt/updatedAt
  const fresh = createFreshDaily(today);
  const nextQuests = ['quest_streak'];
  const questBonus = computeNewlyCompletedQuestXp([], nextQuests);

  return {
    ...prev,
    profile: applyXpGain(prev.profile, questBonus, today),
    daily: {
      ...fresh,
      completedQuests: nextQuests,
    },
  };
}

function loadLocalState(): PersistedState {
  const fallback = getDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const today = getTodayStr();

    const alreadySeeded = parsed.starterSeeded === true;
    let savedVocabIds: string[];
    if (Array.isArray(parsed.savedVocabIds)) {
      if (alreadySeeded) {
        // Người dùng đã được khởi tạo trước đó: tôn trọng cả trường hợp họ chủ động bỏ chọn hết
        savedVocabIds = parsed.savedVocabIds;
      } else {
        const hasSejong1Card = parsed.savedVocabIds.some((id) => id.startsWith('ko_s1_'));
        savedVocabIds = hasSejong1Card
          ? parsed.savedVocabIds
          : [...parsed.savedVocabIds, ...STARTER_KO_IDS];
      }
    } else {
      savedVocabIds = fallback.savedVocabIds;
    }

    const baseState: PersistedState = {
      profile: {
        ...fallback.profile,
        ...(parsed.profile || {}),
        skillBands: {
          ...fallback.profile.skillBands,
          ...(parsed.profile?.skillBands || {}),
        },
      },
      lessonProgress: parsed.lessonProgress || {},
      vocabSRS: parsed.vocabSRS || {},
      savedVocabIds,
      starterSeeded: true,
      customVocab: Array.isArray(parsed.customVocab) ? parsed.customVocab : [],
      deletedCustomVocabIds: Array.isArray(parsed.deletedCustomVocabIds)
        ? parsed.deletedCustomVocabIds.filter((id): id is string => typeof id === 'string')
        : [],
      submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
      daily: parsed.daily && typeof parsed.daily.date === 'string' ? parsed.daily : fallback.daily,
      ...(typeof parsed.settingsUpdatedAt === 'string' ? { settingsUpdatedAt: parsed.settingsUpdatedAt } : {}),
      ...(typeof parsed.updatedAt === 'string' ? { updatedAt: parsed.updatedAt } : {}),
    };

    return rolloverDailyIfNeeded(baseState, today);
  } catch {
    return fallback;
  }
}

interface AppContextValue {
  profile: UserProfile;
  lessonProgress: Record<string, LessonProgressRecord>;
  vocabSRS: Record<string, VocabSRSState>;
  savedVocabIds: string[];
  customVocab: VocabItem[];
  allVocabItems: VocabItem[];
  submissions: PracticeSubmission[];
  daily: DailyProgress;
  activeStudyLang: StudyLanguage;
  setActiveStudyLang: (lang: StudyLanguage) => void;
  nowTick: number;
  dueVocabCount: number;
  dueVocabByLang: { en: number; ko: number };
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  cloudConfigured: boolean;
  cloudUserEmail: string | null;
  syncStatus: 'local' | 'syncing' | 'synced' | 'error';
  syncMessage: string;
  signInCloud: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  signUpCloud: (email: string, password: string, displayName: string) => Promise<{ ok: boolean; message: string }>;
  signOutCloud: () => Promise<void>;
  syncNow: () => Promise<void>;
  updateProfileSettings: (patch: Partial<Pick<UserProfile, 'displayName' | 'dailyMinutes' | 'targetBand' | 'currentAct'>>) => void;
  completePlacement: (band: number, skillBands: SkillBands, recommendedAct: ActNumber) => void;
  completeLesson: (
    lessonId: string,
    skill: SkillType,
    score: number,
    xpReward: number,
    studyMinutes?: number,
    options?: { updateBand?: boolean }
  ) => void;
  reviewVocabCard: (wordId: string, rating: ReviewRating) => void;
  toggleSavedVocab: (wordId: string) => void;
  setBatchSavedVocab: (wordIds: string[], save: boolean) => void;
  addCustomVocab: (item: Omit<VocabItem, 'id' | 'isCustom'>) => VocabItem;
  deleteCustomVocab: (wordId: string) => void;
  addPracticeSubmission: (submission: Omit<PracticeSubmission, 'id' | 'createdAt'>) => void;
  exportBackupJson: () => string;
  importBackupJson: (jsonText: string) => { ok: boolean; message: string };
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(() => loadLocalState());
  const stateRef = useRef<PersistedState>(state);
  stateRef.current = state;

  const [activeStudyLang, setActiveStudyLangState] = useState<StudyLanguage>(() => getSavedStudyLang());
  const setActiveStudyLang = useCallback((lang: StudyLanguage) => {
    setActiveStudyLangState(lang);
    try {
      localStorage.setItem(ACTIVE_LANG_STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
  }, []);

  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [geminiApiKey, setGeminiApiKeyState] = useState<string>(() => getSavedGeminiKey());
  const [cloudUserId, setCloudUserId] = useState<string | null>(null);
  const cloudUserIdRef = useRef<string | null>(null);
  cloudUserIdRef.current = cloudUserId;

  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null);
  const cloudUserEmailRef = useRef<string | null>(null);
  cloudUserEmailRef.current = cloudUserEmail;

  // Khởi tạo mặc định 'local' — chỉ chuyển sang 'synced' sau khi đăng nhập & đồng bộ thành công
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced' | 'error'>('local');
  const [syncMessage, setSyncMessage] = useState<string>(
    isSupabaseConfigured ? 'Sẵn sàng đăng nhập đồng bộ đám mây' : 'Chế độ Khách (Lưu trên thiết bị)'
  );

  const syncInFlightRef = useRef(false);
  const lastSyncAtRef = useRef(0);
  const lastAuthUserRef = useRef<string | null>(null);
  const pushBusyRef = useRef(false);
  const queuedPushRef = useRef<{ userId: string; snapshot: PersistedState } | null>(null);
  const pushLoopPromiseRef = useRef<Promise<boolean> | null>(null);
  const legacyProfileSchemaRef = useRef(false);

  const commitState = useCallback((next: PersistedState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // Tự động lưu cục bộ mỗi khi state thay đổi
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [state]);

  // Cập nhật nowTick mỗi 60 giây để thẻ bấm "Quên" tự hiện lại sau 10 phút
  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const executeSinglePush = useCallback(async (userId: string, snapshot: PersistedState): Promise<boolean> => {
    if (!supabase) return false;
    setSyncStatus('syncing');
    try {
      const baseProfilePayload = {
        id: userId,
        display_name: snapshot.profile.displayName,
        current_band: snapshot.profile.currentBand,
        target_band: snapshot.profile.targetBand,
        daily_minutes: snapshot.profile.dailyMinutes,
        xp: snapshot.profile.xp,
        level: snapshot.profile.level,
        streak_days: snapshot.profile.streakDays,
        last_study_date: snapshot.profile.lastStudyDate,
        current_act: snapshot.profile.currentAct,
        placement_completed: snapshot.profile.placementCompleted,
        skill_bands: snapshot.profile.skillBands,
        saved_vocab_ids: snapshot.savedVocabIds,
        starter_seeded: snapshot.starterSeeded,
        updated_at: snapshot.updatedAt || new Date().toISOString(),
      };

      let profileRes = legacyProfileSchemaRef.current
        ? await supabase.from('profiles').upsert(baseProfilePayload)
        : await supabase.from('profiles').upsert({
            ...baseProfilePayload,
            deleted_custom_vocab_ids: snapshot.deletedCustomVocabIds || [],
            settings_updated_at: snapshot.settingsUpdatedAt || null,
          });

      if (profileRes.error && !legacyProfileSchemaRef.current && isMissingProfileColumnError(profileRes.error)) {
        legacyProfileSchemaRef.current = true;
        profileRes = await supabase.from('profiles').upsert(baseProfilePayload);
      }
      if (profileRes.error) throw profileRes.error;

      const lessonRows = Object.values(snapshot.lessonProgress).map((l) => ({
        user_id: userId,
        lesson_id: l.lessonId,
        skill: l.skill,
        score: l.score,
        completed_at: l.completedAt,
      }));
      if (lessonRows.length > 0) {
        const res = await supabase
          .from('lesson_progress')
          .upsert(lessonRows, { onConflict: 'user_id,lesson_id' });
        if (res.error) throw res.error;
      }

      const vocabRows = Object.values(snapshot.vocabSRS).map((v) => ({
        user_id: userId,
        word_id: v.wordId,
        ease_factor: v.easeFactor,
        interval_days: v.intervalDays,
        repetitions: v.repetitions,
        next_review_at: v.nextReviewAt,
        last_reviewed_at: v.lastReviewedAt || null,
      }));
      if (vocabRows.length > 0) {
        const res = await supabase
          .from('vocab_cards')
          .upsert(vocabRows, { onConflict: 'user_id,word_id' });
        if (res.error) throw res.error;
      }

      const customRows = snapshot.customVocab.map((c) => ({
        user_id: userId,
        word_id: c.id,
        lang: c.lang ?? 'en',
        lesson_num: c.lessonNum ?? null,
        word: c.word,
        ipa: c.ipa,
        romanization: c.romanization ?? null,
        pos: c.pos,
        meaning_vi: c.meaningVi,
        example_en: c.exampleEn,
        example_vi: c.exampleVi,
        paraphrases: c.paraphrases,
        grammar_note_vi: c.grammarNoteVi ?? null,
        act: c.act,
        topic: c.topic,
      }));
      if (customRows.length > 0) {
        const res = await supabase
          .from('custom_vocab')
          .upsert(customRows, { onConflict: 'user_id,word_id' });
        if (res.error) throw res.error;
      }

      const dailyRes = await supabase.from('daily_logs').upsert(
        {
          user_id: userId,
          study_date: snapshot.daily.date,
          minutes_studied: snapshot.daily.minutesStudied,
          vocab_reviewed: snapshot.daily.vocabReviewed,
          lessons_completed: snapshot.daily.lessonsCompleted,
          completed_quests: snapshot.daily.completedQuests,
        },
        { onConflict: 'user_id,study_date' }
      );
      if (dailyRes.error) throw dailyRes.error;

      // Đồng bộ các bài nộp Writing/Speaking (tạo khi offline hoặc khôi phục từ backup) có UUID hợp lệ
      const submissionRows = snapshot.submissions
        .filter((s) => isValidUuid(s.id))
        .slice(0, 30)
        .map((s) => ({
          id: s.id,
          user_id: userId,
          skill: s.skill,
          prompt_id: s.promptId,
          prompt_title: s.promptTitle,
          content: s.content,
          band_estimate: s.bandEstimate,
          ai_feedback: s.aiFeedback || null,
          created_at: s.createdAt,
        }));
      if (submissionRows.length > 0) {
        const subRes = await supabase
          .from('practice_submissions')
          .upsert(submissionRows, { onConflict: 'id' });
        if (subRes.error) throw subRes.error;
      }

      lastSyncAtRef.current = Date.now();
      setSyncStatus('synced');
      setSyncMessage(
        `Đã đồng bộ lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
      );
      return true;
    } catch (err) {
      const detail = err instanceof Error ? err.message : '';
      setSyncStatus('error');
      setSyncMessage(
        detail
          ? `Lỗi đồng bộ đám mây: ${detail.slice(0, 90)} (vẫn an toàn ở máy)`
          : 'Lỗi đẩy dữ liệu đám mây (vẫn an toàn ở bộ nhớ máy)'
      );
      return false;
    }
  }, []);

  // Hàng đợi tuần tự (coalesce latest snapshot) chống race condition khi nhiều request đẩy lên cloud liên tiếp
  const pushToCloud = useCallback(
    (userId: string, snapshot: PersistedState): Promise<boolean> => {
      if (!supabase) return Promise.resolve(false);
      if (pushBusyRef.current) {
        queuedPushRef.current = { userId, snapshot };
        return pushLoopPromiseRef.current ?? Promise.resolve(true);
      }

      pushBusyRef.current = true;
      const loopPromise = (async () => {
        let current: { userId: string; snapshot: PersistedState } | null = { userId, snapshot };
        let ok = false;
        try {
          while (current) {
            if (cloudUserIdRef.current !== current.userId) {
              queuedPushRef.current = null;
              break;
            }
            ok = await executeSinglePush(current.userId, current.snapshot);
            current = queuedPushRef.current;
            queuedPushRef.current = null;
          }
        } finally {
          pushBusyRef.current = false;
          pushLoopPromiseRef.current = null;
        }
        return ok;
      })();

      pushLoopPromiseRef.current = loopPromise;
      return loopPromise;
    },
    [executeSinglePush]
  );

  // Luồng đồng bộ 2 chiều an toàn: Pull -> Merge thông minh -> Push
  const syncBidirectional = useCallback(
    async (
      userId: string,
      email: string | null,
      options?: { pushAfterMerge?: boolean; preferCloudSavedVocab?: boolean }
    ) => {
      if (!supabase || syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      setSyncStatus('syncing');
      setSyncMessage('Đang đồng bộ hai chiều iOS ↔ Windows...');

      try {
        if (pushLoopPromiseRef.current) {
          await pushLoopPromiseRef.current;
        }
        const today = getTodayStr();
        const [profileRes, lessonsRes, vocabRes, customRes, subsRes, dailyRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
          supabase.from('lesson_progress').select('*').eq('user_id', userId),
          supabase.from('vocab_cards').select('*').eq('user_id', userId),
          supabase.from('custom_vocab').select('*').eq('user_id', userId),
          supabase
            .from('practice_submissions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(30),
          supabase
            .from('daily_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('study_date', today)
            .maybeSingle(),
        ]);

        for (const res of [profileRes, lessonsRes, vocabRes, customRes, subsRes, dailyRes]) {
          if (res.error) throw res.error;
        }

        if (cloudUserIdRef.current !== userId) {
          return;
        }

        const localCurrent = rolloverDailyIfNeeded(stateRef.current, today);

        const cloudProfileData = profileRes.data;
        const cloudProfile: UserProfile | undefined = cloudProfileData
          ? {
              id: userId,
              email: email || undefined,
              displayName: cloudProfileData.display_name || localCurrent.profile.displayName,
              currentBand: Number(cloudProfileData.current_band) || localCurrent.profile.currentBand,
              targetBand: Number(cloudProfileData.target_band) || localCurrent.profile.targetBand,
              dailyMinutes: Number(cloudProfileData.daily_minutes) || localCurrent.profile.dailyMinutes,
              xp: Number(cloudProfileData.xp) || 0,
              level: Number(cloudProfileData.level) || 1,
              streakDays: Number(cloudProfileData.streak_days) || 1,
              lastStudyDate: cloudProfileData.last_study_date || today,
              currentAct: (Number(cloudProfileData.current_act) as ActNumber) || 1,
              placementCompleted: Boolean(cloudProfileData.placement_completed),
              skillBands: (cloudProfileData.skill_bands as SkillBands) || localCurrent.profile.skillBands,
            }
          : undefined;

        const cloudLessons: Record<string, LessonProgressRecord> = {};
        for (const row of lessonsRes.data || []) {
          cloudLessons[row.lesson_id] = {
            lessonId: row.lesson_id,
            skill: row.skill as SkillType,
            score: Number(row.score),
            completedAt: row.completed_at,
          };
        }

        const cloudVocabSRS: Record<string, VocabSRSState> = {};
        for (const row of vocabRes.data || []) {
          cloudVocabSRS[row.word_id] = {
            wordId: row.word_id,
            easeFactor: Number(row.ease_factor),
            intervalDays: Number(row.interval_days),
            repetitions: Number(row.repetitions),
            nextReviewAt: row.next_review_at,
            lastReviewedAt: row.last_reviewed_at || undefined,
          };
        }

        const cloudCustomVocab: VocabItem[] = (customRes.data || []).map((row) => ({
          id: row.word_id,
          lang: row.lang === 'ko' ? 'ko' : 'en',
          lessonNum: typeof row.lesson_num === 'number' ? row.lesson_num : undefined,
          word: row.word,
          ipa: row.ipa || '',
          romanization: row.romanization || undefined,
          pos: row.pos || 'từ vựng',
          meaningVi: row.meaning_vi,
          exampleEn: row.example_en || row.word,
          exampleVi: row.example_vi || row.meaning_vi,
          paraphrases: Array.isArray(row.paraphrases) ? row.paraphrases : [],
          grammarNoteVi: row.grammar_note_vi || undefined,
          act: (Number(row.act) as ActNumber) || 1,
          topic: row.topic || 'Bài trên lớp',
          isCustom: true,
        }));

        const cloudSubs: PracticeSubmission[] = (subsRes.data || []).map((row) => {
          const rawBand =
            row.band_estimate === null || row.band_estimate === undefined
              ? 0
              : Number(row.band_estimate);
          return {
            id: row.id,
            skill: row.skill as 'writing' | 'speaking',
            promptId: row.prompt_id,
            promptTitle: row.prompt_title,
            content: row.content,
            bandEstimate: Number.isFinite(rawBand) ? rawBand : 0,
            aiFeedback: sanitizeAiFeedback(row.ai_feedback),
            createdAt: row.created_at,
          };
        });

        const cloudDaily: DailyProgress | undefined = dailyRes.data
          ? {
              date: dailyRes.data.study_date,
              minutesStudied: Number(dailyRes.data.minutes_studied) || 0,
              vocabReviewed: Number(dailyRes.data.vocab_reviewed) || 0,
              lessonsCompleted: Number(dailyRes.data.lessons_completed) || 0,
              completedQuests: Array.isArray(dailyRes.data.completed_quests)
                ? dailyRes.data.completed_quests
                : [],
            }
          : undefined;

        const cloudSavedIds = Array.isArray(cloudProfileData?.saved_vocab_ids)
          ? (cloudProfileData.saved_vocab_ids as string[])
          : undefined;
        const cloudDeletedCustomIds = Array.isArray(cloudProfileData?.deleted_custom_vocab_ids)
          ? (cloudProfileData.deleted_custom_vocab_ids as string[])
          : undefined;
        const cloudSettingsUpdatedAt =
          typeof cloudProfileData?.settings_updated_at === 'string'
            ? cloudProfileData.settings_updated_at
            : undefined;

        const merged = mergePersistedStates(
          localCurrent,
          {
            profile: cloudProfile,
            lessonProgress: cloudLessons,
            vocabSRS: cloudVocabSRS,
            savedVocabIds: cloudSavedIds,
            starterSeeded: Boolean(cloudProfileData?.starter_seeded),
            customVocab: cloudCustomVocab,
            deletedCustomVocabIds: cloudDeletedCustomIds,
            submissions: cloudSubs,
            daily: cloudDaily,
            settingsUpdatedAt: cloudSettingsUpdatedAt,
            updatedAt: cloudProfileData?.updated_at || undefined,
          },
          {
            cloudHasProfile: Boolean(cloudProfileData),
            preferCloudSavedVocab: options?.preferCloudSavedVocab,
            today,
          }
        );

        // Đảm bảo giữ id/email người dùng đám mây ngay cả khi mới đăng ký chưa có dòng profile
        merged.profile = {
          ...merged.profile,
          id: userId,
          email: email || undefined,
        };

        commitState(merged);

        if (options?.pushAfterMerge !== false) {
          await pushToCloud(userId, merged);
        } else {
          lastSyncAtRef.current = Date.now();
          setSyncStatus('synced');
          setSyncMessage(
            `Đã đồng bộ lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
          );
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : '';
        setSyncStatus('error');
        setSyncMessage(
          detail
            ? `Chưa đồng bộ được: ${detail.slice(0, 90)} (đang dùng bản máy)`
            : 'Chưa đồng bộ được đám mây (đang dùng bản lưu cục bộ)'
        );
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [commitState, pushToCloud]
  );

  // Theo dõi phiên đăng nhập Supabase — chỉ qua onAuthStateChange (tránh gọi trùng với getSession)
  useEffect(() => {
    if (!supabase) return;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      if (user) {
        setCloudUserId(user.id);
        setCloudUserEmail(user.email || null);

        // Chỉ đồng bộ khi mới nhận phiên (INITIAL_SESSION / SIGNED_IN) hoặc đổi user
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || lastAuthUserRef.current !== user.id) {
          lastAuthUserRef.current = user.id;
          void syncBidirectional(user.id, user.email || null, {
            pushAfterMerge: true,
            preferCloudSavedVocab: true,
          });
        }
      } else {
        lastAuthUserRef.current = null;
        cloudUserIdRef.current = null;
        cloudUserEmailRef.current = null;
        setCloudUserId(null);
        setCloudUserEmail(null);
        setSyncStatus('local');
        setSyncMessage('Chế độ Khách (Lưu trên thiết bị)');
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [syncBidirectional]);

  // Tự chuyển ngày mới & kéo tiến độ mới nhất khi mở lại PWA từ chế độ ngủ (iOS) hoặc có mạng lại
  useEffect(() => {
    const handleWakeOrOnline = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      setNowTick(Date.now());
      const today = getTodayStr();
      const rolled = rolloverDailyIfNeeded(stateRef.current, today);
      if (rolled !== stateRef.current) {
        commitState(rolled);
      }

      const uid = cloudUserIdRef.current;
      if (uid && Date.now() - lastSyncAtRef.current > 5000) {
        void syncBidirectional(uid, cloudUserEmailRef.current, {
          pushAfterMerge: true,
          preferCloudSavedVocab: true,
        });
      }
    };

    document.addEventListener('visibilitychange', handleWakeOrOnline);
    window.addEventListener('online', handleWakeOrOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleWakeOrOnline);
      window.removeEventListener('online', handleWakeOrOnline);
    };
  }, [commitState, syncBidirectional]);

  const syncNow = useCallback(async () => {
    const uid = cloudUserIdRef.current;
    if (!uid) return;
    await syncBidirectional(uid, cloudUserEmailRef.current, {
      pushAfterMerge: true,
      preferCloudSavedVocab: false,
    });
  }, [syncBidirectional]);

  const setGeminiApiKey = useCallback((key: string) => {
    saveGeminiKey(key);
    setGeminiApiKeyState(key.trim());
  }, []);

  const signInCloud = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { ok: false, message: 'Chưa cấu hình VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong file .env.' };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: 'Đăng nhập thành công! Đang đồng bộ hai chiều...' };
  }, []);

  const signUpCloud = useCallback(async (email: string, password: string, displayName: string) => {
    if (!supabase) {
      return { ok: false, message: 'Chưa cấu hình Supabase trong file .env.' };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || 'Học Giả Mới' } },
    });
    if (error) return { ok: false, message: error.message };
    return {
      ok: true,
      message: 'Tạo tài khoản thành công! Nếu Supabase bật xác thực email, hãy kiểm tra hộp thư để xác nhận.',
    };
  }, []);

  const signOutCloud = useCallback(async () => {
    queuedPushRef.current = null;
    lastAuthUserRef.current = null;
    cloudUserIdRef.current = null;
    cloudUserEmailRef.current = null;
    setCloudUserId(null);
    setCloudUserEmail(null);
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Vẫn dọn sạch dữ liệu cục bộ nếu đăng xuất khi mất mạng
      }
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ACTIVE_LANG_STORAGE_KEY);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('grimoire_draft_')) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore storage errors
    }
    commitState(getDefaultState());
    setActiveStudyLangState('en');
    setSyncStatus('local');
    setSyncMessage('Chế độ Khách (Lưu trên thiết bị)');
  }, [commitState]);

  const updateProfileSettings = useCallback(
    (patch: Partial<Pick<UserProfile, 'displayName' | 'dailyMinutes' | 'targetBand' | 'currentAct'>>) => {
      const prev = stateRef.current;
      const nowIso = new Date().toISOString();
      const next: PersistedState = {
        ...prev,
        profile: { ...prev.profile, ...patch },
        settingsUpdatedAt: nowIso,
        updatedAt: nowIso,
      };
      commitState(next);
      if (cloudUserIdRef.current) {
        void pushToCloud(cloudUserIdRef.current, next);
      }
    },
    [commitState, pushToCloud]
  );

  const completePlacement = useCallback(
    (band: number, skillBands: SkillBands, recommendedAct: ActNumber) => {
      const today = getTodayStr();
      const prev = rolloverDailyIfNeeded(stateRef.current, today);
      const isFirstPlacement = !prev.profile.placementCompleted;
      const nowIso = new Date().toISOString();
      const nextProfile = applyXpGain(
        {
          ...prev.profile,
          currentBand: roundIeltsBand(band),
          skillBands,
          currentAct: recommendedAct,
          placementCompleted: true,
        },
        isFirstPlacement ? 80 : 0,
        today
      );
      const next: PersistedState = {
        ...prev,
        profile: nextProfile,
        settingsUpdatedAt: nowIso,
        updatedAt: nowIso,
      };
      commitState(next);
      if (cloudUserIdRef.current) {
        void pushToCloud(cloudUserIdRef.current, next);
      }
    },
    [commitState, pushToCloud]
  );

  const completeLesson = useCallback(
    (
      lessonId: string,
      skill: SkillType,
      score: number,
      xpReward: number,
      studyMinutes = 15,
      options?: { updateBand?: boolean }
    ) => {
      const today = getTodayStr();
      const prev = rolloverDailyIfNeeded(stateRef.current, today);
      const prevRecord = prev.lessonProgress[lessonId];
      const prevBestScore = prevRecord?.score ?? 0;
      const bestScore = Math.max(prevBestScore, score);
      const isFirstCompletion = !prevRecord;
      const shouldUpdateBand = options?.updateBand ?? true;

      const nextSkillBands = { ...prev.profile.skillBands };
      if (shouldUpdateBand && score >= 70) {
        let bandGain = 0;
        if (prevBestScore < 70 && score >= 70) bandGain += 0.5;
        if (prevBestScore < 90 && score >= 90) bandGain += 0.5;
        if (bandGain > 0) {
          nextSkillBands[skill] = roundIeltsBand(nextSkillBands[skill] + bandGain);
        }
      }
      const avgBand = roundIeltsBand(
        (nextSkillBands.listening + nextSkillBands.reading + nextSkillBands.writing + nextSkillBands.speaking) / 4
      );

      const completedQuestsSet = new Set(prev.daily.completedQuests);
      completedQuestsSet.add('quest_lesson');
      const nextCompletedQuests = Array.from(completedQuestsSet);
      const questBonusXp = computeNewlyCompletedQuestXp(prev.daily.completedQuests, nextCompletedQuests);
      const baseLessonXp = isFirstCompletion ? xpReward : Math.round(xpReward * 0.4);

      const nextProfile = applyXpGain(
        {
          ...prev.profile,
          skillBands: nextSkillBands,
          currentBand: Math.max(prev.profile.currentBand, avgBand),
        },
        baseLessonXp + questBonusXp,
        today
      );

      const next: PersistedState = {
        ...prev,
        profile: nextProfile,
        lessonProgress: {
          ...prev.lessonProgress,
          [lessonId]: {
            lessonId,
            skill,
            score: bestScore,
            completedAt: new Date().toISOString(),
          },
        },
        daily: {
          ...prev.daily,
          minutesStudied: prev.daily.minutesStudied + studyMinutes,
          lessonsCompleted: prev.daily.lessonsCompleted + 1,
          completedQuests: nextCompletedQuests,
        },
        updatedAt: new Date().toISOString(),
      };
      commitState(next);
      if (cloudUserIdRef.current) {
        void pushToCloud(cloudUserIdRef.current, next);
      }
    },
    [commitState, pushToCloud]
  );

  const reviewVocabCard = useCallback(
    (wordId: string, rating: ReviewRating) => {
      const today = getTodayStr();
      const prev = rolloverDailyIfNeeded(stateRef.current, today);
      const current = prev.vocabSRS[wordId] ?? createInitialSRS(wordId);
      const updated = calculateNextSRS(current, rating);

      const nextReviewed = prev.daily.vocabReviewed + 1;
      const completedQuestsSet = new Set(prev.daily.completedQuests);
      if (nextReviewed >= 5) {
        completedQuestsSet.add('quest_vocab');
      }
      const nextCompletedQuests = Array.from(completedQuestsSet);
      const questBonusXp = computeNewlyCompletedQuestXp(prev.daily.completedQuests, nextCompletedQuests);

      const nextSaved = prev.savedVocabIds.includes(wordId)
        ? prev.savedVocabIds
        : [...prev.savedVocabIds, wordId];

      const next: PersistedState = {
        ...prev,
        profile: applyXpGain(prev.profile, (rating === 0 ? 5 : 10) + questBonusXp, today),
        vocabSRS: {
          ...prev.vocabSRS,
          [wordId]: updated,
        },
        savedVocabIds: nextSaved,
        daily: {
          ...prev.daily,
          minutesStudied: prev.daily.minutesStudied + 2,
          vocabReviewed: nextReviewed,
          completedQuests: nextCompletedQuests,
        },
        updatedAt: new Date().toISOString(),
      };
      commitState(next);
      if (cloudUserIdRef.current) {
        void pushToCloud(cloudUserIdRef.current, next);
      }
    },
    [commitState, pushToCloud]
  );

  const toggleSavedVocab = useCallback(
    (wordId: string) => {
      const prev = stateRef.current;
      const exists = prev.savedVocabIds.includes(wordId);
      const nowIso = new Date().toISOString();
      const next: PersistedState = {
        ...prev,
        savedVocabIds: exists
          ? prev.savedVocabIds.filter((id) => id !== wordId)
          : [...prev.savedVocabIds, wordId],
        starterSeeded: true,
        settingsUpdatedAt: nowIso,
        updatedAt: nowIso,
      };
      commitState(next);
      if (cloudUserIdRef.current) {
        void pushToCloud(cloudUserIdRef.current, next);
      }
    },
    [commitState, pushToCloud]
  );

  const setBatchSavedVocab = useCallback(
    (wordIds: string[], save: boolean) => {
      const prev = stateRef.current;
      const nextSet = new Set(prev.savedVocabIds);
      for (const id of wordIds) {
        if (save) nextSet.add(id);
        else nextSet.delete(id);
      }
      const nowIso = new Date().toISOString();
      const next: PersistedState = {
        ...prev,
        savedVocabIds: Array.from(nextSet),
        starterSeeded: true,
        settingsUpdatedAt: nowIso,
        updatedAt: nowIso,
      };
      commitState(next);
      if (cloudUserIdRef.current) {
        void pushToCloud(cloudUserIdRef.current, next);
      }
    },
    [commitState, pushToCloud]
  );

  const addCustomVocab = useCallback(
    (item: Omit<VocabItem, 'id' | 'isCustom'>): VocabItem => {
      const lang: StudyLanguage = item.lang ?? 'en';
      const created: VocabItem = {
        ...item,
        lang,
        id: `${lang}_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        isCustom: true,
      };
      const prev = stateRef.current;
      const nowIso = new Date().toISOString();
      const next: PersistedState = {
        ...prev,
        customVocab: [created, ...prev.customVocab],
        savedVocabIds: [created.id, ...prev.savedVocabIds],
        deletedCustomVocabIds: (prev.deletedCustomVocabIds || []).filter((id) => id !== created.id),
        starterSeeded: true,
        settingsUpdatedAt: nowIso,
        updatedAt: nowIso,
      };
      commitState(next);
      if (cloudUserIdRef.current) {
        void pushToCloud(cloudUserIdRef.current, next);
      }
      return created;
    },
    [commitState, pushToCloud]
  );

  const deleteCustomVocab = useCallback(
    (wordId: string) => {
      const prev = stateRef.current;
      const nextSRS = { ...prev.vocabSRS };
      delete nextSRS[wordId];
      const nowIso = new Date().toISOString();
      const next: PersistedState = {
        ...prev,
        customVocab: prev.customVocab.filter((v) => v.id !== wordId),
        savedVocabIds: prev.savedVocabIds.filter((id) => id !== wordId),
        deletedCustomVocabIds: Array.from(
          new Set([...(prev.deletedCustomVocabIds || []), wordId])
        ).slice(-200),
        vocabSRS: nextSRS,
        settingsUpdatedAt: nowIso,
        updatedAt: nowIso,
      };
      commitState(next);

      const uid = cloudUserIdRef.current;
      if (uid && supabase) {
        void (async () => {
          if (pushLoopPromiseRef.current) {
            await pushLoopPromiseRef.current;
          }
          if (cloudUserIdRef.current !== uid || !supabase) return;
          const [delCustom, delSrs] = await Promise.all([
            supabase.from('custom_vocab').delete().eq('user_id', uid).eq('word_id', wordId),
            supabase.from('vocab_cards').delete().eq('user_id', uid).eq('word_id', wordId),
          ]);
          if (cloudUserIdRef.current !== uid) return;
          if (delCustom.error || delSrs.error) {
            setSyncStatus('error');
            setSyncMessage('Không thể xóa thẻ trên đám mây (đã xóa trên máy)');
            return;
          }
          await pushToCloud(uid, stateRef.current);
        })();
      }
    },
    [commitState, pushToCloud]
  );

  const addPracticeSubmission = useCallback(
    (submission: Omit<PracticeSubmission, 'id' | 'createdAt'>) => {
      const today = getTodayStr();
      const prev = rolloverDailyIfNeeded(stateRef.current, today);
      const record: PracticeSubmission = {
        ...submission,
        id: generateSubmissionId(),
        createdAt: new Date().toISOString(),
      };

      const nextSkillBands = { ...prev.profile.skillBands };
      const hasAiScore = Boolean(submission.aiFeedback) && submission.bandEstimate > 0;
      if (hasAiScore && submission.bandEstimate > nextSkillBands[submission.skill]) {
        nextSkillBands[submission.skill] = roundIeltsBand(submission.bandEstimate);
      }
      const avgBand = roundIeltsBand(
        (nextSkillBands.listening + nextSkillBands.reading + nextSkillBands.writing + nextSkillBands.speaking) / 4
      );

      const next: PersistedState = {
        ...prev,
        profile: {
          ...prev.profile,
          skillBands: nextSkillBands,
          currentBand: hasAiScore ? Math.max(prev.profile.currentBand, avgBand) : prev.profile.currentBand,
        },
        submissions: [record, ...prev.submissions].slice(0, 30),
        updatedAt: new Date().toISOString(),
      };
      commitState(next);

      const uid = cloudUserIdRef.current;
      if (uid && supabase) {
        void pushToCloud(uid, next);
      }
    },
    [commitState, pushToCloud]
  );

  const exportBackupJson = useCallback(() => {
    return JSON.stringify(stateRef.current, null, 2);
  }, []);

  const importBackupJson = useCallback(
    (jsonText: string) => {
      try {
        const raw = JSON.parse(jsonText) as unknown;
        const result = sanitizeImportedState(raw, stateRef.current, getDefaultState());
        if (!result.ok) {
          return { ok: false, message: result.message };
        }
        const normalized = rolloverDailyIfNeeded(result.state);
        commitState(normalized);
        if (cloudUserIdRef.current) {
          void pushToCloud(cloudUserIdRef.current, normalized);
        }
        return { ok: true, message: 'Khôi phục dữ liệu thành công!' };
      } catch {
        return { ok: false, message: 'Không thể đọc tệp JSON. Vui lòng kiểm tra lại.' };
      }
    },
    [commitState, pushToCloud]
  );

  const allVocabItems = useMemo<VocabItem[]>(() => {
    const enBuiltIn = VOCABULARY_BANK.map((v) => ({ ...v, lang: 'en' as const }));
    return [...state.customVocab, ...enBuiltIn, ...KOREAN_VOCAB_BANK];
  }, [state.customVocab]);

  const dueVocabByLang = useMemo(() => {
    const savedSet = new Set(state.savedVocabIds);
    let en = 0;
    let ko = 0;
    for (const item of allVocabItems) {
      if (!savedSet.has(item.id)) continue;
      if (!isCardDue(state.vocabSRS[item.id], nowTick)) continue;
      if ((item.lang ?? 'en') === 'ko') ko += 1;
      else en += 1;
    }
    return { en, ko };
  }, [allVocabItems, state.savedVocabIds, state.vocabSRS, nowTick]);

  const dueVocabCount = dueVocabByLang.en + dueVocabByLang.ko;

  const value = useMemo<AppContextValue>(
    () => ({
      profile: state.profile,
      lessonProgress: state.lessonProgress,
      vocabSRS: state.vocabSRS,
      savedVocabIds: state.savedVocabIds,
      customVocab: state.customVocab,
      allVocabItems,
      submissions: state.submissions,
      daily: state.daily,
      activeStudyLang,
      setActiveStudyLang,
      nowTick,
      dueVocabCount,
      dueVocabByLang,
      geminiApiKey,
      setGeminiApiKey,
      cloudConfigured: isSupabaseConfigured,
      cloudUserEmail,
      syncStatus,
      syncMessage,
      signInCloud,
      signUpCloud,
      signOutCloud,
      syncNow,
      updateProfileSettings,
      completePlacement,
      completeLesson,
      reviewVocabCard,
      toggleSavedVocab,
      setBatchSavedVocab,
      addCustomVocab,
      deleteCustomVocab,
      addPracticeSubmission,
      exportBackupJson,
      importBackupJson,
    }),
    [
      state,
      allVocabItems,
      activeStudyLang,
      setActiveStudyLang,
      nowTick,
      dueVocabCount,
      dueVocabByLang,
      geminiApiKey,
      setGeminiApiKey,
      cloudUserEmail,
      syncStatus,
      syncMessage,
      signInCloud,
      signUpCloud,
      signOutCloud,
      syncNow,
      updateProfileSettings,
      completePlacement,
      completeLesson,
      reviewVocabCard,
      toggleSavedVocab,
      setBatchSavedVocab,
      addCustomVocab,
      deleteCustomVocab,
      addPracticeSubmission,
      exportBackupJson,
      importBackupJson,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
