# Kiến trúc SACUTE

## Cấu trúc

```text
apps/web/app/
  routes/                 Module route, loader/action và resource endpoint
    public/               Trang công khai; content/ chứa feed và chi tiết bài
    admin/                layout, dashboard, auth/, posts/, media/
    resources/            JSON public content và byte ảnh công khai
  features/               Giao diện và hành vi theo tính năng
    admin/                Model dùng chung; posts/ và media/ chứa component CMS
    content/              components/, hooks/, data/
    recruitment/          components/ và data/
    home/                 Nội dung trang chủ
  components/             Layout/branding, toast và UI dùng chung
  services/               admin/, content/, media/, cache/
  lib/                    SEO và cấu hình ứng dụng
  styles/                 CSS toàn cục, branding và stylesheet theo tính năng
apps/api/src/
  modules/                content/, information/, scholarships/, events/, health/
  common/                 dto/ và filters/ dùng chung
  config/                 Kiểm tra cấu hình môi trường
packages/shared/src/
  index.ts                Entry point browser-safe: cấu hình, types, lifecycle
  content.ts              Entry point server-only cho repository Supabase
  config/                 Tổ chức và điều hướng công khai
  content/                Types và quy tắc lifecycle
  server/                 Mapper/repository Supabase
supabase/                 Migration CMS và SQL audit RLS
tests/                    web/cache/, web/media/, shared/
scripts/                  Công cụ nhập dữ liệu và xác minh nội dung cloud
```

Web dùng SSR với preset `@vercel/react-router`. Loader và action chạy trên Node.js; preview dùng Express. Mọi slug bài viết được giải quyết ở runtime, không prerender bài khi build. API NestJS là ứng dụng độc lập, không phải tầng bắt buộc giữa web và Supabase. Thương hiệu và tài nguyên giao diện nằm trong `apps/web/public`; nội dung bài và ảnh nằm ở PostgreSQL/Storage.

## Quy ước phụ thuộc

`routes.ts` khai báo URL tường minh; đổi thư mục module không đổi URL. Route chỉ ghép loader/action với component; nhãn, validation và hành vi dùng lại thuộc feature/model hoặc service, không đặt trong route để component khác import. Import type của loader/action cho fetcher vẫn được phép.

Trong web, `~/` trỏ tới `apps/web/app`; import giữa các vùng dùng alias này, import trong cùng thư mục dùng `./`. React Router tự sinh `+types` theo module mới; không sửa hoặc commit thư mục sinh tự động. `@sacute/shared` chỉ xuất mã browser-safe; truy cập `@sacute/shared/content` dành cho server. API gom nghiệp vụ trong `modules/`, `common/` chỉ chứa DTO/filter dùng chung.

## Luồng đọc nội dung

Web loader → `services/content/provider.server.ts` → `SupabaseContentRepository` trong `packages/shared/src/server/content.repository.ts` → Supabase PostgreSQL/PostgREST. NestJS dùng cùng repository và mapper.

Client công khai chỉ dùng publishable key hoặc legacy anon key, không có phiên đăng nhập. Biến Supabase được đọc trong module server, không đưa vào bundle trình duyệt. Mapper chỉ trả trường công khai, đổi snake_case sang camelCase và loại metadata nội bộ. Nội dung bài là văn bản được React escape; không thực thi HTML.

Điều kiện công khai luôn là `status=published`, `deleted_at IS NULL` và `visible_from` chưa đặt hoặc đã đến hạn theo clock database. RLS độc lập áp dụng cùng điều kiện cho bài, bảng chi tiết và media. Mỗi request dùng chung một clock database; quan hệ media/chi tiết được nhúng để tránh N+1. Filter, đếm và phân trang thực hiện trong PostgreSQL.

Thứ tự bài: `published_on DESC NULLS LAST`, `published_at DESC NULLS LAST`, `id ASC`. Ngày không có giờ giữ nguyên `YYYY-MM-DD`; timestamp hiển thị theo `Asia/Ho_Chi_Minh`. Feed có 12 bài mỗi trang. Trang Thông tin kết hợp thông báo và hoạt động, mặc định chọn Thông báo; `category=` chọn tất cả. Tìm kiếm title/summary dùng ILIKE, không phân biệt hoa thường nhưng giữ dấu tiếng Việt.

Slug thiếu hoặc không công khai trả 404, query sai trả 400, lỗi đọc dữ liệu/timeout trả 503. Lỗi không được biến thành danh sách rỗng. Log không chứa token, cấu hình bí mật hay bản ghi riêng tư.

## Loading và cache trình duyệt

