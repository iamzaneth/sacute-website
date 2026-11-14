import { useEffect, useRef, useState } from 'react';
import { MediaLibraryPicker } from '~/features/admin/media/media-library-picker';
import { PostHelp } from './post-help';
import { MediaUpload } from '~/features/admin/media/media-upload';
import { useToast, useToastFeedback } from '~/components/toast/toast';
import {
  Form,
  Link,
  useBlocker,
  useNavigation,
  useSearchParams,
} from 'react-router';
import {
  deriveLifecycle,
  lifecycleLabels,
  formatSchedule,
} from '@sacute/shared';
import { ScheduleFields, LifecycleControls } from './lifecycle-controls';
import {
  validatePostForm,
  ValidationError,
  editSnapshot,
  relationOne,
  mediaReference,
  mediaPreviewUrl,
  type MediaBucket,
  type AdminMedia,
  type AdminPostRow,
} from '~/features/admin/model';
import { kindLabels } from '../model';

const fieldLabels: Record<string, string> = {
  title: 'Tiêu đề',
  slug: 'Slug',
  category: 'Danh mục',
  summary: 'Tóm tắt',
  content: 'Nội dung',
  kind: 'Loại bài',
  content_format: 'Định dạng nội dung',
  tags: 'Thẻ',
  source_url: 'URL nguồn',
  published_on: 'Ngày công bố',
  published_at: 'Thời điểm công bố',
  published_at_precision: 'Độ chính xác ngày công bố',
  schedule: 'Hẹn giờ đăng',
  provider: 'Đơn vị cấp',
  eligibility: 'Điều kiện',
  opens_at: 'Mở đơn',
  closes_at: 'Đóng đơn',
  application_url: 'URL ứng tuyển',
  scholarship_status: 'Trạng thái học bổng',
  event_name: 'Tên chương trình',
  starts_on: 'Ngày bắt đầu',
  ends_on: 'Ngày kết thúc',
  starts_at: 'Thời điểm bắt đầu',
  ends_at: 'Thời điểm kết thúc',
  location: 'Địa điểm',
  registration_url: 'URL đăng ký',
  event_status: 'Trạng thái sự kiện',
  media: 'Ảnh bìa và thư viện',
  intent: 'Thao tác',
};

