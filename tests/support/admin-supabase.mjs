import {
  deriveLifecycle,
  canTransition,
  scheduleInstant,
} from '../../packages/shared/dist/index.js';
import { imageBytes, startFixtureDatabase } from './supabase.mjs';
export const adminID = '00000000-0000-4000-8000-000000000001';
export const nonAdminID = '00000000-0000-4000-8000-000000000002';
export const editorPostID = '00000000-0000-4000-8000-000000000010';
async function body(req) {
  let value = '';
  for await (const chunk of req) value += chunk;
  return JSON.parse(value || '{}');
}
function send(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
}
export async function startAdminFixture(port = 0) {
  const tokens = new Map();
  const uploads = new Set();
  const refreshes = new Map();
  const tokenRefreshes = new Map();
  function issue(user) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const access_token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp, role: 'authenticated', jti: crypto.randomUUID() })).toString('base64url')}.synthetic`;
    const refresh_token = crypto.randomUUID();
    tokens.set(access_token, user);
    refreshes.set(refresh_token, user);
    tokenRefreshes.set(access_token, refresh_token);
    return {
      access_token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: exp,
      refresh_token,
      user,
    };
  }
  const fixture = await startFixtureDatabase(
    port,
    async (req, res, url, state) => {
      const token = req.headers.authorization?.replace(/^Bearer /i, '');
      const actor = tokens.get(token);
      if (url.pathname === '/auth/v1/token') {
        const input = await body(req);
        if (url.searchParams.get('grant_type') === 'refresh_token') {
          const user = refreshes.get(input.refresh_token);
          if (user) {
            refreshes.delete(input.refresh_token);
            send(res, 200, issue(user));
          } else
            send(res, 400, {
              msg: 'Expired synthetic session',
              error_code: 'refresh_token_not_found',
            });
          return true;
        }
        if (
          input.password !== 'synthetic-password' ||
          !['admin@example.test', 'reader@example.test'].includes(input.email)
        ) {
          send(res, 400, {
            msg: 'Invalid login credentials',
            error_code: 'invalid_credentials',
          });
          return true;
        }
        const user = {
          id: input.email.startsWith('admin') ? adminID : nonAdminID,
          email: input.email,
          aud: 'authenticated',
          role: 'authenticated',
          user_metadata: {
            role: 'admin',
            ...(state.largeMetadata ? { padding: 'x'.repeat(6500) } : {}),
          },
          app_metadata: {},
          created_at: '2026-01-01T00:00:00Z',
        };
        send(res, 200, issue(user));
        return true;
      }
      if (url.pathname === '/auth/v1/user') {
        send(
          res,
          actor ? 200 : 401,
          actor ?? { msg: 'Session expired', error_code: 'bad_jwt' },
        );
        return true;
      }
      if (url.pathname === '/auth/v1/logout') {
        tokens.delete(token);
        refreshes.delete(tokenRefreshes.get(token));
        tokenRefreshes.delete(token);
        res.writeHead(204).end();
        return true;
      }
      if (url.pathname === '/rest/v1/admin_profiles') {
        send(
          res,
          200,
          actor ? [{ role: actor.id === adminID ? 'admin' : 'editor' }] : [],
        );
        return true;
      }
      if (url.pathname === '/rest/v1/rpc/sacute_admin_writes_enabled') {
        send(res, 200, actor?.id === adminID && state.databaseWrites !== false);
        return true;
      }
      if (url.pathname === '/rest/v1/post_media') {
        const rows = state.rows
          .flatMap((row) => row.post_media)
          .filter(
            (m) =>
              (!url.searchParams.get('bucket') ||
                url.searchParams.get('bucket') === `eq.${m.bucket}`) &&
              (!url.searchParams.get('storage_path') ||
                url.searchParams.get('storage_path') ===
                  `eq.${m.storage_path}`),
          );
        res.setHeader(
          'Content-Range',
          `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
        );
        send(res, 200, rows);
        return true;
      }
      if (url.pathname.startsWith('/storage/')) {
        state.storageRequests ??= [];
        state.storageRequests.push({ method: req.method, path: url.pathname });
        const privateBucket = url.pathname.includes('/draft-media');
        if (privateBucket && actor?.id !== adminID) {
          const objectPath = decodeURIComponent(url.pathname).replace(
            /^.*\/object\/(?:authenticated\/)?draft-media\//,
            '',
          );
          const publiclyAttached = state.rows.some(
            (row) =>
              deriveLifecycle(row, new Date(state.now ?? Date.now())) ===
                'published' &&
              row.post_media.some(
                (m) =>
                  m.bucket === 'draft-media' && m.storage_path === objectPath,
              ),
          );
          if (
            req.method !== 'GET' ||
            !publiclyAttached ||
            url.pathname.includes('/object/public/')
          ) {
            send(res, 403, { message: 'Forbidden' });
            return true;
          }
        }
        if (url.pathname.includes('/object/list/')) {
          const input = await body(req);
          const prefix = input.prefix || '';
          const paths = privateBucket ? [...uploads] : ['admin/existing.png'];
          const children = new Map();
          for (const path of paths) {
            const relative = prefix
              ? path.startsWith(prefix + '/')
                ? path.slice(prefix.length + 1)
                : null
              : path;
            if (!relative) continue;
            const [name, ...rest] = relative.split('/');
            children.set(name, {
              name,
              id: rest.length ? null : path,
              metadata: { mimetype: 'image/png' },
            });
          }
          send(res, 200, [...children.values()]);
          return true;
        }
        if (
          req.method === 'POST' &&
          url.pathname.startsWith('/storage/v1/object/draft-media/')
        ) {
          if (state.databaseWrites === false) {
            send(res, 403, { message: 'Read only' });
            return true;
          }
          const path = url.pathname.slice(
            '/storage/v1/object/draft-media/'.length,
          );
          for await (const chunk of req) {
            void chunk;
          }
          uploads.add(path);
          send(res, 200, {
            Key: `draft-media/${path}`,
            Id: crypto.randomUUID(),
          });
          return true;
        }
        if (
          req.method === 'DELETE' &&
          url.pathname === '/storage/v1/object/draft-media'
        ) {
          if (state.databaseWrites === false) {
            send(res, 403, { message: 'Read only' });
            return true;
          }
          const input = await body(req);
          for (const path of input.prefixes) uploads.delete(path);
          send(
            res,
            200,
            input.prefixes.map((name) => ({ name })),
          );
          return true;
        }
        if (
          req.method === 'GET' &&
          (url.pathname.includes('/object/authenticated/') ||
            url.pathname.startsWith('/storage/v1/object/draft-media/'))
        ) {
          res.writeHead(200, { 'Content-Type': 'image/png' });
          res.end(imageBytes);
          return true;
        }
      }
      if (url.pathname === '/rest/v1/rpc/admin_transition_post') {
        const input = await body(req);
        state.requests.push(url);
        const row = state.rows.find((r) => r.id === input.p_id),
          now = state.now ?? new Date().toISOString();
        if (
          actor?.id !== adminID ||
          state.databaseWrites === false ||
          input.p_action === 'permanent_delete'
        ) {
          send(res, 403, { code: '42501' });
          return true;
        }
        if (
          !row ||
          row.lifecycle_revision !== input.p_revision ||
          !canTransition(deriveLifecycle(row, now), input.p_action)
        ) {
          send(res, 409, { code: '40001' });
          return true;
        }
        const action = input.p_action,
          previous = deriveLifecycle(row, now),
          recorded =
            (row.publication_recorded ??
              Boolean(row.published_on || row.published_at)) ||
            previous === 'published';
        let at = null;
        if (action === 'schedule' || action === 'reschedule') {
          try {
            const [day, time] = input.p_schedule_local.split('T');
            at = scheduleInstant(day, time, input.p_timezone);
            if (at <= now) throw Error();
          } catch {
            send(res, 400, { code: '22023' });
            return true;
          }
        }
        if (
          ['restore_archive', 'restore_trash'].includes(action) &&
          state.rows.some((r) => r.id !== row.id && r.slug === row.slug)
        ) {
          send(res, 409, { code: '23505' });
          return true;
        }
        Object.assign(row, {
          status: ['publish', 'schedule', 'reschedule'].includes(action)
            ? 'published'
            : action === 'archive'
              ? 'archived'
              : 'draft',
          visible_from: at,
          deleted_at: action === 'trash' ? now : null,
          deleted_by: action === 'trash' ? actor.id : null,
          publication_recorded: recorded || action === 'publish',
          lifecycle_revision: crypto.randomUUID(),
          updated_at: now,
        });
        if (
          !recorded &&
          ['publish', 'schedule', 'reschedule'].includes(action)
        ) {
          row.published_at = action === 'publish' ? now : at;
          row.published_on = new Date(
            Date.parse(row.published_at) + 420 * 60000,
          )
            .toISOString()
            .slice(0, 10);
          row.published_at_precision = 'datetime';
        }
        send(res, 200, row.id);
        return true;
      }
      if (url.pathname === '/rest/v1/rpc/admin_save_post') {
        state.requests.push(url);
        const input = await body(req);
        if (actor?.id !== adminID || state.databaseWrites === false) {
          send(res, 403, {
            code: '42501',
            message: 'Admin required or gate disabled',
          });
          return true;
        }
        const existing = state.rows.find((r) => r.id === input.p_id);
        const now = state.now ?? new Date().toISOString();
        if (
          existing &&
          (input.p_input.revision !== existing.lifecycle_revision ||
            !canTransition(
              deriveLifecycle(existing, now),
              input.p_input.intent,
            ))
        ) {
          send(res, 409, { code: '40001' });
          return true;
        }
        if (!existing && !canTransition('draft', input.p_input.intent)) {
          send(res, 409, { code: '40001' });
          return true;
        }

        if (existing)
          Object.assign(existing, input.p_input.post, {
            lifecycle_revision: crypto.randomUUID(),
            updated_at: now,
            publication_recorded:
              (existing.publication_recorded ??
                Boolean(existing.published_on || existing.published_at)) ||
              input.p_input.intent === 'publish',
            post_media: input.p_input.media.map((m, i) => ({
              ...m,
              id:
                existing.post_media.find(
                  (old) =>
                    old.bucket === (m.bucket ?? 'post-media') &&
                    old.storage_path === m.storage_path,
                )?.id ?? crypto.randomUUID(),
              bucket: m.bucket ?? 'post-media',
              sort_order: i,
            })),
            scholarship_details: input.p_input.scholarship,
            event_details: input.p_input.event,
          });
        else
          state.rows.push({
            ...state.rows[0],
            ...input.p_input.post,
            id: crypto.randomUUID(),
            deleted_at: null,
            deleted_by: null,
            lifecycle_revision: crypto.randomUUID(),
            updated_at: now,
            publication_recorded: input.p_input.intent === 'publish',
            post_media: input.p_input.media.map((m, i) => ({
              ...m,
              id: crypto.randomUUID(),
              bucket: m.bucket ?? 'post-media',
              sort_order: i,
            })),
            scholarship_details: input.p_input.scholarship,
            event_details: input.p_input.event,
          });
        send(res, 200, existing?.id ?? state.rows.at(-1).id);
        return true;
      }
      return false;
    },
  );
  fixture.state.rows.forEach((row, index) => {
    row.id =
      index === 0
        ? editorPostID
        : `00000000-0000-4000-8000-${String(index + 20).padStart(12, '0')}`;
  });
  return { ...fixture, tokens };
}
