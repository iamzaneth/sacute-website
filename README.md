# SACUTE Website

Website tiếng Việt của Trung tâm Tư vấn và Hỗ trợ Sinh viên, dùng React Router 7 / React 19, NestJS 11 và Supabase. Nội dung công khai được đọc từ PostgreSQL và ảnh từ Supabase Storage; thương hiệu, bố cục và tài nguyên thiết kế vẫn nằm trong repository.

## Phát triển

Yêu cầu Node ≥ 22.12, pnpm 11.18.0.

```sh
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
# Điền SUPABASE_URL và SUPABASE_PUBLISHABLE_KEY vào cả hai ứng dụng.
pnpm dev
```

Web: `http://localhost:5173`; API: `http://localhost:3001/api/v1`. NestJS là ứng dụng backend độc lập hợp lệ; web SSR đọc trực tiếp Supabase qua cùng lớp truy vấn, không cần triển khai API riêng.

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install --with-deps chrome
pnpm test:e2e
```

Build không cần kết nối cơ sở dữ liệu. Các kiểm thử dùng dữ liệu tổng hợp và HTTP adapter riêng trong `tests/support`; không cần thông tin đăng nhập production. `pnpm preview` chạy bản SSR đã build và cần biến môi trường runtime. Với file môi trường của web:

```sh
cd apps/web
node --env-file=.env scripts/preview.mjs
```

## Nội dung và triển khai

Xuất bản trong Supabase Table Editor hoặc công cụ quản trị đã được cấp quyền. Đặt `status=published`, `visible_from` phù hợp, metadata, chi tiết học bổng/sự kiện và ảnh `post-media`. Một sự kiện là một bản ghi, có thể xuất hiện ở cả trang Thông tin và Sự kiện. Không cần sửa mã nguồn hoặc build lại để xuất bản slug mới. Chưa có giao diện CMS trong thay đổi này.

Vercel: root `apps/web`, framework **React Router**, bỏ override Output Directory cũ `build/client`. Đặt `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` cho runtime; `VITE_SITE_ORIGIN=https://sacute.vercel.app` cho canonical và chỉ bật `VITE_ALLOW_INDEXING=true` khi duyệt cho phép lập chỉ mục. Không đặt secret/service-role key trong ứng dụng web.

- [Kiến trúc và bảo mật](docs/architecture.md)
- [API](docs/api.md)
- [Triển khai và khắc phục lỗi](docs/deployment.md)
- [Xác minh và lưu trữ nguồn di chuyển](docs/migration.md)
