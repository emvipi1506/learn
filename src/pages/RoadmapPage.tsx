import React, { useEffect, useState } from 'react';
import { CalendarClock, Check, Flag, Target } from 'lucide-react';
import { ACTS, estimateMonthsToTarget } from '../data/roadmap';
import { useApp } from '../store/AppContext';
import { RuneDivider } from '../components/Ornament';
import type { ActNumber, NavTab } from '../types';

export function RoadmapPage({ onNavigate }: { onNavigate: (tab: NavTab) => void }) {
  const { profile, updateProfileSettings } = useApp();
  const [simHours, setSimHours] = useState<number>(Number((profile.dailyMinutes / 60).toFixed(1)));
  const [simStartBand, setSimStartBand] = useState<number>(profile.currentBand);

  useEffect(() => {
    setSimHours(Number((profile.dailyMinutes / 60).toFixed(1)));
  }, [profile.dailyMinutes]);

  useEffect(() => {
    setSimStartBand(profile.currentBand);
  }, [profile.currentBand]);

  const simEstimate = estimateMonthsToTarget(simStartBand, profile.targetBand, Math.round(simHours * 60));

  const applyDailyPlan = () => {
    updateProfileSettings({ dailyMinutes: Math.round(simHours * 60) });
  };

  return (
    <div className="space-y-7">
      <div className="pb-4 border-b border-[#C5A059]/18">
        <p className="font-fantasy text-[11px] uppercase tracking-[0.24em] text-[#C5A059]">
          ◆ Bản Đồ Chiến Dịch • 0 → IELTS 6.5
        </p>
        <h1 className="font-fantasy text-2xl sm:text-3xl text-[#F4EFE4] mt-1">
          Lộ Trình Thực Tế Cho Người Mới Bắt Đầu
        </h1>
        <p className="text-sm text-[#968D80] mt-1">
          Đi tuần tự qua 4 Chương từ mất gốc đến chiến thuật phối điểm Overall 6.5 — rõ thời gian, không học lan man.
        </p>
      </div>

      {/* MÁY TÍNH THỜI GIAN ĐẠT 6.5 */}
      <section className="ornate-panel p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#C5A059]/15">
          <h2 className="font-fantasy text-lg text-[#E2C88D] flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#C5A059]" />
            Ước Tính Thời Gian Đạt IELTS {profile.targetBand.toFixed(1)}
          </h2>
          <button
            onClick={applyDailyPlan}
            className="btn-ghost-brass px-3.5 py-1.5 text-[11px] uppercase tracking-[0.12em] cursor-pointer"
          >
            Áp dụng {simHours}h/ngày vào hồ sơ
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#968D80]">Trình độ hiện tại</span>
                <span className="font-fantasy text-[#E2C88D]">Band {simStartBand.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={2.0}
                max={6.0}
                step={0.5}
                value={simStartBand}
                onChange={(e) => setSimStartBand(Number(e.target.value))}
                className="w-full accent-[#C5A059]"
              />
              <div className="flex justify-between text-[11px] text-[#968D80] mt-1">
                <span>2.0 (Mất gốc)</span>
                <span>4.0 (Cơ bản)</span>
                <span>6.0 (Khá)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#968D80]">Thời gian học mỗi ngày</span>
                <span className="font-fantasy text-[#ECE6D8]">{simHours.toFixed(1)} giờ / ngày</span>
              </div>
              <input
                type="range"
                min={1.0}
                max={4.0}
                step={0.5}
                value={simHours}
                onChange={(e) => setSimHours(Number(e.target.value))}
                className="w-full accent-[#8E2933]"
              />
              <div className="flex justify-between text-[11px] text-[#968D80] mt-1">
                <span>1.0h (Nhẹ)</span>
                <span>2.0–2.5h (Khuyên dùng)</span>
                <span>4.0h (Cấp tốc)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-[#C5A059]/20 border border-[#C5A059]/22 bg-[#0B0A08]">
            <div className="p-4 flex flex-col justify-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#968D80]">Thời gian dự kiến</p>
              <p className="font-fantasy text-3xl text-[#E2C88D] mt-1">~{simEstimate.months} th</p>
              <p className="text-[11px] text-[#968D80] mt-1">Tổng ~{simEstimate.hoursNeeded} giờ</p>
            </div>

            <div className="p-4 flex flex-col justify-center">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#C5A059]">Chiến lược 6.5 tối ưu</p>
              <p className="text-xs font-medium text-[#ECE6D8] mt-1.5 leading-relaxed">
                Listening 7.0 • Reading 7.0
                <br />
                Writing 6.0 • Speaking 6.0
              </p>
              <p className="text-[11px] text-[#7BC2A0] mt-1">→ Overall 6.5 bền vững</p>
            </div>
          </div>
        </div>
      </section>

      <RuneDivider label="Tứ Chương Chinh Phục" />

      {/* 4 CHƯƠNG */}
      <div className="space-y-4">
        {ACTS.map((act) => {
          const isCurrent = profile.currentAct === act.act;
          const isPassed = profile.currentAct > act.act;
          return (
            <section
              key={act.act}
              className={`p-5 sm:p-6 transition ${
                isCurrent ? 'ornate-panel border-[#E2C88D]/65' : 'sanctuary-panel'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em]">
                    <span className="font-fantasy text-[#E2C88D] font-semibold">
                      Chương {act.roman} • {act.bandRange}
                    </span>
                    <span className="text-[#968D80]">| {act.durationMonths}</span>
                    {isCurrent && (
                      <span className="text-[#7BC2A0] inline-flex items-center gap-1 font-semibold">
                        <Flag className="w-3 h-3" /> Đang luyện
                      </span>
                    )}
                    {isPassed && (
                      <span className="text-[#C5A059] inline-flex items-center gap-1">
                        <Check className="w-3 h-3" /> Đã mở khóa
                      </span>
                    )}
                  </div>

                  <h3 className="font-fantasy text-xl text-[#F4EFE4]">
                    {act.name}{' '}
                    <span className="font-editorial italic text-base text-[#C5A059] font-normal">
                      — {act.fantasyTitle}
                    </span>
                  </h3>
                  <p className="text-sm text-[#C8BFB0] leading-relaxed">{act.goalVi}</p>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {!isCurrent && (
                    <button
                      onClick={() => updateProfileSettings({ currentAct: act.act as ActNumber })}
                      className="btn-ghost-brass px-3.5 py-2 text-[11px] uppercase tracking-wider cursor-pointer"
                    >
                      Đặt làm chặng chính
                    </button>
                  )}
                  <button
                    onClick={() =>
                      onNavigate(
                        act.act === 1 ? 'vocab' : act.act === 2 ? 'listening' : act.act === 3 ? 'reading' : 'writing'
                      )
                    }
                    className="btn-brass px-4 py-2 text-[11px] uppercase tracking-[0.14em] cursor-pointer"
                  >
                    Vào Luyện
                  </button>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-[#C5A059]/15 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C5A059] mb-2 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" /> Mốc vượt Chương {act.roman}
                  </p>
                  <ul className="space-y-1.5 text-xs text-[#ECE6D8]/90 list-disc pl-4">
                    {act.milestones.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 bg-[#0B0A08] border border-[#C5A059]/16 flex flex-col justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E2C88D]">
                      Nhịp học 2 giờ / ngày
                    </p>
                    <p className="text-xs text-[#C8BFB0] mt-1.5 leading-relaxed">{act.dailySplit}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['listening', 'reading', 'writing', 'speaking'] as NavTab[]).map((skill) => (
                      <button
                        key={skill}
                        onClick={() => onNavigate(skill)}
                        className="px-2.5 py-1 bg-[#14120F] hover:border-[#E2C88D] border border-[#C5A059]/22 text-[11px] uppercase tracking-wider text-[#ECE6D8] cursor-pointer"
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
