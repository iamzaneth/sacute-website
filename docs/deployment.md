# Triển khai Vercel

Dùng project hiện có, root directory `apps/web`, Framework Preset **React Router**, Node 24 (tối thiểu 22.12), pnpm 11.18.0. Bật quyền truy cập workspace bên ngoài root khi Vercel yêu cầu để build `packages/shared`. Install command `pnpm install --frozen-lockfile`; build command `pnpm run build`. Xóa override Output Directory `build/client` trong dashboard cũ. `apps/web/vercel.json` không ép output tĩnh; preset tạo build manifest có Node server bundle và route `/posts/:slug` động.

| Biến                       | Môi trường                                 | Vai trò                                                        |
| -------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| `SUPABASE_URL`             | Server runtime, Production/Preview phù hợp | URL project hiện có                                            |
| `SUPABASE_PUBLISHABLE_KEY` | Server runtime, Production/Preview phù hợp | Publishable key với RLS                                        |
| `VITE_SITE_ORIGIN`         | Build                                      | `https://sacute.vercel.app` cho canonical                      |
| `VITE_ALLOW_INDEXING`      | Build                                      | `true` chỉ khi duyệt indexing production; preview dùng `false` |

Không cần `VITE_SUPABASE_*`, `VITE_API_BASE_URL`, secret key, service-role key hoặc mật khẩu DB. Không đưa `.env` vào Git. Không cần deploy NestJS riêng; nếu tự triển khai API, cung cấp biến tương tự và CORS_ORIGINS đúng origin web.

Supabase phải giữ schema và khóa ngoại quan hệ posts → post_media/scholarship_details/event_details. Xác nhận RLS anon không truy cập draft/archived/chưa đến giờ và chỉ admin có quyền ghi. Không chạy lại initialization SQL/import khi triển khai refactor. Tài nguyên branding vẫn là file tĩnh, ảnh bài viết nằm trên Storage. Bucket draft-media không công khai.

Sau khi người quản trị triển khai, kiểm tra trực tiếp `/`, các feed, `/posts/:slug` cũ và slug mới vừa xuất bản; thử reload, unknown slug (404), tắt xuất bản (404), metadata, album và network function. Build cục bộ đã xác nhận server bundle, nhưng không thay thế việc kiểm tra deployment Vercel thực tế. Thay đổi này chưa được deploy.

SEO là HTML SSR thật. Title, description, canonical (khi có origin), OG và ảnh cover được trả từ loader bài viết. Preview mặc định noindex. Khi bật indexing, robots cho phép crawl, sitemap chỉ liệt kê các feed/trang chủ, bài mới được khám phá qua liên kết runtime. Sitemap không lưu danh sách bài tại build. Contact/recruitment tiếp tục noindex đến khi được duyệt riêng.

## Khắc phục lỗi

- Lỗi cấu hình: kiểm tra đúng tên biến không có tiền tố VITE, chọn đúng môi trường Vercel và redeploy sau khi sửa env; dùng publishable key, không secret. Không có mock fallback.
- 503: kiểm tra trạng thái Supabase, URL, mạng, schema/khóa ngoại và quyền SELECT theo RLS. Log có mã an toàn `content_read_failed`/`web_content_failed`; không in biến môi trường.
- Tập rỗng: kiểm tra status, visible_from, category và RLS. Không nhầm lifecycle_status với publication status.
- Ảnh thiếu: kiểm tra object trong post-media, storage_path, sort_order/is_cover; không dùng draft-media cho bài công khai. Không tạo đường dẫn placeholder.
- Slug mới trả HTML cũ: kiểm tra dashboard không còn Static/Vite preset hoặc Output Directory override, server functions có trong deployment; không cấu hình SPA rewrite hoặc prerender `.data`.
- Canonical thiếu: đặt VITE_SITE_ORIGIN khi build. Chỉ bật VITE_ALLOW_INDEXING trên production đã duyệt.
- `pnpm preview` cần env runtime đã export, hoặc `cd apps/web && node --env-file=.env scripts/preview.mjs`. `pnpm dev` tự tải `.env` của từng app. Dùng CORS localhost thích hợp khi truy cập API từ trình duyệt.
