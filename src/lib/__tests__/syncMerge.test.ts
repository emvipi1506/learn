import { describe, expect, it } from 'vitest';
import {
  computeNewlyCompletedQuestXp,
  createFreshDaily,
  generateSubmissionId,
  isValidUuid,
  mergePersistedStates,
  sanitizeImportedState,
  type PersistedState,
} from '../syncMerge';

function makeState(overrides?: Partial<PersistedState>): PersistedState {
  return {
    profile: {
      id: 'user-1',
      displayName: 'Học Giả A',
      currentBand: 4.0,
      targetBand: 6.5,
      dailyMinutes: 120,
      xp: 80,
      level: 2,
      streakDays: 3,
      lastStudyDate: '2026-11-24',
      currentAct: 2,
      placementCompleted: true,
      skillBands: { listening: 4.5, reading: 4.0, writing: 3.5, speaking: 3.5 },
    },
    lessonProgress: {
      l1: { lessonId: 'l1', skill: 'listening', score: 75, completedAt: '2026-11-23T10:00:00.000Z' },
    },
    vocabSRS: {
      v1: {
        wordId: 'v1',
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: '2026-11-25T10:00:00.000Z',
        lastReviewedAt: '2026-11-24T08:00:00.000Z',
      },
    },
    savedVocabIds: ['v1', 'v2'],
    starterSeeded: true,
    customVocab: [
      {
        id: 'en_custom_win',
        lang: 'en',
        word: 'resilient',
        ipa: '/rɪˈzɪl.jənt/',
        pos: 'adj',
        meaningVi: 'kiên cường',
        exampleEn: 'Resilient learners keep improving.',
        exampleVi: 'Người học kiên cường luôn tiến bộ.',
        paraphrases: [],
        act: 1,
        topic: 'Windows',
        isCustom: true,
      },
    ],
    submissions: [
      {
        id: 'sub_win_1',
        skill: 'writing',
        promptId: 'w1',
        promptTitle: 'Task 1',
        content: 'My writing response',
        bandEstimate: 5.5,
        createdAt: '2026-11-24T07:00:00.000Z',
      },
    ],
    daily: {
      date: '2026-11-24',
      minutesStudied: 20,
      vocabReviewed: 4,
      lessonsCompleted: 1,
      completedQuests: ['quest_streak', 'quest_lesson'],
    },
    updatedAt: '2026-11-24T08:00:00.000Z',
    ...overrides,
  };
}

