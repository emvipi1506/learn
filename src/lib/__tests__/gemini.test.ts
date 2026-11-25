import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanAudioMimeType,
  evaluateWithGemini,
  extractJsonObject,
  parseAndNormalizeGeminiFeedback,
  transcribeAudioWithGemini,
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

  it('giữ lại transcriptEn khi parseAndNormalizeGeminiFeedback nhận được từ phản hồi audio', () => {
    const raw = JSON.stringify({
      overallBand: 6.0,
      transcriptEn: '  I usually drink coffee in the morning before studying.  ',
      criteria: [{ name: 'Fluency & Coherence', score: 6.0, commentVi: 'Trôi chảy' }],
      strengthsVi: ['Phát âm rõ'],
      improvementsVi: ['Kéo dài câu trả lời'],
      upgradedVersionEn: 'I tend to have a cup of coffee every morning.',
      encouragementVi: 'Tiếp tục phát huy!',
    });

    const parsed = parseAndNormalizeGeminiFeedback(raw);
    expect(parsed.transcriptEn).toBe('I usually drink coffee in the morning before studying.');
  });

  it('evaluateWithGemini đính kèm inlineData audio đã chuẩn hóa mimeType khi có audioBlob', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    overallBand: 6.5,
                    transcriptEn: 'Hello, my name is Phong and I live in Hanoi.',
                    criteria: [{ name: 'Pronunciation', score: 6.5, commentVi: 'Rõ ràng' }],
                    strengthsVi: ['Tự nhiên'],
                    improvementsVi: ['Thêm từ nối'],
                    upgradedVersionEn: 'Hi, I am Phong, currently residing in Hanoi.',
                    encouragementVi: 'Rất tốt!',
                  }),
                },
              ],
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const audioBlob = new Blob(['fake-opus-audio'], { type: 'audio/webm;codecs=opus' });
    const res = await evaluateWithGemini({
      apiKey: 'AIza-audio-key',
      skill: 'speaking',
      promptTitle: 'Hometown',
      promptText: 'Tell me about your hometown.',
      userResponse: '',
      audioBlob,
    });

    expect(res.overallBand).toBe(6.5);
    expect(res.transcriptEn).toBe('Hello, my name is Phong and I live in Hanoi.');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIza-audio-key');
    const body = JSON.parse(String(init.body));
    const parts = body.contents[0].parts;
    expect(parts).toHaveLength(2);
    expect(parts[1].inlineData.mimeType).toBe('audio/webm');
    expect(parts[1].inlineData.data).toBe(btoa('fake-opus-audio'));
  });

  it('transcribeAudioWithGemini trả về chuỗi đã làm sạch và báo lỗi khi AI không nghe rõ', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '```text\nI enjoy reading books in the evening.\n```' }],
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '   ' }] } }],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const blob = new Blob(['sample-mp4'], { type: 'audio/mp4;codecs=mp4a.40.2' });
    const text = await transcribeAudioWithGemini({
      apiKey: 'AIza-stt-key',
      audioBlob: blob,
      promptHint: 'Hobbies',
    });
    expect(text).toBe('I enjoy reading books in the evening.');

    await expect(
      transcribeAudioWithGemini({
        apiKey: 'AIza-stt-key',
        audioBlob: blob,
      })
    ).rejects.toThrow(/Không nghe rõ lời nói/i);
  });

  it('cleanAudioMimeType chuẩn hóa video/mp4 và fallback WebKit an toàn', () => {
    expect(cleanAudioMimeType('video/mp4')).toBe('audio/mp4');
    expect(cleanAudioMimeType('audio/mp4;codecs=mp4a.40.2')).toBe('audio/mp4');
    expect(cleanAudioMimeType('audio/webm;codecs=opus')).toBe('audio/webm');
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    });
    expect(cleanAudioMimeType('')).toBe('audio/mp4');
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
    });
    expect(cleanAudioMimeType('')).toBe('audio/webm');
  });

  it('phân biệt lỗi HTTP 400 / 401 / 429 / 503 và API_KEY_INVALID thay vì gộp chung', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid audio payload',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"error":{"status":"INVALID_ARGUMENT","message":"API key not valid"}}',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Quota exceeded',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service unavailable',
      });
    vi.stubGlobal('fetch', fetchMock);

    const call = () =>
      evaluateWithGemini({
        apiKey: 'AIza-test',
        skill: 'writing',
        promptTitle: 'Test',
        promptText: 'Prompt',
        userResponse: 'Enough words for writing evaluation test.',
      });

    await expect(call()).rejects.toThrow(/định dạng âm thanh.*400/i);
    await expect(call()).rejects.toThrow(/API Key không hợp lệ/i);
    await expect(call()).rejects.toThrow(/hạn mức.*429/i);
    await expect(call()).rejects.toThrow(/quá tải.*503/i);
  });

  it('bắt lỗi response.json() hỏng và kiểm tra promptFeedback.blockReason / finishReason', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON');
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          promptFeedback: { blockReason: 'SAFETY' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"partial":' }] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const call = () =>
      evaluateWithGemini({
        apiKey: 'AIza-test',
        skill: 'writing',
        promptTitle: 'Test',
        promptText: 'Prompt',
        userResponse: 'Enough words for writing evaluation test.',
      });

    await expect(call()).rejects.toThrow(/JSON không hợp lệ/i);
    await expect(call()).rejects.toThrow(/bộ lọc an toàn/i);
    await expect(call()).rejects.toThrow(/MAX_TOKENS/i);
    await expect(call()).rejects.toThrow(/SAFETY/i);
  });
});
