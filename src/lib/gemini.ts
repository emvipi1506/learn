import type { AIFeedbackResult } from '../types';

const GEMINI_KEY_STORAGE = 'grimoire_gemini_api_key';
const GEMINI_TIMEOUT_MS = 25000;

export function getSavedGeminiKey(): string {
  try {
    return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function saveGeminiKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (!trimmed) {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    } else {
      localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
    }
  } catch {
    // ignore storage errors
  }
}

export function extractJsonObject(raw: string): string {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return cleaned.slice(first, last + 1);
  }
  return cleaned;
}

function normalizeBandScore(value: unknown, fallback = 5.0): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const clamped = Math.max(0, Math.min(9, num));
  return Math.round(clamped * 2) / 2;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((s) => s.length > 0);
}

/**
 * Phân tích an toàn và chuẩn hóa phản hồi JSON từ Gemini AI trước khi hiển thị lên UI
 */
export function parseAndNormalizeGeminiFeedback(rawText: string): AIFeedbackResult {
  const candidate = extractJsonObject(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new Error('Phản hồi từ AI không phải JSON hợp lệ. Vui lòng thử chấm lại.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Dữ liệu đánh giá từ AI chưa đúng định dạng.');
  }

  const obj = parsed as Record<string, unknown>;
  const rawCriteria = Array.isArray(obj.criteria) ? obj.criteria : [];
  const criteria = rawCriteria
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const c = item as Record<string, unknown>;
      const name = typeof c.name === 'string' && c.name.trim() ? c.name.trim() : '';
      const commentVi = typeof c.commentVi === 'string' ? c.commentVi.trim() : '';
      if (!name) return null;
      return {
        name,
        score: normalizeBandScore(c.score, 5.0),
        commentVi: commentVi || 'Chưa có nhận xét chi tiết.',
      };
    })
    .filter((c): c is { name: string; score: number; commentVi: string } => c !== null);

  if (criteria.length === 0) {
    throw new Error('Dữ liệu đánh giá từ AI thiếu điểm các tiêu chí IELTS.');
  }

  const avgCriteria =
    criteria.reduce((sum, item) => sum + item.score, 0) / criteria.length;
  const overallBand =
    typeof obj.overallBand === 'number' && Number.isFinite(obj.overallBand)
      ? normalizeBandScore(obj.overallBand)
      : normalizeBandScore(avgCriteria);

  const strengthsVi = normalizeStringArray(obj.strengthsVi);
  const improvementsVi = normalizeStringArray(obj.improvementsVi);

  return {
    overallBand,
    criteria,
    strengthsVi: strengthsVi.length > 0 ? strengthsVi : ['Bài làm đã bám sát chủ đề được giao.'],
    improvementsVi:
      improvementsVi.length > 0
        ? improvementsVi
        : ['Mở rộng thêm từ vựng học thuật và cấu trúc câu phức để nâng Band.'],
    upgradedVersionEn:
      typeof obj.upgradedVersionEn === 'string' ? obj.upgradedVersionEn.trim() : '',
    encouragementVi:
      typeof obj.encouragementVi === 'string' && obj.encouragementVi.trim()
        ? obj.encouragementVi.trim()
        : 'Giữ vững nhịp luyện tập mỗi ngày, ngọn lửa Band 6.5 đang tiến rất gần.',
  };
}

export async function evaluateWithGemini(params: {
  apiKey: string;
  skill: 'writing' | 'speaking';
  promptTitle: string;
  promptText: string;
  userResponse: string;
  targetBand?: number;
}): Promise<AIFeedbackResult> {
  const { apiKey, skill, promptTitle, promptText, userResponse, targetBand = 6.5 } = params;

  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error('Bạn chưa nhập Gemini API Key trong mục Cài đặt.');
  }

  const criteriaSpec =
    skill === 'writing'
      ? '4 tiêu chí IELTS Writing: Task Achievement / Response (TA/TR), Coherence & Cohesion (CC), Lexical Resource (LR), Grammatical Range & Accuracy (GRA)'
      : '4 tiêu chí IELTS Speaking: Fluency & Coherence (FC), Lexical Resource (LR), Grammatical Range & Accuracy (GRA), Pronunciation / Clarity ước lượng từ transcript (PR)';

  const systemInstruction = `Bạn là Giám khảo IELTS thân thiện, chuyên kèm học viên Việt Nam đi từ mất gốc lên Band ${targetBand}.
Hãy chấm bài ${skill.toUpperCase()} dưới đây công tâm theo ${criteriaSpec}.
TRẢ VỀ DUY NHẤT 1 JSON HỢP LỆ (không kèm markdown hay chữ thừa) theo đúng cấu trúc:
{
  "overallBand": 5.5,
  "criteria": [
    { "name": "Tên tiêu chí", "score": 5.5, "commentVi": "Nhận xét ngắn gọn, dễ hiểu bằng tiếng Việt kèm ví dụ lỗi từ bài làm" }
  ],
  "strengthsVi": ["Điểm tốt 1", "Điểm tốt 2"],
  "improvementsVi": ["Cách sửa cụ thể 1 (kèm câu gốc -> câu sửa)", "Cách sửa cụ thể 2"],
  "upgradedVersionEn": "Phiên bản viết lại tự nhiên đạt khoảng Band 6.5 - 7.0 bằng tiếng Anh",
  "encouragementVi": "1 câu động viên ngắn gọn theo phong cách Pháp sư cố vấn Dark Fantasy nhẹ nhàng"
}
Điểm số phải làm tròn theo thang IELTS (bội số của 0.5, từ 2.0 đến 9.0).`;

  const userMessage = `Chủ đề: ${promptTitle}
Đề bài: ${promptText}

Bài làm của học viên:
"""
${userResponse}
"""`;

  const endpoint =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': trimmedKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemInstruction}\n\n${userMessage}` }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: 'application/json',
        },
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Quá thời gian phản hồi AI (25 giây). Hãy kiểm tra kết nối mạng và thử lại.');
    }
    throw new Error('Không thể kết nối tới máy chủ Gemini AI. Vui lòng kiểm tra kết nối mạng.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new Error('Gemini API Key không hợp lệ hoặc chưa được cấp quyền. Hãy kiểm tra lại trong mục Cài đặt.');
    }
    throw new Error(`Lỗi kết nối Gemini API (${response.status}): ${errText.slice(0, 160)}`);
  }

  const data = await response.json();
  const rawText: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('\n') || '';

  if (!rawText) {
    throw new Error('AI không trả về nội dung đánh giá. Vui lòng thử lại.');
  }

  return parseAndNormalizeGeminiFeedback(rawText);
}