Trang chủ/feed stream phần nội dung động qua Suspense và React `use`; phần tĩnh xuất hiện trước cùng skeleton. Bot chờ dữ liệu để giữ SEO và HTTP status. Detail chờ loader server để trả 404 và metadata chính xác, sau đó đưa kết quả SSR/ETag vào cache khi hydrate. Với response đã bắt đầu stream cho người dùng, lỗi xuất hiện trong trang vì HTTP status đã được gửi.

Client navigation dùng `GET /resources/content?view=home|information|scholarships|events|post`. Cache RAM được phân biệt theo view, trang, từ khóa, danh mục hoặc slug, giới hạn 16 kết quả, ước tính 4 MiB và thời gian giữ 5 phút. Dữ liệu được xác nhận trong 60 giây được dùng lại khi chuyển mục hoặc focus tab mà không gửi request; đọc/render cache không gia hạn mốc này.

Sau 60 giây, chuyển mục, focus tab hoặc nhịp kiểm tra 15 giây khi tab visible kiểm tra ETag trong nền và giữ snapshot hiển thị trong lúc chờ. Request cùng khóa được gộp. Mỗi request thực sự đến server kiểm tra database/RLS trước khi trả 200/304; khi bật RPC tối ưu, cache hit chỉ đọc revision hiện tại; xác nhận thành công bắt đầu khoảng 60 giây mới. Lỗi kiểm tra loại cache tương ứng và hiển thị thử lại. Nhịp 15 giây giới hạn thời gian chờ làm mới khi tab vẫn mở; không polling tab hidden. Freshness browser vẫn là 60 giây, không bảo đảm thu hồi nội dung tức thì trên màn hình.

Chuyển trang giữ Outlet hiện tại trong lúc router xử lý thay vì dựng một bản trang đích tạm; chỉ báo nhỏ xuất hiện sau 150 ms nếu còn chờ. Khi có snapshot, trang đích hiển thị ngay và cập nhật trên cùng cây React để giữ trạng thái caption/gallery. Feed khôi phục vị trí cuộn theo đường dẫn và bộ lọc, kể cả khi quay lại qua liên kết.

Danh sách/home trả summary và một cover, không gửi body/gallery đầy đủ. Detail tải và cache riêng qua prefetch hover/focus/touch; prefetch chỉ khởi động khi có dưới 3 request public đang chạy. Snapshot legacy có full article vẫn được nhận diện đúng, không nhầm summary thành detail. 404 loại cả snapshot detail và danh sách chứa bài. Liên kết bài dùng thêm `prefetch="intent"` cho module route.

Hover/focus/touch bài còn chuẩn bị native Image đầu gallery sau khi public data thành công. Cache ảnh RAM tối đa 6 entry, 2 pending, retention 30 giây và tổng bitmap ước tính 8 triệu pixel; clear public cache đồng thời clear ảnh. Gallery dùng cùng URL để tái sử dụng native resource kể cả response no-store; SSR preload đúng ảnh đầu và render eager/high. Không cache ảnh admin ở browser storage. CSS branding/header/footer dùng chung tải từ root qua `branding.css`, độc lập route tuyển thành viên.

Cache trình duyệt được xóa khi vào admin, khi hoàn tất action hoặc khi nhận BroadcastChannel từ tab khác cùng origin; message không chứa nội dung/token và không dùng localStorage. HTML SSR/API/ảnh riêng tư vẫn no-store; resource ETag private/no-cache, CDN no-store. Reload/đóng tab xóa cache RAM.

Khi `SACUTE_QUERY_RPC_ENABLED=true` sau migration `202611140001_query_optimization.sql`, web có cache representation/ETag 32 entries/4 MiB, giữ tối đa 60 giây để eviction, nhưng luôn kiểm tra digest revision từ DB trước khi dùng. Cache miss kiểm tra lại revision sau đọc; nếu đổi sẽ retry tối đa 3 lần, không gắn dữ liệu cũ với version mới. Request cùng key/version chia sẻ payload; facet sự kiện dùng chung theo version, độc lập q/page. Digest chỉ bao gồm bài đang public theo giờ DB và lifecycle_revision; trigger parent của migration 003 bao phủ media/chi tiết. Version thay đổi khi bài đến giờ đăng mà không cần cron. Các process dùng RAM riêng nhưng đều xác minh version DB; không cần shared Redis để phát hiện đổi dữ liệu. Digest vẫn quét metadata tập visible, chưa phải phép đọc O(1).

Tắt flag giữ đường đọc tương thích, không gọi RPC mới. Migration không chạy tự động trong build; thiếu RPC khi flag đã bật là lỗi đọc, không được trả cache cũ. Sau thay đổi policy/schema/Storage ngoài CMS cần redeploy/xóa cache và kiểm chứng lại. Không cache bytes ảnh trước khi kiểm tra quyền hiện tại.

