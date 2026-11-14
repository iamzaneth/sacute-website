import { adminMutation } from '../services/admin-cache.server';
import { MediaUpload } from '../features/admin/media-upload';
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  data,
} from 'react-router';
import {
  AdminContentRepository,
  AdminDataError,
  uploadImage,
} from '../services/admin-content.server';
import {
  requireAdmin,
  requireAdminMutation,
  adminRead,
  adminHeaders,
  readAdminForm,
} from '../services/admin-auth.server';
import { ValidationError, validStoragePath } from '../features/admin/model';
import { useToastFeedback } from '../components/toast/toast';
import type { Route } from './+types/admin-media';
export const headers = adminHeaders;
export async function loader({
  request,
  context: requestContext,
}: Route.LoaderArgs) {
  const context = await requireAdmin(request, requestContext);
  const params = new URL(request.url).searchParams;
  return adminRead(context, async () => ({
    ...(await new AdminContentRepository(context.db).media(
      params.get('prefix') ?? '',
      Number(params.get('page') ?? 1),
      params.get('bucket') ?? 'draft-media',
    )),
    writesEnabled: context.writesEnabled,
  }));
}
async function handleAction({
  request,
  context: requestContext,
}: Route.ActionArgs) {
  const context = await requireAdminMutation(request, requestContext);
  const form = await readAdminForm(
    request,
    3 * 1024 * 1024 + 32768,
    context.headers,
  );
  try {
    const intent = form.get('intent');
    if (intent === 'upload') {
      const file = form.get('file');
      if (!(file instanceof File))
        throw new ValidationError({ file: 'Chọn một ảnh để tải lên.' });
      const path = await uploadImage(context, file);
      return data(
        { success: `Đã tải ảnh: ${path}`, path, error: '' },
        { headers: context.headers },
      );
    }
    if (intent === 'delete') {
      const path = String(form.get('path') ?? '');
      if (
        !validStoragePath(path) ||
        !new RegExp(
          `^admin/${context.user.id}/[0-9a-f-]{36}\\.(png|jpg|webp)$`,
          'i',
        ).test(path) ||
        form.get('confirm') !== 'delete'
      )
        throw new ValidationError({
          path: 'Chỉ xóa ảnh CMS chưa được sử dụng và đã xác nhận.',
        });
      const references = await context.db
        .from('post_media')
        .select('id', { count: 'exact', head: true })
        .eq('bucket', 'draft-media')
        .eq('storage_path', path);
      if (references.error)
        throw new AdminDataError('Không thể xác minh ảnh đang được sử dụng.');
      if (references.count !== 0)
        throw new ValidationError({
          path: 'Ảnh đang được sử dụng. Gỡ ảnh khỏi mọi bài viết trước khi xóa.',
        });
      const result = await context.db.storage
        .from('draft-media')
        .remove([path]);
      if (result.error || !result.data?.length)
        throw new AdminDataError(
          'Không thể xóa ảnh. Kiểm tra kết nối và quyền Storage.',
        );
      return data(
        { success: 'Đã xóa ảnh chưa sử dụng.', path: '', error: '' },
        { headers: context.headers },
      );
    }
    throw new ValidationError({ intent: 'Thao tác không hợp lệ.' });
  } catch (error) {
    return data(
      {
        success: '',
        path: '',
        error:
          error instanceof ValidationError
            ? Object.values(error.fields).join(' ')
            : error instanceof AdminDataError
              ? error.message
              : 'Không thể xử lý ảnh. Vui lòng thử lại.',
      },
      {
        status: error instanceof ValidationError ? 422 : 503,
        headers: context.headers,
      },
    );
  }
}
export const action = (args: Route.ActionArgs) =>
  adminMutation(() => handleAction(args));
export default function AdminMedia() {
  const state = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';
  useToastFeedback(
    result,
    result?.error || result?.success,
    result?.error ? 'error' : 'success',
  );
  const pageURL = (prefix: string, page = 1) =>
    `/admin/media?${new URLSearchParams({ prefix, page: String(page), bucket: state.bucket })}`;
  return (
    <>
      <div className="admin-title">
        <div>
          <p className="admin-eyebrow">TÀI NGUYÊN</p>
          <h1>Thư viện ảnh</h1>
          <p className="admin-description">
            Chuẩn bị hình ảnh cho những câu chuyện của SACUTE.
          </p>
        </div>
      </div>
      <nav aria-label="Kho ảnh" className="admin-breadcrumbs">
        <Link to="/admin/media?bucket=draft-media">Ảnh riêng tư</Link>
        <Link to="/admin/media?bucket=post-media">Ảnh đã công bố</Link>
      </nav>
      <p>
        Ảnh mới chỉ công khai khi có bài đã đến giờ đăng sử dụng. Ảnh trong kho
        công khai cũ vẫn truy cập được qua URL kể cả khi ẩn bài. Hỗ trợ PNG,
        JPEG, WebP tối đa 3 MiB và 16 triệu điểm ảnh.
      </p>
      {result?.path && (
        <p>
          <Link to={pageURL('admin')}>Mở thư mục ảnh CMS</Link>
        </p>
      )}
      <MediaUpload disabled={!state.writesEnabled || busy} />
      <nav className="admin-breadcrumbs" aria-label="Thư mục ảnh">
        <Link to={pageURL('')}>Tất cả thư mục</Link>
        <Link to={pageURL(`admin`)}>Ảnh CMS</Link>
        {state.prefix && (
          <>
            <span>{state.prefix}</span>
            <Link to={pageURL(state.prefix.split('/').slice(0, -1).join('/'))}>
              Thư mục cha
            </Link>
          </>
        )}
      </nav>
      {state.objects.length ? (
        <div className="admin-media-grid">
          {state.objects.map((object) => (
            <article className="admin-card" key={object.path}>
              {object.folder ? (
                <Link to={pageURL(object.path)}>📁 {object.name}</Link>
              ) : (
                <>
                  <img
                    src={`${object.url!}&width=320`}
                    decoding="async"
                    alt={object.name}
                    loading="lazy"
                  />
                  <p>{object.name}</p>
                  <label>
                    Đường dẫn để đính kèm
                    <input
                      readOnly
                      value={`${state.bucket}/${object.path}`}
                      onFocus={(event) => event.target.select()}
                    />
                  </label>
                  <a
                    href={object.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Mở ảnh
                  </a>
                  {state.bucket === 'draft-media' &&
                    object.path.startsWith('admin/') && (
                      <Form
                        method="post"
                        onSubmit={(event) => {
                          if (
                            !window.confirm(
                              'Xóa vĩnh viễn ảnh chưa sử dụng? Thao tác không thể hoàn tác.',
                            )
                          )
                            event.preventDefault();
                        }}
                      >
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="path" value={object.path} />
                        <label className="admin-radio">
                          <input
                            type="checkbox"
                            name="confirm"
                            value="delete"
                            required
                            disabled={!state.writesEnabled || busy}
                          />
                          Xác nhận xóa ảnh
                        </label>
                        <button disabled={!state.writesEnabled || busy}>
                          Xóa ảnh chưa sử dụng
                        </button>
                      </Form>
                    )}
                </>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="admin-card">Thư mục chưa có ảnh.</p>
      )}
      <nav className="admin-pagination" aria-label="Phân trang ảnh">
        {state.page > 1 && (
          <Link to={pageURL(state.prefix, state.page - 1)}>Trang trước</Link>
        )}
        <span>Trang {state.page}</span>
        {state.hasMore && (
          <Link to={pageURL(state.prefix, state.page + 1)}>Trang sau</Link>
        )}
      </nav>
    </>
  );
}
