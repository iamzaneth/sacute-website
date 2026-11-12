# SACUTE Website

Website của Trung tâm Tư vấn và Hỗ trợ Sinh viên, dùng React Router, NestJS và Supabase.

## Chạy local

Yêu cầu Node.js ≥ 22.12 và pnpm 11.18.0.

```sh
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

Điền `SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY` của project đã có schema/RLS vào cả hai file `.env`, rồi chạy:

```sh
pnpm dev
```

- Web: <http://127.0.0.1:5173>
- API: <http://localhost:3001/api/v1>
- Admin: <http://127.0.0.1:5173/admin/login>, cần tài khoản có role `admin` trong `admin_profiles`.

Giữ `ADMIN_WRITES_ENABLED=false` khi chưa hoàn tất cấu hình CMS. Nếu đặt `ADMIN_ORIGIN`, dùng đúng origin đang truy cập, không kèm đường dẫn hoặc dấu `/` cuối.

## Kiểm tra và build

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
```

Build không cần kết nối Supabase. Để chạy bản web đã build với cấu hình local:

```sh
cd apps/web
node --env-file=.env scripts/preview.mjs
```

## Triển khai

Vercel: chọn root `apps/web`, preset **React Router**, install `pnpm install --frozen-lockfile`, build `pnpm run build`; bỏ override Output Directory. Cấu hình `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ADMIN_ORIGIN` và `ADMIN_WRITES_ENABLED` ở runtime. Đặt `VITE_SITE_ORIGIN` khi build; chỉ bật `VITE_ALLOW_INDEXING=true` trên production đã duyệt.

Web SSR đọc trực tiếp Supabase nên không bắt buộc triển khai API riêng. Không đưa `.env` hoặc service-role key vào repository.

Chi tiết cấu trúc, luồng dữ liệu và cấu hình CMS: [Kiến trúc dự án](docs/architecture.md).
