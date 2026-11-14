// Pure lifecycle contracts shared by admin UI, server validation and test fixtures.
export const lifecycleStates = [
  'draft',
  'scheduled',
  'published',
  'archived',
  'trashed',
] as const;
export type LifecycleState = (typeof lifecycleStates)[number];
export const lifecycleLabels: Record<LifecycleState, string> = {
  draft: 'Bản nháp',
  scheduled: 'Đã lên lịch',
  published: 'Đã xuất bản',
  archived: 'Đã lưu trữ',
  trashed: 'Trong thùng rác',
};
export interface LifecycleRecord {
  status: string;
  visible_from: string | null;
  deleted_at?: string | null;
}
export function deriveLifecycle(
  post: LifecycleRecord,
  now: string | Date,
): LifecycleState {
  const instant = new Date(now).getTime();
  if (!Number.isFinite(instant)) throw new Error('Invalid authoritative clock');
  if (post.deleted_at != null) return 'trashed';
  if (post.status === 'draft' || post.status === 'archived') return post.status;
  if (post.status !== 'published')
    throw new Error('Invalid publication status');
  if (post.visible_from && !Number.isFinite(Date.parse(post.visible_from)))
    throw new Error('Invalid visibility time');
  return post.visible_from && Date.parse(post.visible_from) > instant
    ? 'scheduled'
    : 'published';
}
export const lifecycleTransitions = {
  draft: ['draft', 'scheduled', 'published'],
  publish: ['draft', 'scheduled'],
  schedule: ['draft'],
  reschedule: ['scheduled'],
  cancel_schedule: ['scheduled'],
  hide: ['published'],
  archive: ['draft', 'published'],
  restore_archive: ['archived'],
  trash: ['draft', 'scheduled', 'published', 'archived'],
  restore_trash: ['trashed'],
  save: ['draft', 'scheduled', 'published'],
} as const satisfies Record<string, readonly LifecycleState[]>;
export type LifecycleAction = keyof typeof lifecycleTransitions;
export function canTransition(
  state: LifecycleState,
  action: string,
): action is LifecycleAction {
  return (
    Object.hasOwn(lifecycleTransitions, action) &&
    (
      lifecycleTransitions[action as LifecycleAction] as readonly string[]
    ).includes(state)
  );
}
export const lifecycleActionLabels: Record<LifecycleAction, string> = {
  draft: 'Lưu bản nháp',
  publish: 'Đăng ngay',
  schedule: 'Hẹn giờ',
  reschedule: 'Đổi lịch',
  cancel_schedule: 'Hủy lịch',
  hide: 'Ẩn bài',
  archive: 'Lưu trữ',
  restore_archive: 'Khôi phục về bản nháp',
  trash: 'Chuyển vào thùng rác',
  restore_trash: 'Khôi phục',
  save: 'Lưu thay đổi',
};
export const lifecycleConfirmations: Partial<Record<LifecycleAction, string>> =
  {
    hide: 'Bạn có chắc muốn ẩn bài viết này? Bài viết sẽ không còn hiển thị công khai.',
    archive: 'Lưu trữ bài viết? Bài sẽ ngừng hiển thị công khai.',
    trash:
      'Chuyển bài viết vào thùng rác? Nội dung và ảnh sẽ được giữ để khôi phục.',
    cancel_schedule: 'Hủy lịch đăng và đưa bài về bản nháp?',
    draft:
      'Lưu thành bản nháp? Bài sẽ không hiển thị công khai và lịch đăng sẽ bị hủy.',
  };
export const scheduleZones = {
  'Asia/Ho_Chi_Minh': {
    label: 'Việt Nam (UTC+7)',
    offset: '+07:00',
    minutes: 420,
  },
  UTC: { label: 'UTC (UTC+0)', offset: '+00:00', minutes: 0 },
} as const;
export type ScheduleZone = keyof typeof scheduleZones;
export function scheduleInstant(date: string, time: string, zone: string) {
  if (
    !Object.hasOwn(scheduleZones, zone) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
    Number(date.slice(0, 4)) < 1
  )
    throw new Error('Ngày, giờ hoặc múi giờ không hợp lệ.');
  const day = new Date(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(day.getTime()) ||
    day.toISOString().slice(0, 10) !== date
  )
    throw new Error('Ngày không hợp lệ.');
  const result = new Date(
    `${date}T${time}:00${scheduleZones[zone as ScheduleZone].offset}`,
  );
  if (!Number.isFinite(result.getTime()))
    throw new Error('Thời điểm không hợp lệ.');
  return result.toISOString();
}
export function scheduleFields(
  instant: string | null,
  zone: ScheduleZone = 'Asia/Ho_Chi_Minh',
) {
  if (!instant) return { date: '', time: '' };
  const local = new Date(
    Date.parse(instant) + scheduleZones[zone].minutes * 60000,
  ).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}
export function formatSchedule(instant: string | null) {
  if (!instant) return '—';
  const value = scheduleFields(instant);
  return `${value.time} ngày ${value.date.split('-').reverse().join('/')} (UTC+7)`;
}
