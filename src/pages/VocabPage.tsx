import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookmarkCheck,
  BookmarkPlus,
  Check,
  Eye,
  EyeOff,
  Plus,
  RotateCw,
  Search,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { SEJONG1_LESSONS_META } from '../data/koreanVocab';
import { formatIntervalLabel, isCardDue, type ReviewRating } from '../lib/srs';
import { getSpeakableText, getTTSVoiceStatus, speakText, stopSpeaking } from '../lib/speech';
import type { ActNumber, StudyLanguage } from '../types';

const LIBRARY_PAGE_SIZE = 30;

export function VocabPage() {
  const {
    allVocabItems,
    vocabSRS,
    savedVocabIds,
    activeStudyLang,
    setActiveStudyLang,
    dueVocabByLang,
    reviewVocabCard,
    toggleSavedVocab,
    setBatchSavedVocab,
    addCustomVocab,
    deleteCustomVocab,
  } = useApp();

  const [mode, setMode] = useState<'review' | 'library'>('review');
  const [actFilter, setActFilter] = useState<ActNumber | 'all' | 'custom'>('all');
  const [koLessonFilter, setKoLessonFilter] = useState<number | 'all' | 'grammar' | 'custom'>('all');
  const [query, setQuery] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [cardNonce, setCardNonce] = useState(0);
  const [showRomanization, setShowRomanization] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LIBRARY_PAGE_SIZE);
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null);

  const touchStartYRef = useRef<number | null>(null);
  const didScrollCardRef = useRef(false);

  // Dừng phát âm khi rời trang VocabPage
  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  // Reset số thẻ hiển thị trong Kho Thẻ khi đổi ngôn ngữ hoặc bộ lọc
  useEffect(() => {
    setVisibleCount(LIBRARY_PAGE_SIZE);
  }, [activeStudyLang, koLessonFilter, actFilter, query]);

  // Form thêm thẻ bài học trên trường / lớp ngoài
  const [formWord, setFormWord] = useState('');
  const [formReading, setFormReading] = useState('');
  const [formPos, setFormPos] = useState('từ vựng');
  const [formMeaning, setFormMeaning] = useState('');
  const [formExample, setFormExample] = useState('');
  const [formExampleVi, setFormExampleVi] = useState('');
  const [formGrammarNote, setFormGrammarNote] = useState('');
  const [formTopic, setFormTopic] = useState('');
  const [formFeedback, setFormFeedback] = useState('');

  const isKorean = activeStudyLang === 'ko';
  const speechLang = isKorean ? 'ko-KR' : 'en-GB';

  useEffect(() => {
    const checkVoice = () => {
      const status = getTTSVoiceStatus(speechLang);
      if (!status.supported) {
        setVoiceWarning('Trình duyệt hiện tại chưa hỗ trợ đọc giọng nói (TTS).');
      } else if (status.voicesLoaded && !status.hasVoice && speechLang === 'ko-KR') {
        setVoiceWarning(
          'Thiết bị chưa có gói giọng đọc tiếng Hàn (ko-KR). Trên Windows: mở Settings → Time & Language → Speech → Add voices → Korean để phát âm tiếng Hàn tự nhiên.'
        );
      } else {
        setVoiceWarning(null);
      }
    };
    checkVoice();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', checkVoice);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', checkVoice);
    }
    return undefined;
  }, [speechLang]);

  const handleSwitchLang = (nextLang: StudyLanguage) => {
    if (nextLang === activeStudyLang) return;
    stopSpeaking();
    setActiveStudyLang(nextLang);
    setFlipped(false);
    setCardNonce((n) => n + 1);
    setActFilter('all');
    setKoLessonFilter('all');
    setQuery('');
    setFormFeedback('');
  };

  // Chỉ lấy thẻ thuộc ngôn ngữ đang kích hoạt — tuyệt đối tách biệt EN và KO
  const langItems = useMemo(() => {
    return allVocabItems.filter((v) => (v.lang ?? 'en') === activeStudyLang);
  }, [allVocabItems, activeStudyLang]);

  const savedSet = useMemo(() => new Set(savedVocabIds), [savedVocabIds]);

  const savedLangItems = useMemo(() => {
    return langItems.filter((v) => savedSet.has(v.id));
  }, [langItems, savedSet]);

  const dueCards = useMemo(() => {
    return savedLangItems.filter((v) => isCardDue(vocabSRS[v.id]));
  }, [savedLangItems, vocabSRS]);

  const currentCard = dueCards[0] ?? null;

  // Đảm bảo lá bài mới (hoặc khi quay lại chế độ Ôn Tập sau khi bỏ lưu thẻ cũ ở Kho Thẻ) luôn mở mặt trước
  useEffect(() => {
    setFlipped(false);
  }, [currentCard?.id, mode]);

  const filteredLibrary = useMemo(() => {
    const q = query.trim().toLowerCase();
    return langItems.filter((v) => {
      if (isKorean) {
        if (koLessonFilter === 'custom' && !v.isCustom) return false;
        if (koLessonFilter === 'grammar' && v.pos !== 'ngữ pháp') return false;
        if (typeof koLessonFilter === 'number' && v.lessonNum !== koLessonFilter) return false;
      } else {
        if (actFilter === 'custom' && !v.isCustom) return false;
        if (typeof actFilter === 'number' && v.act !== actFilter) return false;
      }
      if (!q) return true;
      return (
        v.word.toLowerCase().includes(q) ||
        v.meaningVi.toLowerCase().includes(q) ||
        v.topic.toLowerCase().includes(q) ||
        (v.romanization?.toLowerCase().includes(q) ?? false) ||
        (v.grammarNoteVi?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [langItems, isKorean, koLessonFilter, actFilter, query]);

  const activeKoLessonMeta = useMemo(() => {
    if (!isKorean || typeof koLessonFilter !== 'number') return null;
    return SEJONG1_LESSONS_META.find((m) => m.lesson === koLessonFilter) ?? null;
  }, [isKorean, koLessonFilter]);

  const activeKoLessonIds = useMemo(() => {
    if (!activeKoLessonMeta) return [];
    return langItems.filter((v) => v.lessonNum === activeKoLessonMeta.lesson).map((v) => v.id);
  }, [activeKoLessonMeta, langItems]);

  const activeKoLessonAllSaved =
    activeKoLessonIds.length > 0 && activeKoLessonIds.every((id) => savedSet.has(id));

  const masteredCount = useMemo(() => {
    return langItems.filter((v) => (vocabSRS[v.id]?.repetitions ?? 0) >= 2).length;
  }, [langItems, vocabSRS]);

  const handleRate = (rating: ReviewRating) => {
    if (!currentCard) return;
    stopSpeaking();
    setFlipped(false);
    setCardNonce((n) => n + 1);
    reviewVocabCard(currentCard.id, rating);
  };

  const handleAddCustomCard = (e: React.FormEvent) => {
    e.preventDefault();
    const word = formWord.trim();
    const meaningVi = formMeaning.trim();
    if (!word || !meaningVi) {
      setFormFeedback('Vui lòng nhập ít nhất Từ/Mẫu ngữ pháp và Nghĩa tiếng Việt.');
      return;
    }

    const reading = formReading.trim();
    addCustomVocab({
      lang: activeStudyLang,
      word,
      ipa: reading || (isKorean ? '' : '/.../'),
      romanization: isKorean ? reading || undefined : undefined,
      pos: formPos.trim() || 'từ vựng',
      meaningVi,
      exampleEn: formExample.trim() || word,
      exampleVi: formExampleVi.trim() || meaningVi,
      paraphrases: [],
      grammarNoteVi: formGrammarNote.trim() || undefined,
      act: 1,
      topic: formTopic.trim() || (isKorean ? 'Bài trên trường' : 'Lớp tiếng Anh'),
    });

    setFormWord('');
    setFormReading('');
    setFormMeaning('');
    setFormExample('');
    setFormExampleVi('');
    setFormGrammarNote('');
    setFormTopic('');
    setFormFeedback(
      `Đã thêm thẻ "${word}" vào bộ ôn SRS ${isKorean ? 'Tiếng Hàn' : 'Tiếng Anh'}!`
    );
  };

  return (
    <div className="space-y-6">
      {/* === TIÊU ĐỀ & CHUYỂN CHẾ ĐỘ === */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#C5A059]/18">
        <div>
          <p className="font-fantasy text-[11px] uppercase tracking-[0.24em] text-[#C5A059]">
            ◆ Sổ Cổ Ngữ Song Hành • SRS SM-2
          </p>
          <h1 className="font-fantasy text-2xl sm:text-3xl text-[#F4EFE4] mt-1">
            {isKorean ? 'Ôn Tập Tiếng Hàn (Sejong 1 • Bài 06–20)' : 'Lặp Lại Ngắt Quãng Tiếng Anh'}
          </h1>
          <p className="text-sm text-[#968D80] mt-1">
            {isKorean
              ? 'Không gian tách biệt hoàn toàn với Tiếng Anh • Gợi ý ôn 15 phút buổi sáng/trưa theo bài ở trường.'
              : 'Không gian tách biệt hoàn toàn với Tiếng Hàn • Gợi ý ôn 15 phút buổi tối theo lớp học ngoài.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            onClick={() => {
              setComposerOpen((o) => !o);
              setFormFeedback('');
            }}
            className="btn-ghost-brass px-3.5 py-2 text-xs uppercase tracking-[0.14em] inline-flex items-center gap-1.5 cursor-pointer"
          >
            {composerOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {composerOpen ? 'Đóng' : 'Thêm Thẻ Bài Học'}
          </button>

          <div className="flex border border-[#C5A059]/30 bg-[#0D0C0A]">
            <button
              type="button"
              onClick={() => setMode('review')}
              className={`px-4 py-2 text-xs uppercase tracking-[0.14em] font-semibold transition cursor-pointer ${
                mode === 'review' ? 'bg-[#C5A059]/20 text-[#E2C88D]' : 'text-[#968D80]'
              }`}
            >
              Ôn Tập ({dueCards.length})
            </button>
            <button
              type="button"
              onClick={() => setMode('library')}
              className={`px-4 py-2 text-xs uppercase tracking-[0.14em] font-semibold transition cursor-pointer ${
                mode === 'library' ? 'bg-[#C5A059]/20 text-[#E2C88D]' : 'text-[#968D80]'
              }`}
            >
              Kho Thẻ ({langItems.length})
            </button>
          </div>
        </div>
      </div>

      {/* === BỘ CHUYỂN KHÔNG GIAN NGÔN NGỮ TÁCH BIỆT (CHỐNG NHIỄU) === */}
      <div className="grid grid-cols-2 border border-[#C5A059]/25 bg-[#0D0C0A] divide-x divide-[#C5A059]/20">
        <button
          type="button"
          onClick={() => handleSwitchLang('en')}
          className={`p-4 text-left transition cursor-pointer relative ${
            !isKorean
              ? 'bg-[#C5A059]/[0.12] text-[#F4EFE4]'
              : 'text-[#968D80] hover:bg-white/[0.02] hover:text-[#ECE6D8]'
          }`}
        >
          {!isKorean && <span className="absolute top-0 inset-x-0 h-[2px] bg-[#E2C88D]" />}
          <div className="flex items-center justify-between gap-2">
            <span className="font-fantasy text-sm sm:text-base tracking-wider">
              I. Tiếng Anh (EN)
            </span>
            <span
              className={`px-2 py-0.5 text-[11px] font-semibold border ${
                !isKorean
                  ? 'border-[#E2C88D]/60 bg-[#090807] text-[#E2C88D]'
                  : 'border-[#C5A059]/20 text-[#968D80]'
              }`}
            >
              {dueVocabByLang.en} cần ôn
            </span>
          </div>
          <p className="text-[11px] text-[#968D80] mt-1">
            Khung tối • Lớp ngoài & Nền tảng IELTS
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchLang('ko')}
          className={`p-4 text-left transition cursor-pointer relative ${
            isKorean
              ? 'bg-[#4E8A6E]/[0.16] text-[#F4EFE4]'
              : 'text-[#968D80] hover:bg-white/[0.02] hover:text-[#ECE6D8]'
          }`}
        >
          {isKorean && <span className="absolute top-0 inset-x-0 h-[2px] bg-[#7BC2A0]" />}
          <div className="flex items-center justify-between gap-2">
            <span className="font-fantasy text-sm sm:text-base tracking-wider">
              II. 한국어 • Tiếng Hàn (KO)
            </span>
            <span
              className={`px-2 py-0.5 text-[11px] font-semibold border ${
                isKorean
                  ? 'border-[#4E8A6E] bg-[#090807] text-[#7BC2A0]'
                  : 'border-[#C5A059]/20 text-[#968D80]'
              }`}
            >
              {dueVocabByLang.ko} cần ôn
            </span>
          </div>
          <p className="text-[11px] text-[#968D80] mt-1">
            Khung sáng/trưa • Sejong 1 (Bài 06–20)
          </p>
        </button>
      </div>

      {/* === FORM THÊM THẺ BÀI HỌC TỰ TẠO === */}
      {composerOpen && (
        <form onSubmit={handleAddCustomCard} className="sanctuary-panel p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#C5A059]/15 pb-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#C5A059]">
                Khắc Thẻ Mới Vào Sổ SRS ({isKorean ? 'Tiếng Hàn • KO' : 'Tiếng Anh • EN'})
              </p>
              <h2 className="font-fantasy text-lg text-[#F4EFE4] mt-0.5">
                Lưu nhanh từ vựng hoặc mẫu ngữ pháp vừa học trên lớp
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="p-1.5 text-[#968D80] hover:text-[#ECE6D8] cursor-pointer"
              aria-label="Đóng biểu mẫu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#968D80] mb-1">
                {isKorean ? 'Từ Hangul / Mẫu ngữ pháp *' : 'Từ vựng / Cấu trúc Tiếng Anh *'}
              </label>
              <input
                type="text"
                value={formWord}
                onChange={(e) => setFormWord(e.target.value)}
                placeholder={isKorean ? 'VD: 숙제 hoặc V + 고 싶어요' : 'VD: consistent hoặc look forward to'}
                className="w-full bg-[#090807] border border-[#C5A059]/25 focus:border-[#E2C88D] focus:outline-none px-3.5 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#968D80] mb-1">
                Nghĩa tiếng Việt *
              </label>
              <input
                type="text"
                value={formMeaning}
                onChange={(e) => setFormMeaning(e.target.value)}
                placeholder={isKorean ? 'VD: bài tập về nhà / muốn làm gì' : 'VD: kiên trì, đều đặn'}
                className="w-full bg-[#090807] border border-[#C5A059]/25 focus:border-[#E2C88D] focus:outline-none px-3.5 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#968D80] mb-1">
                {isKorean ? 'Phiên âm Romanization (tùy chọn)' : 'Phiên âm IPA (tùy chọn)'}
              </label>
              <input
                type="text"
                value={formReading}
                onChange={(e) => setFormReading(e.target.value)}
                placeholder={isKorean ? 'VD: suk-je' : 'VD: /kənˈsɪs.tənt/'}
                className="w-full bg-[#090807] border border-[#C5A059]/25 focus:border-[#E2C88D] focus:outline-none px-3.5 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#968D80] mb-1">
                  Loại thẻ
                </label>
                <select
                  value={formPos}
                  onChange={(e) => setFormPos(e.target.value)}
                  className="w-full bg-[#090807] border border-[#C5A059]/25 focus:border-[#E2C88D] focus:outline-none px-3 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
                >
                  <option value="từ vựng">Từ vựng</option>
                  <option value="ngữ pháp">Ngữ pháp</option>
                  <option value="cụm từ">Cụm từ</option>
                  <option value="v">Động từ (v)</option>
                  <option value="n">Danh từ (n)</option>
                  <option value="adj">Tính từ (adj)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#968D80] mb-1">
                  Chủ đề / Bài học
                </label>
                <input
                  type="text"
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  placeholder={isKorean ? 'VD: Bài 4 trên trường' : 'VD: Buổi 3 lớp ngoài'}
                  className="w-full bg-[#090807] border border-[#C5A059]/25 focus:border-[#E2C88D] focus:outline-none px-3 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#968D80] mb-1">
                {isKorean ? 'Câu ví dụ tiếng Hàn (nên có để nhớ lâu)' : 'Câu ví dụ tiếng Anh (nên có để nhớ lâu)'}
              </label>
              <input
                type="text"
                value={formExample}
                onChange={(e) => setFormExample(e.target.value)}
                placeholder={
                  isKorean ? 'VD: 오늘 숙제가 많아요.' : 'VD: Consistent daily review prevents forgetting.'
                }
                className="w-full bg-[#090807] border border-[#C5A059]/25 focus:border-[#E2C88D] focus:outline-none px-3.5 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#968D80] mb-1">
                Dịch nghĩa câu ví dụ
              </label>
              <input
                type="text"
                value={formExampleVi}
                onChange={(e) => setFormExampleVi(e.target.value)}
                placeholder={
                  isKorean ? 'VD: Hôm nay có nhiều bài tập về nhà.' : 'VD: Ôn đều đặn mỗi ngày giúp chống quên.'
                }
                className="w-full bg-[#090807] border border-[#C5A059]/25 focus:border-[#E2C88D] focus:outline-none px-3.5 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#968D80] mb-1">
              Ghi chú ngữ pháp / Mẹo nhớ nhanh (tùy chọn)
            </label>
            <input
              type="text"
              value={formGrammarNote}
              onChange={(e) => setFormGrammarNote(e.target.value)}
              placeholder={
                isKorean
                  ? 'VD: Có patchim + 은, không patchim + 는; lưu ý biến âm...'
                  : 'VD: Đi với giới từ to + V-ing...'
              }
              className="w-full bg-[#090807] border border-[#C5A059]/25 focus:border-[#E2C88D] focus:outline-none px-3.5 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-[#7BC2A0]">{formFeedback}</p>
            <button
              type="submit"
              className="btn-brass px-5 py-2.5 text-xs uppercase tracking-[0.16em] inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Lưu Vào Bộ Ôn SRS
            </button>
          </div>
        </form>
      )}

      {/* === CẢNH BÁO GIỌNG ĐỌC NẾU THIẾU GÓI GIỌNG === */}
      {voiceWarning && (
        <div className="p-3.5 bg-[#C5A059]/10 border border-[#C5A059]/35 text-xs text-[#E2C88D] flex items-start gap-2.5 leading-relaxed">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#C5A059]" />
          <span>{voiceWarning}</span>
        </div>
      )}

      {/* === DẢI THỐNG KÊ MẢNH THEO NGÔN NGỮ === */}
      <div className="grid grid-cols-3 divide-x divide-[#C5A059]/18 border border-[#C5A059]/20 bg-[#0D0C0A]">
        <div className="p-4 text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#968D80]">
            Cần ôn ({isKorean ? 'KO' : 'EN'})
          </p>
          <p className={`font-crest text-2xl mt-1 ${isKorean ? 'text-[#7BC2A0]' : 'text-[#E2C88D]'}`}>
            {dueCards.length}
          </p>
        </div>
        <div className="p-4 text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#968D80]">
            Đang học ({isKorean ? 'KO' : 'EN'})
          </p>
          <p className="font-crest text-2xl text-[#ECE6D8] mt-1">{savedLangItems.length}</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#968D80]">Đã nhớ vững</p>
          <p className="font-crest text-2xl text-[#7BC2A0] mt-1">{masteredCount}</p>
        </div>
      </div>

      {mode === 'review' ? (
        <div className="max-w-xl mx-auto">
          {currentCard ? (
            <div className="space-y-5">
              {/* Thanh tùy chọn nhỏ cho Tiếng Hàn */}
              {isKorean && (
                <div className="flex items-center justify-between text-xs text-[#968D80] px-1">
                  <span>Mẹo: Tắt phiên âm khi đã quen mặt chữ Hangul để ép não nhớ sâu hơn.</span>
                  <button
                    type="button"
                    onClick={() => setShowRomanization((s) => !s)}
                    className="inline-flex items-center gap-1.5 text-[#7BC2A0] hover:text-[#ECE6D8] shrink-0 ml-3 cursor-pointer"
                  >
                    {showRomanization ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {showRomanization ? 'Đang hiện phiên âm' : 'Đang ẩn phiên âm'}
                  </button>
                </div>
              )}

              {/* Lá bài Tarot / Cổ thư lật 3D — key theo thẻ để tuyệt đối không lộ đáp án thẻ kế tiếp */}
              <div
                key={`${currentCard.id}-${cardNonce}`}
                onTouchStart={(e) => {
                  touchStartYRef.current = e.touches[0]?.clientY ?? null;
                  didScrollCardRef.current = false;
                }}
                onTouchMove={(e) => {
                  if (touchStartYRef.current === null) return;
                  const dy = Math.abs((e.touches[0]?.clientY ?? 0) - touchStartYRef.current);
                  if (dy > 8) didScrollCardRef.current = true;
                }}
                onClick={() => {
                  if (didScrollCardRef.current) {
                    didScrollCardRef.current = false;
                    return;
                  }
                  setFlipped((f) => !f);
                }}
                className="perspective-1000 cursor-pointer select-none"
              >
                <div
                  className={`relative h-[400px] sm:h-[370px] w-full transition-transform duration-500 transform-style-3d ${
                    flipped ? 'rotate-y-180' : ''
                  }`}
                >
                  {/* MẶT TRƯỚC */}
                  <div className="absolute inset-0 backface-hidden">
                    <div className="ornate-panel h-full p-6 sm:p-8 flex flex-col items-center justify-between text-center">
                      <div className="w-full flex items-center justify-between text-[11px] uppercase tracking-[0.16em]">
                        <span className={isKorean ? 'text-[#7BC2A0]' : 'text-[#C5A059]'}>
                          {isKorean ? '한국어' : `Chương ${currentCard.act}`} • {currentCard.topic}
                        </span>
                        <span className="text-[#968D80]">{currentCard.pos}</span>
                      </div>

                      <div className="my-6 space-y-3">
                        <h2
                          className={`${
                            isKorean ? 'font-sans font-semibold text-3xl sm:text-4xl' : 'font-fantasy text-3xl sm:text-4xl'
                          } text-[#F4EFE4] tracking-wide`}
                        >
                          {currentCard.word}
                        </h2>

                        {(!isKorean || showRomanization) && (currentCard.romanization || currentCard.ipa) && (
                          <p className={`font-sans text-base sm:text-lg ${isKorean ? 'text-[#7BC2A0]' : 'text-[#C5A059]'}`}>
                            {currentCard.ipa || `[${currentCard.romanization}]`}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            speakText(getSpeakableText(currentCard), {
                              lang: speechLang,
                              rate: isKorean ? 0.85 : 0.9,
                            });
                          }}
                          className="btn-ghost-brass inline-flex items-center gap-2 px-4 py-1.5 text-xs uppercase tracking-wider cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" /> Nghe phát âm ({isKorean ? 'KO' : 'EN'})
                        </button>
                      </div>

                      <p className="text-[11px] uppercase tracking-[0.16em] text-[#968D80] flex items-center gap-1.5">
                        <RotateCw className="w-3 h-3" /> Chạm vào lá bài để lật xem nghĩa
                      </p>
                    </div>
                  </div>

                  {/* MẶT SAU */}
                  <div className="absolute inset-0 backface-hidden rotate-y-180">
                    <div
                      className="ornate-panel h-full p-6 sm:p-7 flex flex-col justify-between gap-3 overflow-y-auto overscroll-contain touch-pan-y"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#C5A059]/18">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-[#968D80]">Nghĩa tiếng Việt</p>
                          <h3 className="font-sans font-semibold text-xl sm:text-2xl text-[#E2C88D] mt-1 leading-snug">
                            {currentCard.meaningVi}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            speakText(currentCard.exampleEn, {
                              lang: speechLang,
                              rate: isKorean ? 0.88 : 0.92,
                            });
                          }}
                          className="btn-ghost-brass p-2 cursor-pointer shrink-0"
                          aria-label="Nghe câu ví dụ"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div
                        className={`p-3.5 bg-[#0B0A08] border-l-2 space-y-1.5 ${
                          isKorean ? 'border-[#4E8A6E]' : 'border-[#C5A059]'
                        }`}
                      >
                        <p className="text-sm text-[#ECE6D8] leading-relaxed">{currentCard.exampleEn}</p>
                        <p className="text-xs text-[#968D80] leading-relaxed">{currentCard.exampleVi}</p>
                      </div>

                      {currentCard.grammarNoteVi && (
                        <div className="px-3.5 py-2.5 bg-[#161411] border border-[#C5A059]/20 text-xs text-[#C8BFB0] leading-relaxed">
                          <span className="text-[#E2C88D] font-semibold">Ghi chú ngữ pháp: </span>
                          {currentCard.grammarNoteVi}
                        </div>
                      )}

                      {currentCard.paraphrases.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-[#C5A059] font-semibold mb-1.5">
                            {isKorean ? 'Chia đuôi / Liên quan' : 'Paraphrase IELTS'}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {currentCard.paraphrases.map((p) => (
                              <span
                                key={p}
                                className="px-2.5 py-1 bg-[#0B0A08] border border-[#C5A059]/25 text-xs text-[#ECE6D8]"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {flipped ? (
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { r: 0 as ReviewRating, label: 'Quên', cls: 'bg-[#8E2933]/25 border-[#B83B47] text-[#F2B5BC]' },
                      { r: 1 as ReviewRating, label: 'Khó', cls: 'bg-[#C5A059]/12 border-[#C5A059]/50 text-[#E2C88D]' },
                      { r: 2 as ReviewRating, label: 'Tốt', cls: 'bg-[#4E8A6E]/20 border-[#4E8A6E] text-[#A8DFC4]' },
                      { r: 3 as ReviewRating, label: 'Dễ', cls: 'bg-[#1A1714] border-[#ECE6D8]/40 text-[#ECE6D8]' },
                    ]
                  ).map((btn) => (
                    <button
                      key={btn.r}
                      type="button"
                      onClick={() => handleRate(btn.r)}
                      className={`py-3 px-2 border text-center transition hover:brightness-110 cursor-pointer ${btn.cls}`}
                    >
                      <p className="text-xs uppercase tracking-wider font-bold">{btn.label}</p>
                      <p className="text-[11px] opacity-80 mt-0.5">
                        {formatIntervalLabel(vocabSRS[currentCard.id], btn.r)}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setFlipped(true)}
                  className="w-full btn-brass py-3.5 text-xs uppercase tracking-[0.18em] cursor-pointer"
                >
                  Lật Lá Bài Xem Đáp Án
                </button>
              )}
            </div>
          ) : (
            <div className="ornate-panel p-8 text-center space-y-4">
              <div className="w-14 h-14 mx-auto border border-[#4E8A6E] bg-[#4E8A6E]/15 flex items-center justify-center">
                <Check className="w-7 h-7 text-[#7BC2A0]" />
              </div>
              <h2 className="font-fantasy text-2xl text-[#E2C88D]">
                Hoàn Tất Đợt Ôn {isKorean ? 'Tiếng Hàn' : 'Tiếng Anh'} Hôm Nay
              </h2>
              <p className="text-sm text-[#968D80]">
                Mọi thẻ {isKorean ? 'Tiếng Hàn' : 'Tiếng Anh'} đã được xếp lịch nhắc lại theo thuật toán SM-2. Bạn có thể
                mở Kho Thẻ để thêm 5 thẻ mới (không nên quá 7 thẻ/ngày để tránh quên) hoặc thêm từ bài giảng trên lớp.
              </p>
              <div className="flex flex-wrap justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setMode('library')}
                  className="btn-brass px-5 py-3 text-xs uppercase tracking-[0.16em] cursor-pointer"
                >
                  Mở Kho Thẻ {isKorean ? 'Tiếng Hàn' : 'Tiếng Anh'}
                </button>
                <button
                  type="button"
                  onClick={() => setComposerOpen(true)}
                  className="btn-ghost-brass px-5 py-3 text-xs uppercase tracking-[0.16em] cursor-pointer"
                >
                  + Thêm Thẻ Bài Học
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className={`flex flex-col ${isKorean ? '' : 'sm:flex-row'} gap-3`}>
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#968D80] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  isKorean
                    ? 'Tìm Hangul, phiên âm, nghĩa tiếng Việt hoặc ngữ pháp...'
                    : 'Tìm từ tiếng Anh, nghĩa tiếng Việt hoặc chủ đề...'
                }
                className="w-full bg-[#0D0C0A] border border-[#C5A059]/25 focus:border-[#E2C88D] focus:outline-none pl-10 pr-4 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
              />
            </div>

            {isKorean ? (
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { key: 'all' as const, label: 'Tất cả' },
                    { key: 'grammar' as const, label: 'Ngữ pháp' },
                    ...SEJONG1_LESSONS_META.map((m) => ({
                      key: m.lesson,
                      label: `Bài ${m.lesson}`,
                    })),
                    { key: 'custom' as const, label: 'Tự thêm' },
                  ] as { key: number | 'all' | 'grammar' | 'custom'; label: string }[]
                ).map((item) => (
                  <button
                    key={String(item.key)}
                    type="button"
                    onClick={() => setKoLessonFilter(item.key)}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wider shrink-0 border transition cursor-pointer ${
                      koLessonFilter === item.key
                        ? 'bg-[#4E8A6E]/25 border-[#7BC2A0] text-[#E6F4EC] font-semibold'
                        : 'bg-[#0D0C0A] border-[#C5A059]/20 text-[#968D80] hover:text-[#ECE6D8]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {(['all', 1, 2, 3, 4, 'custom'] as const).map((act) => (
                  <button
                    key={String(act)}
                    type="button"
                    onClick={() => setActFilter(act)}
                    className={`px-3.5 py-2 text-xs uppercase tracking-wider shrink-0 border transition cursor-pointer ${
                      actFilter === act
                        ? 'bg-[#C5A059]/20 border-[#E2C88D] text-[#E2C88D] font-semibold'
                        : 'bg-[#0D0C0A] border-[#C5A059]/20 text-[#968D80]'
                    }`}
                  >
                    {act === 'all' ? 'Tất cả' : act === 'custom' ? 'Tự thêm' : `Ch.${act}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeKoLessonMeta && (
            <div className="sanctuary-panel p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-2 border-l-[#4E8A6E]">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#7BC2A0]">
                  Sejong 1 • Bài {activeKoLessonMeta.lesson} ({activeKoLessonIds.length} thẻ)
                </p>
                <p className="text-base font-semibold text-[#F4EFE4]">
                  {activeKoLessonMeta.titleKo}
                  <span className="text-sm font-normal text-[#968D80]"> — {activeKoLessonMeta.titleVi}</span>
                </p>
                <p className="text-xs text-[#C8BFB0]">
                  <span className="text-[#C5A059]">Ngữ pháp trọng tâm: </span>
                  {activeKoLessonMeta.grammars.join('  •  ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBatchSavedVocab(activeKoLessonIds, !activeKoLessonAllSaved)}
                className={`px-4 py-2.5 text-xs uppercase tracking-[0.14em] shrink-0 cursor-pointer border transition ${
                  activeKoLessonAllSaved
                    ? 'bg-[#4E8A6E]/20 border-[#4E8A6E] text-[#7BC2A0] hover:bg-[#8E2933]/20 hover:border-[#B83B47] hover:text-[#F2B5BC]'
                    : 'btn-brass'
                }`}
              >
                {activeKoLessonAllSaved
                  ? `Đã thêm đủ Bài ${activeKoLessonMeta.lesson} ✓ (Bấm để bỏ)`
                  : `+ Thêm cả Bài ${activeKoLessonMeta.lesson} vào SRS`}
              </button>
            </div>
          )}

          {filteredLibrary.length === 0 ? (
            <div className="sanctuary-panel p-8 text-center text-sm text-[#968D80]">
              Không tìm thấy thẻ nào khớp bộ lọc. Bạn có thể bấm <strong className="text-[#E2C88D]">Thêm Thẻ Bài Học</strong> ở
              trên để tự tạo thẻ mới.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredLibrary.slice(0, visibleCount).map((v) => {
                const saved = savedSet.has(v.id);
                return (
                  <div key={v.id} className="sanctuary-panel p-4 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`${isKorean ? 'font-sans font-semibold' : 'font-fantasy'} text-base text-[#F4EFE4]`}>
                              {v.word}
                            </span>
                            {(v.ipa || v.romanization) && (
                              <span className={`font-sans text-xs sm:text-sm ${isKorean ? 'text-[#7BC2A0]' : 'text-[#C5A059]'}`}>
                                {v.ipa || `[${v.romanization}]`}
                              </span>
                            )}
                            <span className="text-[10px] uppercase tracking-wider text-[#968D80]">
                              ({v.pos})
                            </span>
                          </div>
                          <p className="text-sm text-[#E2C88D] mt-0.5">{v.meaningVi}</p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              speakText(getSpeakableText(v), {
                                lang: speechLang,
                                rate: isKorean ? 0.85 : 0.9,
                              })
                            }
                            className="p-2 bg-[#0B0A08] border border-[#C5A059]/20 hover:border-[#E2C88D] text-[#C5A059] cursor-pointer"
                            aria-label="Phát âm"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSavedVocab(v.id)}
                            className={`p-2 border cursor-pointer ${
                              saved
                                ? 'bg-[#4E8A6E]/20 border-[#4E8A6E] text-[#7BC2A0]'
                                : 'bg-[#0B0A08] border-[#C5A059]/20 text-[#968D80] hover:text-[#E2C88D]'
                            }`}
                            aria-label={saved ? 'Bỏ khỏi bộ ôn' : 'Thêm vào bộ ôn'}
                          >
                            {saved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                          </button>
                          {v.isCustom && (
                            <button
                              type="button"
                              onClick={() => deleteCustomVocab(v.id)}
                              className="p-2 bg-[#0B0A08] border border-[#8E2933]/40 hover:border-[#B83B47] text-[#F2B5BC] cursor-pointer"
                              aria-label="Xóa thẻ tự tạo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-[#C8BFB0] mt-2.5 leading-relaxed">{v.exampleEn}</p>
                      {v.grammarNoteVi && (
                        <p className="text-[11px] text-[#968D80] mt-1.5 leading-relaxed">
                          <span className="text-[#C5A059]">Mẹo:</span> {v.grammarNoteVi}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#C5A059]/12 text-[11px]">
                      <span className="text-[#968D80]">
                        {v.isCustom
                          ? 'Thẻ tự thêm'
                          : isKorean
                          ? `Sejong 1 • Bài ${v.lessonNum ?? v.act}`
                          : `Chương ${v.act}`}{' '}
                        • {v.topic}
                      </span>
                      {v.paraphrases.length > 0 && (
                        <span className="text-[#C5A059]">≈ {v.paraphrases.slice(0, 2).join(', ')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>

              {filteredLibrary.length > visibleCount && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + LIBRARY_PAGE_SIZE)}
                    className="btn-ghost-brass px-5 py-2.5 text-xs uppercase tracking-[0.14em] cursor-pointer"
                  >
                    Xem thêm (+{Math.min(LIBRARY_PAGE_SIZE, filteredLibrary.length - visibleCount)} thẻ) • Đang hiện{' '}
                    {visibleCount}/{filteredLibrary.length}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
