import { describe, expect, it } from 'vitest';
import { getSpeakableText, splitTextForTTS } from '../speech';
import { computeDictationDiff } from '../../pages/ListeningPage';
import { KOREAN_VOCAB_BANK } from '../../data/koreanVocab';

describe('Xử lý giọng đọc TTS & Ngữ pháp tiếng Hàn (speech.ts)', () => {
  it('phát trực tiếp câu ví dụ tiếng Hàn hoàn chỉnh cho thẻ ngữ pháp (tránh làm vỡ N1/N2)', () => {
    const grammarCard = {
      lang: 'ko' as const,
      word: 'N1 + 에서 N2 + 까지',
      pos: 'ngữ pháp',
      exampleEn: '여기에서 서울역까지 어떻게 가요?',
    };
    expect(getSpeakableText(grammarCard)).toBe('여기에서 서울역까지 어떻게 가요?');
  });

  it('tất cả thẻ ngữ pháp trong KOREAN_VOCAB_BANK đều tạo ra chuỗi Hangul tự nhiên không còn ký tự N1/N2/V/A', () => {
    const grammarCards = KOREAN_VOCAB_BANK.filter((c) => c.pos === 'ngữ pháp');
    expect(grammarCards.length).toBeGreaterThan(20);
    for (const card of grammarCards) {
      const speakable = getSpeakableText(card);
      expect(speakable).toMatch(/[가-힣]/);
      expect(speakable).not.toMatch(/\b(N1|N2|V\/A)\b/);
    }
  });

  it('làm sạch ghi chú ngoặc đơn cho từ vựng tiếng Hàn và giữ nguyên từ tiếng Anh', () => {
    expect(
      getSpeakableText({
        lang: 'ko',
        word: '케이 팝(K-pop)',
        pos: 'từ vựng',
        exampleEn: '케이 팝을 좋아해요.',
      })
    ).toBe('케이 팝');

    expect(
      getSpeakableText({
        lang: 'en',
        word: 'alleviate',
        pos: 'v',
        exampleEn: 'Public transport helps alleviate congestion.',
      })
    ).toBe('alleviate');
  });

  it('tách bài mẫu Speaking dài (~123 từ) thành các đoạn <= 160 ký tự mà không mất từ', () => {
    const longSample =
      'One memorable teacher who had a profound influence on my academic life was my high school literature teacher. She always encouraged us to think critically instead of memorizing essays mechanically. Whenever I felt discouraged before important exams, she patiently guided me through complex passages and showed me how to organize my ideas clearly. Thanks to her support, I developed both confidence and a genuine love for reading that still helps me in my IELTS preparation today.';
    const chunks = splitTextForTTS(longSample, 160);
    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(160);
    }
    expect(chunks.join(' ')).toBe(longSample);
  });

  it('xử lý chuỗi rỗng và câu dài không có dấu chấm', () => {
    expect(splitTextForTTS('   ')).toEqual([]);
    const runOn = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
    const chunks = splitTextForTTS(runOn, 80);
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(80);
    }
    expect(chunks.join(' ')).toBe(runOn);
  });
});

describe('So khớp Nghe Chép Chính Tả bảo toàn thứ tự (ListeningPage.tsx)', () => {
  it('đánh dấu đúng hoàn toàn khi gõ đúng thứ tự (bỏ qua hoa thường và dấu câu)', () => {
    const diff = computeDictationDiff('The train leaves at ten.', 'the train leaves at ten');
    expect(diff.every((t) => t.matched)).toBe(true);
  });

  it('không tô xanh tất cả khi người dùng gõ đảo ngược thứ tự từ', () => {
    const diff = computeDictationDiff('The train leaves at ten.', 'ten at leaves train the');
    const matchedCount = diff.filter((t) => t.matched).length;
    expect(matchedCount).toBe(1);
  });

  it('không tô xanh nhiều từ khi lặp lại một từ duy nhất', () => {
    const diff = computeDictationDiff('The cat saw the dog', 'the');
    const matchedCount = diff.filter((t) => t.matched).length;
    expect(matchedCount).toBe(1);
  });

  it('định vị chính xác 1 từ bị thiếu ở giữa câu mà vẫn giữ xanh các từ đúng phía sau', () => {
    const diff = computeDictationDiff('The train leaves at ten', 'The train at ten');
    expect(diff.map((d) => d.matched)).toEqual([true, true, false, true, true]);
  });
});
