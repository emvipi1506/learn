import type { AIFeedbackResult } from '../types';

const GEMINI_KEY_STORAGE = 'grimoire_gemini_api_key';
const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GEMINI_TIMEOUT_MS = 25000;
const GEMINI_AUDIO_TIMEOUT_MS = 35000;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export function cleanAudioMimeType(mimeType: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase();
  if (base === 'video/mp4') return 'audio/mp4';
  if (base.startsWith('audio/')) return base;
  if (!base && typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    const isWebKit =
      /iP(hone|ad|od)/i.test(ua) ||
      (/AppleWebKit/i.test(ua) && !/Chrome|Chromium|Edg\//i.test(ua));
    if (isWebKit) return 'audio/mp4';
  }
  return 'audio/webm';
}

export async function blobToBase64(blob: Blob): Promise<string> {
  if (blob.size > MAX_AUDIO_BYTES) {
    throw new Error('Bản ghi âm vượt quá 15MB. Hãy thu ngắn hơn hoặc chép văn bản để chấm.');
  }
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

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

  const transcriptEn =
    typeof obj.transcriptEn === 'string' && obj.transcriptEn.trim()
      ? obj.transcriptEn.trim()
      : undefined;

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
    ...(transcriptEn ? { transcriptEn } : {}),
  };
}

async function callGeminiGenerateContent(params: {
  apiKey: string;
  parts: Array<Record<string, unknown>>;
  temperature: number;
  responseMimeType?: string;
  timeoutMs: number;
}): Promise<string> {
  const { apiKey, parts, temperature, responseMimeType, timeoutMs } = params;
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error('Bạn chưa nhập Gemini API Key trong mục Cài đặt.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    const generationConfig: Record<string, unknown> = {
      temperature,
      thinkingConfig: { thinkingBudget: 0 },
    };
    if (responseMimeType) {
      generationConfig.responseMimeType = responseMimeType;
    }
    response = await fetch(GEMINI_ENDPOINT, {
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
            parts,
          },
        ],
        generationConfig,
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `Quá thời gian phản hồi AI (${Math.round(timeoutMs / 1000)} giây). Hãy kiểm tra kết nối mạng và thử lại.`
      );
    }
    throw new Error('Không thể kết nối tới máy chủ Gemini AI. Vui lòng kiểm tra kết nối mạng.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errText = await response.text();
    if (
      response.status === 401 ||
      response.status === 403 ||
      /api_key_invalid|api key not valid/i.test(errText)
    ) {
      throw new Error('Gemini API Key không hợp lệ hoặc chưa được cấp quyền. Hãy kiểm tra lại trong mục Cài đặt.');
    }
    if (response.status === 400) {
      throw new Error(
        'Yêu cầu hoặc định dạng âm thanh gửi lên Gemini AI chưa hợp lệ (400). Hãy thử thu lại hoặc gõ transcript.'
      );
    }
    if (response.status === 429) {
      throw new Error('Đã vượt quá hạn mức gọi Gemini API (429). Vui lòng đợi một lát rồi thử lại.');
    }
    if (response.status === 500 || response.status === 503) {
      throw new Error(`Máy chủ Gemini AI đang quá tải hoặc gặp sự cố (${response.status}). Vui lòng thử lại sau ít phút.`);
    }
    throw new Error(`Lỗi kết nối Gemini API (${response.status}): ${errText.slice(0, 160)}`);
  }

  let data: {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  try {
    data = await response.json();
  } catch {
    throw new Error('Máy chủ Gemini AI trả về dữ liệu JSON không hợp lệ. Vui lòng thử lại.');
  }

  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(
      `Nội dung gửi lên bị bộ lọc an toàn của AI chặn (${blockReason}). Hãy điều chỉnh lại nội dung.`
    );
  }

  const candidate = data?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  if (finishReason === 'SAFETY') {
    throw new Error('Phản hồi từ AI bị chặn bởi bộ lọc an toàn (SAFETY). Hãy chỉnh sửa nội dung và thử lại.');
  }
  if (finishReason === 'RECITATION') {
    throw new Error('Phản hồi từ AI bị chặn do trùng lặp tài liệu (RECITATION). Hãy diễn đạt lại theo ý của bạn.');
  }
  if (finishReason === 'MAX_TOKENS') {
    throw new Error('Phản hồi từ AI bị cắt ngắn do vượt giới hạn độ dài (MAX_TOKENS). Vui lòng thử lại.');
  }

  return (
    candidate?.content?.parts?.map((p) => p.text || '').join('\n') || ''
  );
}

/**
 * Chép lời nguyên văn tiếng Anh từ bản ghi âm Speaking bằng Gemini 2.5 Flash
 */
