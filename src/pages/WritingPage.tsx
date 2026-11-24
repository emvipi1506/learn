import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookMarked,
  Check,
  Clock,
  Loader2,
  Play,
  Plus,
  Wand2,
} from 'lucide-react';
import { WRITING_LESSONS } from '../data/lessons';
import { useApp } from '../store/AppContext';
import { evaluateWithGemini } from '../lib/gemini';
import { AIFeedbackCard } from '../components/AIFeedbackCard';
import { WritingQuillArt } from '../components/DarkArtworks';
import type { AIFeedbackResult, NavTab } from '../types';

export function WritingPage({ onNavigate }: { onNavigate: (tab: NavTab) => void }) {
  const { lessonProgress, completeLesson, geminiApiKey, addPracticeSubmission, profile } = useApp();
  const [selectedId, setSelectedId] = useState(WRITING_LESSONS[0].id);
  const [essay, setEssay] = useState('');
  const [showSample, setShowSample] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [timerActive, setTimerActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WRITING_LESSONS[0].recommendedMinutes * 60);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiErrorNeedsSettings, setAiErrorNeedsSettings] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<AIFeedbackResult | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const aiRequestIdRef = useRef(0);

  const lesson = WRITING_LESSONS.find((l) => l.id === selectedId) ?? WRITING_LESSONS[0];

  useEffect(() => {
    aiRequestIdRef.current += 1;
    setEssay('');
    setShowSample(false);
    setCheckedItems({});
    setTimerActive(false);
    setSecondsLeft(lesson.recommendedMinutes * 60);
    setAiLoading(false);
    setAiFeedback(null);
    setAiError(null);
    setAiErrorNeedsSettings(false);
    setSavedNotice(null);
  }, [lesson.id, lesson.recommendedMinutes]);

  useEffect(() => {
    if (!timerActive) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerActive]);

  useEffect(() => {
    if (timerActive && secondsLeft <= 0) {
      setTimerActive(false);
    }
  }, [timerActive, secondsLeft]);

  const wordCount = essay
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const wordPct = Math.min(100, Math.round((wordCount / lesson.minWords) * 100));

  const formatTime = (sec: number) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const insertPhrase = (phrase: string) => {
    setEssay((prev) => (prev.trim() ? `${prev.trim()} ${phrase} ` : `${phrase} `));
  };

  const handleSaveSelfCheck = () => {
    setAiErrorNeedsSettings(false);
    if (wordCount < 15) {
      setAiError('Hãy viết ít nhất 15 từ trước khi lưu bài tập nhé.');
      return;
    }
    setAiError(null);
    const checkedCount = Object.values(checkedItems).filter(Boolean).length;
    const score = Math.min(100, Math.round(wordPct * 0.6 + (checkedCount / lesson.checklistVi.length) * 40));
    const estBand = wordCount >= lesson.minWords ? Math.min(6.5, 4.0 + lesson.act * 0.5) : 4.0;

    completeLesson(lesson.id, 'writing', score, lesson.xpReward, lesson.recommendedMinutes);
    addPracticeSubmission({
      skill: 'writing',
      promptId: lesson.id,
      promptTitle: lesson.title,
      content: essay,
      bandEstimate: estBand,
    });
    setSavedNotice(`Đã lưu bài viết (${wordCount} từ) và cộng +${lesson.xpReward} XP.`);
  };

  const handleEvaluateAI = async () => {
    setAiErrorNeedsSettings(false);
    if (wordCount < 25) {
      setAiError('Hãy viết ít nhất 25 từ để AI có đủ dữ liệu chấm 4 tiêu chí IELTS.');
      return;
    }
    if (!geminiApiKey) {
      setAiError('Chưa có Gemini API Key. Hãy mở mục Cài đặt để dán khóa miễn phí từ Google AI Studio.');
      setAiErrorNeedsSettings(true);
      return;
    }
    const reqId = ++aiRequestIdRef.current;
    const currentLesson = lesson;
    const currentEssay = essay;
    setAiLoading(true);
    setAiError(null);
    setSavedNotice(null);

    try {
      const result = await evaluateWithGemini({
        apiKey: geminiApiKey,
        skill: 'writing',
        promptTitle: currentLesson.title,
        promptText: currentLesson.promptEn,
        userResponse: currentEssay,
        targetBand: profile.targetBand,
      });
      if (reqId !== aiRequestIdRef.current) return;
      setAiFeedback(result);
      completeLesson(
        currentLesson.id,
        'writing',
        Math.min(100, Math.round((result.overallBand / 7.0) * 100)),
        currentLesson.xpReward,
        currentLesson.recommendedMinutes
      );
      addPracticeSubmission({
        skill: 'writing',
        promptId: currentLesson.id,
        promptTitle: currentLesson.title,
        content: currentEssay,
        bandEstimate: result.overallBand,
        aiFeedback: result,
      });
    } catch (err) {
      if (reqId !== aiRequestIdRef.current) return;
      const msg = err instanceof Error ? err.message : 'Không thể kết nối AI lúc này.';
      setAiError(msg);
      if (/api key|khóa/i.test(msg)) {
        setAiErrorNeedsSettings(true);
      }
    } finally {
      if (reqId === aiRequestIdRef.current) {
        setAiLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="ornate-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden">
        <div className="p-5 sm:p-7">
          <p className="font-fantasy text-[11px] uppercase tracking-[0.24em] text-[#C5A059]">
            Điện III ◆ Writing
          </p>
          <h1 className="font-fantasy text-2xl sm:text-3xl text-[#F4EFE4] mt-1">
            Bàn Khắc Cổ Thư Luận
          </h1>
          <p className="text-sm text-[#968D80] mt-1.5 max-w-xl">
            Khung dàn ý cho người mới, cụm từ bấm chèn nhanh, bài mẫu Band 6.5–7.0 và AI chấm 4 tiêu chí IELTS.
          </p>
        </div>
        <div className="hidden sm:block w-52 h-32 shrink-0 border-l border-[#C5A059]/20">
          <WritingQuillArt className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Chọn đề viết */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {WRITING_LESSONS.map((item) => {
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
                  Chương {item.act} • {item.taskType}
                </span>
                {done ? (
                  <Check className="w-3.5 h-3.5 text-[#7BC2A0]" />
                ) : (
                  <span className="text-[#968D80]">{item.minWords}+ từ</span>
                )}
              </div>
              <p className="text-sm font-medium text-[#ECE6D8] mt-1.5 line-clamp-2">{item.title}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* CỘT TRÁI: ĐỀ BÀI & DÀN Ý */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sanctuary-panel p-5 space-y-4">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em]">
              <span className="text-[#C5A059] font-semibold">
                {lesson.taskType} • {lesson.bandTarget}
              </span>
              <span className="text-[#968D80]">Tối thiểu {lesson.minWords} từ</span>
            </div>

            <h2 className="font-fantasy text-lg text-[#F4EFE4]">{lesson.title}</h2>
            <p className="text-sm text-[#ECE6D8] leading-relaxed whitespace-pre-line bg-[#0B0A08] p-4 border-l-2 border-[#C5A059]">
              {lesson.promptEn}
            </p>
            <p className="text-xs text-[#968D80] leading-relaxed">{lesson.promptVi}</p>

            <div className="space-y-2 pt-3 border-t border-[#C5A059]/15">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E2C88D]">
                Dàn ý từng bước
              </p>
              <ul className="space-y-1.5 text-xs text-[#C8BFB0] list-disc pl-4">
                {lesson.outlineVi.map((line, i) => (
                  <li key={i} className="leading-relaxed">{line}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 pt-3 border-t border-[#C5A059]/15">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C5A059]">
                Cụm từ ăn điểm (Nhấn để chèn vào bài)
              </p>
              <div className="space-y-1.5">
                {lesson.usefulPhrases.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => insertPhrase(p.en)}
                    className="w-full text-left p-2.5 bg-[#0B0A08] hover:bg-[#C5A059]/10 border border-[#C5A059]/16 hover:border-[#C5A059]/45 transition flex items-start justify-between gap-2 cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-medium text-[#ECE6D8]">{p.en}</p>
                      <p className="text-[11px] text-[#968D80]">{p.vi}</p>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-[#C5A059] shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="sanctuary-panel p-5">
            <button
              onClick={() => setShowSample((v) => !v)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <span className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] font-semibold text-[#E2C88D]">
                <BookMarked className="w-4 h-4 text-[#C5A059]" /> Bài Mẫu Tham Khảo (Band 6.5–7.0)
              </span>
              <span className="text-xs text-[#968D80]">{showSample ? 'Thu gọn' : 'Mở xem'}</span>
            </button>

            {showSample && (
              <div className="mt-4 space-y-3 pt-3 border-t border-[#C5A059]/15">
                <p className="text-sm text-[#ECE6D8] leading-relaxed whitespace-pre-line bg-[#0B0A08] p-4 border border-[#C5A059]/16">
                  {lesson.sampleAnswer}
                </p>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#7BC2A0]">Phân tích điểm mạnh:</p>
                  <ul className="text-xs text-[#C8BFB0] list-disc pl-4 space-y-1">
                    {lesson.sampleHighlightsVi.map((h, idx) => (
                      <li key={idx}>{h}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: TRÌNH VIẾT BÀI */}
        <div className="lg:col-span-7 space-y-4">
          <div className="sanctuary-panel p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => {
                  if (!timerActive && secondsLeft <= 0) {
                    setSecondsLeft(lesson.recommendedMinutes * 60);
                  }
                  setTimerActive((v) => !v);
                }}
                className="btn-ghost-brass px-3.5 py-1.5 text-xs flex items-center gap-2 cursor-pointer"
              >
                {timerActive ? <Clock className="w-3.5 h-3.5 text-[#E2C88D]" /> : <Play className="w-3.5 h-3.5" />}
                <span className="font-fantasy tracking-wider">{formatTime(secondsLeft)}</span>
                <span className="text-[11px] text-[#968D80]">{timerActive ? 'Đang chạy' : 'Bấm giờ'}</span>
              </button>

              <div className="text-xs">
                <span className="text-[#968D80] mr-2">Số từ:</span>
                <span className={`font-fantasy text-base ${wordCount >= lesson.minWords ? 'text-[#7BC2A0]' : 'text-[#E2C88D]'}`}>
                  {wordCount} / {lesson.minWords}
                </span>
              </div>
            </div>

            <div className="h-[2px] bg-[#24201B]">
              <div
                className={`h-full transition-all duration-300 ${
                  wordCount >= lesson.minWords ? 'bg-[#4E8A6E]' : 'bg-[#C5A059]'
                }`}
                style={{ width: `${wordPct}%` }}
              />
            </div>

            <textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              rows={12}
              placeholder="Bắt đầu viết bài bằng tiếng Anh tại đây..."
              className="w-full bg-[#090807] border border-[#C5A059]/22 focus:border-[#E2C88D] focus:outline-none p-4 text-base sm:text-[15px] leading-[1.85] text-[#ECE6D8] resize-y"
            />

            <div className="p-4 bg-[#0B0A08] border border-[#C5A059]/15 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#968D80]">
                Tự rà soát trước khi nộp
              </p>
              {lesson.checklistVi.map((item, idx) => (
                <label key={idx} className="flex items-start gap-2.5 text-xs text-[#ECE6D8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(checkedItems[idx])}
                    onChange={(e) => setCheckedItems((prev) => ({ ...prev, [idx]: e.target.checked }))}
                    className="mt-0.5 accent-[#C5A059]"
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>

            {aiError && (
              <div className="p-3.5 bg-[#8E2933]/15 border border-[#8E2933]/50 text-xs text-[#F2C3C8] flex items-start justify-between gap-3">
                <span className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#E28A93]" />
                  {aiError}
                </span>
                {aiErrorNeedsSettings && (
                  <button
                    onClick={() => onNavigate('settings')}
                    className="shrink-0 btn-ghost-brass px-2.5 py-1 text-[11px] cursor-pointer"
                  >
                    Cài đặt AI
                  </button>
                )}
              </div>
            )}

            {savedNotice && (
              <div className="p-3.5 bg-[#4E8A6E]/12 border border-[#4E8A6E]/40 text-xs text-[#B9E6D0] flex items-center gap-2">
                <Check className="w-4 h-4 text-[#7BC2A0]" />
                {savedNotice}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleEvaluateAI}
                disabled={aiLoading}
                className="flex-1 min-w-[200px] btn-crimson py-3 px-4 text-xs uppercase tracking-[0.14em] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang chấm 4 tiêu chí...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" /> AI Chấm 4 Tiêu Chí IELTS
                  </>
                )}
              </button>

              <button
                onClick={handleSaveSelfCheck}
                className="btn-brass py-3 px-5 text-xs uppercase tracking-[0.14em] cursor-pointer"
              >
                Lưu Bài & Tự Chấm
              </button>
            </div>
          </div>

          {aiFeedback && <AIFeedbackCard feedback={aiFeedback} />}
        </div>
      </div>
    </div>
  );
}
