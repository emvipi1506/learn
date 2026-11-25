import { useCallback, useEffect, useState } from 'react';
import { Award, Check, X } from 'lucide-react';
import { PLACEMENT_QUESTIONS, estimateMonthsToTarget, roundIeltsBand } from '../data/roadmap';
import { useApp } from '../store/AppContext';
import type { ActNumber } from '../types';

interface PlacementModalProps {
  open: boolean;
  onClose: () => void;
}

export function PlacementModal({ open, onClose }: PlacementModalProps) {
  const { profile, completePlacement } = useApp();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finishedResult, setFinishedResult] = useState<{
    band: number;
    act: ActNumber;
    correctCount: number;
    awardedXp: boolean;
  } | null>(null);

  const resetAndClose = useCallback(() => {
    setStep(0);
    setAnswers({});
    setFinishedResult(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resetAndClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, resetAndClose]);

  if (!open) return null;

  const currentQ = PLACEMENT_QUESTIONS[step];
  const totalQ = PLACEMENT_QUESTIONS.length;

  const handleChoose = (optionIdx: number) => {
    const nextAnswers = { ...answers, [currentQ.id]: optionIdx };
    setAnswers(nextAnswers);

    if (step < totalQ - 1) {
      setStep(step + 1);
    } else {
      let earnedWeight = 0;
      let totalWeight = 0;
      let correctCount = 0;
      for (const q of PLACEMENT_QUESTIONS) {
        totalWeight += q.weight;
        if (nextAnswers[q.id] === q.correctIndex) {
          earnedWeight += q.weight;
          correctCount += 1;
        }
      }
      const ratio = earnedWeight / totalWeight;
      const estimatedBand = roundIeltsBand(2.5 + ratio * 3.5);
      const act: ActNumber =
        estimatedBand >= 6.0 ? 4 : estimatedBand >= 5.0 ? 3 : estimatedBand >= 4.0 ? 2 : 1;

      const awardedXp = !profile.placementCompleted;
      completePlacement(
        estimatedBand,
        {
          listening: estimatedBand,
          reading: estimatedBand,
          writing: roundIeltsBand(Math.max(2.5, estimatedBand - 0.5)),
          speaking: roundIeltsBand(Math.max(2.5, estimatedBand - 0.5)),
        },
        act
      );
      setFinishedResult({ band: estimatedBand, act, correctCount, awardedXp });
    }
  };

  const estimate = finishedResult
    ? estimateMonthsToTarget(finishedResult.band, profile.targetBand, profile.dailyMinutes)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={resetAndClose}
    >
      <div
        className="w-full max-w-xl ornate-panel p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={resetAndClose}
          className="absolute top-5 right-5 p-1.5 text-[#968D80] hover:text-[#ECE6D8] cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        {!finishedResult ? (
          <>
            <p className="font-fantasy text-[11px] uppercase tracking-[0.24em] text-[#C5A059]">
              ◆ Nghi Thức Định Vị Trình Độ
            </p>
            <h2 className="font-fantasy text-xl sm:text-2xl text-[#F4EFE4] mt-1.5">
              Câu {step + 1} / {totalQ} — {currentQ.skillLabel}
            </h2>

            <div className="mt-4 h-[2px] w-full bg-[#24201B]">
              <div
                className="h-full bg-[#C5A059] transition-all duration-300"
                style={{ width: `${((step + 1) / totalQ) * 100}%` }}
              />
            </div>

            <p className="mt-6 text-base text-[#ECE6D8] leading-relaxed">{currentQ.prompt}</p>

            <div className="mt-5 space-y-2.5">
              {currentQ.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleChoose(idx)}
                  className="w-full text-left px-4 py-3.5 bg-[#0D0C0A] hover:bg-[#C5A059]/12 border border-[#C5A059]/20 hover:border-[#E2C88D]/70 text-sm text-[#ECE6D8] transition flex items-start gap-3.5 cursor-pointer"
                >
                  <span className="font-fantasy text-xs text-[#C5A059] pt-0.5">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <span>{opt}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-3">
            <div className="w-14 h-14 mx-auto border border-[#C5A059]/60 bg-[#0D0C0A] flex items-center justify-center mb-4">
              <Award className="w-7 h-7 text-[#E2C88D]" />
            </div>
            <p className="font-fantasy text-[11px] uppercase tracking-[0.24em] text-[#C5A059]">
              {finishedResult.awardedXp ? 'Hoàn Thành Định Vị (+80 XP)' : 'Đã Cập Nhật Định Vị'}
            </p>
            <h2 className="font-fantasy text-3xl text-[#F4EFE4] mt-2">
              Band Khởi Điểm: {finishedResult.band.toFixed(1)}
            </h2>
            <p className="text-sm text-[#968D80] mt-2 leading-relaxed">
              Bạn trả lời đúng <strong className="text-[#ECE6D8]">{finishedResult.correctCount}/{totalQ}</strong> câu.
              Lộ trình đã được căn chỉnh bắt đầu từ{' '}
              <strong className="text-[#E2C88D]">Chương {finishedResult.act}</strong>.
            </p>

            {estimate && (
              <div className="mt-6 grid grid-cols-2 divide-x divide-[#C5A059]/20 border border-[#C5A059]/20 bg-[#0D0C0A] text-left">
                <div className="p-4">
                  <p className="text-[11px] uppercase tracking-wider text-[#968D80]">Tổng thời lượng luyện</p>
                  <p className="font-fantasy text-xl text-[#E2C88D] mt-1">
                    {estimate.hoursNeeded === 0 ? 'Đã đạt mục tiêu' : `~${estimate.hoursNeeded} giờ`}
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-[11px] uppercase tracking-wider text-[#968D80]">
                    {(profile.dailyMinutes / 60).toFixed(1)}h/ngày lên {profile.targetBand.toFixed(1)}
                  </p>
                  <p className="font-fantasy text-xl text-[#ECE6D8] mt-1">
                    {estimate.months === 0 ? '0 tháng' : `~${estimate.months} tháng`}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={resetAndClose}
              className="mt-6 w-full btn-brass py-3 text-xs uppercase tracking-[0.16em] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Bắt Đầu Chinh Phục Chương {finishedResult.act}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
