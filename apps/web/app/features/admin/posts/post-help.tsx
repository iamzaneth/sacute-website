import { Info } from 'lucide-react';

export function PostHelp() {
  return (
    <details
      className="admin-post-help"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}
    >
      <summary
        aria-label="Hướng dẫn điền và đăng bài viết"
        title="Hướng dẫn đăng bài"
      >
        <Info size={22} aria-hidden="true" />
      </summary>
      <div className="admin-post-help-panel">
        <h2>Hướng dẫn đăng bài</h2>
        <p>
          Các trường có dấu <span className="admin-required">*</span> là bắt
          buộc. Các thông tin khác có thể để trống nếu chưa có.
        </p>
        <dl>
          <dt>Tiêu đề *</dt>
          <dd>
            Tên bài rõ ràng, tối đa 300 ký tự. Ví dụ: Học bổng sinh viên năm
            2026.
          </dd>
          <dt>Slug *</dt>
          <dd>
            Phần đường dẫn của bài: chữ thường không dấu, số và dấu gạch ngang,
            tối đa 180 ký tự. Ví dụ: hoc-bong-sinh-vien-2026. Slug phải duy nhất
            và được giữ nguyên sau khi tạo bài.
          </dd>
          <dt>Loại bài * và danh mục *</dt>
          <dd>
            Chọn Thông tin, Học bổng hoặc Sự kiện để mở nhóm dữ liệu tương ứng.
            Danh mục là nhóm nội dung, ví dụ Thông báo hoặc Hoạt động sinh viên,
            tối đa 100 ký tự.
          </dd>
          <dt>Tóm tắt * và nội dung *</dt>
          <dd>
            Tóm tắt giới thiệu ngắn trên danh sách bài, tối đa 2.000 ký tự. Nội
            dung là phần chi tiết, tối đa 120.000 ký tự. Không chỉ nhập khoảng
            trắng.
          </dd>
          <dt>Định dạng nội dung *</dt>
          <dd>
            Chọn Văn bản để viết thông thường. Markdown hiện hiển thị nguyên văn
            các ký hiệu, chưa định dạng thành HTML.
          </dd>
          <dt>Thẻ và URL nguồn</dt>
          <dd>
            Thẻ cách nhau bằng dấu phẩy, tối đa 30 thẻ, mỗi thẻ 80 ký tự. URL
            nguồn và các liên kết khác phải là địa chỉ đầy đủ bắt đầu bằng
            https:// hoặc http://, không chứa tài khoản/mật khẩu.
          </dd>
          <dt>Ngày công bố</dt>
          <dd>
            Mặc định hệ thống tự ghi khi đăng, không cần nhập. Chỉ bật chỉnh sửa
            khi cần biên tập ngày lịch sử. Khi bật, ngày công bố là bắt buộc.
            Nếu chọn thời điểm chính xác, nhập ISO 8601 có múi giờ, ví dụ
            2026-11-20T09:00:00+07:00; ngày công bố phải khớp ngày tại Việt Nam.
          </dd>
          <dt>Hẹn giờ đăng</dt>
          <dd>
            Điền đủ ngày, giờ và múi giờ rồi bấm Hẹn giờ đăng. Thời điểm phải ở
            tương lai. Chọn Asia/Ho_Chi_Minh cho giờ Việt Nam. Không cần điền
            lịch khi lưu nháp hoặc đăng ngay.
          </dd>
          <dt>Chi tiết học bổng</dt>
          <dd>
            Điền đơn vị cấp, điều kiện, liên kết ứng tuyển nếu có. Mở/đóng đơn
            dùng ISO 8601 có múi giờ; đóng đơn không được trước mở đơn. Chọn
            trạng thái Sắp mở, Đang mở hoặc Đã đóng.
          </dd>
          <dt>Chi tiết sự kiện</dt>
          <dd>
            Điền tên chương trình, địa điểm và liên kết đăng ký nếu có. Mỗi mốc
            bắt đầu/kết thúc chọn ngày hoặc thời điểm ISO 8601, không điền cả
            hai. Kết thúc không được trước bắt đầu. Chọn trạng thái phù hợp.
          </dd>
          <dt>Ảnh bìa và thư viện</dt>
          <dd>
            Kéo thả hoặc chọn từng ảnh PNG/JPEG/WebP từ máy, tối đa 3 MiB và 16
            triệu điểm ảnh mỗi ảnh. Tải xong ảnh tự đính kèm; chọn một ảnh bìa
            nếu có ảnh. Mô tả ảnh giúp người đọc hiểu nội dung ảnh. Tối đa 100
            ảnh; ảnh không bắt buộc. Gỡ ảnh khỏi bài không xóa tệp trong thư
            viện.
          </dd>
        </dl>
        <p>
          <strong>Lưu bản nháp</strong> giữ bài chưa công khai.{' '}
          <strong>Đăng ngay</strong> công khai bài sau khi lưu thành công.{' '}
          <strong>Hẹn giờ đăng</strong> tự hiển thị bài đúng lịch. Hệ thống kiểm
          tra dữ liệu trước khi gửi; slug trùng, quyền truy cập và thay đổi từ
          phiên khác được kiểm tra khi lưu.
        </p>
      </div>
    </details>
  );
}
