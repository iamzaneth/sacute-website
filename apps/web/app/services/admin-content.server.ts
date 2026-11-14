import { ImageWorkBusyError } from './image-work.server';
import {
  postSelection,
  queryRPCEnabled,
  SupabaseContentRepository,
} from '@sacute/shared/content';
import {
  deriveLifecycle,
  lifecycleStates,
  canTransition,
  lifecycleConfirmations,
  scheduleInstant,
  type LifecycleState,
} from '@sacute/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { data, redirect } from 'react-router';
import {
  kinds,
  type AdminPostRow,
  validatePostForm,
  ValidationError,
  validStoragePath,
  mediaBuckets,
  mediaPreviewUrl,
  type MediaBucket,
} from '../features/admin/model';
import {
  requireAdminMutation,
  readAdminForm,
  type AdminContext,
} from './admin-auth.server';

import { normalizeImage } from './admin-image.server';
export class AdminDataError extends Error {}
function check<T>(result: { data: T; error: unknown }): T {
  if (result.error)
    throw new AdminDataError('Không thể đọc dữ liệu. Kiểm tra kết nối và RLS.');
  return result.data;
}
export class AdminContentRepository {
  constructor(private readonly db: SupabaseClient) {}
  now() {
    return new SupabaseContentRepository(this.db).databaseTime();
  }
  async list(request: Request, authoritativeNow?: Date) {
    const params = new URL(request.url).searchParams;
    const q = params.get('q')?.trim() ?? '',
      kind = params.get('kind') ?? '',
      status = params.get('status') ?? '';
    const page = Number(params.get('page') ?? 1);
    if (
      q.length > 200 ||
      (kind && !kinds.includes(kind as (typeof kinds)[number])) ||
      (status && !lifecycleStates.includes(status as LifecycleState)) ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 100000
    )
      throw new Response('Bộ lọc không hợp lệ.', { status: 400 });
    const now = authoritativeNow ?? (await this.now());
    let query = this.db
      .from('posts')
      .select(
        'id,slug,title,kind,status,category,published_on,visible_from,deleted_at,updated_at,lifecycle_revision',
        { count: 'exact' },
      );
    query =
      status === 'trashed'
        ? query.not('deleted_at', 'is', null)
        : query.is('deleted_at', null);
    if (status === 'scheduled')
      query = query
        .eq('status', 'published')
        .gt('visible_from', now.toISOString());
    else if (status === 'published')
      query = query
        .eq('status', 'published')
        .or(`visible_from.is.null,visible_from.lte.${now.toISOString()}`);
    else if (status && status !== 'trashed') query = query.eq('status', status);
    if (kind) query = query.eq('kind', kind);
    if (q) query = query.ilike('title', `%${q.replace(/[\\%_*]/g, '\\$&')}%`);
    const result = await query
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('id')
      .range((page - 1) * 20, page * 20 - 1);
    const posts = (
      check(result) as Pick<
        AdminPostRow,
        | 'id'
        | 'slug'
        | 'title'
        | 'kind'
        | 'status'
        | 'category'
        | 'published_on'
        | 'visible_from'
        | 'deleted_at'
        | 'updated_at'
        | 'lifecycle_revision'
      >[]
    ).map((post) => ({ ...post, lifecycle: deriveLifecycle(post, now) }));
    return {
      posts,
      total: result.count ?? 0,
      page,
      q,
      kind,
      status,
      now: now.toISOString(),
    };
  }
  async get(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new Response('Không tìm thấy bài viết.', { status: 404 });
    const row = check(
      await this.db
        .from('posts')
        .select(
          `${postSelection},lifecycle_revision,updated_at,deleted_by,publication_recorded`,
        )
        .eq('id', id)
        .maybeSingle(),
    ) as unknown as AdminPostRow | null;
    if (!row) throw new Response('Không tìm thấy bài viết.', { status: 404 });
    if (
      !kinds.includes(row.kind) ||
      !Array.isArray(row.post_media) ||
      !row.lifecycle_revision
    )
      throw new AdminDataError(
        'Dữ liệu hoặc migration lifecycle chưa sẵn sàng.',
      );
    return row;
  }
  async counts(): Promise<Record<string, number>> {
    if (queryRPCEnabled()) {
      const result = await this.db.rpc('sacute_admin_counts');
      const counts = check(result);
      if (!counts || typeof counts !== 'object' || Array.isArray(counts))
        throw new AdminDataError('Invalid counts');
      return Object.fromEntries(
        lifecycleStates.map((status) => {
          const count = counts[status] ?? 0;
          if (!Number.isSafeInteger(count) || count < 0)
            throw new AdminDataError('Invalid count');
          return [status, count];
        }),
      );
    }
    const now = await this.now();
    const result = await Promise.all(
      lifecycleStates.map(async (status) => {
        let query = this.db
          .from('posts')
          .select('id', { count: 'exact', head: true });
        query =
          status === 'trashed'
            ? query.not('deleted_at', 'is', null)
            : query.is('deleted_at', null);
        if (status === 'scheduled')
          query = query
            .eq('status', 'published')
            .gt('visible_from', now.toISOString());
        else if (status === 'published')
          query = query
            .eq('status', 'published')
            .or(`visible_from.is.null,visible_from.lte.${now.toISOString()}`);
        else if (status !== 'trashed') query = query.eq('status', status);
        const result = await query;
        check(result);
        if (result.count === null) throw new AdminDataError('Missing count');
        return [status, result.count];
      }),
    );
    return Object.fromEntries(result);
  }
  async media(prefix = '', page = 1, bucket: string = 'draft-media') {
    if (
      !mediaBuckets.includes(bucket as MediaBucket) ||
      (prefix && !validStoragePath(prefix)) ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000
    )
      throw new Response('Thư mục không hợp lệ.', { status: 400 });
    const objects =
      check(
        await this.db.storage.from(bucket).list(prefix, {
          limit: 51,
          offset: (page - 1) * 50,
          sortBy: { column: 'name', order: 'asc' },
        }),
      ) ?? [];
    return {
      objects: objects.slice(0, 50).map((object) => {
        const path = prefix ? `${prefix}/${object.name}` : object.name;
        return {
          name: object.name,
          path,
          folder: !object.id,
          url: object.id ? mediaPreviewUrl(bucket, path) : null,
        };
      }),
      prefix,
      bucket: bucket as MediaBucket,
      page,
      hasMore: objects.length > 50,
    };
  }
}
export async function savePostAction(
  request: Request,
  id: string | null,
  requestContext: object,
) {
  const context = await requireAdminMutation(request, requestContext);
  const form = await readAdminForm(request, undefined, context.headers);
  try {
    const repository = new AdminContentRepository(context.db);
    const [current, now] = await Promise.all([
      id ? repository.get(id) : Promise.resolve(null),
      repository.now(),
    ]);
    const payload = validatePostForm(form, { current, now });
    let expected: unknown = null;
    if (id) {
      try {
        expected = JSON.parse(String(form.get('expected') ?? ''));
      } catch {
        throw new ValidationError({
          form: 'Thiếu phiên bản bài viết. Tải lại trang trước khi lưu.',
        });
      }
      if (!expected || typeof expected !== 'object')
        throw new ValidationError({ form: 'Thiếu phiên bản bài viết.' });
    }
    const result = await context.db.rpc('admin_save_post', {
      p_id: id,
      p_input: payload,
      p_expected: expected,
    });
    if (result.error) {
      const message =
        result.error.code === '23505'
          ? 'Slug hoặc đường dẫn ảnh đã được sử dụng. Chọn giá trị khác.'
          : result.error.code === '40001'
            ? 'Bài đã thay đổi ở phiên khác. Sao chép nội dung đang sửa, tải lại trang và thử lại.'
            : result.error.code === '22023'
              ? 'Dữ liệu, lịch đăng hoặc ảnh chưa hợp lệ. Kiểm tra ngày giờ và ảnh đính kèm.'
              : 'Không thể lưu bài. Kiểm tra kết nối, RLS và migration; nội dung chưa được lưu.';
      return data(
        { errors: { form: message } as Record<string, string> },
        {
          status: result.error.code === '40001' ? 409 : 400,
          headers: context.headers,
        },
      );
    }
    if (
      typeof result.data !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(result.data)
    )
      throw new AdminDataError('Lưu chưa được xác nhận.');
    return redirect(
      `/admin/posts/${result.data}/edit?saved=${crypto.randomUUID()}`,
      {
        status: 303,
        headers: context.headers,
      },
    );
  } catch (error) {
    if (error instanceof Response) throw error;
    return data(
      {
        errors:
          error instanceof ValidationError
            ? error.fields
            : { form: 'Không thể lưu bài. Vui lòng thử lại.' },
      },
      {
        status: error instanceof ValidationError ? 422 : 503,
        headers: context.headers,
      },
    );
  }
}
export async function lifecycleAction(
  request: Request,
  requestContext: object,
) {
  const context = await requireAdminMutation(request, requestContext);
  const form = await readAdminForm(request, 16384, context.headers);
  try {
    const id = String(form.get('id') ?? ''),
      intent = String(form.get('intent') ?? ''),
      revision = String(form.get('revision') ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(revision))
      throw new ValidationError({
        form: 'Thiếu định danh hoặc phiên bản bài viết. Tải lại trang.',
      });
    if (intent === 'permanent_delete')
      return data(
        {
          errors: {
            form: 'Xóa vĩnh viễn đang bị vô hiệu hóa: chưa xác minh an toàn FK và Storage.',
          },
        },
        { status: 501, headers: context.headers },
      );
    const repository = new AdminContentRepository(context.db);
    const [post, now] = await Promise.all([
      repository.get(id),
      repository.now(),
    ]);
    if (
      !canTransition(deriveLifecycle(post, now), intent) ||
      intent === 'save' ||
      intent === 'draft'
    )
      throw new ValidationError({
        form: 'Thao tác không phù hợp với trạng thái hiện tại. Tải lại trang.',
      });
    if (lifecycleConfirmations[intent] && form.get('confirmed') !== 'yes')
      throw new ValidationError({ form: 'Cần xác nhận thao tác.' });
    let schedule_local = null;
    const timezone = String(form.get('timezone') ?? 'Asia/Ho_Chi_Minh');
    if (intent === 'schedule' || intent === 'reschedule') {
      const day = String(form.get('schedule_date') ?? ''),
        time = String(form.get('schedule_time') ?? '');
      try {
        if (Date.parse(scheduleInstant(day, time, timezone)) <= now.getTime())
          throw Error();
      } catch {
        throw new ValidationError({
          form: 'Ngày, giờ hoặc múi giờ không hợp lệ; cần chọn thời điểm tương lai.',
        });
      }
      schedule_local = `${day}T${time}`;
    }
    const result = await context.db.rpc('admin_transition_post', {
      p_id: id,
      p_action: intent,
      p_revision: revision,
      p_schedule_local: schedule_local,
      p_timezone: timezone,
    });
    if (result.error)
      return data(
        {
          errors: {
            form:
              result.error.code === '23505'
                ? 'Slug đã được bài khác sử dụng. Không thể khôi phục.'
                : result.error.code === '40001'
                  ? 'Bài hoặc trạng thái đã thay đổi. Tải lại trang trước khi thao tác.'
                  : 'Không thể thay đổi trạng thái. Kiểm tra lịch đăng, quyền ghi và ảnh riêng tư.',
          },
        },
        {
          status: result.error.code === '40001' ? 409 : 422,
          headers: context.headers,
        },
      );
    if (result.data !== id)
      throw new AdminDataError('Không xác nhận được thay đổi.');
    const target =
      form.get('from') === 'editor'
        ? `/admin/posts/${id}/edit`
        : '/admin/posts';
    return redirect(`${target}?saved=${crypto.randomUUID()}`, {
      status: 303,
      headers: context.headers,
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    return data(
      {
        errors:
          error instanceof ValidationError
            ? error.fields
            : { form: 'Không thể thay đổi trạng thái. Vui lòng thử lại.' },
      },
      {
        status: error instanceof ValidationError ? 422 : 503,
        headers: context.headers,
      },
    );
  }
}
export async function uploadImage(context: AdminContext, file: File) {
  if (!context.writesEnabled)
    throw new Response('CMS đang ở chế độ chỉ đọc.', {
      status: 503,
      headers: context.headers,
    });
  let image;
  try {
    image = await normalizeImage(file);
  } catch (error) {
    if (error instanceof ImageWorkBusyError)
      throw new AdminDataError(
        'Hệ thống đang xử lý nhiều ảnh. Vui lòng thử lại sau.',
      );
    throw new ValidationError({
      file: 'Ảnh không hợp lệ hoặc vượt giới hạn 3 MiB / 16 triệu điểm ảnh.',
    });
  }
  const path = `admin/${context.user.id}/${crypto.randomUUID()}.${image.ext}`;
  const result = await context.db.storage
    .from('draft-media')
    .upload(path, image.bytes, {
      contentType: image.mime,
      upsert: false,
      cacheControl: '0',
    });
  if (result.error)
    throw new AdminDataError(
      'Không thể tải ảnh riêng tư. Kiểm tra kết nối và quyền Storage.',
    );
  return path;
}
