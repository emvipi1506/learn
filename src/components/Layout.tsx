import React, { useState } from 'react';
import {
  BookOpen,
  Cloud,
  CloudOff,
  Compass,
  Feather,
  Flame,
  Headphones,
  LayoutDashboard,
  Layers,
  Mic,
  Settings,
  X,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { getRankTitle, getXpForNextLevel } from '../data/roadmap';
import { GrimoireCrest } from './DarkArtworks';
import type { NavTab } from '../types';

interface LayoutProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: {
  id: NavTab;
  label: string;
  roman?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'main' | 'skills' | 'tools';
}[] = [
  { id: 'dashboard', label: 'Sảnh Chính', icon: LayoutDashboard, group: 'main' },
  { id: 'roadmap', label: 'Lộ Trình 0 → 6.5', icon: Compass, group: 'main' },
  { id: 'listening', label: 'Listening', roman: 'I', icon: Headphones, group: 'skills' },
  { id: 'reading', label: 'Reading', roman: 'II', icon: BookOpen, group: 'skills' },
  { id: 'writing', label: 'Writing', roman: 'III', icon: Feather, group: 'skills' },
  { id: 'speaking', label: 'Speaking', roman: 'IV', icon: Mic, group: 'skills' },
  { id: 'vocab', label: 'Sổ Từ Vựng SRS', icon: Layers, group: 'tools' },
  { id: 'settings', label: 'Tài Khoản & AI', icon: Settings, group: 'tools' },
];

export function Layout({ activeTab, onSelectTab, children }: LayoutProps) {
  const { profile, dueVocabCount, syncStatus, cloudUserEmail } = useApp();
  const [skillSheetOpen, setSkillSheetOpen] = useState(false);

  const rank = getRankTitle(profile.level);
  const nextXp = getXpForNextLevel(profile.level);
  const xpPct = Math.min(100, Math.round((profile.xp / nextXp) * 100));

  const isSkillActive =
    activeTab === 'listening' ||
    activeTab === 'reading' ||
    activeTab === 'writing' ||
    activeTab === 'speaking';

  const handleMobileNav = (tab: NavTab) => {
    setSkillSheetOpen(false);
    onSelectTab(tab);
  };

  return (
    <div className="min-h-dvh bg-sanctuary stone-grain text-[#ECE6D8] flex flex-col lg:flex-row">
      {/* === SIDEBAR DESKTOP (WINDOWS & iPAD NGANG) — TỐI GIẢN, SẮC SẢO === */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-[#C5A059]/18 bg-[#0B0A08]/95 sticky top-0 h-dvh safe-top safe-left">
        {/* Ấn hiệu */}
        <div className="px-6 py-6 border-b border-[#C5A059]/15 flex items-center gap-3">
          <GrimoireCrest className="w-9 h-9 shrink-0" />
          <div>
            <p className="font-crest text-base font-semibold tracking-[0.26em] text-[#E2C88D] leading-none">
              GRIMOIRE
            </p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#968D80] mt-1.5">
              IELTS 0 → 6.5
            </p>
          </div>
        </div>

        {/* Hồ sơ học giả tối giản */}
        <div className="px-6 py-5 border-b border-[#C5A059]/12 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#ECE6D8] truncate">{profile.displayName}</p>
              <p className="text-[11px] text-[#C5A059] truncate mt-0.5">{rank.title}</p>
            </div>
            <span
              title="Chuỗi ngày học liên tiếp"
              className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[#E2C88D]"
            >
              <Flame className="w-3.5 h-3.5 text-[#B83B47]" />
              {profile.streakDays}
            </span>
          </div>

          <div>
            <div className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-[#968D80] mb-1.5">
              <span>Cấp {profile.level}</span>
              <span>
                {profile.xp}/{nextXp} XP
              </span>
            </div>
            <div className="h-[3px] bg-[#24201B] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#8E2933] via-[#C5A059] to-[#E2C88D] transition-all duration-500"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-baseline justify-between pt-1 text-xs">
            <span className="text-[#968D80]">Band hiện tại</span>
            <span className="font-crest text-sm text-[#E2C88D]">
              {profile.currentBand.toFixed(1)}
              <span className="text-[#968D80] text-xs font-sans"> / {profile.targetBand.toFixed(1)}</span>
            </span>
          </div>
        </div>

        {/* Điều hướng khắc vạch đồng */}
        <nav className="flex-1 overflow-y-auto py-5 space-y-6">
          {[
            { key: 'main' as const, label: 'Hành Trình' },
            { key: 'skills' as const, label: 'Tứ Điện Kỹ Năng' },
            { key: 'tools' as const, label: 'Kho Tàng' },
          ].map((section) => (
            <div key={section.key}>
              <p className="px-6 mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#968D80]/75">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter((i) => i.group === section.key).map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectTab(item.id)}
                      className={`w-full flex items-center justify-between px-6 py-2.5 text-[13px] transition-colors cursor-pointer border-l-2 ${
                        active
                          ? 'border-[#E2C88D] bg-[#C5A059]/[0.09] text-[#F4E6C5] font-semibold'
                          : 'border-transparent text-[#B8B0A2] hover:text-[#ECE6D8] hover:bg-white/[0.025]'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${active ? 'text-[#E2C88D]' : 'text-[#968D80]'}`} />
                        <span>{item.label}</span>
                      </span>
                      {item.id === 'vocab' && dueVocabCount > 0 ? (
                        <span className="text-[11px] font-semibold text-[#E2C88D] border border-[#C5A059]/40 px-1.5 py-0.5 leading-none bg-[#C5A059]/10">
                          {dueVocabCount}
                        </span>
                      ) : item.roman ? (
                        <span className="font-crest text-[10px] text-[#968D80]/60">{item.roman}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Trạng thái đồng bộ đám mây */}
        <div className="px-5 py-4 border-t border-[#C5A059]/12">
          <button
            onClick={() => onSelectTab('settings')}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left hover:bg-white/[0.03] transition cursor-pointer"
          >
            {cloudUserEmail ? (
              <Cloud
                className={`w-4 h-4 shrink-0 ${
                  syncStatus === 'error'
                    ? 'text-[#E28A93]'
                    : syncStatus === 'syncing'
                    ? 'text-[#E2C88D]'
                    : 'text-[#4E8A6E]'
                }`}
              />
            ) : (
              <CloudOff className="w-4 h-4 text-[#968D80] shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs text-[#ECE6D8] truncate">
                {cloudUserEmail ? cloudUserEmail : 'Lưu cục bộ (Khách)'}
              </p>
              <p
                className={`text-[10px] truncate ${
                  syncStatus === 'error' ? 'text-[#F2B5BC]' : 'text-[#968D80]'
                }`}
              >
                {syncStatus === 'syncing'
                  ? 'Đang đồng bộ...'
                  : syncStatus === 'error'
                  ? 'Lỗi đồng bộ — bấm để xem'
                  : cloudUserEmail
                  ? 'Đã kết nối iOS ↔ Windows'
                  : 'Cài đặt đồng bộ Supabase'}
              </p>
            </div>
          </button>
        </div>
      </aside>

      {/* === TOP BAR MOBILE (iOS) === */}
      <header className="lg:hidden sticky top-0 z-30 safe-top safe-x bg-[#0B0A08]/95 backdrop-blur-md border-b border-[#C5A059]/20">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <GrimoireCrest className="w-7 h-7" />
            <div>
              <p className="font-crest text-xs font-semibold tracking-[0.24em] text-[#E2C88D] leading-none">
                GRIMOIRE
              </p>
              <p className="text-[10px] text-[#968D80] mt-1">
                Band {profile.currentBand.toFixed(1)} → {profile.targetBand.toFixed(1)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-[#E2C88D] font-semibold">
              <Flame className="w-3.5 h-3.5 text-[#B83B47]" />
              {profile.streakDays}
            </span>
            <span className="h-3.5 w-[1px] bg-[#C5A059]/25" />
            <span className="font-crest text-[11px] tracking-wider text-[#ECE6D8]">
              LV.{profile.level}
            </span>
          </div>
        </div>
      </header>

      {/* === NỘI DUNG CHÍNH === */}
      <main className="flex-1 min-w-0 pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] lg:pl-0 lg:pt-[env(safe-area-inset-top,0px)] pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] lg:pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-9">{children}</div>
      </main>

      {/* === BẢNG CHỌN 4 KỸ NĂNG CHO iOS === */}
      {skillSheetOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 flex items-end bg-black/75 backdrop-blur-sm"
          onClick={() => setSkillSheetOpen(false)}
        >
          <div
            className="w-full bg-[#100E0C] border-t border-[#C5A059]/40 px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#C5A059]/15">
              <h3 className="font-fantasy text-sm tracking-[0.18em] uppercase text-[#E2C88D]">
                ◆ Tứ Điện Kỹ Năng IELTS
              </h3>
              <button
                onClick={() => setSkillSheetOpen(false)}
                className="p-1.5 text-[#968D80] hover:text-[#ECE6D8]"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-2">
              {[
                { id: 'listening' as NavTab, roman: 'I', name: 'Listening', vi: 'Nghe hiểu & Chép', icon: Headphones },
                { id: 'reading' as NavTab, roman: 'II', name: 'Reading', vi: 'Đọc hiểu học thuật', icon: BookOpen },
                { id: 'writing' as NavTab, roman: 'III', name: 'Writing', vi: 'Viết luận & AI chấm', icon: Feather },
                { id: 'speaking' as NavTab, roman: 'IV', name: 'Speaking', vi: 'Thu âm & Phản xạ', icon: Mic },
              ].map((s) => {
                const Icon = s.icon;
                const active = activeTab === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleMobileNav(s.id)}
                    className={`p-3.5 text-left border transition ${
                      active
                        ? 'bg-[#C5A059]/15 border-[#E2C88D]'
                        : 'bg-[#151310] border-[#C5A059]/20 active:bg-[#1E1A15]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="w-4 h-4 text-[#C5A059]" />
                      <span className="font-crest text-[10px] text-[#968D80]">{s.roman}</span>
                    </div>
                    <p className="font-crest text-sm text-[#ECE6D8] mt-2.5">{s.name}</p>
                    <p className="text-[11px] text-[#968D80] mt-0.5">{s.vi}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* === BOTTOM BAR iOS — THANH ĐỒNG KHẮC SẮC NÉT === */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 safe-bottom safe-x bg-[#0B0A08]/95 backdrop-blur-md border-t border-[#C5A059]/22">
        <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
          {[
            { id: 'dashboard' as NavTab, label: 'Sảnh', icon: LayoutDashboard },
            { id: 'roadmap' as NavTab, label: 'Lộ trình', icon: Compass },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleMobileNav(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1 text-[10px] tracking-wide ${
                  active ? 'text-[#E2C88D]' : 'text-[#968D80]'
                }`}
              >
                {active && <span className="absolute top-0 inset-x-4 h-[2px] bg-[#E2C88D]" />}
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Nút viên thoi đồng ở giữa mở 4 kỹ năng */}
          <button
            onClick={() => setSkillSheetOpen((v) => !v)}
            className="flex flex-col items-center justify-center gap-1 text-[10px] tracking-wide text-[#E2C88D]"
          >
            <div
              className={`w-9 h-9 -mt-4 rotate-45 flex items-center justify-center border transition ${
                isSkillActive || skillSheetOpen
                  ? 'bg-[#8E2933] border-[#E2C88D] text-[#F6EFE2]'
                  : 'bg-[#161310] border-[#C5A059] text-[#E2C88D]'
              }`}
            >
              <span className="-rotate-45 font-crest text-xs font-bold">IV</span>
            </div>
            <span className="mt-0.5">Kỹ năng</span>
          </button>

          <button
            onClick={() => handleMobileNav('vocab')}
            className={`relative flex flex-col items-center justify-center gap-1 text-[10px] tracking-wide ${
              activeTab === 'vocab' ? 'text-[#E2C88D]' : 'text-[#968D80]'
            }`}
          >
            {activeTab === 'vocab' && <span className="absolute top-0 inset-x-4 h-[2px] bg-[#E2C88D]" />}
            <Layers className="w-4 h-4" />
            <span>Từ vựng</span>
            {dueVocabCount > 0 && (
              <span className="absolute top-2 right-3 min-w-[15px] h-[15px] px-1 bg-[#8E2933] border border-[#E2C88D]/60 text-[#ECE6D8] text-[9px] font-bold flex items-center justify-center">
                {dueVocabCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleMobileNav('settings')}
            className={`relative flex flex-col items-center justify-center gap-1 text-[10px] tracking-wide ${
              activeTab === 'settings' ? 'text-[#E2C88D]' : 'text-[#968D80]'
            }`}
          >
            {activeTab === 'settings' && <span className="absolute top-0 inset-x-4 h-[2px] bg-[#E2C88D]" />}
            <Settings className="w-4 h-4" />
            <span>Cài đặt</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
