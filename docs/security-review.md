> Historical review of the 001/002 implementation. Lifecycle migration 003 supersedes its private-publication refusal. Current workflow, deployment prerequisites and limitations are in [post-lifecycle.md](post-lifecycle.md) and [media-publication.md](media-publication.md). Production remains unverified.

# SACUTE CMS production-readiness security review

Review date: 2026-11-10. Scope: existing uncommitted CMS working tree on top of
`91bc992`, React Router/Vercel SSR, Auth, administrative routes/actions, SQL/RLS,
Storage, concurrency and security tests. This review did not commit/deploy, connect
to a production database, run production SQL, create users, enable production
writes, copy production assets or delete production media.

**Decision: local hardening is implemented and tested; production approval is
blocked on the real audit and staging verification.** No Critical vulnerability
was confirmed in the inspected source. This is not evidence that the unknown
production policy state is safe.

## Findings and source locations

Baseline line numbers below identify the code at the start of this review. Fix
locations refer to the current files. The base SQL proposal was uncommitted and
has been hardened as well; existing installations need follow-up migration 002.

| ID   | Severity         | Finding and baseline location                                                                                                                                                                                                                                                                                                | Resolution / current location                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-01 | High             | New draft uploads were public immediately: `apps/web/app/services/admin-content.server.ts:258–265` uploaded into `post-media` with a one-year cache lifetime; its media browser at `:114–118` minted public URLs. Storage SELECT policies cannot protect serving from a public bucket.                                       | Fixed for new uploads at `admin-content.server.ts:231–257`: private `draft-media` staging. Authenticated preview at `apps/web/app/routes/admin-media-file.ts:9–43`; no signed/public URL for private objects. `features/admin/model.ts:298` and migration 002's publication guards refuse private attachments in published/scheduled posts. Existing public objects remain untouched and require owner inventory.       |
| H-02 | High             | The env gate protected web actions but not direct Supabase writes: original `supabase/migrations/202611100001_private_admin_cms.sql:79,87–91` granted admin writes with role-only policies; original save function at `:147–148` only checked admin role. An admin JWT could bypass web read-only mode via REST/RPC/Storage. | Fixed with independent owner-controlled DB gate, restrictive table/Storage guards, and an explicit RPC check in migration 002 (`:34`, `:52`, `:66`, `:206`). `admin-auth.server.ts:203–215,229–241` requires both gates for SSR mutations. Fresh base 001 has a false-returning gate placeholder, so it cannot activate before 002. Env false alone is not a DB switch: to stop ordinary clients close the DB gate too. |
| M-01 | Medium           | Media deletion had a reference-check/use race: original `apps/web/app/routes/admin-media.tsx:70–81` queried associations and then separately removed Storage bytes. Original Storage DELETE policies only used NOT EXISTS.                                                                                                   | Public deletion is now prohibited. Private unused deletion is owner-scoped at current `admin-media.tsx:61–87`. Migration 002 `sacute_protect_referenced_media` (`:143`) rechecks references after locking; association inserts/updates acquire object share locks. Real concurrent fixture sessions preserve the object. Actual Storage API transaction behavior still needs staging verification.                      |
| M-02 | Medium           | Optimistic concurrency locked the parent post but direct detail/media updates did not necessarily take that lock: original migration 001 `:170–183`. Those edits could race the snapshot check. Missing media payload also passed SQL's NULL comparison at original `:148`.                                                  | Migration 002 `sacute_lock_content_parent` (`:175`) serializes direct child edits, validates object existence and takes share locks; save RPC checks snapshot under parent lock (`:231–242`). Missing/wrong-shaped JSON is rejected at `:207`. Stale concurrent saves return 40001; a deliberately late media failure rolls back post and detail changes.                                                               |
| M-03 | Medium           | Upload validation accepted a magic prefix without decoding: original `admin-content.server.ts:228–254`. Header-only/truncated images, trailing payloads and huge decoded dimensions were not rejected/bounded.                                                                                                               | `apps/web/app/services/admin-image.server.ts:7–44` fully decodes/re-encodes static PNG/JPEG/WebP, compares actual format with declared MIME, strips metadata/trailing data, caps input/output at 3 MiB and pixels at 16 million. Sharp is server-only. Tests include truncated PNG/JPEG/WebP, MIME mismatch, pixel limits and trailing payloads.                                                                        |
| M-04 | Medium, residual | Logout must not be described as immediately revoking all JWT access. `apps/web/app/routes/admin-layout.tsx:40` calls local Supabase signOut. Existing fixture logout deleted its synthetic access token immediately (`tests/support/admin-supabase.mjs`, logout branch), which does not prove stateless Data API revocation. | Browser cookie clearing and refresh-token signout are retained and tested. Already issued JWTs may remain usable by stateless APIs until expiry. Verify actual Auth/session settings, choose an appropriate short token lifetime, and remove admin membership for emergency denial. No new privileged session checker or service-role fallback was introduced.                                                          |
| L-01 | Low              | The shared environment parser accepts HTTP URLs for local/public development. Auth previously reused it without rejecting remote HTTP upstreams (`admin-auth.server.ts`, original configuration/client setup).                                                                                                               | `admin-auth.server.ts:100–107` rejects non-HTTPS Auth upstreams except literal loopback hosts before sending credentials. Regression test confirms this.                                                                                                                                                                                                                                                                |

