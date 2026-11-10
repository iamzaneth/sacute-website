# Kiến trúc

Trước đây: nguồn bài viết cục bộ → script tạo TypeScript và sao chép ảnh → web prerender và API local. Hiện tại: Supabase PostgreSQL + Storage → `packages/shared/src/content.ts` → loader SSR React Router và repository NestJS. `packages/shared/src/index.ts` chỉ chứa kiểu miền, cấu hình tổ chức và điều hướng; không chứa bài viết.

Web dùng `ssr: true` và `@vercel/react-router` preset tương thích React Router 7.18.5. Mọi URL bài viết được giải quyết ở runtime; không liệt kê slug khi build, không HTML/.data prerender. Vercel tạo Node server bundle và ánh xạ mọi route vào function. Không cần một API NestJS được triển khai riêng. Preview dùng server build thật qua adapter Express chính thức.

## Lớp dữ liệu

`createPublicSupabaseClient` kiểm tra URL và publishable key (hoặc legacy anon JWT), từ chối secret/service-role key. Phiên đăng nhập không được lưu. Web chỉ nhập lớp này trong module `.server.ts`; entry point shared dành cho component không xuất client hoặc thông tin môi trường. Các biến môi trường không có tiền tố `VITE_` chỉ dùng ở server.

`SupabaseContentRepository.listPosts`, `list`, `getLatestPosts`, `getPostBySlug` dùng một truy vấn PostgREST với quan hệ media và chi tiết được nhúng; không N+1. Filter, đếm và pagination thực hiện trong PostgreSQL. Truy vấn luôn yêu cầu `status=published` và `visible_from` rỗng hoặc không ở tương lai. Mapper kiểm tra lại điều kiện công khai trước khi trả dữ liệu. Không sử dụng lifecycle_status để quyết định xuất bản. Thiếu hoặc sai chi tiết lifecycle báo dữ liệu không hợp lệ, không tự tạo trạng thái kết thúc.

Thứ tự ổn định: `published_on DESC NULLS LAST`, sau đó `published_at DESC NULLS LAST`, rồi `id ASC`. Khi xuất bản phải duy trì `published_on` là ngày công bố trong múi giờ Việt Nam, đồng nhất với timestamp nếu có. Bài chỉ có ngày trả nguyên `YYYY-MM-DD`; timestamp giữ nguyên instant và hiển thị Asia/Ho_Chi_Minh. Không tạo timestamp giả cho bài chỉ có ngày.

Thông tin kết hợp kind `information` và `event`; category hiển thị tương ứng Thông báo và Hoạt động, giữ nguyên kind. Detail vẫn giữ category thật. Mặc định trang Thông tin chọn Thông báo; `category=` chọn Tất cả. Category sự kiện dựa trên event_name, với category làm dự phòng. Facet lấy riêng hai trường metadata theo batch tối đa 500, filter publication ở PostgreSQL, không tải body/media để dựng bộ lọc. Các nhóm mới xuất hiện từ cloud và vẫn hiển thị khi đổi trang hoặc lọc. Keyword tìm title/summary bằng ILIKE, không phân biệt hoa thường tiếng Việt nhưng vẫn phân biệt dấu; escape wildcard và cú pháp filter. Mỗi trang web có 12 bài, API tối đa 100. Homepage lấy 1 thông báo, 1 học bổng và 2 sự kiện gần nhất song song.

Mapper chuyển snake_case thành camelCase và chỉ xuất các trường công khai đã chọn, không serialize source_metadata hay user quản trị. URL tác giả/nguồn chỉ chấp nhận HTTP(S). Gallery theo sort_order và id; cover chọn riêng, không đảo album. Storage URL lấy bằng `getPublicUrl`, chỉ với bucket `post-media`. Record media sai/private bị bỏ qua và ghi cảnh báo có cấu trúc, không ghi đường dẫn riêng tư. Kích thước thiếu được bỏ qua; lightbox dùng kích thước viewport dự phòng. Nội dung được React escape và hiển thị dạng văn bản giữ xuống dòng; HTML không được thực thi. Không thêm xử lý Markdown/HTML; nội dung markdown hiện được hiển thị nguyên văn an toàn.

## Bảo mật và trạng thái

RLS phải cho anon SELECT chỉ các bài đã xuất bản, đến hạn hiển thị; các bảng chi tiết/media phải có chính sách phụ thuộc bài cha. Bucket `post-media` công khai; `draft-media` riêng tư. Cần giới hạn ghi cho tài khoản quản trị đã xác thực. Lớp đọc công khai không dùng khóa đặc quyền. Định nghĩa SQL/RLS không có trong checkout, vì vậy không tự tạo lại bảng hoặc thay chính sách. Xác minh đọc thật đã thực hiện bằng publishable key; việc kiểm tra đầy đủ policy bằng quyền quản trị vẫn thuộc vận hành Supabase.

Các request và response nội dung dùng `no-store`; chỉ tái sử dụng client kết nối, không cache bài viết. Không cache build hoặc TTL nội dung. Mỗi request giới hạn 10 giây; tắt retry tự động để lỗi kết nối được phản hồi kịp thời. Trang đang mở không tự cập nhật realtime; tải lại/điều hướng sẽ đọc dữ liệu mới. Supabase Storage/CDN vẫn có cơ chế cache đối tượng riêng: khi thay ảnh nên dùng đường dẫn mới.

Tập rỗng chỉ là truy vấn thành công không có bài. Slug không có/không công khai trả HTTP 404. Mất kết nối/truy vấn/timeout trả 503; cấu hình thiếu trả lỗi 500 rõ ràng (API kiểm tra khi khởi động, web ở request đầu tiên). Query sai trả 400. UI có trạng thái tải, rỗng và lỗi khác nhau, bằng tiếng Việt. Logging chỉ ghi mã lỗi, không credentials hoặc bản ghi riêng tư.

## Kiểm thử

`tests/support/supabase.mjs` mô phỏng PostgREST qua HTTP với dữ liệu tổng hợp, bao gồm bài nháp/lưu trữ/hẹn giờ. API và SSR dùng client và mapper thật để kiểm tra filter, pagination, metadata, status code và cập nhật slug sau build. Browser suite kiểm tra responsive, WCAG, URL filters, lịch sử, sidebar/drawer, ảnh và lightbox. Kiểm tra bundle đảm bảo không chứa credentials, SDK Supabase hay bài viết cố định.
