# Grimoire — IELTS 0 → 6.5 & Tiếng Hàn Sejong 1 (PWA Windows & iOS)

Ứng dụng web hiện đại phong cách **Dark Fantasy tối giản**, thiết kế chuẩn **PWA (Progressive Web App)** chạy độc lập mượt mà trên cả **Windows (Edge/Chrome Desktop App)** và **iPhone / iPad (iOS Safari Home Screen App)**.

## Tính năng chính
- **Lộ trình IELTS 4 Chương từ mất gốc lên Overall 6.5** kèm máy tính thời gian học mỗi ngày & bài kiểm tra xếp lớp nhanh.
- **4 Điện Kỹ Năng IELTS (16 bài học)**:
  - **Listening**: Nghe chép chính tả (Dictation so khớp theo đúng thứ tự từ) + Đề IELTS Part 1–4, tùy chỉnh tốc độ `0.75x – 1.1x`, giọng Anh-Anh / Anh-Mỹ, transcript song ngữ.
  - **Reading**: Bố cục 2 cột trên Windows/iPad ngang & Tab chuyển mượt trên iPhone, bấm vào từ đánh dấu để tra nghĩa và lưu vào Sổ Từ Vựng SRS, chấm điểm kèm dẫn chứng.
  - **Writing**: Dàn ý cho người mới, cụm từ bấm chèn nhanh, bài mẫu Band 6.5–7.0, đếm từ/bấm giờ, và **AI Gemini chấm 4 tiêu chí IELTS**.
  - **Speaking**: Đồng hồ chuẩn bị & nói chuẩn Part 1/2/3, tự dừng khi hết giờ, thu âm & phát lại tương thích iOS Safari (`audio/mp4`) + Windows (`audio/webm`), nhận diện giọng nói và AI nhận xét.
- **Sổ Cổ Ngữ Song Hành SRS SM-2 (Tách biệt EN & KO chống nhiễu)**:
  - Tiếng Anh IELTS (28 thẻ nền tảng + tự thêm) và **Tiếng Hàn Sejong 1 Bài 06–20 (317 thẻ từ vựng & ngữ pháp)**.
  - Thẻ lật 3D chống lộ đáp án thẻ kế tiếp, phân trang Kho Thẻ mượt mà, phát âm chuẩn (tự đọc câu ví dụ Hangul cho thẻ ngữ pháp tiếng Hàn).
- **Đồng bộ hai chiều an toàn iOS ↔ Windows** qua Supabase (luồng `Pull → Merge thông minh → Push`, hỗ trợ đồng bộ cả `custom_vocab`, `saved_vocab_ids`, `daily_logs`, tự cập nhật khi mở lại app từ chế độ ngủ) + Sao lưu/Khôi phục `.json` thủ công.

---

## 1. Chạy phát triển & Kiểm thử trên Windows
```bash
npm install
npm run dev
```
Mở trình duyệt tại `http://localhost:5173`.

Kiểm thử tự động và kiểm tra bản build sản phẩm:
```bash
npx vitest run
npm run build
npm run preview
```

---

## 2. Triển khai HTTPS & Cài đặt App (Windows + iOS)
Tính năng **Cài đặt PWA**, **Service Worker ngoại tuyến** và **Thu âm Micro trên iPhone/iPad** yêu cầu chạy qua **HTTPS**.
1. Đẩy mã nguồn (đã tự loại trừ `sejong1/` và `*.pdf` qua `.gitignore`) lên **Vercel**, **Cloudflare Pages** hoặc **Netlify**.
   - Dự án đã tích hợp sẵn `vercel.json` và `public/_headers` đặt `Cache-Control: no-cache` cho `/sw.js` và `/manifest.webmanifest`.
2. **Cài trên Windows (Edge / Chrome)**:
   - Mở trang HTTPS → vào mục **Tài Khoản & AI** → bấm nút **Cài Đặt Ứng Dụng Lên Windows** (hoặc biểu tượng Cài đặt trên thanh địa chỉ) để ghim ra Desktop & Taskbar.
3. **Cài trên iPhone / iPad (Safari)**:
   - Mở trang HTTPS bằng **Safari** → chạm nút **Chia sẻ** → chọn **Thêm vào Màn hình chính**.

---

## 3. Bật đồng bộ đám mây Supabase (iOS ↔ Windows)
1. Tạo dự án miễn phí tại [supabase.com](https://supabase.com).
2. Mở **SQL Editor** trên Supabase, dán và chạy toàn bộ nội dung tệp [`supabase/schema.sql`](supabase/schema.sql) (kịch bản hỗ trợ chạy lại an toàn và tự nâng cấp tài khoản cũ).
3. Tạo tệp `.env` từ `.env.example` (hoặc khai báo Environment Variables trên Vercel / Cloudflare Pages / Netlify):
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Build/deploy lại để kích hoạt đăng nhập và đồng bộ hai chiều.

---

## 4. Lưu ý gói giọng đọc Tiếng Hàn trên Windows
Nếu trên Windows bấm nghe thẻ Tiếng Hàn nhưng không thấy tiếng hoặc phát âm không tự nhiên, hãy cài gói giọng đọc hệ thống:
- Mở **Windows Settings → Time & Language → Speech → Manage voices → Add voices → chọn Korean (한국어)**, sau đó khởi động lại trình duyệt Edge/Chrome.
- Trên iPhone/iPad (iOS Safari), giọng đọc tiếng Hàn (`Yuna` / `ko-KR`) thường đã có sẵn; đảm bảo công tắc gạt im lặng vật lý ở cạnh máy đang tắt.
