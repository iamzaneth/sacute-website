# Kiến trúc

Trước đây: nguồn bài viết cục bộ → script tạo TypeScript và sao chép ảnh → web prerender và API local. Hiện tại: Supabase PostgreSQL + Storage → `packages/shared/src/content.ts` → loader SSR React Router và repository NestJS. `packages/shared/src/index.ts` chỉ chứa kiểu miền, cấu hình tổ chức và điều hướng; không chứa bài viết.

Web dùng `ssr: true` và `@vercel/react-router` preset tương thích React Router 7.18.5. Mọi URL bài viết được giải quyết ở runtime; không liệt kê slug khi build, không HTML/.data prerender. Vercel tạo Node server bundle và ánh xạ mọi route vào function. Không cần một API NestJS được triển khai riêng. Preview dùng server build thật qua adapter Express chính thức.

## Lớp dữ liệu

`createPublicSupabaseClient` kiểm tra URL và publishable key (hoặc legacy anon JWT), từ chối secret/service-role key. Phiên đăng nhập không được lưu. Web chỉ nhập lớp này trong module `.server.ts`; entry point shared dành cho component không xuất client hoặc thông tin môi trường. Các biến môi trường không có tiền tố `VITE_` chỉ dùng ở server.

`SupabaseContentRepository.listPosts`, `list`, `getLatestPosts`, `getPostBySlug` lấy clock database qua RPC rồi dùng một truy vấn PostgREST với quan hệ media và chi tiết được nhúng; không N+1. Filter, đếm và pagination thực hiện trong PostgreSQL. Truy vấn luôn yêu cầu `status=published`, `deleted_at IS NULL` và `visible_from` rỗng hoặc không ở tương lai theo database clock. Mapper kiểm tra lại điều kiện công khai trước khi trả dữ liệu. Không sử dụng lifecycle_status để quyết định xuất bản. Thiếu hoặc sai chi tiết lifecycle báo dữ liệu không hợp lệ, không tự tạo trạng thái kết thúc.

Thứ tự ổn định: `published_on DESC NULLS LAST`, sau đó `published_at DESC NULLS LAST`, rồi `id ASC`. Khi xuất bản phải duy trì `published_on` là ngày công bố trong múi giờ Việt Nam, đồng nhất với timestamp nếu có. Bài chỉ có ngày trả nguyên `YYYY-MM-DD`; timestamp giữ nguyên instant và hiển thị Asia/Ho_Chi_Minh. Không tạo timestamp giả cho bài chỉ có ngày.

Thông tin kết hợp kind `information` và `event`; category hiển thị tương ứng Thông báo và Hoạt động, giữ nguyên kind. Detail vẫn giữ category thật. Mặc định trang Thông tin chọn Thông báo; `category=` chọn Tất cả. Category sự kiện dựa trên event_name, với category làm dự phòng. Facet lấy riêng hai trường metadata theo batch tối đa 500, filter publication ở PostgreSQL, không tải body/media để dựng bộ lọc. Các nhóm mới xuất hiện từ cloud và vẫn hiển thị khi đổi trang hoặc lọc. Keyword tìm title/summary bằng ILIKE, không phân biệt hoa thường tiếng Việt nhưng vẫn phân biệt dấu; escape wildcard và cú pháp filter. Mỗi trang web có 12 bài, API tối đa 100. Homepage lấy 1 thông báo, 1 học bổng và 2 sự kiện gần nhất song song.

Mapper chuyển snake_case thành camelCase và chỉ xuất các trường công khai đã chọn, không serialize source_metadata hay user quản trị. URL tác giả/nguồn chỉ chấp nhận HTTP(S). Gallery theo sort_order và id; cover chọn riêng, không đảo album. Storage URL lấy bằng `getPublicUrl`, chỉ với bucket `post-media`. Record media sai bị bỏ qua và ghi cảnh báo có cấu trúc, không ghi đường dẫn riêng tư. Ảnh private dùng route kiểm tra parent/RLS mỗi request. Kích thước thiếu được bỏ qua; lightbox dùng kích thước viewport dự phòng. Nội dung được React escape và hiển thị dạng văn bản giữ xuống dòng; HTML không được thực thi. Không thêm xử lý Markdown/HTML; nội dung markdown hiện được hiển thị nguyên văn an toàn.

## Bảo mật và trạng thái

RLS phải cho anon SELECT chỉ các bài đã xuất bản, đến hạn hiển thị; các bảng chi tiết/media phải có chính sách phụ thuộc bài cha. Bucket `post-media` công khai; `draft-media` riêng tư. Cần giới hạn ghi cho tài khoản quản trị đã xác thực. Lớp đọc công khai không dùng khóa đặc quyền. SQL audit chỉ đọc và migration đề xuất nằm trong `supabase/`; chưa áp dụng vào production. Không tự tạo lại bảng hoặc chạy migration production. Xác minh đọc thật đã thực hiện bằng publishable key; việc kiểm tra đầy đủ policy bằng quyền quản trị vẫn thuộc vận hành Supabase.

