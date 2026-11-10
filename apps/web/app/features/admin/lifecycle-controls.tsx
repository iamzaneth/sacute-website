import { useState } from 'react';
import { Form } from 'react-router';
import {
  canTransition,
  lifecycleActionLabels,
  lifecycleConfirmations,
  lifecycleTransitions,
  scheduleFields,
  scheduleInstant,
  scheduleZones,
  formatSchedule,
  type LifecycleAction,
  type LifecycleState,
  type ScheduleZone,
} from '@sacute/shared';

export function ScheduleFields({
  visibleFrom = null,
  now,
}: {
  visibleFrom?: string | null;
  now: string;
}) {
  const initial = scheduleFields(visibleFrom);
  const [day, setDay] = useState(initial.date),
    [time, setTime] = useState(initial.time),
    [zone, setZone] = useState<ScheduleZone>('Asia/Ho_Chi_Minh');
  let preview = 'Chọn ngày và giờ đăng.';
  try {
    const instant = scheduleInstant(day, time, zone);
    preview =
      Date.parse(instant) <= Date.parse(now)
        ? 'Thời điểm hẹn đăng phải ở tương lai.'
        : `Bài viết sẽ tự động hiển thị lúc ${formatSchedule(instant)}.`;
  } catch {
    /* Partial input is expected while editing. */
  }
  return (
    <div className="admin-fields admin-schedule">
      <label>
        Ngày đăng
        <input
          type="date"
          name="schedule_date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </label>
      <label>
        Giờ đăng
        <input
          type="time"
          name="schedule_time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </label>
      <label>
        Múi giờ
        <select
          name="timezone"
          value={zone}
          onChange={(e) => {
            const next = e.target.value as ScheduleZone;
            try {
              const fields = scheduleFields(
                scheduleInstant(day, time, zone),
                next,
              );
              setDay(fields.date);
              setTime(fields.time);
            } catch {
              /* Retain unfinished input. */
            }
            setZone(next);
          }}
        >
          {Object.entries(scheduleZones).map(([key, value]) => (
            <option value={key} key={key}>
              {value.label}
            </option>
          ))}
        </select>
      </label>
      <p role="status">{preview}</p>
    </div>
  );
}
export function LifecycleControls({
  post,
  state,
  now,
  disabled,
  from = 'list',
}: {
  post: {
    id: string;
    slug: string;
    lifecycle_revision: string;
    visible_from: string | null;
  };
  state: LifecycleState;
  now: string;
  disabled: boolean;
  from?: 'list' | 'editor';
}) {
  const choices = (
    Object.keys(lifecycleTransitions) as LifecycleAction[]
  ).filter(
    (action) =>
      !['save', 'draft'].includes(action) && canTransition(state, action),
  );
  const [selected, setSelected] = useState<LifecycleAction>(
    choices[0] ?? 'restore_trash',
  );
  return (
    <details className="admin-lifecycle">
      <summary>Thao tác với bài viết</summary>
      <Form
        method="post"
        action="/admin/posts"
        onSubmit={(e) => {
          const message = lifecycleConfirmations[selected];
          if (message && !window.confirm(message)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={post.id} />
        <input type="hidden" name="revision" value={post.lifecycle_revision} />
        <input type="hidden" name="confirmed" value="yes" />
        <input type="hidden" name="from" value={from} />
        <fieldset disabled={disabled}>
          <legend>Vòng đời bài viết</legend>
          <label>
            Chọn thao tác
            <select
              name="intent"
              value={selected}
              onChange={(e) => setSelected(e.target.value as LifecycleAction)}
            >
              {choices.map((action) => (
                <option value={action} key={action}>
                  {lifecycleActionLabels[action]}
                </option>
              ))}
            </select>
          </label>
          {(selected === 'schedule' || selected === 'reschedule') && (
            <ScheduleFields visibleFrom={post.visible_from} now={now} />
          )}
          <button type="submit">{lifecycleActionLabels[selected]}</button>
        </fieldset>
      </Form>
      {state === 'trashed' && (
        <>
          <button
            type="button"
            disabled
            title="Chưa xác minh an toàn quan hệ dữ liệu và Storage"
          >
            Xóa vĩnh viễn
          </button>
          <p>
            Xóa vĩnh viễn chưa được bật. Nội dung và ảnh đang được giữ an toàn.
          </p>
        </>
      )}
    </details>
  );
}
