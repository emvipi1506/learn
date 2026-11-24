import React, { useEffect, useState } from 'react';
import {
  Check,
  Cloud,
  CloudOff,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Monitor,
  RefreshCw,
  Share,
  Smartphone,
  Upload,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import {
  getPWAInstallState,
  subscribePWAInstall,
  triggerPWAInstall,
} from '../lib/pwaInstall';

function formatLocalFileTimestamp(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}-${hh}${mm}`;
}

export function SettingsPage() {
  const {
    profile,
    updateProfileSettings,
    geminiApiKey,
    setGeminiApiKey,
    cloudConfigured,
    cloudUserEmail,
    syncStatus,
    syncMessage,
    signInCloud,
    signUpCloud,
    signOutCloud,
    syncNow,
    exportBackupJson,
    importBackupJson,
  } = useApp();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [targetBand, setTargetBand] = useState(profile.targetBand);
  const [dailyMinutes, setDailyMinutes] = useState(profile.dailyMinutes);
  const [profileSaved, setProfileSaved] = useState(false);

  const [keyInput, setKeyInput] = useState(geminiApiKey);
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMsg, setAuthMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [backupMsg, setBackupMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [pwaState, setPwaState] = useState(() => getPWAInstallState());
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);

  // Đồng bộ lại biểu mẫu khi profile cập nhật từ Supabase hoặc khi khôi phục JSON
  useEffect(() => {
    setDisplayName(profile.displayName);
    setTargetBand(profile.targetBand);
    setDailyMinutes(profile.dailyMinutes);
  }, [profile.displayName, profile.targetBand, profile.dailyMinutes]);

  useEffect(() => {
    setKeyInput(geminiApiKey);
  }, [geminiApiKey]);

  useEffect(() => {
    setPwaState(getPWAInstallState());
    return subscribePWAInstall(() => setPwaState(getPWAInstallState()));
  }, []);

  const handleInstallWindows = async () => {
    setInstallFeedback(null);
    const outcome = await triggerPWAInstall();
    if (outcome === 'accepted') {
      setInstallFeedback('Đang cài đặt Grimoire làm ứng dụng độc lập trên thiết bị của bạn.');
    } else if (outcome === 'dismissed') {
      setInstallFeedback('Bạn đã hủy hộp thoại cài đặt. Có thể bấm lại bất cứ lúc nào.');
    } else {
      setInstallFeedback('Trình duyệt hiện chưa sẵn sàng hộp thoại cài đặt tự động. Hãy dùng biểu tượng Cài đặt trên thanh địa chỉ Edge/Chrome.');
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileSettings({
      displayName: displayName.trim() || 'Học Giả Mới',
      targetBand,
      dailyMinutes,
    });
    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 2500);
  };

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    setGeminiApiKey(keyInput);
    setKeySaved(true);
    window.setTimeout(() => setKeySaved(false), 2500);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthMsg(null);
    const res =
      authMode === 'login'
        ? await signInCloud(email, password)
        : await signUpCloud(email, password, displayName);
    setAuthMsg({ ok: res.ok, text: res.message });
    setAuthBusy(false);
  };

  const handleDownloadBackup = () => {
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grimoire-backup-${formatLocalFileTimestamp()}.json`;
    a.click();
    // Trì hoãn revokeObjectURL 1500ms để iOS Safari kịp hoàn tất tải xuống
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setBackupMsg({ ok: true, text: 'Đã tải xuống tệp sao lưu (.json) theo giờ địa phương.' });
  };

  const handleUploadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = importBackupJson(String(reader.result || ''));
      setBackupMsg({ ok: res.ok, text: res.message });
      input.value = '';
    };
    reader.onerror = () => {
      setBackupMsg({ ok: false, text: 'Không thể đọc tệp đã chọn. Vui lòng thử lại.' });
      input.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-4 border-b border-[#C5A059]/18">
        <p className="font-fantasy text-[11px] uppercase tracking-[0.24em] text-[#C5A059]">
          ◆ Thiết Lập Hệ Thống
        </p>
        <h1 className="font-fantasy text-2xl sm:text-3xl text-[#F4EFE4] mt-1">
          Tài Khoản Đồng Bộ, AI & Cài Đặt iOS / Windows
        </h1>
      </div>

      {/* 1. ĐỒNG BỘ SUPABASE */}
      <section className="sanctuary-panel p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#C5A059]/15">
          <div className="flex items-center gap-3">
            {cloudUserEmail ? (
              <Cloud className="w-5 h-5 text-[#7BC2A0]" />
            ) : (
              <CloudOff className="w-5 h-5 text-[#C5A059]" />
            )}
            <div>
              <h2 className="font-fantasy text-lg text-[#F4EFE4]">
                Đồng Bộ Đám Mây iOS ↔ Windows (Supabase)
              </h2>
              <p className={`text-xs ${syncStatus === 'error' ? 'text-[#F2B5BC]' : 'text-[#968D80]'}`}>
                {syncMessage}
              </p>
            </div>
          </div>

          {cloudUserEmail && (
            <div className="flex items-center gap-2">
              <button
                onClick={syncNow}
                disabled={syncStatus === 'syncing'}
                className="btn-ghost-brass px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                Đồng bộ ngay
              </button>
              <button
                onClick={signOutCloud}
                className="px-3.5 py-2 bg-[#0B0A08] border border-[#C5A059]/25 text-xs text-[#ECE6D8] flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Đăng xuất
              </button>
            </div>
          )}
        </div>

        {!cloudConfigured ? (
          <div className="p-4 bg-[#0B0A08] border-l-2 border-[#C5A059] space-y-2 text-xs text-[#C8BFB0] leading-relaxed">
            <p className="font-semibold text-[#E2C88D]">
              Hiện chạy Chế độ Khách (lưu ngay trên thiết bị). Để bật đồng bộ tự động iPhone ↔ Windows:
            </p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Tạo dự án miễn phí tại <strong>supabase.com</strong>.</li>
              <li>Mở <strong>SQL Editor</strong> trên Supabase, chạy nội dung tệp <code className="text-[#E2C88D]">supabase/schema.sql</code>.</li>
              <li>
                Tạo tệp <code className="text-[#E2C88D]">.env</code> từ <code className="text-[#E2C88D]">.env.example</code>, điền{' '}
                <code className="text-[#E2C88D]">VITE_SUPABASE_URL</code> và <code className="text-[#E2C88D]">VITE_SUPABASE_ANON_KEY</code>.
              </li>
            </ol>
          </div>
        ) : !cloudUserEmail ? (
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            <div className="flex border border-[#C5A059]/25 bg-[#0B0A08] w-fit">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`px-4 py-1.5 text-xs uppercase tracking-wider cursor-pointer ${
                  authMode === 'login' ? 'bg-[#C5A059]/20 text-[#E2C88D] font-semibold' : 'text-[#968D80]'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`px-4 py-1.5 text-xs uppercase tracking-wider cursor-pointer ${
                  authMode === 'signup' ? 'bg-[#C5A059]/20 text-[#E2C88D] font-semibold' : 'text-[#968D80]'
                }`}
              >
                Tạo tài khoản
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email của bạn"
                className="bg-[#090807] border border-[#C5A059]/25 px-3.5 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                className="bg-[#090807] border border-[#C5A059]/25 px-3.5 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
              />
            </div>

            {authMsg && (
              <p className={`text-xs ${authMsg.ok ? 'text-[#7BC2A0]' : 'text-[#F2B5BC]'}`}>{authMsg.text}</p>
            )}

            <button disabled={authBusy} type="submit" className="btn-brass px-5 py-2.5 text-xs uppercase tracking-[0.14em] cursor-pointer">
              {authBusy ? 'Đang xử lý...' : authMode === 'login' ? 'Đăng Nhập & Đồng Bộ' : 'Đăng Ký Tài Khoản'}
            </button>
          </form>
        ) : (
          <div className="p-3.5 bg-[#4E8A6E]/12 border border-[#4E8A6E]/40 text-xs text-[#B9E6D0] flex items-center gap-2">
            <Check className="w-4 h-4 text-[#7BC2A0]" />
            Đang đăng nhập bằng <strong>{cloudUserEmail}</strong>. Tiến độ học, nhật ký ngày và thẻ SRS tự động hợp nhất hai chiều giữa iOS và Windows.
          </div>
        )}
      </section>

      {/* 2. GEMINI API KEY */}
      <section className="sanctuary-panel p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[#C5A059]/15">
          <KeyRound className="w-5 h-5 text-[#C5A059]" />
          <div>
            <h2 className="font-fantasy text-lg text-[#F4EFE4]">
              Giám Khảo AI Chấm Writing & Speaking (Gemini API Key)
            </h2>
            <p className="text-xs text-[#968D80]">
              Tùy chọn. Khóa chỉ lưu cục bộ trên thiết bị và gửi qua HTTP header bảo mật để chấm 4 tiêu chí IELTS.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveKey} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Dán Gemini API Key (AIza...)"
                className="w-full bg-[#090807] border border-[#C5A059]/25 focus:border-[#E2C88D] focus:outline-none px-3.5 py-2.5 pr-10 text-base sm:text-sm text-[#ECE6D8]"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#968D80] hover:text-[#ECE6D8] cursor-pointer"
                aria-label="Ẩn/hiện khóa"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button type="submit" className="btn-crimson px-5 py-2.5 text-xs uppercase tracking-[0.14em] cursor-pointer">
              Lưu Khóa AI
            </button>
          </div>

          {keySaved && (
            <p className="text-xs text-[#7BC2A0] flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Đã lưu Gemini API Key.
            </p>
          )}
          <p className="text-xs text-[#968D80]">
            Tạo khóa miễn phí tại{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-[#E2C88D] underline">
              Google AI Studio
            </a>
            .
          </p>
        </form>
      </section>

      {/* 3. HỒ SƠ HỌC TẬP */}
      <section className="sanctuary-panel p-5 sm:p-6">
        <h2 className="font-fantasy text-lg text-[#F4EFE4] pb-3 mb-4 border-b border-[#C5A059]/15">
          Hồ Sơ & Mục Tiêu Cá Nhân
        </h2>
        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#968D80] mb-1.5">Tên hiển thị</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#090807] border border-[#C5A059]/25 px-3.5 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#968D80] mb-1.5">Mục tiêu Band</label>
            <select
              value={targetBand}
              onChange={(e) => setTargetBand(Number(e.target.value))}
              className="w-full bg-[#090807] border border-[#C5A059]/25 px-3.5 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
            >
              {[5.5, 6.0, 6.5, 7.0, 7.5].map((b) => (
                <option key={b} value={b}>
                  Band {b.toFixed(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#968D80] mb-1.5">Giờ học / ngày</label>
            <select
              value={dailyMinutes}
              onChange={(e) => setDailyMinutes(Number(e.target.value))}
              className="w-full bg-[#090807] border border-[#C5A059]/25 px-3.5 py-2.5 text-base sm:text-sm text-[#ECE6D8]"
            >
              <option value={60}>1.0 giờ / ngày</option>
              <option value={90}>1.5 giờ / ngày</option>
              <option value={120}>2.0 giờ / ngày (Khuyên dùng)</option>
              <option value={150}>2.5 giờ / ngày</option>
              <option value={180}>3.0 giờ / ngày</option>
            </select>
          </div>

          <div className="sm:col-span-3 flex items-center gap-3">
            <button type="submit" className="btn-brass px-5 py-2.5 text-xs uppercase tracking-[0.14em] cursor-pointer">
              Lưu Thiết Lập
            </button>
            {profileSaved && (
              <span className="text-xs text-[#7BC2A0] flex items-center gap-1">
                <Check className="w-4 h-4" /> Đã cập nhật.
              </span>
            )}
          </div>
        </form>
      </section>

      {/* 4. SAO LƯU & CÀI PWA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="sanctuary-panel p-5 space-y-3">
          <h3 className="font-fantasy text-base text-[#E2C88D]">Sao Lưu Thủ Công (.JSON)</h3>
          <p className="text-xs text-[#968D80] leading-relaxed">
            Xuất file tiến độ trên Windows rồi nhập sang iPhone (hoặc ngược lại) ngay cả khi chưa bật Supabase.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="btn-ghost-brass px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Xuất sao lưu
            </button>
            <label className="btn-ghost-brass px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Khôi phục file
              <input
                type="file"
                accept="application/json,.json,text/plain"
                onChange={handleUploadBackup}
                className="hidden"
              />
            </label>
          </div>
          {backupMsg && (
            <p className={`text-xs ${backupMsg.ok ? 'text-[#7BC2A0]' : 'text-[#F2B5BC]'}`}>
              {backupMsg.text}
            </p>
          )}
        </section>

        <section className="sanctuary-panel p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-fantasy text-base text-[#E2C88D]">Cài Đặt App (iOS & Windows)</h3>
            {pwaState.isInstalled && (
              <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider bg-[#4E8A6E]/20 border border-[#4E8A6E] text-[#7BC2A0]">
                Đã cài App
              </span>
            )}
          </div>

          {pwaState.canInstall && !pwaState.isInstalled && (
            <button
              type="button"
              onClick={handleInstallWindows}
              className="w-full btn-brass py-2.5 px-4 text-xs uppercase tracking-[0.14em] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Monitor className="w-4 h-4" /> Cài Đặt Ứng Dụng Lên Windows
            </button>
          )}

          {installFeedback && <p className="text-xs text-[#E2C88D]">{installFeedback}</p>}

          <div className="space-y-2.5 text-xs text-[#C8BFB0] leading-relaxed">
            <div className="p-3 bg-[#0B0A08] border border-[#C5A059]/18 flex items-start gap-2.5">
              <Smartphone className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#ECE6D8]">iPhone / iPad (Safari)</p>
                <p className="mt-0.5">
                  Mở trang qua HTTPS bằng Safari → chạm biểu tượng{' '}
                  <Share className="w-3.5 h-3.5 inline text-[#E2C88D] mx-0.5" /> <strong>Chia sẻ</strong> →{' '}
                  <strong>Thêm vào Màn hình chính</strong> để chạy toàn màn hình không thanh địa chỉ.
                </p>
              </div>
            </div>
            <div className="p-3 bg-[#0B0A08] border border-[#C5A059]/18 flex items-start gap-2.5">
              <Monitor className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#ECE6D8]">Windows (Edge / Chrome)</p>
                <p className="mt-0.5">
                  Nhấn nút <strong>Cài Đặt Ứng Dụng</strong> ở trên (hoặc biểu tượng cài đặt ở góc phải thanh địa chỉ) để ghim ra Desktop & Taskbar như phần mềm độc lập.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