export async function transcribeAudioWithGemini(params: {
  apiKey: string;
  audioBlob: Blob;
  promptHint?: string;
}): Promise<string> {
  const { apiKey, audioBlob, promptHint } = params;
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('Bản ghi âm trống. Hãy thu âm lại rồi thử chép lời.');
  }

  const base64Audio = await blobToBase64(audioBlob);
  const mimeType = cleanAudioMimeType(audioBlob.type);
  const instruction = `Listen to this IELTS Speaking audio recording and transcribe accurately what the speaker says in English.
${promptHint ? `Topic context: ${promptHint}\n` : ''}Rules:
- Return ONLY the plain English transcript text with natural punctuation.
- Do NOT add markdown, labels, translations, or explanations.
- If no intelligible speech is heard, return an empty string.`;

  const rawText = await callGeminiGenerateContent({
    apiKey,
    parts: [
      { text: instruction },
      { inlineData: { mimeType, data: base64Audio } },
    ],
    temperature: 0.1,
    timeoutMs: GEMINI_AUDIO_TIMEOUT_MS,
  });

  const cleaned = rawText.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
  if (!cleaned) {
    throw new Error('Không nghe rõ lời nói tiếng Anh trong bản ghi âm. Hãy kiểm tra micro và thử thu lại.');
  }
  return cleaned;
}

export async function evaluateWithGemini(params: {
  apiKey: string;
  skill: 'writing' | 'speaking';
  promptTitle: string;
  promptText: string;
  userResponse: string;
  targetBand?: number;
  audioBlob?: Blob | null;
}): Promise<AIFeedbackResult> {
  const { apiKey, skill, promptTitle, promptText, userResponse, targetBand = 6.5, audioBlob } = params;
  const hasAudio = skill === 'speaking' && Boolean(audioBlob && audioBlob.size > 0);

  const criteriaSpec =
    skill === 'writing'
      ? '4 tiêu chí IELTS Writing: Task Achievement / Response (TA/TR), Coherence & Cohesion (CC), Lexical Resource (LR), Grammatical Range & Accuracy (GRA)'
      : hasAudio
      ? '4 tiêu chí IELTS Speaking: Fluency & Coherence (FC), Lexical Resource (LR), Grammatical Range & Accuracy (GRA), Pronunciation / Clarity (PR) đánh giá trực tiếp từ bản ghi âm'
      : '4 tiêu chí IELTS Speaking: Fluency & Coherence (FC), Lexical Resource (LR), Grammatical Range & Accuracy (GRA), Pronunciation / Clarity ước lượng từ transcript (PR)';

  const transcriptSchemaLine = hasAudio
    ? '\n  "transcriptEn": "Chép lại nguyên văn câu trả lời tiếng Anh nghe được từ bản ghi âm",'
    : '';

  const systemInstruction = `Bạn là Giám khảo IELTS thân thiện, chuyên kèm học viên Việt Nam đi từ mất gốc lên Band ${targetBand}.
Hãy chấm bài ${skill.toUpperCase()} dưới đây công tâm theo ${criteriaSpec}.
TRẢ VỀ DUY NHẤT 1 JSON HỢP LỆ (không kèm markdown hay chữ thừa) theo đúng cấu trúc:
{
  "overallBand": 5.5,${transcriptSchemaLine}
  "criteria": [
    { "name": "Tên tiêu chí", "score": 5.5, "commentVi": "Nhận xét ngắn gọn, dễ hiểu bằng tiếng Việt kèm ví dụ lỗi từ bài làm" }
  ],
  "strengthsVi": ["Điểm tốt 1", "Điểm tốt 2"],
  "improvementsVi": ["Cách sửa cụ thể 1 (kèm câu gốc -> câu sửa)", "Cách sửa cụ thể 2"],
  "upgradedVersionEn": "Phiên bản viết lại tự nhiên đạt khoảng Band 6.5 - 7.0 bằng tiếng Anh",
  "encouragementVi": "1 câu động viên ngắn gọn theo phong cách Pháp sư cố vấn Dark Fantasy nhẹ nhàng"
}
Điểm số phải làm tròn theo thang IELTS (bội số của 0.5, từ 2.0 đến 9.0).`;

  const trimmedResponse = userResponse.trim();
  const userMessage = hasAudio
    ? `Chủ đề: ${promptTitle}
Đề bài: ${promptText}
Hãy nghe trực tiếp file ghi âm đính kèm, chép chính xác lời nói vào "transcriptEn" và chấm điểm theo giọng nói thực tế.${trimmedResponse ? `\n\nGhi chú/Transcript học viên gõ thêm (chỉ dùng tham khảo):\n"""\n${trimmedResponse}\n"""` : ''}`
    : `Chủ đề: ${promptTitle}
Đề bài: ${promptText}

Bài làm của học viên:
"""
${userResponse}
"""`;

  const parts: Array<Record<string, unknown>> = [{ text: `${systemInstruction}\n\n${userMessage}` }];
  if (hasAudio && audioBlob) {
    const base64Audio = await blobToBase64(audioBlob);
    parts.push({
      inlineData: {
        mimeType: cleanAudioMimeType(audioBlob.type),
        data: base64Audio,
      },
    });
  }

  const rawText = await callGeminiGenerateContent({
    apiKey,
    parts,
    temperature: 0.35,
    responseMimeType: 'application/json',
    timeoutMs: hasAudio ? GEMINI_AUDIO_TIMEOUT_MS : GEMINI_TIMEOUT_MS,
  });

  if (!rawText) {
    throw new Error('AI không trả về nội dung đánh giá. Vui lòng thử lại.');
  }

  return parseAndNormalizeGeminiFeedback(rawText);
}