HTML SSR, API và ảnh riêng tư giữ `no-store`. Trang chủ/feed stream nội dung động sau phần tĩnh và dùng skeleton. Client có cache RAM giới hạn 16 kết quả/ước tính 4 MiB/5 phút, nhưng hiển thị snapshot công khai đã tải ngay và xác thực lại qua ETag ở nền; không có TTL cho phép trả dữ liệu cũ. Resource trả `private, no-cache, must-revalidate` và cấm CDN cache. Mỗi request dùng một clock database; không cache bản ghi ở server hoặc build. Truy vấn timeout 10 giây; không tự retry. Chuyển trang, thử lại hoặc focus tab sẽ đọc lại trạng thái công khai. Xem [loading/cache](loading-and-cache.md). Supabase Storage/CDN vẫn có cơ chế cache đối tượng riêng: khi thay ảnh nên dùng đường dẫn mới.

Tập rỗng chỉ là truy vấn thành công không có bài. Slug không có/không công khai trả HTTP 404. Mất kết nối/truy vấn/timeout trả 503; cấu hình thiếu trả lỗi 500 rõ ràng (API kiểm tra khi khởi động, web ở request đầu tiên). Query sai trả 400. UI có trạng thái tải, rỗng và lỗi khác nhau, bằng tiếng Việt. Logging chỉ ghi mã lỗi, không credentials hoặc bản ghi riêng tư.

## Kiểm thử

`tests/support/supabase.mjs` mô phỏng PostgREST qua HTTP với dữ liệu tổng hợp, bao gồm bài nháp/lưu trữ/hẹn giờ. API và SSR dùng client và mapper thật để kiểm tra filter, pagination, metadata, status code và cập nhật slug sau build. Browser suite kiểm tra responsive, WCAG, URL filters, lịch sử, sidebar/drawer, ảnh và lightbox. Kiểm tra bundle đảm bảo không chứa credentials, SDK Supabase hay bài viết cố định.

## Private Admin CMS

Các route `/admin/*` dùng layout riêng; public shell, navigation và repository đọc công khai giữ nguyên. Module `admin-auth.server.ts` dùng `@supabase/ssr`, HttpOnly cookies, `auth.getUser()` và membership trong `admin_profiles` cho từng protected loader/action. Action kiểm tra Origin, quyền admin và cổng `ADMIN_WRITES_ENABLED` (mặc định false). Không dùng user metadata hoặc service-role key.

`AdminContentRepository` tái sử dụng schema projection shared, chỉ chạy sau xác thực. RPC `admin_save_post` SECURITY INVOKER lưu post, type detail và gallery trong một transaction, kiểm tra snapshot tránh ghi đè sửa đồng thời và giữ slug cũ. RLS có restrictive guards để policy cũ không mở rộng quyền. File audit kiểm tra grants/policies/functions/triggers trước khi review migration. [Vận hành, giới hạn và quy trình bật ghi](admin-cms.md).

## Security follow-up

Migration 002 bổ sung database write gate mặc định false cho REST/RPC/Storage, staging ảnh riêng tư, deferred publication guards và khóa ảnh/post để tránh race khi ghi/xóa. `ADMIN_WRITES_ENABLED` chỉ điều khiển SSR; muốn dừng mọi client ghi phải đóng cả gate database. Ảnh mới qua decoder/re-encoder Sharp rồi vào `draft-media`; `/admin/media/file` xác thực từng request và không phát hành public/signed URL. Chỉ `post-media` dùng URL Storage công khai. Migration 003 cho phép ảnh private qua guarded byte route khi parent đã đến giờ xuất bản và chưa xóa; không copy/promote ảnh. [Review và giới hạn](security-review.md), [quy trình phát hành](media-publication.md).

## Post lifecycle

[Lifecycle contract and migration 003](post-lifecycle.md) centralize five derived states: draft/scheduled/published/archived/trashed. `visible_from` remains the scheduling instant, with nullable `deleted_at/deleted_by` for Trash. All public queries use the database time RPC and reject deleted rows; RLS independently applies the same visibility. `admin_transition_post` uses row locks and UUID revisions, and direct child edits advance the parent revision. Save and transitions preserve historical dates unless explicitly corrected. No cron, stale server record cache or Storage deletion is involved. Browser cache always revalidates visibility before reuse. Permanent deletion is disabled pending a verified cleanup design.
