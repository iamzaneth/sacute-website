# Dữ liệu bài viết

Nguồn chỉnh sửa: `apps/api/mock-data/posts/<collection>/<slug>/`.

```text
posts/events/
├── xuan-tinh-nguyen-2026/
│   ├── metadata.json
│   ├── content.md
│   └── images/cover.jpg
└── chuyen-xe-doan-vien-2026/
    ├── metadata.json
    ├── content.md
    └── images/photo-01.jpg … photo-14.jpg
```

Hai bài thuộc **Sự kiện nổi bật**. `eventName` và `category` tương ứng là
**Xuân tình nguyện** và **Chuyến xe đoàn viên**. Ảnh là tệp đính kèm của bài viết,
không phải ảnh nền hoặc ảnh bìa giao diện.

- Bài Xuân tình nguyện: nguyên văn từ JSON nhúng trong bản HTML Facebook do chủ dự án cung cấp;
  đăng lúc 19:01:21 ngày 01/01/2026 (UTC+7); một ảnh gốc 2048 × 800.
- Bài Chuyến xe đoàn viên: nguyên văn tệp nội dung do chủ dự án cung cấp; người đăng và ngày
  đăng lấy từ ghi chú đi kèm; đủ 14 ảnh gốc 2048 × 1369. Nguồn chỉ cho biết
  ngày 07/02/2026, nên `publishedAt` giữ dạng ngày với
  `publishedAtPrecision: "date"`, không suy diễn giờ đăng. Thứ tự ảnh theo tên
  file do chưa có thứ tự album từ nguồn.
- Tiêu đề ngắn, tóm tắt và tên sự kiện nằm trong metadata. `content.md` giữ
  nguyên văn, emoji, hashtag và xuống dòng. `originalTitle` lưu tiêu đề gốc;
  giao diện dùng tiêu đề ngắn và tránh lặp lại dòng tiêu đề trong nội dung.
- `images` là danh sách có thứ tự gồm `path`, `alt`, `width`, `height`.
  Một ảnh được hiển thị toàn bộ; nhiều ảnh thành lưới tối đa năm ô, có số ảnh
  còn lại và trình xem toàn bộ album bằng chuột hoặc phím mũi tên/Escape.
- `contentFormat: "plain-text"`: web hiển thị văn bản với liên kết HTTPS/email;
  chưa diễn giải cú pháp Markdown. Không nhập bình luận hoặc dữ liệu tài khoản.

## Chạy và cập nhật

Chạy `pnpm dev` từ thư mục gốc, mở `/events`. Trang chủ liên kết tới cả hai bài.
API: `GET http://localhost:3001/api/v1/events`; hỗ trợ `q`, `category`, `page`,
`limit` như trước. Mọi bài trong `/events` cũng tự xuất hiện tại `/information`, chuyên mục **Hoạt động**.
Nguồn bài và ảnh chỉ lưu một lần trong `posts/events`; không cần chép bài sang
`posts/information`. Mục Thông tin có các bộ lọc **Tất cả**, **Thông báo** và **Hoạt động**,
mặc định mở **Hoạt động**. Xóa bộ lọc sẽ về **Tất cả**.

Danh sách hiển thị thẻ gọn trong lưới tự điều chỉnh số cột theo chiều rộng. Bấm
vào thẻ để mở `/posts/<slug>` với đầy đủ nội dung và album ảnh. Trang chi tiết
được prerender để mở trực tiếp, tải lại hoặc chia sẻ liên kết. Nút quay lại giữ
bộ lọc của danh sách khi điều hướng từ thẻ bài viết.

Sau khi sửa metadata/nội dung/ảnh, restart `pnpm dev` hoặc build lại.
`pnpm --filter @sacute/shared build` tự chạy `scripts/prepare-mock-content.mjs`:

1. Đọc các bài có `publicationStatus: "published"` và tạo collection dùng chung
   cho API và web prerender tại `packages/shared/src/generated/mock-content.ts`.
2. Tạo lại các thư mục ảnh sinh tự động trong `apps/api/public/media/mock/` và
   `apps/web/public/media/mock/`. Mỗi ảnh có URL
   `/media/mock/<collection>/<slug>/<filename>`.

Không sửa file sinh tự động; chúng được Git bỏ qua. Các tệp đầu vào tạm đã được dọn sau khi chuyển đầy đủ nội dung và ảnh vào
`posts/`; build chỉ đọc nguồn chuẩn này, không cần thư mục `tmp/`. Các đường dẫn
đầu vào cũ trong trường nguồn của metadata chỉ ghi nhận xuất xứ, không phải
file cần có khi build. Khi đóng gói API, mang theo
`apps/api/public` cùng với `dist`.

Để thêm bài, tạo thư mục mới với ID/slug riêng, `kind: "event"`, `eventName`,
`category`, người đăng, nguồn, ngày đăng, `contentFile: "content.md"` và mảng
`images`. Dùng `publicationStatus: "draft"` để chưa đưa bài vào collection.
`status` là trạng thái sự kiện (`upcoming`, `ongoing`, `ended`), tách riêng khỏi
trạng thái xuất bản. `startsOn`/`endsOn` dành cho lịch chỉ biết ngày;
`startsAt` dành cho lịch có giờ và múi giờ.
