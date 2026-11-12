# Kiến trúc SACUTE

## Cấu trúc

```text
apps/web/          React Router 7 + React 19: SSR, giao diện công khai và CMS
apps/api/          NestJS 11: API chỉ đọc nội dung công khai
packages/shared/   Kiểu dữ liệu, cấu hình tổ chức, mapper và repository Supabase
supabase/          Migration CMS và SQL audit RLS
scripts/           Công cụ nhập dữ liệu và xác minh nội dung cloud
```

Web dùng SSR với preset `@vercel/react-router`. Loader và action chạy trên Node.js; preview dùng Express. Mọi slug bài viết được giải quyết ở runtime, không prerender bài khi build. API NestJS là ứng dụng độc lập, không phải tầng bắt buộc giữa web và Supabase. Thương hiệu và tài nguyên giao diện nằm trong `apps/web/public`; nội dung bài và ảnh nằm ở PostgreSQL/Storage.

## Luồng đọc nội dung

Web loader → `content-provider.server.ts` → `SupabaseContentRepository` trong `packages/shared/src/content.ts` → Supabase PostgreSQL/PostgREST. NestJS dùng cùng repository và mapper.

Client công khai chỉ dùng publishable key hoặc legacy anon key, không có phiên đăng nhập. Biến Supabase được đọc trong module server, không đưa vào bundle trình duyệt. Mapper chỉ trả trường công khai, đổi snake_case sang camelCase và loại metadata nội bộ. Nội dung bài là văn bản được React escape; không thực thi HTML.

Điều kiện công khai luôn là `status=published`, `deleted_at IS NULL` và `visible_from` chưa đặt hoặc đã đến hạn theo clock database. RLS độc lập áp dụng cùng điều kiện cho bài, bảng chi tiết và media. Mỗi request dùng chung một clock database; quan hệ media/chi tiết được nhúng để tránh N+1. Filter, đếm và phân trang thực hiện trong PostgreSQL.

Thứ tự bài: `published_on DESC NULLS LAST`, `published_at DESC NULLS LAST`, `id ASC`. Ngày không có giờ giữ nguyên `YYYY-MM-DD`; timestamp hiển thị theo `Asia/Ho_Chi_Minh`. Feed có 12 bài mỗi trang. Trang Thông tin kết hợp thông báo và hoạt động, mặc định chọn Thông báo; `category=` chọn tất cả. Tìm kiếm title/summary dùng ILIKE, không phân biệt hoa thường nhưng giữ dấu tiếng Việt.

Slug thiếu hoặc không công khai trả 404, query sai trả 400, lỗi đọc dữ liệu/timeout trả 503. Lỗi không được biến thành danh sách rỗng. Log không chứa token, cấu hình bí mật hay bản ghi riêng tư.

## Loading và cache trình duyệt

Trang chủ/feed stream phần nội dung động qua Suspense và React `use`; phần tĩnh xuất hiện trước cùng skeleton. Bot chờ dữ liệu để giữ SEO và HTTP status. Detail chờ loader server để trả 404 và metadata chính xác, sau đó đưa kết quả SSR/ETag vào cache khi hydrate. Với response đã bắt đầu stream cho người dùng, lỗi xuất hiện trong trang vì HTTP status đã được gửi.

Client navigation dùng `GET /resources/content?view=home|information|scholarships|events|post`. Cache RAM được phân biệt theo view, trang, từ khóa, danh mục hoặc slug, giới hạn 16 kết quả, ước tính 4 MiB và thời gian giữ 5 phút. Dữ liệu được xác nhận trong 60 giây được dùng lại khi chuyển mục hoặc focus tab mà không gửi request; đọc/render cache không gia hạn mốc này.

Sau 60 giây, chuyển mục hoặc focus tab kiểm tra ETag trong nền và giữ snapshot hiển thị trong lúc chờ. Request cùng khóa được gộp. Mỗi request thực sự đến server đọc lại database/RLS trước khi trả 200/304; xác nhận thành công bắt đầu khoảng 60 giây mới. Lỗi kiểm tra loại cache tương ứng và hiển thị thử lại. Thay đổi bài có thể chậm phản ánh đến hết khoảng freshness ở lần chuyển mục/focus tiếp theo; trang đang mở không tự polling.

