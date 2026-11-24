import React, { Suspense, lazy, useEffect, useState } from 'react';
import { AppProvider } from './store/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { initPWAInstallListener } from './lib/pwaInstall';
import type { NavTab } from './types';

// Lazy-load các trang phụ để giảm mạnh dung lượng tải ban đầu trên iOS & Windows
const RoadmapPage = lazy(() =>
  import('./pages/RoadmapPage').then((m) => ({ default: m.RoadmapPage }))
);
const ListeningPage = lazy(() =>
  import('./pages/ListeningPage').then((m) => ({ default: m.ListeningPage }))
);
const ReadingPage = lazy(() =>
  import('./pages/ReadingPage').then((m) => ({ default: m.ReadingPage }))
);
const WritingPage = lazy(() =>
  import('./pages/WritingPage').then((m) => ({ default: m.WritingPage }))
);
const SpeakingPage = lazy(() =>
  import('./pages/SpeakingPage').then((m) => ({ default: m.SpeakingPage }))
);
const VocabPage = lazy(() =>
  import('./pages/VocabPage').then((m) => ({ default: m.VocabPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

const VALID_TABS: NavTab[] = [
  'dashboard',
  'roadmap',
  'listening',
  'reading',
  'writing',
  'speaking',
  'vocab',
  'settings',
];

function parseTabFromHash(): NavTab {
  if (typeof window === 'undefined') return 'dashboard';
  const raw = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase() as NavTab;
  return VALID_TABS.includes(raw) ? raw : 'dashboard';
}

function PageLoadingFallback() {
  return (
    <div className="sanctuary-panel p-8 flex flex-col items-center justify-center gap-3 min-h-[260px]">
      <div className="w-7 h-7 border border-[#C5A059] border-t-[#E2C88D] animate-spin" />
      <p className="font-fantasy text-xs uppercase tracking-[0.22em] text-[#C5A059]">
        Đang mở trang cổ thư...
      </p>
    </div>
  );
}

function AppShell() {
  const [activeTab, setActiveTab] = useState<NavTab>(() => parseTabFromHash());

  useEffect(() => {
    initPWAInstallListener();

    // Đảm bảo URL luôn có hash hợp lệ để nút Back Windows & vuốt cạnh iOS hoạt động trơn tru
    if (!window.location.hash) {
      window.history.replaceState(null, '', `#${activeTab}`);
    }

    const onHashChange = () => {
      const next = parseTabFromHash();
      setActiveTab(next);
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleNavigate = (tab: NavTab) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      if (window.location.hash !== `#${tab}`) {
        window.location.hash = `#${tab}`;
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Layout activeTab={activeTab} onSelectTab={handleNavigate}>
      <Suspense fallback={<PageLoadingFallback />}>
        {activeTab === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
        {activeTab === 'roadmap' && <RoadmapPage onNavigate={handleNavigate} />}
        {activeTab === 'listening' && <ListeningPage />}
        {activeTab === 'reading' && <ReadingPage />}
        {activeTab === 'writing' && <WritingPage onNavigate={handleNavigate} />}
        {activeTab === 'speaking' && <SpeakingPage onNavigate={handleNavigate} />}
        {activeTab === 'vocab' && <VocabPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </ErrorBoundary>
  );
}
