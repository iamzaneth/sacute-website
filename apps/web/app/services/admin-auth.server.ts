import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from '@supabase/ssr';
import {
  isAuthRetryableFetchError,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { validateSupabaseEnvironment } from '@sacute/shared/content';
import { data, redirect, type HeadersFunction } from 'react-router';

export const privateHeaders = () =>
  new Headers({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy':
      "frame-ancestors 'none'; form-action 'self'; base-uri 'self'",
    Vary: 'Cookie',
  });
// React Router runs matched loaders in parallel. Retain every refreshed cookie,
// including on redirects/errors and when a child exports its own headers.
export const adminHeaders: HeadersFunction = ({
  parentHeaders,
  loaderHeaders,
  actionHeaders,
  errorHeaders,
}) => {
  const result = privateHeaders();
  const cookies = new Set<string>();
  for (const headers of [
    parentHeaders,
    loaderHeaders,
    actionHeaders,
    errorHeaders,
  ])
    for (const cookie of headers?.getSetCookie() ?? []) cookies.add(cookie);
  for (const cookie of cookies) result.append('Set-Cookie', cookie);
  return result;
};
export function writesEnabled(env: Record<string, unknown> = process.env) {
  return env.ADMIN_WRITES_ENABLED === 'true';
}
export function assertSameOrigin(
  request: Request,
  env: Record<string, unknown> = process.env,
) {
  if (request.method !== 'POST')
    throw new Response('Phương thức không được hỗ trợ.', {
      status: 405,
      headers: privateHeaders(),
    });
  const expected = String(env.ADMIN_ORIGIN || new URL(request.url).origin);
  if (
    request.headers.get('Origin') !== expected ||
    request.headers.get('Sec-Fetch-Site') === 'cross-site'
  )
    throw new Response('Yêu cầu không hợp lệ. Vui lòng tải lại trang.', {
      status: 403,
      headers: privateHeaders(),
    });
}
export function assertWritesEnabled(
  env: Record<string, unknown> = process.env,
  headers = privateHeaders(),
) {
  if (!writesEnabled(env))
    throw new Response(
      'CMS đang ở chế độ chỉ đọc. Chưa cho phép thay đổi nội dung.',
      { status: 503, headers },
    );
}
export interface AuthContext {
  db: SupabaseClient;
  headers: Headers;
}
export interface AdminContext extends AuthContext {
  user: User;
  writesEnabled: boolean;
}
export function createAuthContext(
  request: Request,
  env: Record<string, unknown> = process.env,
  requestFetch: typeof fetch = fetch,
): AuthContext {
  let config;
  try {
    config = validateSupabaseEnvironment(env);
  } catch {
    throw new Response('Chưa cấu hình kết nối quản trị.', {
      status: 503,
      headers: privateHeaders(),
    });
  }
  const headers = privateHeaders();
  const upstream = new URL(config.url);
  if (
    upstream.protocol !== 'https:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(upstream.hostname)
  )
    throw new Response('Kết nối xác thực yêu cầu HTTPS.', {
      status: 503,
      headers,
    });
  const jar = new Map(
    parseCookieHeader(request.headers.get('Cookie') ?? '').map((c) => [
      c.name,
      c.value,
    ]),
  );
  const secure = new URL(request.url).protocol === 'https:';
  if (
    env.NODE_ENV === 'production' &&
    !secure &&
    !['localhost', '127.0.0.1'].includes(new URL(request.url).hostname)
  )
    throw new Response('Quản trị yêu cầu HTTPS.', { status: 400, headers });
  const db = createServerClient(config.url, config.key, {
    cookieOptions: {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies, cacheHeaders) => {
        for (const [name, value] of Object.entries(cacheHeaders))
          headers.set(name, value);
        for (const { name, value, options } of cookies) {
          jar.set(name, value);
          headers.append(
            'Set-Cookie',
            serializeCookieHeader(name, value, {
              ...options,
              path: '/',
              httpOnly: true,
              secure,
              sameSite: 'lax',
            }),
          );
        }
      },
    },
    global: {
      fetch: (input, init) =>
        requestFetch(input, {
          ...init,
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        }),
    },
  });
  return { db, headers };
}
export async function verifyAdmin(
  context: AuthContext,
  env: Record<string, unknown> = process.env,
): Promise<AdminContext> {
  const { db, headers } = context;
  let result;
  try {
    result = await db.auth.getUser();
  } catch {
    throw new Response(
      'Không thể xác minh phiên đăng nhập. Vui lòng thử lại.',
      { status: 503, headers },
    );
  }
  if (result.error || !result.data.user) {
    if (
      result.error &&
      ((result.error.status ?? 0) >= 500 ||
        isAuthRetryableFetchError(result.error))
    )
      throw new Response('Dịch vụ đăng nhập tạm thời không khả dụng.', {
        status: 503,
        headers,
      });
    throw redirect('/admin/login?expired=1', { headers });
  }
  // Membership is database controlled, never sourced from user_metadata.
  const role = await db
    .from('admin_profiles')
    .select('role')
    .eq('user_id', result.data.user.id)
    .maybeSingle();
  if (role.error)
    throw new Response(
      'Không thể xác minh quyền quản trị. Kiểm tra cấu hình RLS.',
      { status: 503, headers },
    );
  if (role.data?.role !== 'admin')
    throw new Response('Tài khoản không có quyền quản trị.', {
      status: 403,
      headers,
    });
  let databaseWrites = false;
  if (writesEnabled(env)) {
    try {
      const gate = await db.rpc('sacute_admin_writes_enabled');
      databaseWrites = !gate.error && gate.data === true;
    } catch {
      /* An unavailable gate always means read-only. */
    }
  }
  return {
    ...context,
    user: result.data.user,
    writesEnabled: writesEnabled(env) && databaseWrites,
  };
}
// Router 7 clones Request for each route. Its per-request load context is the
// shared identity; keying by Request would race rotating refresh tokens.
const contexts = new WeakMap<object, Promise<AdminContext>>();
export function requireAdmin(request: Request, requestContext: object) {
  let context = contexts.get(requestContext);
  if (!context) {
    context = verifyAdmin(createAuthContext(request));
    contexts.set(requestContext, context);
  }
  return context;
}
export async function requireAdminMutation(
  request: Request,
  requestContext: object,
) {
  assertSameOrigin(request);
  const context = await requireAdmin(request, requestContext);
  assertWritesEnabled(process.env, context.headers);
  if (!context.writesEnabled)
    throw new Response('CMS đang ở chế độ chỉ đọc tại cơ sở dữ liệu.', {
      status: 503,
      headers: context.headers,
    });
  return context;
}
export async function adminRead<T>(
  context: AuthContext,
  read: () => Promise<T>,
) {
  try {
    return data(await read(), { headers: context.headers });
  } catch (error) {
    if (error instanceof Response) {
      const headers = new Headers(context.headers);
      error.headers.forEach((value, key) => {
        if (key !== 'set-cookie') headers.set(key, value);
      });
      for (const cookie of error.headers.getSetCookie())
        headers.append('Set-Cookie', cookie);
      throw new Response(error.body, {
        status: error.status,
        statusText: error.statusText,
        headers,
      });
    }
    throw new Response('Không thể tải dữ liệu quản trị. Vui lòng thử lại.', {
      status: 503,
      headers: context.headers,
    });
  }
}
export async function readAdminForm(
  request: Request,
  maxBytes = 3 * 1024 * 1024,
  headers = privateHeaders(),
) {
  if (Number(request.headers.get('Content-Length')) > maxBytes)
    throw new Response('Dữ liệu quá lớn.', { status: 413, headers });
  const type = request.headers.get('Content-Type') ?? '';
  if (
    !type.startsWith('application/x-www-form-urlencoded') &&
    !type.startsWith('multipart/form-data')
  )
    throw new Response('Định dạng yêu cầu không hợp lệ.', {
      status: 415,
      headers,
    });
  const reader = request.body?.getReader();
  if (!reader)
    throw new Response('Thiếu dữ liệu.', {
      status: 400,
      headers,
    });
  let length = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      reader.releaseLock();
      throw new Response('Dữ liệu quá lớn.', {
        status: 413,
        headers,
      });
    }
    chunks.push(value);
  }
  try {
    return await new Response(new Blob(chunks as BlobPart[]), {
      headers: { 'Content-Type': type },
    }).formData();
  } catch {
    throw new Response('Dữ liệu không hợp lệ.', {
      status: 400,
      headers,
    });
  }
}
