import type { VocabSRSState } from '../types';

/**
 * Đánh giá chất lượng nhớ thẻ theo thuật toán SM-2:
 * 0 = Quên hoàn toàn (Again)
 * 1 = Nhớ mơ hồ / Khó (Hard)
 * 2 = Nhớ tốt (Good)
 * 3 = Quá dễ (Easy)
 */
export type ReviewRating = 0 | 1 | 2 | 3;

export function createInitialSRS(wordId: string): VocabSRSState {
  return {
    wordId,
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    nextReviewAt: new Date().toISOString(),
  };
}

export function calculateNextSRS(current: VocabSRSState, rating: ReviewRating): VocabSRSState {
  const qualityMap: Record<ReviewRating, number> = {
    0: 1,
    1: 3,
    2: 4,
    3: 5,
  };
  const q = qualityMap[rating];

  let { easeFactor, intervalDays, repetitions } = current;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) {
      intervalDays = rating === 3 ? 4 : 1;
    } else if (repetitions === 1) {
      intervalDays = rating === 1 ? 3 : rating === 3 ? 8 : 6;
    } else {
      const multiplier = rating === 1 ? 0.85 : rating === 3 ? 1.3 : 1;
      intervalDays = Math.max(1, Math.round(intervalDays * easeFactor * multiplier));
    }
    repetitions += 1;
  }

  easeFactor = Math.max(1.3, Number((easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))).toFixed(2)));

  const now = new Date();
  const next = new Date(now);
  if (rating === 0) {
    // Nếu quên hoàn toàn, nhắc lại sau 10 phút
    next.setMinutes(next.getMinutes() + 10);
  } else {
    next.setDate(next.getDate() + intervalDays);
  }

  return {
    wordId: current.wordId,
    easeFactor,
    intervalDays,
    repetitions,
    nextReviewAt: next.toISOString(),
    lastReviewedAt: now.toISOString(),
  };
}

export function isCardDue(card?: VocabSRSState): boolean {
  if (!card) return true;
  return new Date(card.nextReviewAt).getTime() <= Date.now();
}

export function formatIntervalLabel(card: VocabSRSState | undefined, rating: ReviewRating): string {
  const base = card ?? createInitialSRS('preview');
  const next = calculateNextSRS(base, rating);
  if (rating === 0) return '10 phút';
  if (next.intervalDays === 1) return '1 ngày';
  return `${next.intervalDays} ngày`;
}
