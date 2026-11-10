# Private SACUTE CMS operations

The CMS is implemented locally. No production SQL, content import, deployment, or
account provisioning was performed. Production policies and credentials still need
an owner review. **Keep `ADMIN_WRITES_ENABLED=false` and the database gate false until all steps below pass.**

The focused security follow-up is documented in [security-review.md](security-review.md). Migrations 001, 002 and `202611100003_post_lifecycle.sql` are required. Base 001 cannot activate writes. Migration 003 adds scheduling, reversible lifecycle controls and conditional private-image delivery, superseding the 002-only private-publication refusal. See [post-lifecycle.md](post-lifecycle.md) and [media-publication.md](media-publication.md).

## Access and sessions

Open `/admin/login` directly. Public navigation has no admin or authentication link.
There is no registration page. Routes: `/admin`, `/admin/posts`,
`/admin/posts/new`, `/admin/posts/:id/edit`, `/admin/media`.

The server uses `@supabase/ssr` with a request-specific client and cookie adapter.
It calls `auth.getUser()` against Supabase Auth on each protected loader/action,
then reads `admin_profiles.role` by `user_id`. The only accepted role is `admin`.
Anonymous/expired sessions redirect to the login page; authenticated non-admins
receive HTTP 403. Auth/database outages fail closed. User-editable metadata never
grants access. The authenticated client uses the publishable key and the user's
session, so PostgreSQL RLS applies to every content request and RPC.

Cookies have HttpOnly, SameSite=Lax, Path=/, a seven-day browser retention,
and Secure on HTTPS. Supabase controls token expiry and refresh/revocation; cookie
retention does not extend a revoked session. There is no browser Supabase client,
localStorage session, or token in loader data, URLs, or application logs. Matched
loaders share authentication through React Router’s per-request load context (its Request objects are cloned per loader) and propagate refreshed cookies.
Path=/ is necessary for React Router’s `/admin.data` client navigation requests; public loaders ignore these cookies.
All proposed CMS SQL functions use SECURITY INVOKER. The membership helper reads only the caller’s profile through RLS; anonymous profile reads return no rows. Neither helper nor save function bypasses policies.
All admin responses are private/no-store and noindex, with frame protection.
Logout is a same-origin POST to `/admin`, independent of the content write gate.
It requests local-session signout, clears browser cookies and returns to login. Refresh-token revocation does not invalidate an already issued JWT in stateless Data API/Storage checks until expiry. Verify live Auth revocation behavior; use short access-token lifetimes and remove admin membership for emergency denial. Local adapter tests do not prove live global revocation.

Forms require a POST with an exact matching Origin; cross-site or missing Origin
is rejected, including login, logout, uploads and saves. React Router can also
reject cross-origin document POSTs with HTTP 400 before the action runs.
The login destination is fixed at `/admin`; no `next`/return URL is used.