export function PostEditor({
  post,
  mediaBaseUrl,
  writesEnabled,
  now,
  errors: serverErrors = {},
}: {
  post: AdminPostRow | null;
  mediaBaseUrl: string;
  writesEnabled: boolean;
  now: string;
  errors?: Record<string, string>;
}) {
  const state = post ? deriveLifecycle(post, now) : 'draft';
  const editable = !['archived', 'trashed'].includes(state);
  const [clientErrors, setClientErrors] = useState<Record<
    string,
    string
  > | null>(null);
  const errors = clientErrors ?? serverErrors;
  const errorSummary = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [precision, setPrecision] = useState(
    post?.published_at_precision ?? 'date',
  );
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
  const [uploading, setUploading] = useState(false);
  const navigation = useNavigation();
  const [params] = useSearchParams();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (
        window.confirm(
          'Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?',
        )
      )
        blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  const scholarship = post && relationOne(post.scholarship_details);
  const event = post && relationOne(post.event_details);
  const busy = navigation.state !== 'idle' || uploading;
  const toast = useToast();
  useToastFeedback(mediaError, mediaError || undefined, 'warning');
  const errorMessage = Object.values(serverErrors).join(' ');
  useToastFeedback(
    serverErrors,
    errorMessage
      ? 'Chưa lưu bài viết. Kiểm tra các trường được đánh dấu.'
      : undefined,
    'error',
  );
  useToastFeedback(
    params.get('saved'),
    params.has('saved') ? 'Đã lưu bài viết thành công.' : undefined,
    'success',
    `post:${params.get('saved')}`,
  );
  const checkForm = (form: HTMLFormElement, intent: string) => {
    const data = new FormData(form);
    data.set('intent', intent);
    try {
      validatePostForm(data, { current: post, now: new Date() });
      return {};
    } catch (error) {
      if (error instanceof ValidationError) return error.fields;
      throw error;
    }
  };
  const focusField = (form: HTMLFormElement, name: string) => {
    const target = name === 'schedule' ? 'schedule_date' : name;
    const element = form.elements.namedItem(target);
    if (element instanceof HTMLElement) {
      let parent = element.parentElement;
      while (parent && parent !== form) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
      element.focus();
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else errorSummary.current?.focus();
  };
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
      <span>
        {label}
        {options.required && (
          <span className="admin-required" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </span>
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
        <div className="admin-actions">
          <Link to="/admin/posts">Danh sách bài viết</Link>
          <PostHelp />
        </div>
      </div>
      {Object.keys(errors).length > 0 && (
        <div
          className="admin-errors"
          role="alert"
          ref={errorSummary}
          tabIndex={-1}
        >
          <strong>Chưa lưu bài viết. Kiểm tra các trường sau:</strong>
          <ul>
            {Object.entries(errors).map(([key, message]) => (
              <li key={key}>
                {fieldLabels[key] ? (
                  <button
                    type="button"
                    className="admin-error-link"
                    onClick={() => {
                      if (formRef.current) focusField(formRef.current, key);
                    }}
                  >
                    {fieldLabels[key]}: {message}
                  </button>
                ) : (
                  message
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Form
        method="post"
        ref={formRef}
        className="admin-form"
        noValidate
        onChange={(event) => {
          setDirty(true);
          const target = event.target;
          if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLSelectElement ||
            target instanceof HTMLTextAreaElement
          ) {
            const next = { ...errors };
            delete next[target.name];
            if (
              ['schedule_date', 'schedule_time', 'timezone'].includes(
                target.name,
              )
            )
              delete next.schedule;
            setClientErrors(next);
          }
        }}
        onBlur={(event) => {
          const target = event.target;
          if (!(
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement
          ))
            return;
          if (
            !target.name ||
            ['file', 'revision', 'expected', 'media'].includes(target.name)
          )
            return;
          const found = checkForm(
            event.currentTarget,
            state === 'draft' ? 'draft' : 'save',
          );
          setClientErrors((previous) => {
            const next = { ...(previous ?? serverErrors) };
            delete next[target.name];
            if (found[target.name]) next[target.name] = found[target.name];
            return next;
          });
        }}
        onSubmit={(event) => {
          if (busy || !writesEnabled || !editable) {
            event.preventDefault();
            return;
          }
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          const intent =
            submitter instanceof HTMLButtonElement
              ? submitter.value
              : state === 'draft'
                ? 'draft'
                : 'save';
          const found = checkForm(event.currentTarget, intent);
          setClientErrors(Object.keys(found).length ? found : null);
          if (Object.keys(found).length) {
            event.preventDefault();
            focusField(event.currentTarget, Object.keys(found)[0]);
            toast.error(
              'Chưa gửi bài viết. Vui lòng kiểm tra các trường được đánh dấu.',
            );
          }
        }}
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
              <span>
                Loại bài
                <span className="admin-required" aria-hidden="true">
                  {' '}
                  *
                </span>
              </span>
              <select
                name="kind"
                required
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
              <span>
                Định dạng nội dung
                <span className="admin-required" aria-hidden="true">
                  {' '}
                  *
                </span>
              </span>
              <select
                name="content_format"
                required
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
                <span>
                  Độ chính xác ngày công bố
                  <span className="admin-required" aria-hidden="true">
                    {' '}
                    *
                  </span>
                </span>
                <select
                  name="published_at_precision"
                  required
                  value={precision}
                  onChange={(event) =>
                    setPrecision(event.target.value as 'date' | 'datetime')
                  }
                >
                  <option value="date">Chỉ có ngày</option>
                  <option value="datetime">Thời điểm chính xác</option>
                </select>
                {errors.published_at_precision && (
                  <span className="admin-field-error">
                    {errors.published_at_precision}
                  </span>
                )}
              </label>
              {field(
                'published_on',
                'Ngày công bố (giờ Việt Nam)',
                post?.published_on,
                { type: 'date', required: true },
              )}
              {field(
                'published_at',
                'Thời điểm công bố (ISO 8601)',
                post?.published_at,
                {
                  required: precision === 'datetime',
                  help: 'Ví dụ: 2026-11-20T09:00:00+07:00. Ngày phải khớp giờ Việt Nam.',
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
                error={errors.schedule}
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
                <span>
                  Trạng thái học bổng
                  <span className="admin-required" aria-hidden="true">
                    {' '}
                    *
                  </span>
                </span>
                <select
                  name="scholarship_status"
                  required
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
                <span>
                  Trạng thái sự kiện
                  <span className="admin-required" aria-hidden="true">
                    {' '}
                    *
                  </span>
                </span>
                <select
                  name="event_status"
                  required
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
        <fieldset
          disabled={!writesEnabled || navigation.state !== 'idle' || !editable}
        >
          <legend>Ảnh bìa và thư viện</legend>
          <MediaUpload
            disabled={
              !writesEnabled || navigation.state !== 'idle' || !editable
            }
            onBusyChange={setUploading}
            onUploaded={(uploadedPath) => {
              setMedia((current) => [
                ...current,
                {
                  ...mediaReference(`draft-media/${uploadedPath}`),
                  alt_text: '',
                  width: null,
                  height: null,
                  is_cover: current.length === 0,
                },
              ]);
              setDirty(true);
            }}
          />
          <p>Ảnh tải lên sẽ tự động đính kèm. Lưu bài viết để áp dụng.</p>
          <div className="admin-attach">
            <MediaLibraryPicker value={path} onChange={setPath} />
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
          {errors.media && (
            <p className="admin-field-error" role="alert">
              {errors.media}
            </p>
          )}
          {!media.length && <p>Chưa có ảnh đính kèm.</p>}
          <ol className="admin-attached">
            {media.map((item, index) => (
              <li key={`${item.bucket}/${item.storage_path}`}>
                <img
                  src={
                    item.bucket === 'draft-media'
                      ? `${mediaPreviewUrl(item.bucket, item.storage_path)}&width=320`
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
                        toast.info(
                          'Đã gỡ ảnh khỏi bài viết. Lưu thay đổi để áp dụng.',
                        );
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
        {navigation.state !== 'idle' && <p role="status">Đang lưu bài viết…</p>}
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