`pnpm test` build package shared rồi chạy toàn bộ các file `.test.mjs` trong `tests/` và các thư mục con bằng Node.js. Bộ kiểm thử gồm cache public/admin/versioned, giới hạn hàng đợi, prefetch ảnh, biến thể ảnh và validation repository. Không cần Playwright, credential hoặc database thật; CI chạy cùng lệnh này.

## Admin CMS

Route riêng: `/admin/login`, `/admin`, `/admin/posts`, `/admin/posts/new`, `/admin/posts/:id/edit`, `/admin/media`. Không có liên kết admin trong điều hướng công khai.

`services/admin/auth.server.ts` tạo Supabase SSR client theo request. Mỗi protected loader/action xác minh `auth.getUser()` và `admin_profiles.role=admin`. Cookie HttpOnly, SameSite=Lax, Path=/ và Secure trên HTTPS; không lưu token trong localStorage, URL hoặc loader data. Mọi action kiểm tra Origin chính xác; đăng xuất là POST. Admin responses private/no-store và noindex. Người chưa đăng nhập được chuyển về login; người không có quyền nhận 403.

`AdminContentRepository` gọi RPC SECURITY INVOKER để lưu post, chi tiết và gallery trong một transaction. Revision/snapshot và row lock chống ghi đè chỉnh sửa đồng thời; slug cũ được giữ nguyên. Trạng thái suy ra gồm nháp, hẹn giờ, công khai, lưu trữ và thùng rác. Khôi phục về nháp; xóa vĩnh viễn đang tắt. Hẹn giờ dùng clock database, không cần cron.

Ảnh mới được Sharp decode/re-encode để loại metadata, giới hạn PNG/JPEG/WebP tĩnh, tối đa 3 MiB và 16 triệu điểm ảnh. Ảnh lưu vào bucket riêng tư `draft-media`. Preview admin qua `/admin/media/file`; ảnh bài đã công khai qua `/media/posts/:id/:mediaId` (web) hoặc `/api/v1/media/posts/:id/:mediaId` (API), xác minh bài cha mỗi request và trả byte no-store/nosniff. Không phát hành signed/public URL cho ảnh nháp. Chỉ xóa ảnh riêng tư chưa sử dụng thuộc namespace admin hiện tại. URL ảnh cũ trong bucket public `post-media` vẫn công khai kể cả khi ẩn bài.

## Giao diện và cache quản trị

Route `/admin` dùng sidebar trên desktop, menu thu gọn trên mobile, tổng quan trạng thái và lối tắt đến bản nháp/lịch đăng/thư viện ảnh. Tab trạng thái giữ từ khóa và loại bài, đưa phân trang về trang đầu; giá trị bộ lọc đồng bộ khi chuyển tab hoặc quay lại bằng trình duyệt.

Ở chế độ tương thích, `services/admin/cache.server.ts` giữ danh sách bài trong RAM từng process (32 entries/4 MiB, TTL 15 giây). Khóa chuẩn hóa q/kind/status/page, bỏ success marker; vẫn tách UUID user và quyền ghi. Mọi request kiểm tra Auth/membership/write gate trước cache. Form/revision biên tập và byte ảnh không cache.

Khi bật RPC tối ưu, danh sách dùng cache có xác minh `sacute_admin_revision` trên mỗi request và kiểm tra lại sau cache miss. Dashboard gọi một RPC aggregate, không thêm cache/version scan thừa cho truy vấn số đếm nhỏ. Thư viện ảnh list trực tiếp trang 50 items; picker chỉ tải khi mở, duyệt thư mục và phân trang qua resource riêng, không cắt cứng 500 ảnh hoặc lấy nhầm namespace cha. Lỗi picker có retry và không unmount editor.

Action vẫn xóa cache tương thích trước/sau ghi, generation chống repopulate snapshot cũ trong process. Cache phiên bản phát hiện thay đổi xuyên process qua DB; browser đồng bộ tab sau action. Dashboard/list/media tự kiểm tra lại mỗi 15 giây khi visible và refresh khi focus. Editor không auto-refresh loader; cảnh báo khi rời trang/reload với thay đổi chưa lưu, giữ nguyên form khi upload hoặc bộ chọn ảnh lỗi. Mọi action vẫn xác minh revision/time tại server/DB.

Ảnh legacy trong bucket public `post-media` dùng trực tiếp URL Storage công khai, không đi qua web proxy/DB/Sharp theo từng lượt xem. Thumbnail qua route kiểm quyền chỉ dành cho `draft-media`. Khi prefetch list/home từ sidebar hoặc nhận JSON mới, client chuẩn bị hai ảnh đầu trước khi giao dữ liệu cho React.

