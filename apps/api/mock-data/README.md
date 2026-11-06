# Dữ liệu bài viết

Nguồn duy nhất để sửa bài: `posts/<collection>/<slug>/`.

| Collection     | `kind`        | Hiển thị                                 |
| -------------- | ------------- | ---------------------------------------- |
| `information`  | `information` | Thông tin → Thông báo                    |
| `scholarships` | `scholarship` | Học bổng                                 |
| `events`       | `event`       | Sự kiện nổi bật và Thông tin → Hoạt động |

Sự kiện nổi bật chỉ gồm Chuyến xe đoàn viên và Xuân tình nguyện. Hai thông báo
hội thảo dùng cùng `eventName` để ghi nhận chung một chương trình, không thêm
vào collection `events`. Mục Thông tin mặc định mở chuyên mục Thông báo.

## Thêm hoặc sửa bài

Mỗi thư mục bài có:

- `metadata.json`: ID duy nhất, slug khớp tên thư mục, kind, tiêu đề ngắn,
  tóm tắt, chuyên mục, tác giả, nguồn và trạng thái xuất bản.
- `content.md`: nguyên văn văn bản, emoji, hashtag và xuống dòng. Dùng
  `contentFile: "content.md"`, `contentFormat: "plain-text"`; chưa hỗ trợ Markdown.
- `images/`: ảnh đính kèm được khai báo bằng `path`, `alt`, `width`, `height`
  trong mảng `images`, theo đúng thứ tự hiển thị.

`originalTitle` giữ tiêu đề gốc; giao diện bỏ dòng này khỏi phần thân khi đã
hiển thị tiêu đề ngắn. `publishedAt` dùng ISO 8601 kèm múi giờ khi biết giờ đăng;
nếu chỉ biết ngày thì giữ `YYYY-MM-DD` và `publishedAtPrecision: "date"`.
Không suy diễn giờ đăng hoặc thông tin không có trong nguồn.

Chỉ `publicationStatus: "published"` được đưa lên web; dùng `draft` để ẩn bài.
`status` của học bổng/sự kiện tách riêng khỏi trạng thái xuất bản.
Lịch sự kiện dùng `startsAt` nếu biết giờ, `startsOn`/`endsOn` nếu chỉ biết ngày.
Học bổng dùng `provider`, `eligibility`, `opensAt`, `closesAt` khi nguồn xác nhận.

Không chép HTML Facebook, script, bình luận hoặc dữ liệu tài khoản vào nguồn
công khai. Video chưa hỗ trợ; giữ liên kết bài gốc trong `source.url`.

## Sinh dữ liệu và media

Sau khi sửa nguồn, chạy `pnpm --filter @sacute/shared build` hoặc khởi động lại
`pnpm dev`. Build tạo lại:

- `packages/shared/src/generated/mock-content.ts`: dữ liệu dùng chung cho API/web.
- `apps/web/public/media/mock/` và `apps/api/public/media/mock/`: bản sao ảnh công khai.

Các tệp sinh tự động được Git bỏ qua; không sửa trực tiếp. Web dev tự khởi động
lại khi dữ liệu sinh thay đổi để cập nhật đường dẫn trang chi tiết.
Build không phụ thuộc thư mục `tmp`; trường `source.file` chỉ ghi xuất xứ.
Khi đóng gói API, mang theo `apps/api/public` cùng `dist`.

Thẻ bài mở `/posts/<slug>`. Trang chi tiết được prerender, hiển thị đầy đủ
nội dung/album và giữ bộ lọc khi quay lại danh sách. Một ảnh hiển thị toàn bộ;
nhiều ảnh có lưới tối đa năm ô và trình xem album hỗ trợ mũi tên/Escape.
