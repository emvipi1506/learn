import { describe, expect, it } from 'vitest';
import { KOREAN_VOCAB_BANK } from '../../data/koreanVocab';
import { READING_LESSONS, SPEAKING_LESSONS, WRITING_LESSONS } from '../../data/lessons';
import { VOCABULARY_BANK } from '../../data/vocabulary';
import { estimateMonthsToTarget } from '../../data/roadmap';

describe('Tính toàn vẹn học liệu & lộ trình (Data Integrity)', () => {
  it('KOREAN_VOCAB_BANK giữ đủ 317 thẻ với ID duy nhất và không gắn nhầm pos "số đếm" ngoài Bài 8 & 10', () => {
    expect(KOREAN_VOCAB_BANK).toHaveLength(317);
    const ids = new Set(KOREAN_VOCAB_BANK.map((c) => c.id));
    expect(ids.size).toBe(317);

    const numberCards = KOREAN_VOCAB_BANK.filter((c) => c.pos === 'số đếm');
    expect(numberCards).toHaveLength(23); // 13 thẻ số Hán Hàn (Bài 8) + 10 thẻ số thuần Hàn (Bài 10)
    for (const card of numberCards) {
      expect([8, 10]).toContain(card.lessonNum);
    }
  });

  it('KOREAN_VOCAB_BANK có exampleEn thuần tiếng Hàn (không dính chú thích tiếng Việt)', () => {
    const allowedAcronyms = /\b(K-pop|IT|TV|PC|SNS)\b/g;
    for (const card of KOREAN_VOCAB_BANK) {
      const stripped = card.exampleEn.replace(allowedAcronyms, '');
      expect(stripped, `Card ${card.id} has non-Korean text in exampleEn: ${card.exampleEn}`).not.toMatch(
        /[a-zA-ZÀ-ỹà-ỹ]/
      );
    }
  });

  it('WRITING_LESSONS có bài mẫu đạt đủ tối thiểu minWords của từng đề', () => {
    for (const lesson of WRITING_LESSONS) {
      const words = lesson.sampleAnswer.trim().split(/\s+/).filter(Boolean).length;
      expect(words, `${lesson.id} sampleAnswer (${words}) < minWords (${lesson.minWords})`).toBeGreaterThanOrEqual(
        lesson.minWords
      );
    }
  });

  it('READING_LESSONS liên kết đủ vocabId hợp lệ tới VOCABULARY_BANK', () => {
    const vocabIds = new Set(VOCABULARY_BANK.map((v) => v.id));
    for (const lesson of READING_LESSONS) {
      for (const [word, entry] of Object.entries(lesson.glossary)) {
        expect(entry.vocabId, `Missing vocabId on ${lesson.id}.${word}`).toBeTruthy();
        expect(vocabIds.has(entry.vocabId!), `Unknown vocabId ${entry.vocabId} on ${lesson.id}.${word}`).toBe(true);
      }
    }
  });

  it('SPEAKING_LESSONS có đầy đủ IPA cho từng từ trong các cụm keyVocab', () => {
    for (const lesson of SPEAKING_LESSONS) {
      for (const kv of lesson.keyVocab) {
        const wordParts = kv.word.trim().split(/\s+/).length;
        const ipaInner = kv.ipa.replace(/^\/|\/$/g, '').trim();
        const ipaParts = ipaInner.split(/\s+/).length;
        expect(ipaParts, `${lesson.id} keyVocab "${kv.word}" thiếu IPA: ${kv.ipa}`).toBeGreaterThanOrEqual(
          wordParts
        );
      }
    }
  });

  it('estimateMonthsToTarget trả về 0 giờ / 0 tháng khi currentBand >= targetBand và chuẩn hóa dailyMinutes 60–240', () => {
    expect(estimateMonthsToTarget(6.5, 6.5, 120)).toEqual({
      hoursNeeded: 0,
      months: 0,
      recommendedAct: 4,
    });
    expect(estimateMonthsToTarget(7.0, 6.5, 120)).toEqual({
      hoursNeeded: 0,
      months: 0,
      recommendedAct: 4,
    });
    const est = estimateMonthsToTarget(3.0, 6.5, 30); // clamped lên 60p/ngày
    expect(est.hoursNeeded).toBe(630);
    expect(est.months).toBe(21);
  });
});