Ảnh admin chỉ xác minh Auth/membership, không đọc write gate. Thumbnail web 320/640/1280px được Sharp tạo theo yêu cầu sau kiểm tra quyền/visibility và download, cache bytes biến thể theo hash nội dung (64 entries/16 MiB). Sharp upload/thumbnail chia sẻ hàng đợi tối đa 2 tác vụ native và 8 chờ; quá tải trả 503 thay vì khởi chạy ngoài giới hạn. Original giữ nguyên; gallery mở ảnh lớn, thumbnail dùng WebP với dimensions phù hợp; ảnh public legacy lỗi transform có fallback original. Không phát signed URL riêng tư. Lần đầu mỗi biến thể vẫn có CPU resize; mỗi request vẫn kiểm tra quyền và đọc object hiện tại để tránh dùng nhầm bytes khi đường dẫn bị ghi đè.

## Cấu hình CMS trên Supabase

Ứng dụng yêu cầu schema nội dung hiện có; migration CMS không phải script khởi tạo database mới. SQL audit nằm ở `supabase/audits/admin_rls_audit.sql`. Review schema, policy, grants, RPC và bucket trước khi áp dụng các migration chưa chạy, theo thứ tự:

1. `202611100001_private_admin_cms.sql`: quyền CMS, RLS và lưu bài.
2. `202611100002_admin_security_hardening.sql`: database write gate và bảo vệ Storage.
3. `202611100003_post_lifecycle.sql`: hẹn giờ, revision, thùng rác và ảnh riêng tư có điều kiện.
4. `202611140001_query_optimization.sql`: helper đọc revision, aggregate số đếm và DISTINCT danh mục. Chỉ bật `SACUTE_QUERY_RPC_ENABLED=true` sau khi xác minh migration này trên staging.

Các file nằm trong `supabase/migrations/`, chỉ áp dụng thủ công sau review và xác minh trên staging; không chạy trong build/CI. Giữ gate đóng trong quá trình cấu hình. Không tắt RLS để khắc phục lỗi quyền; legacy RPC có đặc quyền và policy cũ cần được audit riêng.

Tạo user email/password trong Supabase Auth, sau đó cấp `admin_profiles(user_id, role)` với UUID của user và role `admin` bằng quyền chủ project. Ứng dụng không có đăng ký, khôi phục mật khẩu hay MFA challenge. Chỉ bật ghi sau khi cả ba migration và quyền đọc/ghi/media đã được xác minh: đặt `public.admin_cms_settings.writes_enabled=true` ở hàng `singleton`, đồng thời `ADMIN_WRITES_ENABLED=true` ở web. Muốn dừng mọi client thường ghi, đóng cả database gate và env gate. `ADMIN_ORIGIN` là origin chính xác của web.

## Thông báo dùng chung

`ToastProvider` trong `apps/web/app/components/toast/toast.tsx` nằm ở root layout, giữ toast qua client navigation và hỗ trợ error boundary. Hook `useToast()` cung cấp `success`, `error`, `info`, `warning`, `dismiss`; ví dụ `toast.success('Đã lưu.');`. Có thể truyền `{ id, duration }`; mặc định 3 giây. ID sự kiện giúp tránh phát lại, lịch sử giữ tối đa 100 ID. `useToastFeedback` nối kết quả action hoặc khóa sự kiện với thông báo; lỗi trường nhập vẫn ở cạnh trường.

Tối đa 3 toast kể cả toast đang thoát; khi đầy, toast cũ trượt ra phải trước khi nhận toast mới. Hàng đợi chỉ giữ 3 thông báo mới nhất. Màu lần lượt xanh lá/đỏ/xanh dương/vàng. Animation vào/ra/dồn vị trí dùng transform và opacity, không bounce hay cập nhật React mỗi frame; chế độ reduced-motion tắt chuyển động. Hover/focus tạm dừng bộ đếm, có nút đóng và live region cho trình đọc màn hình. Không lưu thông báo vào browser storage.

## API và triển khai

API local dưới `/api/v1`: `GET /health`, `/information`, `/scholarships`, `/events`, `/posts/:slug` và route byte ảnh nêu trên. Danh sách nhận `page`, `limit` (tối đa 100), `q`, `category`; response `{ data, meta }`. CMS chỉ dùng React Router actions, không có admin CRUD endpoint trong NestJS.

Cấu hình chạy ở các file `.env.example` và hướng dẫn trong [README](../README.md). Web production chỉ cần Supabase runtime và React Router Node SSR; NestJS triển khai riêng nếu cần API. Không cấu hình SPA fallback hoặc cache CDN cho HTML, `.data`, content resource và route admin/ảnh riêng tư. SEO dùng HTML SSR, canonical theo `VITE_SITE_ORIGIN`, indexing theo `VITE_ALLOW_INDEXING`.

CI cài dependency theo lockfile và chạy build, test, lint, typecheck, format check. Các script trong `scripts/` là công cụ vận hành, không tự nhập lại dữ liệu khi dev/build/deploy.
