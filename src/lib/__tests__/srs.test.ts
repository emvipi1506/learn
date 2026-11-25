import { describe, expect, it } from 'vitest';
import {
  calculateNextSRS,
  createInitialSRS,
  formatIntervalLabel,
  isCardDue,
} from '../srs';

describe('Thuật toán SRS SM-2 (srs.ts)', () => {
  it('tạo trạng thái khởi đầu hợp lệ và đến hạn ngay lập tức', () => {
    const card = createInitialSRS('w_1');
    expect(card.wordId).toBe('w_1');
    expect(card.easeFactor).toBe(2.5);
    expect(card.intervalDays).toBe(0);
    expect(card.repetitions).toBe(0);
    expect(isCardDue(card)).toBe(true);
    expect(isCardDue(undefined)).toBe(true);
  });

  it('tăng khoảng cách ôn theo đúng lộ trình khi đánh giá Good (2) liên tiếp', () => {
    const c0 = createInitialSRS('w_good');
    const c1 = calculateNextSRS(c0, 2);
    expect(c1.repetitions).toBe(1);
    expect(c1.intervalDays).toBe(1);
    expect(c1.lastReviewedAt).toBeTruthy();

    const c2 = calculateNextSRS(c1, 2);
    expect(c2.repetitions).toBe(2);
    expect(c2.intervalDays).toBe(6);

    const c3 = calculateNextSRS(c2, 2);
    expect(c3.repetitions).toBe(3);
    expect(c3.intervalDays).toBeGreaterThan(6);
    expect(isCardDue(c3)).toBe(false);
  });

  it('đặt lại repetitions = 0 và hẹn lại sau ~10 phút khi đánh giá Again (0)', () => {
    const mastered = {
      ...createInitialSRS('w_again'),
      repetitions: 4,
      intervalDays: 20,
      easeFactor: 2.3,
    };
    const before = Date.now();
    const updated = calculateNextSRS(mastered, 0);
    const diffMinutes = (Date.parse(updated.nextReviewAt) - before) / 60000;

    expect(updated.repetitions).toBe(0);
    expect(updated.intervalDays).toBe(1);
    expect(diffMinutes).toBeGreaterThanOrEqual(9.5);
    expect(diffMinutes).toBeLessThanOrEqual(11);
  });

  it('không bao giờ hạ easeFactor thấp hơn 1.3', () => {
    let card = createInitialSRS('w_floor');
    for (let i = 0; i < 15; i++) {
      card = calculateNextSRS(card, 0);
    }
    expect(card.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('trả về nhãn thời gian đọc được cho từng mức đánh giá', () => {
    const fresh = createInitialSRS('w_label');
    expect(formatIntervalLabel(fresh, 0)).toBe('10 phút');
    expect(formatIntervalLabel(fresh, 2)).toBe('1 ngày');
    expect(formatIntervalLabel(fresh, 3)).toBe('4 ngày');
  });

  it('isCardDue trả true khi nextReviewAt lỗi NaN và tự đến hạn lại theo nowMs sau 10 phút', () => {
    const corrupted = {
      ...createInitialSRS('w_bad_date'),
      nextReviewAt: 'not-a-valid-date',
    };
    expect(isCardDue(corrupted)).toBe(true);

    const base = createInitialSRS('w_again_tick');
    const updated = calculateNextSRS(base, 0);
    const dueMs = Date.parse(updated.nextReviewAt);
    expect(isCardDue(updated, dueMs - 60_000)).toBe(false);
    expect(isCardDue(updated, dueMs + 1_000)).toBe(true);
  });
});
