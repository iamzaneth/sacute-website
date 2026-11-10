# Post lifecycle operations

Implemented locally; **production schema, RLS, Auth and Storage behavior are not verified**. Keep both `ADMIN_WRITES_ENABLED=false` and `admin_cms_settings.writes_enabled=false` until owner review and staging verification. Never run the initial import again. No production SQL, deployment, record deletion or media deletion was performed.

## States and transitions

`packages/shared/src/lifecycle.ts` is the shared state/transition contract. SQL independently validates transitions under a row lock, using database time. Scholarship/event lifecycle fields remain independent.

| CMS state   | Stored representation                                    | Actions                                                          |
| ----------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| Bản nháp    | `status=draft`, no deletion                              | Save, publish, schedule, archive, Trash                          |
| Đã lên lịch | `status=published`, future `visible_from`, no deletion   | Edit preserving schedule, reschedule, cancel, publish now, Trash |
| Đã xuất bản | `status=published`, due/null `visible_from`, no deletion | Edit, hide, archive, Trash                                       |
| Đã lưu trữ  | `status=archived`, no deletion                           | View, restore to draft, Trash                                    |
| Thùng rác   | `deleted_at IS NOT NULL`                                 | View, restore to draft; permanent delete disabled                |

Save Draft, Cancel Schedule, Hide, Restore Archive and Restore Trash all return to `draft` with `visible_from=NULL`. Archive sets `archived` and clears `visible_from`. Trash records database time and `auth.uid()` in `deleted_at/deleted_by`, preserves the record/slug/content/details/gallery and clears public visibility. Restore clears both deletion fields and never republishes. Slugs remain reserved even in Trash; duplicate restoration is rejected with a clear conflict error. All lifecycle operations preserve Storage files and media ordering.

The list defaults to live records and has separate Draft/Scheduled/Published/Archive/Trash filters, search and kind filtering. Secondary actions use compact contextual controls with confirmation for hide/archive/cancel/Trash. Archived and trashed editors are view-only until restored. Pending requests and read-only mode disable mutations; unsaved editor changes must be saved before contextual transitions.

## Scheduling and publication timestamps

Choose date, time and timezone (default `Asia/Ho_Chi_Minh`, alternative UTC). Example `2030-11-15 07:00 Asia/Ho_Chi_Minh` becomes `2030-11-15T00:00:00Z`. Browser validation improves feedback; the server validates again against the database clock and the RPC repeats strict calendar/timezone/future validation with PostgreSQL `AT TIME ZONE`. Supported zones have explicit, stable offsets; arbitrary DST zones are rejected rather than guessed. The exact UTC instant is stored, not the originally selected timezone. Admin display consistently uses Vietnam time.

There is no scheduler/cron job. Every public query requires:

```sql
status = 'published' AND deleted_at IS NULL
AND (visible_from IS NULL OR visible_from <= public.sacute_content_time())
```

The shared repository retrieves `sacute_content_time()` from PostgreSQL; no server/browser clock fallback is used. RLS applies the same predicate to posts, media, details and private Storage objects. A post becomes readable at its due instant on the next request. A request started before the boundary can remain hidden until the following request. Public SSR, APIs, lists, search, SEO loaders and detail routes share the repository. Static sitemap contains only public feed URLs. SSR HTML/API/byte responses retain `no-store`. The public browser resource uses private conditional caching; previously public RAM snapshots can appear immediately during background validation; a fresh RLS/database read confirms or replaces them. An already received snapshot can remain visible briefly until this validation completes, while direct server requests still enforce current visibility. There are no build-time article snapshots or stale-content TTLs. Open pages revalidate on navigation, retry or browser focus; see [loading/cache](loading-and-cache.md).

Publish Now clears `visible_from` and initializes first-publication metadata with database time. For new scheduled posts it stores the planned instant; rescheduling before first publication changes that planned timestamp. Once the due time has passed, the existing timestamp is preserved. Historical imported dates are never rewritten automatically. Nullable `publication_recorded` preserves legacy provenance (existing publication metadata is treated as historical); new drafts default false. The editor's explicit date-correction checkbox is required to change historical publication dates. Calendar dates remain dates; timestamps require an explicit offset and matching Vietnam calendar date.

## Atomicity, authorization and concurrency

`admin_save_post` saves the post/type details/gallery in one PostgreSQL transaction. `admin_transition_post` changes only lifecycle metadata. Both are SECURITY INVOKER, authenticated-only EXECUTE, check admin membership and database gate, and obey RLS. Server actions require `getUser()`, `admin_profiles.role=admin`, exact Origin, environment and database write gates, validated intent and UUID revision. Mutation RPCs take the post row lock and reject stale revisions with SQLSTATE 40001 / HTTP 409. Saves additionally compare the complete previous editable snapshot. Child-table edits lock the parent and bump its UUID revision so external media/detail edits also invalidate stale editors. Invalid scheduling/validation leaves all associations unchanged. Refresh the editor after conflict; no silent overwrite/retry.

No Storage call is made for hide/schedule/archive/Trash/restore. New images stay in the private bucket and publication changes database access permissions atomically with post state; there is no file-copy transaction. See [media publication](media-publication.md).