Chuyển trang giữ Outlet hiện tại trong lúc router xử lý thay vì dựng một bản trang đích tạm; chỉ báo nhỏ xuất hiện sau 150 ms nếu còn chờ. Khi có snapshot, trang đích hiển thị ngay và cập nhật trên cùng cây React để giữ trạng thái caption/gallery. Feed khôi phục vị trí cuộn theo đường dẫn và bộ lọc, kể cả khi quay lại qua liên kết.

Detail dùng lại full article từ danh sách với đúng mốc xác minh của danh sách, không gia hạn freshness khi mở bài và không dùng ETag của danh sách cho detail. Sau freshness, xác minh detail ở nền; 404 loại cả snapshot detail và các danh sách có chứa bài để tránh hiện lại bài đã bị gỡ. Bộ nhớ vẫn giới hạn 16 kết quả/4 MiB. Hover/focus/touch liên kết bài và điều hướng chủ động làm ấm cùng cache/request đang chạy; bỏ qua data prefetch khi bật tiết kiệm dữ liệu hoặc mạng 2G. Liên kết bài dùng thêm `prefetch="intent"` để tải trước module route; các route có clientLoader không phát sinh server data prefetch của React Router.

Cache được xóa khi vào admin và khi tải lại/đóng tab. Không dùng localStorage, service worker, cache bản ghi dùng chung ở server hoặc CDN. HTML SSR/API/ảnh riêng tư dùng no-store; resource ETag dùng private/no-cache và CDN no-store. Chạy `pnpm test:cache` để kiểm tra tuổi cache, dùng lại dữ liệu, request trùng và invalidation. Sau `pnpm build`, kiểm tra trình duyệt bằng `node tests/content-navigation.mjs /đường/dẫn/playwright/index.mjs`; script dùng Supabase giả lập trên localhost, không đọc/ghi database thật.

## Admin CMS

Route riêng: `/admin/login`, `/admin`, `/admin/posts`, `/admin/posts/new`, `/admin/posts/:id/edit`, `/admin/media`. Không có liên kết admin trong điều hướng công khai.

`admin-auth.server.ts` tạo Supabase SSR client theo request. Mỗi protected loader/action xác minh `auth.getUser()` và `admin_profiles.role=admin`. Cookie HttpOnly, SameSite=Lax, Path=/ và Secure trên HTTPS; không lưu token trong localStorage, URL hoặc loader data. Mọi action kiểm tra Origin chính xác; đăng xuất là POST. Admin responses private/no-store và noindex. Người chưa đăng nhập được chuyển về login; người không có quyền nhận 403.

`AdminContentRepository` gọi RPC SECURITY INVOKER để lưu post, chi tiết và gallery trong một transaction. Revision/snapshot và row lock chống ghi đè chỉnh sửa đồng thời; slug cũ được giữ nguyên. Trạng thái suy ra gồm nháp, hẹn giờ, công khai, lưu trữ và thùng rác. Khôi phục về nháp; xóa vĩnh viễn đang tắt. Hẹn giờ dùng clock database, không cần cron.

Ảnh mới được Sharp decode/re-encode để loại metadata, giới hạn PNG/JPEG/WebP tĩnh, tối đa 3 MiB và 16 triệu điểm ảnh. Ảnh lưu vào bucket riêng tư `draft-media`. Preview admin qua `/admin/media/file`; ảnh bài đã công khai qua `/media/posts/:id/:mediaId` (web) hoặc `/api/v1/media/posts/:id/:mediaId` (API), xác minh bài cha mỗi request và trả byte no-store/nosniff. Không phát hành signed/public URL cho ảnh nháp. Chỉ xóa ảnh riêng tư chưa sử dụng thuộc namespace admin hiện tại. URL ảnh cũ trong bucket public `post-media` vẫn công khai kể cả khi ẩn bài.

