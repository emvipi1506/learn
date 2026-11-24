import type { VocabItem } from '../types';

/**
 * Tiện ích phát âm thanh (Web Speech Synthesis) tương thích iOS Safari & Windows Chrome/Edge
 */

export type SpeechLang = 'en-GB' | 'en-US' | 'ko-KR';

let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesListenerBound = false;
let playbackToken = 0;
let pendingTimerId: number | null = null;

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function refreshVoices(): SpeechSynthesisVoice[] {
  if (!isTTSSupported()) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
  }
  return cachedVoices;
}

function ensureVoicesListener(): void {
  if (voicesListenerBound || !isTTSSupported()) return;
  voicesListenerBound = true;
  refreshVoices();
  try {
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  } catch {
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }
}

export function getCachedVoices(): SpeechSynthesisVoice[] {
  ensureVoicesListener();
  if (cachedVoices.length === 0) {
    refreshVoices();
  }
  return cachedVoices;
}

export function pickVoice(lang: SpeechLang): SpeechSynthesisVoice | null {
  if (!isTTSSupported()) return null;
  const voices = getCachedVoices();
  if (!voices.length) return null;

  const target = lang.toLowerCase();
  const preferredPattern =
    lang === 'ko-KR'
      ? /google|yuna|sora|sunhi|heami|natural|inje/i
      : /google|samantha|daniel|serena|natural|aria|libby/i;

  const exact = voices.find((v) => v.lang.toLowerCase() === target && preferredPattern.test(v.name));
  if (exact) return exact;

  const sameLocale = voices.find((v) => v.lang.toLowerCase().startsWith(target));
  if (sameLocale) return sameLocale;

  const prefix = target.split('-')[0];
  const anySameLang = voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
  return anySameLang || null;
}

export function getTTSVoiceStatus(lang: SpeechLang): {
  supported: boolean;
  voicesLoaded: boolean;
  hasVoice: boolean;
  voiceName: string | null;
} {
  if (!isTTSSupported()) {
    return { supported: false, voicesLoaded: false, hasVoice: false, voiceName: null };
  }
  const voices = getCachedVoices();
  const picked = pickVoice(lang);
  return {
    supported: true,
    voicesLoaded: voices.length > 0,
    hasVoice: Boolean(picked),
    voiceName: picked?.name ?? null,
  };
}

/**
 * Tách đoạn văn bản dài theo dấu câu để tránh lỗi Chromium/Windows Chrome tự ngắt tiếng sau ~15 giây
 */
export function splitTextForTTS(text: string, maxChars = 160): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const sentences = normalized.split(/(?<=[.!?。？！])\s+/).filter(Boolean);
  const chunks: string[] = [];

  for (const sentence of sentences) {
    if (sentence.length <= maxChars) {
      const prev = chunks[chunks.length - 1];
      if (prev && prev.length + 1 + sentence.length <= maxChars) {
        chunks[chunks.length - 1] = `${prev} ${sentence}`;
      } else {
        chunks.push(sentence);
      }
      continue;
    }

    // Câu quá dài: tách mềm theo dấu phẩy/chấm phẩy hoặc khoảng trắng
    const subParts = sentence.split(/(?<=[,;:])\s+/).filter(Boolean);
    let current = '';
    for (const part of subParts) {
      if (part.length > maxChars) {
        if (current) {
          chunks.push(current);
          current = '';
        }
        const words = part.split(' ');
        for (const word of words) {
          if (!current) {
            current = word;
          } else if (current.length + 1 + word.length <= maxChars) {
            current = `${current} ${word}`;
          } else {
            chunks.push(current);
            current = word;
          }
        }
      } else if (!current) {
        current = part;
      } else if (current.length + 1 + part.length <= maxChars) {
        current = `${current} ${part}`;
      } else {
        chunks.push(current);
        current = part;
      }
    }
    if (current) {
      chunks.push(current);
    }
  }

  return chunks;
}

