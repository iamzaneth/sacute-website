# SACUTE Web

Website thông tin sinh viên của Trung tâm Tư vấn và Hỗ trợ Sinh viên (SACUTE).
Monorepo pnpm gồm frontend React Router, API NestJS và dữ liệu/kiểu dùng chung.
Không cần cơ sở dữ liệu để chạy hoặc build.

## Chạy dự án

Yêu cầu Node.js >=22.12 và pnpm 11.18.0. Kiểm thử trình duyệt dùng Google Chrome.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Frontend: http://127.0.0.1:5173. API: http://localhost:3001/api/v1.
Trên PowerShell có thể dùng `pnpm.cmd` nếu execution policy chặn `pnpm`.

Cấu hình mặc định không cần `.env`. Khi cần, sao chép `.env.example` của từng app
thành `.env`. Khởi động lại sau khi sửa biến môi trường. Không đưa bí mật vào
biến `VITE_*` vì chúng được gửi tới trình duyệt.

## Cấu trúc

| Thư mục                    | Vai trò                                           |
| -------------------------- | ------------------------------------------------- |
| `apps/web/app`             | Routes, giao diện, chức năng và style             |
| `apps/web/public/branding` | Logo, avatar, ảnh bìa và giấy phép font           |
| `apps/api/src`             | Controller, service, repository và cấu hình API   |
| `apps/api/mock-data/posts` | Nội dung, metadata và ảnh gốc của bài viết        |
| `packages/shared/src`      | Kiểu dữ liệu, thông tin tổ chức và lọc/phân trang |
| `scripts`                  | Chuẩn bị dữ liệu bài viết và media                |
| `tests`                    | Kiểm thử trang prerender và hành vi trình duyệt   |
| `docs`                     | Hợp đồng API và kiến trúc                         |

## Nội dung và giao diện

- `/information`: thông báo và hoạt động; mặc định chọn Thông báo.
- `/scholarships`: thông tin học bổng.
- `/events`: Chuyến xe đoàn viên và Xuân tình nguyện.
- `/posts/:slug`: nội dung đầy đủ, ảnh và album của bài viết.
- `/contact`: thông tin liên hệ; chưa nhận gửi biểu mẫu.
- `/recruitment`: giới thiệu các ban, mô tả công việc và FAQ; chưa nhận đăng ký.

Danh sách hỗ trợ tìm kiếm, bộ lọc lưu trong URL và lịch sử trình duyệt.
Ảnh album hỗ trợ chuột, mũi tên và Escape. Menu desktop thu gọn được;
menu mobile giữ focus và đóng bằng Escape.

Xem [hướng dẫn quản lý bài viết](apps/api/mock-data/README.md). Không sửa các
bản dữ liệu/media sinh tự động. Build không cần bản HTML đầu vào trong `tmp`.

Thông tin tổ chức và liên hệ nằm tại `packages/shared/src/index.ts`.
Nội dung các ban nằm tại `apps/web/app/features/recruitment/data/recruitment-teams.ts`.
Avatar và ảnh bìa cấu hình ở `apps/web/app/components/brand.tsx`; favicon sinh từ
avatar lúc dev/build. Ảnh bìa SVG nhúng font Montserrat để giữ vị trí chữ;
giữ giấy phép `Montserrat-OFL.txt` cùng artwork khi thay hoặc phân phối ảnh bìa.

## Kiểm tra và build

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
```

`pnpm test` build dự án rồi chạy kiểm thử API, lọc/phân trang và HTML/SEO.
Chạy trước `test:e2e`, vốn mở preview tĩnh và kiểm tra bằng Chrome.
Kết quả trong `test-results` và `playwright-report` là tệp sinh tự động, có thể xóa.

```sh
pnpm build
pnpm preview
```

Preview production tại http://127.0.0.1:4173. Chạy API riêng bằng
`pnpm --filter @sacute/api start` sau khi build.

## Hosting và SEO

Triển khai toàn bộ `apps/web/build/client`, gồm HTML, `.data` và assets.
Host phải phục vụ `index.html` trong thư mục route; đường dẫn không tồn tại
trả `404.html` với HTTP 404. Asset hoặc dữ liệu không tồn tại cũng phải trả 404.
Không rewrite mọi request về trang chủ với HTTP 200.

Các trang chính và bài đã xuất bản được prerender với `ssr: false`.
Danh sách đường dẫn đọc trực tiếp metadata để tránh cache dữ liệu biên dịch cũ.
Frontend không cần API khi render; API dùng cùng collection dữ liệu local.

Build hiện dùng `noindex, nofollow`, robots `Disallow: /` và sitemap rỗng.
Sau khi có domain HTTPS chính thức, đặt `VITE_SITE_ORIGIN` rồi build lại.
Chỉ bật lập chỉ mục sau khi duyệt nội dung, đánh dấu trang được xác nhận trong
`pageMeta` và cập nhật `indexablePaths` ở `apps/web/scripts/generate-seo.mjs`.
Chỉ đặt `VITE_ALLOW_INDEXING=true` chưa đủ để đưa trang chưa duyệt lên search.

Với Vercel: Root Directory `apps/web`, bật nguồn ngoài root, Node.js 24.x,
Install Command `pnpm install --frozen-lockfile`, Build Command `pnpm run build`,
Output Directory `build/client`. Build frontend tự chuẩn bị shared package.
Cấu hình build/output được lưu trong `apps/web/vercel.json` để dùng cùng lệnh
với bản production local. Khi redeploy, chọn commit mới nhất của `main` và tắt
`Use existing Build Cache` nếu bản đang phục vụ vẫn chứa CSS cũ. Kiểm tra bản
deploy mới trước khi Promote to Production, rồi kiểm tra lại domain production:

```sh
E2E_BASE_URL=https://your-deployment.vercel.app pnpm exec playwright test tests/browser/site.spec.ts --grep 'sidebar'
```

Khi có `E2E_BASE_URL`, kiểm thử dùng URL đó và không khởi động preview local.
Các bài kiểm tra animation đo vị trí icon, nút mở/đóng và độ khớp sidebar với
header/nội dung trong từng khung hình, bao gồm cả lúc thu vào và mở ra.

API production yêu cầu `CORS_ORIGINS` là danh sách origin chính xác. Khi đóng gói
API, mang `apps/api/public` cùng `dist`. Chưa có CMS, xác thực hay ghi dữ liệu.
Xem [hợp đồng API](docs/api.md) và [kiến trúc](docs/architecture.md).