References: [Supabase SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[session verification and refresh](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

## Environment

Set server runtime variables for the web app (never `VITE_` prefixes):

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
ADMIN_ORIGIN=https://sacute.vercel.app
ADMIN_WRITES_ENABLED=false
```

Legacy anon keys are accepted; secret/service-role keys are rejected. No privileged
key is used or required by the CMS. `ADMIN_ORIGIN` must be the exact HTTPS origin,
without a trailing slash or path. Set the corresponding origin on preview/local
environments (for example `http://127.0.0.1:5173`). When unset it defaults to the
request origin; explicitly configure it in production. Writes default to false;
only the literal string `true` enables application mutations. It never bypasses
server authorization or RLS. The server also requires the independent database gate in `public.admin_cms_settings` to be true; missing/error/false is read-only. A runtime env flag cannot control direct Supabase clients: close the DB gate as well for a complete write shutdown. Authentication/logout and reads remain available. Restart/redeploy to apply runtime environment changes.

## Manual Supabase checklist

1. Confirm the correct project and take the normal database/Storage backup.
   Keep the write flag false. Do not rerun the initial content import.
2. Run `supabase/audits/admin_rls_audit.sql` in the Supabase SQL editor as the
   project owner. It uses a read-only transaction, prints policy definitions,
   table and column grants, schema, constraints/indexes, bucket configuration,
   triggers, function bodies/owners/grants, role membership and RLS status. Save
   the output privately for review. It does not print user credentials or posts.
3. Check the real schema before applying the proposal: `admin_profiles.user_id`
   must be UUID, unique, linked to `auth.users.id`, with database-managed `role`;
   posts/media IDs are UUIDs, `posts.created_by/updated_by` accept `auth.uid()`,
   detail tables are unique by `post_id`, and the columns/types match the shared
   repository and SQL function. If the membership key is `id` instead of
   `user_id`, adapt both the server query and SQL after review. The migration
   intentionally aborts on a missing membership key or bucket.
4. Review every existing policy, function and provisioning trigger. In particular,
   remove/restrict legacy SECURITY DEFINER RPCs or Auth triggers that grant admin
   from user metadata or allow arbitrary writes. Those can bypass RLS and cannot
   be made safe by adding policies. Verify anonymous/authenticated roles have
   neither BYPASSRLS nor elevated role membership. Review all restrictive policies:
   these may correctly deny operations even when the new permissive policy allows
   them. Never disable RLS to resolve a denial. Migration 002 aborts on unrecognized restrictive policies: review them explicitly before adapting the allowlist. Admin SELECT must cover all media references; a hidden association can invalidate an invoker NOT EXISTS safety check.
5. Review `supabase/migrations/202611100001_private_admin_cms.sql`, `supabase/migrations/202611100002_admin_security_hardening.sql` and `supabase/migrations/202611100003_post_lifecycle.sql`. It enables
   RLS, removes table/column grants on the five scoped public tables, grants reads
   and admin-scoped writes, blocks profile mutations, and intersects existing
   policies with restrictive guards. Only its named policies/functions/indexes are
   replaced. It does not remove unrelated policies, import content, delete rows,
   touch existing Storage files, change bucket visibility or recreate tables.
   The image association migration replaces only exact global unique path indexes
   with `(post_id,bucket,storage_path)` uniqueness to allow reuse. Review dependent
   foreign keys first; there is no CASCADE. Check legacy ordering/cover constraints
   and triggers permit temporary high ordering values and clearing covers within
   a transaction. Review grants to PUBLIC/other database roles separately.
6. Apply all three reviewed migrations in version order manually in the SQL editor, first in a staging clone. Apply only unapplied migrations; never rerun blindly. The proposals leave the database gate false. Follow the lifecycle guide for the new FK validation and schema/code deployment order.
   It is one transaction with lock/statement timeouts. A failure rolls it back;
   inspect the error and adapt to the audited schema. Never auto-retry by removing
   security checks. Keep write flag false while validating. Re-run the audit.
7. In Supabase Authentication → Users, create a confirmed email/password user for
   the editor. Use the owner dashboard's user creation with a temporary password,
   then securely hand off/reset it using Supabase's account tooling. Alternatively,
   invite through an already configured trusted invitation/password setup flow.
   This app does not implement invitation callbacks, password recovery or signup;
   an invitation email alone does not complete password setup here. Disable public
   signups in Supabase if this project has no other signup consumers. Configure
   password policy and Auth rate limits; add deployment-level login rate limiting
   as appropriate for your hosting environment.
8. Copy the Auth user's UUID and grant membership manually using the SQL editor
   (replace the placeholder; do not put an email or metadata role here):

   ```sql
   INSERT INTO public.admin_profiles (user_id, role)
   VALUES ('00000000-0000-4000-8000-000000000001'::uuid, 'admin');
   ```

   Use the audited table's other required fields if any. For an existing row,
   review it and update its role explicitly. Do not add client-side membership
   writes. Removing membership immediately denies subsequent protected requests.

9. Test login, non-admin HTTP 403, direct protected URLs/data requests, expiry,
   logout, draft privacy, public feeds, existing article URLs and media. Check
   policies as anon, a normal authenticated user and admin. Confirm non-admins
   cannot mutate profiles, posts, details, associations or Storage by REST/RPC.
10. Verify `draft-media` exists with `public=false`, a 3 MiB limit and PNG/JPEG/WebP allowed types. If an existing bucket is public, migration 002 aborts; owner investigation is required. Do not flip it silently or delete assets. Check existing bucket constraints, legacy public draft objects, effective RPC EXECUTE grants, and Storage trigger compatibility. Test anonymous raw public-URL access to staged files is denied by the actual Storage service. Admin previews use `/admin/media/file`, authenticate every request, and mint no public or signed URL.
11. Only after audit, staging, all three reviewed migrations and private-delivery workflow approval, the project owner may change the DB gate with owner SQL:

    ```sql
    UPDATE public.admin_cms_settings SET writes_enabled = true WHERE singleton;
    ```

    Then set `ADMIN_WRITES_ENABLED=true` for the intended deployment. This is a manual production operation; neither migration nor test runner does it in production. Test draft creation, private upload/preview, stale save, publish/archive and unused private deletion. Verify private images are denied before publication and served only at/after the due time, then denied again after hiding/Trash. Automatic public copying is not implemented. To stop all ordinary client writes, set the database gate false and the environment flag false. In-flight operations must be allowed to settle before maintenance. Owner SQL/elevated legacy functions remain outside these application-role guards and require independent audit.

Unknown restrictive policies must be reviewed before 002 can run. It aborts rather than deleting those policies. Confirm admin visibility of every media association; owner/elevated RPCs and later owner policy changes remain outside ordinary-role guarantees.

## Save and media semantics

A single SECURITY INVOKER RPC saves post fields, type details and ordered image
associations atomically. It checks admin membership itself and still obeys RLS.
The previous editor snapshot is compared under a post row lock; a stale save
returns HTTP 409 instead of overwriting it. Existing slugs are immutable so existing
public URLs remain valid. Unedited author/source metadata and retained media IDs/
source metadata remain intact. Switching kind removes the old type detail only as
part of the authorized save transaction. Archive removes public visibility without
physically deleting the article. Permanent deletion is explicitly disabled in Trash, actions, RPC and grants.

Publication status and scholarship/event lifecycle are independent. Published
posts initialize publication metadata from database time unless existing historical metadata is preserved. Timestamp precision requires an ISO timestamp with
an explicit offset and a matching Asia/Ho_Chi_Minh calendar date. Date-only input
stays a calendar date; the editor does not fabricate midnight timestamps. Future
`visible_from` schedules public visibility. Markdown is safely shown as text, as
on the existing public site; the CMS does not introduce arbitrary HTML rendering.

Uploads use immutable `draft-media/admin/<admin UUID>/<random UUID>.<ext>` paths. The server fully decodes and re-encodes static PNG/JPEG/WebP with Sharp, checks declared MIME against detected format, strips metadata/trailing payloads, caps input/output at 3 MiB and decoded images at 16 million pixels. Existing public assets are never rewritten. Video/SVG/animated uploads are excluded. Private previews require authenticated admin access and private/no-store responses with nosniff.

The browser can browse private and already public media separately and copies bucket-qualified references for attachment. Private attachments are preserved through all transitions. Migration 003 permits public delivery only while an associated parent is published, due and outside Trash; both SSR and NestJS use guarded byte routes. Archive/Trash editors are view-only until restored. The CMS never copies/moves an object to a public bucket; database and object bytes do not share an atomic transaction.

Only unused private images in the current admin's namespace can be deleted. Public assets cannot be deleted by CMS actions or policies. The SQL delete trigger rechecks references after the object row lock; child-table triggers use the parent post lock to serialize changes with the save RPC. Test these triggers against the real staging Storage service before approving production. No RLS-bypassing helper is introduced.

Previously released public URLs remain public even if their post is later archived or saved as a draft. Inventory any pre-existing draft/public objects manually; this change cannot revoke public caches and does not delete production files. There is no rich text editor, realtime coediting, automatic asset promotion, password reset UI or MFA challenge in this scope.

## Verification

Run all repository checks:

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
# Opt-in: isolated disposable PostgreSQL 16, no production connection
pnpm test:security:sql
```

HTTP tests use synthetic Supabase Auth/PostgREST adapters and the production SSR
build; injected checks verify the write gate, metadata spoofing and cookie flags.
Browser tests cover admin access and read-only controls in addition to public
regressions. These do not verify the production Supabase deployment.

Optional independent SQL validation uses a disposable PostgreSQL 16 database. The
fixture intentionally creates insecure legacy policies to exercise restrictive
guards. **Never run `tests/sql/admin-bootstrap.sql` against Supabase.** Example:

```sh
docker run --rm -d --name sacute-cms-sql-test --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16.6-alpine
docker exec -i sacute-cms-sql-test psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/admin-bootstrap.sql
docker exec -i sacute-cms-sql-test psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611100001_private_admin_cms.sql
docker exec -i sacute-cms-sql-test psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611100002_admin_security_hardening.sql
docker exec -i sacute-cms-sql-test psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/admin-rls.sql
docker exec -i sacute-cms-sql-test psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/admin-security.sql
docker exec -i sacute-cms-sql-test psql -U postgres -v ON_ERROR_STOP=1 < supabase/audits/admin_rls_audit.sql
docker exec -i sacute-cms-sql-test psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611100003_post_lifecycle.sql
docker exec -i sacute-cms-sql-test psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/post-lifecycle.sql
docker stop sacute-cms-sql-test
```

The disposable fixture models the known schema, not all production constraints,
triggers, Storage service behavior or Auth settings. A successful local SQL test
does not replace the manual production audit/staging exercise.