## Cấu hình CMS trên Supabase

Ứng dụng yêu cầu schema nội dung hiện có; migration CMS không phải script khởi tạo database mới. SQL audit nằm ở `supabase/audits/admin_rls_audit.sql`. Review schema, policy, grants, RPC và bucket trước khi áp dụng các migration chưa chạy, theo thứ tự:

1. `202611100001_private_admin_cms.sql`: quyền CMS, RLS và lưu bài.
2. `202611100002_admin_security_hardening.sql`: database write gate và bảo vệ Storage.
3. `202611100003_post_lifecycle.sql`: hẹn giờ, revision, thùng rác và ảnh riêng tư có điều kiện.

Các file nằm trong `supabase/migrations/`, chỉ áp dụng thủ công sau review và xác minh trên staging; không chạy trong build/CI. Giữ gate đóng trong quá trình cấu hình. Không tắt RLS để khắc phục lỗi quyền; legacy RPC có đặc quyền và policy cũ cần được audit riêng.

Tạo user email/password trong Supabase Auth, sau đó cấp `admin_profiles(user_id, role)` với UUID của user và role `admin` bằng quyền chủ project. Ứng dụng không có đăng ký, khôi phục mật khẩu hay MFA challenge. Chỉ bật ghi sau khi cả ba migration và quyền đọc/ghi/media đã được xác minh: đặt `public.admin_cms_settings.writes_enabled=true` ở hàng `singleton`, đồng thời `ADMIN_WRITES_ENABLED=true` ở web. Muốn dừng mọi client thường ghi, đóng cả database gate và env gate. `ADMIN_ORIGIN` là origin chính xác của web.

## Thông báo dùng chung

`ToastProvider` trong `apps/web/app/components/toast/toast.tsx` nằm ở root layout, giữ toast qua client navigation và hỗ trợ error boundary. Hook `useToast()` cung cấp `success`, `error`, `info`, `warning`, `dismiss`; ví dụ `toast.success('Đã lưu.');`. Có thể truyền `{ id, duration }`; mặc định 3 giây. ID sự kiện giúp tránh phát lại, lịch sử giữ tối đa 100 ID. `useToastFeedback` nối kết quả action hoặc khóa sự kiện với thông báo; lỗi trường nhập vẫn ở cạnh trường.

Tối đa 3 toast kể cả toast đang thoát; khi đầy, toast cũ trượt ra phải trước khi nhận toast mới. Hàng đợi chỉ giữ 3 thông báo mới nhất. Màu lần lượt xanh lá/đỏ/xanh dương/vàng. Animation vào/ra/dồn vị trí dùng transform và opacity, không bounce hay cập nhật React mỗi frame; chế độ reduced-motion tắt chuyển động. Hover/focus tạm dừng bộ đếm, có nút đóng và live region cho trình đọc màn hình. Không lưu thông báo vào browser storage.

## API và triển khai

API local dưới `/api/v1`: `GET /health`, `/information`, `/scholarships`, `/events`, `/posts/:slug` và route byte ảnh nêu trên. Danh sách nhận `page`, `limit` (tối đa 100), `q`, `category`; response `{ data, meta }`. CMS chỉ dùng React Router actions, không có admin CRUD endpoint trong NestJS.

Cấu hình chạy ở các file `.env.example` và hướng dẫn trong [README](../README.md). Web production chỉ cần Supabase runtime và React Router Node SSR; NestJS triển khai riêng nếu cần API. Không cấu hình SPA fallback hoặc cache CDN cho HTML, `.data`, content resource và route admin/ảnh riêng tư. SEO dùng HTML SSR, canonical theo `VITE_SITE_ORIGIN`, indexing theo `VITE_ALLOW_INDEXING`.

CI cài dependency theo lockfile và chạy build, lint, typecheck, format check. Các script trong `scripts/` là công cụ vận hành, không tự nhập lại dữ liệu khi dev/build/deploy.