describe('Đồng bộ hai chiều iOS ↔ Windows (syncMerge.ts)', () => {
  it('hợp nhất tiến độ cao hơn, SRS mới hơn, customVocab và daily_logs mà không mất dữ liệu', () => {
    const localWindows = makeState();
    const cloudIOS: Partial<PersistedState> = {
      profile: {
        ...localWindows.profile,
        displayName: 'Minh Anh',
        xp: 120,
        level: 3,
        streakDays: 5,
        currentBand: 5.0,
        skillBands: { listening: 4.0, reading: 5.5, writing: 4.5, speaking: 3.0 },
      },
      lessonProgress: {
        l1: { lessonId: 'l1', skill: 'listening', score: 90, completedAt: '2026-11-24T09:00:00.000Z' },
        r1: { lessonId: 'r1', skill: 'reading', score: 85, completedAt: '2026-11-24T09:10:00.000Z' },
      },
      vocabSRS: {
        v1: {
          wordId: 'v1',
          easeFactor: 2.6,
          intervalDays: 6,
          repetitions: 2,
          nextReviewAt: '2026-11-30T09:00:00.000Z',
          lastReviewedAt: '2026-11-24T09:30:00.000Z',
        },
        ko1: {
          wordId: 'ko1',
          easeFactor: 2.5,
          intervalDays: 1,
          repetitions: 1,
          nextReviewAt: '2026-11-25T09:00:00.000Z',
          lastReviewedAt: '2026-11-24T09:15:00.000Z',
        },
      },
      savedVocabIds: ['v1', 'ko1'],
      customVocab: [
        {
          id: 'ko_custom_ios',
          lang: 'ko',
          word: '복습',
          ipa: '[bok-seup]',
          romanization: 'bok-seup',
          pos: 'từ vựng',
          meaningVi: 'ôn tập',
          exampleEn: '매일 복습해요.',
          exampleVi: 'Tôi ôn tập mỗi ngày.',
          paraphrases: [],
          act: 1,
          topic: 'iPhone',
          isCustom: true,
        },
      ],
      daily: {
        date: '2026-11-24',
        minutesStudied: 35,
        vocabReviewed: 7,
        lessonsCompleted: 0,
        completedQuests: ['quest_streak', 'quest_vocab'],
      },
      updatedAt: '2026-11-24T09:30:00.000Z',
    };

    const merged = mergePersistedStates(localWindows, cloudIOS, {
      today: '2026-11-24',
      cloudHasProfile: true,
    });

    // Hồ sơ giữ cấp cao hơn & điểm kỹ năng cao nhất của từng máy
    expect(merged.profile.level).toBe(3);
    expect(merged.profile.xp).toBe(120);
    expect(merged.profile.streakDays).toBe(5);
    expect(merged.profile.displayName).toBe('Minh Anh');
    expect(merged.profile.skillBands).toEqual({
      listening: 4.5,
      reading: 5.5,
      writing: 4.5,
      speaking: 3.5,
    });

    // Tiến độ bài học giữ điểm cao hơn và đủ bài của cả 2 máy
    expect(merged.lessonProgress.l1.score).toBe(90);
    expect(merged.lessonProgress.r1.score).toBe(85);

    // SRS giữ bản ghi có lastReviewedAt mới hơn
    expect(merged.vocabSRS.v1.repetitions).toBe(2);
    expect(merged.vocabSRS.v1.intervalDays).toBe(6);
    expect(merged.vocabSRS.ko1.repetitions).toBe(1);

    // customVocab giữ đầy đủ thẻ từ cả Windows và iPhone
    const customIds = merged.customVocab.map((c) => c.id);
    expect(customIds).toContain('en_custom_win');
    expect(customIds).toContain('ko_custom_ios');

    // daily_logs hợp nhất max chỉ số & union nhiệm vụ
    expect(merged.daily.minutesStudied).toBe(35);
    expect(merged.daily.vocabReviewed).toBe(7);
    expect(merged.daily.lessonsCompleted).toBe(1);
    expect(merged.daily.completedQuests).toEqual(
      expect.arrayContaining(['quest_streak', 'quest_lesson', 'quest_vocab'])
    );
  });

  it('không ghi đè tiến độ mới trên máy cục bộ khi dữ liệu đám mây cũ hơn', () => {
    const localNewer = makeState({
      vocabSRS: {
        v1: {
          wordId: 'v1',
          easeFactor: 2.7,
          intervalDays: 14,
          repetitions: 3,
          nextReviewAt: '2026-12-08T10:00:00.000Z',
          lastReviewedAt: '2026-11-24T12:00:00.000Z',
        },
      },
      updatedAt: '2026-11-24T12:00:00.000Z',
    });
    const cloudOlder: Partial<PersistedState> = {
      vocabSRS: {
        v1: {
          wordId: 'v1',
          easeFactor: 2.5,
          intervalDays: 1,
          repetitions: 1,
          nextReviewAt: '2026-11-25T10:00:00.000Z',
          lastReviewedAt: '2026-11-24T06:00:00.000Z',
        },
      },
      updatedAt: '2026-11-24T06:00:00.000Z',
    };

    const merged = mergePersistedStates(localNewer, cloudOlder, { today: '2026-11-24' });
    expect(merged.vocabSRS.v1.repetitions).toBe(3);
    expect(merged.vocabSRS.v1.intervalDays).toBe(14);
  });

  it('cộng thưởng XP Daily Quests (+25 / +40 / +60) đúng 1 lần duy nhất mỗi ngày', () => {
    expect(computeNewlyCompletedQuestXp([], ['quest_streak'])).toBe(25);
    expect(computeNewlyCompletedQuestXp(['quest_streak'], ['quest_streak'])).toBe(0);
    expect(computeNewlyCompletedQuestXp(['quest_streak'], ['quest_streak', 'quest_vocab'])).toBe(40);
    expect(
      computeNewlyCompletedQuestXp(
        ['quest_streak', 'quest_vocab'],
        ['quest_streak', 'quest_vocab', 'quest_lesson']
      )
    ).toBe(60);
    expect(
      computeNewlyCompletedQuestXp(
        ['quest_streak', 'quest_vocab', 'quest_lesson'],
        ['quest_streak', 'quest_vocab', 'quest_lesson']
      )
    ).toBe(0);
  });

  it('sanitizeImportedState chống crash khi nạp file cũ/thiếu trường và từ chối JSON sai', () => {
    const base = makeState();
    const bad = sanitizeImportedState({ foo: 'bar' }, base, base, '2026-11-24');
    expect(bad.ok).toBe(false);

    // File sao lưu cũ thiếu skillBands, daily, customVocab và band vượt ngưỡng
    const legacy = sanitizeImportedState(
      {
        profile: { displayName: 'Legacy User', xp: 150, currentBand: 15, targetBand: 1 },
        lessonProgress: { l1: { skill: 'reading', score: 140 }, badRow: { skill: 'invalid' } },
        savedVocabIds: ['v1', 123, ''],
      },
      base,
      { ...base, daily: createFreshDaily('2026-11-24') },
      '2026-11-24'
    );
    expect(legacy.ok).toBe(true);
    if (legacy.ok) {
      expect(legacy.state.profile.displayName).toBe('Legacy User');
      expect(legacy.state.profile.currentBand).toBe(9.0);
      expect(legacy.state.profile.targetBand).toBe(2.0);
      expect(legacy.state.profile.skillBands).toEqual(base.profile.skillBands);
      expect(legacy.state.lessonProgress.l1.score).toBe(100);
      expect(legacy.state.lessonProgress.badRow).toBeUndefined();
      expect(legacy.state.savedVocabIds).toEqual(['v1']);
      expect(legacy.state.customVocab).toEqual([]);
    }
  });

  it('không hồi sinh lại thẻ SRS đã bỏ chọn khỏi savedVocabIds và tôn trọng máy cục bộ mới hơn khi syncNow', () => {
    const localAfterUncheck = makeState({
      savedVocabIds: [],
      updatedAt: '2026-11-24T14:00:00.000Z',
    });
    const cloudOlder: Partial<PersistedState> = {
      savedVocabIds: ['v1', 'v2'],
      vocabSRS: localAfterUncheck.vocabSRS,
      updatedAt: '2026-11-24T10:00:00.000Z',
    };

    const merged = mergePersistedStates(localAfterUncheck, cloudOlder, {
      today: '2026-11-24',
      preferCloudSavedVocab: false,
    });
    expect(merged.savedVocabIds).toEqual([]);

    // Khi cả 2 máy đều bỏ chọn hết nhưng vẫn còn lịch sử vocabSRS -> vẫn giữ mảng rỗng
    const mergedBothEmpty = mergePersistedStates(
      localAfterUncheck,
      { savedVocabIds: [], vocabSRS: localAfterUncheck.vocabSRS, updatedAt: '2026-11-24T14:00:00.000Z' },
      { today: '2026-11-24', preferCloudSavedVocab: false }
    );
    expect(mergedBothEmpty.savedVocabIds).toEqual([]);
  });

  it('sinh UUID v4 hợp lệ cho PracticeSubmission và khử trùng bản ghi cũ sub_... khi đồng bộ với bản ghi UUID từ Supabase', () => {
    const id = generateSubmissionId();
    expect(isValidUuid(id)).toBe(true);

    const local = makeState({
      submissions: [
        {
          id: 'sub_legacy_1234',
          skill: 'writing',
          promptId: 'w1',
          promptTitle: 'Task 1',
          content: 'My writing response',
          bandEstimate: 5.5,
          createdAt: '2026-11-24T07:00:00.000Z',
        },
      ],
    });
    const cloud: Partial<PersistedState> = {
      submissions: [
        {
          id,
          skill: 'writing',
          promptId: 'w1',
          promptTitle: 'Task 1',
          content: 'My writing response',
          bandEstimate: 5.5,
          createdAt: '2026-11-24T07:00:02.000Z',
        },
      ],
    };

    const merged = mergePersistedStates(local, cloud, { today: '2026-11-24' });
    expect(merged.submissions).toHaveLength(1);
    expect(merged.submissions[0].id).toBe(id);
  });
});
