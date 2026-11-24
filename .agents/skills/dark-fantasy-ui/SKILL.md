---
name: dark-fantasy-ui
description: >-
  Hướng dẫn thiết kế giao diện Dark Fantasy Cao Cấp (kiểu Elden Ring / Baldur's Gate 3 tối giản)
  và chống lỗi thẩm mỹ "AI Slop" cho ứng dụng web Grimoire IELTS trên cả iOS và Windows.
  Kích hoạt khi tạo, sửa hoặc đại tu bất kỳ màn hình, thành phần giao diện hoặc bảng màu nào.
---

# Dark Fantasy Cao Cấp — Chuẩn Thiết Kế Chống "AI Slop"

## 1. Những Điều TUYỆT ĐỐI CẤM (Dấu hiệu giao diện AI mặc định)
- **CẤM nền xanh-tím SaaS & tím neon** (`#8B5CF6`, `#6D28D9`, gradient tím-xanh, đổ bóng phát sáng cầu vồng).
- **CẤM bo tròn béo ú lặp lại** (`rounded-3xl`, `rounded-2xl` cho mọi thẻ như mẫu dashboard AI).
- **CẤM rải badge/pill nhiều màu** (xanh dương, xanh lá, vàng, tím đứng sát nhau gây rẻ tiền và mất sự tập trung).
- **CẤM bố cục 8 hộp giống hệt nhau**: Phải có 1 tiêu điểm chính (Editorial Hero / Artwork) rồi mới đến các khối thông tin gọn gàng.
- **CẤM chỉ dùng hộp trống + icon bé xíu** ở trang chủ hoặc thẻ danh mục chính: Hãy kết hợp hình ảnh minh họa (artwork) được che phủ bằng gradient tối có chủ đích.

## 2. Bảng Màu Bắt Buộc (Elden Ring / BG3 Editorial Palette)
| Vai trò | Tên màu | Mã Hex | Mục đích |
| :--- | :--- | :--- | :--- |
| Nền chính | Đen Tro Núi Lửa (*Obsidian Ash*) | `#090807` | Nền toàn trang, sạch sâu không lóa |
| Nền bề mặt | Đá Phiến Ấm (*Basalt Slate*) | `#12100E` | Thẻ nội dung, thanh điều hướng |
| Nền nhấn nhẹ | Tro Than (*Charcoal Lift*) | `#191613` | Hover, ô nhập liệu, khu vực trích dẫn |
| Màu nhấn chính | Đồng Cổ (*Antique Brass*) | `#C5A059` | Viền mảnh, tiêu đề chương, nút chính, đường phân cách |
| Màu nhấn sáng | Vàng Xưa (*Pale Gold*) | `#E2C88D` | Con số quan trọng, trạng thái đang chọn |
| Màu nhấn phụ | Đỏ Huyết Trầm (*Dried Crimson*) | `#8E2933` | Nút ghi âm, cảnh báo, con dấu sáp, lỗi sai |
| Màu đạt chuẩn | Rêu Ngọc Trầm (*Muted Sage*) | `#4E8A6E` | Đáp án đúng, hoàn thành mốc (không dùng xanh neon) |
| Chữ chính | Trắng Ngà Cổ (*Bone Ivory*) | `#ECE6D8` | Văn bản đọc hiểu IELTS, tiêu đề |
| Chữ phụ | Xám Đá Ấm (*Stone Muted*) | `#968D80` | Ghi chú, thời lượng, nhãn phụ |

## 3. Hình Học, Vật Liệu & Kiểu Chữ
- **Góc cạnh sắc sảo**: Dùng `rounded-none` hoặc `rounded-[3px]` (tối đa `rounded-sm` cho input/button nhỏ). Cảm giác phải giống **tấm đồng khắc & đá mài**, không giống bong bóng nhựa.
- **Khung chạm khắc mảnh (`.sanctuary-panel`)**: Viền `1px solid rgba(197, 160, 89, 0.2)`, nhấn 4 góc chữ L siêu mảnh `rgba(197, 160, 89, 0.55)` cho các khung trọng tâm.
- **Chất liệu (Texture)**: Phủ 1 lớp hạt nhiễu mịn (`opacity: 0.03`) cố định toàn màn hình để triệt tiêu cảm giác "phẳng kỹ thuật số" vô hồn.
- **Hệ kiểu chữ**:
  - Tiêu đề lớn & tên Chương: `Cinzel` / `Cormorant Garamond` (`letter-spacing` thoáng, không quá đậm cục mịch).
  - Văn bản học thuật IELTS & Tiếng Việt: `Be Vietnam Pro` — cực rõ dấu tiếng Việt, `line-height: 1.8` cho bài đọc dài.

## 4. Tối Ưu Trải Nghiệm Thực Dụng (iOS + Windows)
- Giữ chất nghệ thuật ở **khung, tranh minh họa, tiêu đề và tỷ lệ khoảng trắng**, nhưng **khu vực đọc bài Reading, viết Writing, làm câu hỏi Listening phải cực sạch, nền ổn định, độ tương phản ≥ 10:1**.
- Trên **iOS**: Bottom Navigation Bar mảnh gọn với thanh chỉ báo đồng cổ ở viền trên, tôn trọng `env(safe-area-inset-bottom)`.
- Trên **Windows**: Sidebar mỏng lịch lãm (`256px`), ưu tiên khoảng trống rộng rãi (`max-w-6xl`), bố cục 2 cột biên tập cho Reading & Writing.
