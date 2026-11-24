import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateWithGemini,
  extractJsonObject,
  parseAndNormalizeGeminiFeedback,
} from '../gemini';

describe('Gemini AI Parser & Security (gemini.ts)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bóc tách JSON bọc trong markdown code fence', () => {
    const raw = 'Đây là kết quả:\n```json\n{"overallBand": 6.5}\n```\nChúc bạn học tốt!';
    expect(extractJsonObject(raw)).toBe('{"overallBand": 6.5}');
  });

  it('chuẩn hóa điểm số vào thang [0, 9] bội số 0.5 và lọc mảng chuỗi hợp lệ', () => {
    const raw = JSON.stringify({
      overallBand: 11.4,
      criteria: [
        { name: 'Task Response', score: -2, commentVi: 'Cần mở rộng ý' },
        { name: 'Coherence', score: 6.3, commentVi: 'Mạch lạc tốt' },
        { name: '', score: 5 }, // bị loại vì thiếu tên
      ],
      strengthsVi: ['Ý rõ', '', 42],
      improvementsVi: null,
      upgradedVersionEn: '  Upgraded essay text.  ',
    });

    const parsed = parseAndNormalizeGeminiFeedback(raw);
    expect(parsed.overallBand).toBe(9);
    expect(parsed.criteria).toHaveLength(2);
    expect(parsed.criteria[0].score).toBe(0);
    expect(parsed.criteria[1].score).toBe(6.5);
    expect(parsed.strengthsVi).toEqual(['Ý rõ']);
    expect(parsed.improvementsVi.length).toBeGreaterThan(0);
    expect(parsed.upgradedVersionEn).toBe('Upgraded essay text.');
    expect(parsed.encouragementVi.length).toBeGreaterThan(0);
  });

  it('báo lỗi rõ ràng khi AI trả JSON hỏng hoặc thiếu criteria', () => {
    expect(() => parseAndNormalizeGeminiFeedback('{broken json')).toThrow(/JSON hợp lệ/i);
    expect(() => parseAndNormalizeGeminiFeedback('{"overallBand": 6.0, "criteria": []}')).toThrow(
      /thiếu điểm các tiêu chí/i
    );
  });

  it('gửi API key qua HTTP header x-goog-api-key thay vì URL query ?key=', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    overallBand: 6.0,
                    criteria: [{ name: 'LR', score: 6.0, commentVi: 'Ổn' }],
                    strengthsVi: ['Tốt'],
                    improvementsVi: ['Thêm collocation'],
                    upgradedVersionEn: 'Sample upgraded.',
                    encouragementVi: 'Cố lên!',
                  }),
                },
              ],
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await evaluateWithGemini({
      apiKey: 'AIza-secret-test-key',
      skill: 'writing',
      promptTitle: 'Test',
      promptText: 'Write an essay',
      userResponse: 'This is a sample essay response with enough content.',
    });

    expect(res.overallBand).toBe(6.0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('AIza-secret-test-key');
    expect(url).not.toContain('?key=');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIza-secret-test-key');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
