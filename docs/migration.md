# Xác minh dữ liệu và lưu trữ nguồn

Ngày 2026-11-10, trước khi dọn nguồn cục bộ, audit chỉ đọc bằng **publishable key qua RLS** đã xác minh 5 bài, 17 ảnh công khai. Không chạy lại import; không tạo lại schema; không INSERT/UPDATE/DELETE dữ liệu hoặc object Storage.

| Slug hồi quy                       | Kind        | Ảnh | Độ chính xác ngày |
| ---------------------------------- | ----------- | --- | ----------------- |
| bi-kip-giao-tiep-da-chieu-2026     | information | 1   | datetime          |
| nhac-dang-ky-bi-kip-giao-tiep-2026 | information | 0   | datetime          |
| hoc-bong-sinh-vien-2026-2027       | scholarship | 1   | datetime          |
| chuyen-xe-doan-vien-2026           | event       | 14  | date              |
| xuan-tinh-nguyen-2026              | event       | 1   | datetime          |

Toàn bộ nội dung bài viết khớp nguồn (so sánh sau trim khoảng trắng đầu/cuối); mọi ảnh tải được với MIME image và SHA-256 khớp từng byte nguồn. Số lượng, sort_order, width/height khớp metadata, cover tồn tại cho mọi bài có ảnh. Chi tiết học bổng/sự kiện có trong quan hệ. Các cột schema thực tế phù hợp mapper; có thêm created_by/updated_by, không được trả ra public payload.

Lớp truy vấn thật đã xác minh Information gồm 4 bài (2 thông báo, 2 hoạt động), scholarship 1, event 2, category và tìm tiếng Việt. HTTP tới production SSR build cục bộ trả 200 cho album Chuyến xe đoàn viên; không deploy website hiện tại. Chưa kiểm tra policy definitions bằng quyền quản trị: file `sacute_supabase_init.sql` không có trong repository. Không suy ra cấu hình policy đầy đủ chỉ từ việc đọc được bài công khai.

Nguồn `apps/api/mock-data`, script prepare, TypeScript generated và bản sao public media đã được loại khỏi runtime/build sau khi audit cloud, 22 kiểm thử API/data/SSR và 36 browser tests đều qua. Giữ `scripts/migrate-sacute-posts.mjs` làm công cụ lịch sử, không chạy để xuất bản thường ngày. Script đã được format nhưng không thay đổi logic import. Nó chỉ dùng khi phục hồi nguồn và có quyết định vận hành riêng.

## Phục hồi có thể đảo ngược

Nguồn gốc trước refactor vẫn ở Git revision `d7f245ec1775d327326728b496b1a6fdde046be3`; trước khi xóa cũng tạo bản sao môi trường tại `/tmp/sacute-pre-supabase-content.tar.gz`. File `/tmp` không phải bản lưu dài hạn; Git là đường phục hồi chính. Không giữ bản sao toàn bộ bài đã xuất bản trong source runtime hoặc public assets.

```sh
mkdir -p /tmp/sacute-migration-source
# Phục hồi vào thư mục ngoài ứng dụng, không ghi đè thay đổi đang làm.
git archive d7f245ec1775d327326728b496b1a6fdde046be3 apps/api/mock-data | tar -x -C /tmp/sacute-migration-source
pnpm --filter @sacute/shared build
node --env-file=apps/api/.env scripts/verify-cloud-content.mjs --source-root=/tmp/sacute-migration-source/apps/api/mock-data/posts
```

Kiểm tra chỉ đọc hiện tại mà không cần nguồn:

```sh
pnpm --filter @sacute/shared build
node --env-file=apps/api/.env scripts/verify-cloud-content.mjs
```

Các slug ở script audit chỉ là hồi quy di chuyển, không phải dữ liệu ứng dụng. Nếu biên tập viên đổi/xóa/lưu trữ bài, audit hồi quy có thể báo khác biệt hợp lệ: cần xem xét, không tự chạy import hoặc ghi đè bản cloud. Chưa có CMS hay auth/admin interface trong nhiệm vụ này.
