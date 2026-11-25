import React, { useState } from 'react';
import { ArrowRight, Check, Compass, Layers, Target } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { ACTS, DAILY_QUESTS, estimateMonthsToTarget, getRankTitle } from '../data/roadmap';
import {
  LISTENING_LESSONS,
  READING_LESSONS,
  SPEAKING_LESSONS,
  WRITING_LESSONS,
} from '../data/lessons';
import { PlacementModal } from '../components/PlacementModal';
import { RuneDivider } from '../components/Ornament';
import { SkillRadarChart } from '../components/SkillRadarChart';
import {
  HeroCitadelArt,
  ListeningBellArt,
  ReadingTomeArt,
  SpeakingBrazierArt,
  WritingQuillArt,
} from '../components/DarkArtworks';
import type { NavTab } from '../types';

export function DashboardPage({ onNavigate }: { onNavigate: (tab: NavTab) => void }) {
  const {
    profile,
    lessonProgress,
    daily,
    dueVocabCount,
    dueVocabByLang,
    setActiveStudyLang,
    submissions,
  } = useApp();
  const [placementOpen, setPlacementOpen] = useState(false);

  const openVocabByLang = (lang: 'en' | 'ko') => {
    setActiveStudyLang(lang);
    onNavigate('vocab');
  };

  const rank = getRankTitle(profile.level);
  const currentActInfo = ACTS.find((a) => a.act === profile.currentAct) ?? ACTS[0];
  const estimate = estimateMonthsToTarget(profile.currentBand, profile.targetBand, profile.dailyMinutes);

  const radarData = [
    { skill: 'Listening', band: profile.skillBands.listening, fullMark: 9 },
    { skill: 'Reading', band: profile.skillBands.reading, fullMark: 9 },
    { skill: 'Writing', band: profile.skillBands.writing, fullMark: 9 },
    { skill: 'Speaking', band: profile.skillBands.speaking, fullMark: 9 },
  ];

  const skillRealms = [
    {
      id: 'listening' as NavTab,
      roman: 'I',
      title: 'Listening',
      vi: 'Thính Giác & Chép Chính Tả',
      band: profile.skillBands.listening,
      done: LISTENING_LESSONS.filter((l) => lessonProgress[l.id]).length,
      total: LISTENING_LESSONS.length,
      Art: ListeningBellArt,
    },
    {
      id: 'reading' as NavTab,
      roman: 'II',
      title: 'Reading',
      vi: 'Cổ Thư Đọc Hiểu Học Thuật',
      band: profile.skillBands.reading,
      done: READING_LESSONS.filter((l) => lessonProgress[l.id]).length,
      total: READING_LESSONS.length,
      Art: ReadingTomeArt,
    },
    {
      id: 'writing' as NavTab,
      roman: 'III',
      title: 'Writing',
      vi: 'Bàn Khắc Luận & AI Chấm',
      band: profile.skillBands.writing,
      done: WRITING_LESSONS.filter((l) => lessonProgress[l.id]).length,
      total: WRITING_LESSONS.length,
      Art: WritingQuillArt,
    },
    {
      id: 'speaking' as NavTab,
      roman: 'IV',
      title: 'Speaking',
      vi: 'Lò Luyện Thanh Âm & Thu Âm',
      band: profile.skillBands.speaking,
      done: SPEAKING_LESSONS.filter((l) => lessonProgress[l.id]).length,
      total: SPEAKING_LESSONS.length,
      Art: SpeakingBrazierArt,
    },
  ];

  const totalCompletedLessons = Object.keys(lessonProgress).length;
  const totalLessons =
    LISTENING_LESSONS.length +
    READING_LESSONS.length +
    WRITING_LESSONS.length +
    SPEAKING_LESSONS.length;

  return (
    <div className="space-y-8">
      {/* === EDITORIAL HERO BANNER VỚI TRANH KHẮC GOTHIC === */}
      <section className="ornate-panel relative overflow-hidden">
        <HeroCitadelArt className="absolute inset-0 w-full h-full object-cover opacity-90 pointer-events-none" />

        <div className="relative z-10 px-6 py-8 sm:px-9 sm:py-10 max-w-2xl space-y-4">
          <p className="font-fantasy text-[11px] uppercase tracking-[0.26em] text-[#C5A059]">
            Chương {currentActInfo.roman} ◆ {currentActInfo.fantasyTitle} ({currentActInfo.bandRange})
          </p>

          <h1 className="font-fantasy text-2xl sm:text-4xl font-semibold text-[#F4EFE4] tracking-wide leading-[1.2]">
            {currentActInfo.name}
          </h1>

          <p className="text-sm sm:text-[15px] text-[#C8BFB0] leading-relaxed max-w-xl">
            Chào <span className="text-[#ECE6D8] font-medium">{profile.displayName}</span> ({rank.title}). Với nhịp học{' '}
            <span className="text-[#E2C88D] font-medium">{(profile.dailyMinutes / 60).toFixed(1)} giờ/ngày</span>, lộ trình dự
            kiến khoảng <span className="text-[#ECE6D8] font-medium">{estimate.months} tháng</span> (~{estimate.hoursNeeded}{' '}
            giờ) để đạt <span className="text-[#E2C88D] font-semibold">IELTS Overall {profile.targetBand.toFixed(1)}</span>.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => setPlacementOpen(true)}
              className="btn-brass px-5 py-2.5 text-xs uppercase tracking-[0.14em] inline-flex items-center gap-2 cursor-pointer"
            >
              <Target className="w-3.5 h-3.5" />
              {profile.placementCompleted ? 'Định Vị Lại Trình Độ' : 'Kiểm Tra Xếp Lớp (2 Phút)'}
            </button>

            <button
              onClick={() => onNavigate('roadmap')}
              className="btn-ghost-brass px-4 py-2.5 text-xs uppercase tracking-[0.14em] inline-flex items-center gap-2 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" /> Bản Đồ 0 → 6.5
            </button>
          </div>
        </div>

        {/* Dải chỉ số đáy phẳng — phân cách đường mảnh chuẩn game AAA */}
        <div className="relative z-10 grid grid-cols-3 divide-x divide-[#C5A059]/18 border-t border-[#C5A059]/20 bg-[#0B0A08]/85 backdrop-blur-xs">
          <div className="px-4 py-3.5 sm:px-7">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#968D80]">Band Ước Tính</p>
            <p className="font-crest text-xl sm:text-2xl text-[#E2C88D] mt-0.5">
              {profile.currentBand.toFixed(1)}
              <span className="text-xs text-[#968D80] font-sans ml-1">/ {profile.targetBand.toFixed(1)}</span>
            </p>
          </div>

          <div className="px-4 py-3.5 sm:px-7">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#968D80]">Ngọn Lửa Liên Tiếp</p>
            <p className="font-crest text-xl sm:text-2xl text-[#ECE6D8] mt-0.5">
              {profile.streakDays} <span className="text-xs text-[#968D80] font-sans">ngày</span>
            </p>
          </div>

          <div className="px-4 py-3.5 sm:px-7">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#968D80]">Tiến Độ Điện Thờ</p>
            <p className="font-crest text-xl sm:text-2xl text-[#ECE6D8] mt-0.5">
              {totalCompletedLessons}
              <span className="text-xs text-[#968D80] font-sans"> / {totalLessons} bài</span>
            </p>
          </div>
        </div>
      </section>

      {/* === TỨ ĐIỆN KỸ NĂNG — 4 LÁ BÀI KHẮC ĐỒNG NGHỆ THUẬT === */}
      <section className="space-y-4">
        <RuneDivider label="Tứ Điện Kỹ Năng IELTS" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {skillRealms.map((realm) => {
            const Art = realm.Art;
            const pct = Math.round((realm.done / realm.total) * 100);
            return (
              <button
                key={realm.id}
                onClick={() => onNavigate(realm.id)}
                className="group sanctuary-panel text-left overflow-hidden transition-all duration-200 hover:border-[#C5A059]/60 cursor-pointer flex flex-col"
              >
                {/* Tranh khắc đồng phía trên */}
                <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-[#C5A059]/18 bg-[#0E0C0A]">
                  <Art className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute top-2.5 left-3 font-crest text-[11px] tracking-[0.2em] text-[#C5A059]/85">
                    {realm.roman}
                  </span>
                  <span className="absolute top-2.5 right-3 px-2 py-0.5 bg-[#090807]/85 border border-[#C5A059]/35 font-crest text-[11px] text-[#E2C88D]">
                    {realm.band.toFixed(1)}
                  </span>
                </div>

                {/* Thông tin gọn gàng phía dưới */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3.5">
                  <div>
                    <h3 className="font-crest text-lg text-[#F4EFE4] tracking-wider group-hover:text-[#E2C88D] transition-colors">
                      {realm.title}
                    </h3>
                    <p className="text-xs text-[#968D80] mt-0.5">{realm.vi}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] text-[#968D80]">
                      <span>Hoàn thành</span>
                      <span className="text-[#ECE6D8]">
                        {realm.done}/{realm.total}
                      </span>
                    </div>
                    <div className="h-[2px] bg-[#24201B]">
                      <div className="h-full bg-[#C5A059]" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[#C5A059] flex items-center gap-1.5 pt-1 group-hover:gap-2.5 transition-all">
                      Bước vào <ArrowRight className="w-3 h-3" />
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* === NHIỆM VỤ HÔM NAY + BIỂU ĐỒ RADAR CỔ ĐIỂN === */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Khế Ước Hàng Ngày */}
        <section className="lg:col-span-7 sanctuary-panel p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3 pb-3 border-b border-[#C5A059]/15">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#C5A059]">Khế Ước Ngày</p>
              <h2 className="font-fantasy text-xl text-[#F4EFE4] mt-0.5">Nhiệm Vụ Rèn Luyện Hôm Nay</h2>
            </div>
            {dueVocabCount > 0 && (
              <button
                onClick={() => onNavigate('vocab')}
                className="btn-ghost-brass px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" /> Ôn {dueVocabCount} từ SRS
              </button>
            )}
          </div>

          <div className="divide-y divide-[#C5A059]/12">
            {DAILY_QUESTS.map((q) => {
              const completed = daily.completedQuests.includes(q.id);
              const progressText =
                q.targetType === 'vocab'
                  ? `${Math.min(daily.vocabReviewed, q.targetCount)}/${q.targetCount}`
                  : q.targetType === 'lesson'
                  ? `${Math.min(daily.lessonsCompleted, q.targetCount)}/${q.targetCount}`
                  : '1/1';
              return (
                <div key={q.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-5 h-5 mt-0.5 flex items-center justify-center border shrink-0 ${
                        completed
                          ? 'bg-[#4E8A6E]/20 border-[#4E8A6E] text-[#7BC2A0]'
                          : 'border-[#C5A059]/35 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${completed ? 'text-[#968D80] line-through' : 'text-[#ECE6D8]'}`}>
                        {q.title}
                      </p>
                      <p className="text-xs text-[#968D80] mt-0.5">{q.description}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-crest text-xs text-[#E2C88D]">+{q.xp} XP</p>
                    <p className="text-[11px] text-[#968D80] mt-0.5">{progressText}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => openVocabByLang('ko')}
              className="p-3.5 bg-[#0D0C0A] border border-[#4E8A6E]/45 hover:border-[#7BC2A0] text-left transition cursor-pointer flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#7BC2A0]">
                  Sáng / Trưa • 15 Phút
                </p>
                <p className="font-fantasy text-sm text-[#F4EFE4] mt-0.5">
                  Ôn Tiếng Hàn (KO)
                </p>
                <p className="text-[11px] text-[#968D80] mt-0.5">
                  {dueVocabByLang.ko > 0 ? `${dueVocabByLang.ko} thẻ đến hạn SRS` : 'Đã xong đợt ôn hôm nay'}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#7BC2A0] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => openVocabByLang('en')}
              className="p-3.5 bg-[#0D0C0A] border border-[#C5A059]/35 hover:border-[#E2C88D] text-left transition cursor-pointer flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#C5A059]">
                  Buổi Tối • 15 Phút
                </p>
                <p className="font-fantasy text-sm text-[#F4EFE4] mt-0.5">
                  Ôn Tiếng Anh (EN)
                </p>
                <p className="text-[11px] text-[#968D80] mt-0.5">
                  {dueVocabByLang.en > 0 ? `${dueVocabByLang.en} thẻ đến hạn SRS` : 'Đã xong đợt ôn hôm nay'}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#E2C88D] shrink-0" />
            </button>
          </div>

          <div className="p-4 bg-[#0D0C0A] border-l-2 border-[#C5A059] text-xs text-[#C8BFB0] leading-relaxed">
            <span className="text-[#E2C88D] font-semibold">Lịch tách ngữ cảnh (&lt;45p/ngày): </span>
            Tách giờ ôn Tiếng Hàn (sáng/trưa) và Tiếng Anh (tối) tối thiểu 3–4 tiếng để chống nhiễu. Tối muộn dành 15p luân phiên: ngày chẵn làm bài Anh, ngày lẻ ôn ngữ pháp Hàn.
          </div>
        </section>

        {/* Biểu đồ Radar 4 Kỹ Năng tông Đồng & Huyết */}
        <section className="lg:col-span-5 sanctuary-panel p-5 sm:p-6 flex flex-col justify-between">
          <div className="pb-3 border-b border-[#C5A059]/15">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#C5A059]">La Bàn Năng Lực</p>
            <h2 className="font-fantasy text-xl text-[#F4EFE4] mt-0.5">Cân Bằng 4 Kỹ Năng</h2>
          </div>

          <div className="h-56 w-full my-2 flex items-center justify-center">
            <SkillRadarChart bands={profile.skillBands} />
          </div>

          <div className="grid grid-cols-4 divide-x divide-[#C5A059]/15 pt-3 border-t border-[#C5A059]/15 text-center">
            {radarData.map((r) => (
              <div key={r.skill}>
                <p className="text-[10px] uppercase tracking-wider text-[#968D80]">{r.skill.slice(0, 4)}</p>
                <p className="font-crest text-sm text-[#E2C88D] mt-0.5">{r.band.toFixed(1)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Bài nộp gần đây */}
      {submissions.length > 0 && (
        <section className="sanctuary-panel p-5 sm:p-6 space-y-4">
          <div className="pb-3 border-b border-[#C5A059]/15">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#C5A059]">Biên Niên Sử</p>
            <h2 className="font-fantasy text-lg text-[#F4EFE4] mt-0.5">Bài Writing & Speaking Gần Đây</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {submissions.slice(0, 4).map((sub) => (
              <div key={sub.id} className="p-4 bg-[#0D0C0A] border border-[#C5A059]/16">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="uppercase tracking-[0.18em] text-[#C5A059]">{sub.skill}</span>
                  <span className="font-crest text-[#E2C88D]">Band ~{sub.bandEstimate.toFixed(1)}</span>
                </div>
                <p className="text-sm font-medium text-[#ECE6D8] mt-1.5 line-clamp-1">{sub.promptTitle}</p>
                <p className="text-xs text-[#968D80] mt-1 line-clamp-2">{sub.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <PlacementModal open={placementOpen} onClose={() => setPlacementOpen(false)} />
    </div>
  );
}
