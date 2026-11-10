import {
  deriveLifecycle,
  canTransition,
  scheduleInstant,
  type LifecycleState,
} from '@sacute/shared';
import type { PostRow } from '@sacute/shared/content';
export interface AdminPostRow extends PostRow {
  lifecycle_revision: string;
  updated_at: string | null;
  deleted_by: string | null;
  publication_recorded: boolean | null;
}
export const kinds = ['information', 'scholarship', 'event'] as const;
export const statuses = ['draft', 'published', 'archived'] as const;
export interface AdminMedia {
  id?: string;
  bucket?: 'post-media' | 'draft-media';
  storage_path: string;
  alt_text: string;
  width: number | null;
  height: number | null;
  is_cover: boolean;
}
export const mediaBuckets = ['post-media', 'draft-media'] as const;
export type MediaBucket = (typeof mediaBuckets)[number];
export function mediaReference(value: string): {
  bucket: MediaBucket;
  storage_path: string;
} {
  const bucket = value.startsWith('draft-media/')
    ? 'draft-media'
    : 'post-media';
  const storage_path = value.startsWith(`${bucket}/`)
    ? value.slice(bucket.length + 1)
    : value;
  if (!validStoragePath(storage_path)) throw new Error('Invalid media path');
  return { bucket, storage_path };
}
export function mediaPreviewUrl(bucket: string, path: string) {
  return `/admin/media/file?${new URLSearchParams({ bucket, path })}`;
}
export const editablePostFields = [
  'title',
  'slug',
  'summary',
  'content',
  'category',
  'kind',
  'tags',
  'status',
  'published_on',
  'published_at',
  'published_at_precision',
  'visible_from',
  'source_url',
  'event_name',
  'content_format',
] as const;
export const relationOne = <T>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;
export function editSnapshot(row: PostRow) {
  return {
    post: Object.fromEntries(editablePostFields.map((key) => [key, row[key]])),
    scholarship: relationOne(row.scholarship_details),
    event: relationOne(row.event_details),
    media: [...row.post_media].sort((a, b) => a.id.localeCompare(b.id)),
  };
}
export function validStoragePath(value: string) {
  return (
    value.length > 0 &&
    value.length <= 512 &&
    !value.startsWith('/') &&
    !/[\\?#%]/.test(value) &&
    ![...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) &&
    value.split('/').every((p) => p && p !== '.' && p !== '..')
  );
}
export class ValidationError extends Error {
  fields: Record<string, string>;
  constructor(fields: Record<string, string>) {
    super('Vui lòng kiểm tra các trường được đánh dấu.');
    this.fields = fields;
  }
}
export function validatePostForm(
  form: FormData,
  options: { current?: AdminPostRow | null; now?: Date } = {},
) {
  const errors: Record<string, string> = {};
  const text = (name: string, max: number, required = false) => {
    const value =
      typeof form.get(name) === 'string' ? String(form.get(name)).trim() : '';
    if ((required && !value) || value.length > max)
      errors[name] =
        required && !value ? 'Trường này là bắt buộc.' : `Tối đa ${max} ký tự.`;
    return value;
  };
  const nullable = (value: string) => value || null;
  const url = (name: string) => {
    const value = text(name, 2048);
    if (value) {
      try {
        const parsed = new URL(value);
        if (
          !['https:', 'http:'].includes(parsed.protocol) ||
          parsed.username ||
          parsed.password
        )
          throw new Error();
      } catch {
        errors[name] = 'Sử dụng URL HTTP hoặc HTTPS hợp lệ.';
      }
    }
    return nullable(value);
  };
  const date = (name: string) => {
    const value = text(name, 40);
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      errors[name] = 'Ngày không hợp lệ.';
    return nullable(value);
  };
  const instant = (name: string) => {
    const value = text(name, 40);
    if (!value) return null;
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) ||
      !Number.isFinite(Date.parse(value)) ||
      !Number.isFinite(Date.parse(value.slice(0, 10))) ||
      new Date(value.slice(0, 10)).toISOString().slice(0, 10) !==
        value.slice(0, 10)
    ) {
      errors[name] =
        'Dùng thời điểm ISO 8601 kèm múi giờ, ví dụ 2026-11-10T09:00:00+07:00.';
      return null;
    }
    return new Date(value).toISOString();
  };
  const kind = text('kind', 30);
  if (!kinds.includes(kind as (typeof kinds)[number]))
    errors.kind = 'Loại bài không hợp lệ.';
  const intent = text('intent', 20);
  const now = options.now ?? new Date();
  const current = options.current;
  const state: LifecycleState = current
    ? deriveLifecycle(current, now)
    : 'draft';
  if (
    !['save', 'draft', 'publish', 'schedule', 'reschedule'].includes(intent) ||
    !canTransition(state, intent)
  )
    errors.intent = 'Thao tác không phù hợp với trạng thái hiện tại.';
  let visible_from = intent === 'save' ? (current?.visible_from ?? null) : null;
  const status =
    intent === 'save'
      ? (current?.status ?? 'draft')
      : intent === 'draft'
        ? 'draft'
        : 'published';
  const timezone = text('timezone', 64) || 'Asia/Ho_Chi_Minh';
  let schedule_local: string | null = null;
  if (intent === 'schedule' || intent === 'reschedule') {
    const day = text('schedule_date', 10),
      time = text('schedule_time', 5);
    schedule_local = `${day}T${time}`;
    try {
      visible_from = scheduleInstant(day, time, timezone);
      if (Date.parse(visible_from) <= now.getTime())
        errors.schedule = 'Thời điểm hẹn đăng phải ở tương lai.';
    } catch {
      errors.schedule = 'Ngày, giờ hoặc múi giờ hẹn đăng không hợp lệ.';
    }
  }
  const slug = text('slug', 180, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    errors.slug = 'Dùng chữ thường không dấu, số và dấu gạch ngang.';
  let published_at = instant('published_at');
  let published_on = date('published_on');
  let published_at_precision = text('published_at_precision', 12) || null;
  if (!published_on && !published_at && status !== 'published')
    published_at_precision = null;
  if (
    published_at_precision &&
    !['date', 'datetime'].includes(published_at_precision)
  )
    errors.published_at_precision = 'Độ chính xác ngày không hợp lệ.';
  const edit_publication_date = form.get('edit_publication_date') === 'yes';
  if (current && !edit_publication_date) {
    published_at = current.published_at;
    published_on = current.published_on;
    published_at_precision = current.published_at_precision;
    delete errors.published_at;
    delete errors.published_on;
    delete errors.published_at_precision;
  }
  const recorded = current
    ? (current.publication_recorded ??
        Boolean(current.published_at || current.published_on)) ||
      state === 'published'
    : false;
  if (
    !recorded &&
    !edit_publication_date &&
    ['publish', 'schedule', 'reschedule'].includes(intent)
  ) {
    published_at = intent === 'publish' ? now.toISOString() : visible_from;
    published_on = published_at
      ? new Date(Date.parse(published_at) + 420 * 60000)
          .toISOString()
          .slice(0, 10)
      : null;
    published_at_precision = published_at ? 'datetime' : null;
  }
  if (edit_publication_date && !published_on)
    errors.published_on = 'Cần nhập ngày khi biên tập ngày công bố.';
  if (status === 'published' && !published_on)
    errors.published_on = 'Bài xuất bản cần ngày công bố.';
  if (published_on && !published_at_precision)
    errors.published_at_precision = 'Chọn ngày hoặc thời điểm công bố.';
  if (published_at_precision === 'date' && !published_on)
    errors.published_on = 'Chọn ngày công bố.';
  if (published_at_precision === 'datetime') {
    if (!published_at) errors.published_at = 'Nhập thời điểm công bố.';
    else {
      const vietnamDay = new Date(Date.parse(published_at) + 7 * 3600000)
        .toISOString()
        .slice(0, 10);
      if (published_on !== vietnamDay)
        errors.published_on =
          'Ngày phải khớp thời điểm công bố theo giờ Việt Nam.';
    }
  }
  const post = {
    title: text('title', 300, true),
    slug,
    summary: text('summary', 2000, true),
    content: text('content', 120000, true),
    category: text('category', 100, true),
    kind,
    status,
    content_format: text('content_format', 20) || 'plain-text',
    event_name: nullable(text('event_name', 300)),
    tags: [
      ...new Set(
        text('tags', 2000)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ],
    source_url: url('source_url'),
    published_on,
    published_at: published_at_precision === 'datetime' ? published_at : null,
    published_at_precision,
    visible_from,
  };
  if (!['plain-text', 'markdown'].includes(post.content_format))
    errors.content_format = 'Định dạng không hợp lệ.';
  if (post.tags.length > 30 || post.tags.some((t) => t.length > 80))
    errors.tags = 'Tối đa 30 thẻ, mỗi thẻ 80 ký tự.';
  const scholarship =
    kind === 'scholarship'
      ? {
          provider: nullable(text('provider', 300)),
          eligibility: nullable(text('eligibility', 5000)),
          opens_at: instant('opens_at'),
          closes_at: instant('closes_at'),
          application_url: url('application_url'),
          lifecycle_status: text('scholarship_status', 20),
        }
      : null;
  if (scholarship) {
    if (!['upcoming', 'open', 'closed'].includes(scholarship.lifecycle_status))
      errors.scholarship_status = 'Chọn trạng thái học bổng.';
    if (
      scholarship.opens_at &&
      scholarship.closes_at &&
      scholarship.opens_at > scholarship.closes_at
    )
      errors.closes_at = 'Đóng đơn phải sau mở đơn.';
  }
  const event =
    kind === 'event'
      ? {
          starts_at: instant('starts_at'),
          ends_at: instant('ends_at'),
          starts_on: date('starts_on'),
          ends_on: date('ends_on'),
          location: nullable(text('location', 500)),
          registration_url: url('registration_url'),
          lifecycle_status: text('event_status', 20),
        }
      : null;
  if (event) {
    if (!['upcoming', 'ongoing', 'ended'].includes(event.lifecycle_status))
      errors.event_status = 'Chọn trạng thái sự kiện.';
    if (event.starts_at && event.ends_at && event.starts_at > event.ends_at)
      errors.ends_at = 'Kết thúc phải sau bắt đầu.';
    if (event.starts_on && event.ends_on && event.starts_on > event.ends_on)
      errors.ends_on = 'Kết thúc phải sau bắt đầu.';
    if (event.starts_at && event.starts_on)
      errors.starts_on = 'Chọn ngày hoặc thời điểm bắt đầu, không dùng cả hai.';
    if (event.ends_at && event.ends_on)
      errors.ends_on = 'Chọn ngày hoặc thời điểm kết thúc, không dùng cả hai.';
  }
  let media: AdminMedia[] = [];
  try {
    const parsed: unknown = JSON.parse(text('media', 70000) || '[]');
    if (!Array.isArray(parsed) || parsed.length > 100) throw new Error();
    media = parsed.map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new Error();
      const m = item as Record<string, unknown>;
      const bucket = m.bucket ?? 'post-media';
      if (!mediaBuckets.includes(bucket as MediaBucket)) throw new Error();
      if (
        typeof m.storage_path !== 'string' ||
        !validStoragePath(m.storage_path) ||
        typeof m.alt_text !== 'string' ||
        m.alt_text.length > 500 ||
        typeof m.is_cover !== 'boolean'
      )
        throw new Error();
      const dimension = (value: unknown) => {
        if (value === null || value === undefined) return null;
        if (
          !Number.isInteger(value) ||
          Number(value) < 1 ||
          Number(value) > 100000
        )
          throw new Error();
        return Number(value);
      };
      return {
        bucket: bucket as MediaBucket,
        storage_path: m.storage_path,
        alt_text: m.alt_text,
        width: dimension(m.width),
        height: dimension(m.height),
        is_cover: m.is_cover,
      };
    });
    if (
      new Set(media.map((m) => `${m.bucket}/${m.storage_path}`)).size !==
        media.length ||
      media.filter((m) => m.is_cover).length > 1 ||
      (media.length && !media.some((m) => m.is_cover))
    )
      throw new Error();
  } catch {
    errors.media =
      'Danh sách ảnh không hợp lệ. Chọn tối đa 100 ảnh và đúng một ảnh bìa.';
  }
  const revision = text('revision', 36) || null;
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return {
    post,
    scholarship,
    event,
    media,
    intent,
    schedule_local,
    timezone,
    edit_publication_date,
    revision,
  };
}
export type PostInput = ReturnType<typeof validatePostForm>;