/**
 * Chuẩn hóa nội dung đọc TTS cho thẻ từ vựng / ngữ pháp (đặc biệt cho tiếng Hàn Sejong 1)
 */
export function getSpeakableText(
  card: Pick<VocabItem, 'lang' | 'word' | 'pos' | 'exampleEn'>
): string {
  const lang = card.lang ?? 'en';
  if (lang !== 'ko') return card.word.trim();

  // Với thẻ ngữ pháp tiếng Hàn, đọc trực tiếp câu ví dụ Hangul tự nhiên thay vì lọc ký hiệu N1/N2/V/A
  if (card.pos.trim().toLowerCase() === 'ngữ pháp') {
    const example = card.exampleEn?.trim();
    if (example) return example;
  }

  const cleaned = card.word
    .replace(/\b(V\/A|N\d*|V|A)\s*\+?/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[•/~+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned && /[가-힣]/.test(cleaned)) {
    return cleaned;
  }
  return card.exampleEn?.trim() || card.word.trim();
}

export function stopSpeaking(): void {
  playbackToken += 1;
  if (pendingTimerId !== null && typeof window !== 'undefined') {
    window.clearTimeout(pendingTimerId);
    pendingTimerId = null;
  }
  if (isTTSSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function speakText(
  text: string,
  options?: {
    lang?: SpeechLang;
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  }
): void {
  if (!isTTSSupported()) {
    options?.onError?.();
    return;
  }

  ensureVoicesListener();

  const lang = options?.lang ?? 'en-GB';
  const rate = options?.rate ?? 0.95;
  const chunks = splitTextForTTS(text);
  const wasBusy =
    window.speechSynthesis.speaking || window.speechSynthesis.pending || pendingTimerId !== null;

  playbackToken += 1;
  if (pendingTimerId !== null) {
    window.clearTimeout(pendingTimerId);
    pendingTimerId = null;
  }
  if (wasBusy) {
    window.speechSynthesis.cancel();
  }
  const token = playbackToken;

  if (chunks.length === 0) {
    options?.onEnd?.();
    return;
  }

  let started = false;

  const speakChunk = (idx: number) => {
    if (token !== playbackToken) return;
    if (idx >= chunks.length) {
      options?.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunks[idx]);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = 1;

    const voice = pickVoice(lang);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      if (token !== playbackToken) return;
      if (!started) {
        started = true;
        options?.onStart?.();
      }
    };

    utterance.onend = () => {
      if (token !== playbackToken) return;
      if (idx + 1 < chunks.length) {
        // Nghỉ cực ngắn giữa các câu để tránh Safari/Chrome nuốt đoạn nối tiếp
        pendingTimerId = window.setTimeout(() => {
          pendingTimerId = null;
          speakChunk(idx + 1);
        }, 40);
      } else {
        options?.onEnd?.();
      }
    };

    utterance.onerror = (event) => {
      if (token !== playbackToken) return;
      const errCode = (event as SpeechSynthesisErrorEvent | undefined)?.error;
      if (errCode === 'canceled' || errCode === 'interrupted') {
        return;
      }
      options?.onError?.();
    };

    window.speechSynthesis.speak(utterance);
  };

  if (wasBusy) {
    // Chỉ trì hoãn 40ms sau cancel() khi đang ngắt câu trước để iOS Safari không nuốt đoạn mới
    pendingTimerId = window.setTimeout(() => {
      pendingTimerId = null;
      speakChunk(0);
    }, 40);
  } else {
    // Khi đang rảnh, gọi speak() đồng bộ ngay trong user gesture để giữ quyền phát âm trên iOS Safari PWA
    speakChunk(0);
  }
}

/**
 * Chọn định dạng ghi âm tương thích tốt nhất cho cả iOS Safari (audio/mp4) và Windows (audio/webm)
 */
export function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
  ];
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    } catch {
      // ignore unsupported query
    }
  }
  return '';
}

export function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [altIndex: number]: {
        transcript: string;
      };
    };
  };
}
