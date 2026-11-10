# Báo cáo triển khai Supabase

Ngày 2026-11-10. Thay đổi đã triển khai trong workspace và được chia commit theo phạm vi; chưa deploy.

## Trước và sau

Nguồn cục bộ → generator/copy ảnh → prerender và API local đã được thay bằng Supabase PostgreSQL/Storage → lớp dữ liệu shared → React Router runtime SSR và NestJS. Mọi feed, homepage và detail dùng cùng lớp truy vấn công khai. Vercel dùng preset chính thức, không ép outputDirectory tĩnh hoặc liệt kê slug tại build. Backend vẫn build/chạy độc lập; web không cần một Nest API production riêng.

Các URL cũ, giao diện màu cam/trắng, tài nguyên thương hiệu, sidebar/drawer responsive, bộ lọc URL và lightbox được giữ. Không có CMS mới hoặc endpoint ghi nội dung.

## Truy vấn và ánh xạ

Factory xác thực môi trường, dùng publishable key/RLS. List và detail nhúng media, scholarship_details/event_details trong cùng request; lọc trạng thái/visible_from, kind, category, ILIKE tiếng Việt, pagination/count và sort ổn định trong PostgreSQL. Homepage lấy nội dung gần nhất theo nhóm. Information kết hợp thông báo và sự kiện, giữ kind thật; detail dùng category gốc.

Mapper snake_case → camelCase giữ nguyên date-only và instant, tách cover khỏi thứ tự gallery, bỏ media private/sai, không tạo kích thước giả. UI hiển thị múi giờ Việt Nam; nội dung React-escaped giữ dòng. Tắt content cache/retry tự động; timeout 10 giây. Query failure trả lỗi 503, không trả empty collection; missing config trả lỗi rõ ràng. Loader không serialize metadata quản trị hoặc khóa.

## Kết quả thực chạy

| Lệnh                                                                            | Kết quả cuối                                                                                                                        |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                | Qua; lockfile cập nhật có chủ đích cho Supabase shared, Vercel preset và SSR preview adapter                                        |
| `pnpm lint`                                                                     | Qua                                                                                                                                 |
| `pnpm format:check`                                                             | Qua                                                                                                                                 |
| `pnpm typecheck`                                                                | Qua cả 3 workspace                                                                                                                  |
| `pnpm build`                                                                    | Qua; tạo client assets, Node SSR bundle và Vercel route manifest; không cần cloud credentials                                       |
| `pnpm test`                                                                     | 25/25 qua, có build production bên trong                                                                                            |
| `pnpm test:e2e`                                                                 | 36/36 qua trên bản build cuối sau cleanup, Chrome; responsive 320–2560px, accessibility, keyboard, gallery, reload, filters/history |
| `node --env-file=apps/api/.env scripts/verify-cloud-content.mjs`                | 5 bài và 17 ảnh cloud công khai truy cập được sau cleanup; không ghi dữ liệu                                                        |
| Audit với `--source-root=/tmp/sacute-migration-source/apps/api/mock-data/posts` | Qua; nội dung, metadata và SHA-256 từng ảnh khớp archive                                                                            |
| HTTP trực tiếp production SSR local                                             | Bài `chuyen-xe-doan-vien-2026` trả 200 với nội dung và ảnh Supabase                                                                 |
| `git diff --check`                                                              | Qua                                                                                                                                 |

Kiểm thử deterministic bao gồm draft/archived/future hidden, unknown slug 404, lỗi DB 503, timeout riêng, ngày chỉ có date, timestamp Việt Nam, cover/order/ảnh thiếu, category/search/pagination, không credentials trong browser bundle, không local mock read trong production. Bài/slug mới được thêm vào fixture DB sau build, SSR/detail/home cập nhật ngay; archive bài làm detail trở thành 404 ngay. Không chèn bài thử vào production database.

Kiểm tra typecheck ban đầu phát hiện thiếu tương thích subpath types của CommonJS API; đã thêm typesVersions và kiểm tra lại thành công. Format check ban đầu phát hiện migration script cũ chưa theo Prettier; chỉ format, không đổi logic. Test HTTP cần chạy ngoài sandbox network isolation trong môi trường này; kết quả ở bảng là những lần chạy hoàn tất, không tính các tiến trình bị dừng do isolation.

## Cloud và cleanup

Trước cleanup đã đối chiếu năm slug hồi quy, toàn bộ text sau trim, quan hệ chi tiết, 17 ảnh byte-for-byte, album order, dimensions và cover. Không chạy lại import, không tạo lại DB, không sửa/xóa bản ghi hoặc object cloud. Xem [biên bản và phục hồi nguồn](migration.md).

Đã xóa dataset và hướng dẫn mock, generator, source TypeScript generated, bản sao public media; bỏ import/export localContent, LocalContentRepository, Vite mock HMR, static media serving và prerender paths. Generator/media/generated trước đây bị Git ignore nên không có tất cả trong danh sách file tracked bị xóa bên dưới. Giữ migration script lịch sử và bản nguồn tại Git revision được ghi trong migration.md; archive tạm ở /tmp. Không sửa branding hoặc CSS.

## Vercel và giới hạn còn lại

