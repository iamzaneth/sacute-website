import { useState } from 'react';
import { Form, Link, useNavigation, useSearchParams } from 'react-router';
import {
  deriveLifecycle,
  lifecycleLabels,
  formatSchedule,
} from '@sacute/shared';
import { ScheduleFields, LifecycleControls } from './lifecycle-controls';
import {
  editSnapshot,
  relationOne,
  mediaReference,
  mediaPreviewUrl,
  type MediaBucket,
  type AdminMedia,
  type AdminPostRow,
} from './model';
import { kindLabels } from '../../routes/admin-posts';

export function PostEditor({
  post,
  choices,
  mediaBaseUrl,
  writesEnabled,
  now,
  errors = {},
}: {
  post: AdminPostRow | null;
  choices: string[];
  mediaBaseUrl: string;
  writesEnabled: boolean;
  now: string;
  errors?: Record<string, string>;
}) {
  const state = post ? deriveLifecycle(post, now) : 'draft';
  const editable = !['archived', 'trashed'].includes(state);
  const [editDate, setEditDate] = useState(false);
  const [kind, setKind] = useState(post?.kind ?? 'information');
  const [media, setMedia] = useState<AdminMedia[]>(() =>
    [...(post?.post_media ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({
        ...m,
        bucket: m.bucket as MediaBucket,
        alt_text: m.alt_text ?? '',
      })),
  );
  const [path, setPath] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [dirty, setDirty] = useState(false);
  const navigation = useNavigation();
  const [params] = useSearchParams();
  const scholarship = post && relationOne(post.scholarship_details);
  const event = post && relationOne(post.event_details);
  const busy = navigation.state !== 'idle';
  const field = (
    name: string,
    label: string,
    value: string | null | undefined = '',
    options: {
      required?: boolean;
      type?: string;
      multiline?: boolean;
      max?: number;
      help?: string;
      readOnly?: boolean;
    } = {},
  ) => (
    <label className={options.multiline ? 'admin-wide' : ''}>
      {label}
      {options.required && ' *'}
      {options.multiline ? (
        <textarea
          name={name}
          defaultValue={value ?? ''}
          required={options.required}
          maxLength={options.max}
          rows={name === 'content' ? 16 : 3}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `${name}-error` : undefined}
        />
      ) : (
        <input
          name={name}
          type={options.type ?? 'text'}
          defaultValue={value ?? ''}
          required={options.required}
          maxLength={options.max}
          readOnly={options.readOnly}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `${name}-error` : undefined}
        />
      )}
      {options.help && <small>{options.help}</small>}
      {errors[name] && (
        <span id={`${name}-error`} className="admin-field-error">
          {errors[name]}
        </span>
      )}
    </label>
  );
  const move = (index: number, direction: number) =>
    setMedia((current) => {
      const next = [...current];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
  return (
    <>
      <div className="admin-title">
        <h1>{post ? 'Biên tập bài viết' : 'Tạo bài viết'}</h1>
        <Link to="/admin/posts">Danh sách bài viết</Link>
      </div>
      {params.has('saved') && !dirty && !busy && (
        <p className="admin-success" role="status">
          Đã lưu bài viết thành công.
        </p>
      )}
      {Object.keys(errors).length > 0 && (
        <div className="admin-errors" role="alert">
          <strong>Chưa lưu bài viết.</strong>
          <ul>
            {Object.entries(errors).map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <Form
        method="post"
        className="admin-form"
        onChange={() => setDirty(true)}
      >
        <input
          type="hidden"
          name="revision"
          value={post?.lifecycle_revision ?? ''}
        />
        <input
          type="hidden"
          name="expected"
          value={post ? JSON.stringify(editSnapshot(post)) : ''}
        />
        <input type="hidden" name="media" value={JSON.stringify(media)} />
        <fieldset disabled={!writesEnabled || busy || !editable}>
          <legend>Nội dung bài viết</legend>
          <div className="admin-fields">
            {field('title', 'Tiêu đề', post?.title, {
              required: true,
              max: 300,
            })}
            {field('slug', 'Slug', post?.slug, {
              required: true,
              max: 180,
              readOnly: Boolean(post),
              help: post
                ? 'Giữ nguyên slug để bảo toàn URL hiện có.'
                : 'Ví dụ: hoc-bong-sinh-vien-2026',
            })}
            <label>
              Loại bài
              <select
                name="kind"
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as AdminPostRow['kind'])
                }
              >
                {Object.entries(kindLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {field('category', 'Danh mục', post?.category, {
              required: true,
              max: 100,
            })}
            {field('summary', 'Tóm tắt', post?.summary, {
              required: true,
              multiline: true,
              max: 2000,
            })}
            {field('content', 'Nội dung', post?.content, {
              required: true,
              multiline: true,
              max: 120000,
            })}
            <label>
              Định dạng nội dung
              <select
                name="content_format"
                defaultValue={post?.content_format ?? 'plain-text'}
              >
                <option value="plain-text">Văn bản</option>
                <option value="markdown">Markdown (hiển thị nguyên văn)</option>
              </select>
            </label>
            {field(
              'tags',
              'Thẻ (phân cách bằng dấu phẩy)',
              post?.tags?.join(', '),
              { max: 2000 },
            )}
            {field('source_url', 'URL nguồn', post?.source_url, {
              type: 'url',
              max: 2048,
            })}
          </div>
        </fieldset>
        <fieldset disabled={!writesEnabled || busy || !editable}>
          <legend>Xuất bản</legend>
          <p>
            Trạng thái: <strong>{lifecycleLabels[state]}</strong>
            {state === 'scheduled' &&
              ` · ${formatSchedule(post?.visible_from ?? null)}`}
          </p>
          <label className="admin-radio">
            <input
              type="checkbox"
              name="edit_publication_date"
              value="yes"
              checked={editDate}
              onChange={(e) => setEditDate(e.target.checked)}
            />
            Chỉnh sửa ngày công bố (thao tác biên tập)
          </label>
          {editDate && (
            <div className="admin-fields">
              <label>
                Độ chính xác ngày công bố
                <select
                  name="published_at_precision"
                  defaultValue={post?.published_at_precision ?? 'date'}
                >
                  <option value="date">Chỉ có ngày</option>
                  <option value="datetime">Thời điểm chính xác</option>
                </select>
              </label>
              {field(
                'published_on',
                'Ngày công bố (giờ Việt Nam)',
                post?.published_on,
                { type: 'date' },
              )}
              {field(
                'published_at',
                'Thời điểm công bố (ISO 8601)',
                post?.published_at,
                {
                  help: 'Dùng thời điểm có múi giờ; ngày phải khớp giờ Việt Nam.',
                },
              )}
            </div>
          )}
          {!editDate && (
            <p>
              Ngày công bố mới được ghi bằng giờ cơ sở dữ liệu. Ngày công bố
              lịch sử được giữ nguyên.
            </p>
          )}
          {(state === 'draft' || state === 'scheduled') && (
            <details open={state === 'scheduled'}>
              <summary>
                {state === 'scheduled' ? 'Đổi lịch đăng' : 'Hẹn giờ đăng bài'}
              </summary>
              <ScheduleFields
                visibleFrom={post?.visible_from ?? null}
                now={now}
              />
              <button
                name="intent"
                value={state === 'scheduled' ? 'reschedule' : 'schedule'}
              >
                {state === 'scheduled' ? 'Đổi lịch' : 'Hẹn giờ đăng'}
              </button>
            </details>
          )}
        </fieldset>
        {kind === 'scholarship' && (
          <fieldset disabled={!writesEnabled || busy || !editable}>
            <legend>Chi tiết học bổng</legend>
            <div className="admin-fields">
              {field('provider', 'Đơn vị cấp', scholarship?.provider, {
                max: 300,
              })}
              {field('eligibility', 'Điều kiện', scholarship?.eligibility, {
                multiline: true,
                max: 5000,
              })}
              {field('opens_at', 'Mở đơn (ISO 8601)', scholarship?.opens_at)}
              {field(
                'closes_at',
                'Đóng đơn (ISO 8601)',
                scholarship?.closes_at,
              )}
              {field(
                'application_url',
                'URL ứng tuyển',
                scholarship?.application_url,
                { type: 'url' },
              )}
              <label>
                Trạng thái học bổng
                <select
                  name="scholarship_status"
                  defaultValue={scholarship?.lifecycle_status ?? 'upcoming'}
                >
                  <option value="upcoming">Sắp mở</option>
                  <option value="open">Đang mở</option>
                  <option value="closed">Đã đóng</option>
                </select>
              </label>
            </div>
          </fieldset>
        )}
        {kind === 'event' && (
          <fieldset disabled={!writesEnabled || busy || !editable}>
            <legend>Chi tiết sự kiện</legend>
            <div className="admin-fields">
              {field('event_name', 'Tên chương trình', post?.event_name, {
                max: 300,
              })}
              {field('starts_on', 'Ngày bắt đầu', event?.starts_on, {
                type: 'date',
              })}
              {field('ends_on', 'Ngày kết thúc', event?.ends_on, {
                type: 'date',
              })}
              {field(
                'starts_at',
                'Thời điểm bắt đầu (ISO 8601)',
                event?.starts_at,
                { help: 'Dùng thời điểm hoặc ngày, không điền cả hai.' },
              )}
              {field(
                'ends_at',
                'Thời điểm kết thúc (ISO 8601)',
                event?.ends_at,
              )}
              {field('location', 'Địa điểm', event?.location, { max: 500 })}
              {field(
                'registration_url',
                'URL đăng ký',
                event?.registration_url,
                { type: 'url' },
              )}
              <label>
                Trạng thái sự kiện
                <select
                  name="event_status"
                  defaultValue={event?.lifecycle_status ?? 'upcoming'}
                >
                  <option value="upcoming">Sắp diễn ra</option>
                  <option value="ongoing">Đang diễn ra</option>
                  <option value="ended">Đã kết thúc</option>
                </select>
              </label>
            </div>
          </fieldset>
        )}
        <fieldset disabled={!writesEnabled || busy || !editable}>
          <legend>Ảnh bìa và thư viện</legend>
          <p>
            Chọn đường dẫn ảnh có sẵn trong{' '}
            <Link to="/admin/media" target="_blank" rel="noopener">
              thư viện ảnh
            </Link>
            . Ảnh mới được giữ riêng tư cho đến khi bài hiển thị công khai; khi
            ẩn bài, ảnh riêng tư ngừng được phục vụ. Ảnh công khai cũ vẫn có URL
            công khai.
          </p>
          <div className="admin-attach">
            <label>
              Đường dẫn ảnh
              <input
                list="media-choices"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                maxLength={512}
                placeholder="admin/ten-anh.png"
              />
              <datalist id="media-choices">
                {choices.map((choice) => (
                  <option key={choice} value={choice} />
                ))}
              </datalist>
            </label>
            <button
              type="button"
              onClick={() => {
                try {
                  mediaReference(path.trim());
                } catch {
                  setMediaError('Đường dẫn ảnh không hợp lệ.');
                  return;
                }
                if (
                  !path.trim() ||
                  media.some(
                    (m) =>
                      `${m.bucket}/${m.storage_path}` === path.trim() ||
                      (m.bucket === 'post-media' &&
                        m.storage_path === path.trim()),
                  )
                ) {
                  setMediaError('Chọn một đường dẫn ảnh chưa có trong bài.');
                  return;
                }
                setMedia([
                  ...media,
                  {
                    ...mediaReference(path.trim()),
                    alt_text: '',
                    width: null,
                    height: null,
                    is_cover: media.length === 0,
                  },
                ]);
                setPath('');
                setMediaError('');
                setDirty(true);
              }}
            >
              Thêm ảnh
            </button>
          </div>
          {mediaError && <p role="alert">{mediaError}</p>}
          {!media.length && <p>Chưa có ảnh đính kèm.</p>}
          <ol className="admin-attached">
            {media.map((item, index) => (
              <li key={`${item.bucket}/${item.storage_path}`}>
                <img
                  src={
                    item.bucket === 'draft-media'
                      ? mediaPreviewUrl(item.bucket, item.storage_path)
                      : `${mediaBaseUrl}/${item.storage_path.split('/').map(encodeURIComponent).join('/')}`
                  }
                  alt=""
                  loading="lazy"
                />
                <div>
                  <p>
                    {item.bucket}/{item.storage_path}
                  </p>
                  <label>
                    Mô tả ảnh
                    <input
                      aria-label={`Mô tả ảnh ${index + 1}`}
                      value={item.alt_text}
                      maxLength={500}
                      onChange={(event) =>
                        setMedia(
                          media.map((m, i) =>
                            i === index
                              ? { ...m, alt_text: event.target.value }
                              : m,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="admin-radio">
                    <input
                      type="radio"
                      name="cover-choice"
                      checked={item.is_cover}
                      onChange={() =>
                        setMedia(
                          media.map((m, i) => ({
                            ...m,
                            is_cover: i === index,
                          })),
                        )
                      }
                    />
                    Ảnh bìa
                  </label>
                  <div className="admin-actions">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={`Chuyển ảnh ${index + 1} lên`}
                    >
                      Lên
                    </button>
                    <button
                      type="button"
                      disabled={index === media.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={`Chuyển ảnh ${index + 1} xuống`}
                    >
                      Xuống
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Gỡ ảnh khỏi bài viết? Tệp trong thư viện vẫn được giữ.',
                          )
                        )
                          return;
                        const next = media.filter((_, i) => i !== index);
                        if (item.is_cover && next[0])
                          next[0] = { ...next[0], is_cover: true };
                        setMedia(next);
                        setDirty(true);
                      }}
                    >
                      Gỡ ảnh
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </fieldset>
        <div className="admin-actions admin-save">
          {editable && (
            <button
              className="button button-primary"
              name="intent"
              value={state === 'draft' ? 'draft' : 'save'}
              disabled={!writesEnabled || busy}
            >
              {state === 'draft' ? 'Lưu bản nháp' : 'Lưu thay đổi'}
            </button>
          )}
          {(state === 'draft' || state === 'scheduled') && (
            <button
              name="intent"
              value="publish"
              disabled={!writesEnabled || busy}
            >
              Đăng ngay
            </button>
          )}
        </div>
        {busy && <p role="status">Đang lưu bài viết…</p>}
      </Form>
      {post && dirty && (
        <p role="status">
          Lưu thay đổi nội dung trước khi đổi trạng thái bài viết.
        </p>
      )}
      {post && (
        <LifecycleControls
          key={`${post.id}/${post.lifecycle_revision}/${state}`}
          post={post}
          state={state}
          now={now}
          disabled={!writesEnabled || busy || dirty}
          from="editor"
        />
      )}
    </>
  );
}
