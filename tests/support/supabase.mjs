// Synthetic PostgREST HTTP adapter used only by tests. No production credentials.
import { createServer } from 'node:http';
export const testKey = 'sb_publishable_synthetic_test';
export const imageBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVQImWP4X87wv5wBhP+XMwAALPIF2fa82QwAAAAASUVORK5CYII=',
  'base64',
);
const media = (i) => ({
  id: `media-${i}`,
  bucket: 'post-media',
  storage_path: `synthetic/${i}.png`,
  alt_text: `Ảnh thử nghiệm ${i}`,
  width: 1,
  height: 1,
  sort_order: i,
  is_cover: i === 2,
});
const post = (id, kind, title, overrides = {}) => ({
  id,
  slug: `bai-thu-nghiem-${id}`,
  kind,
  title,
  summary: 'Hỗ trợ sinh viên và học tập',
  content: `${title}\n\nNội dung thử nghiệm tiếng Việt 🎉\nGiữ nguyên dòng.`,
  content_format: 'plain-text',
  category:
    kind === 'event'
      ? 'Xuân tình nguyện'
      : kind === 'scholarship'
        ? 'Học bổng'
        : 'Thông báo',
  original_title: null,
  event_name: kind === 'event' ? 'Xuân tình nguyện' : null,
  tags: [],
  author_name: 'SACUTE',
  author_url: null,
  source_url: null,
  status: 'published',
  visible_from: null,
  deleted_at: null,
  deleted_by: null,
  updated_at: null,
  lifecycle_revision: crypto.randomUUID(),
  publication_recorded: null,
  published_on: '2026-01-03',
  published_at: '2026-01-03T01:30:00Z',
  published_at_precision: 'datetime',
  post_media: [],
  scholarship_details: null,
  event_details: null,
  ...overrides,
});
export const rows = [
  post('notice', 'information', 'Thông báo thử nghiệm mới', {
    post_media: [media(2), media(0), media(1)],
  }),
  post('older', 'information', 'Thông báo thử nghiệm trước', {
    published_on: '2026-01-02',
    published_at: '2026-01-02T01:30:00Z',
  }),
  post('scholarship', 'scholarship', 'Học bổng thử nghiệm', {
    scholarship_details: {
      provider: 'Đơn vị thử nghiệm',
      eligibility: 'Sinh viên',
      opens_at: null,
      closes_at: '2026-12-01T00:00:00Z',
      application_url: 'https://example.test/apply',
      lifecycle_status: 'open',
    },
  }),
  post('event', 'event', 'Hoạt động thử nghiệm', {
    published_on: '2026-01-01',
    published_at: null,
    published_at_precision: 'date',
    post_media: [media(0), media(1)],
    event_details: {
      starts_at: null,
      ends_at: null,
      starts_on: '2026-01-01',
      ends_on: '2026-01-02',
      location: 'TP.HCM',
      registration_url: null,
      lifecycle_status: 'ended',
    },
  }),
  post('draft', 'information', 'Bản nháp riêng tư', { status: 'draft' }),
  post('archived', 'information', 'Bài đã lưu trữ', { status: 'archived' }),
  post('future', 'information', 'Bài hẹn giờ', {
    visible_from: '2999-01-01T00:00:00Z',
  }),
];
// Expected UI contracts are fixture expectations, never a production read source.
export const testContent = {
  information: rows
    .slice(0, 2)
    .concat(rows[3])
    .map((r) => ({
      ...r,
      category: r.kind === 'event' ? 'Hoạt động' : 'Thông báo',
      images: r.post_media
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => ({
          url: `http://127.0.0.1:54329/storage/v1/object/public/${m.bucket}/${m.storage_path}`,
        })),
    })),
  scholarships: [rows[2]],
  events: [rows[3]],
};
for (const group of [testContent.scholarships, testContent.events])
  for (const item of group)
    item.images = item.post_media
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({
        url: `http://127.0.0.1:54329/storage/v1/object/public/${m.bucket}/${m.storage_path}`,
      }));
function split(value) {
  let depth = 0,
    quoted = false,
    escaped = false,
    start = 0;
  const parts = [];
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === '\\') {
      escaped = true;
      continue;
    }
    if (c === '"') quoted = !quoted;
    if (!quoted) {
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (c === ',' && depth === 0) {
        parts.push(value.slice(start, i));
        start = i + 1;
      }
    }
  }
  return parts.concat(value.slice(start));
}
function matches(row, condition) {
  if (condition.startsWith('and('))
    return split(condition.slice(4, -1)).every((c) => matches(row, c));
  const [, column, operator, raw] =
    condition.match(/^([\w_]+)\.([\w]+)\.(.*)$/) ?? [];
  const value = raw?.startsWith('"') ? JSON.parse(raw) : raw;
  if (operator === 'not') return !matches(row, `${column}.${value}`);
  if (operator === 'gt')
    return (
      row[column] !== null &&
      (column === 'visible_from'
        ? Date.parse(row[column]) > Date.parse(value)
        : row[column] > value)
    );
  if (operator === 'is') return row[column] === null;
  if (operator === 'lte')
    return column === 'visible_from'
      ? Date.parse(row[column]) <= Date.parse(value)
      : row[column] <= value;
  if (operator === 'eq') return row[column] === value;
  if (operator === 'in') return split(value.slice(1, -1)).includes(row[column]);
  if (operator === 'ilike') {
    const term = value
      .slice(1, -1)
      .replace(/\\(.)/g, '$1')
      .toLocaleLowerCase('vi');
    return String(row[column] ?? '')
      .toLocaleLowerCase('vi')
      .includes(term);
  }
  throw new Error(`Unsupported fixture operator ${operator}`);
}
export async function startFixtureDatabase(port = 0, handler) {
  const state = { rows: structuredClone(rows), fail: false, requests: [] };
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const url = new URL(req.url, 'http://fixture.test');
    if (url.pathname === '/rest/v1/rpc/sacute_content_time') {
      state.clockRequests = (state.clockRequests ?? 0) + 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state.now ?? new Date().toISOString()));
      return;
    }
    if (handler && (await handler(req, res, url, state))) return;
    if (url.pathname.startsWith('/storage/')) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(imageBytes);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    state.requests.push(url);
    if (state.fail) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          message: 'Synthetic database unavailable',
          code: 'XX000',
        }),
      );
      return;
    }
    try {
      let data = state.rows.filter((row) =>
        [...url.searchParams].every(([key, value]) => {
          if (key === 'or')
            return split(value.slice(1, -1)).some((c) => matches(row, c));
          if (['select', 'order', 'offset', 'limit'].includes(key)) return true;
          return matches(row, `${key}.${value}`);
        }),
      );
      const order = (url.searchParams.get('order') ?? '').split(',');
      data.sort((a, b) => {
        for (const spec of order) {
          const [key, direction] = spec.split('.');
          if (a[key] === b[key]) continue;
          if (a[key] === null) return 1;
          if (b[key] === null) return -1;
          return (a[key] < b[key] ? -1 : 1) * (direction === 'desc' ? -1 : 1);
        }
        return 0;
      });
      const total = data.length;
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? total);
      data = data.slice(offset, offset + limit);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Range': `${offset}-${offset + data.length - 1}/${total}`,
      });
      res.end(JSON.stringify(data));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Invalid synthetic query' }));
    }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    state,
    url: `http://127.0.0.1:${server.address().port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