Runtime bắt buộc `SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY`. Build dùng `VITE_SITE_ORIGIN=https://sacute.vercel.app`; `VITE_ALLOW_INDEXING=false` cho preview, chỉ true khi production được duyệt. Không cần VITE_SUPABASE, secret/service-role hoặc database password. Root apps/web, framework React Router, xóa Output Directory override build/client. Chi tiết tại [deployment.md](deployment.md).

Chưa deploy theo chỉ dẫn; việc xác nhận Vercel Function thực sự phục vụ bản mới trên sacute.vercel.app cần bước triển khai được cho phép sau đó. Build manifest và local production SSR đã được kiểm tra. Không có SQL initialization/policy definitions trong checkout; không kiểm toán đầy đủ RLS bằng quyền quản trị. Read-only audit dùng key công khai đã qua. Markdown nếu có được hiển thị dạng text an toàn; chưa thêm rich-text renderer. Danh mục sự kiện lấy từ cloud qua projection metadata theo batch, độc lập pagination kết quả. Nội dung đang mở không tự cập nhật realtime, tải lại/điều hướng đọc dữ liệu mới.

## Danh sách file

### Tạo mới

- `apps/api/src/common/posts.controller.ts`
- `apps/web/app/services/content-provider.server.ts`
- `docs/deployment.md`
- `docs/implementation-report.md`
- `docs/migration.md`
- `packages/shared/src/content.ts`
- `scripts/verify-cloud-content.mjs`
- `tests/content.test.mjs`
- `tests/support/preview.mjs`
- `tests/support/supabase.mjs`

### Sửa

- `.env.example`
- `.github/workflows/ci.yml`
- `.gitignore`
- `.prettierignore`
- `README.md`
- `apps/api/.env.example`
- `apps/api/src/application.ts`
- `apps/api/src/common/content-data.module.ts`
- `apps/api/src/common/content.repository.ts`
- `apps/api/src/common/http-error.filter.ts`
- `apps/api/src/config/environment.ts`
- `apps/api/test/api.test.cjs`
- `apps/web/.env.example`
- `apps/web/app/features/content/article-card.tsx`
- `apps/web/app/features/content/content-list.tsx`
- `apps/web/app/features/content/post-gallery.tsx`
- `apps/web/app/features/home/home-page.tsx`
- `apps/web/app/root.tsx`
- `apps/web/app/routes/events.tsx`
- `apps/web/app/routes/home.tsx`
- `apps/web/app/routes/information.tsx`
- `apps/web/app/routes/not-found.tsx`
- `apps/web/app/routes/post.tsx`
- `apps/web/app/routes/scholarships.tsx`
- `apps/web/app/services/api-client.ts`
- `apps/web/app/services/content-provider.ts`
- `apps/web/package.json`
- `apps/web/react-router.config.ts`
- `apps/web/scripts/generate-seo.mjs`
- `apps/web/scripts/preview.mjs`
- `apps/web/vercel.json`
- `apps/web/vite.config.ts`
- `docs/api.md`
- `docs/architecture.md`
- `package.json`
- `packages/shared/package.json`
- `packages/shared/src/index.ts`
- `playwright.config.ts`
- `pnpm-lock.yaml`
- `scripts/migrate-sacute-posts.mjs`
- `tests/browser/posts.spec.ts`
- `tests/browser/site.spec.ts`
- `tests/seo.test.mjs`

### Xóa khỏi Git working tree

- `apps/api/mock-data/README.md`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/content.md`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/images/photo-01.jpg`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/images/photo-02.jpg`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/images/photo-03.jpg`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/images/photo-04.jpg`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/images/photo-05.jpg`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/images/photo-06.jpg`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/images/photo-07.jpg`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/images/photo-08.jpg`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/images/photo-09.jpg`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/images/photo-10.jpg`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/images/photo-11.jpg`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/images/photo-12.jpg`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/images/photo-13.jpg`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/images/photo-14.jpg`
- `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/metadata.json`
- `apps/api/mock-data/posts/events/xuan-tinh-nguyen-2026/content.md`
- `apps/api/mock-data/posts/events/xuan-tinh-nguyen-2026/images/cover.jpg`
- `apps/api/mock-data/posts/events/xuan-tinh-nguyen-2026/metadata.json`
- `apps/api/mock-data/posts/information/bi-kip-giao-tiep-da-chieu-2026/content.md`
- `apps/api/mock-data/posts/information/bi-kip-giao-tiep-da-chieu-2026/images/cover.jpg`
- `apps/api/mock-data/posts/information/bi-kip-giao-tiep-da-chieu-2026/metadata.json`
- `apps/api/mock-data/posts/information/nhac-dang-ky-bi-kip-giao-tiep-2026/content.md`
- `apps/api/mock-data/posts/information/nhac-dang-ky-bi-kip-giao-tiep-2026/metadata.json`
- `apps/api/mock-data/posts/scholarships/hoc-bong-sinh-vien-2026-2027/content.md`
- `apps/api/mock-data/posts/scholarships/hoc-bong-sinh-vien-2026-2027/images/cover.jpg`
- `apps/api/mock-data/posts/scholarships/hoc-bong-sinh-vien-2026-2027/metadata.json`
- `scripts/prepare-mock-content.mjs`