Permanent deletion is deliberately disabled: the Trash button is disabled, the action rejects it, RPC rejects it and DELETE on posts is revoked with a restrictive false policy. Actual inbound FK behavior, shared media ownership, Storage service transactions and recoverable cleanup have not been verified in production. There is no hard-delete shortcut. A future implementation needs a reviewed dependency inventory, slug confirmation, recoverable cleanup journal and failure handling; file deletion and row deletion cannot be one atomic transaction.

## Manual migration and verification

1. Take backups and keep both gates false. Run `supabase/audits/admin_rls_audit.sql` (read-only) as owner; review effective grants, all policies including restrictive ones, function overloads/EXECUTE/owners, trigger bodies, inbound FKs, uniqueness, roles, bucket visibility and existing public draft assets. Resolve legacy elevated RPCs and hidden associations before proceeding. Never disable RLS.
2. Review migrations in order: `202611100001_private_admin_cms.sql`, `202611100002_admin_security_hardening.sql`, then `202611100003_post_lifecycle.sql`. Apply only unapplied migrations, first to a staging clone, manually. 003 adds nullable deletion/update metadata, a UUID revision, publication provenance, indexes, transition RPCs and visibility policies; it resets the DB gate to false. It replaces only reviewed named CMS policies/functions. It does not rewrite article content, publish posts, delete files or change bucket visibility. Existing incompatible columns, duplicate slugs, legacy ordering indexes, restrictive policies and trigger behavior require owner adaptation after review. Do not blindly rerun.
3. Inspect existing `deleted_by` data before validating the new FK. When clean, manually execute `ALTER TABLE public.posts VALIDATE CONSTRAINT sacute_posts_deleted_by_fkey;`. Re-run the audit. Confirm all content and Storage policies include deletion and due-time guards, draft-media stays private, mutation functions have no PUBLIC/anon EXECUTE and no elevated bypass remains. Confirm the new helpers and columns are exposed to PostgREST (schema cache refresh if necessary).
4. Deploy compatible web and API code together after schema verification; the new public repository requires 003 even with writes disabled. Before 003, the new repository fails closed rather than reverting to unsafe legacy visibility. Deploy through the owner's normal release process; this task does not deploy.
5. Provision an admin following [CMS operations](admin-cms.md). In staging test anonymous, authenticated non-admin and admin access through SSR `.data`, REST, RPC and the real Storage service. Check every transition, before/after exact schedule boundary, Vietnam conversion, historical dates, stale editors, rollback, slug reservations, private images and preserved public galleries. Validate logout/refresh cookies through Vercel HTTPS. Confirm no-store and no public admin links.
6. Only after owner approval and staging success, owner SQL may set `UPDATE public.admin_cms_settings SET writes_enabled=true WHERE singleton;`, then set the deployment's `ADMIN_WRITES_ENABLED=true`. Neither is enabled here. To disable ordinary client writes, close the DB gate and environment flag; review elevated owner paths separately.

Local tests use deterministic clocks and synthetic datasets. The optional `pnpm test:security:sql` creates a disposable PostgreSQL 16 container with deliberately broad legacy policies, applies 001/002 and their regressions, then 003 and lifecycle assertions. It does not connect to production and does not emulate Supabase CDN/Auth internals. Never run any `tests/sql/*` fixture against a real Supabase project.

## Local verification and changed areas

Verified in this working tree on 2026-11-10: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (59 passed), `pnpm build`, `pnpm test:e2e` (41 passed) and opt-in `pnpm test:security:sql` all passed. The browser suite includes private image publication/hide, full lifecycle controls and public responsive/accessibility regressions. An earlier browser run found the old private-publication-refusal assertion; it was updated to assert conditional publication and revocation, and the full suite was rerun successfully. No check used or mutated production data. These results establish local behavior, not production readiness approval.

Existing CMS authentication, layout, CSRF, dual write gates, editor, type-specific validation, private uploads, gallery ordering and atomic save architecture were reused. Changes for this lifecycle extension:

- Shared domain/repository: `packages/shared/src/lifecycle.ts`, `content.ts`, `index.ts`.
- Admin validation/data/UI: `apps/web/app/features/admin/model.ts`, `post-editor.tsx`, new `lifecycle-controls.tsx`; `services/admin-content.server.ts`; dashboard, posts, new/edit and media routes; `styles/admin.css`.
- Public private-image adapters: new `apps/web/app/routes/public-media.ts`, route registration and preview dispatch; new `apps/api/src/common/media.controller.ts`, content repository and module registration.
- Database: new `supabase/migrations/202611100003_post_lifecycle.sql`; expanded `supabase/audits/admin_rls_audit.sql`. Existing 001/002 proposals are preserved.
- Tests: new `tests/lifecycle.test.mjs`, `tests/sql/post-lifecycle.sql`; expanded admin/security/browser/API suites and synthetic adapters; SQL fixture Auth users and opt-in SQL runner.
- Operations: README, architecture/API/migration/deployment/CMS/security notes, this guide, media publication guide and environment example comments. Both environment examples still set writes false. No new dependency was needed for this extension.

Remaining blockers: owner audit of actual production policies/grants/triggers/FKs, manual migration review/application, staging verification of real Auth refresh/revocation and Storage/CDN behavior, and an owner-controlled compatible deployment. Permanent deletion remains disabled. Real public assets and production content were preserved.
