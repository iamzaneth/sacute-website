# Architecture and evolution

## Current boundaries

`@sacute/shared` owns organization metadata, public navigation, transport contracts, prepared local content collections, and pure filtering/pagination. It emits strict TypeScript declarations and CommonJS for NestJS and the framework configuration loader. Vite aliases the package to its TypeScript source so browser builds and the development module runner consume standard ES modules. Rebuild shared output after contract changes; root development and build scripts do this automatically at startup.

`@sacute/web` uses React Router route modules and generated route types, Vite, React, Tailwind, Lucide, reusable layout/UI, and feature components. Route loaders use the local `ContentProvider` during prerendering. The NestJS server and database are never build prerequisites. `createApiContentProvider` is a separate opt-in browser adapter with timeout/error handling; it is not called during rendering. The current local collections make runtime requests unnecessary.

`@sacute/api` has thin controllers, domain services, a repository token, and a local repository. Environment validation runs at startup; DTO validation runs globally with unknown fields rejected. No database configuration is needed. Standard TypeScript decorator metadata is emitted by `tsc` and `ts-node`.

The local provider uses approved posts from `apps/api/mock-data/posts`, prepared by `scripts/prepare-mock-content.mjs`. Events also appear in the Information feed under Hoạt động; scholarships remain empty until approved content is supplied. Tests use isolated synthetic records that are never displayed to visitors.

Recruitment team content is separate from dated announcements and recruitment campaign status. Its single typed source is `apps/web/app/features/recruitment/data/recruitment-teams.ts`. Records contain stable IDs/slugs, plain icon identifiers, descriptions, responsibilities, requirements and benefits; no JSX, icon components, dates or application URLs are stored in the data. `TeamExplorer` maps icon identifiers to Lucide components and renders the same records in overview links and native detail disclosures. It makes no network requests. Contact metadata is configured centrally in the shared organization object.

To persist recruitment later, move the existing `RecruitmentTeam` contract into the shared package when adding the first NestJS recruitment endpoint; retain its shape rather than introducing a second competing model. Import the local records into a migration/seed only after editorial approval. Keep campaign dates, status and application URLs in a separate campaign model. A server provider can then return a reviewed build-time snapshot, preserving static build independence, or supply server route loaders after an explicit SSR migration. Keep the Học tập duplication flagged until approved corrected text is provided.

## Supabase PostgreSQL integration later

1. Obtain an approved Supabase project and keep database credentials only in API/server environment variables. Do not use public `VITE_*` settings for database access.
2. Select Prisma if appropriate and add a schema/migrations for information, scholarships, and events, including unique slugs, publication status, verified content, and optional dates/contact fields. Check current Supabase connection/pooling guidance for the deployment runtime before configuring connections.
3. Add a database module and `PrismaContentRepository` implementing `ContentRepository`. Apply pagination and filtering in SQL while preserving response contracts. Map records explicitly; avoid returning database-specific types through controllers.
4. Replace the repository token's `useClass` binding. Add integration tests against a disposable test database and verify migrations, search semantics, timezone handling, and unpublished-record exclusion.
5. Decide whether the static frontend consumes an approved build-time content snapshot, or whether to introduce SSR. An exported snapshot preserves independent static builds; SSR can resolve data in server route loaders. For interactive live lists, inject the existing API adapter and implement loading/error/retry UI.
6. Add editorial approval, authorization, audit history, and administration as a separate scoped feature. Existing API routes are read-only and provide no CMS today.

## Production decisions still required

- Official domain, remaining media/content, telephone number, and recruitment campaign dates/application URL. Supplied logo and contact links are integrated.
- Static hosting and real HTTP 404 fallback rules; deploy `.data` and assets with HTML.
- API hosting, production origin allowlist, TLS, monitoring and operational limits.
- Editorial review before enabling indexing; canonical URLs are configuration-driven.
- Authentication and submission delivery only when a real supported backend exists.

No Docker, orchestration framework, ORM, database client, or placeholder production credentials were introduced.
