import React from 'react';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định khi hiển thị ứng dụng.';
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown) {
    console.error('[Grimoire ErrorBoundary]', error);
  }

  private handleEmergencyExport = () => {
    try {
      const raw = localStorage.getItem('grimoire_ielts_state_v1') || '{}';
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `grimoire-emergency-backup-${stamp}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      // ignore fallback export errors
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-dvh bg-[#090807] text-[#ECE6D8] flex items-center justify-center p-5">
        <div className="max-w-lg w-full ornate-panel p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-3 pb-4 border-b border-[#C5A059]/20">
            <div className="w-10 h-10 border border-[#8E2933] bg-[#8E2933]/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#E28A93]" />
            </div>
            <div>
              <p className="font-fantasy text-[11px] uppercase tracking-[0.22em] text-[#C5A059]">
                ◆ Phục Hồi Khẩn Cấp
              </p>
              <h1 className="font-fantasy text-xl text-[#F4EFE4] mt-1">
                Ứng dụng vừa gặp sự cố ngoài ý muốn
              </h1>
            </div>
          </div>

          <p className="text-sm text-[#C8BFB0] leading-relaxed">
            Tiến độ học tập và sổ từ vựng SRS của bạn vẫn được bảo toàn an toàn trong bộ nhớ máy. Bạn có thể tải lại trang hoặc xuất ngay tệp sao lưu dự phòng.
          </p>

          {this.state.errorMessage && (
            <p className="text-xs font-mono text-[#F2B5BC] bg-[#0B0A08] border border-[#8E2933]/40 p-3 break-words">
              {this.state.errorMessage}
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-brass px-5 py-2.5 text-xs uppercase tracking-[0.14em] inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tải lại ứng dụng
            </button>

            <button
              type="button"
              onClick={this.handleEmergencyExport}
              className="btn-ghost-brass px-4 py-2.5 text-xs uppercase tracking-[0.12em] inline-flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Xuất dữ liệu khẩn cấp (.json)
            </button>
          </div>
        </div>
      </div>
    );
  }
}
