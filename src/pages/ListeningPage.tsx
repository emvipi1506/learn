import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Play,
  RotateCcw,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { LISTENING_LESSONS } from '../data/lessons';
import { useApp } from '../store/AppContext';
import { isTTSSupported, speakText, stopSpeaking } from '../lib/speech';
import { ListeningBellArt } from '../components/DarkArtworks';

function normalizeAnswer(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,!?;:'"()-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * So khớp chính tả bảo toàn đúng thứ tự từ bằng LCS (tránh gõ sai thứ tự hoặc lặp từ vẫn được tính đúng)
 */
export function computeDictationDiff(target: string, input: string): { word: string; matched: boolean }[] {
  const targetWords = target.split(/\s+/).filter(Boolean);
  const targetNorm = targetWords.map(normalizeAnswer);
  const typedNorm = normalizeAnswer(input).split(' ').filter(Boolean);

  const m = targetNorm.length;
  const n = typedNorm.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (targetNorm[i] && targetNorm[i] === typedNorm[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const matchedIndices = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (targetNorm[i] && targetNorm[i] === typedNorm[j]) {
      matchedIndices.add(i);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return targetWords.map((word, idx) => ({
    word,
    matched: matchedIndices.has(idx),
  }));
}

export function ListeningPage() {
  const { lessonProgress, completeLesson } = useApp();
  const [selectedId, setSelectedId] = useState(LISTENING_LESSONS[0].id);
  const [rate, setRate] = useState<number>(0.92);
  const [accent, setAccent] = useState<'en-GB' | 'en-US'>('en-GB');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);

  const [dictationInput, setDictationInput] = useState('');
  const [dictationChecked, setDictationChecked] = useState(false);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);

  const playbackSessionRef = useRef(0);
  const nextTimerRef = useRef<number | null>(null);

  const lesson = LISTENING_LESSONS.find((l) => l.id === selectedId) ?? LISTENING_LESSONS[0];

  const cancelPlayback = () => {
    playbackSessionRef.current += 1;
    if (nextTimerRef.current !== null) {
      window.clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }
    stopSpeaking();
    setIsPlaying(false);
    setActiveLineIdx(null);
  };

  useEffect(() => {
    cancelPlayback();
    setAccent(lesson.accent);
    setAnswers({});
    setSubmitted(false);
    setLastScore(null);
    setDictationInput('');
    setDictationChecked(false);
    setShowTranscript(false);
    setTtsWarning(null);
    return () => {
      cancelPlayback();
    };
  }, [lesson.id, lesson.accent]);

  const playFullLesson = () => {
    if (!isTTSSupported()) {
      setTtsWarning(
        'Trình duyệt hiện tại không hỗ trợ đọc giọng nói (Web Speech Synthesis). Bạn hãy mở bằng Safari (iOS) hoặc Edge/Chrome (Windows).'
      );
      return;
    }
    setTtsWarning(null);
    cancelPlayback();
    const session = ++playbackSessionRef.current;
    setIsPlaying(true);

    const playIndex = (idx: number) => {
      if (session !== playbackSessionRef.current) return;
      if (idx >= lesson.transcriptLines.length) {
        setIsPlaying(false);
        setActiveLineIdx(null);
        return;
      }
      setActiveLineIdx(idx);
      speakText(lesson.transcriptLines[idx].en, {
        lang: accent,
        rate,
        onEnd: () => {
          if (session !== playbackSessionRef.current) return;
          // Khoảng trễ ngắn ~60ms giúp iOS Safari không nuốt câu kế tiếp
          nextTimerRef.current = window.setTimeout(() => {
            nextTimerRef.current = null;
            playIndex(idx + 1);
          }, 60);
        },
        onError: () => {
          if (session !== playbackSessionRef.current) return;
          setIsPlaying(false);
          setActiveLineIdx(null);
          setTtsWarning('Không thể phát âm thanh. Hãy kiểm tra loa thiết bị hoặc tắt chế độ im lặng trên iPhone.');
        },
      });
    };

    nextTimerRef.current = window.setTimeout(() => {
      nextTimerRef.current = null;
      playIndex(0);
    }, 60);
  };

  const playSingleLine = (text: string, idx?: number) => {
    if (!isTTSSupported()) {
      setTtsWarning('Trình duyệt hiện tại không hỗ trợ đọc giọng nói (Web Speech Synthesis).');
      return;
    }
    setTtsWarning(null);
    cancelPlayback();
    const session = ++playbackSessionRef.current;
    setIsPlaying(true);
    setActiveLineIdx(idx ?? null);

    nextTimerRef.current = window.setTimeout(() => {
      nextTimerRef.current = null;
      if (session !== playbackSessionRef.current) return;
      speakText(text, {
        lang: accent,
        rate,
        onEnd: () => {
          if (session !== playbackSessionRef.current) return;
          setIsPlaying(false);
          setActiveLineIdx(null);
        },
        onError: () => {
          if (session !== playbackSessionRef.current) return;
          setIsPlaying(false);
          setActiveLineIdx(null);
        },
      });
    }, 60);
  };

  const handleStop = () => {
    cancelPlayback();
  };

  const isQuestionCorrect = (qId: string, expected: string): boolean => {
    const userVal = normalizeAnswer(answers[qId] || '');
    const expVal = normalizeAnswer(expected);
    if (!userVal) return false;
    if (expVal === '10' && (userVal === '10' || userVal === 'ten')) return true;
    if (expVal === '8' && (userVal === '8' || userVal === 'eight')) return true;
    return userVal === expVal;
  };

  const handleSubmit = () => {
    let correct = 0;
    for (const q of lesson.questions) {
      if (isQuestionCorrect(q.id, q.answer)) correct += 1;
    }
    const score = Math.round((correct / lesson.questions.length) * 100);
    setSubmitted(true);
    setLastScore(score);
    setShowTranscript(true);
    completeLesson(lesson.id, 'listening', score, lesson.xpReward, 12);
  };

  const dictationDiff = () => {
    if (!lesson.dictationTarget) return [];
    return computeDictationDiff(lesson.dictationTarget, dictationInput);
  };

  return (
    <div className="space-y-6">
      {/* Header điện kỹ năng có tranh khắc đồng */}
      <div className="ornate-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden">
        <div className="p-5 sm:p-7">
          <p className="font-fantasy text-[11px] uppercase tracking-[0.24em] text-[#C5A059]">
            Điện I ◆ Listening
          </p>
          <h1 className="font-fantasy text-2xl sm:text-3xl text-[#F4EFE4] mt-1">
            Tháp Chuông Thính Giác
          </h1>
          <p className="text-sm text-[#968D80] mt-1.5 max-w-xl">
            Bắt đầu bằng tốc độ 0.75x và nghe chép chính tả để mở tai, sau đó tăng lên 1.0x để làm đề IELTS thực chiến.
          </p>
        </div>
        <div className="hidden sm:block w-52 h-32 shrink-0 border-l border-[#C5A059]/20">
          <ListeningBellArt className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Chọn bài theo 4 Chương */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {LISTENING_LESSONS.map((item) => {
          const done = lessonProgress[item.id];
          const active = item.id === lesson.id;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`p-4 text-left border transition cursor-pointer ${
                active
                  ? 'bg-[#C5A059]/12 border-[#E2C88D]'
                  : 'sanctuary-panel hover:border-[#C5A059]/50'
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-fantasy uppercase tracking-wider text-[#C5A059]">
                  Chương {item.act}
                </span>
                {done ? (
                  <span className="text-[#7BC2A0] font-semibold">{done.score}%</span>
                ) : (
                  <span className="text-[#968D80]">{item.bandTarget}</span>
                )}
              </div>
              <p className="text-sm font-medium text-[#ECE6D8] mt-1.5 line-clamp-2">{item.title}</p>
            </button>
          );
        })}
      </div>

      {/* Trình phát âm thanh */}
      <div className="sanctuary-panel p-5 sm:p-6 space-y-5">
        <div className="pb-4 border-b border-[#C5A059]/15">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#C5A059]">
            Chương {lesson.act} • {lesson.bandTarget} • +{lesson.xpReward} XP
          </p>
          <h2 className="font-fantasy text-xl text-[#F4EFE4] mt-1">{lesson.title}</h2>
          <p className="text-sm text-[#968D80] mt-1">{lesson.subtitle}</p>
        </div>

        <div className="p-4 bg-[#0B0A08] border border-[#C5A059]/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {!isPlaying ? (
              <button
                onClick={playFullLesson}
                className="btn-brass px-5 py-2.5 text-xs uppercase tracking-[0.14em] flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Phát Toàn Bài
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="btn-crimson px-5 py-2.5 text-xs uppercase tracking-[0.14em] flex items-center gap-2 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" /> Dừng Lại
              </button>
            )}

            <button
              onClick={() => setShowTranscript((v) => !v)}
              className="btn-ghost-brass px-3.5 py-2.5 text-xs uppercase tracking-[0.1em] flex items-center gap-1.5 cursor-pointer"
            >
              {showTranscript ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showTranscript ? 'Ẩn lời thoại' : 'Lời thoại song ngữ'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex border border-[#C5A059]/25 bg-[#12100E] text-xs">
              {(['en-GB', 'en-US'] as const).map((loc) => (
                <button
                  key={loc}
                  onClick={() => setAccent(loc)}
                  className={`px-3 py-1.5 transition cursor-pointer ${
                    accent === loc ? 'bg-[#C5A059]/20 text-[#E2C88D] font-semibold' : 'text-[#968D80]'
                  }`}
                >
                  {loc === 'en-GB' ? 'UK' : 'US'}
                </button>
              ))}
            </div>

            <div className="flex border border-[#C5A059]/25 bg-[#12100E] text-xs">
              {[0.75, 0.92, 1.1].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setRate(spd)}
                  className={`px-3 py-1.5 transition cursor-pointer ${
                    rate === spd ? 'bg-[#C5A059]/20 text-[#E2C88D] font-semibold' : 'text-[#968D80]'
                  }`}
                >
                  {spd === 0.92 ? '1.0x' : `${spd}x`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {ttsWarning && (
          <div className="p-3 bg-[#8E2933]/15 border border-[#8E2933]/50 text-xs text-[#F2C3C8] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#E28A93]" />
            <span>{ttsWarning}</span>
          </div>
        )}

        {/* Nghe chép chính tả cho Chương 1 */}
        {lesson.mode === 'dictation' && lesson.dictationTarget && (
          <div className="p-4 bg-[#0D0C0A] border-l-2 border-[#C5A059] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-[#E2C88D]">
                Bài tập Nghe Chép Chính Tả (Rèn phản xạ bắt âm cho người mới)
              </p>
              <button
                onClick={() => playSingleLine(lesson.dictationTarget!)}
                className="btn-ghost-brass px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" /> Nghe riêng câu chép
              </button>
            </div>
            <textarea
              value={dictationInput}
              onChange={(e) => {
                setDictationInput(e.target.value);
                setDictationChecked(false);
              }}
              rows={2}
              placeholder="Gõ lại chính xác câu tiếng Anh bạn nghe được..."
              className="w-full bg-[#090807] border border-[#C5A059]/25 focus:border-[#E2C88D] focus:outline-none p-3 text-base sm:text-sm text-[#ECE6D8]"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDictationChecked(true)}
                className="btn-ghost-brass px-4 py-1.5 text-xs uppercase tracking-wider cursor-pointer"
              >
                Kiểm tra chính tả
              </button>
              {dictationChecked && (
                <p className="text-xs text-[#968D80]">Xanh rêu = đúng thứ tự • Đỏ huyết = nghe kỹ lại</p>
              )}
            </div>
            {dictationChecked && (
              <div className="p-3 bg-[#090807] border border-[#C5A059]/15 flex flex-wrap gap-1.5 text-sm leading-relaxed">
                {dictationDiff().map((token, i) => (
                  <span
                    key={i}
                    className={`px-1.5 py-0.5 ${
                      token.matched
                        ? 'bg-[#4E8A6E]/20 text-[#9AD7B9]'
                        : 'bg-[#8E2933]/30 text-[#F2B5BC] underline decoration-[#B83B47]'
                    }`}
                  >
                    {token.word}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Transcript song ngữ */}
        {showTranscript && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#C5A059]">
              Lời thoại song ngữ (Nhấn từng câu để nghe lặp lại)
            </p>
            <div className="divide-y divide-[#C5A059]/12 border border-[#C5A059]/18 bg-[#0B0A08]">
              {lesson.transcriptLines.map((line, idx) => (
                <button
                  key={idx}
                  onClick={() => playSingleLine(line.en, idx)}
                  className={`w-full text-left p-3.5 transition cursor-pointer flex items-start justify-between gap-3 ${
                    activeLineIdx === idx ? 'bg-[#C5A059]/12' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div>
                    <span className="font-fantasy text-[10px] uppercase tracking-[0.2em] text-[#C5A059]">
                      {line.speaker}
                    </span>
                    <p className="text-sm text-[#ECE6D8] mt-0.5 leading-relaxed">{line.en}</p>
                    <p className="text-xs text-[#968D80] mt-1">{line.vi}</p>
                  </div>
                  <Volume2 className="w-4 h-4 text-[#C5A059] shrink-0 mt-1" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Câu hỏi kiểm tra */}
      <div className="sanctuary-panel p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#C5A059]/15">
          <h3 className="font-fantasy text-lg text-[#F4EFE4]">
            Câu Hỏi Hiểu Bài ({lesson.questions.length} câu)
          </h3>
          {submitted && lastScore !== null && (
            <span className="font-fantasy text-sm text-[#E2C88D] border border-[#C5A059]/40 px-3 py-1 bg-[#0B0A08]">
              Kết quả: {lastScore}%
            </span>
          )}
        </div>

        <div className="space-y-4">
          {lesson.questions.map((q, index) => {
            const correct = submitted ? isQuestionCorrect(q.id, q.answer) : false;
            return (
              <div key={q.id} className="p-4 bg-[#0B0A08] border border-[#C5A059]/16 space-y-3">
                <p className="text-sm sm:text-base font-medium text-[#ECE6D8]">
                  <span className="font-fantasy text-[#C5A059] mr-2">0{index + 1}.</span>
                  {q.prompt}
                </p>

                {q.type === 'mcq' && q.options ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt) => {
                      const picked = answers[q.id] === opt;
                      const isRightOpt = submitted && normalizeAnswer(opt) === normalizeAnswer(q.answer);
                      const isWrongPick = submitted && picked && !isRightOpt;
                      return (
                        <button
                          key={opt}
                          disabled={submitted}
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                          className={`px-3.5 py-2.5 text-left text-sm border transition cursor-pointer ${
                            isRightOpt
                              ? 'bg-[#4E8A6E]/20 border-[#4E8A6E] text-[#A8DFC4]'
                              : isWrongPick
                              ? 'bg-[#8E2933]/25 border-[#B83B47] text-[#F2B5BC]'
                              : picked
                              ? 'bg-[#C5A059]/18 border-[#E2C88D] text-[#F4E6C5]'
                              : 'bg-[#12100E] hover:border-[#C5A059]/45 border-[#C5A059]/15 text-[#ECE6D8]'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type="text"
                    disabled={submitted}
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Nhập câu trả lời..."
                    className="w-full sm:max-w-sm bg-[#12100E] border border-[#C5A059]/25 focus:border-[#E2C88D] focus:outline-none px-3.5 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
                  />
                )}

                {submitted && (
                  <div
                    className={`p-3 text-xs flex items-start gap-2 border ${
                      correct
                        ? 'bg-[#4E8A6E]/10 border-[#4E8A6E]/35 text-[#B9E6D0]'
                        : 'bg-[#8E2933]/12 border-[#8E2933]/45 text-[#F2C3C8]'
                    }`}
                  >
                    {correct ? (
                      <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#7BC2A0]" />
                    ) : (
                      <X className="w-4 h-4 shrink-0 mt-0.5 text-[#E28A93]" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {correct ? 'Chính xác.' : `Đáp án đúng: ${q.answer}`}
                      </p>
                      <p className="mt-0.5 text-[#ECE6D8]/85">{q.explanationVi}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3">
          {!submitted ? (
            <button onClick={handleSubmit} className="btn-brass px-6 py-3 text-xs uppercase tracking-[0.16em] cursor-pointer">
              Nộp Bài & Nhận XP
            </button>
          ) : (
            <button
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
                setLastScore(null);
              }}
              className="btn-ghost-brass px-5 py-2.5 text-xs uppercase tracking-[0.14em] flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Làm lại bài này
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
