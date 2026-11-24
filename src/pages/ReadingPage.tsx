import React, { useEffect, useState } from 'react';
import {
  BookmarkCheck,
  BookmarkPlus,
  Check,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react';
import { READING_LESSONS } from '../data/lessons';
import { useApp } from '../store/AppContext';
import { speakText, stopSpeaking } from '../lib/speech';
import { ReadingTomeArt } from '../components/DarkArtworks';

export function ReadingPage() {
  const { lessonProgress, completeLesson, savedVocabIds, toggleSavedVocab } = useApp();
  const [selectedId, setSelectedId] = useState(READING_LESSONS[0].id);
  const [mobilePane, setMobilePane] = useState<'passage' | 'questions'>('passage');
  const [activeWordKey, setActiveWordKey] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const lesson = READING_LESSONS.find((l) => l.id === selectedId) ?? READING_LESSONS[0];

  useEffect(() => {
    stopSpeaking();
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    setActiveWordKey(null);
    setMobilePane('passage');
    return () => stopSpeaking();
  }, [lesson.id]);

  const activeWordInfo = activeWordKey ? lesson.glossary[activeWordKey] : null;

  const handleSubmit = () => {
    let correct = 0;
    for (const q of lesson.questions) {
      if (answers[q.id] === q.answer) correct += 1;
    }
    const pct = Math.round((correct / lesson.questions.length) * 100);
    setSubmitted(true);
    setScore(pct);
    completeLesson(lesson.id, 'reading', pct, lesson.xpReward, lesson.readingMinutes);
  };

  const renderInteractiveParagraph = (text: string) => {
    const tokens = text.split(/(\s+)/);
    return tokens.map((token, i) => {
      const clean = token.toLowerCase().replace(/[^a-z-]/g, '');
      if (clean && lesson.glossary[clean]) {
        const isSelected = activeWordKey === clean;
        return (
          <button
            key={i}
            type="button"
            onClick={() => {
              setActiveWordKey(clean);
              speakText(clean, { lang: 'en-GB', rate: 0.9 });
            }}
            className={`inline px-0.5 transition cursor-pointer border-b ${
              isSelected
                ? 'bg-[#C5A059]/30 text-[#F8E9C8] border-[#E2C88D]'
                : 'bg-[#C5A059]/10 hover:bg-[#C5A059]/22 text-[#EBD6A7] border-[#C5A059]/55'
            }`}
          >
            {token}
          </button>
        );
      }
      return <React.Fragment key={i}>{token}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-6">
      <div className="ornate-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden">
        <div className="p-5 sm:p-7">
          <p className="font-fantasy text-[11px] uppercase tracking-[0.24em] text-[#C5A059]">
            Điện II ◆ Reading
          </p>
          <h1 className="font-fantasy text-2xl sm:text-3xl text-[#F4EFE4] mt-1">
            Thư Viện Cổ Thư Học Thuật
          </h1>
          <p className="text-sm text-[#968D80] mt-1.5 max-w-xl">
            Chạm vào các <span className="text-[#E2C88D] border-b border-[#C5A059]/60">từ gạch chân đồng</span> trong bài đọc để nghe phát âm, tra nghĩa và khắc vào Sổ Từ Vựng SRS.
          </p>
        </div>
        <div className="hidden sm:block w-52 h-32 shrink-0 border-l border-[#C5A059]/20">
          <ReadingTomeArt className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Chọn bài đọc */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {READING_LESSONS.map((item) => {
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

      {/* Bộ chuyển Tab trên iPhone */}
      <div className="lg:hidden grid grid-cols-2 border border-[#C5A059]/25 bg-[#0D0C0A]">
        <button
          onClick={() => setMobilePane('passage')}
          className={`py-2.5 text-xs uppercase tracking-[0.14em] font-semibold transition ${
            mobilePane === 'passage' ? 'bg-[#C5A059]/20 text-[#E2C88D]' : 'text-[#968D80]'
          }`}
        >
          Bài Đọc ({lesson.paragraphs.length} đoạn)
        </button>
        <button
          onClick={() => setMobilePane('questions')}
          className={`py-2.5 text-xs uppercase tracking-[0.14em] font-semibold transition ${
            mobilePane === 'questions' ? 'bg-[#C5A059]/20 text-[#E2C88D]' : 'text-[#968D80]'
          }`}
        >
          Câu Hỏi ({lesson.questions.length})
        </button>
      </div>

      {/* Bố cục biên tập 2 cột trên Windows */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div
          className={`lg:col-span-7 sanctuary-panel p-5 sm:p-7 space-y-5 ${
            mobilePane === 'passage' ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="pb-4 border-b border-[#C5A059]/18">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#C5A059]">
              {lesson.topic} • {lesson.bandTarget} • ~{lesson.readingMinutes} phút
            </p>
            <h2 className="font-fantasy text-xl sm:text-2xl text-[#F4EFE4] mt-1.5">{lesson.title}</h2>
          </div>

          {activeWordKey && activeWordInfo && (
            <div className="p-4 bg-[#0B0A08] border-l-2 border-[#E2C88D] border-y border-r border-y-[#C5A059]/20 border-r-[#C5A059]/20 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-fantasy text-lg text-[#E2C88D]">{activeWordKey}</span>
                  <span className="text-xs text-[#968D80]">{activeWordInfo.ipa}</span>
                  <button
                    onClick={() => speakText(activeWordKey, { lang: 'en-GB' })}
                    className="p-1 text-[#C5A059] hover:text-[#F4E6C5] cursor-pointer"
                    aria-label="Nghe phát âm"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-[#ECE6D8] mt-0.5">{activeWordInfo.meaningVi}</p>
              </div>

              {activeWordInfo.vocabId && (
                <button
                  onClick={() => toggleSavedVocab(activeWordInfo.vocabId!)}
                  className={`px-3 py-1.5 text-xs uppercase tracking-wider border flex items-center gap-1.5 cursor-pointer ${
                    savedVocabIds.includes(activeWordInfo.vocabId)
                      ? 'bg-[#4E8A6E]/20 border-[#4E8A6E] text-[#A8DFC4]'
                      : 'btn-ghost-brass'
                  }`}
                >
                  {savedVocabIds.includes(activeWordInfo.vocabId) ? (
                    <>
                      <BookmarkCheck className="w-3.5 h-3.5" /> Đã lưu SRS
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="w-3.5 h-3.5" /> Lưu vào SRS
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          <div className="space-y-5 text-[15px] sm:text-base leading-[1.9] text-[#ECE6D8]/95">
            {lesson.paragraphs.map((p, idx) => (
              <p key={idx} className="pl-4 border-l border-[#C5A059]/25">
                <span className="font-fantasy text-xs text-[#C5A059] mr-2.5">§{idx + 1}</span>
                {renderInteractiveParagraph(p)}
              </p>
            ))}
          </div>
        </div>

        <div
          className={`lg:col-span-5 sanctuary-panel p-5 sm:p-6 space-y-5 lg:sticky lg:top-6 ${
            mobilePane === 'questions' ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#C5A059]/15">
            <h3 className="font-fantasy text-lg text-[#F4EFE4]">Câu Hỏi Kiểm Tra</h3>
            {submitted && score !== null && (
              <span className="font-fantasy text-sm text-[#E2C88D] border border-[#C5A059]/40 px-2.5 py-0.5 bg-[#0B0A08]">
                {score}%
              </span>
            )}
          </div>

          <div className="space-y-4">
            {lesson.questions.map((q, idx) => {
              const isCorrect = submitted && answers[q.id] === q.answer;
              return (
                <div key={q.id} className="p-4 bg-[#0B0A08] border border-[#C5A059]/16 space-y-3">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em]">
                    <span className="text-[#C5A059]">
                      {q.type === 'tfng' ? 'True / False / Not Given' : 'Multiple Choice'}
                    </span>
                    <span className="text-[#968D80]">0{idx + 1}</span>
                  </div>
                  <p className="text-sm text-[#ECE6D8] leading-relaxed">{q.prompt}</p>

                  <div className={q.type === 'tfng' ? 'grid grid-cols-3 gap-2' : 'space-y-2'}>
                    {q.options.map((opt) => {
                      const picked = answers[q.id] === opt;
                      const isRight = submitted && opt === q.answer;
                      const isWrong = submitted && picked && !isRight;
                      return (
                        <button
                          key={opt}
                          disabled={submitted}
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                          className={`px-3 py-2 text-xs sm:text-sm border transition text-left cursor-pointer ${
                            q.type === 'tfng' ? 'text-center font-semibold tracking-wider' : ''
                          } ${
                            isRight
                              ? 'bg-[#4E8A6E]/20 border-[#4E8A6E] text-[#A8DFC4]'
                              : isWrong
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

                  {submitted && (
                    <div
                      className={`p-3 text-xs space-y-1.5 border ${
                        isCorrect
                          ? 'bg-[#4E8A6E]/10 border-[#4E8A6E]/35'
                          : 'bg-[#8E2933]/12 border-[#8E2933]/45'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-semibold">
                        {isCorrect ? (
                          <Check className="w-3.5 h-3.5 text-[#7BC2A0]" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-[#E28A93]" />
                        )}
                        <span className={isCorrect ? 'text-[#A8DFC4]' : 'text-[#F2B5BC]'}>
                          {isCorrect ? 'Chính xác.' : `Đáp án đúng: ${q.answer}`}
                        </span>
                      </div>
                      <p className="text-[#ECE6D8]/90">{q.explanationVi}</p>
                      <p className="text-[11px] italic text-[#E2C88D]/90 bg-[#090807] p-2 border-l border-[#C5A059]">
                        Dẫn chứng: "{q.evidenceQuote}"
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!submitted ? (
            <button onClick={handleSubmit} className="w-full btn-brass py-3 text-xs uppercase tracking-[0.16em] cursor-pointer">
              Chấm Điểm & Xem Dẫn Chứng
            </button>
          ) : (
            <button
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
                setScore(null);
              }}
              className="w-full btn-ghost-brass py-2.5 text-xs uppercase tracking-[0.14em] flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Luyện lại bài đọc này
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
