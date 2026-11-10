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

Không trả bài draft/archived hoặc visible_from tương lai. 404 cho slug không có/không công khai, 400 cho query sai, 503 cho lỗi cơ sở dữ liệu hoặc timeout. Lỗi có dạng `{ "error": { "statusCode": 503, "message": "Không thể tải nội dung. Vui lòng thử lại sau." } }`. Không trả tập rỗng khi truy vấn thất bại. Response nội dung `Cache-Control: no-store`.

API kiểm tra biến `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `PORT`, `NODE_ENV`, `CORS_ORIGINS`. Production bắt buộc CORS allowlist là các HTTP(S) origin chính xác, phân cách dấu phẩy. Không hỗ trợ wildcard origin. Phương thức CORS: GET, HEAD, OPTIONS. Không cung cấp endpoint ghi hoặc admin publishing trong thay đổi này.
