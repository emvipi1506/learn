import { useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import { SPEAKING_LESSONS, WRITING_LESSONS } from '../data/lessons';
import { AIFeedbackCard } from './AIFeedbackCard';
import type { PracticeSubmission } from '../types';

interface SubmissionDetailModalProps {
  submission: PracticeSubmission | null;
  onClose: () => void;
}

function getPromptText(submission: PracticeSubmission): string | null {
  if (submission.skill === 'writing') {
    const lesson = WRITING_LESSONS.find((l) => l.id === submission.promptId);
    return lesson?.promptEn ?? null;
  }
  const lesson = SPEAKING_LESSONS.find((l) => l.id === submission.promptId);
  if (!lesson) return null;
  const bullets = lesson.cueCardBullets?.length
    ? `\n• ${lesson.cueCardBullets.join('\n• ')}`
    : '';
  return `${lesson.questions.join('\n')}${bullets}`;
}

export function SubmissionDetailModal({ submission, onClose }: SubmissionDetailModalProps) {
  useEffect(() => {
    if (!submission) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submission, onClose]);

  if (!submission) return null;

  const promptText = getPromptText(submission);
  const createdDate = new Date(submission.createdAt);
  const formattedDate = Number.isNaN(createdDate.getTime())
    ? submission.createdAt
    : createdDate.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl ornate-panel p-5 sm:p-7 relative max-h-[90vh] overflow-y-auto space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#968D80] hover:text-[#ECE6D8] cursor-pointer"
          aria-label="Đóng chi tiết bài nộp"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="pr-8 pb-4 border-b border-[#C5A059]/20 space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="font-fantasy uppercase tracking-[0.2em] text-[#C5A059]">
              ◆ {submission.skill === 'writing' ? 'Writing' : 'Speaking'}
            </span>
            <span className="text-[#968D80] inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> {formattedDate}
            </span>
            <span className="px-2 py-0.5 bg-[#090807] border border-[#C5A059]/40 font-crest text-[#E2C88D]">
              {submission.bandEstimate > 0 ? `Band ~${submission.bandEstimate.toFixed(1)}` : 'Tự luyện'}
            </span>
          </div>
          <h2 className="font-fantasy text-xl sm:text-2xl text-[#F4EFE4]">{submission.promptTitle}</h2>
        </div>

        {promptText && (
          <div className="p-4 bg-[#0B0A08] border-l-2 border-[#C5A059] space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#C5A059] font-semibold">
              Đề bài
            </p>
            <p className="text-xs sm:text-sm text-[#C8BFB0] leading-relaxed whitespace-pre-line">
              {promptText}
            </p>
          </div>
        )}

        <div className="p-4 bg-[#090807] border border-[#C5A059]/20 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#E2C88D] font-semibold">
            {submission.skill === 'writing' ? 'Bài viết đã nộp' : 'Transcript / Nội dung luyện nói'}
          </p>
          <p className="text-sm text-[#ECE6D8] leading-[1.8] whitespace-pre-line">
            {submission.content}
          </p>
        </div>

        {submission.aiFeedback ? (
          <AIFeedbackCard feedback={submission.aiFeedback} />
        ) : (
          <div className="p-4 bg-[#0D0C0A] border border-[#C5A059]/18 text-xs text-[#968D80]">
            Bài nộp này được lưu ở chế độ tự luyện (chưa chấm 4 tiêu chí bằng Gemini AI).
          </div>
        )}
      </div>
    </div>
  );
}
