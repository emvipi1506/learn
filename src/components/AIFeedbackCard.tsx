import React from 'react';
import { Check, TrendingUp } from 'lucide-react';
import type { AIFeedbackResult } from '../types';

export function AIFeedbackCard({ feedback }: { feedback: AIFeedbackResult }) {
  return (
    <div className="ornate-panel p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#C5A059]/20">
        <div>
          <p className="font-fantasy text-[11px] uppercase tracking-[0.22em] text-[#C5A059]">
            ◆ Phán Quyết Từ Giám Khảo AI
          </p>
          <p className="text-sm text-[#ECE6D8] mt-1">{feedback.encouragementVi}</p>
        </div>

        <div className="px-4 py-2 bg-[#0D0C0A] border border-[#C5A059]/45 text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#968D80]">Band Ước Tính</p>
          <p className="font-crest text-2xl text-[#E2C88D] mt-0.5">
            {feedback.overallBand.toFixed(1)}
          </p>
        </div>
      </div>

      {/* 4 Tiêu chí IELTS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {feedback.criteria.map((c, idx) => (
          <div key={idx} className="p-3.5 bg-[#0D0C0A] border border-[#C5A059]/18">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-semibold text-[#E2C88D]">{c.name}</span>
              <span className="font-crest text-sm text-[#ECE6D8]">{c.score.toFixed(1)}</span>
            </div>
            <p className="text-xs text-[#C8BFB0] leading-relaxed">{c.commentVi}</p>
          </div>
        ))}
      </div>

      {/* Điểm mạnh & Cần sửa */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-[#4E8A6E]/[0.07] border border-[#4E8A6E]/30">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7BC2A0] flex items-center gap-1.5 mb-2">
            <Check className="w-3.5 h-3.5" /> Điểm làm tốt
          </p>
          <ul className="space-y-1.5 text-xs text-[#ECE6D8]/90 list-disc pl-4">
            {feedback.strengthsVi.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>

        <div className="p-4 bg-[#8E2933]/[0.1] border border-[#8E2933]/40">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#E2A1A7] flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5" /> Cần sửa để lên 6.5
          </p>
          <ul className="space-y-1.5 text-xs text-[#ECE6D8]/90 list-disc pl-4">
            {feedback.improvementsVi.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Phiên bản nâng cấp Band 6.5+ */}
      {feedback.upgradedVersionEn && (
        <div className="p-4 bg-[#0D0C0A] border-l-2 border-[#C5A059]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E2C88D] mb-2">
            Phiên bản nâng cấp gợi ý (Band 6.5–7.0)
          </p>
          <p className="text-sm text-[#ECE6D8] leading-relaxed whitespace-pre-line">
            {feedback.upgradedVersionEn}
          </p>
        </div>
      )}
    </div>
  );
}
