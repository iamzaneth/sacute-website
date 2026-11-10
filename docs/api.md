# API công khai

Base URL khi chạy local: `http://localhost:3001/api/v1`. Web production SSR không yêu cầu API này được triển khai riêng.

| Phương thức | URL             | Nội dung                 |
| ----------- | --------------- | ------------------------ |
| GET         | `/health`       | Trạng thái tiến trình    |
| GET         | `/information`  | Thông báo và hoạt động   |
| GET         | `/scholarships` | Học bổng                 |
| GET         | `/events`       | Sự kiện                  |
| GET         | `/posts/:slug`  | Chi tiết bài đã xuất bản |

Tham số danh sách: `page` (1–100000, mặc định 1), `limit` (1–100, mặc định 12), `q` (tối đa 200 ký tự), `category` (tối đa 100 ký tự). Tham số không xác định bị từ chối. Ví dụ: `/information?category=Hoạt%20động&q=sinh%20viên&page=1&limit=12`.

API Information mặc định kết hợp thông báo và sự kiện; `category=Thông báo`/`Hoạt động` chọn từng nhóm. Kind của sự kiện vẫn là `event`; chỉ category hiển thị thay đổi. Detail giữ category thật. Truy vấn theo PostgreSQL ILIKE tìm title/summary, giữ dấu tiếng Việt. Thứ tự công bố giảm dần theo ngày, thời điểm rồi id tăng dần.

```json
{
  "data": [],
  "meta": { "total": 0, "page": 1, "limit": 12, "source": "supabase" }
}
```

Detail trả `{ "data": { ... }, "meta": { "source": "supabase" } }`. Bài viết có camelCase, mảng `images: [{url,alt,width?,height?}]`, `coverImage` tùy chọn. Học bổng thêm provider/eligibility/opensAt/closesAt/applicationUrl/status; sự kiện thêm startsAt/endsAt/startsOn/endsOn/location/registrationUrl/status. Status ở detail học bổng/sự kiện là lifecycle, độc lập với trạng thái xuất bản. Date-only giữ nguyên ngày, không chuyển thành midnight timestamp.

Không trả bài draft/archived, deleted_at khác NULL hoặc visible_from tương lai; thời gian lấy từ database. 404 cho slug không có/không công khai, 400 cho query sai, 503 cho lỗi cơ sở dữ liệu hoặc timeout. Lỗi có dạng `{ "error": { "statusCode": 503, "message": "Không thể tải nội dung. Vui lòng thử lại sau." } }`. Không trả tập rỗng khi truy vấn thất bại. Response nội dung `Cache-Control: no-store`.

API kiểm tra biến `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `PORT`, `NODE_ENV`, `CORS_ORIGINS`. Production bắt buộc CORS allowlist là các HTTP(S) origin chính xác, phân cách dấu phẩy. Không hỗ trợ wildcard origin. Phương thức CORS: GET, HEAD, OPTIONS. NestJS vẫn chỉ cung cấp nội dung công khai; CMS dùng protected React Router SSR actions.

## Private CMS actions (web SSR)

`POST /admin/login` nhận email/password; `POST /admin` đăng xuất. `/admin/posts/new` và `/admin/posts/:id/edit` nhận form editor, intent `save|draft|publish|schedule|reschedule` (revision UUID bắt buộc khi sửa), và gọi RPC atomic `admin_save_post`. `/admin/media` nhận multipart image upload (`intent=upload`) hoặc form xóa ảnh CMS chưa sử dụng (`intent=delete`, `path`, `confirm=delete`). Mọi action yêu cầu Origin chính xác; các action nội dung còn yêu cầu role admin và write gate bật. Gate tắt trả 503, validation 422, stale snapshot 409, non-admin 403; anonymous redirect về `/admin/login`. Không có admin CRUD endpoint trong NestJS.

Mọi loader admin xác thực riêng, response private/no-store/noindex. Không trả token; không nhận redirect URL tùy ý. Chi tiết cookie, Supabase provisioning, RLS và giới hạn ảnh trong [CMS operations](admin-cms.md).

`GET /admin/media/file?bucket=draft-media&path=...` là resource route bảo vệ ảnh nháp; mỗi request cần admin và response private/no-store/nosniff. Upload/delete chỉ dùng private bucket, không xóa ảnh public. Mọi mutation còn cần database gate; RPC/table/Storage không thể bypass gate database bằng JWT admin. Env gate không điều khiển client Supabase trực tiếp. Ảnh riêng tư chỉ phục vụ qua guarded byte route khi có bài công khai đến giờ, ngoài Trash; không promote sang public bucket.

`POST /admin/posts` nhận `id`, `revision`, `intent` (`publish|schedule|reschedule|cancel_schedule|hide|archive|restore_archive|trash|restore_trash`), `confirmed=yes` cho thao tác cần xác nhận, và `schedule_date`, `schedule_time`, `timezone` khi hẹn giờ. Server và RPC kiểm tra trạng thái/clock/revision/quyền ghi. Xóa vĩnh viễn luôn trả 501, không có hard-delete endpoint. Khôi phục luôn về bản nháp. Xem [vòng đời](post-lifecycle.md).

`GET /api/v1/media/posts/:id/:mediaId` (NestJS) và `GET /media/posts/:id/:mediaId` (web) trả byte ảnh private chỉ khi parent công khai theo RLS/database clock; trước lịch, ẩn hoặc Trash trả 404. Response no-store/nosniff, không trả signed/public draft URL. `images[].url` dùng route tương ứng cho ảnh private; URL public cũ giữ nguyên.

## Public web loading resource

`GET /resources/content?view=home|information|scholarships|events|post` phục vụ client navigation của web. Feed nhận `page`, `q`, `category`; post nhận `slug`. Kết quả là domain payload tương ứng (home: ba nhóm; feed: data/meta; events thêm categories; post: item), cùng ETag. Server luôn đọc lại dưới RLS/database clock trước khi trả 200 hoặc 304 cho `If-None-Match`. Resource dùng `private, no-cache, max-age=0, must-revalidate` và cấm CDN cache; lỗi 400/404/503 dùng no-store, không ETag. Không cache dữ liệu admin. [Chi tiết skeleton, streaming và cache](loading-and-cache.md).