Public-bucket behavior is documented by [Supabase Storage bucket fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals).
JWT expiry/signout limits are documented by [Supabase signOut](https://supabase.com/docs/reference/javascript/auth-signout)
and [session behavior](https://supabase.com/docs/guides/auth/sessions). The server
continues to use [getUser verification for SSR](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

## Authorization, grants and RLS conclusions

- `/admin/login` is intentionally public. Its POST checks exact Origin, bounded
  form input, Supabase password authentication, trusted getUser identity and the
  database admin role. Redirect is fixed; there is no registration/return-URL flow.
- Every dashboard/list/editor/media loader explicitly requires an admin. Each save,
  upload and delete action requires admin, same-origin POST, env gate and DB gate.
  `/admin/media/file` independently authenticates each resource request.
- Logout requires same-origin POST and authenticated admin authorization, and is
  intentionally independent of content write gates. Auth state changes are not
  content writes; reads and login/logout still work while content is read-only.
- Administrative clients use publishable credentials plus the user's session.
  No secret/service key, metadata role, localStorage flag or public client fallback
  authorizes admin requests. Public content still uses the anonymous repository.
- All proposed CMS functions are SECURITY INVOKER with a fixed empty search_path.
  The content-saving RPC receives authenticated EXECUTE and checks admin and DB gate
  internally before writing. Read-only RLS helpers need anon/authenticated EXECUTE
  to evaluate policies and return false for non-admins. Trigger helpers have
  PUBLIC/anon/authenticated EXECUTE revoked and are not standalone RPC endpoints.
- Policies are intersected with restrictive guards, so permissive legacy policies
  do not widen ordinary application-role writes. Unknown restrictive policies can
  hide associations and undermine invoker NOT EXISTS reference checks; 002 aborts
  on unrecognized restrictive policies instead of silently dropping them. Owner
  review must verify complete admin visibility, including known policy definitions.
- Proposals reject disabled Storage RLS and elevated/owning application roles.
  Existing SECURITY DEFINER functions, other schemas, overloads, inherited grants,
  later owner changes, custom roles and owner/service access still require an actual
  audit. Invoker functions do not constrain a caller that already bypasses RLS.
- The expanded audit shows effective EXECUTE/table privileges, table/column/default
  ACLs, owners/RLS flags, bucket configuration, trigger function bodies and public
  draft/unattached-object counts. It is read-only; it has only run in the fixture.

## SSR, Vercel and session conclusions

`getUser()` verifies identity on the server before membership lookup. Auth clients
are request-scoped through React Router's per-request load context; its cloned
Request objects are not used as the shared identity. Cookies are HttpOnly,
SameSite=Lax, host-only, Path=/ and Secure on HTTPS. Path=/ is needed for
`/admin.data`. Cookie chunks and refresh Set-Cookie values survive matched
loaders, redirects and error paths. The adapter accepts SDK refresh cache headers;
admin document/data/resource responses are private/no-store with noindex and
nosniff. No token is emitted in loader data, URLs or app logs. Cookie retention
(seven days) is not JWT/session lifetime or a promise of indefinite authorization.

The React Router 7.18.5 Vercel Node preset and production SSR bundle build locally.
Sharp remains a server dependency; the client bundle credential/SDK regression
still passes. Live Vercel HTTPS forwarding, Secure cookies, multi-Set-Cookie/CDN
behavior, native module packaging and actual Supabase token refresh/revocation
were not exercised against a deployed environment. No deployment was authorized.
Login has provider error/429 handling, but deployment WAF/account rate-limit,
password and MFA configuration are not verified. Treat these as manual checks,
not assumed protections.

## Draft release behavior and limits

New assets remain private. Public URLs are never generated for staged files.
Editor/RPC/DB guards reject private attachments on publication, including a future
visible_from. Already public images may still be reused because they were already
released; archiving cannot make their historical URLs confidential.

**No automatic private-to-public copy was added.** See
[the prepared release procedure](media-publication.md). Owner-approved publication
first establishes a public post without sensitive staged media; only afterwards
may the owner deliberately copy approved files to immutable public paths and
attach them. This avoids exposing bytes when a draft save/publication rolls back.
It has an explicit temporary missing-gallery tradeoff. The two systems do not
share an atomic transaction; no compensating production deletion is attempted.

## Tests executed

Final local results:

| Command                  | Result                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`              | Pass                                                                                                                   |
| `pnpm format:check`      | Pass                                                                                                                   |
| `pnpm typecheck`         | Pass                                                                                                                   |
| `pnpm test`              | 50 passed                                                                                                              |
| `pnpm build`             | Pass                                                                                                                   |
| `pnpm test:e2e`          | 40 passed                                                                                                              |
| `pnpm test:security:sql` | Pass: both proposals, audit, original/new RLS assertions, unknown-policy abort, and three concurrent-session scenarios |

Eight new HTTP/decoder tests cover actual upload/delete intents with gate false,
independent DB gate denial, remote HTTP Auth rejection, malformed and oversized
images, private previews, private draft association/publish refusal, namespace
ownership, unused deletion and chunked cookies. Existing auth/SSR/data/SEO tests
remain. Browser coverage now also uploads a private image, previews it through
an authenticated resource, saves its draft and checks publication rejection.

SQL tests run in an automatically removed PostgreSQL 16.6 container with
`--network none`, no exposed ports, synthetic users/content and no production
credentials. Stale RPC concurrency, RPC attachment/delete and direct-association/
delete are exercised with real separate transactions. Test fixture gate changes
are local only. This does not verify production Auth signing, Storage service
internals, all real constraints/triggers or production policy state.

## Required manual actions / production blockers

1. Keep `ADMIN_WRITES_ENABLED=false`; keep/confirm
   `public.admin_cms_settings.writes_enabled=false`. Env cannot switch raw Data API
   policies; both gates must be closed for ordinary clients. In-flight work must
   settle before maintenance. Owner SQL and elevated legacy functions remain outside
   these guards and must be audited separately.
2. Run `supabase/audits/admin_rls_audit.sql` as project owner and review effective
   EXECUTE, PUBLIC/default/inherited grants, RLS/owners, role constraints/FK,
   existing function bodies and all Auth/content/Storage triggers. Confirm
   admin_profiles.user_id and post/detail/media types match; check that media bucket
   constraints allow private staging. Verify admin visibility of every reference.
3. Review both proposals. Fresh projects use version order 001 then 002; a project
   with earlier 001 already applied needs 002, not blind reapplication of 001.
   Apply first to an authorized staging clone. The SQL leaves writes false and
   changes no existing post/asset content. Unknown restrictive policies, public
   staging buckets or schema mismatches must be reviewed without disabling RLS or
   deleting data. Existing settings/bucket configuration requires owner validation.
4. In staging, test the actual Storage upload/download/delete APIs and new trigger
   privileges/transaction behavior, raw public-URL denial for private objects,
   anonymous/non-admin REST/RPC rejection, all role paths, late rollback and both
   gates. The local SQL engine cannot prove the Storage service's internals.
5. Inventory previously public draft/unattached CMS assets. Do not delete production
   media or change existing published URLs. Agree on explicit remediation/release
   handling for any file that was incorrectly made public; caches cannot be revoked
   by this patch. Approve the prepared owner publication procedure separately.
6. Verify Auth token/session lifetimes, getUser and signout behavior, emergency
   membership removal, password policy, rate limits and deployment WAF settings.
   Verify real Vercel HTTPS/cookie/cache/native-library behavior in staging.
7. Only after those checks may the owner decide whether to enable DB and env gates
   for a controlled deployment. This review does not give production security
   approval or execute that enablement.
